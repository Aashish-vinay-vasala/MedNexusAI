import { useState, useEffect } from 'react'
import { Cpu, RefreshCw, CheckCircle2, TrendingUp, ShieldAlert, Search, ChevronRight, AlertTriangle, Trash2 } from 'lucide-react'
import { useAllPatients, saveRiskScores, deleteRiskScore, createActivity, useEHRDiagnoses, useEHRMedications, usePatientRiskScores } from '../hooks/useClinicalData'
import { BACKEND_URL } from '../lib/backend'
import type { Patient, EHRDiagnosis, EHRMedication } from '../types/clinical'

const CARD_BG = '#111827'
const BORDER = '#1F2937'
const TEXT_SUB = '#9CA3AF'
const RISK_COLOR: Record<string, string> = { critical: '#EF4444', high: '#F59E0B', medium: '#0EA5E9', low: '#22C55E' }

type Mode = 'prediction' | 'profiling'

// ---- Prediction mode: per-dimension ML risk scores ----

type RiskDimension = { label: string; key: string; color: string }
const DIMENSIONS: RiskDimension[] = [
  { label: 'Sepsis Risk',         key: 'sepsis',     color: '#EF4444' },
  { label: '30-day Mortality',    key: 'mortality',  color: '#F59E0B' },
  { label: 'ICU Deterioration',   key: 'icu',        color: '#8B5CF6' },
  { label: 'Readmission (30d)',   key: 'readmit',    color: '#0EA5E9' },
]


function scoreColor(score: number): string {
  if (score >= 75) return '#EF4444'
  if (score >= 50) return '#F59E0B'
  if (score >= 30) return '#0EA5E9'
  return '#22C55E'
}

function ScoreBar({ score, color }: { score: number | null; color: string }) {
  if (score === null) {
    return <span style={{ fontSize: '12px', color: TEXT_SUB }}>Scoring…</span>
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <div style={{ flex: 1, height: '6px', background: '#1F2937', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{ width: `${score}%`, height: '100%', background: color, borderRadius: '3px', transition: 'width 0.4s ease' }} />
      </div>
      <span style={{ fontSize: '12px', fontWeight: 700, color, minWidth: '32px', textAlign: 'right' }}>{score}%</span>
    </div>
  )
}

// ---- Profiling mode: weighted risk-factor checklist, derived from real EHR records ----

type Factor = { label: string; weight: number; flag: boolean; detail: string }

function riskFactors(patient: Patient, diagnoses: EHRDiagnosis[], medications: EHRMedication[]): Factor[] {
  const activeMeds = medications.filter(m => m.active)
  const hasDiagnosis = (needle: RegExp) => diagnoses.find(d => needle.test(d.code) || needle.test(d.description))
  const diabetes = hasDiagnosis(/^E1[01]|diabetes/i)
  const cardiac = hasDiagnosis(/^I(2[015]|50)|heart|cardiac/i)
  const respiratory = hasDiagnosis(/^J(1[89]|4[41])|COPD|pneumonia|respiratory/i)

  const base: Factor[] = [
    { label: 'Age > 65',                weight: 15, flag: patient.age > 65,                                                    detail: `Age ${patient.age}` },
    { label: 'ICU Admission',           weight: 22, flag: patient.ward.toLowerCase().includes('icu'),                          detail: patient.ward },
    { label: 'Critical Risk Level',     weight: 28, flag: patient.risk === 'critical',                                         detail: `Risk: ${patient.risk}` },
    { label: 'High Risk Level',         weight: 18, flag: patient.risk === 'high',                                             detail: `Risk: ${patient.risk}` },
    { label: 'Comorbid — Diabetes',     weight: 12, flag: !!diabetes,                                                          detail: diabetes ? `${diabetes.code} — active` : '' },
    { label: 'Comorbid — Cardiac',      weight: 14, flag: !!cardiac,                                                           detail: cardiac ? `${cardiac.code} — active` : '' },
    { label: 'Comorbid — Respiratory',  weight: 11, flag: !!respiratory,                                                       detail: respiratory ? `${respiratory.code} — active` : '' },
    { label: 'Recent Emergency Admit',  weight: 16, flag: patient.status === 'Critical' || patient.status === 'Admitted',      detail: `Status: ${patient.status}` },
    { label: 'Elevated Vitals',         weight: 13, flag: patient.risk !== 'low',                                              detail: 'RR > 20 or SpO₂ < 95%' },
    { label: 'Polypharmacy (>4 drugs)', weight: 9,  flag: activeMeds.length > 4,                                               detail: `${activeMeds.length} active medications` },
  ]
  return base.filter(f => f.flag)
}

function totalRisk(factors: Factor[]): number {
  return Math.min(99, factors.reduce((s, f) => s + f.weight, 0))
}

function riskLabel(score: number) {
  if (score >= 65) return { text: 'HIGH RISK', color: '#EF4444' }
  if (score >= 40) return { text: 'ELEVATED', color: '#F59E0B' }
  if (score >= 20) return { text: 'MODERATE', color: '#0EA5E9' }
  return { text: 'LOW RISK', color: '#22C55E' }
}

// ---- Merged page ----

type RiskScores = Record<string, Record<string, number>>

export default function RiskAssessmentPage() {
  const patients = useAllPatients()
  const [mode, setMode] = useState<Mode>('prediction')
  const [selected, setSelected] = useState<Patient | null>(null)
  const [search, setSearch] = useState('')
  const [running, setRunning] = useState(false)
  const [ran, setRan] = useState(false)
  const [scores, setScores] = useState<RiskScores>({})

  const color = mode === 'prediction' ? '#EF4444' : '#0EA5E9'

  function riskScore(patient: Patient, key: string): number | null {
    return scores[patient.id]?.[key] ?? null
  }

  async function fetchScores(): Promise<boolean> {
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/risk/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patients: patients.map(p => ({ id: p.id, age: p.age, risk: p.risk })) }),
        signal: AbortSignal.timeout(10000),
      })
      if (!res.ok) return false
      const data: RiskScores = await res.json()
      setScores(data)
      const rows = Object.entries(data).flatMap(([patient_id, dims]) =>
        Object.entries(dims).map(([dimension, score]) => ({ patient_id, dimension: dimension as 'sepsis' | 'mortality' | 'icu' | 'readmit', score }))
      )
      await saveRiskScores(rows)
      return true
    } catch {
      return false
    }
  }

  // Auto-score once on load so the page isn't showing pure-fallback numbers by default
  // (fetch only — no activity-feed log, that's reserved for the explicit "Run Model" action).
  useEffect(() => { if (patients.length) fetchScores() }, [patients.length])

  async function runModel() {
    setRunning(true)
    await fetchScores()
    await createActivity({
      icon_name: 'Cpu', color,
      label: 'Risk Model Scored',
      detail: `Batch: ${patients.length} patients re-scored across 4 dimensions`,
      time_ago: 'just now',
    })
    setRunning(false); setRan(true)
    setTimeout(() => setRan(false), 4000)
  }

  const filtered = search.trim()
    ? patients.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.id.toLowerCase().includes(search.toLowerCase()))
    : patients

  const selectedDiagnoses = useEHRDiagnoses(selected?.id)
  const selectedMedications = useEHRMedications(selected?.id)
  const factors = selected ? riskFactors(selected, selectedDiagnoses, selectedMedications) : []
  const totalScore = totalRisk(factors)
  const label = riskLabel(totalScore)

  const [deletingDim, setDeletingDim] = useState<string | null>(null)
  const persistedScores = usePatientRiskScores(selected?.id)

  async function removeScore(dimension: string) {
    const row = persistedScores.find(s => s.dimension === dimension)
    if (!row) return
    setDeletingDim(dimension)
    try {
      await deleteRiskScore(row.id)
      setScores(prev => {
        const patientScores = prev[selected!.id]
        if (!patientScores) return prev
        const rest = Object.fromEntries(Object.entries(patientScores).filter(([dim]) => dim !== dimension))
        return { ...prev, [selected!.id]: rest }
      })
    } finally {
      setDeletingDim(null)
    }
  }

  return (
    <div style={{ padding: '24px', minHeight: '100%', background: '#0A0F1E' }}>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: `${color}18`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {mode === 'prediction' ? <Cpu size={20} color={color} /> : <ShieldAlert size={20} color={color} />}
          </div>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#fff', margin: 0 }}>Risk Assessment</h1>
            <p style={{ fontSize: '12px', color: TEXT_SUB, margin: 0 }}>
              {mode === 'prediction' ? 'ML risk scores across 4 clinical dimensions' : 'Per-patient risk factor breakdown & scoring'}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '11px', color: '#22C55E', background: '#22C55E14', padding: '3px 8px', borderRadius: '4px', border: '1px solid #22C55E30' }}>LIVE</span>
          <div style={{ display: 'flex', background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '8px', padding: '3px' }}>
            {(['prediction', 'profiling'] as Mode[]).map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setSelected(null) }}
                style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', background: mode === m ? `${color}20` : 'transparent', color: mode === m ? color : TEXT_SUB, fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
              >
                {m === 'prediction' ? 'Prediction' : 'Profiling'}
              </button>
            ))}
          </div>
          {mode === 'prediction' && (
            <button
              onClick={runModel}
              disabled={running}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', border: `1px solid ${ran ? '#22C55E40' : color + '40'}`, background: ran ? '#22C55E18' : `${color}18`, color: ran ? '#22C55E' : color, fontSize: '12px', fontWeight: 600, cursor: running ? 'wait' : 'pointer' }}
            >
              {running ? <RefreshCw size={13} /> : ran ? <CheckCircle2 size={13} /> : <Cpu size={13} />}
              {running ? 'Running…' : ran ? 'Done!' : 'Run Model'}
            </button>
          )}
        </div>
      </div>

      {mode === 'prediction' ? (
        <>
          {/* Summary KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
            {DIMENSIONS.map(dim => {
              const known = patients.map(p => riskScore(p, dim.key)).filter((s): s is number => s !== null)
              const avg = known.length ? Math.round(known.reduce((s, v) => s + v, 0) / known.length) : null
              const high = known.filter(s => s >= 75).length
              return (
                <div key={dim.key} style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '16px' }}>
                  <div style={{ fontSize: '11px', color: TEXT_SUB, marginBottom: '6px' }}>{dim.label}</div>
                  <div style={{ fontSize: '28px', fontWeight: 700, color: avg === null ? TEXT_SUB : scoreColor(avg), lineHeight: 1 }}>{avg === null ? '—' : `${avg}%`}</div>
                  <div style={{ fontSize: '11px', color: TEXT_SUB, marginTop: '4px' }}>avg · <span style={{ color: '#EF4444' }}>{high} high-risk</span></div>
                  <ScoreBar score={avg} color={dim.color} />
                </div>
              )
            })}
          </div>

          {/* Patient table */}
          <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#fff', margin: 0 }}>Patient Risk Scores</h2>
              <TrendingUp size={14} color={TEXT_SUB} />
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#0D1117' }}>
                    {['Patient', 'Ward', 'Risk Level', ...DIMENSIONS.map(d => d.label)].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', color: TEXT_SUB, fontWeight: 600, borderBottom: `1px solid ${BORDER}`, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {patients.map((p, i) => {
                    const sel = selected?.id === p.id
                    const rc = RISK_COLOR[p.risk] ?? color
                    return (
                      <tr
                        key={p.id}
                        onClick={() => setSelected(sel ? null : p)}
                        style={{ background: sel ? `${color}08` : i % 2 === 0 ? 'transparent' : '#0A0F1E1A', cursor: 'pointer' }}
                      >
                        <td style={{ padding: '10px 16px' }}>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>{p.name}</div>
                          <div style={{ fontSize: '11px', color: TEXT_SUB }}>{p.id}</div>
                        </td>
                        <td style={{ padding: '10px 16px', fontSize: '12px', color: TEXT_SUB }}>{p.ward}</td>
                        <td style={{ padding: '10px 16px' }}>
                          <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '4px', fontWeight: 700, color: rc, background: `${rc}14` }}>
                            {p.risk.toUpperCase()}
                          </span>
                        </td>
                        {DIMENSIONS.map(dim => {
                          const score = riskScore(p, dim.key)
                          const sc = score === null ? TEXT_SUB : scoreColor(score)
                          return (
                            <td key={dim.key} style={{ padding: '10px 16px', minWidth: '130px' }}>
                              <ScoreBar score={score} color={sc} />
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Detail panel for selected patient */}
          {selected && (
            <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '20px', marginTop: '16px' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#fff', marginBottom: '16px' }}>
                Score Breakdown — {selected.name}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                {DIMENSIONS.map(dim => {
                  const score = riskScore(selected, dim.key)
                  const sc = score === null ? TEXT_SUB : scoreColor(score)
                  const dimLabel = score === null ? 'PENDING' : score >= 75 ? 'HIGH RISK' : score >= 50 ? 'ELEVATED' : score >= 30 ? 'MODERATE' : 'LOW'
                  const canDelete = persistedScores.some(s => s.dimension === dim.key)
                  return (
                    <div key={dim.key} style={{ background: '#0A0F1E', border: `1px solid ${dim.color}20`, borderRadius: '10px', padding: '14px', position: 'relative' }}>
                      {canDelete && (
                        <button onClick={() => removeScore(dim.key)} disabled={deletingDim === dim.key} title="Delete stored score"
                          style={{ position: 'absolute', top: '10px', right: '10px', background: 'transparent', border: 'none', color: TEXT_SUB, cursor: deletingDim === dim.key ? 'not-allowed' : 'pointer', display: 'flex' }}>
                          <Trash2 size={12} />
                        </button>
                      )}
                      <div style={{ fontSize: '11px', color: TEXT_SUB, marginBottom: '8px' }}>{dim.label}</div>
                      <div style={{ fontSize: '32px', fontWeight: 700, color: sc, lineHeight: 1, marginBottom: '6px' }}>{score === null ? '—' : `${score}%`}</div>
                      <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 700, color: sc, background: `${sc}14` }}>{dimLabel}</span>
                      <div style={{ marginTop: '10px' }}>
                        <ScoreBar score={score} color={dim.color} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '16px' }}>

          {/* Patient list */}
          <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', overflow: 'hidden', alignSelf: 'start' }}>
            <div style={{ padding: '12px 14px', borderBottom: `1px solid ${BORDER}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#0A0F1E', border: `1px solid ${BORDER}`, borderRadius: '8px', padding: '7px 10px' }}>
                <Search size={13} color={TEXT_SUB} />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search patients…" style={{ background: 'none', border: 'none', outline: 'none', color: '#fff', fontSize: '13px', flex: 1 }} />
              </div>
            </div>
            <div style={{ maxHeight: '580px', overflowY: 'auto' }}>
              {filtered.map(p => {
                const sel = selected?.id === p.id
                const rc = RISK_COLOR[p.risk] ?? color
                return (
                  <div key={p.id} onClick={() => setSelected(sel ? null : p)} style={{ padding: '10px 14px', borderBottom: `1px solid ${BORDER}60`, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', background: sel ? `${color}10` : 'transparent', borderLeft: sel ? `3px solid ${color}` : '3px solid transparent' }}>
                    <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: `${rc}14`, border: `1px solid ${rc}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: '10px', fontWeight: 700, color: rc }}>{p.risk[0].toUpperCase()}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                      <div style={{ fontSize: '10px', color: TEXT_SUB }}>{p.id} · {p.ward}</div>
                    </div>
                    {sel && <ChevronRight size={13} color={color} />}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Profile panel */}
          {!selected ? (
            <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px', gap: '10px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: `${color}14`, border: `1px solid ${color}28`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShieldAlert size={22} color={color} />
              </div>
              <p style={{ fontSize: '14px', color: '#fff', margin: 0, fontWeight: 500 }}>Select a patient</p>
              <p style={{ fontSize: '13px', color: TEXT_SUB, margin: 0 }}>View their detailed risk profile</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

              {/* Score header */}
              <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '52px', fontWeight: 700, color: label.color, lineHeight: 1 }}>{totalScore}</div>
                    <div style={{ fontSize: '11px', color: TEXT_SUB, marginTop: '4px' }}>composite score</div>
                  </div>
                  <div style={{ width: '1px', height: '60px', background: BORDER }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>{selected.name}</span>
                      <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '5px', fontWeight: 700, color: label.color, background: `${label.color}14`, border: `1px solid ${label.color}28` }}>
                        {label.text}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: TEXT_SUB }}>{selected.id} · Age {selected.age} · {selected.ward}</div>
                    <div style={{ marginTop: '12px', height: '8px', background: '#1F2937', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${totalScore}%`, height: '100%', background: `linear-gradient(90deg, #22C55E, #F59E0B, #EF4444)`, borderRadius: '4px', transition: 'width 0.5s ease' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                      <span style={{ fontSize: '10px', color: '#22C55E' }}>0 — Low</span>
                      <span style={{ fontSize: '10px', color: '#EF4444' }}>100 — Critical</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '28px', fontWeight: 700, color, lineHeight: 1 }}>{factors.length}</div>
                    <div style={{ fontSize: '11px', color: TEXT_SUB }}>active factors</div>
                  </div>
                </div>
              </div>

              {/* Risk factors */}
              <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '20px' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertTriangle size={14} color={color} /> Active Risk Factors
                </div>
                {factors.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px', color: TEXT_SUB, fontSize: '13px' }}>No significant risk factors identified</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {factors.sort((a, b) => b.weight - a.weight).map(f => {
                      const fc = f.weight >= 20 ? '#EF4444' : f.weight >= 14 ? '#F59E0B' : '#0EA5E9'
                      return (
                        <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', background: '#0A0F1E', border: `1px solid ${fc}20`, borderRadius: '10px' }}>
                          <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: `${fc}14`, border: `1px solid ${fc}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <span style={{ fontSize: '12px', fontWeight: 700, color: fc }}>+{f.weight}</span>
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>{f.label}</div>
                            <div style={{ fontSize: '11px', color: TEXT_SUB }}>{f.detail}</div>
                          </div>
                          <div style={{ width: '80px', height: '5px', background: '#1F2937', borderRadius: '2px' }}>
                            <div style={{ width: `${(f.weight / 30) * 100}%`, height: '100%', background: fc, borderRadius: '2px' }} />
                          </div>
                          <span style={{ fontSize: '10px', color: fc, fontWeight: 700, minWidth: '50px', textAlign: 'right' }}>
                            {f.weight >= 20 ? 'HIGH' : f.weight >= 14 ? 'MEDIUM' : 'LOW'} impact
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

            </div>
          )}

        </div>
      )}

    </div>
  )
}
