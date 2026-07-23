import { useState, useRef, useEffect } from 'react'
import { usePatientContext } from '../context/PatientContext'
import { getOrCreateDeviceId, type AssistantMessage } from '../context/AssistantContext'
import { MessageSquare, Search, Send, Bot, User, History, Pencil, Trash2, Check, X, Plus } from 'lucide-react'
import { useAllPatients, useEHRDiagnoses, useEHRMedications, useAlerts, useVitals, useChatSessions, fetchChatSessionMessages, renameChatSession, deleteChatSession } from '../hooks/useClinicalData'
import { useAssistantChat } from '../hooks/useAssistantChat'
import type { Patient } from '../types/clinical'

const COLOR = '#0EA5E9'
const CARD_BG = '#111827'
const BORDER = '#1F2937'
const TEXT_SUB = '#9CA3AF'
const RISK_COLOR: Record<string, string> = { critical: '#EF4444', high: '#F59E0B', medium: '#0EA5E9', low: '#22C55E' }

type ChatMessage = AssistantMessage

const SUGGESTED_QUESTIONS = [
  'What are this patient\'s current medications?',
  'Summarize their active diagnoses',
  'Any critical alerts I should know about?',
]

export default function ChatAssistantPage() {
  const patients = useAllPatients()
  const { selectedPatient: selected, setSelectedPatient: setSelected } = usePatientContext()
  const [search, setSearch] = useState('')
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [asking, setAsking] = useState(false)
  const [sessionId, setSessionId] = useState<number | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [deviceId] = useState(getOrCreateDeviceId)
  const { ask: askAssistant } = useAssistantChat(setMessages, setAsking, setSessionId)

  const [showHistory, setShowHistory] = useState(false)
  const [sessionsRefreshKey, setSessionsRefreshKey] = useState(0)
  const [editingSessionId, setEditingSessionId] = useState<number | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const sessions = useChatSessions(deviceId, sessionsRefreshKey, selected?.id)

  // A new session is created (or an existing one touched) on every sent message — bump the
  // refresh key so the History panel doesn't sit on stale data until the next 15s poll tick.
  useEffect(() => { if (sessionId != null) setSessionsRefreshKey(k => k + 1) }, [sessionId])

  async function loadSession(id: number) {
    const rows = await fetchChatSessionMessages(id, deviceId)
    setMessages(rows.map(m => ({ role: m.role as AssistantMessage['role'], text: m.content, sources: m.sources as AssistantMessage['sources'] })))
    setSessionId(id)
    setShowHistory(false)
  }

  function startRename(id: number, currentTitle: string | null) {
    setEditingSessionId(id)
    setEditTitle(currentTitle ?? '')
  }

  async function saveRename(id: number) {
    await renameChatSession(id, deviceId, editTitle.trim() || 'Untitled')
    setEditingSessionId(null)
    setSessionsRefreshKey(k => k + 1)
  }

  async function removeSession(id: number) {
    await deleteChatSession(id, deviceId)
    if (sessionId === id) { setMessages([]); setSessionId(null) }
    setSessionsRefreshKey(k => k + 1)
  }

  const diagnoses = useEHRDiagnoses(selected?.id)
  const medications = useEHRMedications(selected?.id)
  const vitals = useVitals(selected?.id)
  const { alerts } = useAlerts()
  const patientAlerts = alerts.filter(a => a.patient_id === selected?.id)

  const filtered = search.trim()
    ? patients.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.id.toLowerCase().includes(search.toLowerCase()))
    : patients

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }) }, [messages, asking])

  function selectPatient(p: Patient) {
    setSelected(selected?.id === p.id ? null : p)
    setMessages([])
    setSessionId(null)
  }

  function ask(q: string) {
    if (!selected || !q.trim() || asking) return
    setQuestion('')
    askAssistant(q, {
      deviceId,
      sessionId,
      patientId: selected.id,
      patientName: selected.name,
      context: {
        diagnoses,
        medications,
        vitals: vitals ? `HR ${vitals.hr}, BP ${vitals.sbp}/${vitals.dbp}, SpO₂ ${vitals.spo2}%, Temp ${vitals.temp}°C, RR ${vitals.rr}` : null,
        alerts: patientAlerts,
      },
    })
  }

  return (
    <div style={{ padding: '24px', minHeight: '100%', background: '#0A0F1E' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: `${COLOR}18`, border: `1px solid ${COLOR}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <MessageSquare size={20} color={COLOR} />
        </div>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#fff', margin: 0 }}>Clinical AI Chat Assistant</h1>
          <p style={{ fontSize: '12px', color: TEXT_SUB, margin: 0 }}>Ask questions grounded in a specific patient's record</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '16px' }}>
        <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', overflow: 'hidden', alignSelf: 'start' }}>
          <div style={{ padding: '10px 12px', borderBottom: `1px solid ${BORDER}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', background: '#0A0F1E', border: `1px solid ${BORDER}`, borderRadius: '7px', padding: '6px 10px' }}>
              <Search size={12} color={TEXT_SUB} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search patients…"
                style={{ background: 'none', border: 'none', outline: 'none', color: '#fff', fontSize: '12px', flex: 1 }} />
            </div>
          </div>
          <div style={{ maxHeight: '460px', overflowY: 'auto' }}>
            {filtered.map(p => {
              const sel = selected?.id === p.id
              const rc = RISK_COLOR[p.risk] ?? COLOR
              return (
                <div key={p.id} onClick={() => selectPatient(p)}
                  style={{ padding: '10px 12px', borderBottom: `1px solid ${BORDER}60`, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', background: sel ? `${COLOR}10` : 'transparent', borderLeft: sel ? `3px solid ${COLOR}` : '3px solid transparent' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: `${rc}14`, border: `1px solid ${rc}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: '9px', fontWeight: 700, color: rc }}>{p.risk[0].toUpperCase()}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                    <div style={{ fontSize: '10px', color: TEXT_SUB }}>{p.id}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {!selected ? (
          <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '500px', flexDirection: 'column', gap: '10px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: `${COLOR}14`, border: `1px solid ${COLOR}28`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MessageSquare size={22} color={COLOR} />
            </div>
            <p style={{ fontSize: '14px', color: '#fff', margin: 0, fontWeight: 500 }}>Select a patient</p>
            <p style={{ fontSize: '13px', color: TEXT_SUB, margin: 0 }}>Ask grounded questions about their record</p>
          </div>
        ) : (
          <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', display: 'flex', flexDirection: 'column', minHeight: '500px' }}>
            <div style={{ padding: '14px 18px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>{selected.name}</div>
                <div style={{ fontSize: '10.5px', color: TEXT_SUB }}>{selected.id} · {diagnoses.length} diagnoses · {medications.length} medications</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button onClick={() => { setMessages([]); setSessionId(null); setShowHistory(false) }} title="New chat"
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 10px', borderRadius: '7px', border: `1px solid ${BORDER}`, background: 'transparent', color: TEXT_SUB, fontSize: '11px', cursor: 'pointer' }}>
                  <Plus size={12} /> New
                </button>
                <button onClick={() => setShowHistory(v => !v)} title="Chat history"
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 10px', borderRadius: '7px', border: `1px solid ${showHistory ? COLOR + '60' : BORDER}`, background: showHistory ? `${COLOR}18` : 'transparent', color: showHistory ? COLOR : TEXT_SUB, fontSize: '11px', fontWeight: showHistory ? 600 : 400, cursor: 'pointer' }}>
                  <History size={12} /> History
                </button>
              </div>
            </div>

            {showHistory && (
              <div style={{ borderBottom: `1px solid ${BORDER}`, maxHeight: '220px', overflowY: 'auto', background: '#070B14' }}>
                {sessions.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: TEXT_SUB, fontSize: '12px' }}>No saved conversations about {selected.name} yet.</div>
                ) : sessions.map(s => (
                  <div key={s.id} style={{ padding: '9px 16px', borderBottom: `1px solid ${BORDER}60`, display: 'flex', alignItems: 'center', gap: '10px', background: sessionId === s.id ? `${COLOR}10` : 'transparent' }}>
                    {editingSessionId === s.id ? (
                      <>
                        <input autoFocus value={editTitle} onChange={e => setEditTitle(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') saveRename(s.id); if (e.key === 'Escape') setEditingSessionId(null) }}
                          style={{ flex: 1, background: '#0A0F1E', border: `1px solid ${BORDER}`, borderRadius: '5px', color: '#fff', fontSize: '12px', padding: '4px 8px' }} />
                        <button onClick={() => saveRename(s.id)} style={{ background: 'transparent', border: 'none', color: '#22C55E', cursor: 'pointer', display: 'flex' }}><Check size={13} /></button>
                        <button onClick={() => setEditingSessionId(null)} style={{ background: 'transparent', border: 'none', color: TEXT_SUB, cursor: 'pointer', display: 'flex' }}><X size={13} /></button>
                      </>
                    ) : (
                      <>
                        <div onClick={() => loadSession(s.id)} style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}>
                          <div style={{ fontSize: '12px', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title || 'Untitled conversation'}</div>
                          <div style={{ fontSize: '10px', color: TEXT_SUB }}>{new Date(s.updated_at).toLocaleString()}</div>
                        </div>
                        <button onClick={() => startRename(s.id, s.title)} title="Rename" style={{ background: 'transparent', border: 'none', color: TEXT_SUB, cursor: 'pointer', display: 'flex' }}><Pencil size={12} /></button>
                        <button onClick={() => removeSession(s.id)} title="Delete" style={{ background: 'transparent', border: 'none', color: TEXT_SUB, cursor: 'pointer', display: 'flex' }}><Trash2 size={12} /></button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {messages.length === 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontSize: '11px', color: TEXT_SUB }}>Try asking:</span>
                  {SUGGESTED_QUESTIONS.map(q => (
                    <button key={q} onClick={() => ask(q)}
                      style={{ textAlign: 'left', padding: '8px 12px', borderRadius: '8px', border: `1px solid ${BORDER}`, background: '#0A0F1E', color: '#C9D1D9', fontSize: '12px', cursor: 'pointer' }}>
                      {q}
                    </button>
                  ))}
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', flexDirection: m.role === 'user' ? 'row-reverse' : 'row' }}>
                  <div style={{ width: '26px', height: '26px', borderRadius: '7px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: m.role === 'user' ? '#8B5CF614' : m.role === 'error' ? '#EF444414' : `${COLOR}14`, border: `1px solid ${m.role === 'user' ? '#8B5CF628' : m.role === 'error' ? '#EF444428' : `${COLOR}28`}` }}>
                    {m.role === 'user' ? <User size={13} color="#8B5CF6" /> : <Bot size={13} color={m.role === 'error' ? '#EF4444' : COLOR} />}
                  </div>
                  <div style={{ maxWidth: '75%', padding: '9px 13px', borderRadius: '10px', fontSize: '12.5px', lineHeight: 1.6, color: m.role === 'error' ? '#F59E0B' : '#E5E7EB', background: m.role === 'user' ? '#8B5CF612' : m.role === 'error' ? '#EF444412' : '#0A0F1E', border: `1px solid ${m.role === 'user' ? '#8B5CF624' : m.role === 'error' ? '#EF444424' : BORDER}` }}>
                    {m.text}
                  </div>
                </div>
              ))}
              {asking && <div style={{ fontSize: '12px', color: COLOR, paddingLeft: '34px' }}>Thinking…</div>}
            </div>

            <div style={{ padding: '14px 18px', borderTop: `1px solid ${BORDER}`, display: 'flex', gap: '8px' }}>
              <input value={question} onChange={e => setQuestion(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') ask(question) }}
                placeholder={`Ask about ${selected.name}…`}
                style={{ flex: 1, background: '#0A0F1E', border: `1px solid ${BORDER}`, borderRadius: '8px', color: '#E5E7EB', fontSize: '12.5px', padding: '10px 12px', outline: 'none' }} />
              <button onClick={() => ask(question)} disabled={!question.trim() || asking}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '38px', borderRadius: '8px', border: `1px solid ${COLOR}40`, background: `${COLOR}18`, color: COLOR, cursor: !question.trim() || asking ? 'not-allowed' : 'pointer' }}>
                <Send size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
