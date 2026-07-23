import { useState, useMemo } from 'react'
import { ShieldCheck, Search } from 'lucide-react'
import { useAuditLog } from '../hooks/useClinicalData'
import type { AuditLogEntry } from '../types/clinical'

const COLOR = '#8B5CF6'
const CARD_BG = '#111827'
const BORDER = '#1F2937'
const TEXT_SUB = '#9CA3AF'
const ACTION_COLOR: Record<AuditLogEntry['action'], string> = { create: '#22C55E', update: '#F59E0B', view: '#0EA5E9' }

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} hr ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function AuditLogPage() {
  const entries = useAuditLog()
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState<'all' | AuditLogEntry['action']>('all')
  const [resourceFilter, setResourceFilter] = useState<string>('all')

  const resourceTypes = useMemo(() => Array.from(new Set(entries.map(e => e.resource_type))), [entries])

  const filtered = entries.filter(e => {
    if (actionFilter !== 'all' && e.action !== actionFilter) return false
    if (resourceFilter !== 'all' && e.resource_type !== resourceFilter) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      if (!(e.patient_id?.toLowerCase().includes(q) || e.detail?.toLowerCase().includes(q) || e.actor.toLowerCase().includes(q))) return false
    }
    return true
  })

  return (
    <div style={{ padding: '24px', minHeight: '100%', background: '#0A0F1E' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: `${COLOR}18`, border: `1px solid ${COLOR}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldCheck size={20} color={COLOR} />
          </div>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#fff', margin: 0 }}>Audit & Compliance Log</h1>
            <p style={{ fontSize: '12px', color: TEXT_SUB, margin: 0 }}>Who did what, when — across EHR, prescriptions, and claims</p>
          </div>
        </div>
        <span style={{ fontSize: '11px', color: '#22C55E', background: '#22C55E14', padding: '3px 8px', borderRadius: '4px', border: '1px solid #22C55E30' }}>LIVE</span>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '8px', padding: '7px 12px', flex: '1 1 240px' }}>
          <Search size={12} color={TEXT_SUB} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search patient ID, actor, or detail…"
            style={{ background: 'none', border: 'none', outline: 'none', color: '#fff', fontSize: '12px', flex: 1 }} />
        </div>
        <select value={actionFilter} onChange={e => setActionFilter(e.target.value as typeof actionFilter)}
          style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '8px', color: '#E5E7EB', fontSize: '12px', padding: '8px 12px' }}>
          <option value="all">All actions</option>
          <option value="create">Create</option>
          <option value="update">Update</option>
          <option value="view">View</option>
        </select>
        <select value={resourceFilter} onChange={e => setResourceFilter(e.target.value)}
          style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '8px', color: '#E5E7EB', fontSize: '12px', padding: '8px 12px' }}>
          <option value="all">All resource types</option>
          {resourceTypes.map(rt => <option key={rt} value={rt}>{rt}</option>)}
        </select>
      </div>

      <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '110px 100px 140px 90px 1fr 80px', padding: '10px 16px', borderBottom: `1px solid ${BORDER}`, fontSize: '10.5px', fontWeight: 700, color: TEXT_SUB, letterSpacing: '0.04em' }}>
          <span>ACTOR</span><span>ACTION</span><span>RESOURCE</span><span>PATIENT</span><span>DETAIL</span><span style={{ textAlign: 'right' }}>WHEN</span>
        </div>
        {filtered.length === 0 ? (
          <div style={{ padding: '30px', textAlign: 'center', color: TEXT_SUB, fontSize: '12px' }}>No matching audit entries.</div>
        ) : (
          filtered.map(e => (
            <div key={e.id} style={{ display: 'grid', gridTemplateColumns: '110px 100px 140px 90px 1fr 80px', padding: '10px 16px', borderBottom: `1px solid ${BORDER}40`, fontSize: '11.5px', alignItems: 'center' }}>
              <span style={{ color: '#D1D5DB', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.actor}</span>
              <span style={{ fontSize: '9.5px', fontWeight: 700, padding: '2px 7px', borderRadius: '4px', background: `${ACTION_COLOR[e.action]}14`, color: ACTION_COLOR[e.action], border: `1px solid ${ACTION_COLOR[e.action]}28`, width: 'fit-content' }}>{e.action.toUpperCase()}</span>
              <span style={{ color: '#9CA3AF', fontFamily: 'monospace', fontSize: '10.5px' }}>{e.resource_type}</span>
              <span style={{ color: '#6B7280', fontFamily: 'monospace', fontSize: '10.5px' }}>{e.patient_id ?? '—'}</span>
              <span style={{ color: '#9CA3AF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.detail ?? '—'}</span>
              <span style={{ color: '#4B5563', fontSize: '10.5px', textAlign: 'right' }}>{timeAgo(e.created_at)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
