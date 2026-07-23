import { useState } from 'react'
import { Users2, Search, Plus, Pencil, Trash2, X, Check } from 'lucide-react'
import { useAllPatients, createPatient, updatePatient, deletePatient } from '../hooks/useClinicalData'
import type { Patient } from '../types/clinical'

const COLOR = '#0EA5E9'
const CARD_BG = '#111827'
const BORDER = '#1F2937'
const TEXT_SUB = '#9CA3AF'
const RISK_COLOR: Record<string, string> = { critical: '#EF4444', high: '#F59E0B', medium: '#0EA5E9', low: '#22C55E' }
const RISK_OPTIONS: Patient['risk'][] = ['critical', 'high', 'medium', 'low']

type Draft = { id: string; name: string; ward: string; risk: Patient['risk']; age: string; status: string }

const EMPTY_DRAFT: Draft = { id: '', name: '', ward: '', risk: 'medium', age: '', status: 'Admitted' }

const inputStyle: React.CSSProperties = {
  width: '100%', background: '#0A0F1E', border: `1px solid ${BORDER}`, borderRadius: '7px',
  color: '#fff', fontSize: '12px', padding: '8px 10px', outline: 'none', boxSizing: 'border-box',
}

export default function PatientManagementPage() {
  const patients = useAllPatients()
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const filtered = search.trim()
    ? patients.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.id.toLowerCase().includes(search.toLowerCase()))
    : patients

  function startCreate() {
    setCreating(true); setEditingId(null); setDraft(EMPTY_DRAFT); setError(null)
  }

  function startEdit(p: Patient) {
    setEditingId(p.id); setCreating(false)
    setDraft({ id: p.id, name: p.name, ward: p.ward, risk: p.risk, age: String(p.age), status: p.status })
    setError(null)
  }

  function cancelEdit() {
    setCreating(false); setEditingId(null); setError(null)
  }

  async function submitCreate() {
    const age = parseInt(draft.age, 10)
    if (!draft.id.trim() || !draft.name.trim() || !draft.ward.trim() || !draft.status.trim() || !Number.isFinite(age)) {
      setError('All fields are required and age must be a number.')
      return
    }
    setSaving(true); setError(null)
    try {
      await createPatient({ id: draft.id.trim(), name: draft.name.trim(), ward: draft.ward.trim(), risk: draft.risk, age, status: draft.status.trim() })
      setCreating(false); setDraft(EMPTY_DRAFT)
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : 'Failed to create patient')
    }
    setSaving(false)
  }

  async function submitEdit() {
    if (!editingId) return
    const age = parseInt(draft.age, 10)
    if (!draft.name.trim() || !draft.ward.trim() || !draft.status.trim() || !Number.isFinite(age)) {
      setError('All fields are required and age must be a number.')
      return
    }
    setSaving(true); setError(null)
    try {
      await updatePatient(editingId, { name: draft.name.trim(), ward: draft.ward.trim(), risk: draft.risk, age, status: draft.status.trim() })
      setEditingId(null)
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : 'Failed to update patient')
    }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      await deletePatient(id)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div style={{ padding: '24px', minHeight: '100%', background: '#0A0F1E' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: `${COLOR}18`, border: `1px solid ${COLOR}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users2 size={20} color={COLOR} />
          </div>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#fff', margin: 0 }}>Patient Management</h1>
            <p style={{ fontSize: '12px', color: TEXT_SUB, margin: 0 }}>Create, update, and remove patient records</p>
          </div>
        </div>
        <button onClick={startCreate} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', border: `1px solid ${COLOR}40`, background: `${COLOR}18`, color: COLOR, fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
          <Plus size={14} /> New Patient
        </button>
      </div>

      {(creating || editingId) && (
        <div style={{ background: CARD_BG, border: `1px solid ${COLOR}30`, borderRadius: '12px', padding: '18px', marginBottom: '16px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff', marginBottom: '14px' }}>
            {creating ? 'New Patient' : `Edit ${editingId}`}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '12px' }}>
            <div>
              <label style={{ fontSize: '10px', color: TEXT_SUB, fontWeight: 600, display: 'block', marginBottom: '5px', textTransform: 'uppercase' }}>ID *</label>
              <input value={draft.id} onChange={e => setDraft(d => ({ ...d, id: e.target.value }))} disabled={!creating} placeholder="e.g. P1001" style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: '10px', color: TEXT_SUB, fontWeight: 600, display: 'block', marginBottom: '5px', textTransform: 'uppercase' }}>Name *</label>
              <input value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} placeholder="Full name" style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: '10px', color: TEXT_SUB, fontWeight: 600, display: 'block', marginBottom: '5px', textTransform: 'uppercase' }}>Ward *</label>
              <input value={draft.ward} onChange={e => setDraft(d => ({ ...d, ward: e.target.value }))} placeholder="e.g. Ward 3" style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: '10px', color: TEXT_SUB, fontWeight: 600, display: 'block', marginBottom: '5px', textTransform: 'uppercase' }}>Risk</label>
              <select value={draft.risk} onChange={e => setDraft(d => ({ ...d, risk: e.target.value as Patient['risk'] }))} style={inputStyle}>
                {RISK_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '10px', color: TEXT_SUB, fontWeight: 600, display: 'block', marginBottom: '5px', textTransform: 'uppercase' }}>Age *</label>
              <input value={draft.age} onChange={e => setDraft(d => ({ ...d, age: e.target.value }))} placeholder="e.g. 54" style={inputStyle} />
            </div>
          </div>
          <div style={{ marginBottom: '14px' }}>
            <label style={{ fontSize: '10px', color: TEXT_SUB, fontWeight: 600, display: 'block', marginBottom: '5px', textTransform: 'uppercase' }}>Status *</label>
            <input value={draft.status} onChange={e => setDraft(d => ({ ...d, status: e.target.value }))} placeholder="e.g. Admitted" style={{ ...inputStyle, maxWidth: '240px' }} />
          </div>
          {error && <div style={{ fontSize: '12px', color: '#F59E0B', marginBottom: '12px' }}>{error}</div>}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button onClick={cancelEdit} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '7px', border: `1px solid ${BORDER}`, background: 'transparent', color: TEXT_SUB, fontSize: '12px', cursor: 'pointer' }}>
              <X size={13} /> Cancel
            </button>
            <button onClick={creating ? submitCreate : submitEdit} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 18px', borderRadius: '7px', border: `1px solid ${COLOR}40`, background: `${COLOR}18`, color: COLOR, fontSize: '12px', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
              <Check size={13} /> {saving ? 'Saving…' : creating ? 'Create Patient' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

      <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', background: '#0A0F1E', border: `1px solid ${BORDER}`, borderRadius: '8px', padding: '7px 10px', maxWidth: '320px' }}>
            <Search size={13} color={TEXT_SUB} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search patients…" style={{ background: 'none', border: 'none', outline: 'none', color: '#fff', fontSize: '13px', flex: 1 }} />
          </div>
          <span style={{ fontSize: '11px', color: TEXT_SUB }}>{filtered.length} patients</span>
        </div>
        {filtered.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: TEXT_SUB, fontSize: '12px' }}>No patients found.</div>
        ) : (
          filtered.map(p => {
            const rc = RISK_COLOR[p.risk] ?? COLOR
            return (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px', borderBottom: `1px solid ${BORDER}60` }}>
                <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: `${rc}14`, border: `1px solid ${rc}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: '10px', fontWeight: 700, color: rc }}>{p.risk[0].toUpperCase()}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>{p.name}</div>
                  <div style={{ fontSize: '11px', color: TEXT_SUB }}>{p.id} · Age {p.age} · {p.ward} · {p.status}</div>
                </div>
                <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '4px', background: `${rc}14`, color: rc, border: `1px solid ${rc}28`, fontWeight: 700 }}>
                  {p.risk.toUpperCase()}
                </span>
                <button onClick={() => startEdit(p)} title="Edit" style={{ background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: '6px', padding: '6px', color: TEXT_SUB, cursor: 'pointer' }}>
                  <Pencil size={13} />
                </button>
                <button onClick={() => handleDelete(p.id)} disabled={deletingId === p.id} title="Delete" style={{ background: 'transparent', border: '1px solid #EF444430', borderRadius: '6px', padding: '6px', color: '#EF4444', cursor: deletingId === p.id ? 'not-allowed' : 'pointer' }}>
                  <Trash2 size={13} />
                </button>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
