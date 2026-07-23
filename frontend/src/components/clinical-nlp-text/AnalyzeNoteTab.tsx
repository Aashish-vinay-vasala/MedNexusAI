import { useEffect, useState } from 'react'
import { Play, CheckCircle2, Tag } from 'lucide-react'
import { usePatientContext } from '../../context/PatientContext'
import { useAllPatients, createActivity, runClinical } from '../../hooks/useClinicalData'
import { getOrCreateDeviceId } from '../../context/AssistantContext'
import type { Patient, ClinicalEntity, ClinicalRunRecord } from '../../types/clinical'
import PatientListColumn from './PatientListColumn'
import { CARD_BG, BORDER, TEXT_SUB, ENTITY_COLORS } from './shared'
import { ErrorBanner } from './TextBits'

const COLOR = '#F59E0B'

type PipelineStage = { id: string; label: string; description: string; status: 'idle' | 'running' | 'done' }

const SAMPLE_NOTES = [
  `65-year-old male presenting with dyspnoea, fever 38.8°C and productive cough for 3 days. History of COPD and hypertension. On salbutamol inhaler and amlodipine 5mg. SpO₂ 92% on air. CXR arranged. Starting amoxicillin 500mg TDS.`,
  `Post-op day 2 following CABG. Patient alert and oriented. Pain managed with paracetamol. HR 82, BP 128/76, SpO₂ 98%. Warfarin commenced. Mobilising with physio. Echo scheduled.`,
  `Admitted via ED with sudden onset chest pain radiating to left arm. ECG: ST elevation leads II, III, aVF. Troponin raised. Aspirin and clopidogrel loaded. Referred for primary PCI.`,
]

function patientNote(patient: Patient): string {
  const conditions: Record<string, string> = {
    critical: 'sepsis and multi-organ dysfunction',
    high: 'heart failure exacerbation and COPD',
    medium: 'community-acquired pneumonia',
    low: 'type 2 diabetes and hypertension',
  }
  const vitals: Record<string, string> = {
    critical: 'HR 118, BP 82/54, SpO₂ 86%, Temp 39.1°C, RR 30',
    high: 'HR 104, BP 148/94, SpO₂ 92%, Temp 38.4°C, RR 22',
    medium: 'HR 88, BP 138/86, SpO₂ 94%, Temp 38.1°C, RR 18',
    low: 'HR 76, BP 128/82, SpO₂ 97%, Temp 36.8°C, RR 14',
  }
  const meds: Record<string, string> = {
    critical: 'piperacillin-tazobactam IV, noradrenaline infusion, furosemide',
    high: 'furosemide 40mg IV, salbutamol nebuliser, ramipril 5mg',
    medium: 'amoxicillin 500mg TDS, paracetamol 1g QDS, salbutamol inhaler PRN',
    low: 'metformin 500mg BD, amlodipine 5mg OD, aspirin 75mg OD',
  }
  return `${patient.age}-year-old patient (${patient.id}, ${patient.ward}) presenting with ${conditions[patient.risk]}. Medications: ${meds[patient.risk]}. Observations: ${vitals[patient.risk]}. ECG and CXR arranged. Blood cultures taken.`
}

function AnnotatedText({ note, entities }: { note: string; entities: ClinicalEntity[] }) {
  if (!entities.length) return <span style={{ fontSize: '13px', color: '#E5E7EB', lineHeight: 1.7 }}>{note}</span>
  const parts: React.ReactNode[] = []
  let cursor = 0
  entities.forEach((e, i) => {
    const color = ENTITY_COLORS[e.type] ?? '#9CA3AF'
    if (e.start > cursor) parts.push(<span key={`t${i}`}>{note.slice(cursor, e.start)}</span>)
    const title = e.type + (e.is_negated ? ' (negated)' : e.is_uncertain ? ' (uncertain)' : '')
    parts.push(
      <mark key={`e${i}`} title={title} style={{
        background: `${color}28`, color, borderRadius: '3px', padding: '0 3px', fontWeight: 600, fontSize: '13px',
        border: `1px solid ${color}40`, textDecoration: e.is_negated ? 'line-through' : 'none',
        opacity: e.is_negated ? 0.6 : 1, fontStyle: e.is_uncertain ? 'italic' : 'normal',
      }}>
        {e.text}
      </mark>
    )
    cursor = e.end
  })
  if (cursor < note.length) parts.push(<span key='tail'>{note.slice(cursor)}</span>)
  return <div style={{ fontSize: '13px', color: '#E5E7EB', lineHeight: 1.8 }}>{parts}</div>
}

export default function AnalyzeNoteTab({ editSeed, onConsumeEditSeed, onRunComplete }: {
  editSeed: ClinicalRunRecord | null
  onConsumeEditSeed: () => void
  onRunComplete: () => void
}) {
  const [deviceId] = useState(getOrCreateDeviceId)
  const patients = useAllPatients()
  const { selectedPatient, setSelectedPatient } = usePatientContext()
  const [patientSearch, setPatientSearch] = useState('')
  const [note, setNote] = useState(() => selectedPatient ? patientNote(selectedPatient) : SAMPLE_NOTES[0])
  const [processing, setProcessing] = useState(false)
  const [done, setDone] = useState(false)
  const [stages, setStages] = useState<PipelineStage[]>([
    { id: 'tokenize', label: 'Tokenisation',      description: 'Split text into tokens & sentences', status: 'idle' },
    { id: 'ner',      label: 'Entity Extraction', description: 'Named entity recognition (NER)',       status: 'idle' },
    { id: 'classify', label: 'Classification',    description: 'Classify entity types & relations',   status: 'idle' },
    { id: 'map',      label: 'Code Mapping',       description: 'Map entities → ICD-10 / SNOMED',     status: 'idle' },
    { id: 'output',   label: 'Output Generation', description: 'Produce structured JSON output',      status: 'idle' },
  ])
  const [entities, setEntities] = useState<ClinicalEntity[]>([])
  const [error, setError] = useState<string | null>(null)
  const [parentId, setParentId] = useState<number | null>(null)
  const [overridePatient, setOverridePatient] = useState<{ id: string; name: string; risk: string } | null>(null)

  useEffect(() => {
    if (!editSeed || editSeed.mode !== 'nlp_analyze') return
    setNote(editSeed.input_text ?? '')
    setParentId(editSeed.id)
    setOverridePatient(editSeed.patient_id ? { id: editSeed.patient_id, name: editSeed.patient_name ?? editSeed.patient_id, risk: editSeed.risk ?? 'medium' } : null)
    setDone(false); setEntities([]); setError(null)
    onConsumeEditSeed()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editSeed])

  const filteredPatients = patientSearch.trim()
    ? patients.filter(p => p.name.toLowerCase().includes(patientSearch.toLowerCase()) || p.id.toLowerCase().includes(patientSearch.toLowerCase()))
    : patients

  function selectPatient(p: Patient) {
    const isAlreadySelected = selectedPatient?.id === p.id
    setSelectedPatient(isAlreadySelected ? null : p)
    setParentId(null); setOverridePatient(null)
    if (!isAlreadySelected) {
      setNote(patientNote(p))
      setDone(false); setEntities([])
      setStages(prev => prev.map(s => ({ ...s, status: 'idle' })))
    }
  }

  async function processNote() {
    if (!note.trim() || processing) return
    setProcessing(true); setDone(false); setEntities([]); setError(null)
    setStages(prev => prev.map(s => ({ ...s, status: 'idle' })))

    for (let i = 0; i < stages.length; i++) {
      await new Promise(r => setTimeout(r, 400 + i * 200))
      setStages(prev => prev.map((s, idx) => idx === i ? { ...s, status: 'running' } : s))
      await new Promise(r => setTimeout(r, 350 + i * 100))
      setStages(prev => prev.map((s, idx) => idx === i ? { ...s, status: 'done' } : s))
    }

    const patientId = selectedPatient?.id ?? overridePatient?.id ?? null
    const patientName = selectedPatient?.name ?? overridePatient?.name ?? null
    const risk = selectedPatient?.risk ?? overridePatient?.risk ?? null

    let record: ClinicalRunRecord
    try {
      record = await runClinical({
        device_id: deviceId, mode: 'nlp_analyze',
        patient_id: patientId, patient_name: patientName, risk,
        note_text: note, parent_id: parentId,
      })
    } catch {
      setError('Backend unavailable — could not run entity extraction. Confirm the FastAPI server is running.')
      setProcessing(false); setDone(false)
      return
    }

    if (record.status === 'error') {
      setError(record.error_message ?? 'Entity extraction failed.')
      setProcessing(false); setDone(false)
      return
    }

    const extracted = record.output_entities ?? []
    setEntities(extracted)
    setParentId(null)

    await createActivity({
      icon_name: 'Cpu', color: COLOR,
      label: 'NLP Pipeline Executed',
      detail: `${patientName ? patientName + ' — ' : ''}${extracted.length} entities extracted`,
      time_ago: 'just now',
    })
    setProcessing(false); setDone(true)
    onRunComplete()
  }

  const entityGroups = Object.entries(
    entities.reduce<Record<string, ClinicalEntity[]>>((acc, e) => {
      if (!acc[e.type]) acc[e.type] = []
      acc[e.type].push(e)
      return acc
    }, {})
  )

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '16px' }}>

      <PatientListColumn patients={filteredPatients} search={patientSearch} setSearch={setPatientSearch} selected={selectedPatient} onSelect={selectPatient} color={COLOR}>
        <div style={{ padding: '8px 10px', borderTop: `1px solid ${BORDER}` }}>
          <div style={{ fontSize: '10px', color: TEXT_SUB, marginBottom: '4px' }}>Sample notes:</div>
          {SAMPLE_NOTES.map((_, i) => (
            <button key={i} onClick={() => { setNote(SAMPLE_NOTES[i]); setSelectedPatient(null); setParentId(null); setOverridePatient(null); setDone(false); setEntities([]) }}
              style={{ display: 'block', width: '100%', textAlign: 'left', marginBottom: '3px', padding: '3px 6px', borderRadius: '4px', border: `1px solid ${BORDER}`, background: note === SAMPLE_NOTES[i] && !selectedPatient ? `${COLOR}14` : 'transparent', color: note === SAMPLE_NOTES[i] && !selectedPatient ? COLOR : TEXT_SUB, fontSize: '10px', cursor: 'pointer' }}>
              Sample {i + 1}
            </button>
          ))}
        </div>
      </PatientListColumn>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '16px' }}>
          <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>
                Clinical Note Input
                {(selectedPatient || overridePatient) && <span style={{ color: COLOR, fontWeight: 400, fontSize: '11px', marginLeft: '8px' }}>— {selectedPatient?.name ?? overridePatient?.name}{parentId ? ' (editing v' + editSeed?.version + ')' : ''}</span>}
              </span>
            </div>
            <textarea value={note} onChange={e => { setNote(e.target.value); setDone(false); setEntities([]) }} rows={7}
              style={{ width: '100%', background: '#0A0F1E', border: `1px solid ${BORDER}`, borderRadius: '8px', color: '#fff', fontSize: '13px', padding: '12px', resize: 'vertical', outline: 'none', boxSizing: 'border-box', lineHeight: 1.6 }}
              placeholder="Select a patient or paste a clinical note…" />
            <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={processNote} disabled={processing || !note.trim()}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 18px', borderRadius: '8px', border: `1px solid ${done ? '#22C55E40' : COLOR + '40'}`, background: done ? '#22C55E18' : `${COLOR}18`, color: done ? '#22C55E' : COLOR, fontSize: '13px', fontWeight: 600, cursor: processing || !note.trim() ? 'not-allowed' : 'pointer' }}>
                {done ? <CheckCircle2 size={14} /> : <Play size={14} />}
                {processing ? 'Processing…' : done ? 'Processed!' : parentId ? 'Re-run & Save New Version' : 'Run Pipeline'}
              </button>
            </div>
          </div>

          <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '18px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff', marginBottom: '14px' }}>Pipeline Stages</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {stages.map((stage, i) => {
                const isRunning = stage.status === 'running'
                const isDone = stage.status === 'done'
                const c = isDone ? '#22C55E' : isRunning ? COLOR : TEXT_SUB
                return (
                  <div key={stage.id} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '2px' }}>
                      <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: isDone ? '#22C55E18' : isRunning ? `${COLOR}18` : '#1F2937', border: `2px solid ${c}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {isDone ? <CheckCircle2 size={11} color='#22C55E' /> : <span style={{ fontSize: '10px', fontWeight: 700, color: c }}>{i + 1}</span>}
                      </div>
                      {i < stages.length - 1 && <div style={{ width: '2px', height: '20px', background: isDone ? '#22C55E30' : '#1F2937', marginTop: '2px' }} />}
                    </div>
                    <div style={{ flex: 1, paddingBottom: '8px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: isDone ? '#22C55E' : isRunning ? COLOR : '#fff' }}>{stage.label}</div>
                      <div style={{ fontSize: '10px', color: TEXT_SUB }}>{stage.description}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {error && <ErrorBanner message={error} />}

        {done && entities.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '16px' }}>
            <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '18px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff', marginBottom: '12px' }}>Annotated Output</div>
              <AnnotatedText note={note} entities={entities} />
            </div>
            <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '14px' }}>
                <Tag size={13} color={COLOR} />
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>Entities ({entities.length})</span>
              </div>
              {entityGroups.map(([type, ents]) => (
                <div key={type} style={{ marginBottom: '12px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: ENTITY_COLORS[type], textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>{type}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {ents.map((e, i) => (
                      <span key={i} title={e.is_negated ? 'Negated' : e.is_uncertain ? 'Uncertain' : undefined} style={{
                        fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: `${ENTITY_COLORS[type]}14`,
                        color: ENTITY_COLORS[type], border: `1px solid ${ENTITY_COLORS[type]}28`,
                        textDecoration: e.is_negated ? 'line-through' : 'none', opacity: e.is_negated ? 0.55 : 1,
                      }}>{e.text}{e.is_negated ? ' ✕' : e.is_uncertain ? ' ?' : ''}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
