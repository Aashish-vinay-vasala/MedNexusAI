import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Database, Copy, Check, Search, BarChart3, Download, Sparkles, Pencil, Trash2, X, AlertCircle } from 'lucide-react'
import { useAllPatients, useFHIRResources, useFHIRResourceStats, upsertFHIRResource, deleteFHIRResource } from '../hooks/useClinicalData'
import { apiGet, apiPost, BACKEND_URL } from '../lib/backend'
import KPIMiniChart from '../components/dashboard/KPIMiniChart'
import type { Patient, FHIRResource } from '../types/clinical'

const CHART_CURSOR = { fill: 'rgba(255,255,255,0.04)' }
const CHART_TOOLTIP_STYLE = { background: '#1F2937', border: '1px solid #374151', borderRadius: '8px', fontSize: '11px' }

type CohortInsights = { condition_counts: { name: string; count: number }[]; medication_counts: { name: string; count: number }[] }

const COLOR = '#14B8A6'
const CARD_BG = '#111827'
const BORDER = '#1F2937'
const TEXT_SUB = '#9CA3AF'
const RISK_COLOR: Record<string, string> = { critical: '#EF4444', high: '#F59E0B', medium: '#0EA5E9', low: '#22C55E' }

type ResourceType = 'Patient' | 'Condition' | 'MedicationRequest' | 'Observation' | 'Encounter'

const RESOURCE_TYPES: { type: ResourceType; color: string }[] = [
  { type: 'Patient',            color: '#0EA5E9' },
  { type: 'Condition',          color: '#EF4444' },
  { type: 'MedicationRequest',  color: '#8B5CF6' },
  { type: 'Observation',        color: '#22C55E' },
  { type: 'Encounter',          color: '#F59E0B' },
]

export default function FHIRExplorerPage() {
  const patients = useAllPatients()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Patient | null>(null)
  const [resourceType, setResourceType] = useState<ResourceType>('Patient')
  const [copied, setCopied] = useState(false)

  const [insights, setInsights] = useState<CohortInsights | null>(null)
  const [insightsError, setInsightsError] = useState(false)

  const [patientDescription, setPatientDescription] = useState<string | null>(null)
  const [describingPatient, setDescribingPatient] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(false)

  const [fhirRefreshKey, setFhirRefreshKey] = useState(0)
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState('')
  const [editError, setEditError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!patients.length) return
    let cancelled = false

    async function run() {
      try {
        const resources = (await apiGet<FHIRResource[]>('/api/v1/fhir/resources'))
          .map(r => ({ resource_type: r.resource_type, resource_json: r.resource_json }))
        if (cancelled) return
        const res = await fetch(`${BACKEND_URL}/api/v1/fhir/cohort-insights`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resources }),
          signal: AbortSignal.timeout(10000),
        })
        if (!res.ok) throw new Error()
        if (!cancelled) setInsights(await res.json())
      } catch {
        if (!cancelled) setInsightsError(true)
      }
    }
    run()
    return () => { cancelled = true }
  }, [patients])

  const filtered = search.trim()
    ? patients.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.id.toLowerCase().includes(search.toLowerCase()))
    : patients

  const dbResources = useFHIRResources(selected?.id, fhirRefreshKey)
  const dbResource = dbResources.find(r => r.resource_type === resourceType)
  const resource = dbResource ? dbResource.resource_json : null
  const resourceStats = useFHIRResourceStats(fhirRefreshKey)

  function copyResource() {
    if (!resource) return
    navigator.clipboard.writeText(JSON.stringify(resource, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function selectPatient(p: Patient) {
    const next = selected?.id === p.id ? null : p
    setSelected(next)
    setPatientDescription(null)
    setEditing(false)
    setEditError(null)
  }

  function selectResourceType(rt: ResourceType) {
    setResourceType(rt)
    setEditing(false)
    setEditError(null)
  }

  function startEditing() {
    setEditText(JSON.stringify(resource ?? { resourceType }, null, 2))
    setEditError(null)
    setEditing(true)
  }

  async function saveResource() {
    if (!selected || saving) return
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(editText)
    } catch {
      setEditError('Invalid JSON — fix the syntax before saving.')
      return
    }
    setSaving(true)
    setEditError(null)
    try {
      await upsertFHIRResource(selected.id, resourceType, parsed, dbResource?.version_id)
      setEditing(false)
      setFhirRefreshKey(k => k + 1)
    } catch (exc) {
      setEditError(exc instanceof Error ? exc.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function removeResource() {
    if (!selected || !resource || deleting) return
    setDeleting(true)
    try {
      await deleteFHIRResource(selected.id, resourceType)
      setFhirRefreshKey(k => k + 1)
    } catch { /* keep resource on transient failure */ } finally {
      setDeleting(false)
    }
  }

  async function describePatient() {
    if (!selected || describingPatient) return
    setDescribingPatient(true)
    try {
      const data = await apiPost<{ description: string }>(`/api/v1/fhir/resources/${selected.id}/describe`)
      setPatientDescription(data.description)
    } catch { /* leave prior description, if any */ } finally {
      setDescribingPatient(false)
    }
  }

  async function downloadPatientPdf() {
    if (!selected || downloadingPdf) return
    setDownloadingPdf(true)
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/fhir/resources/${selected.id}/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patient_name: selected.name, description: patientDescription }),
        signal: AbortSignal.timeout(15000),
      })
      if (!res.ok) throw new Error('PDF generation failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `fhir-report-${selected.id}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch { /* no download triggered */ } finally {
      setDownloadingPdf(false)
    }
  }

  return (
    <div style={{ padding: '24px', minHeight: '100%', background: '#0A0F1E' }}>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: `${COLOR}18`, border: `1px solid ${COLOR}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Database size={20} color={COLOR} />
          </div>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#fff', margin: 0 }}>FHIR Explorer</h1>
            <p style={{ fontSize: '12px', color: TEXT_SUB, margin: 0 }}>Browse FHIR R4 resources per patient & type</p>
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
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search patients…" style={{ background: 'none', border: 'none', outline: 'none', color: '#fff', fontSize: '13px', flex: 1 }} />
            </div>
          </div>
          <div style={{ maxHeight: '580px', overflowY: 'auto' }}>
            {filtered.map(p => {
              const sel = selected?.id === p.id
              const rc = RISK_COLOR[p.risk] ?? COLOR
              return (
                <div key={p.id} onClick={() => selectPatient(p)} style={{ padding: '10px 14px', borderBottom: `1px solid ${BORDER}60`, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', background: sel ? `${COLOR}10` : 'transparent', borderLeft: sel ? `3px solid ${COLOR}` : '3px solid transparent' }}>
                  <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: `${rc}14`, border: `1px solid ${rc}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: rc }}>{p.risk[0].toUpperCase()}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                    <div style={{ fontSize: '10px', color: TEXT_SUB }}>{p.id}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Resource viewer */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* Cohort insights (FHIR-PyRate) */}
          <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <BarChart3 size={13} color={COLOR} />
              <h3 style={{ fontSize: '13px', fontWeight: 600, color: '#fff', margin: 0 }}>Cohort Insights</h3>
              <span style={{ fontSize: '9px', padding: '1px 6px', borderRadius: '4px', background: `${COLOR}14`, color: COLOR, border: `1px solid ${COLOR}28` }}>FHIR-PyRate</span>
            </div>
            <p style={{ fontSize: '10px', color: TEXT_SUB, margin: '0 0 10px' }}>Condition & medication frequency flattened from the cohort's FHIR resources</p>
            {insightsError ? (
              <div style={{ fontSize: '11px', color: '#F59E0B' }}>Backend unavailable — cohort insights require the FastAPI server.</div>
            ) : !insights ? (
              <div style={{ fontSize: '11px', color: TEXT_SUB }}>Computing…</div>
            ) : (insights.condition_counts.length === 0 && insights.medication_counts.length === 0 && resourceStats.total === 0) ? (
              <div style={{ fontSize: '11px', color: TEXT_SUB }}>No FHIR resources found for this cohort.</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px' }}>
                {insights.condition_counts.length > 0 && (
                  <div>
                    <div style={{ fontSize: '10px', color: TEXT_SUB, marginBottom: '6px' }}>Top Conditions</div>
                    <div style={{ height: '140px' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={insights.condition_counts} layout="vertical" margin={{ left: 8 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
                          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: TEXT_SUB }} />
                          <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10, fill: TEXT_SUB }} />
                          <Tooltip contentStyle={CHART_TOOLTIP_STYLE} cursor={CHART_CURSOR} />
                          <Bar dataKey="count" fill="#EF4444" radius={[0, 3, 3, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
                {insights.medication_counts.length > 0 && (
                  <div>
                    <div style={{ fontSize: '10px', color: TEXT_SUB, marginBottom: '6px' }}>Top Medications</div>
                    <div style={{ height: '140px' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={insights.medication_counts} layout="vertical" margin={{ left: 8 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
                          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: TEXT_SUB }} />
                          <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10, fill: TEXT_SUB }} />
                          <Tooltip contentStyle={CHART_TOOLTIP_STYLE} cursor={CHART_CURSOR} />
                          <Bar dataKey="count" fill="#8B5CF6" radius={[0, 3, 3, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
                {resourceStats.total > 0 && (
                  <div>
                    <div style={{ fontSize: '10px', color: TEXT_SUB, marginBottom: '6px' }}>Resource Types ({resourceStats.total})</div>
                    <div style={{ height: '140px' }}>
                      <KPIMiniChart
                        variant="bars"
                        values={resourceStats.by_type.map(t => t.count)}
                        labels={resourceStats.by_type.map(t => t.type)}
                        colors={resourceStats.by_type.map(t => RESOURCE_TYPES.find(rt => rt.type === t.type)?.color ?? COLOR)}
                        height={140}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Resource type tabs */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {RESOURCE_TYPES.map(rt => (
              <button
                key={rt.type}
                onClick={() => selectResourceType(rt.type)}
                style={{ padding: '7px 14px', borderRadius: '8px', border: `1px solid ${resourceType === rt.type ? rt.color + '60' : BORDER}`, background: resourceType === rt.type ? `${rt.color}18` : CARD_BG, color: resourceType === rt.type ? rt.color : TEXT_SUB, fontSize: '12px', fontWeight: resourceType === rt.type ? 600 : 400, cursor: 'pointer' }}
              >
                {rt.type}
              </button>
            ))}
          </div>

          {!selected ? (
            <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px', gap: '10px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: `${COLOR}14`, border: `1px solid ${COLOR}28`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Database size={22} color={COLOR} />
              </div>
              <p style={{ fontSize: '14px', color: '#fff', margin: 0, fontWeight: 500 }}>Select a patient</p>
              <p style={{ fontSize: '13px', color: TEXT_SUB, margin: 0 }}>Choose a patient to browse their FHIR resources</p>
            </div>
          ) : (
            <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>{resourceType}</span>
                  <span style={{ fontSize: '11px', color: TEXT_SUB, marginLeft: '10px' }}>{selected.name} · {selected.id}</span>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '4px', background: `${COLOR}14`, color: COLOR, border: `1px solid ${COLOR}28`, fontWeight: 700 }}>FHIR R4</span>
                  {resource && !editing && (
                    <button onClick={copyResource} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '6px', border: `1px solid ${BORDER}`, background: 'transparent', color: copied ? '#22C55E' : TEXT_SUB, fontSize: '11px', cursor: 'pointer' }}>
                      {copied ? <Check size={11} /> : <Copy size={11} />}{copied ? 'Copied!' : 'Copy JSON'}
                    </button>
                  )}
                  {!editing && (
                    <button onClick={startEditing} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '6px', border: `1px solid ${BORDER}`, background: 'transparent', color: TEXT_SUB, fontSize: '11px', cursor: 'pointer' }}>
                      <Pencil size={11} /> {resource ? 'Edit' : 'New'}
                    </button>
                  )}
                  {resource && !editing && (
                    <button onClick={removeResource} disabled={deleting} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '6px', border: '1px solid #EF444430', background: 'transparent', color: '#EF4444', fontSize: '11px', cursor: deleting ? 'not-allowed' : 'pointer' }}>
                      <Trash2 size={11} /> {deleting ? 'Deleting…' : 'Delete'}
                    </button>
                  )}
                  <button onClick={describePatient} disabled={describingPatient} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '6px', border: `1px solid ${BORDER}`, background: 'transparent', color: TEXT_SUB, fontSize: '11px', cursor: describingPatient ? 'not-allowed' : 'pointer' }}>
                    <Sparkles size={11} /> {describingPatient ? 'Describing…' : 'Describe Patient'}
                  </button>
                  <button onClick={downloadPatientPdf} disabled={downloadingPdf} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '6px', border: `1px solid ${BORDER}`, background: 'transparent', color: TEXT_SUB, fontSize: '11px', cursor: downloadingPdf ? 'not-allowed' : 'pointer' }}>
                    <Download size={11} /> {downloadingPdf ? 'Preparing…' : 'Download PDF'}
                  </button>
                </div>
              </div>
              {patientDescription && (
                <div style={{ margin: '12px 16px 0', padding: '10px 12px', borderRadius: '8px', background: `${COLOR}0C`, border: `1px solid ${COLOR}24` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <Sparkles size={11} color={COLOR} />
                    <span style={{ fontSize: '10px', fontWeight: 700, color: COLOR, textTransform: 'uppercase', letterSpacing: '0.03em' }}>AI Description</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '12px', color: '#D1D5DB', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{patientDescription}</p>
                </div>
              )}
              {editing ? (
                <div style={{ padding: '16px', background: '#070B14' }}>
                  <textarea
                    value={editText}
                    onChange={e => { setEditText(e.target.value); setEditError(null) }}
                    rows={18}
                    spellCheck={false}
                    style={{ width: '100%', background: '#0A0F1E', border: `1px solid ${editError ? '#EF4444' : BORDER}`, borderRadius: '8px', color: '#A5B4FC', fontSize: '12px', fontFamily: 'monospace', padding: '12px', resize: 'none', outline: 'none', boxSizing: 'border-box', lineHeight: 1.6 }}
                  />
                  {editError && (
                    <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px', color: '#EF4444', fontSize: '11px' }}>
                      <AlertCircle size={13} /> {editError}
                    </div>
                  )}
                  <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                    <button onClick={() => { setEditing(false); setEditError(null) }} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '7px', border: `1px solid ${BORDER}`, background: 'transparent', color: TEXT_SUB, fontSize: '12px', cursor: 'pointer' }}>
                      <X size={12} /> Cancel
                    </button>
                    <button onClick={saveResource} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '7px', border: `1px solid ${COLOR}40`, background: `${COLOR}18`, color: COLOR, fontSize: '12px', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
                      <Check size={12} /> {saving ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '16px', background: '#070B14', maxHeight: '500px', overflowY: 'auto' }}>
                  {resource ? (
                    <pre style={{ margin: 0, color: '#A5B4FC', fontSize: '12px', fontFamily: 'monospace', lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {JSON.stringify(resource, null, 2)}
                    </pre>
                  ) : (
                    <p style={{ margin: 0, color: TEXT_SUB, fontSize: '12px' }}>No {resourceType} resource on record for this patient.</p>
                  )}
                </div>
              )}
            </div>
          )}

        </div>

      </div>
    </div>
  )
}
