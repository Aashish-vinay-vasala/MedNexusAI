import { Bot, Volume2, VolumeX, Minus, Square, Maximize2 } from 'lucide-react'
import type { PanelSize } from '../../context/AssistantContext'
import { formatVoiceLabel } from '../../hooks/useSpeechSynthesis'

type Props = {
  pageName: string
  color: string
  voices: SpeechSynthesisVoice[]
  voiceURI: string | null
  onVoiceChange: (uri: string) => void
  autoSpeak: boolean
  onAutoSpeakToggle: () => void
  rate: number
  onRateChange: (r: number) => void
  panelSize: PanelSize
  onPanelSizeChange: (s: PanelSize) => void
  onDragHandlePointerDown?: (e: React.PointerEvent) => void
  dragging?: boolean
}

const SIZE_OPTIONS: { size: PanelSize; icon: typeof Minus; title: string }[] = [
  { size: 'compact', icon: Minus, title: 'Compact' },
  { size: 'default', icon: Square, title: 'Default' },
  { size: 'maximized', icon: Maximize2, title: 'Maximized' },
]

export default function AssistantHeader({
  pageName, color, voices, voiceURI, onVoiceChange, autoSpeak, onAutoSpeakToggle,
  rate, onRateChange, panelSize, onPanelSizeChange, onDragHandlePointerDown, dragging,
}: Props) {
  return (
    <div className="mnx-strip" style={{ padding: '14px 16px 10px', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', gap: '8px' }}>
        <div
          onPointerDown={onDragHandlePointerDown}
          title="Drag to move"
          style={{
            display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1,
            cursor: onDragHandlePointerDown ? (dragging ? 'grabbing' : 'grab') : 'default', touchAction: 'none',
          }}
        >
          <div style={{
            width: '32px', height: '32px', borderRadius: '9px', flexShrink: 0,
            background: 'linear-gradient(135deg, #0EA5E9, #8B5CF6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Bot size={16} color="white" />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>MedNexusAI Assistant</div>
            <div style={{ fontSize: '10px', color: '#4B5563', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pageName}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
          {SIZE_OPTIONS.map(({ size, icon: Icon, title }) => (
            <button key={size} onClick={() => onPanelSizeChange(size)} title={title} className="mnx-btn mnx-btn-accent"
              style={{
                width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: panelSize === size ? `${color}18` : 'transparent', border: '1px solid transparent', borderRadius: '5px',
                cursor: 'pointer', color: panelSize === size ? color : '#4B5563',
              }}>
              <Icon size={11} />
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', ['--mnx-accent' as string]: color } as React.CSSProperties}>
        <select value={voiceURI ?? ''} onChange={e => onVoiceChange(e.target.value)} title="Voice / accent" className="mnx-select mnx-chip"
          style={{
            flex: 1, minWidth: 0, borderRadius: '6px',
            color: '#9CA3AF', fontSize: '10.5px', padding: '4px 6px',
          }}>
          {voices.length === 0 && <option value="">Default voice</option>}
          {voices.map(v => <option key={v.voiceURI} value={v.voiceURI}>{formatVoiceLabel(v)}</option>)}
        </select>
        <button onClick={onAutoSpeakToggle} title={autoSpeak ? 'Auto-speak: on' : 'Auto-speak: off'} className="mnx-btn mnx-btn-accent"
          style={{
            width: '26px', height: '26px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: autoSpeak ? `${color}18` : 'transparent', border: `1px solid ${autoSpeak ? color + '40' : 'rgba(255,255,255,0.08)'}`,
            borderRadius: '6px', cursor: 'pointer', color: autoSpeak ? color : '#4B5563',
          }}>
          {autoSpeak ? <Volume2 size={12} /> : <VolumeX size={12} />}
        </button>
        <input type="range" min={0.5} max={2} step={0.1} value={rate} onChange={e => onRateChange(Number(e.target.value))}
          title={`Speed: ${rate.toFixed(1)}x`} style={{ width: '54px', flexShrink: 0 }} />
      </div>
    </div>
  )
}
