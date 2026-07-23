import { useState, useEffect } from 'react'
import { Users2, Activity, TrendingUp, Building2 } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useAllPatients, useAllDiagnoses } from '../hooks/useClinicalData'
import { BACKEND_URL } from '../lib/backend'

const COLOR = '#8B5CF6'
const CARD_BG = '#111827'
const BORDER = '#1F2937'
const TEXT_SUB = '#9CA3AF'
const RISK_COLOR: Record<string, string> = { critical: '#EF4444', high: '#F59E0B', medium: '#0EA5E9', low: '#22C55E' }

type Stats = {
  total_patients: number
  avg_age: number
  risk_distribution: Record<string, { count: number; pct: number }>
  age_distribution: { bucket: string; count: number }[]
  ward_critical_counts: { ward: string; count: number }[]
  top_conditions: { condition: string; count: number }[]
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#0D1425', border: `1px solid ${BORDER}`, borderRadius: '8px', padding: '8px 12px', fontSize: '11.5px' }}>
      <div style={{ color: '#9CA3AF', marginBottom: '4px' }}>{label}</div>
      <div style={{ color: '#E5E7EB', fontWeight: 700 }}>{payload[0].value}</div>
    </div>
  )
}

export default function PopulationHealthPage() {
  const patients = useAllPatients()
  const diagnoses = useAllDiagnoses()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`${BACKEND_URL}/api/v1/population/stats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patients, diagnoses }),
      signal: AbortSignal.timeout(10000),
    })
      .then(r => r.json())
      .then(data => { if (!cancelled) setStats(data) })
      .catch(() => { if (!cancelled) setStats(null) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [patients, diagnoses])

  const highRiskPct = stats ? ((stats.risk_distribution.critical?.pct ?? 0) + (stats.risk_distribution.high?.pct ?? 0)) : 0

  return (
    <div style={{ padding: '24px', minHeight: '100%', background: '#0A0F1E' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: `${COLOR}18`, border: `1px solid ${COLOR}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Users2 size={20} color={COLOR} />
        </div>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#fff', margin: 0 }}>Population Health Analytics</h1>
          <p style={{ fontSize: '12px', color: TEXT_SUB, margin: 0 }}>Cohort-level prevalence and risk trends across all patients</p>
        </div>
      </div>

      {loading && !stats ? (
        <div style={{ color: TEXT_SUB, fontSize: '13px', padding: '60px', textAlign: 'center' }}>Computing cohort statistics…</div>
      ) : !stats ? (
        <div style={{ color: '#F59E0B', fontSize: '13px', padding: '60px', textAlign: 'center' }}>Backend unavailable — start the FastAPI server to compute population statistics.</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
            {[
              { label: 'Total Patients', value: stats.total_patients.toLocaleString(), icon: Users2, color: '#0EA5E9' },
              { label: 'Average Age', value: `${stats.avg_age}`, icon: Activity, color: '#14B8A6' },
              { label: '% High-Risk Cohort', value: `${highRiskPct.toFixed(1)}%`, icon: TrendingUp, color: '#EF4444' },
              { label: 'Wards w/ Critical Patients', value: `${stats.ward_critical_counts.length}`, icon: Building2, color: '#F59E0B' },
            ].map(card => {
              const Icon = card.icon
              return (
                <div key={card.label} style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '16px' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: `${card.color}16`, border: `1px solid ${card.color}24`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                    <Icon size={13} color={card.color} />
                  </div>
                  <div style={{ fontSize: '22px', fontWeight: 700, color: '#fff', marginBottom: '3px' }}>{card.value}</div>
                  <div style={{ fontSize: '11px', color: '#6B7280' }}>{card.label}</div>
                </div>
              )
            })}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '14px', marginBottom: '14px' }}>
            <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '18px 20px' }}>
              <h2 style={{ fontSize: '13px', fontWeight: 600, color: '#fff', margin: '0 0 16px' }}>Top Conditions (by frequency)</h2>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={stats.top_conditions} layout="vertical" margin={{ top: 4, right: 20, bottom: 0, left: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#4B5563', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="condition" tick={{ fill: '#9CA3AF', fontSize: 10.5 }} axisLine={false} tickLine={false} width={180} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.025)' }} />
                  <Bar dataKey="count" fill={COLOR} radius={[0, 3, 3, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '18px 20px' }}>
              <h2 style={{ fontSize: '13px', fontWeight: 600, color: '#fff', margin: '0 0 16px' }}>Risk Distribution</h2>
              {(['critical', 'high', 'medium', 'low'] as const).map(risk => {
                const entry = stats.risk_distribution[risk]
                if (!entry) return null
                return (
                  <div key={risk} style={{ marginBottom: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', marginBottom: '5px' }}>
                      <span style={{ color: '#D1D5DB', textTransform: 'capitalize' }}>{risk}</span>
                      <span style={{ color: RISK_COLOR[risk], fontWeight: 700 }}>{entry.count} ({entry.pct}%)</span>
                    </div>
                    <div style={{ height: '6px', background: '#1F2937', borderRadius: '3px' }}>
                      <div style={{ width: `${entry.pct}%`, height: '100%', background: RISK_COLOR[risk], borderRadius: '3px' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '18px 20px' }}>
            <h2 style={{ fontSize: '13px', fontWeight: 600, color: '#fff', margin: '0 0 16px' }}>Age Distribution</h2>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={stats.age_distribution} margin={{ top: 4, right: 4, bottom: 0, left: -22 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="bucket" tick={{ fill: '#4B5563', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#4B5563', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.025)' }} />
                <Bar dataKey="count" fill="#14B8A6" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  )
}
