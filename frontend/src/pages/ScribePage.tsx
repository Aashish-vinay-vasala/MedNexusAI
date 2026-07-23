import { useState, useRef, useEffect } from 'react'
import { usePatientContext } from '../context/PatientContext'
import { Mic, Square, Upload, Type, Sparkles, Search, FileAudio } from 'lucide-react'
import { useAllPatients, logAudit, createActivity } from '../hooks/useClinicalData'
import { BACKEND_URL } from '../lib/backend'
import type { Patient } from '../types/clinical'

const COLOR = '#EC4899'
const CARD_BG = '#111827'
const BORDER = '#1F2937'
const TEXT_SUB = '#9CA3AF'
const RISK_COLOR: Record<string, string> = { critical: '#EF4444', high: '#F59E0B', medium: '#0EA5E9', low: '#22C55E' }

type InputMode = 'record' | 'upload' | 'paste'

/** Bolds ALL-CAPS section headers, same convention as the other Groq-authored text panels. */
function SoapNoteText({ text }: { text: string }) {
  return (
    <div style={{ fontSize: '12.5px', color: '#C9D1D9', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
      {text.split('\n').map((line, i) => {
        const trimmed = line.trim()
        const isHeader = trimmed.length > 0 && trimmed.length < 40 && trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed)
        return <span key={i}>{isHeader ? <span style={{ color: COLOR, fontWeight: 700 }}>{line}</span> : line}{'\n'}</span>
      })}
    </div>
  )
}

export default function ScribePage() {
  const patients = useAllPatients()
  const { selectedPatient: selected, setSelectedPatient: setSelected } = usePatientContext()
  const [search, setSearch] = useState('')
  const [mode, setMode] = useState<InputMode>('paste')

  const [pastedText, setPastedText] = useState('')
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [micError, setMicError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<{ transcript: string; soap_note: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const filtered = search.trim()
    ? patients.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.id.toLowerCase().includes(search.toLowerCase()))
    : patients

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current) }, [])

  async function startRecording() {
    setMicError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = () => {
        setRecordedBlob(new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' }))
        stream.getTracks().forEach(t => t.stop())
      }
      recorder.start()
      mediaRecorderRef.current = recorder
      setRecordedBlob(null)
      setSeconds(0)
      setRecording(true)
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000)
    } catch {
      setMicError('Microphone access denied or unavailable — use Upload or Paste instead.')
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop()
    setRecording(false)
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }

  function selectPatient(p: Patient) {
    setSelected(selected?.id === p.id ? null : p)
  }

  const hasInput = mode === 'paste' ? pastedText.trim().length > 0 : mode === 'upload' ? !!audioFile : !!recordedBlob

  async function generateNote() {
    if (!hasInput || generating) return
    setGenerating(true); setResult(null); setError(null)

    const form = new FormData()
    if (mode === 'paste') {
      form.append('transcript_text', pastedText.trim())
    } else if (mode === 'upload' && audioFile) {
      form.append('file', audioFile, audioFile.name)
    } else if (mode === 'record' && recordedBlob) {
      form.append('file', recordedBlob, 'recording.webm')
    }

    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/assistant/scribe`, { method: 'POST', body: form, signal: AbortSignal.timeout(30000) })
      if (!res.ok) {
        const detail = await res.json().catch(() => null)
        throw new Error(detail?.detail || `Backend error ${res.status}`)
      }
      const data = await res.json()
      setResult(data)

      await createActivity({
        icon_name: 'FileText', color: COLOR,
        label: 'Clinical Note Transcribed',
        detail: `${selected ? selected.name + ' — ' : ''}Ambient scribe note generated`,
        time_ago: 'just now',
      })
      await logAudit({ actor: 'clinician', action: 'create', resource_type: 'scribe_note', resource_id: null, patient_id: selected?.id ?? null, detail: 'Generated SOAP note via Ambient Clinical Scribe' })
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : 'Failed to generate note')
    }
    setGenerating(false)
  }

  return (
    <div style={{ padding: '24px', minHeight: '100%', background: '#0A0F1E' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: `${COLOR}18`, border: `1px solid ${COLOR}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Mic size={20} color={COLOR} />
        </div>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#fff', margin: 0 }}>Ambient Clinical Scribe</h1>
          <p style={{ fontSize: '12px', color: TEXT_SUB, margin: 0 }}>Record, upload, or paste a dictation — get back a structured SOAP note</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '16px' }}>
        <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', overflow: 'hidden', alignSelf: 'start' }}>
          <div style={{ padding: '10px 12px', borderBottom: `1px solid ${BORDER}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', background: '#0A0F1E', border: `1px solid ${BORDER}`, borderRadius: '7px', padding: '6px 10px' }}>
              <Search size={12} color={TEXT_SUB} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search patients… (optional)"
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

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', background: '#0A0F1E', border: `1px solid ${BORDER}`, borderRadius: '8px', padding: '3px' }}>
              {([['record', 'Record', Mic], ['upload', 'Upload', Upload], ['paste', 'Paste', Type]] as [InputMode, string, typeof Mic][]).map(([m, label, Icon]) => (
                <button key={m} onClick={() => setMode(m)}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '7px', borderRadius: '6px', border: 'none', background: mode === m ? `${COLOR}20` : 'transparent', color: mode === m ? COLOR : TEXT_SUB, fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                  <Icon size={13} />{label}
                </button>
              ))}
            </div>

            {mode === 'record' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px', minHeight: '260px' }}>
                <div style={{
                  width: '64px', height: '64px', borderRadius: '50%',
                  background: recording ? '#EF444418' : `${COLOR}14`, border: `2px solid ${recording ? '#EF4444' : COLOR}30`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {recording ? <Square size={22} color="#EF4444" /> : <Mic size={26} color={COLOR} />}
                </div>
                {recording && <div style={{ fontSize: '13px', color: '#EF4444', fontWeight: 700 }}>● {String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}</div>}
                {!recording && recordedBlob && <div style={{ fontSize: '12px', color: '#22C55E' }}>Recording captured — ready to generate</div>}
                {micError && <div style={{ fontSize: '11px', color: '#F59E0B', textAlign: 'center', maxWidth: '220px' }}>{micError}</div>}
                <button onClick={recording ? stopRecording : startRecording}
                  style={{ padding: '9px 20px', borderRadius: '8px', border: `1px solid ${recording ? '#EF4444' : COLOR}40`, background: recording ? '#EF444418' : `${COLOR}18`, color: recording ? '#EF4444' : COLOR, fontSize: '12.5px', fontWeight: 600, cursor: 'pointer' }}>
                  {recording ? 'Stop Recording' : 'Start Recording'}
                </button>
              </div>
            )}

            {mode === 'upload' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px', minHeight: '260px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: `${COLOR}14`, border: `1px solid ${COLOR}28`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FileAudio size={22} color={COLOR} />
                </div>
                <label style={{ padding: '9px 20px', borderRadius: '8px', border: `1px solid ${COLOR}40`, background: `${COLOR}18`, color: COLOR, fontSize: '12.5px', fontWeight: 600, cursor: 'pointer' }}>
                  Choose Audio File
                  <input type="file" accept="audio/*" style={{ display: 'none' }} onChange={e => setAudioFile(e.target.files?.[0] ?? null)} />
                </label>
                {audioFile && <div style={{ fontSize: '12px', color: '#22C55E' }}>{audioFile.name}</div>}
              </div>
            )}

            {mode === 'paste' && (
              <textarea value={pastedText} onChange={e => setPastedText(e.target.value)} rows={11}
                placeholder="Paste a raw dictation or transcript…"
                style={{ width: '100%', background: '#0A0F1E', border: `1px solid ${BORDER}`, borderRadius: '8px', color: '#E5E7EB', fontSize: '13px', padding: '12px', resize: 'none', outline: 'none', boxSizing: 'border-box', lineHeight: 1.7, flex: 1, minHeight: '260px' }} />
            )}

            <button onClick={generateNote} disabled={!hasInput || generating}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px', borderRadius: '8px', border: `1px solid ${COLOR}40`, background: `${COLOR}18`, color: COLOR, fontSize: '13px', fontWeight: 600, cursor: !hasInput || generating ? 'not-allowed' : 'pointer', opacity: !hasInput || generating ? 0.6 : 1 }}>
              <Sparkles size={15} />
              {generating ? 'Generating note…' : 'Generate Note'}
            </button>
          </div>

          <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>Structured SOAP Note</div>

            {!result && !generating && !error && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', minHeight: '300px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: `${COLOR}14`, border: `1px solid ${COLOR}28`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Sparkles size={22} color={COLOR} />
                </div>
                <p style={{ fontSize: '13px', color: TEXT_SUB, margin: 0 }}>Provide a dictation to generate a SOAP note</p>
              </div>
            )}

            {generating && (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px', color: COLOR, fontSize: '13px' }}>
                Transcribing and structuring…
              </div>
            )}

            {error && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', minHeight: '300px', textAlign: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#F59E0B' }}>{error}</span>
                {error.includes('GROQ_API_KEY') && <span style={{ fontSize: '11px', color: TEXT_SUB }}>Set GROQ_API_KEY in backend/.env to enable this module.</span>}
              </div>
            )}

            {result && (
              <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <div style={{ fontSize: '10.5px', fontWeight: 700, color: TEXT_SUB, letterSpacing: '0.06em', marginBottom: '6px' }}>TRANSCRIPT</div>
                  <div style={{ fontSize: '11.5px', color: '#9CA3AF', lineHeight: 1.7, background: '#0A0F1E', border: `1px solid ${BORDER}`, borderRadius: '8px', padding: '10px' }}>{result.transcript}</div>
                </div>
                <SoapNoteText text={result.soap_note} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
