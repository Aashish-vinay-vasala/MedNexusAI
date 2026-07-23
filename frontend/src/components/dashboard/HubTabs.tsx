import type { LucideIcon } from 'lucide-react'

export interface HubTab {
  key: string
  label: string
  icon: LucideIcon
  color: string
}

interface HubTabsProps {
  tabs: HubTab[]
  active: string
  onChange: (key: string) => void
}

export default function HubTabs({ tabs, active, onChange }: HubTabsProps) {
  return (
    <div style={{
      display: 'flex', gap: '6px', padding: '12px 24px',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      background: 'rgba(8,12,24,0.6)', flexShrink: 0,
    }}>
      {tabs.map(tab => {
        const Icon = tab.icon
        const isActive = active === tab.key
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: '7px',
              padding: '8px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer',
              background: isActive ? `${tab.color}16` : 'transparent',
              color: isActive ? tab.color : '#6B7280',
              fontSize: '12.5px', fontWeight: 600, transition: 'all 0.15s',
            }}
            onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = '#9CA3AF' }}
            onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = '#6B7280' }}
          >
            <Icon size={14} />
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
