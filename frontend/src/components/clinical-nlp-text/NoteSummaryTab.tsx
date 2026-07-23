import { useEffect, useState } from 'react'
import { Sparkles, Copy, Check } from 'lucide-react'
import { usePatientContext } from '../../context/PatientContext'
import { useAllPatients, createActivity, runClinical } from '../../hooks/useClinicalData'
import { getOrCreateDeviceId } from '../../context/AssistantContext'
import type { Patient, ClinicalRunRecord } from '../../types/clinical'
import PatientListColumn from './PatientListColumn'
import { CARD_BG, BORDER, TEXT_SUB } from './shared'
import { ContentText, ErrorBanner } from './TextBits'

const COLOR = '#EC4899'

const SAMPLE_NOTES = [
  {
    label: 'Sepsis Admission',
    note: `65-year-old male, presented via ED with 3-day history of productive cough, fever 38.8°C, rigors and confusion. PMH: COPD, T2DM, hypertension. Medications: salbutamol inhaler, metformin 500mg BD, ramipril 5mg OD. On examination: tachycardic (HR 112), hypotensive (BP 92/58), SpO₂ 88% on air, temperature 38.9°C, RR 26/min. CRP 248, WBC 18.4, lactate 3.2, blood cultures taken. CXR bilateral infiltrates. NEWS2 score 11. Started on IV fluids, oxygen 15L NRB, IV piperacillin-tazobactam 4.5g TDS. ICU referral made.`,
  },
  {
    label: 'Chest Pain',
    note: `72-year-old female, sudden onset central chest pain radiating to left arm, associated with diaphoresis. Pain onset 2 hours prior. PMH: hypertension, hyperlipidaemia. Medications: amlodipine 10mg, atorvastatin 40mg. 12-lead ECG: ST elevation 2mm leads II, III, aVF — inferior STEMI. Troponin T: 1240 ng/L. Aspirin 300mg and clopidogrel 600mg loaded. Heparin commenced. Activated primary PCI pathway. Transferred to cath lab.`,
  },
]

function patientNote(patient: Patient): string {
  const vitals: Record<string, string> = {
    critical: 'HR 118, BP 84/52 (hypotensive), SpO₂ 86%, Temp 39.2°C, RR 30. NEWS2: 11.',
    high: 'HR 106, BP 148/92, SpO₂ 92%, Temp 38.4°C, RR 22. NEWS2: 7.',
    medium: 'HR 88, BP 138/86, SpO₂ 94%, Temp 38.1°C, RR 18. NEWS2: 4.',
    low: 'HR 74, BP 126/80, SpO₂ 97%, Temp 36.7°C, RR 14. NEWS2: 1.',
  }
  const complaints: Record<string, string> = {
    critical: 'high fever, confusion and productive cough for 3 days',
    high: 'worsening breathlessness and ankle oedema for 5 days',
    medium: 'cough, fever and malaise for 48 hours',
    low: 'routine review of chronic conditions',
  }
  return `${patient.age}-year-old patient (${patient.name}, ${patient.id}) admitted from ${patient.ward} with ${complaints[patient.risk]}. Status: ${patient.status}. Observations on arrival: ${vitals[patient.risk]} Clinical team notified. Investigations requested.`
}

export default function NoteSummaryTab({ editSeed, onConsumeEditSeed, onRunComplete }: {
  editSeed: ClinicalRunRecord | null
  onConsumeEditSeed: () => void
  onRunComplete: () => void
}) {
  const [deviceId] = useState(getOrCreateDeviceId)
  const patients = useAllPatients()
  const { selectedPatient: selected, setSelectedPatient: setSelected } = usePatientContext()
  const [search, setSearch] = useState('')
  const [selectedSample, setSelectedSample] = useState(0)
  const [note, setNote] = useState(() => selected ? patientNote(selected) : SAMPLE_NOTES[0].note)
  const [processing, setProcessing] = useState(false)
  const [summary, setSummary] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [parentId, setParentId] = useState<number | null>(null)
  const [overridePatient, setOverridePatient] = useState<{ id: string; name: string; risk: string } | null>(null)

  useEffect(() => {
    if (!editSeed || editSeed.mode !== 'note_summary') return
    setNote(editSeed.input_text ?? '')
    setParentId(editSeed.id)
    setOverridePatient(editSeed.patient_id ? { id: editSeed.patient_id, name: editSeed.patient_name ?? editSeed.patient_id, risk: editSeed.risk ?? 'medium' } : null)
    setSummary(null); setError(null)
    onConsumeEditSeed()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editSeed])

  function selectPatient(p: Patient) {
    const isAlreadySelected = selected?.id === p.id
    setSelected(isAlreadySelected ? null : p)
    setParentId(null); setOverridePatient(null)
    if (!isAlreadySelected) { setNote(patientNote(p)); setSummary(null) }
  }

  function handleSampleChange(i: number) {
    setSelectedSample(i); setSelected(null)
    setParentId(null); setOverridePatient(null)
    setNote(SAMPLE_NOTES[i].note); setSummary(null)
  }

  async function generate() {
    if (!note.trim() || processing) return
    setProcessing(true); setSummary(null); setError(null)

    const patientId = selected?.id ?? overridePatient?.id ?? null
    const patientName = selected?.name ?? overridePatient?.name ?? null
    const risk = selected?.risk ?? overridePatient?.risk ?? null

    let record: ClinicalRunRecord
    try {
      record = await runClinical({
        device_id: deviceId, mode: 'note_summary',
        patient_id: patientId, patient_name: patientName, risk,
        note_text: note, parent_id: parentId,
      })
    } catch {
      setError('Backend unavailable — could not generate a summary. Confirm the FastAPI server is running.')
      setProcessing(false)
      return
    }

    if (record.status === 'error') {
      setError(record.error_message ?? 'Backend unavailable — could not generate a summary. Confirm GROQ_API_KEY is configured.')
      setProcessing(false)
      return
    }

    setSummary(record.output_text ?? '')
    setParentId(null)
    await createActivity({
      icon_name: 'FileText', color: COLOR,
      label: 'Clinical Note Summarised',
      detail: `${patientName ? patientName + ' — ' : ''}NLP summary generated`,
      time_ago: 'just now',
    })
    setProcessing(false)
    onRunComplete()
  }

  function copySummary() {
    if (!summary) return
    navigator.clipboard.writeText(summary)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '16px' }}>
      <PatientListColumn patients={patients} search={search} setSearch={setSearch} selected={selected} onSelect={selectPatient} color={COLOR}>
        <div style={{ padding: '8px 10px', borderTop: `1px solid ${BORDER}` }}>
          <div style={{ fontSize: '10px', color: TEXT_SUB, marginBottom: '4px' }}>Sample notes:</div>
          {SAMPLE_NOTES.map((s, i) => (
            <button key={i} onClick={() => handleSampleChange(i)}
              style={{ display: 'block', width: '100%', textAlign: 'left', marginBottom: '3px', padding: '3px 6px', borderRadius: '4px', border: `1px solid ${BORDER}`, background: selectedSample === i && !selected ? `${COLOR}14` : 'transparent', color: selectedSample === i && !selected ? COLOR : TEXT_SUB, fontSize: '10px', cursor: 'pointer' }}>
              {s.label}
            </button>
          ))}
        </div>
      </PatientListColumn>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>
            Clinical Note
            {(selected || overridePatient) && <span style={{ color: COLOR, fontWeight: 400, fontSize: '11px', marginLeft: '8px' }}>— {selected?.name ?? overridePatient?.name}{parentId ? ' (editing v' + editSeed?.version + ')' : ''}</span>}
          </div>
          <textarea value={note} onChange={e => { setNote(e.target.value); setSummary(null) }} rows={12}
            style={{ width: '100%', background: '#0A0F1E', border: `1px solid ${BORDER}`, borderRadius: '8px', color: '#E5E7EB', fontSize: '13px', padding: '12px', resize: 'none', outline: 'none', boxSizing: 'border-box', lineHeight: 1.7, flex: 1 }}
            placeholder="Select a patient or paste a clinical note to summarise…" />
          <button onClick={generate} disabled={processing || !note.trim()}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px', borderRadius: '8px', border: `1px solid ${COLOR}40`, background: `${COLOR}18`, color: COLOR, fontSize: '13px', fontWeight: 600, cursor: processing || !note.trim() ? 'not-allowed' : 'pointer' }}>
            <Sparkles size={15} />
            {processing ? 'Generating summary…' : parentId ? 'Re-run & Save New Version' : 'Generate Summary'}
          </button>
        </div>

        <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>Structured Summary</span>
            {summary && (
              <button onClick={copySummary} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '6px', border: `1px solid ${BORDER}`, background: 'transparent', color: copied ? '#22C55E' : TEXT_SUB, fontSize: '11px', cursor: 'pointer' }}>
                {copied ? <Check size={11} /> : <Copy size={11} />}{copied ? 'Copied!' : 'Copy'}
              </button>
            )}
          </div>

          {!summary && !processing && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', minHeight: '300px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: `${COLOR}14`, border: `1px solid ${COLOR}28`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Sparkles size={22} color={COLOR} />
              </div>
              <p style={{ fontSize: '13px', color: TEXT_SUB, margin: 0 }}>Run the pipeline to generate a summary</p>
            </div>
          )}

          {processing && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', minHeight: '300px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: `${COLOR}14`, border: `1px solid ${COLOR}28`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Sparkles size={22} color={COLOR} />
              </div>
              <p style={{ fontSize: '13px', color: COLOR, margin: 0 }}>Analysing clinical note…</p>
            </div>
          )}

          {error && <ErrorBanner message={error} />}

          {summary && <div style={{ overflowY: 'auto' }}><ContentText text={summary} color={COLOR} /></div>}
        </div>
      </div>
    </div>
  )
}
