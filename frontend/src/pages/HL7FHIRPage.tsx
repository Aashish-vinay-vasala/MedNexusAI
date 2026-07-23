import { useEffect, useRef, useState } from 'react'
import {
  ArrowRight, RefreshCw, Copy, Check, Zap, Upload, History, Download,
  Sparkles, Trash2, AlertCircle, ChevronDown, ChevronUp, FileText,
} from 'lucide-react'
import { useHL7Samples, useHL7History, useHL7Stats, deleteHL7Record, createActivity } from '../hooks/useClinicalData'
import { getOrCreateDeviceId } from '../context/AssistantContext'
import { apiGet, apiPost, BACKEND_URL } from '../lib/backend'
import KPIMiniChart from '../components/dashboard/KPIMiniChart'
import type { HL7ConversionRecord } from '../types/clinical'

const COLOR = '#0EA5E9'
const CARD_BG = '#111827'
const BORDER = '#1F2937'
const TEXT_SUB = '#9CA3AF'
const ERROR_COLOR = '#EF4444'
const SUCCESS_COLOR = '#22C55E'

const TYPE_PALETTE = ['#0EA5E9', '#8B5CF6', '#F59E0B', '#22C55E', '#EC4899', '#06B6D4']

export default function HL7FHIRPage() {
  const HL7_SAMPLES = useHL7Samples()
  const [selectedSample, setSelectedSample] = useState(0)
  const [hl7, setHl7] = useState('')
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [converting, setConverting] = useState(false)
  const [convertError, setConvertError] = useState<string | null>(null)
  const [record, setRecord] = useState<HL7ConversionRecord | null>(null)
  const [copied, setCopied] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [describing, setDescribing] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [deviceId] = useState(getOrCreateDeviceId)

  const history = useHL7History(deviceId, refreshKey)
  const stats = useHL7Stats(deviceId, refreshKey)

  useEffect(() => {
    if (HL7_SAMPLES.length && !hl7) setHl7(HL7_SAMPLES[0].message)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [HL7_SAMPLES.length])

  async function convert() {
    if (converting || (!uploadedFile && !hl7.trim())) return
    setConverting(true)
    setConvertError(null)

    const form = new FormData()
    form.append('device_id', deviceId)
    if (uploadedFile) {
      form.append('file', uploadedFile, uploadedFile.name)
    } else {
      form.append('hl7_text', hl7)
    }

    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/hl7/convert`, { method: 'POST', body: form, signal: AbortSignal.timeout(15000) })
      if (!res.ok) {
        const detail = await res.json().catch(() => null)
        throw new Error(detail?.detail || `Backend error ${res.status}`)
      }
      const saved: HL7ConversionRecord = await res.json()
      setRecord(saved)
      setRefreshKey(k => k + 1)
      if (saved.status === 'success') {
        await createActivity({
          icon_name: 'CheckCircle2', color: COLOR,
          label: 'HL7 Message Processed',
          detail: `${saved.message_type ?? 'HL7 message'} converted to FHIR Bundle`,
          time_ago: 'just now',
        })
      }
    } catch (exc) {
      setConvertError(exc instanceof Error ? exc.message : 'Conversion failed')
    } finally {
      setConverting(false)
    }
  }

  function copyFhir() {
    if (!record?.fhir_output) return
    navigator.clipboard.writeText(JSON.stringify(record.fhir_output, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleSampleChange(i: number) {
    setSelectedSample(i)
    setHl7(HL7_SAMPLES[i].message)
    setUploadedFile(null)
    setRecord(null)
    setConvertError(null)
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setUploadedFile(f)
    setRecord(null)
    setConvertError(null)
    f.text().then(setHl7).catch(() => {})
  }

  async function loadHistoryRecord(id: number) {
    try {
      const full = await apiGet<HL7ConversionRecord>(`/api/v1/hl7/history/${id}?device_id=${encodeURIComponent(deviceId)}`)
      setRecord(full)
      setHl7(full.hl7_input)
      setUploadedFile(null)
      setConvertError(null)
      setShowHistory(false)
    } catch { /* keep current view on transient failure */ }
  }

  async function handleDeleteHistory(id: number, e: React.MouseEvent) {
    e.stopPropagation()
    try {
      await deleteHL7Record(id, deviceId)
      if (record?.id === id) setRecord(null)
      setRefreshKey(k => k + 1)
    } catch { /* keep row on transient failure */ }
  }

  async function describeResult() {
    if (!record || record.status !== 'success' || describing) return
    setDescribing(true)
    try {
      const data = await apiPost<{ description: string }>(`/api/v1/hl7/history/${record.id}/describe?device_id=${encodeURIComponent(deviceId)}`)
      setRecord(r => (r ? { ...r, description: data.description } : r))
    } catch { /* leave prior description, if any */ } finally {
      setDescribing(false)
    }
  }

  async function downloadPdf() {
    if (!record || downloadingPdf) return
    setDownloadingPdf(true)
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/hl7/history/${record.id}/pdf?device_id=${encodeURIComponent(deviceId)}`)
      if (!res.ok) throw new Error('PDF generation failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `hl7-fhir-conversion-${record.id}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch { /* no download triggered */ } finally {
      setDownloadingPdf(false)
    }
  }

  const fhir = record?.fhir_output ?? null
  const isError = record?.status === 'error'

  return (
    <div style={{ padding: '24px', minHeight: '100%', background: '#0A0F1E' }}>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: `${COLOR}18`, border: `1px solid ${COLOR}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ArrowRight size={20} color={COLOR} />
          </div>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#fff', margin: 0 }}>HL7 → FHIR Converter</h1>
            <p style={{ fontSize: '12px', color: TEXT_SUB, margin: 0 }}>Transform HL7 v2 messages into FHIR R4 bundles</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => setShowHistory(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '7px', border: `1px solid ${showHistory ? COLOR + '60' : BORDER}`, background: showHistory ? `${COLOR}18` : CARD_BG, color: showHistory ? COLOR : TEXT_SUB, fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
          >
            <History size={13} /> History ({history.length}) {showHistory ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          <span style={{ fontSize: '11px', color: '#22C55E', background: '#22C55E14', padding: '3px 8px', borderRadius: '4px', border: '1px solid #22C55E30' }}>LIVE</span>
        </div>
      </div>

      {/* History panel */}
      {showHistory && (
        <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '12px', marginBottom: '16px' }}>
          {history.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', color: TEXT_SUB, fontSize: '12px' }}>No conversions yet — paste or upload an HL7 message to get started.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '260px', overflowY: 'auto' }}>
              {history.map(h => (
                <div
                  key={h.id}
                  onClick={() => loadHistoryRecord(h.id)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: '8px', cursor: 'pointer', background: record?.id === h.id ? `${COLOR}14` : 'transparent' }}
                  onMouseEnter={e => { if (record?.id !== h.id) e.currentTarget.style.background = '#1F293780' }}
                  onMouseLeave={e => { if (record?.id !== h.id) e.currentTarget.style.background = 'transparent' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: h.status === 'success' ? SUCCESS_COLOR : ERROR_COLOR, flexShrink: 0 }} />
                    <span style={{ fontSize: '11px', color: '#fff', fontWeight: 600 }}>{h.message_type ?? '—'}</span>
                    <span style={{ fontSize: '11px', color: TEXT_SUB, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {h.source === 'upload' ? h.filename : 'Pasted message'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                    <span style={{ fontSize: '10px', color: TEXT_SUB }}>{new Date(h.created_at).toLocaleString()}</span>
                    <button onClick={e => handleDeleteHistory(h.id, e)} style={{ background: 'transparent', border: 'none', color: TEXT_SUB, cursor: 'pointer', display: 'flex' }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sample selector + upload */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
        {HL7_SAMPLES.map((s, i) => (
          <button key={i} onClick={() => handleSampleChange(i)} style={{ padding: '7px 14px', borderRadius: '8px', border: `1px solid ${selectedSample === i && !uploadedFile ? COLOR + '60' : BORDER}`, background: selectedSample === i && !uploadedFile ? `${COLOR}18` : CARD_BG, color: selectedSample === i && !uploadedFile ? COLOR : TEXT_SUB, fontSize: '12px', fontWeight: selectedSample === i && !uploadedFile ? 600 : 400, cursor: 'pointer' }}>
            {s.label}
          </button>
        ))}
        <input ref={fileInputRef} type="file" accept=".hl7,.txt" onChange={handleFileSelect} style={{ display: 'none' }} />
        <button
          onClick={() => fileInputRef.current?.click()}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '8px', border: `1px solid ${uploadedFile ? COLOR + '60' : BORDER}`, background: uploadedFile ? `${COLOR}18` : CARD_BG, color: uploadedFile ? COLOR : TEXT_SUB, fontSize: '12px', fontWeight: uploadedFile ? 600 : 400, cursor: 'pointer' }}
        >
          <Upload size={12} /> {uploadedFile ? uploadedFile.name : 'Upload File'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '12px', alignItems: 'start' }}>

        {/* HL7 input */}
        <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>HL7 v2 Message</span>
            <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '4px', background: '#F59E0B14', color: '#F59E0B', border: '1px solid #F59E0B28', fontWeight: 700 }}>
              {record?.message_type ?? HL7_SAMPLES[selectedSample]?.type ?? '—'}
            </span>
          </div>
          <textarea
            value={hl7}
            onChange={e => { setHl7(e.target.value); setUploadedFile(null); setRecord(null); setConvertError(null) }}
            rows={16}
            style={{ width: '100%', background: '#070B14', border: `1px solid ${BORDER}`, borderRadius: '8px', color: '#22C55E', fontSize: '11px', fontFamily: 'monospace', padding: '12px', resize: 'none', outline: 'none', boxSizing: 'border-box', lineHeight: 1.6 }}
          />
          {convertError && (
            <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '6px', color: ERROR_COLOR, fontSize: '11px' }}>
              <AlertCircle size={13} /> {convertError}
            </div>
          )}
          <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={convert}
              disabled={converting || (!uploadedFile && !hl7.trim())}
              style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '8px 16px', borderRadius: '8px', border: `1px solid ${COLOR}40`, background: `${COLOR}18`, color: COLOR, fontSize: '12px', fontWeight: 600, cursor: converting || (!uploadedFile && !hl7.trim()) ? 'not-allowed' : 'pointer' }}
            >
              {converting ? <RefreshCw size={13} /> : <Zap size={13} />}
              {converting ? 'Converting…' : 'Convert to FHIR'}
            </button>
          </div>
        </div>

        {/* Arrow */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', paddingTop: '54px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: `${COLOR}18`, border: `1px solid ${COLOR}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ArrowRight size={16} color={COLOR} />
          </div>
          <span style={{ fontSize: '10px', color: TEXT_SUB }}>FHIR R4</span>
        </div>

        {/* FHIR output */}
        <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>FHIR R4 Bundle</span>
            {fhir && (
              <button onClick={copyFhir} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '6px', border: `1px solid ${BORDER}`, background: 'transparent', color: copied ? '#22C55E' : TEXT_SUB, fontSize: '11px', cursor: 'pointer' }}>
                {copied ? <Check size={11} /> : <Copy size={11} />}{copied ? 'Copied!' : 'Copy JSON'}
              </button>
            )}
          </div>
          <div style={{ background: '#070B14', border: `1px solid ${BORDER}`, borderRadius: '8px', padding: '12px', minHeight: '300px', maxHeight: '400px', overflowY: 'auto' }}>
            {isError ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', color: ERROR_COLOR, fontSize: '12px', gap: '8px', textAlign: 'center', padding: '0 16px' }}>
                <AlertCircle size={20} />
                {record?.error_message || 'Conversion failed'}
              </div>
            ) : !fhir ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: TEXT_SUB, fontSize: '13px' }}>
                FHIR output appears here after conversion
              </div>
            ) : (
              <pre style={{ margin: 0, color: '#A5B4FC', fontSize: '11px', fontFamily: 'monospace', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {JSON.stringify(fhir, null, 2)}
              </pre>
            )}
          </div>

          {record && !isError && (
            <div style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
              <button
                onClick={describeResult}
                disabled={describing}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '7px', border: `1px solid ${BORDER}`, background: 'transparent', color: TEXT_SUB, fontSize: '11px', cursor: describing ? 'not-allowed' : 'pointer' }}
              >
                <Sparkles size={12} /> {describing ? 'Describing…' : 'Describe Result'}
              </button>
              <button
                onClick={downloadPdf}
                disabled={downloadingPdf}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '7px', border: `1px solid ${BORDER}`, background: 'transparent', color: TEXT_SUB, fontSize: '11px', cursor: downloadingPdf ? 'not-allowed' : 'pointer' }}
              >
                <Download size={12} /> {downloadingPdf ? 'Preparing…' : 'Download PDF'}
              </button>
            </div>
          )}

          {record?.description && (
            <div style={{ marginTop: '10px', padding: '10px 12px', borderRadius: '8px', background: `${COLOR}0C`, border: `1px solid ${COLOR}24` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <Sparkles size={11} color={COLOR} />
                <span style={{ fontSize: '10px', fontWeight: 700, color: COLOR, textTransform: 'uppercase', letterSpacing: '0.03em' }}>AI Description</span>
              </div>
              <p style={{ margin: 0, fontSize: '12px', color: '#D1D5DB', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{record.description}</p>
            </div>
          )}
        </div>

      </div>

      {/* Insights */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginTop: '16px' }}>
        <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
            <FileText size={13} color={TEXT_SUB} />
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#fff' }}>By Message Type</span>
          </div>
          {stats.by_type.length === 0 ? (
            <div style={{ fontSize: '11px', color: TEXT_SUB, padding: '14px 0' }}>No conversions yet</div>
          ) : (
            <KPIMiniChart
              variant="bars"
              values={stats.by_type.map(t => t.count)}
              labels={stats.by_type.map(t => t.type)}
              colors={stats.by_type.map((_, i) => TYPE_PALETTE[i % TYPE_PALETTE.length])}
              height={70}
            />
          )}
        </div>

        <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
            <History size={13} color={TEXT_SUB} />
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#fff' }}>Last 14 Days</span>
          </div>
          {stats.by_day.length === 0 ? (
            <div style={{ fontSize: '11px', color: TEXT_SUB, padding: '14px 0' }}>No conversions yet</div>
          ) : (
            <KPIMiniChart
              variant="sparkline"
              values={stats.by_day.map(d => d.count)}
              labels={stats.by_day.map(d => d.date.slice(5))}
              colors={[COLOR]}
              height={70}
            />
          )}
        </div>

        <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
            <Check size={13} color={TEXT_SUB} />
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#fff' }}>Success Rate</span>
          </div>
          {stats.success_count + stats.error_count === 0 ? (
            <div style={{ fontSize: '11px', color: TEXT_SUB, padding: '14px 0' }}>No conversions yet</div>
          ) : (
            <KPIMiniChart
              variant="donut"
              values={[stats.success_count, stats.error_count]}
              labels={['Success', 'Error']}
              colors={[SUCCESS_COLOR, ERROR_COLOR]}
              height={70}
            />
          )}
        </div>
      </div>
    </div>
  )
}
