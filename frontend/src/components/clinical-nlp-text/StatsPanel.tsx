import { Layers, CalendarDays, Check, Tag } from 'lucide-react'
import { useClinicalStats } from '../../hooks/useClinicalData'
import KPIMiniChart from '../dashboard/KPIMiniChart'
import { CARD_BG, BORDER, TEXT_SUB, MODE_LABEL, ENTITY_COLORS } from './shared'

const MODE_PALETTE = ['#F59E0B', '#EC4899', '#14B8A6', '#8B5CF6']
const SUCCESS_COLOR = '#22C55E'
const ERROR_COLOR = '#EF4444'
const COLOR = '#0EA5E9'

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
  const stats = useClinicalStats(deviceId, refreshKey)
  const empty = <div style={{ fontSize: '11px', color: TEXT_SUB, padding: '14px 0' }}>No runs yet</div>

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
      <StatCard icon={Layers} title="By Mode">
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

      <StatCard icon={Check} title="Success Rate">
        {stats.success_count + stats.error_count === 0 ? empty : (
          <KPIMiniChart variant="donut" values={[stats.success_count, stats.error_count]} labels={['Success', 'Error']} colors={[SUCCESS_COLOR, ERROR_COLOR]} height={70} />
        )}
      </StatCard>

      <StatCard icon={Tag} title="Entity Types (NLP)">
        {stats.entity_type_freq.length === 0 ? empty : (
          <KPIMiniChart variant="bars" values={stats.entity_type_freq.map(e => e.count)} labels={stats.entity_type_freq.map(e => e.type)}
            colors={stats.entity_type_freq.map(e => ENTITY_COLORS[e.type] ?? COLOR)} height={70} />
        )}
      </StatCard>
    </div>
  )
}
