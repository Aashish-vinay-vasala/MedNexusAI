import { useState, useEffect } from 'react'
import { usePatientContext } from '../context/PatientContext'
import { Activity, Search, AlertTriangle, Heart, Wind, Thermometer, Droplets, Brain, CheckCircle2, Pencil, Trash2, Check, X } from 'lucide-react'
import { useAllPatients, createAlert, ensureVitals, updateVitals, deleteVitals } from '../hooks/useClinicalData'
import type { Vitals as RawVitals } from '../types/clinical'
import { BACKEND_URL } from '../lib/backend'

const COLOR = '#EF4444'
const CARD_BG = '#111827'
const BORDER = '#1F2937'
const TEXT_SUB = '#9CA3AF'
const RISK_COLOR: Record<string, string> = { critical: '#EF4444', high: '#F59E0B', medium: '#0EA5E9', low: '#22C55E' }

type VitalStatus = 'normal' | 'warning' | 'critical'
type Vital = { key: string; label: string; value: string; unit: string; ref: string; status: VitalStatus; icon: React.FC<{ size: number; color: string }> }
type NEWS2Response = { sub_scores: Record<string, number>; total: number; risk_band: 'none' | 'low' | 'medium' | 'high' }
type PatientVitalsState = { raw: RawVitals; news2: NEWS2Response }

function subScoreStatus(subScore: number): VitalStatus {
  return subScore >= 3 ? 'critical' : subScore >= 1 ? 'warning' : 'normal'
}

/** Builds the display vital-card list from a real stored vitals row + the backend's real NEWS2 sub-scores. */
function buildVitalCards(raw: Omit<RawVitals, 'id' | 'recorded_at'>, news2: NEWS2Response): Vital[] {
  const sub = news2.sub_scores
  return [
    { key: 'hr', label: 'Heart Rate', unit: 'bpm', ref: '60–100', value: String(raw.hr), status: subScoreStatus(sub.heart_rate), icon: Heart },
    { key: 'sbp', label: 'Blood Pressure', unit: 'mmHg', ref: '90–140 / 60–90', value: `${raw.sbp}/${raw.dbp}`, status: subScoreStatus(sub.systolic_bp), icon: Activity },
    { key: 'spo2', label: 'SpO₂', unit: '%', ref: '≥95%', value: String(raw.spo2), status: subScoreStatus(sub.spo2), icon: Droplets },
    { key: 'temp', label: 'Temperature', unit: '°C', ref: '36.1–37.2', value: raw.temp.toFixed(1), status: subScoreStatus(sub.temperature), icon: Thermometer },
    { key: 'rr', label: 'Resp. Rate', unit: '/min', ref: '12–20', value: String(raw.rr), status: subScoreStatus(sub.respiration_rate), icon: Wind },
    { key: 'gcs', label: 'GCS', unit: '/15', ref: '15', value: String(raw.gcs), status: subScoreStatus(sub.consciousness), icon: Brain },
  ]
}

async function fetchNews2(raw: Omit<RawVitals, 'id' | 'recorded_at'>): Promise<NEWS2Response | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/vitals/score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hr: raw.hr, sbp: raw.sbp, spo2: raw.spo2, temp: raw.temp, rr: raw.rr, gcs: raw.gcs, on_oxygen: raw.on_oxygen }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.news2 as NEWS2Response
  } catch {
    return null
  }
}

const STATUS_COLOR: Record<VitalStatus, string> = { normal: '#22C55E', warning: '#F59E0B', critical: '#EF4444' }

function VitalCard({ vital }: { vital: Vital }) {
  const c = STATUS_COLOR[vital.status]
  const Icon = vital.icon
  const pct = vital.status === 'critical' ? 85 : vital.status === 'warning' ? 60 : 30

  return (
    <div style={{ background: '#0A0F1E', border: `1px solid ${vital.status !== 'normal' ? c + '40' : BORDER}`, borderRadius: '12px', padding: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <div style={{ width: '26px', height: '26px', borderRadius: '7px', background: `${c}14`, border: `1px solid ${c}28`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={13} color={c} />
          </div>
          <span style={{ fontSize: '11px', fontWeight: 600, color: TEXT_SUB }}>{vital.label}</span>
        </div>
        <span style={{ fontSize: '9px', padding: '1px 6px', borderRadius: '3px', background: `${c}14`, color: c, border: `1px solid ${c}28`, fontWeight: 700 }}>
          {vital.status.toUpperCase()}
        </span>
      </div>
      <div style={{ fontSize: '28px', fontWeight: 700, color: c, lineHeight: 1, marginBottom: '4px' }}>{vital.value}</div>
      <div style={{ fontSize: '11px', color: TEXT_SUB, marginBottom: '10px' }}>{vital.unit} · ref {vital.ref}</div>
      <div style={{ height: '4px', background: '#1F2937', borderRadius: '2px' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: `linear-gradient(90deg, #22C55E, ${c})`, borderRadius: '2px', transition: 'width 0.4s ease' }} />
      </div>
    </div>
  )
}

export default function VitalSignsPage() {
  const patients = useAllPatients()
  const { selectedPatient: selected, setSelectedPatient: setSelected } = usePatientContext()
  const [search, setSearch] = useState('')
  const [alerting, setAlerting] = useState(false)
  const [alerted, setAlerted] = useState(false)
  const [editingVitals, setEditingVitals] = useState(false)
  const [editForm, setEditForm] = useState<Record<string, string>>({})
  const [vitalsBusy, setVitalsBusy] = useState(false)

  // Real vitals + real backend NEWS2 scoring per patient (fetched once for the visible cohort).
  const [vitalsByPatient, setVitalsByPatient] = useState<Record<string, PatientVitalsState>>({})
  useEffect(() => {
    let cancelled = false
    Promise.all(patients.map(async p => {
      const raw = await ensureVitals(p)
      const news2 = await fetchNews2(raw)
      return news2 ? ([p.id, { raw, news2 }] as const) : null
    })).then(results => {
      if (cancelled) return
      const map: Record<string, PatientVitalsState> = {}
      for (const r of results) if (r) map[r[0]] = r[1]
      setVitalsByPatient(map)
    })
    return () => { cancelled = true }
  }, [patients.map(p => p.id).join(',')])

  const filtered = search.trim()
    ? patients.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.id.toLowerCase().includes(search.toLowerCase()))
    : patients

  const selectedVitals = selected ? vitalsByPatient[selected.id] : undefined
  const vitals = selectedVitals ? buildVitalCards(selectedVitals.raw, selectedVitals.news2) : []
  const news2 = selectedVitals?.news2.total ?? 0
  const news2Color = news2 >= 7 ? '#EF4444' : news2 >= 5 ? '#F59E0B' : news2 >= 3 ? '#0EA5E9' : '#22C55E'
  const criticalVitals = vitals.filter(v => v.status === 'critical')

  async function raiseAlert() {
    if (!selected || alerting) return
    setAlerting(true)
    await createAlert({
      type: 'Vital Signs Alert',
      patient: `Patient #${selected.id.replace(/\D/g, '')}`,
      patient_id: selected.id,
      category: 'vitals',
      detail: `NEWS2 ${news2} — ${criticalVitals.map(v => v.label).join(', ')} abnormal`,
      time_ago: 'just now',
      severity: news2 >= 7 ? 'critical' : 'high',
      color: news2 >= 7 ? '#EF4444' : '#F59E0B',
      source: 'Vital Signs Monitor',
      acknowledged: false,
      escalated: false,
    })
    setAlerting(false); setAlerted(true)
    setTimeout(() => setAlerted(false), 3000)
  }

  function startEditVitals() {
    if (!selectedVitals) return
    const r = selectedVitals.raw
    setEditForm({ hr: String(r.hr), sbp: String(r.sbp), dbp: String(r.dbp), spo2: String(r.spo2), temp: String(r.temp), rr: String(r.rr) })
    setEditingVitals(true)
  }

  async function saveEditVitals() {
    if (!selected || !selectedVitals) return
    setVitalsBusy(true)
    try {
      const updated = await updateVitals(selectedVitals.raw.id, {
        hr: parseInt(editForm.hr, 10), sbp: parseInt(editForm.sbp, 10), dbp: parseInt(editForm.dbp, 10),
        spo2: parseInt(editForm.spo2, 10), temp: parseFloat(editForm.temp), rr: parseInt(editForm.rr, 10),
      })
      const news2 = await fetchNews2(updated)
      if (news2) setVitalsByPatient(prev => ({ ...prev, [selected.id]: { raw: updated, news2 } }))
      setEditingVitals(false)
    } finally {
      setVitalsBusy(false)
    }
  }

  async function removeVitals() {
    if (!selected || !selectedVitals) return
    setVitalsBusy(true)
    try {
      await deleteVitals(selectedVitals.raw.id)
      // The backend auto-seeds a fresh reading if none exists — refetch immediately so the
      // panel doesn't sit empty until the page happens to remount.
      const fresh = await ensureVitals(selected)
      const news2 = await fetchNews2(fresh)
      if (news2) {
        setVitalsByPatient(prev => ({ ...prev, [selected.id]: { raw: fresh, news2 } }))
      } else {
        setVitalsByPatient(prev => { const next = { ...prev }; delete next[selected.id]; return next })
      }
    } finally {
      setVitalsBusy(false)
    }
  }

  return (
    <div style={{ padding: '24px', minHeight: '100%', background: '#0A0F1E' }}>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: `${COLOR}18`, border: `1px solid ${COLOR}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Activity size={20} color={COLOR} />
          </div>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#fff', margin: 0 }}>Vital Signs Monitor</h1>
            <p style={{ fontSize: '12px', color: TEXT_SUB, margin: 0 }}>Real-time vital signs · NEWS2 scoring · Clinical alerts</p>
          </div>
        </div>
        <span style={{ fontSize: '11px', color: '#22C55E', background: '#22C55E14', padding: '3px 8px', borderRadius: '4px', border: '1px solid #22C55E30' }}>LIVE</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '16px' }}>

        {/* Patient list */}
        <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', overflow: 'hidden', alignSelf: 'start' }}>
          <div style={{ padding: '10px 12px', borderBottom: `1px solid ${BORDER}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', background: '#0A0F1E', border: `1px solid ${BORDER}`, borderRadius: '7px', padding: '6px 10px' }}>
              <Search size={12} color={TEXT_SUB} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search patients…"
                style={{ background: 'none', border: 'none', outline: 'none', color: '#fff', fontSize: '12px', flex: 1 }} />
            </div>
          </div>
          <div style={{ maxHeight: '520px', overflowY: 'auto' }}>
            {filtered.map(p => {
              const sel = selected?.id === p.id
              const rc = RISK_COLOR[p.risk] ?? COLOR
              const pNews2 = vitalsByPatient[p.id]?.news2.total
              return (
                <div key={p.id} onClick={() => { setSelected(sel ? null : p); setAlerted(false) }}
                  style={{ padding: '10px 12px', borderBottom: `1px solid ${BORDER}60`, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', background: sel ? `${COLOR}10` : 'transparent', borderLeft: sel ? `3px solid ${COLOR}` : '3px solid transparent' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: `${rc}14`, border: `1px solid ${rc}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: '9px', fontWeight: 700, color: rc }}>{p.risk[0].toUpperCase()}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                    <div style={{ fontSize: '10px', color: TEXT_SUB }}>NEWS2: {pNews2 ?? '…'}</div>
                  </div>
                  {(pNews2 ?? 0) >= 5 && <span style={{ fontSize: '9px', background: '#EF444414', color: '#EF4444', border: '1px solid #EF444428', borderRadius: '3px', padding: '1px 5px', fontWeight: 700 }}>!</span>}
                </div>
              )
            })}
          </div>
        </div>

        {/* Vitals panel */}
        {!selected ? (
          <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px', flexDirection: 'column', gap: '10px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: `${COLOR}14`, border: `1px solid ${COLOR}28`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Activity size={22} color={COLOR} />
            </div>
            <p style={{ fontSize: '14px', color: '#fff', margin: 0, fontWeight: 500 }}>Select a patient</p>
            <p style={{ fontSize: '13px', color: TEXT_SUB, margin: 0 }}>View live vital signs and NEWS2 score</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

            {/* NEWS2 header */}
            <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>{selected.name}</div>
                  <div style={{ fontSize: '11px', color: TEXT_SUB }}>{selected.id} · Age {selected.age} · {selected.ward}</div>
                </div>
                <div style={{ textAlign: 'center', padding: '8px 16px', background: `${news2Color}10`, border: `1px solid ${news2Color}30`, borderRadius: '10px' }}>
                  <div style={{ fontSize: '28px', fontWeight: 700, color: news2Color, lineHeight: 1 }}>{news2}</div>
                  <div style={{ fontSize: '10px', color: TEXT_SUB, marginTop: '2px' }}>NEWS2 Score</div>
                </div>
                <div style={{ fontSize: '12px', color: news2Color, fontWeight: 600 }}>
                  {news2 >= 7 ? 'URGENT — Continuous monitoring' : news2 >= 5 ? 'HIGH — Increase monitoring frequency' : news2 >= 3 ? 'MEDIUM — Monitor every 1 hr' : 'LOW — Routine monitoring'}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {criticalVitals.length > 0 && (
                  <button onClick={raiseAlert} disabled={alerting || alerted}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', border: `1px solid ${alerted ? '#22C55E40' : '#EF444440'}`, background: alerted ? '#22C55E18' : '#EF444418', color: alerted ? '#22C55E' : '#EF4444', fontSize: '12px', fontWeight: 600, cursor: alerting ? 'wait' : 'pointer' }}>
                    {alerted ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                    {alerted ? 'Alert Raised!' : alerting ? 'Raising…' : 'Raise Alert'}
                  </button>
                )}
                {selectedVitals && !editingVitals && (
                  <>
                    <button onClick={startEditVitals} title="Edit reading" style={{ background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: '8px', padding: '8px', color: TEXT_SUB, cursor: 'pointer', display: 'flex' }}>
                      <Pencil size={14} />
                    </button>
                    <button onClick={removeVitals} disabled={vitalsBusy} title="Delete reading" style={{ background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: '8px', padding: '8px', color: TEXT_SUB, cursor: vitalsBusy ? 'not-allowed' : 'pointer', display: 'flex' }}>
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Inline edit form for the current reading */}
            {editingVitals && (
              <div style={{ background: CARD_BG, border: `1px solid ${COLOR}40`, borderRadius: '12px', padding: '16px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                {(['hr', 'sbp', 'dbp', 'spo2', 'temp', 'rr'] as const).map(field => (
                  <div key={field}>
                    <div style={{ fontSize: '10px', color: TEXT_SUB, marginBottom: '4px', textTransform: 'uppercase' }}>{field}</div>
                    <input value={editForm[field] ?? ''} onChange={e => setEditForm(v => ({ ...v, [field]: e.target.value }))}
                      type="number" style={{ background: '#0A0F1E', border: `1px solid ${BORDER}`, borderRadius: '6px', color: '#fff', fontSize: '12px', padding: '7px 10px', width: '72px' }} />
                  </div>
                ))}
                <button onClick={saveEditVitals} disabled={vitalsBusy} title="Save"
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '8px 12px', borderRadius: '6px', border: `1px solid ${COLOR}40`, background: `${COLOR}18`, color: COLOR, fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                  <Check size={13} /> Save
                </button>
                <button onClick={() => setEditingVitals(false)} title="Cancel"
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '8px 12px', borderRadius: '6px', border: `1px solid ${BORDER}`, background: 'transparent', color: TEXT_SUB, fontSize: '12px', cursor: 'pointer' }}>
                  <X size={13} /> Cancel
                </button>
              </div>
            )}

            {/* Vital cards grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              {vitals.map(v => <VitalCard key={v.key} vital={v} />)}
            </div>

          </div>
        )}
      </div>
    </div>
  )
}
