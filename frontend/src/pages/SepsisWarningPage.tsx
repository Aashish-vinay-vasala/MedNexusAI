import { useState } from 'react'
import { AlertTriangle, CheckCircle2, ChevronsUp, X, Plus, Activity, Clock, ShieldAlert, Zap } from 'lucide-react'
import { useAlerts, useAllPatients, createAlert, ensureVitals } from '../hooks/useClinicalData'
import { BACKEND_URL } from '../lib/backend'
import type { ClinicalAlert, Patient } from '../types/clinical'

// ─── Constants ────────────────────────────────────────────────────────────────

const COLOR = '#F59E0B'
const CARD_BG = '#111827'
const BORDER = '#1F2937'
const TEXT_SUB = '#9CA3AF'
const RISK_COLOR: Record<string, string> = { critical: '#EF4444', high: '#F59E0B' }
const SEVERITY_COLOR: Record<string, string> = { critical: '#EF4444', high: '#F59E0B', medium: '#0EA5E9', info: '#22C55E' }

const QSOFA_CRITERIA = [
  { key: 'rr',  label: 'Respiratory rate ≥ 22/min' },
  { key: 'ams', label: 'Altered mentation (GCS < 15)' },
  { key: 'sbp', label: 'Systolic BP ≤ 100 mmHg' },
] as const

// ─── Alert Row ────────────────────────────────────────────────────────────────

function AlertRow({ alert, onAck, onEsc, onUnset }: {
  alert: ClinicalAlert
  onAck: (id: number) => void
  onEsc: (id: number) => void
  onUnset: (id: number) => void
}) {
  const c = SEVERITY_COLOR[alert.severity] ?? '#9CA3AF'
  return (
    <div style={{
      padding: '14px 20px',
      borderBottom: `1px solid ${BORDER}60`,
      background: alert.escalated ? '#8B5CF608' : alert.acknowledged ? '#22C55E06' : 'transparent',
      borderLeft: `3px solid ${alert.escalated ? '#8B5CF6' : alert.acknowledged ? '#22C55E' : c}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{
              fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px',
              color: c, background: `${c}14`, border: `1px solid ${c}28`,
            }}>
              {alert.severity.toUpperCase()}
            </span>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>{alert.type}</span>
          </div>
          <div style={{ fontSize: '12px', color: TEXT_SUB, marginBottom: '3px' }}>
            {alert.patient} — {alert.detail}
          </div>
          <div style={{ fontSize: '11px', color: '#4B5563', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Clock size={10} />
            {alert.time_ago}
            {alert.acknowledged && <span style={{ color: '#22C55E', marginLeft: '6px' }}>✓ Acknowledged</span>}
            {alert.escalated && <span style={{ color: '#8B5CF6', marginLeft: '6px' }}>↑ Escalated</span>}
          </div>
        </div>
        {!alert.acknowledged && !alert.escalated ? (
          <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
            <button onClick={() => onAck(alert.id)} style={{
              background: '#22C55E14', border: '1px solid #22C55E30', borderRadius: '6px',
              padding: '5px 10px', cursor: 'pointer', color: '#22C55E', fontSize: '11px', fontWeight: 600,
            }}>ACK</button>
            <button onClick={() => onEsc(alert.id)} style={{
              background: '#8B5CF614', border: '1px solid #8B5CF630', borderRadius: '6px',
              padding: '5px 10px', cursor: 'pointer', color: '#8B5CF6', fontSize: '11px', fontWeight: 600,
            }}>ESC</button>
          </div>
        ) : (
          <button onClick={() => onUnset(alert.id)} style={{
            background: 'none', border: 'none', cursor: 'pointer', color: '#4B5563', flexShrink: 0,
          }}>
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SepsisWarningPage() {
  const { alerts, acknowledge, escalate, unsetAlert } = useAlerts()
  const patients = useAllPatients()

  const sepsisAlerts = alerts.filter(a => a.type.toLowerCase().includes('sepsis'))
  const criticalUnacked = sepsisAlerts.filter(a => a.severity === 'critical' && !a.acknowledged)
  const escalatedAlerts = sepsisAlerts.filter(a => a.escalated)
  const atRiskPatients = patients.filter(p => p.risk === 'critical' || p.risk === 'high')

  // New alert form
  const [showForm, setShowForm] = useState(false)
  const [patientId, setPatientId] = useState('')
  const [ward, setWard] = useState('')
  const [criteria, setCriteria] = useState({ rr: false, ams: false, sbp: false })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [formPatient, setFormPatient] = useState<Patient | null>(null)
  const [autoScoring, setAutoScoring] = useState(false)

  const qScore = Object.values(criteria).filter(Boolean).length

  const toggleCriterion = (key: keyof typeof criteria) =>
    setCriteria(prev => ({ ...prev, [key]: !prev[key] }))

  // Auto-prefills qSOFA from a real (stored/generated) vitals reading via the backend's
  // deterministic qSOFA engine (backend/vitals.py) — still editable afterwards.
  const autoScoreFromVitals = async (patient: Patient) => {
    setAutoScoring(true)
    setFormPatient(patient)
    setPatientId(patient.id.replace(/\D/g, ''))
    setWard(patient.ward)
    setShowForm(true)
    try {
      const v = await ensureVitals(patient)
      const res = await fetch(`${BACKEND_URL}/api/v1/vitals/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hr: v.hr, sbp: v.sbp, spo2: v.spo2, temp: v.temp, rr: v.rr, gcs: v.gcs, on_oxygen: v.on_oxygen }),
        signal: AbortSignal.timeout(8000),
      })
      if (res.ok) {
        const data = await res.json()
        setCriteria({
          rr: Boolean(data.qsofa.criteria.respiration_rate_ge_22),
          ams: Boolean(data.qsofa.criteria.altered_mentation),
          sbp: Boolean(data.qsofa.criteria.systolic_bp_le_100),
        })
      }
    } catch { /* leave criteria for manual entry */ }
    setAutoScoring(false)
  }

  const handleSubmit = async () => {
    if (!patientId.trim() || qScore === 0) return
    setSubmitting(true)
    const severity = qScore >= 2 ? 'critical' : 'high'
    const matchedPatient = formPatient?.id.replace(/\D/g, '') === patientId.trim()
      ? formPatient
      : patients.find(p => p.id.replace(/\D/g, '') === patientId.trim()) ?? null
    await createAlert({
      type: 'Sepsis Alert',
      patient: `Patient #${patientId.trim()}`,
      patient_id: matchedPatient?.id,
      category: 'sepsis',
      detail: `qSOFA score ${qScore}${ward.trim() ? ` — ${ward.trim()}` : ''}`,
      time_ago: 'just now',
      severity,
      color: severity === 'critical' ? '#EF4444' : '#F59E0B',
      source: 'Sepsis Warning',
      acknowledged: false,
      escalated: false,
    })
    setSubmitting(false)
    setSubmitted(true)
    setPatientId('')
    setWard('')
    setFormPatient(null)
    setCriteria({ rr: false, ams: false, sbp: false })
    setTimeout(() => { setSubmitted(false); setShowForm(false) }, 2000)
  }

  const scoreLabel =
    qScore === 0 ? 'No criteria met' :
    qScore === 1 ? 'Suspect sepsis — monitor' :
    qScore === 2 ? 'High risk — critical alert' :
    'SEPSIS — Immediate action required'

  const scoreAccent = qScore >= 2 ? '#EF4444' : qScore === 1 ? COLOR : TEXT_SUB

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
            <AlertTriangle size={20} color={COLOR} />
          </div>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#fff', margin: 0 }}>Sepsis Warning System</h1>
            <p style={{ fontSize: '12px', color: TEXT_SUB, margin: 0 }}>qSOFA-based early detection · Realtime alerts</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            fontSize: '11px', color: '#22C55E', background: '#22C55E14',
            padding: '3px 8px', borderRadius: '4px', border: '1px solid #22C55E30',
          }}>LIVE</span>
          <button onClick={() => setShowForm(v => !v)} style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: COLOR, border: 'none', borderRadius: '8px',
            padding: '8px 14px', color: '#000', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
          }}>
            <Plus size={15} />
            New Sepsis Alert
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
        {([
          { label: 'Total Sepsis Alerts',     value: sepsisAlerts.length,     icon: AlertTriangle, color: COLOR      },
          { label: 'Critical Unacknowledged', value: criticalUnacked.length,  icon: ShieldAlert,   color: '#EF4444' },
          { label: 'Escalated',               value: escalatedAlerts.length,  icon: ChevronsUp,    color: '#8B5CF6' },
          { label: 'At-Risk Patients',        value: atRiskPatients.length,   icon: Activity,      color: '#0EA5E9' },
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
              qSOFA Assessment{autoScoring && <span style={{ color: COLOR, fontWeight: 400, fontSize: '11px', marginLeft: '8px' }}>Scoring from vitals…</span>}
            </h3>
            <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: TEXT_SUB }}>
              <X size={16} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            {([
              { label: 'Patient ID', value: patientId, onChange: setPatientId, placeholder: 'e.g. 4821' },
              { label: 'Ward',       value: ward,      onChange: setWard,      placeholder: 'e.g. ICU Ward 3' },
            ] as const).map(f => (
              <div key={f.label}>
                <label style={{ fontSize: '12px', color: TEXT_SUB, display: 'block', marginBottom: '6px' }}>{f.label}</label>
                <input
                  value={f.value}
                  onChange={e => f.onChange(e.target.value)}
                  placeholder={f.placeholder}
                  style={{
                    width: '100%', background: '#0A0F1E', border: `1px solid ${BORDER}`,
                    borderRadius: '8px', padding: '8px 12px', color: '#fff',
                    fontSize: '13px', outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
            ))}
          </div>

          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '12px', color: TEXT_SUB, marginBottom: '10px' }}>qSOFA Criteria</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {QSOFA_CRITERIA.map(c => {
                const checked = criteria[c.key]
                return (
                  <label key={c.key} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
                    onClick={() => toggleCriterion(c.key)}>
                    <div style={{
                      width: '18px', height: '18px', borderRadius: '4px', flexShrink: 0,
                      background: checked ? COLOR : 'transparent',
                      border: `2px solid ${checked ? COLOR : BORDER}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {checked && <CheckCircle2 size={11} color="#000" />}
                    </div>
                    <span style={{ fontSize: '13px', color: checked ? '#fff' : TEXT_SUB }}>{c.label}</span>
                  </label>
                )
              })}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '44px', height: '44px', borderRadius: '10px',
                background: `${scoreAccent}18`, border: `1px solid ${scoreAccent}30`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontSize: '20px', fontWeight: 700, color: scoreAccent }}>{qScore}</span>
              </div>
              <div>
                <div style={{ fontSize: '13px', color: '#fff', fontWeight: 500 }}>{scoreLabel}</div>
                <div style={{ fontSize: '11px', color: TEXT_SUB }}>qSOFA score / 3</div>
              </div>
            </div>
            <button
              onClick={handleSubmit}
              disabled={!patientId.trim() || qScore === 0 || submitting}
              style={{
                background: submitted ? '#22C55E' : COLOR,
                border: 'none', borderRadius: '8px', padding: '9px 18px',
                color: '#000', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                opacity: !patientId.trim() || qScore === 0 ? 0.45 : 1,
                transition: 'background 0.2s',
              }}
            >
              {submitted ? '✓ Alert Created' : submitting ? 'Creating…' : 'Create Alert'}
            </button>
          </div>
        </div>
      )}

      {/* Main grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '16px' }}>

        {/* Left: Sepsis Alerts list */}
        <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{
            padding: '16px 20px', borderBottom: `1px solid ${BORDER}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#fff', margin: 0 }}>Active Sepsis Alerts</h2>
              <p style={{ fontSize: '12px', color: TEXT_SUB, margin: 0 }}>
                {sepsisAlerts.filter(a => !a.acknowledged).length} unacknowledged
              </p>
            </div>
            <span style={{ fontSize: '11px', color: COLOR }}>{sepsisAlerts.length} total</span>
          </div>
          {sepsisAlerts.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: TEXT_SUB, fontSize: '13px' }}>
              No sepsis alerts active
            </div>
          ) : (
            <div style={{ maxHeight: '520px', overflowY: 'auto' }}>
              {sepsisAlerts.map(alert => (
                <AlertRow key={alert.id} alert={alert} onAck={acknowledge} onEsc={escalate} onUnset={unsetAlert} />
              ))}
            </div>
          )}
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* qSOFA Reference */}
          <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '16px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 600, color: '#fff', margin: '0 0 12px' }}>qSOFA Score Reference</h3>
            {([
              { score: '0', label: 'Low risk',                   color: '#22C55E' },
              { score: '1', label: 'Suspect sepsis — monitor',   color: COLOR      },
              { score: '2', label: 'High risk — escalate',       color: '#F97316' },
              { score: '3', label: 'Critical — immediate ICU',   color: '#EF4444' },
            ] as const).map(row => (
              <div key={row.score} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <div style={{
                  width: '28px', height: '28px', borderRadius: '6px',
                  background: `${row.color}18`, border: `1px solid ${row.color}30`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: row.color }}>{row.score}</span>
                </div>
                <span style={{ fontSize: '12px', color: TEXT_SUB }}>{row.label}</span>
              </div>
            ))}
            <div style={{ marginTop: '12px', padding: '10px', background: '#0A0F1E', borderRadius: '8px' }}>
              <p style={{ fontSize: '11px', color: '#4B5563', margin: 0, lineHeight: 1.6 }}>
                Quick SOFA: score ≥ 2 indicates high risk of in-hospital mortality associated with sepsis.
              </p>
            </div>
          </div>

          {/* At-Risk Patients */}
          <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', overflow: 'hidden', flex: 1 }}>
            <div style={{ padding: '14px 16px', borderBottom: `1px solid ${BORDER}` }}>
              <h3 style={{ fontSize: '13px', fontWeight: 600, color: '#fff', margin: 0 }}>At-Risk Patients</h3>
              <p style={{ fontSize: '11px', color: TEXT_SUB, margin: 0 }}>Critical & high-risk</p>
            </div>
            <div style={{ maxHeight: '340px', overflowY: 'auto' }}>
              {atRiskPatients.map(p => (
                <div key={p.id} onClick={() => autoScoreFromVitals(p)} title="Auto-score qSOFA from vitals" style={{
                  padding: '10px 16px', borderBottom: `1px solid ${BORDER}40`,
                  display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer',
                }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0,
                    background: `${RISK_COLOR[p.risk] ?? COLOR}14`,
                    border: `1px solid ${RISK_COLOR[p.risk] ?? COLOR}28`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: RISK_COLOR[p.risk] ?? COLOR }}>
                      {p.risk[0].toUpperCase()}
                    </span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.name}
                    </div>
                    <div style={{ fontSize: '11px', color: TEXT_SUB }}>{p.id} · {p.ward}</div>
                  </div>
                  <span style={{
                    fontSize: '10px', padding: '2px 6px', borderRadius: '4px', flexShrink: 0,
                    color: RISK_COLOR[p.risk] ?? COLOR,
                    background: `${RISK_COLOR[p.risk] ?? COLOR}14`,
                    border: `1px solid ${RISK_COLOR[p.risk] ?? COLOR}28`,
                    fontWeight: 600,
                  }}>
                    {p.risk.toUpperCase()}
                  </span>
                  <Zap size={12} color={TEXT_SUB} style={{ flexShrink: 0 }} />
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
