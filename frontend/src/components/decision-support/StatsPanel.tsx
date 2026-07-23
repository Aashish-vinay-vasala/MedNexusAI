import { Layers, CalendarDays, AlertTriangle, Pill } from 'lucide-react'
import { useDecisionSupportStats } from '../../hooks/useDecisionSupportData'
import KPIMiniChart from '../dashboard/KPIMiniChart'
import { CARD_BG, BORDER, TEXT_SUB, MODE_LABEL, SEVERITY_COLOR } from './shared'

const MODE_PALETTE = ['#F59E0B', '#8B5CF6']
const COLOR = '#F59E0B'

function StatCard({ icon: Icon, title, children }: { icon: React.ComponentType<{ size?: number; color?: string }>; title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
        <Icon size={13} color={TEXT_SUB} />
        <span style={{ fontSize: '12px', fontWeight: 600, color: '#fff' }}>{title}</span>
      </div>
      {children}
    </div>
  )
}

export default function StatsPanel({ deviceId, refreshKey }: { deviceId: string; refreshKey: number }) {
  const stats = useDecisionSupportStats(deviceId, refreshKey)
  const empty = <div style={{ fontSize: '11px', color: TEXT_SUB, padding: '14px 0' }}>No checks yet</div>

  const severityOrder = ['critical', 'high', 'medium', 'none']
  const severityRows = severityOrder
    .map(s => stats.severity_freq.find(f => f.severity === s) ?? { severity: s, count: 0 })
    .filter(s => s.count > 0)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
      <StatCard icon={Layers} title="By Check Type">
        {stats.by_mode.length === 0 ? empty : (
          <KPIMiniChart variant="bars" values={stats.by_mode.map(m => m.count)} labels={stats.by_mode.map(m => MODE_LABEL[m.mode] ?? m.mode)}
            colors={stats.by_mode.map((_, i) => MODE_PALETTE[i % MODE_PALETTE.length])} height={70} />
        )}
      </StatCard>

      <StatCard icon={CalendarDays} title="Last 14 Days">
        {stats.by_day.length === 0 ? empty : (
          <KPIMiniChart variant="sparkline" values={stats.by_day.map(d => d.count)} labels={stats.by_day.map(d => d.date.slice(5))} colors={[COLOR]} height={70} />
        )}
      </StatCard>

      <StatCard icon={AlertTriangle} title="Severity Distribution">
        {severityRows.length === 0 ? empty : (
          <KPIMiniChart variant="donut" values={severityRows.map(s => s.count)} labels={severityRows.map(s => s.severity === 'none' ? 'No interaction' : s.severity[0].toUpperCase() + s.severity.slice(1))}
            colors={severityRows.map(s => SEVERITY_COLOR[s.severity])} height={70} />
        )}
      </StatCard>

      <StatCard icon={Pill} title="Most-Checked Drugs">
        {stats.top_drugs.length === 0 ? empty : (
          <KPIMiniChart variant="bars" values={stats.top_drugs.map(d => d.count)} labels={stats.top_drugs.map(d => d.drug)}
            colors={stats.top_drugs.map(() => '#0EA5E9')} height={70} />
        )}
      </StatCard>
    </div>
  )
}
