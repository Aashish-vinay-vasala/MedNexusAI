import { useState, useEffect } from 'react'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { TrendingUp, Bed, Users, AlertTriangle, Calendar, Sparkles } from 'lucide-react'
import { useForecast, useAdmissions, useBedUsageHistory, saveForecast } from '../hooks/useClinicalData'
import { BACKEND_URL } from '../lib/backend'

// ─── Constants ────────────────────────────────────────────────────────────────

const COLOR = '#14B8A6'
const CARD_BG = '#111827'
const BORDER = '#1F2937'
const TEXT_SUB = '#9CA3AF'

function CustomTooltip({ active, payload, label }: {
  active?: boolean
  payload?: { name: string; value: number; color: string }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#1F2937', border: '1px solid #374151', borderRadius: '8px', padding: '10px 14px' }}>
      <div style={{ fontSize: '12px', color: '#9CA3AF', marginBottom: '6px' }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ fontSize: '13px', color: p.color, fontWeight: 600 }}>
          {p.name}: {p.value}%
        </div>
      ))}
    </div>
  )
}

function AdmissionsTooltip({ active, payload, label }: {
  active?: boolean
  payload?: { name: string; value: number; color: string }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#1F2937', border: '1px solid #374151', borderRadius: '8px', padding: '10px 14px' }}>
      <div style={{ fontSize: '12px', color: '#9CA3AF', marginBottom: '6px' }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ fontSize: '13px', color: p.color, fontWeight: 600 }}>
          {p.name}: {p.value}
        </div>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ResourceForecastPage() {
  const forecast = useForecast()
  const admissions = useAdmissions()
  const bedHistory = useBedUsageHistory()
  const [recomputing, setRecomputing] = useState(false)

  async function recomputeForecast() {
    if (bedHistory.length < 4 || recomputing) return
    setRecomputing(true)
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/forecast/beds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ history: bedHistory.map(h => ({ date: h.date, bed_usage: h.bed_usage, staffing: h.staffing })) }),
        signal: AbortSignal.timeout(10000),
      })
      if (res.ok) {
        const data = await res.json()
        await saveForecast(data.forecast)
      }
    } catch { /* backend unavailable — keep existing forecast */ }
    setRecomputing(false)
  }

  useEffect(() => {
    if (bedHistory.length >= 4) recomputeForecast()
  }, [bedHistory.length])

  const peak = forecast.reduce((m, r) => r.bed_usage > m.bed_usage ? r : m, forecast[0] ?? { day_label: 'N/A', bed_usage: 0, staffing: 0, id: 0 })
  const overCapacity = forecast.filter(r => r.bed_usage > 85)
  const avgStaffing = Math.round(forecast.reduce((s, r) => s + r.staffing, 0) / Math.max(forecast.length, 1))
  const tomorrow = forecast[0]

  const kpiCards = [
    { label: 'Peak Bed Usage',     value: `${peak.bed_usage}%`,   sub: peak.day_label,              icon: Bed,         color: peak.bed_usage > 85 ? '#EF4444' : COLOR },
    { label: 'Days Over 85%',      value: overCapacity.length,    sub: 'next 7 days',               icon: AlertTriangle, color: overCapacity.length > 0 ? '#F59E0B' : '#22C55E' },
    { label: 'Avg Staffing',       value: `${avgStaffing}%`,      sub: '7-day average',             icon: Users,       color: COLOR },
    { label: "Tomorrow's Beds",    value: tomorrow ? `${tomorrow.bed_usage}%` : 'N/A', sub: 'D+1 forecast', icon: Calendar, color: '#0EA5E9' },
  ]

  return (
    <div style={{ padding: '24px', minHeight: '100%', background: '#0A0F1E' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '10px',
            background: `${COLOR}18`, border: `1px solid ${COLOR}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <TrendingUp size={20} color={COLOR} />
          </div>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#fff', margin: 0 }}>Resource Forecast</h1>
            <p style={{ fontSize: '12px', color: TEXT_SUB, margin: 0 }}>7-day bed & staffing projections · Holt-Winters exponential smoothing</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: '#22C55E', background: '#22C55E14', padding: '3px 8px', borderRadius: '4px', border: '1px solid #22C55E30' }}>LIVE</span>
          <button onClick={recomputeForecast} disabled={recomputing || bedHistory.length < 4} style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px',
            border: `1px solid ${COLOR}40`, background: `${COLOR}18`, color: COLOR, fontSize: '13px', fontWeight: 600,
            cursor: recomputing ? 'wait' : 'pointer',
          }}>
            <Sparkles size={14} />{recomputing ? 'Recomputing…' : 'Recompute Forecast'}
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
        {kpiCards.map(card => (
          <div key={card.label} style={{
            background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px',
            padding: '16px', display: 'flex', gap: '12px', alignItems: 'center',
          }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '8px',
              background: `${card.color}14`, border: `1px solid ${card.color}28`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <card.icon size={18} color={card.color} />
            </div>
            <div>
              <div style={{ fontSize: '22px', fontWeight: 700, color: '#fff', lineHeight: 1 }}>{card.value}</div>
              <div style={{ fontSize: '11px', color: TEXT_SUB, marginTop: '2px' }}>{card.label}</div>
              <div style={{ fontSize: '10px', color: '#4B5563' }}>{card.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>

        {/* Bed & Staffing Forecast */}
        <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '20px' }}>
          <div style={{ marginBottom: '16px' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#fff', margin: 0 }}>Bed & Staffing Forecast</h2>
            <p style={{ fontSize: '12px', color: TEXT_SUB, margin: 0 }}>Next 7 days (%)</p>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={forecast} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="bedGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLOR} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={COLOR} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="staffGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
              <XAxis dataKey="day_label" tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis domain={[60, 100]} tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '11px', color: '#9CA3AF' }} />
              <Area type="monotone" dataKey="bed_usage" name="Bed Usage" stroke={COLOR} strokeWidth={2} fill="url(#bedGrad)" dot={false} />
              <Area type="monotone" dataKey="staffing" name="Staffing" stroke="#8B5CF6" strokeWidth={2} fill="url(#staffGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Admissions Trend */}
        <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '20px' }}>
          <div style={{ marginBottom: '16px' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#fff', margin: 0 }}>Admissions Trend</h2>
            <p style={{ fontSize: '12px', color: TEXT_SUB, margin: 0 }}>Last 7 days</p>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={admissions} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
              <XAxis dataKey="day_label" tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<AdmissionsTooltip />} />
              <Legend wrapperStyle={{ fontSize: '11px', color: '#9CA3AF' }} />
              <Bar dataKey="admissions" name="Admissions" fill="#0EA5E9" radius={[3, 3, 0, 0]} />
              <Bar dataKey="discharges" name="Discharges" fill="#22C55E" radius={[3, 3, 0, 0]} />
              <Bar dataKey="readmissions" name="Readmissions" fill="#F59E0B" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

      </div>

      {/* 7-day table */}
      <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${BORDER}` }}>
          <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#fff', margin: 0 }}>Forecast Detail</h2>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#0D1117' }}>
                {['Day', 'Bed Usage', 'Bed Status', 'Staffing', 'Staffing Status', 'Action Required'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', color: TEXT_SUB, fontWeight: 600, borderBottom: `1px solid ${BORDER}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {forecast.map((row, i) => {
                const bedCritical = row.bed_usage > 90
                const bedHigh = row.bed_usage > 85
                const staffGap = row.bed_usage - row.staffing
                return (
                  <tr key={row.id} style={{ background: i % 2 === 0 ? 'transparent' : '#0A0F1E1A' }}>
                    <td style={{ padding: '10px 16px', fontSize: '13px', color: '#fff', fontWeight: 600 }}>{row.day_label}</td>
                    <td style={{ padding: '10px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '60px', height: '5px', background: '#1F2937', borderRadius: '2px' }}>
                          <div style={{ width: `${row.bed_usage}%`, height: '100%', borderRadius: '2px', background: bedCritical ? '#EF4444' : bedHigh ? '#F59E0B' : COLOR }} />
                        </div>
                        <span style={{ fontSize: '12px', color: '#fff' }}>{row.bed_usage}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{
                        fontSize: '10px', padding: '2px 7px', borderRadius: '4px', fontWeight: 700,
                        color: bedCritical ? '#EF4444' : bedHigh ? '#F59E0B' : '#22C55E',
                        background: bedCritical ? '#EF444414' : bedHigh ? '#F59E0B14' : '#22C55E14',
                      }}>
                        {bedCritical ? 'CRITICAL' : bedHigh ? 'HIGH' : 'NORMAL'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: '12px', color: '#fff' }}>{row.staffing}%</td>
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{
                        fontSize: '10px', padding: '2px 7px', borderRadius: '4px', fontWeight: 700,
                        color: staffGap > 12 ? '#EF4444' : staffGap > 6 ? '#F59E0B' : '#22C55E',
                        background: staffGap > 12 ? '#EF444414' : staffGap > 6 ? '#F59E0B14' : '#22C55E14',
                      }}>
                        {staffGap > 12 ? 'UNDERSTAFFED' : staffGap > 6 ? 'GAP' : 'ADEQUATE'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: '12px', color: TEXT_SUB }}>
                      {bedCritical ? 'Activate surge protocol' : bedHigh ? 'Review bed allocation' : staffGap > 6 ? 'Request agency staff' : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
