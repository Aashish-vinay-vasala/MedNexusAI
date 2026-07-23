import { useState } from 'react'
import { Bot, User, Volume2, Copy, Check } from 'lucide-react'
import type { AssistantMessage } from '../../context/AssistantContext'

type Props = {
  message: AssistantMessage
  color: string
  onSpeak: (text: string) => void
}

export default function AssistantMessageBubble({ message, color, onSpeak }: Props) {
  const [copied, setCopied] = useState(false)
  const isUser = message.role === 'user'
  const isError = message.role === 'error'
  const roleColor = isUser ? '#8B5CF6' : isError ? '#EF4444' : color

  function copy() {
    navigator.clipboard?.writeText(message.text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: isUser ? 'flex-end' : 'flex-start' }}>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', flexDirection: isUser ? 'row-reverse' : 'row', maxWidth: '100%' }}>
        <div style={{
          width: '24px', height: '24px', borderRadius: '7px', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: `${roleColor}14`, border: `1px solid ${roleColor}28`,
        }}>
          {isUser ? <User size={12} color={roleColor} /> : <Bot size={12} color={roleColor} />}
        </div>
        <div style={{
          maxWidth: '250px', padding: '8px 12px', borderRadius: '10px', fontSize: '12px', lineHeight: 1.6,
          color: isError ? '#F59E0B' : '#E5E7EB',
          background: isUser ? '#8B5CF61A' : isError ? '#EF44441A' : 'rgba(255,255,255,0.04)',
          backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
          border: `1px solid ${isUser ? '#8B5CF62E' : isError ? '#EF44442E' : 'rgba(255,255,255,0.08)'}`,
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}>
          {message.text}
        </div>
      </div>

      {message.sources && message.sources.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginLeft: '32px', maxWidth: '250px' }}>
          <span style={{ fontSize: '9.5px', color: '#4B5563', fontWeight: 700, letterSpacing: '0.05em' }}>SOURCES</span>
          {message.sources.map((s, i) => (
            <a key={i} href={s.url} target="_blank" rel="noreferrer" className="mnx-btn mnx-chip" style={{
              display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10.5px', color: '#9CA3AF',
              textDecoration: 'none', padding: '4px 6px', borderRadius: '6px',
            }}>
              <img src={s.favicon} alt="" width={12} height={12} style={{ borderRadius: '2px', flexShrink: 0 }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</span>
            </a>
          ))}
        </div>
      )}

      {!isUser && !isError && (
        <div style={{ display: 'flex', gap: '4px', marginLeft: '32px' }}>
          <button onClick={() => onSpeak(message.text)} title="Speak" className="mnx-btn"
            style={{ background: 'none', border: '1px solid transparent', borderRadius: '4px', cursor: 'pointer', color: '#4B5563', padding: '2px', display: 'flex' }}>
            <Volume2 size={12} />
          </button>
          <button onClick={copy} title="Copy" className="mnx-btn"
            style={{ background: 'none', border: '1px solid transparent', borderRadius: '4px', cursor: 'pointer', color: copied ? '#22C55E' : '#4B5563', padding: '2px', display: 'flex' }}>
            {copied ? <Check size={12} /> : <Copy size={12} />}
          </button>
        </div>
      )}
    </div>
  )
}
