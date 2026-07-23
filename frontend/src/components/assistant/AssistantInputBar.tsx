import { useRef, useState } from 'react'
import { Image, FileAudio, FileText, Search, Mic, Square, Send, X, type LucideIcon } from 'lucide-react'
import { BACKEND_URL } from '../../lib/backend'
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder'
import type { ChatAttachment } from '../../hooks/useAssistantChat'

type Props = {
  color: string
  disabled: boolean
  webSearch: boolean
  onWebSearchToggle: () => void
  onSend: (text: string, attachments: ChatAttachment[]) => void
}

type PendingAttachment = {
  id: string
  kind: ChatAttachment['kind']
  label: string
  status: 'processing' | 'done' | 'error'
  extractedText?: string
  error?: string
}

const UPLOAD_ENDPOINT: Record<ChatAttachment['kind'], string> = {
  image: '/api/v1/assistant/analyze-image',
  audio: '/api/v1/assistant/transcribe',
  document: '/api/v1/assistant/parse-document',
}

export default function AssistantInputBar({ color, disabled, webSearch, onWebSearchToggle, onSend }: Props) {
  const [text, setText] = useState('')
  const [pending, setPending] = useState<PendingAttachment[]>([])
  const imageInputRef = useRef<HTMLInputElement>(null)
  const audioInputRef = useRef<HTMLInputElement>(null)
  const docInputRef = useRef<HTMLInputElement>(null)

  const recorder = useVoiceRecorder(transcript => setText(prev => (prev ? prev + ' ' : '') + transcript))

  async function processFile(file: File, kind: ChatAttachment['kind']) {
    const id = crypto.randomUUID()
    setPending(prev => [...prev, { id, kind, label: file.name, status: 'processing' }])
    const form = new FormData()
    form.append('file', file, file.name)
    try {
      const res = await fetch(`${BACKEND_URL}${UPLOAD_ENDPOINT[kind]}`, {
        method: 'POST', body: form, signal: AbortSignal.timeout(45000),
      })
      if (!res.ok) {
        const detail = await res.json().catch(() => null)
        throw new Error(detail?.detail || `Failed (${res.status})`)
      }
      const data = await res.json()
      const extracted: string = data.description ?? data.transcript ?? data.extracted_text ?? ''
      setPending(prev => prev.map(p => p.id === id ? { ...p, status: 'done', extractedText: extracted } : p))
    } catch (exc) {
      setPending(prev => prev.map(p => p.id === id ? { ...p, status: 'error', error: exc instanceof Error ? exc.message : 'Failed' } : p))
    }
  }

  function removePending(id: string) {
    setPending(prev => prev.filter(p => p.id !== id))
  }

  function handleSend() {
    if (disabled) return
    const ready = pending.filter(p => p.status === 'done')
    if (!text.trim() && ready.length === 0) return
    const attachments: ChatAttachment[] = ready.map(p => ({ kind: p.kind, label: p.label, extracted_text: p.extractedText || '' }))
    onSend(text, attachments)
    setText('')
    setPending([])
  }

  const busy = pending.some(p => p.status === 'processing')
  const canSend = !disabled && !busy && (text.trim().length > 0 || pending.some(p => p.status === 'done'))

  const uploadButtons = ([
    ['image', 'Upload image', Image, () => imageInputRef.current?.click()],
    ['audio', 'Upload audio', FileAudio, () => audioInputRef.current?.click()],
    ['document', 'Upload document', FileText, () => docInputRef.current?.click()],
  ] as [string, string, LucideIcon, () => void][])

  return (
    <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: '10px 12px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '8px', ['--mnx-accent' as string]: color } as React.CSSProperties}>
      {pending.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {pending.map(p => (
            <div key={p.id} className="mnx-chip" style={{
              display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 8px', borderRadius: '6px',
              borderColor: p.status === 'error' ? '#EF444440' : undefined,
              fontSize: '10.5px', color: p.status === 'error' ? '#F59E0B' : '#9CA3AF',
            }}>
              <span style={{ maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.label}</span>
              {p.status === 'processing' && <span style={{ color }}>…</span>}
              <button onClick={() => removePending(p.id)} title={p.error || 'Remove'} className="mnx-btn"
                style={{ background: 'none', border: '1px solid transparent', borderRadius: '4px', cursor: 'pointer', color: 'inherit', display: 'flex', padding: 0 }}>
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      {recorder.error && <div style={{ fontSize: '10px', color: '#F59E0B' }}>{recorder.error}</div>}

      <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
        <input ref={imageInputRef} type="file" accept="image/*" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f, 'image'); e.target.value = '' }} />
        <input ref={audioInputRef} type="file" accept="audio/*" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f, 'audio'); e.target.value = '' }} />
        <input ref={docInputRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f, 'document'); e.target.value = '' }} />

        {uploadButtons.map(([key, title, Icon, onClick]) => (
          <button key={key} title={title} onClick={onClick} className="mnx-btn mnx-btn-accent" style={{
            width: '25px', height: '25px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'transparent', border: '1px solid transparent', borderRadius: '6px', cursor: 'pointer', color: '#4B5563', flexShrink: 0,
          }}>
            <Icon size={13} />
          </button>
        ))}

        <button title="Toggle web search" onClick={onWebSearchToggle} className="mnx-btn mnx-btn-accent" style={{
          width: '25px', height: '25px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          background: webSearch ? `${color}18` : 'transparent', border: webSearch ? `1px solid ${color}40` : '1px solid transparent',
          borderRadius: '6px', cursor: 'pointer', color: webSearch ? color : '#4B5563',
        }}>
          <Search size={13} />
        </button>

        <button title={recorder.recording ? 'Stop recording' : 'Speak to AI'} className="mnx-btn"
          onClick={recorder.recording ? recorder.stop : recorder.start} style={{
            width: '25px', height: '25px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            background: recorder.recording ? '#EF444418' : 'transparent', border: recorder.recording ? '1px solid #EF444440' : '1px solid transparent',
            borderRadius: '6px', cursor: 'pointer', color: recorder.recording ? '#EF4444' : '#4B5563',
          }}>
          {recorder.recording ? <Square size={12} /> : <Mic size={13} />}
        </button>

        <input value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
          placeholder={recorder.transcribing ? 'Transcribing…' : 'Ask MedNexusAI Assistant…'}
          disabled={recorder.transcribing}
          className="mnx-input mnx-chip"
          style={{
            flex: 1, minWidth: 0, borderRadius: '8px',
            color: '#E5E7EB', fontSize: '12px', padding: '8px 10px', outline: 'none', marginLeft: '4px',
          }} />

        <button onClick={handleSend} disabled={!canSend} className="mnx-btn mnx-send-btn" style={{
          width: '30px', height: '30px', flexShrink: 0, marginLeft: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: '8px', border: `1px solid ${color}40`, background: `${color}18`, color,
          cursor: canSend ? 'pointer' : 'not-allowed', opacity: canSend ? 1 : 0.5,
        }}>
          <Send size={13} />
        </button>
      </div>
    </div>
  )
}
