import { useState } from 'react'
import { usePatientContext } from '../context/PatientContext'
import { Pill, Printer, Plus, Check, AlertTriangle, Search, X } from 'lucide-react'
import {
  useAllPatients, useEHRMedications, useDoctors, useDoctorAssignments, addPrescription, logAudit,
  useAllergies, useDrugFormulary, usePrescriptions, deletePrescription, createActivity,
} from '../hooks/useClinicalData'
import { BACKEND_URL } from '../lib/backend'

const COLOR = '#22C55E'
const CARD_BG = '#111827'
const BORDER = '#1F2937'
const TEXT_SUB = '#9CA3AF'
const RISK_COLOR: Record<string, string> = { critical: '#EF4444', high: '#F59E0B', medium: '#0EA5E9', low: '#22C55E' }

type ValidationWarning = { severity: string; message: string }

export default function PrescriptionPage() {
  const patients = useAllPatients()
  const { selectedPatient: selected, setSelectedPatient: setSelected } = usePatientContext()
  const doctors = useDoctors()
  const doctorAssignments = useDoctorAssignments()
  const currentMedRows = useEHRMedications(selected?.id)
  const allergyRows = useAllergies(selected?.id)
  const formulary = useDrugFormulary()
  const prescriptions = usePrescriptions(selected?.id)
  const [search, setSearch] = useState('')
  const [drug, setDrug] = useState('')
  const [dose, setDose] = useState('')
  const [route, setRoute] = useState('Oral')
  const [freq, setFreq] = useState('Once daily (OD)')
  const [duration, setDuration] = useState('7 days')
  const [noteText, setNoteText] = useState('')
  const [issuing, setIssuing] = useState(false)
  const [issued, setIssued] = useState(false)
  const [warnings, setWarnings] = useState<ValidationWarning[] | null>(null)
  const [validating, setValidating] = useState(false)
  const [removedIds, setRemovedIds] = useState<Set<number>>(new Set())
  const [sessionAdditions, setSessionAdditions] = useState<typeof prescriptions>([])

  const visiblePrescriptions = [
    ...sessionAdditions.filter(p => p.patient_id === selected?.id && !removedIds.has(p.id)),
    ...prescriptions.filter(p => !removedIds.has(p.id) && !sessionAdditions.some(sp => sp.id === p.id)),
  ]

  const filtered = search.trim()
    ? patients.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.id.toLowerCase().includes(search.toLowerCase()))
    : patients

  const currentMeds = currentMedRows.filter(m => m.active).map(m => `${m.name} ${m.dose} — ${m.frequency} ${m.route}`)
  const assignedDoctorId = selected ? doctorAssignments.find(a => a.patient_id === selected.id)?.doctor_id : undefined
  const doctor = doctors.find(d => d.id === assignedDoctorId)?.name ?? 'Unassigned — see Doctor Assignment'
  const hasAllergyRisk = allergyRows.some(a => a.severity === 'severe')

  async function issuePrescription() {
    if (!selected || !drug.trim() || !dose.trim() || issuing) return
    setIssuing(true)
    setValidating(true)
    let result: { warnings: ValidationWarning[]; severity: string } = { warnings: [], severity: 'none' }
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/prescription/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drug, dose, route, frequency: freq, patient_meds: currentMedRows.filter(m => m.active).map(m => m.name), patient_age: selected.age }),
        signal: AbortSignal.timeout(8000),
      })
      if (res.ok) result = await res.json()
    } catch { /* proceed without warnings if backend unavailable */ }
    setValidating(false)
    setWarnings(result.warnings)

    const created = await addPrescription({ patient_id: selected.id, drug, dose, route, frequency: freq, duration, prescriber: doctor, warnings: result.warnings })
    setSessionAdditions(prev => [created, ...prev])
    await logAudit({ actor: doctor, action: 'create', resource_type: 'prescription', resource_id: null, patient_id: selected.id, detail: `Issued ${drug} ${dose} — ${freq} ${route}` })
    await createActivity({
      icon_name: 'CheckCircle2', color: COLOR,
      label: 'Prescription Issued',
      detail: `${drug} ${dose} — ${selected.name} (${selected.id})`,
      time_ago: 'just now',
    })
    setIssued(true)
    setIssuing(false)
    setTimeout(() => setIssued(false), 3000)
  }

  async function discontinuePrescription(id: number) {
    await deletePrescription(id)
    setRemovedIds(prev => new Set(prev).add(id))
  }

  const inputStyle = (active?: boolean): React.CSSProperties => ({
    width: '100%', background: '#0A0F1E',
    border: `1px solid ${active ? COLOR + '60' : BORDER}`,
    borderRadius: '7px', color: '#fff', fontSize: '12px',
    padding: '8px 10px', outline: 'none', boxSizing: 'border-box',
  })

  return (
    <div style={{ padding: '24px', minHeight: '100%', background: '#0A0F1E' }}>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: `${COLOR}18`, border: `1px solid ${COLOR}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Pill size={20} color={COLOR} />
          </div>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#fff', margin: 0 }}>Medical Prescription</h1>
            <p style={{ fontSize: '12px', color: TEXT_SUB, margin: 0 }}>Issue and manage patient prescriptions</p>
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
              return (
                <div key={p.id} onClick={() => { setSelected(sel ? null : p); setDrug(''); setDose(''); setIssued(false) }}
                  style={{ padding: '10px 12px', borderBottom: `1px solid ${BORDER}60`, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', background: sel ? `${COLOR}10` : 'transparent', borderLeft: sel ? `3px solid ${COLOR}` : '3px solid transparent' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: `${rc}14`, border: `1px solid ${rc}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: '9px', fontWeight: 700, color: rc }}>{p.risk[0].toUpperCase()}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                    <div style={{ fontSize: '10px', color: TEXT_SUB }}>{p.id}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right panel */}
        {!selected ? (
          <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px', flexDirection: 'column', gap: '10px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: `${COLOR}14`, border: `1px solid ${COLOR}28`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Pill size={22} color={COLOR} />
            </div>
            <p style={{ fontSize: '14px', color: '#fff', margin: 0, fontWeight: 500 }}>Select a patient</p>
            <p style={{ fontSize: '13px', color: TEXT_SUB, margin: 0 }}>Choose a patient to issue a prescription</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

            {/* Patient banner */}
            <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '9px', background: `${RISK_COLOR[selected.risk]}14`, border: `1px solid ${RISK_COLOR[selected.risk]}28`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: '14px', color: RISK_COLOR[selected.risk] }}>{selected.name[0]}</span>
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>{selected.name}</div>
                  <div style={{ fontSize: '11px', color: TEXT_SUB }}>{selected.id} · Age {selected.age} · {selected.ward}</div>
                </div>
                <span style={{ marginLeft: 'auto', fontSize: '10px', padding: '2px 8px', borderRadius: '4px', background: `${RISK_COLOR[selected.risk]}14`, color: RISK_COLOR[selected.risk], border: `1px solid ${RISK_COLOR[selected.risk]}28`, fontWeight: 700 }}>
                  {selected.risk.toUpperCase()}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ background: '#0A0F1E', border: `1px solid ${hasAllergyRisk ? '#EF444430' : BORDER}`, borderRadius: '8px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '10px', color: '#EF4444', fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <AlertTriangle size={10} /> Allergies
                  </div>
                  {allergyRows.map(a => (
                    <div key={a.id} style={{ fontSize: '11px', color: a.severity === 'severe' ? '#EF4444' : '#E5E7EB', marginBottom: '2px' }}>
                      {a.allergen} — {a.reaction}{a.severity === 'severe' ? ' ⚠' : ''}
                    </div>
                  ))}
                </div>
                <div style={{ background: '#0A0F1E', border: `1px solid ${BORDER}`, borderRadius: '8px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '10px', color: TEXT_SUB, fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase' }}>Current Medications</div>
                  {currentMeds.map((m, i) => (
                    <div key={i} style={{ fontSize: '11px', color: '#E5E7EB', marginBottom: '2px' }}>{m}</div>
                  ))}
                </div>
              </div>
            </div>

            {/* Prescription form */}
            <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '18px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Plus size={14} color={COLOR} /> New Prescription
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ fontSize: '10px', color: TEXT_SUB, fontWeight: 600, display: 'block', marginBottom: '5px', textTransform: 'uppercase' }}>Drug *</label>
                  <input list="drug-list" value={drug} onChange={e => setDrug(e.target.value)} placeholder="e.g. Amoxicillin 500mg"
                    style={inputStyle(!!drug)} />
                  <datalist id="drug-list">{formulary.drugs.map(d => <option key={d} value={d} />)}</datalist>
                </div>
                <div>
                  <label style={{ fontSize: '10px', color: TEXT_SUB, fontWeight: 600, display: 'block', marginBottom: '5px', textTransform: 'uppercase' }}>Dose *</label>
                  <input value={dose} onChange={e => setDose(e.target.value)} placeholder="e.g. 500mg"
                    style={inputStyle(!!dose)} />
                </div>
                <div>
                  <label style={{ fontSize: '10px', color: TEXT_SUB, fontWeight: 600, display: 'block', marginBottom: '5px', textTransform: 'uppercase' }}>Route</label>
                  <select value={route} onChange={e => setRoute(e.target.value)} style={inputStyle()}>
                    {formulary.routes.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '10px', color: TEXT_SUB, fontWeight: 600, display: 'block', marginBottom: '5px', textTransform: 'uppercase' }}>Frequency</label>
                  <select value={freq} onChange={e => setFreq(e.target.value)} style={inputStyle()}>
                    {formulary.frequencies.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '10px', color: TEXT_SUB, fontWeight: 600, display: 'block', marginBottom: '5px', textTransform: 'uppercase' }}>Duration</label>
                  <select value={duration} onChange={e => setDuration(e.target.value)} style={inputStyle()}>
                    {formulary.durations.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '10px', color: TEXT_SUB, fontWeight: 600, display: 'block', marginBottom: '5px', textTransform: 'uppercase' }}>Prescribing Doctor</label>
                  <div style={{ fontSize: '12px', color: '#E5E7EB', padding: '8px 10px', background: '#0A0F1E', border: `1px solid ${BORDER}`, borderRadius: '7px' }}>{doctor}</div>
                </div>
              </div>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '10px', color: TEXT_SUB, fontWeight: 600, display: 'block', marginBottom: '5px', textTransform: 'uppercase' }}>Clinical Notes</label>
                <textarea value={noteText} onChange={e => setNoteText(e.target.value)} rows={2}
                  placeholder="Additional instructions, clinical context or special instructions…"
                  style={{ ...inputStyle(), resize: 'none' as const, lineHeight: 1.6 }} />
              </div>
              {validating && (
                <div style={{ fontSize: '12px', color: TEXT_SUB, marginBottom: '12px' }}>Checking interactions &amp; dosing rules…</div>
              )}
              {warnings && warnings.length > 0 && (
                <div style={{ marginBottom: '14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {warnings.map((w, i) => {
                    const c = w.severity === 'critical' ? '#EF4444' : w.severity === 'high' ? '#F59E0B' : '#0EA5E9'
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '8px 10px', background: `${c}10`, border: `1px solid ${c}30`, borderRadius: '8px' }}>
                        <AlertTriangle size={12} color={c} style={{ flexShrink: 0, marginTop: '2px' }} />
                        <span style={{ fontSize: '11px', color: '#E5E7EB' }}>{w.message}</span>
                      </div>
                    )
                  })}
                </div>
              )}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button onClick={() => window.print()}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '7px', border: `1px solid ${BORDER}`, background: 'transparent', color: TEXT_SUB, fontSize: '12px', cursor: 'pointer' }}>
                  <Printer size={13} /> Print
                </button>
                <button onClick={issuePrescription} disabled={issuing || !drug.trim() || !dose.trim()}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 18px', borderRadius: '7px', border: `1px solid ${issued ? '#22C55E40' : COLOR + '40'}`, background: issued ? '#22C55E18' : `${COLOR}18`, color: issued ? '#22C55E' : COLOR, fontSize: '12px', fontWeight: 600, cursor: issuing || !drug.trim() || !dose.trim() ? 'not-allowed' : 'pointer' }}>
                  {issued ? <Check size={13} /> : <Pill size={13} />}
                  {issuing ? 'Issuing…' : issued ? 'Prescription Issued!' : 'Issue Prescription'}
                </button>
              </div>
            </div>

            {/* Recent prescriptions */}
            <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: `1px solid ${BORDER}`, fontSize: '13px', fontWeight: 600, color: '#fff' }}>
                Prescriptions on Record
              </div>
              {visiblePrescriptions.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: TEXT_SUB, fontSize: '12px' }}>No prescriptions issued for this patient yet.</div>
              ) : (
                visiblePrescriptions.map(rx => (
                  <div key={rx.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: `1px solid ${BORDER}40` }}>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#fff' }}>{rx.drug} {rx.dose}</div>
                      <div style={{ fontSize: '11px', color: TEXT_SUB }}>{rx.frequency} · {rx.route} · {rx.duration} · {rx.prescriber}</div>
                    </div>
                    <button onClick={() => discontinuePrescription(rx.id)} title="Discontinue prescription" style={{
                      display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '6px',
                      border: '1px solid #EF444430', background: '#EF444414', color: '#EF4444', fontSize: '11px', cursor: 'pointer',
                    }}>
                      <X size={11} /> Discontinue
                    </button>
                  </div>
                ))
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  )
}
