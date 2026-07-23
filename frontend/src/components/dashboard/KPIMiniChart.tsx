import type { CSSProperties } from 'react'
import {
  AreaChart, Area, BarChart, Bar, Cell,
  ResponsiveContainer, Tooltip,
} from 'recharts'

export type KPIChartVariant = 'bars' | 'donut' | 'gauge' | 'sparkline'

interface KPIMiniChartProps {
  variant: KPIChartVariant
  /** bars/sparkline: one value per mark. donut: values summed to a whole. gauge: a single 0-100 value. */
  values: number[]
  /** one color per value (bars/donut), [fill, track] (gauge), or [line color] (sparkline). */
  colors: string[]
  /** one label per value, shown alongside its number in the tooltip or legend. */
  labels: string[]
  /** appended after the number, e.g. ' patients', '%'. */
  unit?: string
  height?: number
}

const TOOLTIP_STYLE: CSSProperties = {
  background: '#111827', border: '1px solid #1F2937', borderRadius: '6px',
  padding: '6px 9px', fontSize: '10.5px', boxShadow: '0 4px 12px rgba(0,0,0,0.35)',
}

function MiniTooltip({ active, payload, unit }: { active?: boolean; payload?: { value: number; payload: { name: string } }[]; unit?: string }) {
  if (!active || !payload?.length) return null
  const p = payload[0]
  return (
    <div style={TOOLTIP_STYLE}>
      <span style={{ color: '#9CA3AF', marginRight: '5px' }}>{p.payload.name}</span>
      <span style={{ color: '#E5E7EB', fontWeight: 700 }}>{p.value}{unit}</span>
    </div>
  )
}

export default function KPIMiniChart({ variant, values, colors, labels, unit = '', height = 52 }: KPIMiniChartProps) {
  if (variant === 'bars') {
    const data = values.map((v, i) => ({ name: labels[i] ?? '', value: v }))
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 2, right: 2, bottom: 0, left: 2 }} barCategoryGap="26%">
          <Tooltip content={<MiniTooltip unit={unit} />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          <Bar dataKey="value" radius={[3, 3, 0, 0]}>
            {data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    )
  }

  if (variant === 'sparkline') {
    const color = colors[0]
    const gradId = `kpi-spark-${color.replace('#', '')}`
    const data = values.map((v, i) => ({ name: labels[i] ?? '', value: v }))
    return (
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 2, right: 2, bottom: 0, left: 2 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Tooltip content={<MiniTooltip unit={unit} />} />
          <Area
            type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill={`url(#${gradId})`}
            dot={false} activeDot={{ r: 3, fill: color, stroke: '#111827', strokeWidth: 1 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    )
  }

  if (variant === 'donut') {
    // Part-to-whole across a small, fixed set of categories reads faster as a segmented
    // proportion bar with direct labels than as a pie/donut — same info, no arc-angle guessing.
    const total = values.reduce((a, b) => a + b, 0) || 1
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height, gap: '8px' }}>
        <div style={{ display: 'flex', height: '10px', borderRadius: '5px', overflow: 'hidden', background: '#1F2937', gap: '2px' }}>
          {values.map((v, i) => {
            const pct = (v / total) * 100
            if (pct <= 0) return null
            return <div key={i} style={{ width: `${pct}%`, background: colors[i % colors.length] }} />
          })}
        </div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {labels.map((l, i) => (
            <div key={l} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '2px', background: colors[i % colors.length], display: 'inline-block', flexShrink: 0 }} />
              <span style={{ fontSize: '9.5px', color: '#9CA3AF' }}>{l} <span style={{ color: '#D1D5DB', fontWeight: 600 }}>{values[i]}</span></span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // gauge — a single 0-100 value against a track, with the number direct-labeled below it.
  const pct = Math.max(0, Math.min(100, values[0] ?? 0))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height, gap: '8px' }}>
      <div style={{ height: '10px', borderRadius: '5px', overflow: 'hidden', background: colors[1] }}>
        <div style={{ width: `${pct}%`, height: '100%', background: colors[0], borderRadius: '5px', transition: 'width 0.3s' }} />
      </div>
      <div style={{ fontSize: '9.5px', color: '#9CA3AF' }}>
        {labels[0]} <span style={{ color: '#D1D5DB', fontWeight: 600 }}>{Math.round(pct)}{unit}</span>
      </div>
    </div>
  )
}
