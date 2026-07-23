import { useEffect, useState } from 'react'
import { ClipboardList, Sparkles, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { usePatientContext } from '../../context/PatientContext'
import { useAllPatients, createActivity, ensureLabResults, runClinical } from '../../hooks/useClinicalData'
import { getOrCreateDeviceId } from '../../context/AssistantContext'
import type { Patient, LabResult, ClinicalRunRecord } from '../../types/clinical'
import PatientListColumn, { EmptyState } from './PatientListColumn'
import { CARD_BG, BORDER, TEXT_SUB, STATUS_COLOR } from './shared'
import { ContentText, ErrorBanner } from './TextBits'

const COLOR = '#14B8A6'

type LabStatus = 'normal' | 'high' | 'low' | 'critical'
type LabValue = { name: string; value: string; unit: string; ref: string; status: LabStatus }
type LabPanel = { name: string; values: LabValue[] }
const PANEL_LABELS: Record<string, string> = { CBC: 'Full Blood Count', BMP: 'Metabolic Panel', LFT: 'Liver Function' }

function computeLabStatus(value: number, refLow: number | null, refHigh: number | null): LabStatus {
  if (refLow == null || refHigh == null) return 'normal'
  if (value < refLow) return (refLow - value) / refLow > 0.25 ? 'critical' : 'low'
  if (value > refHigh) return (value - refHigh) / refHigh > 0.25 ? 'critical' : 'high'
  return 'normal'
}

function toLabPanels(rows: LabResult[]): LabPanel[] {
  const latest = new Map<string, LabResult>()
  for (const r of rows) {
    const key = `${r.panel}:${r.marker}`
    const existing = latest.get(key)
    if (!existing || new Date(r.recorded_at) > new Date(existing.recorded_at)) latest.set(key, r)
  }
  const byPanel = new Map<string, LabValue[]>()
  for (const r of latest.values()) {
    const values = byPanel.get(r.panel) ?? []
    values.push({
      name: r.marker,
      value: String(r.value),
      unit: r.unit,
      ref: r.ref_low != null && r.ref_high != null ? `${r.ref_low}–${r.ref_high}` : '—',
      status: computeLabStatus(r.value, r.ref_low, r.ref_high),
    })
    byPanel.set(r.panel, values)
  }
  return [...byPanel.entries()].map(([panel, values]) => ({ name: PANEL_LABELS[panel] ?? panel, values }))
}

function StatusIcon({ status }: { status: LabStatus }) {
  const c = STATUS_COLOR[status]
  if (status === 'high' || status === 'critical') return <TrendingUp size={11} color={c} />
  if (status === 'low') return <TrendingDown size={11} color={c} />
  return <Minus size={11} color={c} />
}

export default function ReportSummaryTab({ editSeed, onConsumeEditSeed, onRunComplete }: {
  editSeed: ClinicalRunRecord | null
  onConsumeEditSeed: () => void
  onRunComplete: () => void
}) {
  const [deviceId] = useState(getOrCreateDeviceId)
  const patients = useAllPatients()
  const { selectedPatient: selected, setSelectedPatient: setSelected } = usePatientContext()
  const [search, setSearch] = useState('')
  const [processing, setProcessing] = useState(false)
  const [summary, setSummary] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [labResults, setLabResults] = useState<LabResult[]>([])
  const [parentId, setParentId] = useState<number | null>(null)

  useEffect(() => {
    if (!selected) { setLabResults([]); return }
    let cancelled = false
    ensureLabResults(selected).then(rows => { if (!cancelled) setLabResults(rows) })
    return () => { cancelled = true }
  }, [selected?.id])

  useEffect(() => {
    if (!editSeed || editSeed.mode !== 'report_summary') return
    const match = patients.find(p => p.id === editSeed.patient_id)
    if (match) setSelected(match)
    setParentId(editSeed.id)
    setSummary(null); setError(null)
    onConsumeEditSeed()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editSeed, patients])

  function selectPatient(p: Patient) {
    setSelected(selected?.id === p.id ? null : p)
    setParentId(null); setSummary(null); setError(null)
  }

  const labReport = toLabPanels(labResults)
  const allValues = labReport.flatMap(p => p.values)
  const criticalCount = allValues.filter(v => v.status === 'critical').length
  const abnormalCount = allValues.filter(v => v.status !== 'normal').length

  async function generate() {
    if (!selected || processing) return
    setProcessing(true); setSummary(null); setError(null)

    const reportText = labReport.map(p =>
      `${p.name}:\n${p.values.map(v => `  ${v.name}: ${v.value} ${v.unit} [ref ${v.ref}] — ${v.status.toUpperCase()}`).join('\n')}`
    ).join('\n\n')

    let record: ClinicalRunRecord
    try {
      record = await runClinical({
        device_id: deviceId, mode: 'report_summary',
        patient_id: selected.id, patient_name: selected.name, risk: selected.risk,
        lab_report: reportText, parent_id: parentId,
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
      icon_name: 'ClipboardList', color: COLOR,
      label: 'Health Report Summarised',
      detail: `${selected.name} — ${abnormalCount} abnormal values identified`,
      time_ago: 'just now',
    })
    setProcessing(false)
    onRunComplete()
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '16px' }}>
      <PatientListColumn patients={patients} search={search} setSearch={setSearch} selected={selected} onSelect={selectPatient} color={COLOR} />

      {!selected ? (
        <EmptyState color={COLOR} icon={ClipboardList} title="Select a patient" subtitle="View lab results and generate AI summary" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>{selected.name}</div>
                <div style={{ fontSize: '11px', color: TEXT_SUB }}>{selected.id} · Age {selected.age} · {selected.ward}</div>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {criticalCount > 0 && <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '4px', background: '#EF444414', color: '#EF4444', border: '1px solid #EF444428', fontWeight: 700 }}>{criticalCount} CRITICAL</span>}
                {abnormalCount > 0 && <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '4px', background: '#F59E0B14', color: '#F59E0B', border: '1px solid #F59E0B28', fontWeight: 700 }}>{abnormalCount} ABNORMAL</span>}
              </div>
            </div>
            <button onClick={generate} disabled={processing}
              style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '8px 16px', borderRadius: '8px', border: `1px solid ${COLOR}40`, background: `${COLOR}18`, color: COLOR, fontSize: '12px', fontWeight: 600, cursor: processing ? 'not-allowed' : 'pointer' }}>
              <Sparkles size={13} />
              {processing ? 'Analysing…' : parentId ? 'Re-run & Save New Version' : 'AI Summary'}
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {labReport.map(panel => (
              <div key={panel.name} style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', overflow: 'hidden' }}>
                <div style={{ padding: '10px 14px', borderBottom: `1px solid ${BORDER}`, fontSize: '12px', fontWeight: 600, color: '#fff' }}>{panel.name}</div>
                {panel.values.map(v => (
                  <div key={v.name} style={{ display: 'flex', alignItems: 'center', padding: '8px 14px', borderBottom: `1px solid ${BORDER}20`, gap: '8px' }}>
                    <StatusIcon status={v.status} />
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: '12px', color: '#E5E7EB' }}>{v.name}</span>
                      <span style={{ fontSize: '10px', color: TEXT_SUB, marginLeft: '6px' }}>ref {v.ref} {v.unit}</span>
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: STATUS_COLOR[v.status] }}>{v.value}</span>
                    <span style={{ fontSize: '10px', color: TEXT_SUB, marginRight: '4px' }}>{v.unit}</span>
                    <span style={{ fontSize: '9px', padding: '1px 6px', borderRadius: '3px', background: `${STATUS_COLOR[v.status]}14`, color: STATUS_COLOR[v.status], border: `1px solid ${STATUS_COLOR[v.status]}28`, fontWeight: 700, minWidth: '46px', textAlign: 'center' }}>
                      {v.status.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {error && <ErrorBanner message={error} />}

          {(processing || summary) && (
            <div style={{ background: CARD_BG, border: `1px solid ${COLOR}30`, borderRadius: '12px', padding: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <Sparkles size={14} color={COLOR} />
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>AI Clinical Interpretation</span>
                <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '4px', background: `${COLOR}14`, color: COLOR, border: `1px solid ${COLOR}28` }}>Groq · llama-3.3-70b</span>
              </div>
              {processing ? (
                <div style={{ color: TEXT_SUB, fontSize: '13px' }}>Analysing lab values…</div>
              ) : (
                <ContentText text={summary!} color={COLOR} />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
