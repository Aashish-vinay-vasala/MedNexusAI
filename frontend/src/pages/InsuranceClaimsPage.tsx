import { useState } from 'react'
import { usePatientContext } from '../context/PatientContext'
import { Receipt, Search, Sparkles, Download, Send } from 'lucide-react'
import jsPDF from 'jspdf'
import { useAllPatients, useEHRDiagnoses, useClaims, addClaim, updateClaimStatus } from '../hooks/useClinicalData'
import { BACKEND_URL } from '../lib/backend'
import type { Patient, InsuranceClaim } from '../types/clinical'

const COLOR = '#F59E0B'
const CARD_BG = '#111827'
const BORDER = '#1F2937'
const TEXT_SUB = '#9CA3AF'
const RISK_COLOR: Record<string, string> = { critical: '#EF4444', high: '#F59E0B', medium: '#0EA5E9', low: '#22C55E' }
const STATUS_COLOR: Record<InsuranceClaim['status'], string> = { draft: '#6B7280', submitted: '#0EA5E9', paid: '#22C55E', denied: '#EF4444' }

type ClaimPreview = {
  patient_id: string; patient_name: string; ward: string
  icd10_codes: string[]
  line_items: { code: string; description: string; amount: number }[]
  base_fee: number; procedure_summary: string; amount: number
}

function downloadClaimPDF(claim: ClaimPreview) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  doc.setFillColor(10, 15, 30); doc.rect(0, 0, 210, 30, 'F')
  doc.setTextColor(245, 158, 11); doc.setFontSize(18); doc.setFont('helvetica', 'bold')
  doc.text('MedNexusAI', 20, 15)
  doc.setTextColor(200, 210, 225); doc.setFontSize(10); doc.setFont('helvetica', 'normal')
  doc.text('Insurance Claim', 20, 23)

  let y = 44
  doc.setTextColor(40, 55, 75); doc.setFontSize(11)
  doc.text(`Patient: ${claim.patient_name} (${claim.patient_id})`, 20, y); y += 7
  doc.text(`Ward: ${claim.ward}`, 20, y); y += 7
  doc.text(`Procedure: ${claim.procedure_summary}`, 20, y); y += 10

  doc.setFont('helvetica', 'bold'); doc.text('ICD-10 Line Items', 20, y); y += 7
  doc.setFont('helvetica', 'normal')
  claim.line_items.forEach(item => {
    doc.text(`${item.code} — ${item.description}`, 20, y)
    doc.text(`$${item.amount.toFixed(2)}`, 170, y)
    y += 6
  })
  y += 4
  doc.setFont('helvetica', 'bold')
  doc.text(`Total Amount: $${claim.amount.toFixed(2)}`, 20, y)
  doc.save(`claim-${claim.patient_id}.pdf`)
}

export default function InsuranceClaimsPage() {
  const patients = useAllPatients()
  const { selectedPatient: selected, setSelectedPatient: setSelected } = usePatientContext()
  const [search, setSearch] = useState('')
  const [procedureSummary, setProcedureSummary] = useState('')
  const [generating, setGenerating] = useState(false)
  const [preview, setPreview] = useState<ClaimPreview | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusOverrides, setStatusOverrides] = useState<Record<number, InsuranceClaim['status']>>({})
  const [updatingId, setUpdatingId] = useState<number | null>(null)

  const diagnoses = useEHRDiagnoses(selected?.id)
  const claims = useClaims(selected?.id)

  async function changeClaimStatus(id: number, status: InsuranceClaim['status']) {
    setUpdatingId(id)
    try {
      await updateClaimStatus(id, status)
      setStatusOverrides(prev => ({ ...prev, [id]: status }))
    } finally {
      setUpdatingId(null)
    }
  }

  const filtered = search.trim()
    ? patients.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.id.toLowerCase().includes(search.toLowerCase()))
    : patients

  function selectPatient(p: Patient) {
    setSelected(selected?.id === p.id ? null : p)
    setPreview(null); setError(null)
  }

  async function generateClaim() {
    if (!selected || generating) return
    setGenerating(true); setError(null); setPreview(null)
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/claims/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patient: selected, diagnoses, procedure_summary: procedureSummary.trim() || null }),
        signal: AbortSignal.timeout(10000),
      })
      if (!res.ok) throw new Error(`Backend error ${res.status}`)
      setPreview(await res.json())
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : 'Failed to generate claim')
    }
    setGenerating(false)
  }

  async function submitClaim() {
    if (!selected || !preview || submitting) return
    setSubmitting(true)
    await addClaim({ patient_id: selected.id, icd10_codes: preview.icd10_codes, procedure_summary: preview.procedure_summary, status: 'submitted', amount: preview.amount })
    setSubmitting(false)
    setPreview(null)
  }

  return (
    <div style={{ padding: '24px', minHeight: '100%', background: '#0A0F1E' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: `${COLOR}18`, border: `1px solid ${COLOR}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Receipt size={20} color={COLOR} />
        </div>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#fff', margin: 0 }}>Insurance Claims Generator</h1>
          <p style={{ fontSize: '12px', color: TEXT_SUB, margin: 0 }}>Build a payer-ready claim from a patient's diagnoses</p>
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
              <Receipt size={22} color={COLOR} />
            </div>
            <p style={{ fontSize: '14px', color: '#fff', margin: 0, fontWeight: 500 }}>Select a patient</p>
            <p style={{ fontSize: '13px', color: TEXT_SUB, margin: 0 }}>Generate a claim from their recorded diagnoses</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>{selected.name}</div>
                  <div style={{ fontSize: '11px', color: TEXT_SUB }}>{selected.id} · {diagnoses.length} diagnoses on record</div>
                </div>
                <button onClick={generateClaim} disabled={generating || diagnoses.length === 0}
                  style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '8px 16px', borderRadius: '8px', border: `1px solid ${COLOR}40`, background: `${COLOR}18`, color: COLOR, fontSize: '12px', fontWeight: 600, cursor: generating || diagnoses.length === 0 ? 'not-allowed' : 'pointer' }}>
                  <Sparkles size={13} />
                  {generating ? 'Generating…' : 'Generate Claim'}
                </button>
              </div>
              <input value={procedureSummary} onChange={e => setProcedureSummary(e.target.value)} placeholder="Procedure summary (optional)…"
                style={{ width: '100%', background: '#0A0F1E', border: `1px solid ${BORDER}`, borderRadius: '7px', color: '#E5E7EB', fontSize: '12px', padding: '8px 10px', outline: 'none', boxSizing: 'border-box' }} />
              {diagnoses.length === 0 && <div style={{ fontSize: '11px', color: '#F59E0B', marginTop: '8px' }}>No diagnoses recorded for this patient yet — add some in Electronic Health Records first.</div>}
            </div>

            {error && <div style={{ background: '#EF444414', border: '1px solid #EF444428', borderRadius: '10px', padding: '12px 16px', fontSize: '12px', color: '#F59E0B' }}>{error}</div>}

            {preview && (
              <div style={{ background: CARD_BG, border: `1px solid ${COLOR}30`, borderRadius: '12px', padding: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>Claim Preview</span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => downloadClaimPDF(preview)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '7px', border: `1px solid ${BORDER}`, background: 'transparent', color: TEXT_SUB, fontSize: '11px', cursor: 'pointer' }}>
                      <Download size={12} /> PDF
                    </button>
                    <button onClick={submitClaim} disabled={submitting}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '7px', border: '1px solid #22C55E40', background: '#22C55E18', color: '#22C55E', fontSize: '11px', fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer' }}>
                      <Send size={12} /> {submitting ? 'Submitting…' : 'Submit Claim'}
                    </button>
                  </div>
                </div>
                {preview.line_items.map(item => (
                  <div key={item.code} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: `1px solid ${BORDER}40`, fontSize: '12px' }}>
                    <span style={{ color: '#E5E7EB' }}>{item.code} — {item.description}</span>
                    <span style={{ color: COLOR, fontWeight: 600 }}>${item.amount.toFixed(2)}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 0', fontSize: '13px', fontWeight: 700 }}>
                  <span style={{ color: '#fff' }}>Total</span>
                  <span style={{ color: COLOR }}>${preview.amount.toFixed(2)}</span>
                </div>
              </div>
            )}

            <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: `1px solid ${BORDER}`, fontSize: '13px', fontWeight: 600, color: '#fff' }}>
                Claim History
              </div>
              {claims.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: TEXT_SUB, fontSize: '12px' }}>No claims submitted for this patient yet.</div>
              ) : (
                claims.map(c => {
                  const status = statusOverrides[c.id] ?? c.status
                  return (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: `1px solid ${BORDER}40` }}>
                      <div>
                        <div style={{ fontSize: '12px', color: '#E5E7EB' }}>{c.icd10_codes.join(', ')}</div>
                        <div style={{ fontSize: '10.5px', color: TEXT_SUB }}>{new Date(c.created_at).toLocaleDateString()}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#E5E7EB' }}>${(c.amount ?? 0).toFixed(2)}</span>
                        <select
                          value={status}
                          disabled={updatingId === c.id}
                          onChange={e => changeClaimStatus(c.id, e.target.value as InsuranceClaim['status'])}
                          style={{
                            fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px',
                            background: `${STATUS_COLOR[status]}14`, color: STATUS_COLOR[status],
                            border: `1px solid ${STATUS_COLOR[status]}28`, cursor: updatingId === c.id ? 'not-allowed' : 'pointer',
                          }}>
                          <option value="draft">DRAFT</option>
                          <option value="submitted">SUBMITTED</option>
                          <option value="paid">PAID</option>
                          <option value="denied">DENIED</option>
                        </select>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
