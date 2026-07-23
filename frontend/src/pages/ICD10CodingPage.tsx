import { useState, useEffect } from 'react'
import { CheckCircle2, Search, Tag, Users, FileText, Clock, Sparkles, Pencil, Check } from 'lucide-react'
import { useAllPatients, useActivityFeed, addICD10Assignment, updateICD10Assignment, deleteICD10Assignment, createActivity } from '../hooks/useClinicalData'
import { BACKEND_URL } from '../lib/backend'
import type { Patient } from '../types/clinical'

// ─── Constants ────────────────────────────────────────────────────────────────

const COLOR = '#22C55E'
const CARD_BG = '#111827'
const BORDER = '#1F2937'
const TEXT_SUB = '#9CA3AF'

type ICD10Code = { code: string; desc: string; score?: number }

type Assignment = { id: number; patientId: string; patientName: string; code: string; desc: string; confidence: number | null; time: string }

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ICD10CodingPage() {
  const patients = useAllPatients()
  const activityFeed = useActivityFeed()

  const [codeSearch, setCodeSearch] = useState('')
  const [filteredCodes, setFilteredCodes] = useState<ICD10Code[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedCode, setSelectedCode] = useState<ICD10Code | null>(null)
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [patientSearch, setPatientSearch] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editConfidence, setEditConfidence] = useState('')

  // Real search against the offline WHO ICD-10 hierarchy (backend/icd10.py), debounced.
  useEffect(() => {
    if (!codeSearch.trim()) { setFilteredCodes([]); return }
    let cancelled = false
    setSearching(true)
    const timer = setTimeout(() => {
      fetch(`${BACKEND_URL}/api/v1/icd10/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: codeSearch, limit: 15 }),
        signal: AbortSignal.timeout(8000),
      })
        .then(res => res.ok ? res.json() : { results: [] })
        .then(data => {
          if (cancelled) return
          const mapped: ICD10Code[] = (data.results ?? []).map((r: { code: string; description: string; score?: number }) => ({ code: r.code, desc: r.description, score: r.score }))
          setFilteredCodes(mapped)
          setSearching(false)
        })
        .catch(() => { if (!cancelled) setSearching(false) })
    }, 300)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [codeSearch])

  // Auto-suggest codes from a clinical note via the NLP pipeline (backend/icd10.py + nlp.py).
  const [noteText, setNoteText] = useState('')
  const [suggestions, setSuggestions] = useState<{ source_text: string; code: string; description: string }[]>([])
  const [suggesting, setSuggesting] = useState(false)

  const suggestFromNote = async () => {
    if (!noteText.trim() || suggesting) return
    setSuggesting(true)
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/icd10/suggest-from-note`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note_text: noteText }),
        signal: AbortSignal.timeout(10000),
      })
      if (res.ok) { const data = await res.json(); setSuggestions(data.suggestions ?? []) }
    } catch { /* leave suggestions empty */ }
    setSuggesting(false)
  }

  const filteredPatients = patientSearch.trim()
    ? patients.filter(p =>
        p.name.toLowerCase().includes(patientSearch.toLowerCase()) ||
        p.id.toLowerCase().includes(patientSearch.toLowerCase())
      )
    : patients

  const recentICD = activityFeed.filter(a => a.label.toLowerCase().includes('icd'))

  const handleAssign = async () => {
    if (!selectedCode || !selectedPatient) return
    setSubmitting(true)
    const entry = {
      icon_name: 'CheckCircle2',
      color: COLOR,
      label: 'ICD-10 Code Assigned',
      detail: `${selectedCode.code} (${selectedCode.desc}) — Patient ${selectedPatient.id}`,
      time_ago: 'just now',
    }
    await createActivity(entry)
    const created = await addICD10Assignment({
      patient_id: selectedPatient.id,
      code: selectedCode.code,
      description: selectedCode.desc,
      confidence: selectedCode.score ?? null,
    })
    setAssignments(prev => [{
      id: created.id,
      patientId: selectedPatient.id,
      patientName: selectedPatient.name,
      code: selectedCode.code,
      desc: selectedCode.desc,
      confidence: created.confidence,
      time: 'just now',
    }, ...prev])
    setSubmitting(false)
    setSelectedCode(null)
    setSelectedPatient(null)
    setPatientSearch('')
  }

  const removeAssignment = async (id: number) => {
    await deleteICD10Assignment(id)
    setAssignments(prev => prev.filter(a => a.id !== id))
  }

  const startEditConfidence = (a: Assignment) => {
    setEditingId(a.id)
    setEditConfidence(a.confidence != null ? String(a.confidence) : '')
  }

  const saveEditConfidence = async (id: number) => {
    const confidence = editConfidence.trim() ? parseFloat(editConfidence) : null
    const updated = await updateICD10Assignment(id, { confidence })
    setAssignments(prev => prev.map(a => a.id === id ? { ...a, confidence: updated.confidence } : a))
    setEditingId(null)
  }

  const canAssign = selectedCode && selectedPatient

  return (
    <div style={{ padding: '24px', minHeight: '100%', background: '#0A0F1E' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '10px',
            background: `${COLOR}18`, border: `1px solid ${COLOR}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Tag size={20} color={COLOR} />
          </div>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#fff', margin: 0 }}>ICD-10 Coding</h1>
            <p style={{ fontSize: '12px', color: TEXT_SUB, margin: 0 }}>Diagnosis code assignment · Auto-logged to activity feed</p>
          </div>
        </div>
        <span style={{ fontSize: '11px', color: '#22C55E', background: '#22C55E14', padding: '3px 8px', borderRadius: '4px', border: '1px solid #22C55E30' }}>LIVE</span>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
        {([
          { label: 'ICD-10 Codes (WHO)', value: '10,658', icon: FileText, color: COLOR },
          { label: 'Patients on Record', value: patients.length, icon: Users, color: '#0EA5E9' },
          { label: 'Coded This Session', value: assignments.length, icon: CheckCircle2, color: '#22C55E' },
        ] as const).map(card => (
          <div key={card.label} style={{
            background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px',
            padding: '16px', display: 'flex', gap: '12px', alignItems: 'center',
          }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '8px',
              background: `${card.color}14`, border: `1px solid ${card.color}28`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <card.icon size={18} color={card.color} />
            </div>
            <div>
              <div style={{ fontSize: '22px', fontWeight: 700, color: '#fff', lineHeight: 1 }}>{card.value}</div>
              <div style={{ fontSize: '11px', color: TEXT_SUB, marginTop: '2px' }}>{card.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '16px' }}>

        {/* Main: Code assignment */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Code search */}
          <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                flex: 1, display: 'flex', alignItems: 'center', gap: '8px',
                background: '#0A0F1E', border: `1px solid ${BORDER}`, borderRadius: '8px', padding: '7px 10px',
              }}>
                <Search size={14} color={TEXT_SUB} />
                <input
                  value={codeSearch}
                  onChange={e => setCodeSearch(e.target.value)}
                  placeholder="Search ICD-10 codes…"
                  style={{ background: 'none', border: 'none', outline: 'none', color: '#fff', fontSize: '13px', flex: 1 }}
                />
              </div>
              {selectedCode && (
                <span style={{
                  fontSize: '12px', color: COLOR, background: `${COLOR}14`,
                  border: `1px solid ${COLOR}28`, borderRadius: '6px', padding: '4px 10px', fontWeight: 600,
                }}>
                  {selectedCode.code} selected
                </span>
              )}
            </div>
            <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
              {!codeSearch.trim() ? (
                <div style={{ padding: '32px', textAlign: 'center', color: TEXT_SUB, fontSize: '12px' }}>
                  Type to search 10,000+ ICD-10 codes (offline WHO hierarchy)
                </div>
              ) : searching ? (
                <div style={{ padding: '32px', textAlign: 'center', color: TEXT_SUB, fontSize: '12px' }}>Searching…</div>
              ) : filteredCodes.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: TEXT_SUB, fontSize: '12px' }}>No matching codes</div>
              ) : filteredCodes.map(code => {
                const isSelected = selectedCode?.code === code.code
                return (
                  <div
                    key={code.code}
                    onClick={() => setSelectedCode(isSelected ? null : code)}
                    style={{
                      padding: '10px 16px', borderBottom: `1px solid ${BORDER}60`, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: '12px',
                      background: isSelected ? `${COLOR}10` : 'transparent',
                      borderLeft: isSelected ? `3px solid ${COLOR}` : '3px solid transparent',
                    }}
                  >
                    <span style={{
                      fontSize: '12px', fontWeight: 700, color: '#fff', fontFamily: 'monospace',
                      background: '#0A0F1E', padding: '3px 8px', borderRadius: '5px', flexShrink: 0,
                    }}>{code.code}</span>
                    <span style={{ fontSize: '13px', color: '#fff', flex: 1 }}>{code.desc}</span>
                    {isSelected && <CheckCircle2 size={15} color={COLOR} />}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Auto-suggest from clinical note (MedSpaCy CONDITION entities -> ICD-10 lookup) */}
          <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
              <Sparkles size={13} color={COLOR} />
              <h3 style={{ fontSize: '13px', fontWeight: 600, color: '#fff', margin: 0 }}>Auto-Suggest from Clinical Note</h3>
              <span style={{ fontSize: '9px', padding: '1px 6px', borderRadius: '4px', background: `${COLOR}14`, color: COLOR, border: `1px solid ${COLOR}28` }}>NLP + ICD-10</span>
            </div>
            <textarea value={noteText} onChange={e => setNoteText(e.target.value)} rows={2}
              placeholder="Paste a clinical note to auto-suggest codes from its conditions…"
              style={{ width: '100%', background: '#0A0F1E', border: `1px solid ${BORDER}`, borderRadius: '8px', color: '#fff', fontSize: '12px', padding: '10px', resize: 'vertical', outline: 'none', boxSizing: 'border-box', marginBottom: '10px' }} />
            <button onClick={suggestFromNote} disabled={!noteText.trim() || suggesting} style={{
              background: `${COLOR}18`, border: `1px solid ${COLOR}40`, borderRadius: '8px', padding: '7px 14px',
              color: COLOR, fontSize: '12px', fontWeight: 600, cursor: suggesting ? 'wait' : 'pointer', marginBottom: '10px',
            }}>
              {suggesting ? 'Analysing…' : 'Suggest Codes'}
            </button>
            {suggestions.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {suggestions.map(s => (
                  <div key={s.code} onClick={() => setSelectedCode({ code: s.code, desc: s.description })}
                    style={{ padding: '8px 12px', background: '#0A0F1E', border: `1px solid ${BORDER}`, borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#fff', fontFamily: 'monospace' }}>{s.code}</span>
                    <span style={{ fontSize: '12px', color: TEXT_SUB, flex: 1 }}>{s.description}</span>
                    <span style={{ fontSize: '10px', color: '#4B5563' }}>from "{s.source_text}"</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Patient selector */}
          <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                flex: 1, display: 'flex', alignItems: 'center', gap: '8px',
                background: '#0A0F1E', border: `1px solid ${BORDER}`, borderRadius: '8px', padding: '7px 10px',
              }}>
                <Users size={14} color={TEXT_SUB} />
                <input
                  value={patientSearch}
                  onChange={e => setPatientSearch(e.target.value)}
                  placeholder="Select patient…"
                  style={{ background: 'none', border: 'none', outline: 'none', color: '#fff', fontSize: '13px', flex: 1 }}
                />
              </div>
              {selectedPatient && (
                <span style={{
                  fontSize: '12px', color: '#0EA5E9', background: '#0EA5E914',
                  border: '1px solid #0EA5E928', borderRadius: '6px', padding: '4px 10px', fontWeight: 600,
                }}>
                  {selectedPatient.name}
                </span>
              )}
            </div>
            <div style={{ maxHeight: '160px', overflowY: 'auto' }}>
              {filteredPatients.map(p => {
                const isSelected = selectedPatient?.id === p.id
                return (
                  <div
                    key={p.id}
                    onClick={() => setSelectedPatient(isSelected ? null : p)}
                    style={{
                      padding: '9px 16px', borderBottom: `1px solid ${BORDER}60`, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: '10px',
                      background: isSelected ? '#0EA5E910' : 'transparent',
                      borderLeft: isSelected ? '3px solid #0EA5E9' : '3px solid transparent',
                    }}
                  >
                    <span style={{ fontSize: '13px', color: '#fff', flex: 1 }}>{p.name}</span>
                    <span style={{ fontSize: '11px', color: TEXT_SUB }}>{p.id} · {p.ward}</span>
                    {isSelected && <CheckCircle2 size={14} color="#0EA5E9" />}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Assign button */}
          <button
            onClick={handleAssign}
            disabled={!canAssign || submitting}
            style={{
              background: canAssign ? COLOR : '#1F2937', border: 'none', borderRadius: '10px',
              padding: '12px', color: canAssign ? '#000' : TEXT_SUB, fontSize: '14px', fontWeight: 700,
              cursor: canAssign ? 'pointer' : 'not-allowed', transition: 'background 0.2s',
            }}
          >
            {submitting ? 'Assigning…' :
             canAssign ? `Assign ${selectedCode!.code} → ${selectedPatient!.name}` :
             'Select a code and a patient to assign'}
          </button>
        </div>

        {/* Right: Recent assignments */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* This session */}
          {assignments.length > 0 && (
            <div style={{ background: CARD_BG, border: `1px solid ${COLOR}30`, borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{ padding: '14px 16px', borderBottom: `1px solid ${BORDER}` }}>
                <h3 style={{ fontSize: '13px', fontWeight: 600, color: '#fff', margin: 0 }}>This Session</h3>
              </div>
              <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {assignments.map(a => (
                  <div key={a.id} style={{ padding: '10px 16px', borderBottom: `1px solid ${BORDER}60`, display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <CheckCircle2 size={14} color={COLOR} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#fff' }}>{a.code} — {a.patientName}</div>
                      <div style={{ fontSize: '11px', color: TEXT_SUB }}>{a.desc}</div>
                      {editingId === a.id ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                          <input autoFocus value={editConfidence} onChange={e => setEditConfidence(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') saveEditConfidence(a.id); if (e.key === 'Escape') setEditingId(null) }}
                            placeholder="Confidence %" type="number" min="0" max="100"
                            style={{ background: '#0A0F1E', border: `1px solid ${BORDER}`, borderRadius: '5px', color: '#fff', fontSize: '11px', padding: '3px 7px', width: '80px' }} />
                          <button onClick={() => saveEditConfidence(a.id)} title="Save" style={{ background: 'transparent', border: 'none', color: COLOR, cursor: 'pointer', display: 'flex' }}>
                            <Check size={13} />
                          </button>
                        </div>
                      ) : a.confidence != null && (
                        <div style={{ fontSize: '10px', color: TEXT_SUB, marginTop: '4px' }}>Confidence: {a.confidence}%</div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                      <button onClick={() => startEditConfidence(a)} title="Edit confidence" style={{
                        background: 'transparent', border: 'none', color: '#6B7280', cursor: 'pointer', padding: '2px 4px', display: 'flex',
                      }}><Pencil size={12} /></button>
                      <button onClick={() => removeAssignment(a.id)} title="Remove assignment" style={{
                        background: 'transparent', border: 'none', color: '#6B7280', cursor: 'pointer', fontSize: '11px', padding: '2px 4px',
                      }}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent from activity feed */}
          <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', overflow: 'hidden', flex: 1 }}>
            <div style={{ padding: '14px 16px', borderBottom: `1px solid ${BORDER}` }}>
              <h3 style={{ fontSize: '13px', fontWeight: 600, color: '#fff', margin: 0 }}>Recent ICD-10 Activity</h3>
              <p style={{ fontSize: '11px', color: TEXT_SUB, margin: 0 }}>From system activity feed</p>
            </div>
            {recentICD.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: TEXT_SUB, fontSize: '12px' }}>
                No recent ICD-10 activity
              </div>
            ) : (
              <div style={{ maxHeight: '340px', overflowY: 'auto' }}>
                {recentICD.map(item => (
                  <div key={item.id} style={{ padding: '10px 16px', borderBottom: `1px solid ${BORDER}60` }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#fff', marginBottom: '2px' }}>{item.label}</div>
                    <div style={{ fontSize: '11px', color: TEXT_SUB, marginBottom: '2px' }}>{item.detail}</div>
                    <div style={{ fontSize: '10px', color: '#4B5563', display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <Clock size={9} />{item.time_ago}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
