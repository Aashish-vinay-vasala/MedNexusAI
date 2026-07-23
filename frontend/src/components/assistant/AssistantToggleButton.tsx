import { Bot, X } from 'lucide-react'

type Props = {
  open: boolean
  x: number
  y: number
  size: number
  dragging?: boolean
  draggable?: boolean
  onPointerDown?: (e: React.PointerEvent) => void
  onClick: () => void
}

/** The single persistent robot/close toggle. Always mounted (never unmounted between states)
 * so its position, size, and icon all animate smoothly between "FAB in a corner of the screen"
 * (closed) and "badge on the corner of the open chat panel" (open), instead of the launcher
 * button and a separate header close icon being two unrelated elements. */
export default function AssistantToggleButton({ open, x, y, size, dragging, draggable, onPointerDown, onClick }: Props) {
  const iconSize = Math.round(size * 0.44)
  return (
    <button
      onPointerDown={draggable ? onPointerDown : undefined}
      onClick={onClick}
      title={open ? 'Close' : 'MedNexusAI Assistant'}
      style={{
        position: 'fixed', left: x, top: y, width: size, height: size, borderRadius: '50%',
        border: '1px solid rgba(255,255,255,0.28)', cursor: draggable ? (dragging ? 'grabbing' : 'grab') : 'pointer',
        background: 'linear-gradient(135deg, rgba(14,165,233,0.45), rgba(139,92,246,0.45))',
        backdropFilter: 'blur(14px) saturate(180%)', WebkitBackdropFilter: 'blur(14px) saturate(180%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', touchAction: 'none',
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.3), ${open ? '0 4px 20px rgba(14,165,233,0.35)' : '0 4px 28px rgba(14,165,233,0.35)'}`,
        zIndex: 320,
        transition: dragging
          ? 'none'
          : 'left 0.28s cubic-bezier(.4,0,.2,1), top 0.28s cubic-bezier(.4,0,.2,1), width 0.28s cubic-bezier(.4,0,.2,1), height 0.28s cubic-bezier(.4,0,.2,1), box-shadow 0.2s ease, transform 0.15s ease',
      }}
      onMouseEnter={e => { if (!dragging) e.currentTarget.style.transform = 'scale(1.06)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
    >
      <span style={{ position: 'relative', width: iconSize, height: iconSize, display: 'block' }}>
        <Bot size={iconSize} color="white" style={{
          position: 'absolute', inset: 0,
          opacity: open ? 0 : 1, transform: open ? 'rotate(-60deg) scale(0.6)' : 'rotate(0deg) scale(1)',
          transition: 'opacity 0.2s ease, transform 0.2s ease',
        }} />
        <X size={iconSize} color="white" style={{
          position: 'absolute', inset: 0,
          opacity: open ? 1 : 0, transform: open ? 'rotate(0deg) scale(1)' : 'rotate(60deg) scale(0.6)',
          transition: 'opacity 0.2s ease, transform 0.2s ease',
        }} />
      </span>
    </button>
  )
}
