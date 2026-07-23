import { Search } from 'lucide-react'
import type { Patient } from '../../types/clinical'

const CARD_BG = '#111827'
const BORDER = '#1F2937'
const TEXT_SUB = '#9CA3AF'
const RISK_COLOR: Record<string, string> = { critical: '#EF4444', high: '#F59E0B', medium: '#0EA5E9', low: '#22C55E' }

/** Shared patient search/select column reused by all 4 run tabs (Analyze Note, Note
 * Summary, Report Summary, Discharge Letter). */
export default function PatientListColumn({ patients, search, setSearch, selected, onSelect, color, children }: {
  patients: Patient[]; search: string; setSearch: (v: string) => void
  selected: Patient | null; onSelect: (p: Patient) => void; color: string; children?: React.ReactNode
}) {
  const filtered = search.trim()
    ? patients.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.id.toLowerCase().includes(search.toLowerCase()))
    : patients
  return (
    <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', overflow: 'hidden', alignSelf: 'start' }}>
      <div style={{ padding: '10px 12px', borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', background: '#0A0F1E', border: `1px solid ${BORDER}`, borderRadius: '7px', padding: '6px 10px' }}>
          <Search size={12} color={TEXT_SUB} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search patients…"
            style={{ background: 'none', border: 'none', outline: 'none', color: '#fff', fontSize: '12px', flex: 1 }} />
        </div>
      </div>
      <div style={{ maxHeight: '460px', overflowY: 'auto' }}>
        {filtered.map(p => {
          const sel = selected?.id === p.id
          const rc = RISK_COLOR[p.risk] ?? color
          return (
            <div key={p.id} onClick={() => onSelect(p)}
              style={{ padding: '10px 12px', borderBottom: `1px solid ${BORDER}60`, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', background: sel ? `${color}10` : 'transparent', borderLeft: sel ? `3px solid ${color}` : '3px solid transparent' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: `${rc}14`, border: `1px solid ${rc}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: '9px', fontWeight: 700, color: rc }}>{p.risk[0].toUpperCase()}</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                <div style={{ fontSize: '10px', color: TEXT_SUB }}>{p.id}</div>
              </div>
            </div>
          )
        })}
      </div>
      {children}
    </div>
  )
}

export function EmptyState({ color, icon: Icon, title, subtitle }: { color: string; icon: React.ComponentType<{ size?: number; color?: string }>; title: string; subtitle: string }) {
  return (
    <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px', flexDirection: 'column', gap: '10px' }}>
      <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: `${color}14`, border: `1px solid ${color}28`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={22} color={color} />
      </div>
      <p style={{ fontSize: '14px', color: '#fff', margin: 0, fontWeight: 500 }}>{title}</p>
      <p style={{ fontSize: '13px', color: TEXT_SUB, margin: 0 }}>{subtitle}</p>
    </div>
  )
}
