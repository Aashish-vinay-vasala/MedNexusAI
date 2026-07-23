import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { X } from 'lucide-react'
import jsPDF from 'jspdf'
import { getModuleTitle } from '../../lib/moduleTitles'
import { apiGet, apiDelete } from '../../lib/backend'
import { useAssistantContext, type AssistantMessage, type PanelSize } from '../../context/AssistantContext'
import { useAssistantChat, type ChatAttachment } from '../../hooks/useAssistantChat'
import { useSpeechSynthesis } from '../../hooks/useSpeechSynthesis'
import { useDraggablePosition } from '../../hooks/useDraggablePosition'
import AssistantHeader from './AssistantHeader'
import AssistantToolbar from './AssistantToolbar'
import AssistantMessageList from './AssistantMessageList'
import AssistantInputBar from './AssistantInputBar'
import SummarizePageButton from './SummarizePageButton'
import AssistantToggleButton from './AssistantToggleButton'
import './assistant.css'

const COLOR = '#0EA5E9'
const FAB_SIZE = { width: 52, height: 52 }
const BADGE_SIZE = 36
const MARGIN = 16
const PANEL_TRANSITION_MS = 220

const SIZE_PRESETS: Record<PanelSize, { width: number; height: number }> = {
  compact: { width: 320, height: 440 },
  default: { width: 380, height: 600 },
  maximized: { width: 560, height: 820 },
}

const SUGGESTED_QUESTIONS = [
  'What needs my attention right now?',
  'Summarize the current bed and staffing outlook',
  'What can this platform help me do?',
]

type SessionSummary = { id: number; title: string | null; page_context: string | null; updated_at: string }

function derivePageName(pathname: string): string {
  if (pathname === '/') return 'Home'
  if (pathname === '/dashboard' || pathname === '/dashboard/') return 'Overview'
  if (pathname.startsWith('/dashboard/')) return getModuleTitle(pathname.slice('/dashboard/'.length))
  return 'Dashboard'
}

function downloadConversationPDF(messages: AssistantMessage[]) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const now = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  doc.setFillColor(10, 15, 30)
  doc.rect(0, 0, 210, 30, 'F')
  doc.setTextColor(14, 165, 233)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('MedNexusAI', 20, 15)
  doc.setTextColor(200, 210, 225)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('Assistant Conversation', 20, 23)
  doc.setTextColor(100, 115, 140)
  doc.setFontSize(9)
  doc.text(`Generated: ${now}  |  Confidential`, 130, 23)

  let y = 44
  messages.forEach(m => {
    if (y > 268) { doc.addPage(); y = 20 }
    const speaker = m.role === 'user' ? 'YOU' : m.role === 'error' ? 'ERROR' : 'ASSISTANT'
    doc.setTextColor(14, 165, 233)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text(speaker, 20, y)
    y += 5.5
    doc.setTextColor(40, 55, 75)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.splitTextToSize(m.text, 170).forEach((wl: string) => {
      if (y > 272) { doc.addPage(); y = 20 }
      doc.text(wl, 20, y)
      y += 5.5
    })
    y += 4
  })

  doc.setFillColor(245, 247, 250)
  doc.rect(0, 282, 210, 15, 'F')
  doc.setTextColor(120, 130, 150)
  doc.setFontSize(8)
  doc.text('MedNexusAI — Confidential Clinical Document. Not for unauthorized distribution.', 20, 291)
  doc.save('mednexus-assistant-conversation.pdf')
}

export default function GlobalAssistantWidget() {
  const location = useLocation()
  const pageName = derivePageName(location.pathname)

  const {
    open, setOpen, panelSize, setPanelSize, deviceId, sessionId, setSessionId,
    messages, setMessages, asking, setAsking, webSearch, setWebSearch, newChat,
  } = useAssistantContext()

  const speech = useSpeechSynthesis()
  const { ask } = useAssistantChat(setMessages, setAsking, setSessionId)

  const [historyOpen, setHistoryOpen] = useState(false)
  const [usageOpen, setUsageOpen] = useState(false)
  const [sessions, setSessions] = useState<SessionSummary[]>([])

  const rawPanelSize = SIZE_PRESETS[panelSize]
  const panelPixelSize = {
    width: Math.min(rawPanelSize.width, window.innerWidth - MARGIN * 2),
    height: Math.min(rawPanelSize.height, window.innerHeight - MARGIN * 2),
  }
  const currentSize = open ? panelPixelSize : FAB_SIZE
  const { position, dragging, onPointerDown, consumeIfDragged } = useDraggablePosition(currentSize)

  // Delays unmounting the panel body until its fade/scale-out transition finishes, so closing
  // looks like a smooth animation instead of an instant disappearance.
  const [mounted, setMounted] = useState(open)
  const [entered, setEntered] = useState(open)
  useEffect(() => {
    if (open) {
      setMounted(true)
      const raf = requestAnimationFrame(() => requestAnimationFrame(() => setEntered(true)))
      return () => cancelAnimationFrame(raf)
    }
    setEntered(false)
    const t = setTimeout(() => setMounted(false), PANEL_TRANSITION_MS)
    return () => clearTimeout(t)
  }, [open])

  // The panel's own rect must freeze at its last open position/size while it fades out —
  // `position`/`panelPixelSize` immediately switch to the FAB's dimensions the instant `open`
  // flips false (so the badge can start animating home right away), so the panel body reads
  // from this frozen snapshot instead, avoiding a jarring resize mid fade-out.
  const panelRectRef = useRef({ x: position.x, y: position.y, width: panelPixelSize.width, height: panelPixelSize.height })
  useLayoutEffect(() => {
    if (open) panelRectRef.current = { x: position.x, y: position.y, width: panelPixelSize.width, height: panelPixelSize.height }
  }, [open, position.x, position.y, panelPixelSize.width, panelPixelSize.height])

  const badgeSize = open ? BADGE_SIZE : FAB_SIZE.width
  const badgeX = open ? position.x + panelPixelSize.width - badgeSize / 2 - 8 : position.x
  const badgeY = open ? position.y - badgeSize / 2 + 8 : position.y

  const lastSpokenIndexRef = useRef(-1)
  useEffect(() => {
    if (!speech.autoSpeak) return
    const lastIndex = messages.length - 1
    if (lastIndex < 0 || lastIndex === lastSpokenIndexRef.current) return
    const last = messages[lastIndex]
    if (last.role === 'assistant') {
      speech.speak(last.text)
      lastSpokenIndexRef.current = lastIndex
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, speech.autoSpeak])

  function toggleOpen() {
    if (consumeIfDragged()) return
    speech.stop()
    if (open) { setHistoryOpen(false); setUsageOpen(false) }
    setOpen(!open)
  }

  function handleSend(text: string, attachments: ChatAttachment[]) {
    speech.stop()
    ask(text, { deviceId, sessionId, context: { page: pageName }, webSearch, attachments })
  }

  function handleNewChat() {
    speech.stop()
    newChat()
    setHistoryOpen(false)
  }

  async function openHistory() {
    setUsageOpen(false)
    const next = !historyOpen
    setHistoryOpen(next)
    if (next) {
      try {
        const data = await apiGet<{ sessions: SessionSummary[] }>(`/api/v1/assistant/sessions?device_id=${encodeURIComponent(deviceId)}`)
        setSessions(data.sessions)
      } catch { setSessions([]) }
    }
  }

  async function loadSession(id: number) {
    try {
      const data = await apiGet<{ messages: { role: string; content: string; sources?: AssistantMessage['sources'] }[] }>(
        `/api/v1/assistant/sessions/${id}/messages?device_id=${encodeURIComponent(deviceId)}`
      )
      setMessages(data.messages.map(m => ({ role: m.role as AssistantMessage['role'], text: m.content, sources: m.sources })))
      setSessionId(id)
      setHistoryOpen(false)
    } catch { /* keep current thread on failure */ }
  }

  async function deleteSession(id: number, e: React.MouseEvent) {
    e.stopPropagation()
    try {
      await apiDelete(`/api/v1/assistant/sessions/${id}?device_id=${encodeURIComponent(deviceId)}`)
      setSessions(prev => prev.filter(s => s.id !== id))
      if (sessionId === id) newChat()
    } catch { /* leave list as-is on failure */ }
  }

  const rect = panelRectRef.current
  const anchorRight = rect.x + rect.width / 2 > window.innerWidth / 2
  const anchorBottom = rect.y + rect.height / 2 > window.innerHeight / 2
  const transformOrigin = `${anchorBottom ? 'bottom' : 'top'} ${anchorRight ? 'right' : 'left'}`

  return (
    <>
      <AssistantToggleButton
        open={open}
        x={badgeX}
        y={badgeY}
        size={badgeSize}
        dragging={dragging}
        draggable={!open}
        onPointerDown={onPointerDown}
        onClick={toggleOpen}
      />

      {mounted && (
        <div className="mnx-panel" style={{
          position: 'fixed', left: rect.x, top: rect.y, width: rect.width, height: rect.height,
          zIndex: 300, borderRadius: '16px',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          opacity: entered ? 1 : 0,
          transform: entered ? 'scale(1) translateY(0)' : 'scale(0.96) translateY(8px)',
          transformOrigin,
          transition: `opacity ${PANEL_TRANSITION_MS}ms cubic-bezier(.22,1,.36,1), transform ${PANEL_TRANSITION_MS}ms cubic-bezier(.22,1,.36,1)`,
          pointerEvents: entered ? 'auto' : 'none',
          ['--mnx-accent' as string]: COLOR,
        } as React.CSSProperties}>
          <AssistantHeader
            pageName={pageName}
            color={COLOR}
            voices={speech.voices}
            voiceURI={speech.voiceURI}
            onVoiceChange={speech.setVoiceURI}
            autoSpeak={speech.autoSpeak}
            onAutoSpeakToggle={() => speech.setAutoSpeak(!speech.autoSpeak)}
            rate={speech.rate}
            onRateChange={speech.setRate}
            panelSize={panelSize}
            onPanelSizeChange={setPanelSize}
            onDragHandlePointerDown={onPointerDown}
            dragging={dragging}
          />
          <AssistantToolbar
            color={COLOR}
            onNewChat={handleNewChat}
            onHistory={openHistory}
            onUsage={() => { setHistoryOpen(false); setUsageOpen(!usageOpen) }}
            onDownloadPDF={() => downloadConversationPDF(messages)}
            downloadDisabled={messages.length === 0}
          />

          {historyOpen && (
            <div className="mnx-strip" style={{ maxHeight: '160px', overflowY: 'auto', flexShrink: 0 }}>
              {sessions.length === 0 && (
                <div style={{ padding: '12px 16px', fontSize: '11px', color: '#4B5563' }}>No saved conversations yet.</div>
              )}
              {sessions.map(s => (
                <div key={s.id} onClick={() => loadSession(s.id)} className="mnx-history-item" style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
                  padding: '8px 16px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.06)',
                  background: sessionId === s.id ? `${COLOR}10` : 'transparent',
                }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '11.5px', color: '#D1D5DB', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.title || 'Untitled conversation'}
                    </div>
                    <div style={{ fontSize: '9.5px', color: '#4B5563' }}>{s.page_context || 'General'} · {new Date(s.updated_at).toLocaleDateString()}</div>
                  </div>
                  <button onClick={e => deleteSession(s.id, e)} title="Delete" className="mnx-btn"
                    style={{ background: 'none', border: '1px solid transparent', borderRadius: '5px', cursor: 'pointer', color: '#4B5563', display: 'flex', flexShrink: 0, padding: '3px' }}>
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {usageOpen && (
            <div className="mnx-strip" style={{ padding: '12px 16px', flexShrink: 0, fontSize: '11px', color: '#9CA3AF' }}>
              <div>Messages this session: <strong style={{ color: '#E5E7EB' }}>{messages.length}</strong></div>
              <div>Estimated tokens used: <strong style={{ color: '#E5E7EB' }}>~{messages.length * 220}</strong></div>
              <div style={{ marginTop: '4px', fontSize: '10px', color: '#4B5563' }}>Session-local estimate — not an account-wide Groq quota.</div>
            </div>
          )}

          <SummarizePageButton
            pageName={pageName}
            color={COLOR}
            disabled={asking}
            onStart={() => setMessages(prev => [...prev, { role: 'user', text: 'Summarize this page' }])}
            onResult={m => setMessages(prev => [...prev, m])}
          />

          <div style={{ marginTop: '10px', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <AssistantMessageList
              messages={messages}
              asking={asking}
              color={COLOR}
              onSpeak={speech.speak}
              suggestedQuestions={SUGGESTED_QUESTIONS}
              onAsk={q => handleSend(q, [])}
            />
          </div>

          <AssistantInputBar
            color={COLOR}
            disabled={asking}
            webSearch={webSearch}
            onWebSearchToggle={() => setWebSearch(!webSearch)}
            onSend={handleSend}
          />
        </div>
      )}
    </>
  )
}
