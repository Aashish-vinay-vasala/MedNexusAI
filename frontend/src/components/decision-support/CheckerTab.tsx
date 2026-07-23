import { useState } from 'react'
import { AlertTriangle, CheckCircle2, X, Clock, Plus, ListChecks } from 'lucide-react'
import { useAlerts, useAllPatients, createAlert } from '../../hooks/useClinicalData'
import { checkInteraction, runDecisionSupportCheck, type InteractionCheckResult } from '../../hooks/useDecisionSupportData'
import type { DrugInteraction } from '../../types/clinical'
import { CARD_BG, BORDER, TEXT_SUB, SEVERITY_COLOR, SOURCE_LABEL, COMMON_DRUGS } from './shared'
import { ErrorBanner } from '../clinical-nlp-text/TextBits'

const COLOR = '#F59E0B'

const CLINICAL_RULES = [
  { id: 1, title: 'Sepsis 6 Bundle',        desc: 'Administer within 1h of qSOFA ≥ 2: blood cultures, antibiotics, lactate, IV fluids, O2, urine output monitoring.', status: 'active',   color: '#EF4444' },
  { id: 2, title: 'VTE Prophylaxis',        desc: 'All admitted patients risk-stratified using Caprini score. Mechanical or pharmacological prophylaxis where indicated.',status: 'active',   color: COLOR     },
  { id: 3, title: 'Acute Kidney Injury',    desc: 'AKI alert triggered on creatinine rise ≥ 1.5× baseline. Review nephrotoxic drugs, IV fluids, urinary catheterisation.',status: 'active',   color: '#0EA5E9' },
  { id: 4, title: 'Falls Prevention',       desc: 'Patients with Morse Falls score ≥ 25 flagged. Bed rails, non-slip footwear, bed alarms, call bell within reach.',    status: 'active',   color: '#8B5CF6' },
  { id: 5, title: 'Pressure Injury',        desc: 'Braden scale < 18 triggers repositioning care plan every 2 hours. Foam mattress overlay for score < 13.',            status: 'active',   color: '#22C55E' },
  { id: 6, title: 'Deteriorating Patient',  desc: 'NEWS2 ≥ 7 or single parameter extreme triggers immediate escalation to registrar and ICU outreach.',                 status: 'review',   color: '#F59E0B' },
]

export default function CheckerTab({ deviceId, onRunComplete }: { deviceId: string; onRunComplete: () => void }) {
  const { alerts, acknowledge, unsetAlert } = useAlerts()
  const patients = useAllPatients()
  const dsAlerts = alerts.filter(a =>
    a.category === 'decision_support' || a.source === 'Decision Support' || a.type.toLowerCase().includes('drug') || a.type.toLowerCase().includes('interaction')
  )

  // ─── Pairwise checker ───────────────────────────────────────────────────
  const [drugA, setDrugA] = useState('')
  const [drugB, setDrugB] = useState('')
  const [patientId, setPatientId] = useState('')
  const [checkResult, setCheckResult] = useState<InteractionCheckResult | null>(null)
  const [checking, setChecking] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [flagged, setFlagged] = useState(false)

  const handleCheck = async () => {
    if (!drugA.trim() || !drugB.trim() || checking) return
    setChecking(true); setFlagged(false)
    const result = await checkInteraction(drugA, drugB)
    setCheckResult(result)
    setChecking(false)
    if (result) {
      const matchedPatient = patients.find(p => p.id.replace(/\D/g, '') === patientId.trim()) ?? null
      try {
        await runDecisionSupportCheck({
          device_id: deviceId, mode: 'pairwise', drug_a: drugA, drug_b: drugB,
          patient_id: matchedPatient?.id ?? null, patient_name: matchedPatient?.name ?? null,
        })
        onRunComplete()
      } catch { /* history save is best-effort — the check result above still displays */ }
    }
  }

  const handleFlagInteraction = async () => {
    if (!checkResult?.interacts || !checkResult.severity || !patientId.trim()) return
    setSubmitting(true)
    const matchedPatient = patients.find(p => p.id.replace(/\D/g, '') === patientId.trim()) ?? null
    await createAlert({
      type: 'Drug Interaction',
      patient: `Patient #${patientId.trim()}`,
      patient_id: matchedPatient?.id,
      category: 'decision_support',
      detail: `${drugA} + ${drugB} conflict flagged`,
      time_ago: 'just now',
      severity: checkResult.severity,
      color: SEVERITY_COLOR[checkResult.severity],
      source: 'Decision Support',
      acknowledged: false,
      escalated: false,
    })
    setSubmitting(false)
    setFlagged(true)
  }

  const interactionFound = Boolean(checkResult?.interacts)

  // ─── Regimen checker ────────────────────────────────────────────────────
  const [regimenDrugs, setRegimenDrugs] = useState<string[]>([])
  const [regimenInput, setRegimenInput] = useState('')
  const [regimenResult, setRegimenResult] = useState<DrugInteraction[] | null>(null)
  const [regimenChecking, setRegimenChecking] = useState(false)
  const [regimenError, setRegimenError] = useState<string | null>(null)

  function addRegimenDrug() {
    const name = regimenInput.trim()
    if (!name || regimenDrugs.some(d => d.toLowerCase() === name.toLowerCase())) return
    setRegimenDrugs(prev => [...prev, name])
    setRegimenInput('')
    setRegimenResult(null); setRegimenError(null)
  }

  function removeRegimenDrug(name: string) {
    setRegimenDrugs(prev => prev.filter(d => d !== name))
    setRegimenResult(null); setRegimenError(null)
  }

  async function handleRegimenCheck() {
    if (regimenDrugs.length < 2 || regimenChecking) return
    setRegimenChecking(true); setRegimenError(null)
    try {
      const record = await runDecisionSupportCheck({ device_id: deviceId, mode: 'regimen', drugs: regimenDrugs })
      setRegimenResult(record.interactions)
      onRunComplete()
    } catch {
      setRegimenResult(null)
      setRegimenError('Backend unavailable — could not check this regimen. Confirm the FastAPI server is running.')
    } finally {
      setRegimenChecking(false)
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '16px' }}>

      {/* Left column */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Drug Interaction Checker (pairwise) */}
        <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '20px' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#fff', margin: '0 0 16px' }}>Drug Interaction Checker</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            {([
              { label: 'Drug A', value: drugA, set: setDrugA, placeholder: 'e.g. Warfarin' },
              { label: 'Drug B', value: drugB, set: setDrugB, placeholder: 'e.g. Aspirin' },
            ] as const).map(f => (
              <div key={f.label}>
                <label style={{ fontSize: '12px', color: TEXT_SUB, display: 'block', marginBottom: '6px' }}>{f.label}</label>
                <input
                  value={f.value}
                  onChange={e => f.set(e.target.value)}
                  placeholder={f.placeholder}
                  list="drug-list"
                  style={{
                    width: '100%', background: '#0A0F1E', border: `1px solid ${BORDER}`,
                    borderRadius: '8px', padding: '8px 12px', color: '#fff',
                    fontSize: '13px', outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
            ))}
          </div>
          <datalist id="drug-list">
            {COMMON_DRUGS.map(d => <option key={d} value={d} />)}
          </datalist>
          <button onClick={handleCheck} disabled={!drugA.trim() || !drugB.trim() || checking} style={{
            background: COLOR, border: 'none', borderRadius: '8px', padding: '9px 18px',
            color: '#000', fontSize: '13px', fontWeight: 600, cursor: checking ? 'wait' : 'pointer',
            opacity: !drugA.trim() || !drugB.trim() ? 0.45 : 1, marginBottom: '14px',
          }}>
            {checking ? 'Checking…' : 'Check Interaction'}
          </button>

          {checkResult !== null && (
            <div style={{
              padding: '14px', borderRadius: '10px',
              background: interactionFound ? `${SEVERITY_COLOR[checkResult.severity ?? 'medium']}10` : '#22C55E10',
              border: `1px solid ${interactionFound ? SEVERITY_COLOR[checkResult.severity ?? 'medium'] : '#22C55E'}30`,
            }}>
              {interactionFound ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                    <AlertTriangle size={15} color={SEVERITY_COLOR[checkResult.severity ?? 'medium']} />
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>
                      Interaction Found — {(checkResult.severity ?? '').toUpperCase()}
                    </span>
                    {checkResult.source && (
                      <span style={{ fontSize: '10px', color: TEXT_SUB, border: `1px solid ${BORDER}`, borderRadius: '4px', padding: '1px 6px' }}>
                        {SOURCE_LABEL[checkResult.source]}
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: '13px', color: TEXT_SUB, margin: '0 0 12px' }}>
                    {checkResult.effect}{checkResult.mechanism ? ` (${checkResult.mechanism})` : ''}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input
                      value={patientId}
                      onChange={e => setPatientId(e.target.value)}
                      placeholder="Patient ID to flag"
                      style={{
                        flex: 1, background: '#0A0F1E', border: `1px solid ${BORDER}`,
                        borderRadius: '8px', padding: '7px 10px', color: '#fff',
                        fontSize: '12px', outline: 'none',
                      }}
                    />
                    <button onClick={handleFlagInteraction} disabled={!patientId.trim() || submitting || flagged} style={{
                      background: flagged ? '#22C55E' : '#EF4444', border: 'none', borderRadius: '8px',
                      padding: '7px 14px', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                      opacity: !patientId.trim() ? 0.45 : 1,
                    }}>
                      {flagged ? '✓ Flagged' : submitting ? 'Flagging…' : 'Flag Alert'}
                    </button>
                  </div>
                </>
              ) : checkResult.source === 'unverified' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertTriangle size={15} color="#F59E0B" />
                  <span style={{ fontSize: '13px', color: '#F59E0B', fontWeight: 600 }}>
                    {drugA} and/or {drugB} not found in FDA database — unable to verify, check manually
                  </span>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <CheckCircle2 size={15} color="#22C55E" />
                  <span style={{ fontSize: '13px', color: '#22C55E', fontWeight: 600 }}>
                    No known interaction between {drugA} and {drugB}
                  </span>
                  {checkResult.source && (
                    <span style={{ fontSize: '10px', color: TEXT_SUB, border: `1px solid ${BORDER}`, borderRadius: '4px', padding: '1px 6px' }}>
                      {SOURCE_LABEL[checkResult.source]}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Regimen Checker (multi-drug) */}
        <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px' }}>
            <ListChecks size={14} color={COLOR} />
            <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#fff', margin: 0 }}>Medication Regimen Checker</h2>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <input
              value={regimenInput}
              onChange={e => setRegimenInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addRegimenDrug() } }}
              placeholder="Add a drug to the regimen…"
              list="drug-list"
              style={{
                flex: 1, background: '#0A0F1E', border: `1px solid ${BORDER}`,
                borderRadius: '8px', padding: '8px 12px', color: '#fff',
                fontSize: '13px', outline: 'none', boxSizing: 'border-box',
              }}
            />
            <button onClick={addRegimenDrug} disabled={!regimenInput.trim()} style={{
              display: 'flex', alignItems: 'center', gap: '4px', background: `${COLOR}18`, border: `1px solid ${COLOR}40`,
              borderRadius: '8px', padding: '8px 12px', color: COLOR, fontSize: '12px', fontWeight: 600,
              cursor: !regimenInput.trim() ? 'not-allowed' : 'pointer', opacity: !regimenInput.trim() ? 0.5 : 1,
            }}>
              <Plus size={13} /> Add
            </button>
          </div>

          {regimenDrugs.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
              {regimenDrugs.map(d => (
                <span key={d} style={{
                  display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', padding: '4px 8px',
                  borderRadius: '6px', background: '#0EA5E914', color: '#0EA5E9', border: '1px solid #0EA5E928',
                }}>
                  {d}
                  <X size={11} style={{ cursor: 'pointer' }} onClick={() => removeRegimenDrug(d)} />
                </span>
              ))}
            </div>
          )}

          <button onClick={handleRegimenCheck} disabled={regimenDrugs.length < 2 || regimenChecking} style={{
            background: COLOR, border: 'none', borderRadius: '8px', padding: '9px 18px',
            color: '#000', fontSize: '13px', fontWeight: 600, cursor: regimenChecking ? 'wait' : 'pointer',
            opacity: regimenDrugs.length < 2 ? 0.45 : 1, marginBottom: '14px',
          }}>
            {regimenChecking ? 'Checking…' : `Check Regimen (${regimenDrugs.length} drugs)`}
          </button>

          {regimenError && <ErrorBanner message={regimenError} />}

          {regimenResult !== null && (
            regimenResult.length === 0 ? (
              <div style={{ padding: '14px', borderRadius: '10px', background: '#22C55E10', border: '1px solid #22C55E30', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={15} color="#22C55E" />
                <span style={{ fontSize: '13px', color: '#22C55E', fontWeight: 600 }}>No known interactions found across this regimen</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {regimenResult.map((r, i) => {
                  const c = SEVERITY_COLOR[r.severity ?? 'medium']
                  return (
                    <div key={i} style={{ padding: '12px', borderRadius: '8px', background: `${c}10`, border: `1px solid ${c}30` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <AlertTriangle size={13} color={c} />
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#fff' }}>{r.drug_a} + {r.drug_b}</span>
                        <span style={{ fontSize: '10px', fontWeight: 700, color: c }}>{(r.severity ?? '').toUpperCase()}</span>
                      </div>
                      <p style={{ fontSize: '12px', color: TEXT_SUB, margin: 0 }}>{r.effect}{r.mechanism ? ` (${r.mechanism})` : ''}</p>
                    </div>
                  )
                })}
              </div>
            )
          )}
        </div>

        {/* Clinical Rules */}
        <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${BORDER}` }}>
            <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#fff', margin: 0 }}>Clinical Decision Rules</h2>
            <p style={{ fontSize: '12px', color: TEXT_SUB, margin: 0 }}>Active rule set</p>
          </div>
          {CLINICAL_RULES.map(rule => (
            <div key={rule.id} style={{
              padding: '14px 20px', borderBottom: `1px solid ${BORDER}60`,
              borderLeft: `3px solid ${rule.color}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>{rule.title}</span>
                <span style={{
                  fontSize: '10px', padding: '1px 6px', borderRadius: '4px', fontWeight: 600,
                  color: rule.status === 'active' ? '#22C55E' : '#F59E0B',
                  background: rule.status === 'active' ? '#22C55E14' : '#F59E0B14',
                }}>{rule.status.toUpperCase()}</span>
              </div>
              <p style={{ fontSize: '12px', color: TEXT_SUB, margin: 0, lineHeight: 1.5 }}>{rule.desc}</p>
            </div>
          ))}
        </div>

      </div>

      {/* Right: Decision Support Alerts */}
      <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', overflow: 'hidden', alignSelf: 'start' }}>
        <div style={{ padding: '14px 16px', borderBottom: `1px solid ${BORDER}` }}>
          <h3 style={{ fontSize: '13px', fontWeight: 600, color: '#fff', margin: 0 }}>Decision Alerts</h3>
          <p style={{ fontSize: '11px', color: TEXT_SUB, margin: 0 }}>
            {dsAlerts.filter(a => !a.acknowledged).length} unacknowledged
          </p>
        </div>
        {dsAlerts.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: TEXT_SUB, fontSize: '12px' }}>
            No decision support alerts
          </div>
        ) : (
          <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
            {dsAlerts.map(alert => {
              const c = SEVERITY_COLOR[alert.severity] ?? '#9CA3AF'
              return (
                <div key={alert.id} style={{
                  padding: '12px 16px', borderBottom: `1px solid ${BORDER}60`,
                  background: alert.acknowledged ? '#22C55E06' : 'transparent',
                  borderLeft: `3px solid ${alert.acknowledged ? '#22C55E' : c}`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: '6px', marginBottom: '3px', alignItems: 'center' }}>
                        <span style={{
                          fontSize: '10px', fontWeight: 700, padding: '1px 5px', borderRadius: '3px',
                          color: c, background: `${c}14`, border: `1px solid ${c}28`,
                        }}>{alert.severity.toUpperCase()}</span>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#fff' }}>{alert.type}</span>
                      </div>
                      <div style={{ fontSize: '11px', color: TEXT_SUB }}>{alert.patient}</div>
                      <div style={{ fontSize: '11px', color: '#4B5563' }}>{alert.detail}</div>
                      <div style={{ fontSize: '10px', color: '#374151', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <Clock size={9} />{alert.time_ago}
                        {alert.acknowledged && <span style={{ color: '#22C55E', marginLeft: '6px' }}>✓ Acknowledged</span>}
                      </div>
                    </div>
                    {!alert.acknowledged ? (
                      <button onClick={() => acknowledge(alert.id)} style={{
                        background: '#22C55E14', border: '1px solid #22C55E30', borderRadius: '5px',
                        padding: '4px 8px', cursor: 'pointer', color: '#22C55E', fontSize: '10px', fontWeight: 600, flexShrink: 0,
                      }}>ACK</button>
                    ) : (
                      <button onClick={() => unsetAlert(alert.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4B5563' }}>
                        <X size={13} />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

    </div>
  )
}
