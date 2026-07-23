import { useState, useEffect } from 'react'
import { FileText, User, Pill, Activity, Clock, Database, Search, Plus, X } from 'lucide-react'
import {
  useAllPatients, useEHRDiagnoses, useEHRMedications, usePatientEvents, addEHRDiagnosis, addEHRMedication,
  deleteEHRDiagnosis, deleteEHRMedication, ensureVitals, logAudit, createActivity,
} from '../hooks/useClinicalData'
import type { Vitals as RawVitals, Patient } from '../types/clinical'

const COLOR = '#8B5CF6'
const CARD_BG = '#111827'
const BORDER = '#1F2937'
const TEXT_SUB = '#9CA3AF'
const RISK_COLOR: Record<string, string> = { critical: '#EF4444', high: '#F59E0B', medium: '#0EA5E9', low: '#22C55E' }

function vitalsToCards(v: Omit<RawVitals, 'id' | 'recorded_at'>): { label: string; value: string; unit: string; ok: boolean }[] {
  return [
    { label: 'BP', value: `${v.sbp}/${v.dbp}`, unit: 'mmHg', ok: v.sbp <= 140 && v.sbp >= 90 },
    { label: 'HR', value: String(v.hr), unit: 'bpm', ok: v.hr >= 60 && v.hr <= 100 },
    { label: 'SpO₂', value: String(v.spo2), unit: '%', ok: v.spo2 >= 95 },
    { label: 'Temp', value: v.temp.toFixed(1), unit: '°C', ok: v.temp >= 36.1 && v.temp <= 37.2 },
  ]
}

export default function EHRPage() {
  const patients = useAllPatients()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Patient | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [synced, setSynced] = useState(false)

  const diagnosesRaw = useEHRDiagnoses(selected?.id)
  const medicationsRaw = useEHRMedications(selected?.id)
  const events = usePatientEvents(selected?.id)
  const [removedDiagIds, setRemovedDiagIds] = useState<Set<number>>(new Set())
  const [removedMedIds, setRemovedMedIds] = useState<Set<number>>(new Set())
  const diagnoses = diagnosesRaw.filter(d => !removedDiagIds.has(d.id))
  const medications = medicationsRaw.filter(m => !removedMedIds.has(m.id))

  const [rawVitals, setRawVitals] = useState<Omit<RawVitals, 'id' | 'recorded_at'> | null>(null)
  useEffect(() => {
    if (!selected) { setRawVitals(null); return }
    let cancelled = false
    ensureVitals(selected).then(v => { if (!cancelled) setRawVitals(v) })
    return () => { cancelled = true }
  }, [selected?.id])

  const [newDiagCode, setNewDiagCode] = useState('')
  const [newDiagDesc, setNewDiagDesc] = useState('')
  const [newMed, setNewMed] = useState({ name: '', dose: '', route: 'Oral', frequency: 'OD' })

  const addDiagnosis = async () => {
    if (!selected || !newDiagCode.trim() || !newDiagDesc.trim()) return
    await addEHRDiagnosis({ patient_id: selected.id, code: newDiagCode.trim(), description: newDiagDesc.trim() })
    await logAudit({ actor: 'clinician', action: 'create', resource_type: 'ehr_diagnosis', resource_id: newDiagCode.trim(), patient_id: selected.id, detail: `Added diagnosis ${newDiagCode.trim()} — ${newDiagDesc.trim()}` })
    setNewDiagCode(''); setNewDiagDesc('')
  }

  const addMedication = async () => {
    if (!selected || !newMed.name.trim() || !newMed.dose.trim()) return
    await addEHRMedication({ patient_id: selected.id, name: newMed.name.trim(), dose: newMed.dose.trim(), route: newMed.route, frequency: newMed.frequency, active: true })
    await logAudit({ actor: 'clinician', action: 'create', resource_type: 'ehr_medication', resource_id: null, patient_id: selected.id, detail: `Added medication ${newMed.name.trim()} ${newMed.dose.trim()}` })
    setNewMed({ name: '', dose: '', route: 'Oral', frequency: 'OD' })
  }

  const filtered = search.trim()
    ? patients.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.id.toLowerCase().includes(search.toLowerCase()))
    : patients

  async function syncRecord() {
    if (!selected) return
    setSyncing(true)
    await createActivity({
      icon_name: 'Database', color: COLOR,
      label: 'EHR Record Synced',
      detail: `Patient ${selected.id} — full record synchronised`,
      time_ago: 'just now',
    })
    setSyncing(false); setSynced(true)
    setTimeout(() => setSynced(false), 3000)
  }

  const removeDiagnosis = async (id: number) => {
    await deleteEHRDiagnosis(id)
    setRemovedDiagIds(prev => new Set(prev).add(id))
  }

  const removeMedication = async (id: number) => {
    await deleteEHRMedication(id)
    setRemovedMedIds(prev => new Set(prev).add(id))
  }

  const vitals = rawVitals ? vitalsToCards(rawVitals) : []

  return (
    <div style={{ padding: '24px', minHeight: '100%', background: '#0A0F1E' }}>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: `${COLOR}18`, border: `1px solid ${COLOR}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FileText size={20} color={COLOR} />
          </div>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#fff', margin: 0 }}>Electronic Health Record</h1>
            <p style={{ fontSize: '12px', color: TEXT_SUB, margin: 0 }}>Full patient record viewer & sync</p>
          </div>
        </div>
        <span style={{ fontSize: '11px', color: '#22C55E', background: '#22C55E14', padding: '3px 8px', borderRadius: '4px', border: '1px solid #22C55E30' }}>LIVE</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '16px' }}>

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
              const rc = RISK_COLOR[p.risk] ?? COLOR
              return (
                <div key={p.id} onClick={() => setSelected(sel ? null : p)} style={{ padding: '10px 14px', borderBottom: `1px solid ${BORDER}60`, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', background: sel ? `${COLOR}10` : 'transparent', borderLeft: sel ? `3px solid ${COLOR}` : '3px solid transparent' }}>
                  <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: `${rc}14`, border: `1px solid ${rc}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: rc }}>{p.risk[0].toUpperCase()}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                    <div style={{ fontSize: '10px', color: TEXT_SUB }}>{p.id} · {p.ward}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {!selected ? (
          <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px', gap: '10px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: `${COLOR}14`, border: `1px solid ${COLOR}28`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileText size={22} color={COLOR} />
            </div>
            <p style={{ fontSize: '14px', color: '#fff', margin: 0, fontWeight: 500 }}>Select a patient</p>
            <p style={{ fontSize: '13px', color: TEXT_SUB, margin: 0 }}>Choose a patient to view their full EHR</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

            <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ width: '46px', height: '46px', borderRadius: '50%', background: `${RISK_COLOR[selected.risk] ?? COLOR}18`, border: `2px solid ${RISK_COLOR[selected.risk] ?? COLOR}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <User size={20} color={RISK_COLOR[selected.risk] ?? COLOR} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#fff' }}>{selected.name}</div>
                  <div style={{ fontSize: '12px', color: TEXT_SUB }}>{selected.id} · Age {selected.age} · {selected.ward} · {selected.status}</div>
                </div>
                <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '5px', fontWeight: 700, color: RISK_COLOR[selected.risk] ?? COLOR, background: `${RISK_COLOR[selected.risk] ?? COLOR}14`, border: `1px solid ${RISK_COLOR[selected.risk] ?? COLOR}28` }}>
                  {selected.risk.toUpperCase()} RISK
                </span>
                <button onClick={syncRecord} disabled={syncing} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '8px', border: `1px solid ${synced ? '#22C55E40' : COLOR + '40'}`, background: synced ? '#22C55E18' : `${COLOR}18`, color: synced ? '#22C55E' : COLOR, fontSize: '12px', fontWeight: 600, cursor: syncing ? 'wait' : 'pointer' }}>
                  <Database size={12} />{synced ? 'Synced!' : syncing ? 'Syncing…' : 'Sync Record'}
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>

              <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                  <Activity size={15} color={COLOR} />
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>Current Vitals</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {vitals.map(v => (
                    <div key={v.label} style={{ background: '#0A0F1E', border: `1px solid ${BORDER}`, borderRadius: '8px', padding: '10px 12px' }}>
                      <div style={{ fontSize: '10px', color: TEXT_SUB, marginBottom: '3px' }}>{v.label}</div>
                      <div style={{ fontSize: '20px', fontWeight: 700, color: v.ok ? '#22C55E' : '#F59E0B', lineHeight: 1 }}>{v.value}</div>
                      <div style={{ fontSize: '10px', color: '#4B5563' }}>{v.unit}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                  <FileText size={15} color={COLOR} />
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>Active Diagnoses</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px' }}>
                  {diagnoses.length === 0 ? (
                    <div style={{ fontSize: '12px', color: TEXT_SUB, padding: '8px 0' }}>No diagnoses recorded yet</div>
                  ) : diagnoses.map(d => (
                    <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', background: '#0A0F1E', border: `1px solid ${BORDER}`, borderRadius: '8px' }}>
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#EF4444', flexShrink: 0 }} />
                      <span style={{ fontSize: '12px', color: '#fff', flex: 1 }}>{d.description} ({d.code})</span>
                      <button onClick={() => removeDiagnosis(d.id)} title="Remove diagnosis" style={{ background: 'transparent', border: 'none', color: '#6B7280', cursor: 'pointer', flexShrink: 0 }}><X size={12} /></button>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input value={newDiagCode} onChange={e => setNewDiagCode(e.target.value)} placeholder="Code" style={{ width: '70px', background: '#0A0F1E', border: `1px solid ${BORDER}`, borderRadius: '6px', padding: '6px 8px', color: '#fff', fontSize: '11px', outline: 'none' }} />
                  <input value={newDiagDesc} onChange={e => setNewDiagDesc(e.target.value)} placeholder="Description" style={{ flex: 1, background: '#0A0F1E', border: `1px solid ${BORDER}`, borderRadius: '6px', padding: '6px 8px', color: '#fff', fontSize: '11px', outline: 'none' }} />
                  <button onClick={addDiagnosis} disabled={!newDiagCode.trim() || !newDiagDesc.trim()} style={{ background: `${COLOR}18`, border: `1px solid ${COLOR}40`, borderRadius: '6px', padding: '6px 10px', color: COLOR, cursor: 'pointer' }}><Plus size={12} /></button>
                </div>
              </div>

              <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '16px', gridColumn: '1 / -1' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                  <Pill size={15} color={COLOR} />
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>Current Medications</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '10px' }}>
                  {medications.filter(m => m.active).length === 0 ? (
                    <div style={{ fontSize: '12px', color: TEXT_SUB, gridColumn: '1 / -1' }}>No active medications recorded yet</div>
                  ) : medications.filter(m => m.active).map(m => (
                    <div key={m.id} style={{ padding: '10px 12px', background: '#0A0F1E', border: `1px solid ${COLOR}20`, borderRadius: '8px', position: 'relative' }}>
                      <button onClick={() => removeMedication(m.id)} title="Remove medication" style={{ position: 'absolute', top: '6px', right: '6px', background: 'transparent', border: 'none', color: '#6B7280', cursor: 'pointer' }}><X size={11} /></button>
                      <div style={{ fontSize: '12px', color: '#fff', fontWeight: 600, paddingRight: '14px' }}>{m.name}</div>
                      <div style={{ fontSize: '11px', color: TEXT_SUB }}>{m.dose} · {m.route} · {m.frequency}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input value={newMed.name} onChange={e => setNewMed(v => ({ ...v, name: e.target.value }))} placeholder="Drug" style={{ flex: 1, background: '#0A0F1E', border: `1px solid ${BORDER}`, borderRadius: '6px', padding: '6px 8px', color: '#fff', fontSize: '11px', outline: 'none' }} />
                  <input value={newMed.dose} onChange={e => setNewMed(v => ({ ...v, dose: e.target.value }))} placeholder="Dose" style={{ width: '80px', background: '#0A0F1E', border: `1px solid ${BORDER}`, borderRadius: '6px', padding: '6px 8px', color: '#fff', fontSize: '11px', outline: 'none' }} />
                  <input value={newMed.frequency} onChange={e => setNewMed(v => ({ ...v, frequency: e.target.value }))} placeholder="Freq" style={{ width: '60px', background: '#0A0F1E', border: `1px solid ${BORDER}`, borderRadius: '6px', padding: '6px 8px', color: '#fff', fontSize: '11px', outline: 'none' }} />
                  <button onClick={addMedication} disabled={!newMed.name.trim() || !newMed.dose.trim()} style={{ background: `${COLOR}18`, border: `1px solid ${COLOR}40`, borderRadius: '6px', padding: '6px 10px', color: COLOR, cursor: 'pointer' }}><Plus size={12} /></button>
                </div>
              </div>

            </div>

            <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <Clock size={15} color={COLOR} />
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>Visit History</span>
                <span style={{ fontSize: '9px', padding: '1px 6px', borderRadius: '4px', background: `${COLOR}14`, color: COLOR, border: `1px solid ${COLOR}28` }}>from Patient Timeline</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {events.length === 0 ? (
                  <div style={{ fontSize: '12px', color: TEXT_SUB, padding: '8px 0' }}>No recorded events for this patient</div>
                ) : events.slice(0, 6).map(v => (
                  <div key={v.id} style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', padding: '10px 12px', background: '#0A0F1E', border: `1px solid ${BORDER}`, borderRadius: '8px' }}>
                    <div style={{ minWidth: '90px', fontSize: '11px', color: TEXT_SUB, paddingTop: '1px' }}>{new Date(v.occurred_at).toLocaleDateString()}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#fff' }}>{v.label}</div>
                      <div style={{ fontSize: '11px', color: TEXT_SUB }}>{v.source}</div>
                      <div style={{ fontSize: '11px', color: '#4B5563', marginTop: '2px' }}>{v.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  )
}
