import { useState, type CSSProperties } from 'react'
import { X, Save } from 'lucide-react'
import type { ClinicalAlert, Patient } from '../../types/clinical'
import { severityColor, severityLabel, type AlertSeverity } from '../../lib/severity'

export interface AlertFormData {
  type: string
  patient: string
  patient_id: string | null
  detail: string
  severity: AlertSeverity
  color: string
  source: string
  category: string | null
}

interface AlertFormModalProps {
  mode: 'add' | 'edit'
  initial?: ClinicalAlert
  patients: Patient[]
  onClose: () => void
  onSubmit: (data: AlertFormData) => Promise<void>
}

const CARD_BG = '#111827'
const BORDER = '#1F2937'
const SURFACE = '#0A0F1E'

const fieldLabel: CSSProperties = { fontSize: '10.5px', fontWeight: 600, color: '#8B95A8', marginBottom: '6px', letterSpacing: '0.03em', textTransform: 'uppercase' }

const inputStyle: CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '9px 12px', fontSize: '12.5px', color: '#E5E7EB',
  background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '9px',
  outline: 'none',
}

export default function AlertFormModal({ mode, initial, patients, onClose, onSubmit }: AlertFormModalProps) {
  const [type, setType]         = useState(initial?.type ?? '')
  const [patient, setPatient]   = useState(initial?.patient ?? '')
  const [detail, setDetail]     = useState(initial?.detail ?? '')
  const [severity, setSeverity] = useState<AlertSeverity>((initial?.severity as AlertSeverity) ?? 'medium')
  const [source, setSource]     = useState(initial?.source ?? 'Manual Entry')
  const [category, setCategory] = useState(initial?.category ?? '')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState<string | null>(null)

  const matchedPatient = patients.find(p => p.name.toLowerCase() === patient.trim().toLowerCase())

  const submit = async () => {
    if (!type.trim() || !patient.trim() || !detail.trim()) {
      setError('Type, patient, and detail are required.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSubmit({
        type: type.trim(),
        patient: patient.trim(),
        patient_id: matchedPatient?.id ?? initial?.patient_id ?? null,
        detail: detail.trim(),
        severity,
        color: severityColor[severity],
        source: source.trim() || 'Manual Entry',
        category: category.trim() || null,
      })
    } catch {
      setError('Could not save the alert. Please try again.')
      setSaving(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(4,6,14,0.6)',
    }} onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        width: '420px', maxWidth: 'calc(100vw - 32px)', borderRadius: '14px', overflow: 'hidden',
        background: CARD_BG,
        border: `1px solid ${BORDER}`, boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${BORDER}` }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#fff', margin: 0 }}>
            {mode === 'add' ? 'New Clinical Alert' : 'Edit Clinical Alert'}
          </h3>
          <button onClick={onClose} style={{
            width: '28px', height: '28px', borderRadius: '8px', border: `1px solid ${BORDER}`,
            background: SURFACE, color: '#8B95A8', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <X size={13} />
          </button>
        </div>

        <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <div style={fieldLabel}>Alert Type</div>
            <input style={inputStyle} value={type} onChange={e => setType(e.target.value)} placeholder="e.g. Sepsis Alert" />
          </div>

          <div>
            <div style={fieldLabel}>Patient</div>
            <input style={inputStyle} value={patient} onChange={e => setPatient(e.target.value)} placeholder="Patient name" list="alert-form-patients" />
            <datalist id="alert-form-patients">
              {patients.map(p => <option key={p.id} value={p.name} />)}
            </datalist>
            {matchedPatient && (
              <div style={{ fontSize: '10px', color: '#4B5563', marginTop: '5px' }}>
                Linked to {matchedPatient.id} · {matchedPatient.ward}
              </div>
            )}
          </div>

          <div>
            <div style={fieldLabel}>Detail</div>
            <textarea style={{ ...inputStyle, minHeight: '64px', resize: 'vertical', fontFamily: 'inherit' }}
              value={detail} onChange={e => setDetail(e.target.value)} placeholder="Clinical detail shown on the alert" />
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <div style={fieldLabel}>Severity</div>
              <select style={{ ...inputStyle, cursor: 'pointer' }} value={severity} onChange={e => setSeverity(e.target.value as AlertSeverity)}>
                {(['critical', 'high', 'medium', 'info'] as AlertSeverity[]).map(s => (
                  <option key={s} value={s} style={{ background: CARD_BG }}>{severityLabel[s]}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <div style={fieldLabel}>Source</div>
              <input style={inputStyle} value={source} onChange={e => setSource(e.target.value)} placeholder="Manual Entry" />
            </div>
          </div>

          <div>
            <div style={fieldLabel}>Category (optional)</div>
            <input style={inputStyle} value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g. sepsis, cardiac" />
          </div>

          {error && <div style={{ fontSize: '11.5px', color: '#EF4444' }}>{error}</div>}
        </div>

        <div style={{ display: 'flex', gap: '10px', padding: '16px 20px', borderTop: `1px solid ${BORDER}` }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '10px', borderRadius: '10px', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
            border: `1px solid ${BORDER}`, background: SURFACE, color: '#8B95A8',
          }}>
            Cancel
          </button>
          <button onClick={submit} disabled={saving} style={{
            flex: 1, padding: '10px', borderRadius: '10px', cursor: saving ? 'default' : 'pointer', fontSize: '12px', fontWeight: 700,
            border: '1px solid #0EA5E9', background: '#0EA5E9',
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', opacity: saving ? 0.6 : 1,
          }}>
            <Save size={13} />
            {saving ? 'Saving…' : mode === 'add' ? 'Create Alert' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
