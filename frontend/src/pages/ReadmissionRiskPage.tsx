import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { RefreshCw, AlertTriangle, X, TrendingUp, Users, CheckCircle2, Clock, Activity } from 'lucide-react'
import { useAlerts, useAllPatients, createAlert, saveRiskScores } from '../hooks/useClinicalData'
import { BACKEND_URL } from '../lib/backend'
import type { Patient, ClinicalAlert } from '../types/clinical'

type SurvivalResult = {
  km_curve: { time: number; survival_prob: number }[]
  median_survival_days: number | null
  hazard_ratios: Record<string, number>
}

// ─── Constants ────────────────────────────────────────────────────────────────

const COLOR = '#14B8A6'
const CARD_BG = '#111827'
const BORDER = '#1F2937'
const TEXT_SUB = '#9CA3AF'
const SEVERITY_COLOR: Record<string, string> = { critical: '#EF4444', high: '#F59E0B', medium: '#0EA5E9', info: '#22C55E' }

function probColor(prob: number): string {
  if (prob >= 75) return '#EF4444'
  if (prob >= 50) return '#F59E0B'
  if (prob >= 30) return '#0EA5E9'
  return '#22C55E'
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

function PatientRiskRow({ patient, prob, onFlag }: { patient: Patient; prob: number | null; onFlag: (p: Patient) => void }) {
  const pc = prob === null ? TEXT_SUB : probColor(prob)
  return (
    <div style={{
      padding: '12px 16px', borderBottom: `1px solid ${BORDER}60`,
      display: 'flex', alignItems: 'center', gap: '12px',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>{patient.name}</span>
          <span style={{ fontSize: '11px', color: TEXT_SUB }}>({patient.id})</span>
        </div>
        <div style={{ fontSize: '11px', color: TEXT_SUB, marginBottom: '6px' }}>{patient.ward} · Age {patient.age}</div>
        <div style={{ position: 'relative', height: '4px', background: '#1F2937', borderRadius: '2px', width: '100%' }}>
          <div style={{
            position: 'absolute', left: 0, top: 0, height: '100%', borderRadius: '2px',
            width: `${prob ?? 0}%`, background: pc, transition: 'width 0.4s ease',
          }} />
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '12px' }}>
        <div style={{ fontSize: prob === null ? '11px' : '18px', fontWeight: 700, color: pc, lineHeight: 1 }}>{prob === null ? 'Scoring…' : `${prob}%`}</div>
        <div style={{ fontSize: '10px', color: TEXT_SUB, marginBottom: '6px' }}>30-day risk</div>
        <button onClick={() => onFlag(patient)} disabled={prob === null} style={{
          background: `${COLOR}14`, border: `1px solid ${COLOR}30`, borderRadius: '5px',
          padding: '3px 8px', cursor: prob === null ? 'not-allowed' : 'pointer', color: COLOR, fontSize: '10px', fontWeight: 600,
          opacity: prob === null ? 0.5 : 1,
        }}>FLAG</button>
      </div>
    </div>
  )
}

function AlertRow({ alert, onAck, onUnset }: {
  alert: ClinicalAlert
  onAck: (id: number) => void
  onEsc: (id: number) => void
  onUnset: (id: number) => void
}) {
  const c = SEVERITY_COLOR[alert.severity] ?? '#9CA3AF'
  return (
    <div style={{
      padding: '12px 16px', borderBottom: `1px solid ${BORDER}60`,
      background: alert.acknowledged ? '#22C55E06' : 'transparent',
      borderLeft: `3px solid ${alert.acknowledged ? '#22C55E' : c}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#fff', marginBottom: '2px' }}>{alert.patient}</div>
          <div style={{ fontSize: '11px', color: TEXT_SUB }}>{alert.detail}</div>
          <div style={{ fontSize: '10px', color: '#4B5563', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '3px' }}>
            <Clock size={9} />{alert.time_ago}
            {alert.acknowledged && <span style={{ color: '#22C55E', marginLeft: '6px' }}>✓ Acknowledged</span>}
          </div>
        </div>
        {!alert.acknowledged ? (
          <button onClick={() => onAck(alert.id)} style={{
            background: '#22C55E14', border: '1px solid #22C55E30', borderRadius: '5px',
            padding: '4px 8px', cursor: 'pointer', color: '#22C55E', fontSize: '10px', fontWeight: 600, flexShrink: 0,
          }}>ACK</button>
        ) : (
          <button onClick={() => onUnset(alert.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4B5563' }}>
            <X size={13} />
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReadmissionRiskPage() {
  const { alerts, acknowledge, escalate, unsetAlert } = useAlerts()
  const patients = useAllPatients()

  const [survival, setSurvival] = useState<SurvivalResult | null>(null)
  const [survivalError, setSurvivalError] = useState(false)
  const [readmitScores, setReadmitScores] = useState<Record<string, number>>({})

  useEffect(() => {
    if (!patients.length) return
    let cancelled = false
    fetch(`${BACKEND_URL}/api/v1/risk/survival`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patients: patients.map(p => ({ id: p.id, age: p.age, risk: p.risk })) }),
      signal: AbortSignal.timeout(10000),
    })
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => { if (!cancelled) setSurvival(data) })
      .catch(() => { if (!cancelled) setSurvivalError(true) })
    return () => { cancelled = true }
  }, [patients])

  useEffect(() => {
    if (!patients.length) return
    let cancelled = false
    fetch(`${BACKEND_URL}/api/v1/risk/score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patients: patients.map(p => ({ id: p.id, age: p.age, risk: p.risk })) }),
      signal: AbortSignal.timeout(10000),
    })
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(async (data: Record<string, Record<string, number>>) => {
        if (cancelled) return
        const readmit = Object.fromEntries(Object.entries(data).map(([id, dims]) => [id, dims.readmit]))
        setReadmitScores(readmit)
        await saveRiskScores(Object.entries(readmit).map(([patient_id, score]) => ({ patient_id, dimension: 'readmit' as const, score })))
      })
      .catch(() => { /* leave scores unresolved — rows show "Scoring…" */ })
    return () => { cancelled = true }
  }, [patients])

  const readmissionAlerts = alerts.filter(a =>
    a.type.toLowerCase().includes('readmission') || a.source.toLowerCase().includes('readmission')
  )

  const readmissionProb = (patient: Patient): number | null => readmitScores[patient.id] ?? null
  const scoredPatients = [...patients].sort((a, b) => (readmissionProb(b) ?? -1) - (readmissionProb(a) ?? -1))
  const highRisk = patients.filter(p => (readmissionProb(p) ?? 0) >= 75)
  const mediumRisk = patients.filter(p => { const r = readmissionProb(p); return r !== null && r >= 50 && r < 75 })
  const lowRisk = patients.filter(p => { const r = readmissionProb(p); return r !== null && r < 50 })

  // Flag form
  const [showForm, setShowForm] = useState(false)
  const [prefill, setPrefill] = useState<Patient | null>(null)
  const [patientId, setPatientId] = useState('')
  const [prob, setProb] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const openFlag = (patient: Patient) => {
    const p = readmissionProb(patient)
    if (p === null) return
    setPrefill(patient)
    setPatientId(patient.id.replace(/\D/g, ''))
    setProb(String(p))
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setPrefill(null)
    setPatientId('')
    setProb('')
  }

  const handleSubmit = async () => {
    if (!patientId.trim() || !prob.trim()) return
    setSubmitting(true)
    const p = parseInt(prob, 10)
    const severity = p >= 75 ? 'high' : 'medium'
    const matchedPatient = prefill?.id.replace(/\D/g, '') === patientId.trim()
      ? prefill
      : patients.find(pt => pt.id.replace(/\D/g, '') === patientId.trim()) ?? null
    await createAlert({
      type: 'Readmission Risk',
      patient: `Patient #${patientId.trim()}`,
      patient_id: matchedPatient?.id,
      category: 'readmission',
      detail: `${prob}% 30-day readmission probability`,
      time_ago: 'just now',
      severity,
      color: severity === 'high' ? '#F59E0B' : '#0EA5E9',
      source: 'Readmission',
      acknowledged: false,
      escalated: false,
    })
    setSubmitting(false)
    setSubmitted(true)
    setTimeout(() => { setSubmitted(false); closeForm() }, 2000)
  }

  // Risk distribution bars
  const distBars = [
    { label: '≥75% High',    count: highRisk.length,   color: '#EF4444' },
    { label: '50–74% Med',   count: mediumRisk.length,  color: '#F59E0B' },
    { label: '<50% Low',     count: lowRisk.length,     color: '#22C55E' },
  ]
  const maxCount = Math.max(...distBars.map(b => b.count), 1)

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
            <RefreshCw size={20} color={COLOR} />
          </div>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#fff', margin: 0 }}>Readmission Risk</h1>
            <p style={{ fontSize: '12px', color: TEXT_SUB, margin: 0 }}>30-day readmission probability · ML-scored</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: '#22C55E', background: '#22C55E14', padding: '3px 8px', borderRadius: '4px', border: '1px solid #22C55E30' }}>LIVE</span>
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
        {([
          { label: 'High Risk  (≥75%)',   value: highRisk.length,             icon: AlertTriangle, color: '#EF4444' },
          { label: 'Medium Risk (50–74%)', value: mediumRisk.length,           icon: TrendingUp,    color: '#F59E0B' },
          { label: 'Total Assessed',       value: patients.length,             icon: Users,         color: COLOR      },
          { label: 'Active Alerts',        value: readmissionAlerts.filter(a => !a.acknowledged).length, icon: CheckCircle2, color: '#22C55E' },
        ] as const).map(card => (
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
            </div>
          </div>
        ))}
      </div>

      {/* Flag form */}
      {showForm && (
        <div style={{
          background: CARD_BG, border: `1px solid ${COLOR}40`, borderRadius: '12px',
          padding: '20px', marginBottom: '20px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#fff', margin: 0 }}>
              {prefill ? `Flag — ${prefill.name}` : 'Flag Patient for Readmission Risk'}
            </h3>
            <button onClick={closeForm} style={{ background: 'none', border: 'none', cursor: 'pointer', color: TEXT_SUB }}>
              <X size={16} />
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
            <div>
              <label style={{ fontSize: '12px', color: TEXT_SUB, display: 'block', marginBottom: '6px' }}>Patient ID</label>
              <input value={patientId} onChange={e => setPatientId(e.target.value)} placeholder="e.g. 3309" style={{
                width: '100%', background: '#0A0F1E', border: `1px solid ${BORDER}`,
                borderRadius: '8px', padding: '8px 12px', color: '#fff', fontSize: '13px',
                outline: 'none', boxSizing: 'border-box',
              }} />
            </div>
            <div>
              <label style={{ fontSize: '12px', color: TEXT_SUB, display: 'block', marginBottom: '6px' }}>Risk Probability (%)</label>
              <input value={prob} onChange={e => setProb(e.target.value)} placeholder="e.g. 87" type="number" min="1" max="99" style={{
                width: '100%', background: '#0A0F1E', border: `1px solid ${BORDER}`,
                borderRadius: '8px', padding: '8px 12px', color: '#fff', fontSize: '13px',
                outline: 'none', boxSizing: 'border-box',
              }} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={handleSubmit} disabled={!patientId.trim() || !prob.trim() || submitting} style={{
              background: submitted ? '#22C55E' : COLOR, border: 'none', borderRadius: '8px',
              padding: '9px 18px', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              opacity: !patientId.trim() || !prob.trim() ? 0.45 : 1,
            }}>
              {submitted ? '✓ Alert Created' : submitting ? 'Creating…' : 'Create Alert'}
            </button>
          </div>
        </div>
      )}

      {/* Main grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '16px' }}>

        {/* Left: Patient risk table */}
        <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{
            padding: '16px 20px', borderBottom: `1px solid ${BORDER}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#fff', margin: 0 }}>Patient Risk Scores</h2>
              <p style={{ fontSize: '12px', color: TEXT_SUB, margin: 0 }}>Sorted by probability — click FLAG to create alert</p>
            </div>
            <span style={{ fontSize: '11px', color: COLOR }}>{patients.length} assessed</span>
          </div>
          <div style={{ maxHeight: '520px', overflowY: 'auto' }}>
            {scoredPatients.map(p => (
              <PatientRiskRow key={p.id} patient={p} prob={readmissionProb(p)} onFlag={openFlag} />
            ))}
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Survival analysis (Lifelines: Kaplan-Meier + Cox PH) */}
          <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <Activity size={13} color={COLOR} />
              <h3 style={{ fontSize: '13px', fontWeight: 600, color: '#fff', margin: 0 }}>Survival Analysis</h3>
              <span style={{ fontSize: '9px', padding: '1px 6px', borderRadius: '4px', background: `${COLOR}14`, color: COLOR, border: `1px solid ${COLOR}28` }}>Lifelines</span>
            </div>
            <p style={{ fontSize: '10px', color: TEXT_SUB, margin: '0 0 10px' }}>Kaplan-Meier readmission-free survival across the current cohort</p>
            {survivalError ? (
              <div style={{ fontSize: '11px', color: '#F59E0B' }}>Backend unavailable — survival analysis requires the FastAPI server.</div>
            ) : !survival ? (
              <div style={{ fontSize: '11px', color: TEXT_SUB }}>Computing…</div>
            ) : (
              <>
                <div style={{ height: '140px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={survival.km_curve}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
                      <XAxis dataKey="time" tick={{ fontSize: 10, fill: TEXT_SUB }} label={{ value: 'days', position: 'insideBottomRight', fontSize: 10, fill: TEXT_SUB, offset: -2 }} />
                      <YAxis domain={[0, 1]} tick={{ fontSize: 10, fill: TEXT_SUB }} />
                      <Tooltip contentStyle={{ background: '#1F2937', border: '1px solid #374151', borderRadius: '8px', fontSize: '11px' }} />
                      <Line type="stepAfter" dataKey="survival_prob" stroke={COLOR} strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ marginTop: '10px', padding: '10px', background: '#0A0F1E', borderRadius: '8px', fontSize: '11px', color: TEXT_SUB }}>
                  Median readmission-free time: <span style={{ color: '#fff', fontWeight: 600 }}>{survival.median_survival_days ?? 'N/A'} days</span>
                  {Object.keys(survival.hazard_ratios).length > 0 && (
                    <div style={{ marginTop: '6px' }}>
                      Hazard ratios: {Object.entries(survival.hazard_ratios).map(([k, v]) => `${k} ×${v}`).join(' · ')}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Risk distribution */}
          <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '16px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 600, color: '#fff', margin: '0 0 14px' }}>Risk Distribution</h3>
            {distBars.map(bar => (
              <div key={bar.label} style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <span style={{ fontSize: '11px', color: TEXT_SUB }}>{bar.label}</span>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: bar.color }}>{bar.count}</span>
                </div>
                <div style={{ height: '6px', background: '#1F2937', borderRadius: '3px' }}>
                  <div style={{
                    height: '100%', borderRadius: '3px', background: bar.color,
                    width: `${(bar.count / maxCount) * 100}%`, transition: 'width 0.4s ease',
                  }} />
                </div>
              </div>
            ))}
            <div style={{ marginTop: '14px', padding: '10px', background: '#0A0F1E', borderRadius: '8px' }}>
              <p style={{ fontSize: '11px', color: '#4B5563', margin: 0, lineHeight: 1.6 }}>
                {(() => {
                  const known = patients.map(readmissionProb).filter((s): s is number => s !== null)
                  return known.length ? (
                    <>Avg risk: <span style={{ color: '#fff', fontWeight: 600 }}>{Math.round(known.reduce((s, v) => s + v, 0) / known.length)}%</span> across {known.length} of {patients.length} patients</>
                  ) : 'Scoring in progress…'
                })()}
              </p>
            </div>
          </div>

          {/* Active readmission alerts */}
          <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', overflow: 'hidden', flex: 1 }}>
            <div style={{ padding: '14px 16px', borderBottom: `1px solid ${BORDER}` }}>
              <h3 style={{ fontSize: '13px', fontWeight: 600, color: '#fff', margin: 0 }}>Active Alerts</h3>
              <p style={{ fontSize: '11px', color: TEXT_SUB, margin: 0 }}>
                {readmissionAlerts.filter(a => !a.acknowledged).length} unacknowledged
              </p>
            </div>
            {readmissionAlerts.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: TEXT_SUB, fontSize: '12px' }}>
                No readmission alerts active
              </div>
            ) : (
              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {readmissionAlerts.map(a => (
                  <AlertRow key={a.id} alert={a} onAck={acknowledge} onEsc={escalate} onUnset={unsetAlert} />
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
