import { useNavigate, useParams } from 'react-router-dom'
import { Activity, Home } from 'lucide-react'
import { moduleGroups as groups } from '../../lib/moduleTitles'

const totalModules = groups.reduce((sum, g) => sum + g.items.length, 0)

export default function DashboardSidebar() {
  const navigate = useNavigate()
  const { moduleId } = useParams()
  const active = moduleId ?? 'overview'

  return (
    <aside style={{
      width: '248px',
      minWidth: '248px',
      height: '100vh',
      background: 'rgba(8,12,24,0.95)',
      borderRight: '1px solid rgba(255,255,255,0.06)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Logo */}
      <div style={{
        padding: '20px 20px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0,
            background: 'linear-gradient(135deg, #0EA5E9, #14B8A6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Activity size={16} color="white" />
          </div>
          <span style={{ fontWeight: 700, fontSize: '15px', color: '#fff' }}>
            Med<span style={{ color: '#0EA5E9' }}>Nexus</span>AI
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '12px 10px' }}>
        {/* Overview */}
        <button
          onClick={() => navigate('/dashboard')}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
            padding: '9px 10px', borderRadius: '8px', border: 'none', cursor: 'pointer',
            marginBottom: '8px', textAlign: 'left',
            background: active === 'overview' ? 'rgba(14,165,233,0.12)' : 'transparent',
            color: active === 'overview' ? '#0EA5E9' : '#6B7280',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => { if (active !== 'overview') e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
          onMouseLeave={e => { if (active !== 'overview') e.currentTarget.style.background = 'transparent' }}
        >
          <Home size={15} />
          <span style={{ fontSize: '13px', fontWeight: 500 }}>Overview</span>
        </button>

        {/* Groups */}
        {groups.map(group => (
          <div key={group.label} style={{ marginBottom: '4px' }}>
            <div style={{
              fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em',
              color: '#374151', padding: '10px 10px 5px', userSelect: 'none',
            }}>
              {group.label}
            </div>
            {group.items.map(item => {
              const Icon = item.icon
              const isActive = active === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => navigate(`/dashboard/${item.id}`)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '8px 10px', borderRadius: '7px', border: 'none', cursor: 'pointer',
                    textAlign: 'left', marginBottom: '1px',
                    background: isActive ? `${item.color}14` : 'transparent',
                    color: isActive ? item.color : '#6B7280',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#9CA3AF' } }}
                  onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#6B7280' } }}
                >
                  <Icon size={14} />
                  <span style={{ fontSize: '12.5px', fontWeight: 500 }}>{item.title}</span>
                  {isActive && (
                    <div style={{
                      marginLeft: 'auto', width: '5px', height: '5px',
                      borderRadius: '50%', background: item.color,
                    }} />
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Bottom status */}
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#22C55E', display: 'inline-block' }} />
          <span style={{ fontSize: '11px', color: '#4B5563' }}>{totalModules} / {totalModules} modules online</span>
        </div>
      </div>
    </aside>
  )
}
