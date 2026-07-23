import { useState, useEffect } from 'react'
import { Activity, AlertTriangle, X, Plus, Heart, Clock, ShieldAlert } from 'lucide-react'
import { useAlerts, useAllPatients, useKPI, createAlert, ensureVitals } from '../hooks/useClinicalData'
import { BACKEND_URL } from '../lib/backend'
import type { ClinicalAlert, Patient } from '../types/clinical'

type NEWS2Result = { total: number; risk_band: 'none' | 'low' | 'medium' | 'high' }
const NEWS2_BAND_COLOR: Record<string, string> = { none: '#22C55E', low: '#22C55E', medium: '#F59E0B', high: '#EF4444' }

// ─── Constants ────────────────────────────────────────────────────────────────

const COLOR = '#EF4444'
const CARD_BG = '#111827'
const BORDER = '#1F2937'
const TEXT_SUB = '#9CA3AF'
const RISK_COLOR: Record<string, string> = { critical: '#EF4444', high: '#F59E0B', medium: '#0EA5E9', low: '#22C55E' }
const SEVERITY_COLOR: Record<string, string> = { critical: '#EF4444', high: '#F59E0B', medium: '#0EA5E9', info: '#22C55E' }

// ─── Subcomponents ────────────────────────────────────────────────────────────

function PatientCard({ patient, news2, onFlag }: { patient: Patient; news2: NEWS2Result | undefined; onFlag: (p: Patient, news2?: NEWS2Result) => void }) {
  const c = RISK_COLOR[patient.risk] ?? COLOR
  const nc = news2 ? NEWS2_BAND_COLOR[news2.risk_band] : TEXT_SUB
  return (
    <div style={{
      padding: '14px 16px', borderBottom: `1px solid ${BORDER}60`,
      display: 'flex', alignItems: 'center', gap: '12px',
      borderLeft: `3px solid ${c}`,
    }}>
      <div style={{
        width: '38px', height: '38px', borderRadius: '9px', flexShrink: 0,
        background: `${c}14`, border: `1px solid ${c}28`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Heart size={16} color={c} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>{patient.name}</span>
          <span style={{
            fontSize: '10px', padding: '1px 5px', borderRadius: '3px', fontWeight: 700,
            color: c, background: `${c}14`, border: `1px solid ${c}28`,
          }}>{patient.risk.toUpperCase()}</span>
          {news2 && (
            <span title="NEWS2 early warning score" style={{
              fontSize: '10px', padding: '1px 5px', borderRadius: '3px', fontWeight: 700,
              color: nc, background: `${nc}14`, border: `1px solid ${nc}28`,
            }}>NEWS2 {news2.total}</span>
          )}
        </div>
        <div style={{ fontSize: '11px', color: TEXT_SUB }}>
          {patient.id} · Age {patient.age} · {patient.ward}
        </div>
        <div style={{ fontSize: '11px', color: '#4B5563', marginTop: '2px' }}>{patient.status}</div>
      </div>
      <button onClick={() => onFlag(patient, news2)} style={{
        background: `${COLOR}14`, border: `1px solid ${COLOR}30`, borderRadius: '6px',
        padding: '5px 10px', cursor: 'pointer', color: COLOR, fontSize: '11px', fontWeight: 600, flexShrink: 0,
      }}>
        FLAG
      </button>
    </div>
  )
}

function AlertRow({ alert, onAck, onEsc, onUnset }: {
  alert: ClinicalAlert
  onAck: (id: number) => void
  onEsc: (id: number) => void
  onUnset: (id: number) => void
}) {
  const c = SEVERITY_COLOR[alert.severity] ?? '#9CA3AF'
  return (
    <div style={{
      padding: '12px 16px', borderBottom: `1px solid ${BORDER}60`,
      background: alert.escalated ? '#8B5CF608' : alert.acknowledged ? '#22C55E06' : 'transparent',
      borderLeft: `3px solid ${alert.escalated ? '#8B5CF6' : alert.acknowledged ? '#22C55E' : c}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
            <span style={{
              fontSize: '10px', fontWeight: 700, padding: '1px 5px', borderRadius: '3px',
              color: c, background: `${c}14`, border: `1px solid ${c}28`,
            }}>{alert.severity.toUpperCase()}</span>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#fff' }}>{alert.type}</span>
          </div>
          <div style={{ fontSize: '11px', color: TEXT_SUB }}>{alert.patient} — {alert.detail}</div>
          <div style={{ fontSize: '10px', color: '#4B5563', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '3px' }}>
            <Clock size={9} />{alert.time_ago}
            {alert.acknowledged && <span style={{ color: '#22C55E', marginLeft: '6px' }}>✓ Acknowledged</span>}
            {alert.escalated && <span style={{ color: '#8B5CF6', marginLeft: '6px' }}>↑ Escalated</span>}
          </div>
        </div>
        {!alert.acknowledged && !alert.escalated ? (
          <div style={{ display: 'flex', gap: '5px', flexShrink: 0 }}>
            <button onClick={() => onAck(alert.id)} style={{
              background: '#22C55E14', border: '1px solid #22C55E30', borderRadius: '5px',
              padding: '4px 8px', cursor: 'pointer', color: '#22C55E', fontSize: '10px', fontWeight: 600,
            }}>ACK</button>
            <button onClick={() => onEsc(alert.id)} style={{
              background: '#8B5CF614', border: '1px solid #8B5CF630', borderRadius: '5px',
              padding: '4px 8px', cursor: 'pointer', color: '#8B5CF6', fontSize: '10px', fontWeight: 600,
            }}>ESC</button>
          </div>
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

export default function ICUMonitoringPage() {
  const kpi = useKPI()
  const { alerts, acknowledge, escalate, unsetAlert } = useAlerts()
  const patients = useAllPatients()

  const icuPatients = patients.filter(p => p.ward.toLowerCase().includes('icu'))
  const criticalICU = icuPatients.filter(p => p.risk === 'critical')
  const stableICU = icuPatients.filter(p => p.risk === 'low' || p.status === 'Recovering')
  const icuAlerts = alerts.filter(a =>
    a.category === 'icu' || a.type.toLowerCase().includes('icu') || a.source.toLowerCase().includes('icu')
  )

  // Real NEWS2 threshold monitoring — computed per ICU patient from stored/generated vitals.
  const [news2ByPatient, setNews2ByPatient] = useState<Record<string, NEWS2Result>>({})
  useEffect(() => {
    let cancelled = false
    Promise.all(icuPatients.map(async p => {
      const v = await ensureVitals(p)
      const res = await fetch(`${BACKEND_URL}/api/v1/vitals/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hr: v.hr, sbp: v.sbp, spo2: v.spo2, temp: v.temp, rr: v.rr, gcs: v.gcs, on_oxygen: v.on_oxygen }),
        signal: AbortSignal.timeout(8000),
      }).catch(() => null)
      if (!res?.ok) return null
      const data = await res.json()
      return [p.id, data.news2 as NEWS2Result] as const
    })).then(results => {
      if (cancelled) return
      const map: Record<string, NEWS2Result> = {}
      for (const r of results) if (r) map[r[0]] = r[1]
      setNews2ByPatient(map)
    })
    return () => { cancelled = true }
  }, [icuPatients.map(p => p.id).join(',')])

  // New alert form
  const [showForm, setShowForm] = useState(false)
  const [prefill, setPrefill] = useState<Patient | null>(null)
  const [patientId, setPatientId] = useState('')
  const [detail, setDetail] = useState('')
  const [severity, setSeverity] = useState<'critical' | 'high'>('critical')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const openForm = (patient?: Patient, news2?: NEWS2Result) => {
    if (patient) {
      setPrefill(patient)
      setPatientId(patient.id.replace(/\D/g, ''))
      if (news2) {
        setDetail(`NEWS2 ${news2.total} (${news2.risk_band} risk) — vitals declining`)
        setSeverity(news2.risk_band === 'high' ? 'critical' : 'high')
      }
    }
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setPrefill(null)
    setPatientId('')
    setDetail('')
    setSeverity('critical')
  }

  const handleSubmit = async () => {
    if (!patientId.trim() || !detail.trim()) return
    setSubmitting(true)
    const matchedPatient = prefill?.id.replace(/\D/g, '') === patientId.trim()
      ? prefill
      : patients.find(p => p.id.replace(/\D/g, '') === patientId.trim()) ?? null
    await createAlert({
      type: 'ICU Deterioration',
      patient: `Patient #${patientId.trim()}`,
      patient_id: matchedPatient?.id,
      category: 'icu',
      detail: detail.trim(),
      time_ago: 'just now',
      severity,
      color: severity === 'critical' ? '#EF4444' : '#F59E0B',
      source: 'ICU Monitoring',
      acknowledged: false,
      escalated: false,
    })
    setSubmitting(false)
    setSubmitted(true)
    setTimeout(() => { setSubmitted(false); closeForm() }, 2000)
  }

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
            <Activity size={20} color={COLOR} />
          </div>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#fff', margin: 0 }}>ICU Monitoring</h1>
            <p style={{ fontSize: '12px', color: TEXT_SUB, margin: 0 }}>Real-time intensive care unit oversight</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: '#22C55E', background: '#22C55E14', padding: '3px 8px', borderRadius: '4px', border: '1px solid #22C55E30' }}>LIVE</span>
          <button onClick={() => openForm()} style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: COLOR, border: 'none', borderRadius: '8px',
            padding: '8px 14px', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
          }}>
            <Plus size={15} />
            New Alert
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
        {([
          { label: 'ICU Patients',         value: icuPatients.length,  icon: Activity,      color: COLOR      },
          { label: 'Critical',             value: criticalICU.length,  icon: ShieldAlert,   color: '#EF4444' },
          { label: 'Deterioration Alerts', value: icuAlerts.filter(a => !a.acknowledged).length, icon: AlertTriangle, color: '#F59E0B' },
          { label: 'Stable / Recovering',  value: stableICU.length,    icon: Heart,         color: '#22C55E' },
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

      {/* New Alert Form */}
      {showForm && (
        <div style={{
          background: CARD_BG, border: `1px solid ${COLOR}40`, borderRadius: '12px',
          padding: '20px', marginBottom: '20px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#fff', margin: 0 }}>
              {prefill ? `Flag — ${prefill.name}` : 'New ICU Deterioration Alert'}
            </h3>
            <button onClick={closeForm} style={{ background: 'none', border: 'none', cursor: 'pointer', color: TEXT_SUB }}>
              <X size={16} />
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px', marginBottom: '14px' }}>
            <div>
              <label style={{ fontSize: '12px', color: TEXT_SUB, display: 'block', marginBottom: '6px' }}>Patient ID</label>
              <input value={patientId} onChange={e => setPatientId(e.target.value)} placeholder="e.g. 2847" style={{
                width: '100%', background: '#0A0F1E', border: `1px solid ${BORDER}`,
                borderRadius: '8px', padding: '8px 12px', color: '#fff', fontSize: '13px',
                outline: 'none', boxSizing: 'border-box',
              }} />
            </div>
            <div>
              <label style={{ fontSize: '12px', color: TEXT_SUB, display: 'block', marginBottom: '6px' }}>Severity</label>
              <select value={severity} onChange={e => setSeverity(e.target.value as 'critical' | 'high')} style={{
                width: '100%', background: '#0A0F1E', border: `1px solid ${BORDER}`,
                borderRadius: '8px', padding: '8px 12px', color: '#fff', fontSize: '13px',
                outline: 'none', boxSizing: 'border-box', cursor: 'pointer',
              }}>
                <option value="critical">Critical</option>
                <option value="high">High</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '12px', color: TEXT_SUB, display: 'block', marginBottom: '6px' }}>Detail</label>
              <input value={detail} onChange={e => setDetail(e.target.value)} placeholder="e.g. Vitals declining" style={{
                width: '100%', background: '#0A0F1E', border: `1px solid ${BORDER}`,
                borderRadius: '8px', padding: '8px 12px', color: '#fff', fontSize: '13px',
                outline: 'none', boxSizing: 'border-box',
              }} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={handleSubmit} disabled={!patientId.trim() || !detail.trim() || submitting} style={{
              background: submitted ? '#22C55E' : COLOR, border: 'none', borderRadius: '8px',
              padding: '9px 18px', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              opacity: !patientId.trim() || !detail.trim() ? 0.45 : 1,
            }}>
              {submitted ? '✓ Alert Created' : submitting ? 'Creating…' : 'Create Alert'}
            </button>
          </div>
        </div>
      )}

      {/* Main grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '16px' }}>

        {/* Left: ICU Patients */}
        <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{
            padding: '16px 20px', borderBottom: `1px solid ${BORDER}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#fff', margin: 0 }}>ICU Patients</h2>
              <p style={{ fontSize: '12px', color: TEXT_SUB, margin: 0 }}>{criticalICU.length} critical</p>
            </div>
            <span style={{ fontSize: '11px', color: COLOR }}>{icuPatients.length} total</span>
          </div>
          {icuPatients.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: TEXT_SUB, fontSize: '13px' }}>
              No ICU patients on record
            </div>
          ) : (
            <div style={{ maxHeight: '520px', overflowY: 'auto' }}>
              {icuPatients.map(p => (
                <PatientCard key={p.id} patient={p} news2={news2ByPatient[p.id]} onFlag={openForm} />
              ))}
            </div>
          )}
        </div>

        {/* Right: ICU Alerts + stats */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* ICU Stats card */}
          <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '16px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 600, color: '#fff', margin: '0 0 14px' }}>ICU Snapshot</h3>
            {([
              { label: 'Total ICU capacity',   value: `${kpi.icu_patients} / 60`,       color: COLOR      },
              { label: 'Critical patients',    value: `${kpi.icu_critical}`,            color: '#EF4444' },
              { label: 'Available ICU beds',   value: `${Math.max(0, 60 - kpi.icu_patients)}`, color: '#22C55E' },
              { label: 'Bed capacity',         value: `${Math.round((kpi.icu_patients / 60) * 100)}%`, color: '#F59E0B' },
            ] as const).map(row => (
              <div key={row.label} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 0', borderBottom: `1px solid ${BORDER}60`,
              }}>
                <span style={{ fontSize: '12px', color: TEXT_SUB }}>{row.label}</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: row.color }}>{row.value}</span>
              </div>
            ))}
          </div>

          {/* ICU Alerts */}
          <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', overflow: 'hidden', flex: 1 }}>
            <div style={{ padding: '14px 16px', borderBottom: `1px solid ${BORDER}` }}>
              <h3 style={{ fontSize: '13px', fontWeight: 600, color: '#fff', margin: 0 }}>ICU Alerts</h3>
              <p style={{ fontSize: '11px', color: TEXT_SUB, margin: 0 }}>
                {icuAlerts.filter(a => !a.acknowledged).length} unacknowledged
              </p>
            </div>
            {icuAlerts.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: TEXT_SUB, fontSize: '12px' }}>
                No ICU alerts active
              </div>
            ) : (
              <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
                {icuAlerts.map(a => (
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
