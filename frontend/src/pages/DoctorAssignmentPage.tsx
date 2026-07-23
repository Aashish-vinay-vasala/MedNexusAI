import { useState } from 'react'
import { UserCheck, Users, CheckCircle2, RefreshCw, Sparkles } from 'lucide-react'
import { useAllPatients, useDoctors, useDoctorAssignments, saveDoctorAssignments, createActivity } from '../hooks/useClinicalData'
import { BACKEND_URL } from '../lib/backend'
import type { Patient } from '../types/clinical'

const COLOR = '#0EA5E9'
const CARD_BG = '#111827'
const BORDER = '#1F2937'
const TEXT_SUB = '#9CA3AF'
const RISK_COLOR: Record<string, string> = { critical: '#EF4444', high: '#F59E0B', medium: '#0EA5E9', low: '#22C55E' }

export default function DoctorAssignmentPage() {
  const patients = useAllPatients()
  const doctors = useDoctors()
  const assignmentRows = useDoctorAssignments()
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [optimizing, setOptimizing] = useState(false)

  function getDoctorId(patientId: string): number | undefined {
    return assignmentRows.find(a => a.patient_id === patientId)?.doctor_id
  }

  async function assign(patient: Patient, doctorId: number) {
    setSaving(patient.id)
    const doc = doctors.find(d => d.id === doctorId)
    await saveDoctorAssignments([{ patient_id: patient.id, doctor_id: doctorId }])
    if (doc) {
      await createActivity({
        icon_name: 'UserCheck', color: COLOR,
        label: 'Doctor Assigned',
        detail: `${doc.name} assigned to Patient ${patient.id} — ${patient.ward}`,
        time_ago: 'just now',
      })
    }
    setSaving(null); setSaved(patient.id)
    setTimeout(() => setSaved(s => s === patient.id ? null : s), 2500)
  }

  // Real greedy least-loaded, specialty-matched assignment (backend/assignment.py) for
  // every currently-unassigned patient.
  async function autoAssignAll() {
    setOptimizing(true)
    const unassigned = patients.filter(p => !getDoctorId(p.id))
    const existingLoads: Record<number, number> = {}
    for (const d of doctors) existingLoads[d.id] = assignmentRows.filter(a => a.doctor_id === d.id).length
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/assignment/optimize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patients: unassigned.map(p => ({ id: p.id, risk: p.risk, ward: p.ward })),
          doctors: doctors.map(d => ({ id: d.id, specialty: d.specialty, max_patients: d.max_patients })),
          existing_loads: existingLoads,
        }),
        signal: AbortSignal.timeout(10000),
      })
      if (res.ok) {
        const data = await res.json()
        await saveDoctorAssignments(data.assignments)
      }
    } catch { /* backend unavailable — leave unassigned */ }
    setOptimizing(false)
  }

  const docPatientCounts = Object.fromEntries(doctors.map(d => [d.id, 0]))
  patients.forEach(p => { const did = getDoctorId(p.id); if (did !== undefined && docPatientCounts[did] !== undefined) docPatientCounts[did]++ })

  return (
    <div style={{ padding: '24px', minHeight: '100%', background: '#0A0F1E' }}>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: `${COLOR}18`, border: `1px solid ${COLOR}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <UserCheck size={20} color={COLOR} />
          </div>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#fff', margin: 0 }}>Doctor Assignment</h1>
            <p style={{ fontSize: '12px', color: TEXT_SUB, margin: 0 }}>Assign & manage patient–doctor allocation</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: '#22C55E', background: '#22C55E14', padding: '3px 8px', borderRadius: '4px', border: '1px solid #22C55E30' }}>LIVE</span>
          <button onClick={autoAssignAll} disabled={optimizing} style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px',
            border: `1px solid ${COLOR}40`, background: `${COLOR}18`, color: COLOR, fontSize: '13px', fontWeight: 600,
            cursor: optimizing ? 'wait' : 'pointer',
          }}>
            <Sparkles size={14} />{optimizing ? 'Optimising…' : 'Auto-Assign Unassigned'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: '16px' }}>

        {/* Doctor roster */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: TEXT_SUB, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <Users size={13} style={{ display: 'inline', marginRight: '6px' }} />Doctor Roster
          </div>
          {doctors.map(doc => (
            <div key={doc.id} style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: `${doc.color}18`, border: `2px solid ${doc.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: doc.color }}>{doc.name.split(' ')[1]?.[0] ?? doc.name[0]}</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>{doc.name}</div>
                <div style={{ fontSize: '11px', color: TEXT_SUB }}>{doc.specialty}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '18px', fontWeight: 700, color: doc.color, lineHeight: 1 }}>{docPatientCounts[doc.id] ?? 0}/{doc.max_patients}</div>
                <div style={{ fontSize: '10px', color: TEXT_SUB }}>patients</div>
              </div>
              <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '4px', fontWeight: 700, color: '#22C55E', background: '#22C55E14', border: '1px solid #22C55E28', whiteSpace: 'nowrap' }}>
                {doc.status.toUpperCase()}
              </span>
            </div>
          ))}
        </div>

        {/* Patient assignment table */}
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: TEXT_SUB, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
            Patient Assignments
          </div>
          <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#0D1117' }}>
                  {['Patient', 'Ward', 'Risk', 'Assigned Doctor', ''].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '11px', color: TEXT_SUB, fontWeight: 600, borderBottom: `1px solid ${BORDER}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {patients.map((p, i) => {
                  const rc = RISK_COLOR[p.risk] ?? COLOR
                  const currentDocId = getDoctorId(p.id)
                  const isSaving = saving === p.id
                  const isSaved = saved === p.id
                  return (
                    <tr key={p.id} style={{ background: i % 2 === 0 ? 'transparent' : '#0A0F1E18' }}>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>{p.name}</div>
                        <div style={{ fontSize: '11px', color: TEXT_SUB }}>{p.id}</div>
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: '12px', color: TEXT_SUB }}>{p.ward}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 700, color: rc, background: `${rc}14` }}>
                          {p.risk.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <select
                          value={currentDocId ?? ''}
                          onChange={e => assign(p, parseInt(e.target.value, 10))}
                          style={{ background: '#0A0F1E', border: `1px solid ${BORDER}`, borderRadius: '6px', color: '#fff', fontSize: '12px', padding: '5px 8px', cursor: 'pointer', outline: 'none' }}
                        >
                          <option value="" disabled>Unassigned</option>
                          {doctors.map(d => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                        </select>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        {isSaving ? (
                          <RefreshCw size={14} color={COLOR} style={{ animation: 'spin 1s linear infinite' }} />
                        ) : isSaved ? (
                          <CheckCircle2 size={14} color='#22C55E' />
                        ) : null}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  )
}
