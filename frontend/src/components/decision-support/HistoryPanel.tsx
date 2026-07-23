import { useState } from 'react'
import { Search, Trash2, Download, History as HistoryIcon, Pencil, Check, X } from 'lucide-react'
import { useDecisionSupportHistory, deleteDecisionSupportRecord, updateDecisionSupportRecord, downloadDecisionSupportRecordPdf, downloadDecisionSupportHistoryPdf } from '../../hooks/useDecisionSupportData'
import type { DecisionSupportMode } from '../../types/clinical'
import { CARD_BG, BORDER, TEXT_SUB, MODE_LABEL, SEVERITY_COLOR } from './shared'

const MODE_FILTERS: { value: DecisionSupportMode | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'pairwise', label: 'Pairwise' },
  { value: 'regimen', label: 'Regimen' },
]

export default function HistoryPanel({ deviceId, refreshKey, onBumpRefresh }: {
  deviceId: string
  refreshKey: number
  onBumpRefresh: () => void
}) {
  const [modeFilter, setModeFilter] = useState<DecisionSupportMode | ''>('')
  const [search, setSearch] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)
  const [downloadingAll, setDownloadingAll] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')

  const history = useDecisionSupportHistory(deviceId, { mode: modeFilter || undefined }, refreshKey)
  const filtered = search.trim()
    ? history.filter(h =>
        (h.patient_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (h.patient_id ?? '').toLowerCase().includes(search.toLowerCase()) ||
        h.drugs.some(d => d.toLowerCase().includes(search.toLowerCase())))
    : history

  async function handleDelete(id: number) {
    setBusyId(id)
    try {
      await deleteDecisionSupportRecord(id, deviceId)
      onBumpRefresh()
    } catch { /* keep row on transient failure */ } finally {
      setBusyId(null)
    }
  }

  function startEdit(id: number, currentName: string | null) {
    setEditingId(id)
    setEditName(currentName ?? '')
  }

  async function saveEdit(id: number) {
    setBusyId(id)
    try {
      await updateDecisionSupportRecord(id, deviceId, { patient_name: editName.trim() || null })
      onBumpRefresh()
    } catch { /* keep previous label on transient failure */ } finally {
      setBusyId(null)
      setEditingId(null)
    }
  }

  async function handleDownload(id: number) {
    setBusyId(id)
    try {
      await downloadDecisionSupportRecordPdf(id, deviceId)
    } catch { /* no download triggered */ } finally {
      setBusyId(null)
    }
  }

  async function handleDownloadAll() {
    if (!filtered.length || downloadingAll) return
    setDownloadingAll(true)
    try {
      await downloadDecisionSupportHistoryPdf(deviceId, filtered.map(h => h.id))
    } catch { /* no download triggered */ } finally {
      setDownloadingAll(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {MODE_FILTERS.map(f => (
            <button key={f.value} onClick={() => setModeFilter(f.value)}
              style={{ padding: '6px 12px', borderRadius: '7px', border: `1px solid ${modeFilter === f.value ? '#0EA5E960' : BORDER}`, background: modeFilter === f.value ? '#0EA5E918' : CARD_BG, color: modeFilter === f.value ? '#0EA5E9' : TEXT_SUB, fontSize: '11px', fontWeight: modeFilter === f.value ? 600 : 400, cursor: 'pointer' }}>
              {f.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '7px', padding: '6px 10px' }}>
            <Search size={12} color={TEXT_SUB} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search patient or drug…"
              style={{ background: 'none', border: 'none', outline: 'none', color: '#fff', fontSize: '12px' }} />
          </div>
          <button onClick={handleDownloadAll} disabled={!filtered.length || downloadingAll}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '7px', border: '1px solid #0EA5E940', background: '#0EA5E918', color: '#0EA5E9', fontSize: '12px', fontWeight: 600, cursor: !filtered.length || downloadingAll ? 'not-allowed' : 'pointer' }}>
            <Download size={13} /> {downloadingAll ? 'Preparing…' : `Download All (${filtered.length})`}
          </button>
        </div>
      </div>

      <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', overflow: 'hidden' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: TEXT_SUB, fontSize: '13px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <HistoryIcon size={22} color={TEXT_SUB} />
            No checks yet — run an interaction check to build history.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {filtered.map(h => {
              const sevColor = SEVERITY_COLOR[h.highest_severity ?? 'none']
              return (
                <div key={h.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 14px', borderBottom: `1px solid ${BORDER}60`, gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: sevColor, flexShrink: 0 }} />
                    <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '4px', background: '#F59E0B14', color: '#F59E0B', border: '1px solid #F59E0B28', fontWeight: 700, flexShrink: 0 }}>
                      {MODE_LABEL[h.mode] ?? h.mode}
                    </span>
                    <span style={{ fontSize: '12px', color: '#fff', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {h.drugs.join(' + ')}
                    </span>
                    {editingId === h.id ? (
                      <input autoFocus value={editName} onChange={e => setEditName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveEdit(h.id); if (e.key === 'Escape') setEditingId(null) }}
                        placeholder="Patient name…"
                        style={{ background: '#0A0F1E', border: `1px solid ${BORDER}`, borderRadius: '5px', color: '#fff', fontSize: '11px', padding: '3px 7px', width: '140px', flexShrink: 0 }} />
                    ) : h.patient_name ? (
                      <span style={{ fontSize: '10px', color: TEXT_SUB, flexShrink: 0 }}>— {h.patient_name}</span>
                    ) : null}
                    <span style={{ fontSize: '9px', color: sevColor, border: `1px solid ${sevColor}40`, borderRadius: '4px', padding: '1px 6px', flexShrink: 0 }}>
                      {h.interaction_count} interaction{h.interaction_count === 1 ? '' : 's'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                    <span style={{ fontSize: '10px', color: TEXT_SUB }}>{new Date(h.created_at).toLocaleString()}</span>
                    {editingId === h.id ? (
                      <>
                        <button onClick={() => saveEdit(h.id)} disabled={busyId === h.id} title="Save"
                          style={{ background: 'transparent', border: 'none', color: '#22C55E', cursor: busyId === h.id ? 'not-allowed' : 'pointer', display: 'flex' }}>
                          <Check size={13} />
                        </button>
                        <button onClick={() => setEditingId(null)} title="Cancel"
                          style={{ background: 'transparent', border: 'none', color: TEXT_SUB, cursor: 'pointer', display: 'flex' }}>
                          <X size={13} />
                        </button>
                      </>
                    ) : (
                      <button onClick={() => startEdit(h.id, h.patient_name)} title="Edit patient label"
                        style={{ background: 'transparent', border: 'none', color: TEXT_SUB, cursor: 'pointer', display: 'flex' }}>
                        <Pencil size={13} />
                      </button>
                    )}
                    <button onClick={() => handleDownload(h.id)} disabled={busyId === h.id} title="Download PDF"
                      style={{ background: 'transparent', border: 'none', color: TEXT_SUB, cursor: busyId === h.id ? 'not-allowed' : 'pointer', display: 'flex' }}>
                      <Download size={13} />
                    </button>
                    <button onClick={() => handleDelete(h.id)} disabled={busyId === h.id} title="Delete"
                      style={{ background: 'transparent', border: 'none', color: TEXT_SUB, cursor: busyId === h.id ? 'not-allowed' : 'pointer', display: 'flex' }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
