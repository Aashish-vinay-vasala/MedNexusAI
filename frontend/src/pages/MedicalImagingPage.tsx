import { useState, useEffect } from 'react'
import { usePatientContext } from '../context/PatientContext'
import { FileImage, Search, Zap, AlertTriangle, CheckCircle2, Sparkles, Grid3x3, Microscope, Upload, Pencil, Trash2, Check, X } from 'lucide-react'
import { useAllPatients, createAlert, ensureImagingStudies, updateImagingStudy, deleteImagingStudy } from '../hooks/useClinicalData'
import { BACKEND_URL } from '../lib/backend'
import type { ImagingStudy } from '../types/clinical'

type ImagingSample = { id: string; label: string; modality: string }
type DicomAnalysis = {
  metadata: { modality: string | null; rows: number | null; columns: number | null; pixel_spacing: number[] | null; body_part_examined: string | null; study_date: string | null; bits_allocated: number | null }
  pixel_stats: { mean_intensity: number; std_intensity: number; contrast_metric: number }
  classification: { label: string; confidence: number }
}

const COLOR = '#8B5CF6'
const CARD_BG = '#111827'
const BORDER = '#1F2937'
const TEXT_SUB = '#9CA3AF'
const RISK_COLOR: Record<string, string> = { critical: '#EF4444', high: '#F59E0B', medium: '#0EA5E9', low: '#22C55E' }

function DicomPlaceholder({ study }: { study: ImagingStudy }) {
  const gridSize = study.modality === 'CT' || study.modality === 'MR' ? 4 : 1
  const cells = Array.from({ length: gridSize * gridSize })
  return (
    <div style={{ background: '#020408', minHeight: '280px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '20px' }}>
      {gridSize > 1 ? (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${gridSize}, 1fr)`, gap: '2px', width: '240px', height: '240px' }}>
          {cells.map((_, i) => (
            <div key={i} style={{ background: `rgba(139,92,246,${0.04 + (i % 3) * 0.02})`, border: '1px solid rgba(139,92,246,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {i === Math.floor(cells.length / 2) && <div style={{ width: '60%', height: '60%', borderRadius: '50%', background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)' }} />}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ width: '180px', height: '180px', position: 'relative' }}>
          <div style={{ width: '100%', height: '100%', borderRadius: '4px', background: 'rgba(139,92,246,0.04)', border: '1px solid rgba(139,92,246,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '60%', height: '75%', border: '1px solid rgba(139,92,246,0.2)', borderRadius: '2px', background: 'rgba(139,92,246,0.03)' }}>
              <div style={{ width: '80%', height: '40%', background: 'rgba(139,92,246,0.06)', margin: '10% auto', borderRadius: '50%' }} />
            </div>
          </div>
        </div>
      )}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '11px', color: '#4B5563', marginBottom: '2px' }}>{study.study_type} · {study.modality} · DICOM viewer</div>
        <div style={{ fontSize: '10px', color: '#374151', display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
          <Grid3x3 size={10} color="#374151" /> Connect PACS for full viewer
        </div>
      </div>
    </div>
  )
}

export default function MedicalImagingPage() {
  const patients = useAllPatients()
  const { selectedPatient: selected, setSelectedPatient: setSelected } = usePatientContext()
  const [search, setSearch] = useState('')
  const [activeStudy, setActiveStudy] = useState<ImagingStudy | null>(null)
  const [flagging, setFlagging] = useState(false)
  const [flagged, setFlagged] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [aiReport, setAiReport] = useState<string | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)
  const [editingStudyId, setEditingStudyId] = useState<number | null>(null)
  const [editFinding, setEditFinding] = useState('')
  const [editStatus, setEditStatus] = useState('Pending Review')
  const [studyBusyId, setStudyBusyId] = useState<number | null>(null)
  useEffect(() => { setActiveStudy(null); setAiReport(null); setAiError(null); setFlagged(false) }, [selected?.id])

  // Real per-patient imaging study history (server auto-seeds on first view)
  const [studiesByPatient, setStudiesByPatient] = useState<Record<string, ImagingStudy[]>>({})
  useEffect(() => {
    if (!patients.length) return
    let cancelled = false
    Promise.all(patients.map(p => ensureImagingStudies(p.id).then(rows => [p.id, rows] as const).catch(() => [p.id, []] as const)))
      .then(entries => { if (!cancelled) setStudiesByPatient(Object.fromEntries(entries)) })
    return () => { cancelled = true }
  }, [patients])

  // Real DICOM analysis (Pydicom + SimpleITK + MONAI)
  const [samples, setSamples] = useState<ImagingSample[]>([])
  const [sampleId, setSampleId] = useState('')
  const [dicomResult, setDicomResult] = useState<DicomAnalysis | null>(null)
  const [dicomLoading, setDicomLoading] = useState(false)
  const [dicomError, setDicomError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/v1/imaging/samples`, { signal: AbortSignal.timeout(8000) })
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data?.samples?.length) { setSamples(data.samples); setSampleId(data.samples[0].id) } })
      .catch(() => { /* backend unavailable — section renders as unavailable */ })
  }, [])

  async function analyzeSample() {
    if (!sampleId || dicomLoading) return
    setDicomLoading(true); setDicomError(null); setDicomResult(null)
    const form = new FormData()
    form.append('sample_id', sampleId)
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/imaging/dicom-metadata`, { method: 'POST', body: form, signal: AbortSignal.timeout(15000) })
      if (!res.ok) throw new Error(`Backend returned ${res.status}`)
      setDicomResult(await res.json())
    } catch {
      setDicomError('Could not reach the imaging backend — check it is running.')
    }
    setDicomLoading(false)
  }

  async function analyzeUpload(f: File) {
    if (dicomLoading) return
    setDicomLoading(true); setDicomError(null); setDicomResult(null)
    const form = new FormData()
    form.append('file', f)
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/imaging/dicom-metadata`, { method: 'POST', body: form, signal: AbortSignal.timeout(15000) })
      if (!res.ok) throw new Error(`Backend returned ${res.status}`)
      setDicomResult(await res.json())
    } catch {
      setDicomError('Could not analyze this file — ensure it is a valid DICOM (.dcm) file.')
    }
    setDicomLoading(false)
  }

  const filtered = search.trim()
    ? patients.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.id.toLowerCase().includes(search.toLowerCase()))
    : patients

  const studies = selected ? (studiesByPatient[selected.id] ?? []) : []

  async function flagForReview() {
    if (!selected || !activeStudy) return
    setFlagging(true)
    await createAlert({
      type: 'Imaging Result',
      patient: `Patient #${selected.id.replace(/\D/g, '')}`,
      patient_id: selected.id,
      category: 'imaging',
      detail: `${activeStudy.study_type}: ${activeStudy.finding} (${activeStudy.confidence}% confidence)`,
      time_ago: 'just now',
      severity: activeStudy.confidence < 90 ? 'high' : 'medium',
      color: activeStudy.confidence < 90 ? '#F59E0B' : '#0EA5E9',
      source: 'Medical Imaging AI',
      acknowledged: false,
      escalated: false,
    })
    setFlagging(false); setFlagged(true)
    setTimeout(() => setFlagged(false), 3000)
  }

  async function runAiAnalysis() {
    if (!selected || !activeStudy || analyzing) return
    setAnalyzing(true); setAiReport(null); setAiError(null)

    let result: string | null = null
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/imaging/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patient_id: selected.id, study_type: activeStudy.study_type, finding: activeStudy.finding, confidence: activeStudy.confidence, risk: selected.risk }),
        signal: AbortSignal.timeout(10000),
      })
      if (res.ok) { const d = await res.json(); result = d.interpretation ?? null }
    } catch { /* fall through to error state */ }

    if (!result) {
      setAiError('Backend unavailable — could not generate an interpretation. Confirm the FastAPI server and GROQ_API_KEY are configured.')
      setAnalyzing(false)
      return
    }

    setAiReport(result)
    setAnalyzing(false)
  }

  function confColor(c: number) { return c >= 94 ? '#22C55E' : c >= 88 ? '#F59E0B' : '#EF4444' }

  function startEditStudy(s: ImagingStudy) {
    setEditingStudyId(s.id)
    setEditFinding(s.finding)
    setEditStatus(s.status)
  }

  async function saveEditStudy(s: ImagingStudy) {
    if (!selected) return
    setStudyBusyId(s.id)
    try {
      const updated = await updateImagingStudy(s.id, { finding: editFinding.trim() || s.finding, status: editStatus })
      setStudiesByPatient(prev => ({ ...prev, [selected.id]: (prev[selected.id] ?? []).map(x => x.id === s.id ? updated : x) }))
      if (activeStudy?.id === s.id) setActiveStudy(updated)
    } finally {
      setStudyBusyId(null)
      setEditingStudyId(null)
    }
  }

  function toggleActiveStudy(s: ImagingStudy) {
    setActiveStudy(activeStudy?.id === s.id ? null : s)
    setAiReport(null)
  }

  async function removeStudy(s: ImagingStudy) {
    if (!selected) return
    setStudyBusyId(s.id)
    try {
      await deleteImagingStudy(s.id)
      const remaining = (studiesByPatient[selected.id] ?? []).filter(x => x.id !== s.id)
      if (remaining.length === 0) {
        // The backend auto-seeds a fresh set if a patient has zero studies — refetch
        // immediately so the panel doesn't sit empty until the page happens to remount.
        const fresh = await ensureImagingStudies(selected.id)
        setStudiesByPatient(prev => ({ ...prev, [selected.id]: fresh }))
      } else {
        setStudiesByPatient(prev => ({ ...prev, [selected.id]: remaining }))
      }
      if (activeStudy?.id === s.id) { setActiveStudy(null); setAiReport(null) }
    } finally {
      setStudyBusyId(null)
    }
  }

  return (
    <div style={{ padding: '24px', minHeight: '100%', background: '#0A0F1E' }}>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: `${COLOR}18`, border: `1px solid ${COLOR}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FileImage size={20} color={COLOR} />
          </div>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#fff', margin: 0 }}>Medical Imaging AI</h1>
            <p style={{ fontSize: '12px', color: TEXT_SUB, margin: 0 }}>AI-assisted imaging review, findings & Groq interpretation</p>
          </div>
        </div>
        <span style={{ fontSize: '11px', color: '#22C55E', background: '#22C55E14', padding: '3px 8px', borderRadius: '4px', border: '1px solid #22C55E30' }}>LIVE</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '16px' }}>

        {/* Patient list */}
        <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', overflow: 'hidden', alignSelf: 'start' }}>
          <div style={{ padding: '12px 14px', borderBottom: `1px solid ${BORDER}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#0A0F1E', border: `1px solid ${BORDER}`, borderRadius: '8px', padding: '7px 10px' }}>
              <Search size={13} color={TEXT_SUB} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search patients…"
                style={{ background: 'none', border: 'none', outline: 'none', color: '#fff', fontSize: '13px', flex: 1 }} />
            </div>
          </div>
          <div style={{ maxHeight: '580px', overflowY: 'auto' }}>
            {filtered.map(p => {
              const sel = selected?.id === p.id
              const rc = RISK_COLOR[p.risk] ?? COLOR
              const pStudies = studiesByPatient[p.id] ?? []
              const pending = pStudies.filter(s => s.status === 'Pending Review').length
              return (
                <div key={p.id} onClick={() => { setSelected(sel ? null : p); setActiveStudy(null); setAiReport(null) }}
                  style={{ padding: '10px 14px', borderBottom: `1px solid ${BORDER}60`, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', background: sel ? `${COLOR}10` : 'transparent', borderLeft: sel ? `3px solid ${COLOR}` : '3px solid transparent' }}>
                  <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: `${rc}14`, border: `1px solid ${rc}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <FileImage size={13} color={rc} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                    <div style={{ fontSize: '10px', color: TEXT_SUB }}>{pStudies.length} studies{pending > 0 ? ` · ${pending} pending` : ''}</div>
                  </div>
                  {pending > 0 && <span style={{ fontSize: '9px', background: '#F59E0B14', color: '#F59E0B', border: '1px solid #F59E0B28', borderRadius: '3px', padding: '1px 5px', fontWeight: 700 }}>!</span>}
                </div>
              )
            })}
          </div>
        </div>

        {/* Studies + viewer */}
        {!selected ? (
          <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px', gap: '10px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: `${COLOR}14`, border: `1px solid ${COLOR}28`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileImage size={22} color={COLOR} />
            </div>
            <p style={{ fontSize: '14px', color: '#fff', margin: 0, fontWeight: 500 }}>Select a patient</p>
            <p style={{ fontSize: '13px', color: TEXT_SUB, margin: 0 }}>View their imaging studies</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

            {/* Study list */}
            <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff', marginBottom: '12px' }}>
                Imaging Studies — {selected.name}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {studies.map(s => {
                  const active = activeStudy?.id === s.id
                  const cc = confColor(s.confidence)
                  const editing = editingStudyId === s.id
                  return (
                    <div key={s.id}
                      style={{ display: 'flex', alignItems: editing ? 'flex-start' : 'center', gap: '12px', padding: '12px 14px', background: active ? `${COLOR}10` : '#0A0F1E', border: `1px solid ${active ? COLOR + '40' : BORDER}`, borderRadius: '10px' }}>
                      <div onClick={() => !editing && toggleActiveStudy(s)}
                        style={{ width: '38px', height: '38px', borderRadius: '8px', background: `${COLOR}14`, border: `1px solid ${COLOR}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer' }}>
                        <span style={{ fontSize: '10px', fontWeight: 700, color: COLOR }}>{s.modality}</span>
                      </div>
                      <div onClick={() => !editing && toggleActiveStudy(s)} style={{ flex: 1, cursor: editing ? 'default' : 'pointer' }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>{s.study_type}</div>
                        <div style={{ fontSize: '11px', color: TEXT_SUB }}>{s.study_date} · IMG-{s.id}</div>
                        {editing ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }} onClick={e => e.stopPropagation()}>
                            <textarea value={editFinding} onChange={e => setEditFinding(e.target.value)} rows={2}
                              style={{ background: '#020408', border: `1px solid ${BORDER}`, borderRadius: '6px', color: '#fff', fontSize: '11px', padding: '6px 8px', resize: 'vertical', outline: 'none' }} />
                            <select value={editStatus} onChange={e => setEditStatus(e.target.value)}
                              style={{ background: '#020408', border: `1px solid ${BORDER}`, borderRadius: '6px', color: '#fff', fontSize: '11px', padding: '5px 8px', width: 'fit-content' }}>
                              <option value="Pending Review">Pending Review</option>
                              <option value="Reviewed">Reviewed</option>
                            </select>
                          </div>
                        ) : (
                          <div style={{ fontSize: '10px', color: '#4B5563', marginTop: '2px', maxWidth: '380px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.finding}</div>
                        )}
                      </div>
                      {!editing && (
                        <>
                          <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '4px', fontWeight: 700, color: s.status === 'Pending Review' ? '#F59E0B' : '#22C55E', background: s.status === 'Pending Review' ? '#F59E0B14' : '#22C55E14' }}>
                            {s.status}
                          </span>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: cc }}>{s.confidence}%</span>
                        </>
                      )}
                      <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                        {editing ? (
                          <>
                            <button onClick={() => saveEditStudy(s)} disabled={studyBusyId === s.id} title="Save"
                              style={{ background: 'transparent', border: 'none', color: '#22C55E', cursor: 'pointer', display: 'flex' }}><Check size={13} /></button>
                            <button onClick={() => setEditingStudyId(null)} title="Cancel"
                              style={{ background: 'transparent', border: 'none', color: TEXT_SUB, cursor: 'pointer', display: 'flex' }}><X size={13} /></button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => startEditStudy(s)} title="Edit study"
                              style={{ background: 'transparent', border: 'none', color: TEXT_SUB, cursor: 'pointer', display: 'flex' }}><Pencil size={12} /></button>
                            <button onClick={() => removeStudy(s)} disabled={studyBusyId === s.id} title="Delete study"
                              style={{ background: 'transparent', border: 'none', color: TEXT_SUB, cursor: studyBusyId === s.id ? 'not-allowed' : 'pointer', display: 'flex' }}><Trash2 size={12} /></button>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Study viewer */}
            {activeStudy && (
              <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', overflow: 'hidden' }}>
                <div style={{ padding: '14px 18px', borderBottom: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>{activeStudy.study_type}</div>
                    <div style={{ fontSize: '11px', color: TEXT_SUB }}>IMG-{activeStudy.id} · {activeStudy.study_date}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={runAiAnalysis} disabled={analyzing}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '8px', border: `1px solid ${COLOR}40`, background: `${COLOR}18`, color: COLOR, fontSize: '12px', fontWeight: 600, cursor: analyzing ? 'wait' : 'pointer' }}>
                      <Sparkles size={13} />
                      {analyzing ? 'Analysing…' : aiReport ? 'Re-analyse' : 'AI Interpret'}
                    </button>
                    <button onClick={flagForReview} disabled={flagging || flagged}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '8px', border: `1px solid ${flagged ? '#22C55E40' : '#F59E0B40'}`, background: flagged ? '#22C55E18' : '#F59E0B18', color: flagged ? '#22C55E' : '#F59E0B', fontSize: '12px', fontWeight: 600, cursor: flagging ? 'wait' : 'pointer' }}>
                      {flagged ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                      {flagged ? 'Flagged!' : flagging ? 'Flagging…' : 'Flag for Review'}
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px' }}>
                  <DicomPlaceholder study={activeStudy} />

                  {/* AI findings panel */}
                  <div style={{ padding: '18px', borderLeft: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Zap size={14} color={COLOR} />
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>AI Analysis</span>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: TEXT_SUB, marginBottom: '4px' }}>Confidence Score</div>
                      <div style={{ fontSize: '28px', fontWeight: 700, color: confColor(activeStudy.confidence), lineHeight: 1 }}>{activeStudy.confidence}%</div>
                      <div style={{ marginTop: '6px', height: '5px', background: '#1F2937', borderRadius: '2px' }}>
                        <div style={{ width: `${activeStudy.confidence}%`, height: '100%', background: confColor(activeStudy.confidence), borderRadius: '2px' }} />
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: TEXT_SUB, marginBottom: '6px' }}>Primary Finding</div>
                      <div style={{ fontSize: '12px', color: '#fff', padding: '10px 12px', background: '#0A0F1E', border: `1px solid ${BORDER}`, borderRadius: '8px', lineHeight: 1.5 }}>
                        {activeStudy.finding}
                      </div>
                    </div>
                    {activeStudy.flagged && (
                      <div style={{ padding: '8px 10px', background: '#F59E0B10', border: '1px solid #F59E0B28', borderRadius: '8px', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                        <AlertTriangle size={13} color='#F59E0B' style={{ flexShrink: 0, marginTop: '1px' }} />
                        <span style={{ fontSize: '11px', color: '#F59E0B' }}>Below threshold — radiologist review recommended</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Groq AI interpretation */}
                {(analyzing || aiReport || aiError) && (
                  <div style={{ padding: '18px', borderTop: `1px solid ${BORDER}`, background: '#070B14' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                      <Sparkles size={14} color={COLOR} />
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>AI Radiological Interpretation</span>
                      <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '4px', background: `${COLOR}14`, color: COLOR, border: `1px solid ${COLOR}28` }}>Groq · llama-3.3-70b</span>
                    </div>
                    {analyzing ? (
                      <div style={{ color: TEXT_SUB, fontSize: '13px' }}>Interpreting imaging findings…</div>
                    ) : aiError ? (
                      <div style={{ fontSize: '12px', color: '#F59E0B' }}>{aiError}</div>
                    ) : (
                      <div style={{ fontSize: '12px', color: '#C9D1D9', lineHeight: 1.8, whiteSpace: 'pre-wrap', maxHeight: '240px', overflowY: 'auto' }}>
                        {aiReport?.split('\n').map((line, i) => {
                          const isHeader = line.trim().endsWith(':') && line.trim().length < 30
                          return <span key={i}>{isHeader ? <span style={{ color: COLOR, fontWeight: 700 }}>{line}</span> : line}{'\n'}</span>
                        })}
                      </div>
                    )}
                  </div>
                )}

              </div>
            )}
          </div>
        )}

      </div>

      {/* Real DICOM analysis — Pydicom + SimpleITK + MONAI (MedNIST-trained classifier) */}
      <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '18px', marginTop: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <Microscope size={15} color={COLOR} />
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>Real DICOM Analysis</span>
          <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '4px', background: `${COLOR}14`, color: COLOR, border: `1px solid ${COLOR}28` }}>Pydicom · SimpleITK · MONAI</span>
        </div>
        <p style={{ fontSize: '11px', color: TEXT_SUB, margin: '2px 0 14px' }}>
          Parses a real DICOM file's header + pixel data and runs a MONAI DenseNet classifier trained on MedNIST (modality/anatomy classification, not diagnostic).
        </p>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '14px' }}>
          <select value={sampleId} onChange={e => setSampleId(e.target.value)} disabled={!samples.length}
            style={{ background: '#0A0F1E', border: `1px solid ${BORDER}`, borderRadius: '8px', padding: '8px 10px', color: '#fff', fontSize: '12px', outline: 'none' }}>
            {samples.length === 0 && <option>Backend unavailable…</option>}
            {samples.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <button onClick={analyzeSample} disabled={!sampleId || dicomLoading}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', border: `1px solid ${COLOR}40`, background: `${COLOR}18`, color: COLOR, fontSize: '12px', fontWeight: 600, cursor: dicomLoading ? 'wait' : 'pointer' }}>
            <Sparkles size={13} />{dicomLoading ? 'Analysing…' : 'Analyse Sample'}
          </button>
          <span style={{ fontSize: '11px', color: TEXT_SUB }}>or</span>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', border: `1px dashed ${BORDER}`, color: TEXT_SUB, fontSize: '12px', cursor: 'pointer' }}>
            <Upload size={13} />Upload .dcm file
            <input type="file" accept=".dcm" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) analyzeUpload(f) }} />
          </label>
        </div>

        {dicomError && <div style={{ fontSize: '12px', color: '#F59E0B', marginBottom: '10px' }}>{dicomError}</div>}

        {dicomResult && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
            <div style={{ background: '#0A0F1E', border: `1px solid ${BORDER}`, borderRadius: '8px', padding: '12px' }}>
              <div style={{ fontSize: '10px', color: TEXT_SUB, textTransform: 'uppercase', fontWeight: 700, marginBottom: '8px' }}>DICOM Metadata</div>
              {Object.entries(dicomResult.metadata).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                  <span style={{ color: TEXT_SUB }}>{k.replace(/_/g, ' ')}</span>
                  <span style={{ color: '#fff' }}>{Array.isArray(v) ? v.join(' × ') : v ?? '—'}</span>
                </div>
              ))}
            </div>
            <div style={{ background: '#0A0F1E', border: `1px solid ${BORDER}`, borderRadius: '8px', padding: '12px' }}>
              <div style={{ fontSize: '10px', color: TEXT_SUB, textTransform: 'uppercase', fontWeight: 700, marginBottom: '8px' }}>Pixel Stats (SimpleITK)</div>
              {Object.entries(dicomResult.pixel_stats).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                  <span style={{ color: TEXT_SUB }}>{k.replace(/_/g, ' ')}</span>
                  <span style={{ color: '#fff' }}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{ background: '#0A0F1E', border: `1px solid ${BORDER}`, borderRadius: '8px', padding: '12px' }}>
              <div style={{ fontSize: '10px', color: TEXT_SUB, textTransform: 'uppercase', fontWeight: 700, marginBottom: '8px' }}>MONAI Classification</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: COLOR }}>{dicomResult.classification.label}</div>
              <div style={{ fontSize: '11px', color: TEXT_SUB, marginTop: '4px' }}>{(dicomResult.classification.confidence * 100).toFixed(1)}% confidence</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
