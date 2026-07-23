import { useState, useEffect } from 'react'
import { usePatientContext } from '../context/PatientContext'
import { FlaskConical, Search, Plus, Pencil, Trash2, Check, X } from 'lucide-react'
import { LineChart, Line, ReferenceArea, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { useAllPatients, ensureLabResults, addLabResult, updateLabResult, deleteLabResult } from '../hooks/useClinicalData'
import type { Patient, LabResult } from '../types/clinical'

const COLOR = '#14B8A6'
const CARD_BG = '#111827'
const BORDER = '#1F2937'
const TEXT_SUB = '#9CA3AF'
const RISK_COLOR: Record<string, string> = { critical: '#EF4444', high: '#F59E0B', medium: '#0EA5E9', low: '#22C55E' }
const STATUS_COLOR = { normal: '#22C55E', high: '#F59E0B', low: '#F59E0B', critical: '#EF4444' } as const

type Panel = 'CBC' | 'BMP' | 'LFT'
const PANELS: Panel[] = ['CBC', 'BMP', 'LFT']

function statusFor(r: LabResult): keyof typeof STATUS_COLOR {
  if (r.ref_low == null || r.ref_high == null) return 'normal'
  const range = r.ref_high - r.ref_low
  if (r.value < r.ref_low - range * 0.3 || r.value > r.ref_high + range * 0.3) return 'critical'
  if (r.value < r.ref_low || r.value > r.ref_high) return r.value < r.ref_low ? 'low' : 'high'
  return 'normal'
}

function MarkerCard({ history, onUpdated, onDeleted }: {
  history: LabResult[]
  onUpdated: (updated: LabResult) => void
  onDeleted: (id: number) => void
}) {
  const latest = history[history.length - 1]
  const status = statusFor(latest)
  const chartData = history.map(r => ({ t: new Date(r.recorded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), value: r.value }))
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const [busy, setBusy] = useState(false)

  function startEdit() {
    setEditValue(String(latest.value))
    setEditing(true)
  }

  async function saveEdit() {
    if (!editValue.trim()) return
    setBusy(true)
    try {
      const updated = await updateLabResult(latest.id, { value: parseFloat(editValue) })
      onUpdated(updated)
      setEditing(false)
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    setBusy(true)
    try {
      await deleteLabResult(latest.id)
      onDeleted(latest.id)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div>
          <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#fff' }}>{latest.marker}</div>
          <div style={{ fontSize: '10px', color: TEXT_SUB }}>ref {latest.ref_low}–{latest.ref_high} {latest.unit}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          {editing ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <input autoFocus value={editValue} onChange={e => setEditValue(e.target.value)} type="number"
                onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditing(false) }}
                style={{ width: '60px', background: '#0A0F1E', border: `1px solid ${BORDER}`, borderRadius: '5px', color: '#fff', fontSize: '12px', padding: '3px 6px' }} />
              <button onClick={saveEdit} disabled={busy} style={{ background: 'transparent', border: 'none', color: '#22C55E', cursor: 'pointer', display: 'flex' }}><Check size={13} /></button>
              <button onClick={() => setEditing(false)} style={{ background: 'transparent', border: 'none', color: TEXT_SUB, cursor: 'pointer', display: 'flex' }}><X size={13} /></button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ fontSize: '15px', fontWeight: 700, color: STATUS_COLOR[status] }}>{latest.value} <span style={{ fontSize: '10px', color: TEXT_SUB, fontWeight: 400 }}>{latest.unit}</span></div>
              <button onClick={startEdit} title="Edit latest value" style={{ background: 'transparent', border: 'none', color: TEXT_SUB, cursor: 'pointer', display: 'flex' }}><Pencil size={11} /></button>
              <button onClick={remove} disabled={busy} title="Delete latest value" style={{ background: 'transparent', border: 'none', color: TEXT_SUB, cursor: busy ? 'not-allowed' : 'pointer', display: 'flex' }}><Trash2 size={11} /></button>
            </div>
          )}
          <span style={{ fontSize: '9px', padding: '1px 6px', borderRadius: '3px', background: `${STATUS_COLOR[status]}14`, color: STATUS_COLOR[status], border: `1px solid ${STATUS_COLOR[status]}28`, fontWeight: 700 }}>{status.toUpperCase()}</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={90}>
        <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -30 }}>
          {latest.ref_low != null && latest.ref_high != null && (
            <ReferenceArea y1={latest.ref_low} y2={latest.ref_high} fill="#22C55E" fillOpacity={0.08} strokeOpacity={0} />
          )}
          <XAxis dataKey="t" tick={{ fill: '#4B5563', fontSize: 9 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#4B5563', fontSize: 9 }} axisLine={false} tickLine={false} width={30} />
          <Tooltip contentStyle={{ background: '#0D1425', border: `1px solid ${BORDER}`, borderRadius: '8px', fontSize: '11px' }} labelStyle={{ color: '#9CA3AF' }} />
          <Line type="monotone" dataKey="value" stroke={STATUS_COLOR[status]} strokeWidth={2} dot={{ r: 3, fill: STATUS_COLOR[status] }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export default function LabResultsPage() {
  const patients = useAllPatients()
  const { selectedPatient: selected, setSelectedPatient: setSelected } = usePatientContext()
  const [search, setSearch] = useState('')
  const [panel, setPanel] = useState<Panel>('CBC')
  const [history, setHistory] = useState<LabResult[]>([])
  const [loading, setLoading] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newResult, setNewResult] = useState({ marker: '', value: '', unit: '', ref_low: '', ref_high: '' })

  const filtered = search.trim()
    ? patients.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.id.toLowerCase().includes(search.toLowerCase()))
    : patients

  useEffect(() => {
    if (!selected) { setHistory([]); return }
    let cancelled = false
    setLoading(true)
    ensureLabResults(selected).then(rows => { if (!cancelled) { setHistory(rows); setLoading(false) } })
    return () => { cancelled = true }
  }, [selected?.id])

  function selectPatient(p: Patient) {
    setSelected(selected?.id === p.id ? null : p)
    setShowAddForm(false)
  }

  const panelMarkers = Array.from(new Set(history.filter(r => r.panel === panel).map(r => r.marker)))
  const groupedByMarker = panelMarkers.map(marker => history.filter(r => r.panel === panel && r.marker === marker).sort((a, b) => a.recorded_at.localeCompare(b.recorded_at)))

  async function submitNewResult() {
    if (!selected || !newResult.marker.trim() || !newResult.value.trim() || !newResult.unit.trim()) return
    await addLabResult({
      patient_id: selected.id, panel,
      marker: newResult.marker.trim(),
      value: parseFloat(newResult.value),
      unit: newResult.unit.trim(),
      ref_low: newResult.ref_low ? parseFloat(newResult.ref_low) : null,
      ref_high: newResult.ref_high ? parseFloat(newResult.ref_high) : null,
    })
    const refreshed = await ensureLabResults(selected)
    setHistory(refreshed)
    setNewResult({ marker: '', value: '', unit: '', ref_low: '', ref_high: '' })
    setShowAddForm(false)
  }

  return (
    <div style={{ padding: '24px', minHeight: '100%', background: '#0A0F1E' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: `${COLOR}18`, border: `1px solid ${COLOR}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <FlaskConical size={20} color={COLOR} />
        </div>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#fff', margin: 0 }}>Lab Results Trend Analyzer</h1>
          <p style={{ fontSize: '12px', color: TEXT_SUB, margin: 0 }}>Panel values, abnormal flags, and trends over time</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '16px' }}>
        <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', overflow: 'hidden', alignSelf: 'start' }}>
          <div style={{ padding: '10px 12px', borderBottom: `1px solid ${BORDER}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', background: '#0A0F1E', border: `1px solid ${BORDER}`, borderRadius: '7px', padding: '6px 10px' }}>
              <Search size={12} color={TEXT_SUB} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search patients…"
                style={{ background: 'none', border: 'none', outline: 'none', color: '#fff', fontSize: '12px', flex: 1 }} />
            </div>
          </div>
          <div style={{ maxHeight: '460px', overflowY: 'auto' }}>
            {filtered.map(p => {
              const sel = selected?.id === p.id
              const rc = RISK_COLOR[p.risk] ?? COLOR
              return (
                <div key={p.id} onClick={() => selectPatient(p)}
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

        {!selected ? (
          <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px', flexDirection: 'column', gap: '10px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: `${COLOR}14`, border: `1px solid ${COLOR}28`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FlaskConical size={22} color={COLOR} />
            </div>
            <p style={{ fontSize: '14px', color: '#fff', margin: 0, fontWeight: 500 }}>Select a patient</p>
            <p style={{ fontSize: '13px', color: TEXT_SUB, margin: 0 }}>View lab panel trends and abnormal flags</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                {PANELS.map(p => (
                  <button key={p} onClick={() => setPanel(p)}
                    style={{ padding: '7px 14px', borderRadius: '8px', border: `1px solid ${panel === p ? COLOR + '60' : BORDER}`, background: panel === p ? `${COLOR}18` : CARD_BG, color: panel === p ? COLOR : TEXT_SUB, fontSize: '12px', fontWeight: panel === p ? 600 : 400, cursor: 'pointer' }}>
                    {p}
                  </button>
                ))}
              </div>
              <button onClick={() => setShowAddForm(v => !v)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '8px', border: `1px solid ${COLOR}40`, background: `${COLOR}18`, color: COLOR, fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                <Plus size={13} /> Add Result
              </button>
            </div>

            {showAddForm && (
              <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '14px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div>
                  <div style={{ fontSize: '10px', color: TEXT_SUB, marginBottom: '4px' }}>Marker (in {panel})</div>
                  <input value={newResult.marker} onChange={e => setNewResult(v => ({ ...v, marker: e.target.value }))} placeholder="e.g. WBC"
                    style={{ background: '#0A0F1E', border: `1px solid ${BORDER}`, borderRadius: '6px', color: '#fff', fontSize: '12px', padding: '7px 10px', width: '110px' }} />
                </div>
                <div>
                  <div style={{ fontSize: '10px', color: TEXT_SUB, marginBottom: '4px' }}>Value</div>
                  <input value={newResult.value} onChange={e => setNewResult(v => ({ ...v, value: e.target.value }))} placeholder="7.2"
                    style={{ background: '#0A0F1E', border: `1px solid ${BORDER}`, borderRadius: '6px', color: '#fff', fontSize: '12px', padding: '7px 10px', width: '70px' }} />
                </div>
                <div>
                  <div style={{ fontSize: '10px', color: TEXT_SUB, marginBottom: '4px' }}>Unit</div>
                  <input value={newResult.unit} onChange={e => setNewResult(v => ({ ...v, unit: e.target.value }))} placeholder="10^9/L"
                    style={{ background: '#0A0F1E', border: `1px solid ${BORDER}`, borderRadius: '6px', color: '#fff', fontSize: '12px', padding: '7px 10px', width: '80px' }} />
                </div>
                <div>
                  <div style={{ fontSize: '10px', color: TEXT_SUB, marginBottom: '4px' }}>Ref low</div>
                  <input value={newResult.ref_low} onChange={e => setNewResult(v => ({ ...v, ref_low: e.target.value }))} placeholder="4.0"
                    style={{ background: '#0A0F1E', border: `1px solid ${BORDER}`, borderRadius: '6px', color: '#fff', fontSize: '12px', padding: '7px 10px', width: '70px' }} />
                </div>
                <div>
                  <div style={{ fontSize: '10px', color: TEXT_SUB, marginBottom: '4px' }}>Ref high</div>
                  <input value={newResult.ref_high} onChange={e => setNewResult(v => ({ ...v, ref_high: e.target.value }))} placeholder="11.0"
                    style={{ background: '#0A0F1E', border: `1px solid ${BORDER}`, borderRadius: '6px', color: '#fff', fontSize: '12px', padding: '7px 10px', width: '70px' }} />
                </div>
                <button onClick={submitNewResult} disabled={!newResult.marker.trim() || !newResult.value.trim() || !newResult.unit.trim()}
                  style={{ padding: '8px 16px', borderRadius: '6px', border: `1px solid ${COLOR}40`, background: `${COLOR}18`, color: COLOR, fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                  Save
                </button>
              </div>
            )}

            {loading ? (
              <div style={{ color: TEXT_SUB, fontSize: '13px', padding: '40px', textAlign: 'center' }}>Loading lab history…</div>
            ) : groupedByMarker.length === 0 ? (
              <div style={{ color: TEXT_SUB, fontSize: '13px', padding: '40px', textAlign: 'center' }}>No {panel} results recorded yet.</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
                {groupedByMarker.map(hist => (
                  <MarkerCard key={hist[0].marker} history={hist}
                    onUpdated={updated => setHistory(prev => prev.map(r => r.id === updated.id ? updated : r))}
                    onDeleted={id => setHistory(prev => prev.filter(r => r.id !== id))} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
