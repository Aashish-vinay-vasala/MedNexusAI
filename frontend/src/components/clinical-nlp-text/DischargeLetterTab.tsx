import { useEffect, useState } from 'react'
import { LogOut, Sparkles, Check, CheckCircle2, Download } from 'lucide-react'
import { usePatientContext } from '../../context/PatientContext'
import { useAllPatients, createActivity, useEHRDiagnoses, useEHRMedications, runClinical, downloadClinicalRecordPdf } from '../../hooks/useClinicalData'
import { getOrCreateDeviceId } from '../../context/AssistantContext'
import type { Patient, ClinicalRunRecord } from '../../types/clinical'
import PatientListColumn, { EmptyState } from './PatientListColumn'
import { CARD_BG, BORDER, TEXT_SUB } from './shared'
import { ErrorBanner } from './TextBits'

const COLOR = '#F59E0B'

type ChecklistItem = { id: string; label: string; done: boolean }

function initialChecklist(): ChecklistItem[] {
  return [
    { id: 'meds', label: 'Discharge medications reviewed and prescribed', done: false },
    { id: 'letter', label: 'Discharge letter prepared and signed', done: false },
    { id: 'gp', label: 'GP notification sent', done: false },
    { id: 'follow', label: 'Follow-up appointments booked', done: false },
    { id: 'education', label: 'Patient education completed', done: false },
    { id: 'transport', label: 'Transport arranged', done: false },
    { id: 'pharmacy', label: 'TTO (To Take Out) medications dispensed', done: false },
  ]
}

export default function DischargeLetterTab({ editSeed, onConsumeEditSeed, onRunComplete }: {
  editSeed: ClinicalRunRecord | null
  onConsumeEditSeed: () => void
  onRunComplete: () => void
}) {
  const [deviceId] = useState(getOrCreateDeviceId)
  const patients = useAllPatients()
  const { selectedPatient: selected, setSelectedPatient: setSelected } = usePatientContext()
  const [search, setSearch] = useState('')
  const [checklist, setChecklist] = useState<ChecklistItem[]>(initialChecklist())
  const [generating, setGenerating] = useState(false)
  const [letter, setLetter] = useState<string | null>(null)
  const [letterRecordId, setLetterRecordId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [discharged, setDischarged] = useState(false)
  const [parentId, setParentId] = useState<number | null>(null)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    setChecklist(initialChecklist()); setLetter(null); setLetterRecordId(null); setError(null); setDischarged(false); setParentId(null)
  }, [selected?.id])

  useEffect(() => {
    if (!editSeed || editSeed.mode !== 'discharge_letter') return
    const match = patients.find(p => p.id === editSeed.patient_id)
    if (match) setSelected(match)
    setParentId(editSeed.id)
    setLetter(null); setLetterRecordId(null); setError(null)
    onConsumeEditSeed()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editSeed, patients])

  function selectPatient(p: Patient) {
    setSelected(selected?.id === p.id ? null : p)
  }

  const diagnoses = useEHRDiagnoses(selected?.id)
  const medications = useEHRMedications(selected?.id).filter(m => m.active)
  const completedCount = checklist.filter(c => c.done).length
  const allDone = completedCount === checklist.length

  function toggleItem(id: string) {
    setChecklist(prev => prev.map(c => c.id === id ? { ...c, done: !c.done } : c))
  }

  async function generateLetter() {
    if (!selected || generating) return
    setGenerating(true); setLetter(null); setLetterRecordId(null); setError(null)

    let record: ClinicalRunRecord
    try {
      record = await runClinical({
        device_id: deviceId, mode: 'discharge_letter',
        patient_id: selected.id, patient_name: selected.name, risk: selected.risk, ward: selected.ward,
        input_meta: {
          diagnoses: diagnoses.map(d => ({ code: d.code, description: d.description })),
          medications: medications.map(m => ({ name: m.name, dose: m.dose, frequency: m.frequency, route: m.route })),
        },
        parent_id: parentId,
      })
    } catch {
      setError('Backend unavailable — could not generate a discharge letter. Confirm the FastAPI server is running.')
      setGenerating(false)
      return
    }

    if (record.status === 'error') {
      setError(record.error_message ?? 'Backend unavailable — could not generate a discharge letter. Confirm GROQ_API_KEY is configured.')
      setGenerating(false)
      return
    }

    setLetter(record.output_text ?? '')
    setLetterRecordId(record.id)
    setParentId(null)
    setGenerating(false)
    onRunComplete()
  }

  async function downloadLetterPdf() {
    if (!letterRecordId || downloading) return
    setDownloading(true)
    try {
      await downloadClinicalRecordPdf(letterRecordId, deviceId)
    } catch { /* no download triggered */ } finally {
      setDownloading(false)
    }
  }

  async function confirmDischarge() {
    if (!selected || discharged) return
    setDischarged(true)
    await createActivity({
      icon_name: 'CheckCircle2', color: COLOR,
      label: 'Patient Discharged',
      detail: `${selected.name} (${selected.id}) — discharge plan complete`,
      time_ago: 'just now',
    })
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '16px' }}>
      <PatientListColumn patients={patients} search={search} setSearch={setSearch} selected={selected} onSelect={selectPatient} color={COLOR} />

      {!selected ? (
        <EmptyState color={COLOR} icon={LogOut} title="Select a patient" subtitle="Plan discharge, generate letter and track checklist" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>{selected.name}</div>
                <div style={{ fontSize: '11px', color: TEXT_SUB }}>{selected.id} · Age {selected.age} · {selected.ward} · {selected.status}</div>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: completedCount === checklist.length ? '#22C55E' : COLOR, fontWeight: 600 }}>{completedCount}/{checklist.length} complete</span>
                {allDone && !discharged && (
                  <button onClick={confirmDischarge}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '7px', border: '1px solid #22C55E40', background: '#22C55E18', color: '#22C55E', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
                    <CheckCircle2 size={12} /> Confirm Discharge
                  </button>
                )}
                {discharged && <span style={{ fontSize: '11px', color: '#22C55E', fontWeight: 700 }}>✓ Discharged</span>}
              </div>
            </div>
            <div style={{ height: '4px', background: '#1F2937', borderRadius: '2px' }}>
              <div style={{ width: `${(completedCount / checklist.length) * 100}%`, height: '100%', background: allDone ? '#22C55E' : COLOR, borderRadius: '2px', transition: 'width 0.3s ease' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff', marginBottom: '12px' }}>Discharge Checklist</div>
              {checklist.map(item => (
                <div key={item.id} onClick={() => toggleItem(item.id)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 10px', borderRadius: '8px', cursor: 'pointer', marginBottom: '4px', background: item.done ? '#22C55E08' : 'transparent', border: `1px solid ${item.done ? '#22C55E20' : 'transparent'}` }}>
                  <div style={{ width: '18px', height: '18px', borderRadius: '4px', border: `2px solid ${item.done ? '#22C55E' : BORDER}`, background: item.done ? '#22C55E' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}>
                    {item.done && <Check size={11} color="white" />}
                  </div>
                  <span style={{ fontSize: '12px', color: item.done ? '#6B7280' : '#E5E7EB', textDecoration: item.done ? 'line-through' : 'none', flex: 1 }}>{item.label}</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '14px' }}>
                <div style={{ fontSize: '11px', color: COLOR, fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>Discharge Diagnoses</div>
                {diagnoses.length === 0 ? (
                  <div style={{ fontSize: '11px', color: TEXT_SUB }}>No diagnoses recorded — add some in Electronic Health Records first.</div>
                ) : diagnoses.map(d => <div key={d.id} style={{ fontSize: '11px', color: '#E5E7EB', marginBottom: '3px' }}>• {d.description} ({d.code})</div>)}
              </div>
              <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '14px' }}>
                <div style={{ fontSize: '11px', color: COLOR, fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>Discharge Medications</div>
                {medications.length === 0 ? (
                  <div style={{ fontSize: '11px', color: TEXT_SUB }}>No active medications recorded.</div>
                ) : medications.map(m => <div key={m.id} style={{ fontSize: '11px', color: '#E5E7EB', marginBottom: '3px' }}>• {m.name} {m.dose} — {m.frequency} {m.route}</div>)}
              </div>
            </div>
          </div>

          <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>Discharge Letter</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {letterRecordId && (
                  <button onClick={downloadLetterPdf} disabled={downloading}
                    style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', borderRadius: '7px', border: `1px solid ${BORDER}`, background: 'transparent', color: TEXT_SUB, fontSize: '11px', cursor: downloading ? 'not-allowed' : 'pointer' }}>
                    <Download size={12} /> {downloading ? 'Preparing…' : 'Download PDF'}
                  </button>
                )}
                <button onClick={generateLetter} disabled={generating}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '7px', border: `1px solid ${COLOR}40`, background: `${COLOR}18`, color: COLOR, fontSize: '12px', fontWeight: 600, cursor: generating ? 'not-allowed' : 'pointer' }}>
                  <Sparkles size={13} />
                  {generating ? 'Generating…' : letter ? 'Regenerate' : parentId ? 'Re-run & Save New Version' : 'Generate Letter'}
                </button>
              </div>
            </div>
            {!letter && !generating && !error && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '120px', color: TEXT_SUB, fontSize: '13px' }}>
                Click "Generate Letter" to create an AI discharge summary
              </div>
            )}
            {error && <ErrorBanner message={error} />}
            {generating && <div style={{ color: TEXT_SUB, fontSize: '13px', padding: '10px 0' }}>Generating discharge letter…</div>}
            {letter && (
              <pre style={{ margin: 0, fontSize: '11.5px', color: '#C9D1D9', lineHeight: 1.7, whiteSpace: 'pre-wrap', fontFamily: 'monospace', maxHeight: '300px', overflowY: 'auto' }}>{letter}</pre>
            )}
          </div>

        </div>
      )}
    </div>
  )
}
