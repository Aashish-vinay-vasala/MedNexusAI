import { useState } from 'react'
import { Search, Trash2, Download, Pencil, History as HistoryIcon } from 'lucide-react'
import { useClinicalHistory, deleteClinicalRecord, fetchClinicalRecord, downloadClinicalRecordPdf, downloadClinicalHistoryPdf } from '../../hooks/useClinicalData'
import type { ClinicalRunMode, ClinicalRunRecord } from '../../types/clinical'
import { CARD_BG, BORDER, TEXT_SUB, MODE_LABEL } from './shared'

const SUCCESS_COLOR = '#22C55E'
const ERROR_COLOR = '#EF4444'
const MODE_COLOR: Record<string, string> = {
  nlp_analyze: '#F59E0B',
  note_summary: '#EC4899',
  report_summary: '#14B8A6',
  discharge_letter: '#F59E0B',
}

const MODE_FILTERS: { value: ClinicalRunMode | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'nlp_analyze', label: 'NLP Analysis' },
  { value: 'note_summary', label: 'Note Summary' },
  { value: 'report_summary', label: 'Report Summary' },
  { value: 'discharge_letter', label: 'Discharge Letter' },
]

export default function HistoryPanel({ deviceId, refreshKey, onBumpRefresh, onEditRecord }: {
  deviceId: string
  refreshKey: number
  onBumpRefresh: () => void
  onEditRecord: (record: ClinicalRunRecord) => void
}) {
  const [modeFilter, setModeFilter] = useState<ClinicalRunMode | ''>('')
  const [search, setSearch] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)
  const [downloadingAll, setDownloadingAll] = useState(false)

  const history = useClinicalHistory(deviceId, { mode: modeFilter || undefined }, refreshKey)
  const filtered = search.trim()
    ? history.filter(h => (h.patient_name ?? '').toLowerCase().includes(search.toLowerCase()) || (h.patient_id ?? '').toLowerCase().includes(search.toLowerCase()))
    : history

  async function handleDelete(id: number) {
    setBusyId(id)
    try {
      await deleteClinicalRecord(id, deviceId)
      onBumpRefresh()
    } catch { /* keep row on transient failure */ } finally {
      setBusyId(null)
    }
  }

  async function handleEdit(id: number) {
    setBusyId(id)
    try {
      const full = await fetchClinicalRecord(id, deviceId)
      onEditRecord(full)
    } catch { /* keep list on transient failure */ } finally {
      setBusyId(null)
    }
  }

  async function handleDownload(id: number) {
    setBusyId(id)
    try {
      await downloadClinicalRecordPdf(id, deviceId)
    } catch { /* no download triggered */ } finally {
      setBusyId(null)
    }
  }

  async function handleDownloadAll() {
    if (!filtered.length || downloadingAll) return
    setDownloadingAll(true)
    try {
      await downloadClinicalHistoryPdf(deviceId, filtered.map(h => h.id))
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
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search patient…"
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
            No runs yet — analyze a note or generate text to build history.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {filtered.map(h => (
              <div key={h.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 14px', borderBottom: `1px solid ${BORDER}60`, gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: h.status === 'success' ? SUCCESS_COLOR : ERROR_COLOR, flexShrink: 0 }} />
                  <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '4px', background: `${MODE_COLOR[h.mode]}14`, color: MODE_COLOR[h.mode], border: `1px solid ${MODE_COLOR[h.mode]}28`, fontWeight: 700, flexShrink: 0 }}>
                    {MODE_LABEL[h.mode] ?? h.mode}
                  </span>
                  <span style={{ fontSize: '12px', color: '#fff', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {h.patient_name ?? 'No patient'}
                  </span>
                  {h.version > 1 && (
                    <span style={{ fontSize: '9px', color: TEXT_SUB, border: `1px solid ${BORDER}`, borderRadius: '4px', padding: '1px 6px', flexShrink: 0 }}>v{h.version}</span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                  <span style={{ fontSize: '10px', color: TEXT_SUB }}>{new Date(h.created_at).toLocaleString()}</span>
                  <button onClick={() => handleEdit(h.id)} disabled={busyId === h.id} title="Edit & Re-run"
                    style={{ background: 'transparent', border: 'none', color: TEXT_SUB, cursor: busyId === h.id ? 'not-allowed' : 'pointer', display: 'flex' }}>
                    <Pencil size={13} />
                  </button>
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
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
