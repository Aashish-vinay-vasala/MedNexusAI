/** Renders backend/fallback text, bolding short lines that look like section headers (ALL
 * CAPS, with or without a trailing colon — Groq's live output omits the colon). */
export function ContentText({ text, color }: { text: string; color: string }) {
  return (
    <div style={{ fontSize: '12.5px', color: '#C9D1D9', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
      {text.split('\n').map((line, i) => {
        const trimmed = line.trim()
        const isHeader = trimmed.length > 0 && trimmed.length < 40 && !line.startsWith(' ') && trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed)
        return <span key={i}>{isHeader ? <span style={{ color, fontWeight: 700 }}>{line}</span> : line}{'\n'}</span>
      })}
    </div>
  )
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div style={{ background: '#EF444414', border: '1px solid #EF444428', borderRadius: '10px', padding: '12px 16px', fontSize: '12px', color: '#F59E0B' }}>{message}</div>
  )
}
