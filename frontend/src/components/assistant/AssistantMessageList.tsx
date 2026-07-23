import { useEffect, useRef } from 'react'
import { Bot } from 'lucide-react'
import type { AssistantMessage } from '../../context/AssistantContext'
import AssistantMessageBubble from './AssistantMessageBubble'

type Props = {
  messages: AssistantMessage[]
  asking: boolean
  color: string
  onSpeak: (text: string) => void
  suggestedQuestions: string[]
  onAsk: (q: string) => void
}

export default function AssistantMessageList({ messages, asking, color, onSpeak, suggestedQuestions, onAsk }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }) }, [messages, asking])

  return (
    <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {messages.length === 0 && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center', textAlign: 'center', paddingTop: '12px' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '10px', background: `${color}14`,
              border: `1px solid ${color}28`, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Bot size={19} color={color} />
            </div>
            <p style={{ fontSize: '12px', color: '#9CA3AF', margin: 0, maxWidth: '220px' }}>
              Ask me anything, or try one of these:
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {suggestedQuestions.map(q => (
              <button key={q} onClick={() => onAsk(q)} className="mnx-btn mnx-chip" style={{
                textAlign: 'left', padding: '8px 12px', borderRadius: '8px',
                color: '#C9D1D9', fontSize: '11.5px', cursor: 'pointer',
                ['--mnx-accent' as string]: color,
              } as React.CSSProperties}>
                {q}
              </button>
            ))}
          </div>
        </>
      )}
      {messages.map((m, i) => (
        <AssistantMessageBubble key={i} message={m} color={color} onSpeak={onSpeak} />
      ))}
      {asking && <div style={{ fontSize: '11.5px', color, paddingLeft: '32px' }}>Thinking…</div>}
    </div>
  )
}
