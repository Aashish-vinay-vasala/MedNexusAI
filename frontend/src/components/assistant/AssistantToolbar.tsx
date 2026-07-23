import { Plus, History, Gauge, Download, type LucideIcon } from 'lucide-react'

type Props = {
  color: string
  onNewChat: () => void
  onHistory: () => void
  onUsage: () => void
  onDownloadPDF: () => void
  downloadDisabled?: boolean
}

export default function AssistantToolbar({ color, onNewChat, onHistory, onUsage, onDownloadPDF, downloadDisabled }: Props) {
  const items = ([
    ['New Chat', Plus, onNewChat, false],
    ['History', History, onHistory, false],
    ['Usage', Gauge, onUsage, false],
    ['PDF', Download, onDownloadPDF, !!downloadDisabled],
  ] as [string, LucideIcon, () => void, boolean][])

  return (
    <div className="mnx-strip" style={{ display: 'flex', gap: '6px', padding: '8px 16px', flexShrink: 0, ['--mnx-accent' as string]: color } as React.CSSProperties}>
      {items.map(([label, Icon, onClick, disabled]) => (
        <button key={label} onClick={onClick} disabled={disabled} className="mnx-btn mnx-chip" style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
          padding: '6px 4px', borderRadius: '7px',
          color: disabled ? '#374151' : '#9CA3AF', fontSize: '10px', fontWeight: 600,
          cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1,
        }}>
          <Icon size={11} color={disabled ? '#374151' : color} />
          {label}
        </button>
      ))}
    </div>
  )
}
