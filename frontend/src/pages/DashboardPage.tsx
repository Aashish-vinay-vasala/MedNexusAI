import { useState, useEffect, useRef, useMemo, type CSSProperties } from 'react'
import { useParams } from 'react-router-dom'
import {
  Users, AlertTriangle, Activity, Bell, ChevronRight, Clock,
  TrendingUp, Bed, CalendarDays, Brain, X,
  CheckCircle2, Cpu, Database, FileImage, Zap, BarChart3, RefreshCw,
  Search, Check, ChevronsUp, User, Plus, Pencil, Trash2, Stethoscope, ShieldAlert, type LucideIcon,
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import DashboardSidebar from '../components/dashboard/DashboardSidebar'
import KPIMiniChart, { type KPIChartVariant } from '../components/dashboard/KPIMiniChart'
import AlertFormModal, { type AlertFormData } from '../components/dashboard/AlertFormModal'
import { severityColor, severityOrder, severityLabel } from '../lib/severity'
import ResourceForecastPage from './ResourceForecastPage'
import PatientTimelinePage from './PatientTimelinePage'
import ICD10CodingPage from './ICD10CodingPage'
import DecisionSupportPage from './DecisionSupportPage'
import EHRPage from './EHRPage'
import PatientManagementPage from './PatientManagementPage'
import DoctorAssignmentPage from './DoctorAssignmentPage'
import MedicalImagingPage from './MedicalImagingPage'
import ClinicalNLPTextPage from './ClinicalNLPTextPage'
import PrescriptionPage from './PrescriptionPage'
import InteroperabilityHubPage from './InteroperabilityHubPage'
import PatientMonitoringHubPage from './PatientMonitoringHubPage'
import RiskReadmissionHubPage from './RiskReadmissionHubPage'
import AIClinicalAssistantHubPage from './AIClinicalAssistantHubPage'
import PopulationHealthPage from './PopulationHealthPage'
import InsuranceClaimsPage from './InsuranceClaimsPage'
import AuditLogPage from './AuditLogPage'
import {
  useKPI, usePatients, useAlerts, useAdmissions, useForecast, useActivityFeed, useAllPatients, saveKPI,
  useBedUsageHistory, useDoctors, useDoctorAssignments, useAllRiskScores,
} from '../hooks/useClinicalData'
import { BACKEND_URL } from '../lib/backend'
import type { KPISnapshot, ClinicalAlert, Patient, AdmissionRecord, BedUsageRecord, Doctor, DoctorAssignment, PatientRiskScore } from '../types/clinical'

// ─── Constants ───────────────────────────────────────────────────────────────

const riskColor: Record<string, string> = { critical: '#EF4444', high: '#F59E0B', medium: '#0EA5E9', low: '#22C55E' }

// ─── Theme tokens ────────────────────────────────────────────────────────────
// Flat, solid surfaces — matches the Patient Timeline page rather than glassmorphism.

const CARD_BG = '#111827'
const BORDER = '#1F2937'

const panel: CSSProperties = {
  background: CARD_BG,
  border: `1px solid ${BORDER}`,
  borderRadius: '12px',
}

const pill: CSSProperties = {
  background: CARD_BG,
  border: `1px solid ${BORDER}`,
}

const ACTIVITY_ICON_MAP: Record<string, LucideIcon> = {
  CheckCircle2, Database, Cpu, FileImage, AlertTriangle, RefreshCw, Brain, Activity, Zap, Users,
}

const allModules = [
  { id: 3,  title: 'Patient Timeline',         color: '#8B5CF6' },
  { id: 4,  title: 'Clinical NLP & Text Generation', color: '#F59E0B' },
  { id: 9,  title: 'Medical Imaging',          color: '#8B5CF6' },
  { id: 10, title: 'Decision Support',         color: '#F59E0B' },
  { id: 11, title: 'ICD-10 Coding',            color: '#22C55E' },
  { id: 14, title: 'Resource Forecast',        color: '#14B8A6' },
  { id: 15, title: 'Doctor Assignment',        color: '#0EA5E9' },
  { id: 16, title: 'EHR',                      color: '#8B5CF6' },
  { id: 17, title: 'Medical Prescription',     color: '#22C55E' },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface KPIChartSpec { variant: KPIChartVariant; values: number[]; colors: string[]; labels: string[]; unit?: string }

function buildKPICards(
  kpi: KPISnapshot,
  patients: Patient[],
  alerts: ClinicalAlert[],
  admissions: AdmissionRecord[],
): { label: string; value: string; sub: string; icon: LucideIcon; color: string; chart: KPIChartSpec }[] {

  // Top wards by active-patient count — real distribution, not a fixed list.
  const wardCounts = new Map<string, number>()
  for (const p of patients) wardCounts.set(p.ward, (wardCounts.get(p.ward) ?? 0) + 1)
  const topWards = [...wardCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)

  const icuPatients = patients.filter(p => p.ward.toLowerCase().includes('icu'))
  const icuCritical = icuPatients.filter(p => p.risk === 'critical').length
  const icuOther = Math.max(0, icuPatients.length - icuCritical)

  const riskBuckets: Patient['risk'][] = ['critical', 'high', 'medium', 'low']
  const riskLabels: Record<Patient['risk'], string> = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' }
  const riskCounts = riskBuckets.map(r => patients.filter(p => p.risk === r).length)

  const severityBuckets: (keyof typeof severityColor)[] = ['critical', 'high', 'medium', 'info']
  const alertSeverityCounts = severityBuckets.map(s => alerts.filter(a => a.severity === s && !a.acknowledged).length)

  const admissionsTrend = admissions.map(a => a.admissions)
  const admissionsLabels = admissions.map(a => a.day_label)

  return [
    {
      label: 'Total Active Patients', value: kpi.total_active.toLocaleString(), sub: `+${kpi.total_active_change} today`,
      icon: Users, color: '#0EA5E9',
      chart: {
        variant: 'bars', unit: ' patients',
        values: topWards.length ? topWards.map(([, c]) => c) : [0],
        labels: topWards.length ? topWards.map(([w]) => w) : ['No patients'],
        colors: ['#0EA5E9'],
      },
    },
    {
      label: 'ICU Patients', value: kpi.icu_patients.toString(), sub: `${kpi.icu_critical} critical`,
      icon: Activity, color: '#EF4444',
      chart: {
        variant: 'donut', unit: ' patients',
        values: [icuCritical, icuOther || 1], labels: ['Critical', icuOther ? 'Other ICU' : 'No other ICU'],
        colors: [riskColor.critical, '#3A4459'],
      },
    },
    {
      label: 'High-Risk Patients', value: kpi.high_risk.toString(), sub: `↑ ${kpi.high_risk_change} since yesterday`,
      icon: AlertTriangle, color: '#F59E0B',
      chart: {
        variant: 'bars', unit: ' patients',
        values: riskCounts, labels: riskBuckets.map(r => riskLabels[r]), colors: riskBuckets.map(r => riskColor[r]),
      },
    },
    {
      label: 'Available Beds', value: kpi.available_beds.toString(), sub: `${kpi.bed_capacity_pct}% capacity left`,
      icon: Bed, color: '#22C55E',
      chart: {
        variant: 'gauge', unit: '%',
        values: [Math.max(0, 100 - kpi.bed_capacity_pct)], labels: ['Beds available'],
        colors: ['#22C55E', '#2A3344'],
      },
    },
    {
      label: 'Pending Alerts', value: kpi.pending_alerts.toString(), sub: `${kpi.alert_critical} critical`,
      icon: Zap, color: '#EF4444',
      chart: {
        variant: 'bars', unit: ' alerts',
        values: alertSeverityCounts, labels: severityBuckets.map(s => severityLabel[s]), colors: severityBuckets.map(s => severityColor[s]),
      },
    },
    {
      label: "Today's Admissions", value: kpi.todays_admissions.toString(), sub: `↑ ${kpi.admissions_change_pct}% vs avg`,
      icon: CalendarDays, color: '#14B8A6',
      chart: {
        variant: 'sparkline', unit: ' admissions',
        values: admissionsTrend.length ? admissionsTrend : [0], labels: admissionsLabels.length ? admissionsLabels : ['No data'],
        colors: ['#14B8A6'],
      },
    },
  ]
}

// ─── Operational charts (Bed Occupancy / Doctor Workload / Risk Distribution) ─

const RISK_DIMENSIONS: PatientRiskScore['dimension'][] = ['sepsis', 'icu', 'mortality', 'readmit']
const riskDimensionLabel: Record<PatientRiskScore['dimension'], string> = {
  sepsis: 'Sepsis', icu: 'ICU Risk', mortality: 'Mortality', readmit: 'Readmission',
}
const riskDimensionColor: Record<PatientRiskScore['dimension'], string> = {
  sepsis: '#EF4444', icu: '#F59E0B', mortality: '#8B5CF6', readmit: '#0EA5E9',
}

function buildBedOccupancy(bedUsage: BedUsageRecord[]) {
  return bedUsage.slice(-7).map(r => ({
    day_label: new Date(r.date).toLocaleDateString('en-US', { weekday: 'short' }),
    bed_usage: r.bed_usage,
  }))
}

function buildDoctorWorkload(doctors: Doctor[], assignments: DoctorAssignment[]) {
  const counts = new Map<number, number>()
  for (const a of assignments) counts.set(a.doctor_id, (counts.get(a.doctor_id) ?? 0) + 1)
  return doctors.map(d => ({
    name: d.name.replace(/^Dr\.?\s*/i, '').split(' ')[0],
    fullName: d.name,
    count: counts.get(d.id) ?? 0,
    capacity: d.max_patients,
    color: d.color,
  }))
}

function buildRiskDistribution(scores: PatientRiskScore[]) {
  return RISK_DIMENSIONS.map(dim => {
    const rows = scores.filter(s => s.dimension === dim)
    const avg = rows.length ? rows.reduce((sum, r) => sum + r.score, 0) / rows.length : 0
    return { name: riskDimensionLabel[dim], value: Math.round(avg * 10) / 10, color: riskDimensionColor[dim] }
  })
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '8px', padding: '10px 14px', fontSize: '12px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
    }}>
      <div style={{ color: '#9CA3AF', marginBottom: '6px', fontWeight: 600 }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ color: p.color, marginBottom: '3px' }}>
          {p.name}: <span style={{ color: '#E5E7EB', fontWeight: 700 }}>{p.value}</span>
        </div>
      ))}
    </div>
  )
}

function CategoryTooltip({ active, payload }: { active?: boolean; payload?: { payload: { name: string; value: number; color: string } }[] }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div style={{
      background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '8px', padding: '10px 14px', fontSize: '12px',
    }}>
      <div style={{ color: '#9CA3AF', marginBottom: '6px', fontWeight: 600 }}>{d.name}</div>
      <div style={{ color: d.color }}>
        Avg score: <span style={{ color: '#E5E7EB', fontWeight: 700 }}>{d.value}</span>
      </div>
    </div>
  )
}

function DoctorTooltip({ active, payload }: { active?: boolean; payload?: { payload: { fullName: string; count: number; capacity: number; color: string } }[] }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div style={{
      background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '8px', padding: '10px 14px', fontSize: '12px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
    }}>
      <div style={{ color: '#9CA3AF', marginBottom: '6px', fontWeight: 600 }}>{d.fullName}</div>
      <div style={{ color: d.color }}>
        Caseload: <span style={{ color: '#E5E7EB', fontWeight: 700 }}>{d.count} / {d.capacity} patients</span>
      </div>
    </div>
  )
}

// ─── Patient Search ───────────────────────────────────────────────────────────

function PatientSearchBar() {
  const [query, setQuery]       = useState('')
  const [open, setOpen]         = useState(false)
  const [selected, setSelected] = useState<ReturnType<typeof usePatients>[0] | null>(null)
  const wrapRef                 = useRef<HTMLDivElement>(null)
  const patients                = usePatients(query)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%', maxWidth: '420px', minWidth: '220px' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px', ...pill,
        borderRadius: '10px', padding: '0 12px', height: '36px',
        transition: 'border-color 0.2s',
      }}
        onFocus={e => { e.currentTarget.style.borderColor = 'rgba(14,165,233,0.4)' }}
        onBlur={e => { e.currentTarget.style.borderColor = BORDER }}
      >
        <Search size={13} color="#8B96AC" style={{ flexShrink: 0 }} />
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); setSelected(null) }}
          onFocus={() => setOpen(true)}
          placeholder="Search patient by ID or name…"
          style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', fontSize: '12px', color: '#E5E7EB' }}
        />
        {query && (
          <button onClick={() => { setQuery(''); setSelected(null); setOpen(false) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8B96AC', display: 'flex', padding: 0, flexShrink: 0 }}>
            <X size={12} />
          </button>
        )}
      </div>

      {open && query.trim() && patients.length === 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
          background: CARD_BG,
          border: `1px solid ${BORDER}`,
          borderRadius: '10px', zIndex: 200,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          padding: '14px', textAlign: 'center', fontSize: '12px', color: '#8B96AC',
        }}>
          No patients match "{query.trim()}"
        </div>
      )}

      {open && patients.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
          background: CARD_BG,
          border: `1px solid ${BORDER}`,
          borderRadius: '10px', overflow: 'hidden', zIndex: 200,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}>
          {patients.map((p, i) => (
            <div key={p.id}
              onClick={() => { setSelected(p); setQuery(p.name); setOpen(false) }}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', cursor: 'pointer',
                borderBottom: i < patients.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{
                width: '28px', height: '28px', borderRadius: '7px', flexShrink: 0,
                background: `${riskColor[p.risk]}14`, border: `1px solid ${riskColor[p.risk]}28`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <User size={13} color={riskColor[p.risk]} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#E5E7EB' }}>{p.name}</div>
                <div style={{ fontSize: '11px', color: '#8B96AC' }}>{p.ward} · Age {p.age}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' }}>
                <span style={{ fontSize: '9.5px', color: '#A6B0C3', fontFamily: 'monospace' }}>{p.id}</span>
                <span style={{
                  fontSize: '9px', fontWeight: 700, padding: '1px 5px', borderRadius: '3px',
                  background: `${riskColor[p.risk]}16`, color: riskColor[p.risk], letterSpacing: '0.04em',
                }}>{p.risk.toUpperCase()}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && !open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
          background: CARD_BG,
          border: `1px solid ${riskColor[selected.risk]}30`,
          borderRadius: '10px', padding: '14px', zIndex: 200,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '34px', height: '34px', borderRadius: '8px',
                background: `${riskColor[selected.risk]}14`, border: `1px solid ${riskColor[selected.risk]}28`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <User size={16} color={riskColor[selected.risk]} />
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>{selected.name}</div>
                <div style={{ fontSize: '10.5px', color: '#8B96AC', fontFamily: 'monospace' }}>{selected.id} · Age {selected.age}</div>
              </div>
            </div>
            <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8B96AC', display: 'flex' }}>
              <X size={13} />
            </button>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {([
              { label: 'Ward',   value: selected.ward },
              { label: 'Status', value: selected.status },
              { label: 'Risk',   value: selected.risk.toUpperCase(), color: riskColor[selected.risk] },
            ] as { label: string; value: string; color?: string }[]).map(item => (
              <div key={item.label} style={{
                flex: 1, minWidth: '80px',
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '7px', padding: '7px 10px',
              }}>
                <div style={{ fontSize: '9.5px', color: '#8B96AC', marginBottom: '3px' }}>{item.label}</div>
                <div style={{ fontSize: '11.5px', fontWeight: 600, color: item.color ?? '#D1D5DB' }}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Overview ─────────────────────────────────────────────────────────────────

function OverviewContent() {
  const now         = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const kpi         = useKPI()
  const admissions  = useAdmissions()
  const forecast    = useForecast()
  const activity    = useActivityFeed()
  const patients    = useAllPatients()
  const bedUsage    = useBedUsageHistory()
  const doctors     = useDoctors()
  const assignments = useDoctorAssignments()
  const riskScores  = useAllRiskScores()
  const { alerts, acknowledge, escalate, unsetAlert, addAlert, editAlert, removeAlert } = useAlerts()

  const [alertSort, setAlertSort] = useState<'severity' | 'time'>('severity')
  const [refreshingKPI, setRefreshingKPI] = useState(false)
  const [alertModal, setAlertModal] = useState<{ mode: 'add' | 'edit'; alert?: ClinicalAlert } | null>(null)

  // Real KPI aggregation (backend/kpi.py) from live patients/alerts/admissions, replacing
  // the otherwise-static kpi_snapshot seed row.
  async function refreshKPI() {
    if (refreshingKPI) return
    setRefreshingKPI(true)
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/kpi/recompute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patients, alerts, admissions }),
        signal: AbortSignal.timeout(10000),
      })
      if (res.ok) await saveKPI(await res.json())
    } catch { /* keep existing KPI snapshot if backend unavailable */ }
    setRefreshingKPI(false)
  }

  // Re-derive on every patients/alerts/admissions update (new rows, or an ack/escalate
  // flag flipping) — usePolledResource hands back a fresh array reference each time —
  // not just on patient count, so pending-alert counts etc. stay live.
  useEffect(() => {
    if (patients.length) refreshKPI()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patients, alerts, admissions])

  const kpiCards = useMemo(() => buildKPICards(kpi, patients, alerts, admissions), [kpi, patients, alerts, admissions])
  const bedOccupancy = useMemo(() => buildBedOccupancy(bedUsage), [bedUsage])
  const doctorWorkload = useMemo(() => buildDoctorWorkload(doctors, assignments), [doctors, assignments])
  const riskDistribution = useMemo(() => buildRiskDistribution(riskScores), [riskScores])

  const sortedAlerts = [...alerts].sort((a, b) =>
    alertSort === 'severity' ? severityOrder[a.severity] - severityOrder[b.severity] : 0
  )

  const toggleAck = (alert: ClinicalAlert) => {
    if (alert.acknowledged) unsetAlert(alert.id)
    else acknowledge(alert.id)
  }

  const toggleEscalate = (alert: ClinicalAlert) => {
    if (alert.escalated) unsetAlert(alert.id)
    else escalate(alert.id)
  }

  const handleDeleteAlert = (alert: ClinicalAlert) => {
    if (window.confirm(`Delete the "${alert.type}" alert for ${alert.patient}?`)) removeAlert(alert.id)
  }

  const handleSubmitAlert = async (data: AlertFormData) => {
    if (alertModal?.mode === 'edit' && alertModal.alert) await editAlert(alertModal.alert.id, data)
    else await addAlert({ ...data, time_ago: 'just now' })
    setAlertModal(null)
  }

  return (
    <div style={{ padding: '24px 28px', minHeight: '100%', background: '#0A0F1E' }}>

      {/* Header */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, auto) 1fr minmax(200px, auto)', alignItems: 'center', marginBottom: '20px', gap: '16px' }}>
        <div style={{ flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <span style={{ fontSize: '11.5px', color: '#8B96AC' }}>Dashboard</span>
            <ChevronRight size={11} color="#8B96AC" />
            <span style={{ fontSize: '11.5px', color: '#A6B0C3' }}>Overview</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#fff', margin: 0 }}>Clinical Overview</h1>
            <span style={{
              fontSize: '9.5px', fontWeight: 700, padding: '2px 7px', borderRadius: '4px',
              background: 'rgba(34,197,94,0.1)', color: '#22C55E', letterSpacing: '0.05em',
            }}>LIVE</span>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', minWidth: 0 }}>
          <PatientSearchBar />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0, justifySelf: 'end' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: '#8B96AC' }}>
            <Clock size={12} />
            {now}
          </div>
          <button style={{
            width: '34px', height: '34px', borderRadius: '10px', ...pill,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: '#A6B0C3', position: 'relative',
          }}>
            <Bell size={14} />
            {alerts.filter(a => !a.acknowledged && !a.escalated).length > 0 && (
              <span style={{
                position: 'absolute', top: '7px', right: '7px',
                width: '6px', height: '6px', borderRadius: '50%', background: '#EF4444',
              }} />
            )}
          </button>
        </div>
      </div>

      {/* Section 1 — KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '12px', marginBottom: '18px' }}>
        {kpiCards.map(card => {
          const Icon = card.icon
          return (
            <div key={card.label} style={{
              ...panel, padding: '16px', transition: 'border-color 0.2s, transform 0.2s',
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = `${card.color}44`; e.currentTarget.style.transform = 'translateY(-1px)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.transform = 'translateY(0)' }}
            >
              <div style={{ marginBottom: '12px' }}>
                <div style={{
                  width: '28px', height: '28px', borderRadius: '7px',
                  background: `${card.color}16`, border: `1px solid ${card.color}24`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={13} color={card.color} />
                </div>
              </div>
              <div style={{ fontSize: '22px', fontWeight: 700, color: '#fff', marginBottom: '3px' }}>{card.value}</div>
              <div style={{ fontSize: '11px', color: '#A6B0C3', marginBottom: '3px' }}>{card.label}</div>
              <div style={{ fontSize: '10px', color: '#7A85A0', marginBottom: '10px' }}>{card.sub}</div>
              <KPIMiniChart
                variant={card.chart.variant} values={card.chart.values} colors={card.chart.colors}
                labels={card.chart.labels} unit={card.chart.unit}
              />
            </div>
          )
        })}
      </div>

      {/* Section 2 + 4 — Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '14px', marginBottom: '14px' }}>

        {/* Admissions & Trends */}
        <div style={{ ...panel, padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
              <h2 style={{ fontSize: '13px', fontWeight: 600, color: '#fff', margin: 0 }}>Admissions & Trends</h2>
              <p style={{ fontSize: '10.5px', color: '#8B96AC', marginTop: '2px', margin: 0 }}>Last 7 days — daily volume</p>
            </div>
            <TrendingUp size={14} color="#8B96AC" />
          </div>
          <ResponsiveContainer width="100%" height={190}>
            <AreaChart data={admissions} margin={{ top: 4, right: 4, bottom: 0, left: -22 }}>
              <defs>
                {([['admGrad','#0EA5E9'],['disGrad','#22C55E'],['readGrad','#F59E0B']] as [string,string][]).map(([id,c]) => (
                  <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={c} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={c} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="day_label" tick={{ fill: '#8B96AC', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#8B96AC', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="admissions"   stroke="#0EA5E9" strokeWidth={2} fill="url(#admGrad)"  name="Admissions" />
              <Area type="monotone" dataKey="discharges"   stroke="#22C55E" strokeWidth={2} fill="url(#disGrad)"  name="Discharges" />
              <Area type="monotone" dataKey="readmissions" stroke="#F59E0B" strokeWidth={2} fill="url(#readGrad)" name="Readmissions" />
            </AreaChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: '18px', marginTop: '12px' }}>
            {([['Admissions','#0EA5E9'],['Discharges','#22C55E'],['Readmissions','#F59E0B']] as [string,string][]).map(([label,color]) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '20px', height: '2px', background: color, display: 'inline-block', borderRadius: '2px' }} />
                <span style={{ fontSize: '11px', color: '#8B96AC' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Resource Forecast */}
        <div style={{ ...panel, padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
              <h2 style={{ fontSize: '13px', fontWeight: 600, color: '#fff', margin: 0 }}>Resource Forecast</h2>
              <p style={{ fontSize: '10.5px', color: '#8B96AC', marginTop: '2px', margin: 0 }}>Next 7 days — % utilization</p>
            </div>
            <BarChart3 size={14} color="#8B96AC" />
          </div>
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={forecast} margin={{ top: 4, right: 4, bottom: 0, left: -22 }} barGap={3} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="day_label" tick={{ fill: '#8B96AC', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#8B96AC', fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 100]} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.025)' }} />
              <Bar dataKey="bed_usage" fill="#8B5CF6" name="Bed Usage %"     radius={[3,3,0,0]} />
              <Bar dataKey="staffing"  fill="#14B8A6" name="Staffing Needs %" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: '16px', marginTop: '12px' }}>
            {([['Bed Usage %','#8B5CF6'],['Staffing Needs %','#14B8A6']] as [string,string][]).map(([label,color]) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '10px', height: '10px', background: color, display: 'inline-block', borderRadius: '2px' }} />
                <span style={{ fontSize: '11px', color: '#8B96AC' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Section 2b — Bed Occupancy / Doctor Workload / Risk Distribution */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '14px' }}>

        {/* Bed Occupancy Trend */}
        <div style={{ ...panel, padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
              <h2 style={{ fontSize: '13px', fontWeight: 600, color: '#fff', margin: 0 }}>Bed Occupancy Trend</h2>
              <p style={{ fontSize: '10.5px', color: '#8B96AC', marginTop: '2px', margin: 0 }}>Last 7 days — actual % utilization</p>
            </div>
            <Bed size={14} color="#8B96AC" />
          </div>
          {bedOccupancy.length === 0 ? (
            <div style={{ height: '190px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11.5px', color: '#8B96AC' }}>
              No bed usage data yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={190}>
              <AreaChart data={bedOccupancy} margin={{ top: 4, right: 4, bottom: 0, left: -22 }}>
                <defs>
                  <linearGradient id="bedOccGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#8B5CF6" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="day_label" tick={{ fill: '#8B96AC', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#8B96AC', fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 100]} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="bed_usage" stroke="#8B5CF6" strokeWidth={2} fill="url(#bedOccGrad)" name="Bed Usage %" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Doctor Workload */}
        <div style={{ ...panel, padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
              <h2 style={{ fontSize: '13px', fontWeight: 600, color: '#fff', margin: 0 }}>Doctor Workload</h2>
              <p style={{ fontSize: '10.5px', color: '#8B96AC', marginTop: '2px', margin: 0 }}>Active patient caseload per doctor</p>
            </div>
            <Stethoscope size={14} color="#8B96AC" />
          </div>
          {doctorWorkload.length === 0 ? (
            <div style={{ height: '190px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11.5px', color: '#8B96AC' }}>
              No doctors registered yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={doctorWorkload} margin={{ top: 4, right: 4, bottom: 0, left: -22 }} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="name" tick={{ fill: '#8B96AC', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#8B96AC', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<DoctorTooltip />} cursor={{ fill: 'rgba(255,255,255,0.025)' }} />
                <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                  {doctorWorkload.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Population Risk Distribution */}
        <div style={{ ...panel, padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
              <h2 style={{ fontSize: '13px', fontWeight: 600, color: '#fff', margin: 0 }}>Population Risk Distribution</h2>
              <p style={{ fontSize: '10.5px', color: '#8B96AC', marginTop: '2px', margin: 0 }}>Avg model score — all patients</p>
            </div>
            <ShieldAlert size={14} color="#8B96AC" />
          </div>
          {riskScores.length === 0 ? (
            <div style={{ height: '190px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11.5px', color: '#8B96AC', textAlign: 'center', padding: '0 16px' }}>
              No risk scores yet — visit Risk & Readmission to compute
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={riskDistribution} margin={{ top: 4, right: 4, bottom: 0, left: -22 }} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="name" tick={{ fill: '#8B96AC', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#8B96AC', fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 100]} />
                <Tooltip content={<CategoryTooltip />} cursor={{ fill: 'rgba(255,255,255,0.025)' }} />
                <Bar dataKey="value" name="Avg Score" radius={[3, 3, 0, 0]}>
                  {riskDistribution.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Section 3 + 5 — Alerts + Activity */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '14px' }}>

        {/* Active Clinical Alerts */}
        <div style={{ ...panel, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '13px', fontWeight: 600, color: '#fff', margin: 0 }}>Active Clinical Alerts</h2>
              <span style={{ fontSize: '9.5px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: 'rgba(239,68,68,0.1)', color: '#EF4444', letterSpacing: '0.06em' }}>
                LIVE
              </span>
            </div>
            <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
              {(['severity','time'] as const).map(s => (
                <button key={s} onClick={() => setAlertSort(s)} style={{
                  fontSize: '10px', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer',
                  border: `1px solid ${alertSort === s ? '#0EA5E9' : 'rgba(255,255,255,0.07)'}`,
                  background: alertSort === s ? 'rgba(14,165,233,0.1)' : 'transparent',
                  color: alertSort === s ? '#0EA5E9' : '#8B96AC', fontWeight: 600,
                }}>
                  {s === 'severity' ? 'Severity' : 'Recent'}
                </button>
              ))}
              <button
                onClick={() => setAlertModal({ mode: 'add' })}
                style={{
                  display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', fontWeight: 700,
                  padding: '4px 10px 4px 8px', borderRadius: '6px', cursor: 'pointer', marginLeft: '4px',
                  border: '1px solid rgba(14,165,233,0.35)', background: 'rgba(14,165,233,0.14)', color: '#38BDF8',
                }}
              >
                <Plus size={11} /> Add
              </button>
            </div>
          </div>

          <div>
            {sortedAlerts.map((alert, i) => (
              <div key={alert.id} style={{
                display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px 18px',
                borderBottom: i < sortedAlerts.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                opacity: alert.acknowledged ? 0.45 : 1,
                background: alert.escalated ? 'rgba(239,68,68,0.04)' : 'transparent',
                transition: 'opacity 0.2s, background 0.2s',
              }}>
                <div style={{ marginTop: '4px', width: '7px', height: '7px', borderRadius: '50%', background: alert.acknowledged ? '#7A85A0' : alert.color, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '3px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '12.5px', fontWeight: 600, color: alert.acknowledged ? '#A6B0C3' : '#E5E7EB' }}>{alert.type}</span>
                    {alert.acknowledged ? (
                      <span style={{ fontSize: '9px', fontWeight: 700, padding: '1px 5px', borderRadius: '3px', background: 'rgba(34,197,94,0.1)', color: '#22C55E', letterSpacing: '0.05em' }}>ACK</span>
                    ) : alert.escalated ? (
                      <span style={{ fontSize: '9px', fontWeight: 700, padding: '1px 5px', borderRadius: '3px', background: 'rgba(239,68,68,0.15)', color: '#EF4444', letterSpacing: '0.05em' }}>ESCALATED</span>
                    ) : (
                      <span style={{ fontSize: '9px', fontWeight: 700, padding: '1px 5px', borderRadius: '3px', background: `${alert.color}16`, color: alert.color, letterSpacing: '0.05em' }}>
                        {severityLabel[alert.severity]}
                      </span>
                    )}
                    <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#7A85A0' }}>{alert.source}</span>
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#A6B0C3', marginBottom: '2px' }}>{alert.patient} — {alert.detail}</div>
                  <div style={{ fontSize: '10.5px', color: '#7A85A0' }}>{alert.time_ago}</div>
                </div>
                <div style={{ display: 'flex', gap: '5px', flexShrink: 0, marginTop: '2px' }}>
                  <button
                    onClick={() => toggleAck(alert)}
                    title="Acknowledge"
                    style={{
                      width: '26px', height: '26px', borderRadius: '6px', cursor: 'pointer',
                      border: `1px solid ${alert.acknowledged ? '#22C55E' : 'rgba(255,255,255,0.08)'}`,
                      background: alert.acknowledged ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.03)',
                      color: alert.acknowledged ? '#22C55E' : '#8B96AC',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { if (!alert.acknowledged) { e.currentTarget.style.borderColor = '#22C55E'; e.currentTarget.style.color = '#22C55E' } }}
                    onMouseLeave={e => { if (!alert.acknowledged) { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#8B96AC' } }}
                  >
                    <Check size={12} />
                  </button>
                  <button
                    onClick={() => toggleEscalate(alert)}
                    title="Escalate"
                    style={{
                      width: '26px', height: '26px', borderRadius: '6px', cursor: 'pointer',
                      border: `1px solid ${alert.escalated ? '#EF4444' : 'rgba(255,255,255,0.08)'}`,
                      background: alert.escalated ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.03)',
                      color: alert.escalated ? '#EF4444' : '#8B96AC',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { if (!alert.escalated) { e.currentTarget.style.borderColor = '#EF4444'; e.currentTarget.style.color = '#EF4444' } }}
                    onMouseLeave={e => { if (!alert.escalated) { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#8B96AC' } }}
                  >
                    <ChevronsUp size={12} />
                  </button>
                  <div style={{ width: '1px', alignSelf: 'stretch', background: 'rgba(255,255,255,0.08)', margin: '2px 1px' }} />
                  <button
                    onClick={() => setAlertModal({ mode: 'edit', alert })}
                    title="Edit alert"
                    style={{
                      width: '26px', height: '26px', borderRadius: '6px', cursor: 'pointer',
                      border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', color: '#8B96AC',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#0EA5E9'; e.currentTarget.style.color = '#0EA5E9' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#8B96AC' }}
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    onClick={() => handleDeleteAlert(alert)}
                    title="Delete alert"
                    style={{
                      width: '26px', height: '26px', borderRadius: '6px', cursor: 'pointer',
                      border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', color: '#8B96AC',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#EF4444'; e.currentTarget.style.color = '#EF4444' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#8B96AC' }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
            {sortedAlerts.length === 0 && (
              <div style={{ padding: '32px 18px', textAlign: 'center', fontSize: '11.5px', color: '#8B96AC' }}>
                No active alerts. Click "Add" to create one.
              </div>
            )}
          </div>
        </div>

        {/* System Activity */}
        <div style={{ ...panel, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: '13px', fontWeight: 600, color: '#fff', margin: 0 }}>System Activity</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '5px', height: '5px', background: '#22C55E', borderRadius: '50%', display: 'inline-block' }} />
              <span style={{ fontSize: '10px', color: '#7A85A0' }}>Live</span>
            </div>
          </div>
          <div style={{ padding: '4px 0' }}>
            {activity.map((event, i) => {
              const Icon = ACTIVITY_ICON_MAP[event.icon_name] ?? Activity
              return (
                <div key={event.id} style={{
                  display: 'flex', gap: '10px', padding: '9px 16px', alignItems: 'flex-start',
                  borderBottom: i < activity.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none',
                }}>
                  <div style={{
                    marginTop: '1px', width: '22px', height: '22px', borderRadius: '5px', flexShrink: 0,
                    background: `${event.color}14`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon size={11} color={event.color} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '11.5px', fontWeight: 600, color: '#D1D5DB', marginBottom: '1px' }}>{event.label}</div>
                    <div style={{ fontSize: '10.5px', color: '#8B96AC', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{event.detail}</div>
                  </div>
                  <div style={{ fontSize: '10px', color: '#7A85A0', flexShrink: 0, paddingTop: '2px' }}>{event.time_ago}</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {alertModal && (
        <AlertFormModal
          mode={alertModal.mode}
          initial={alertModal.alert}
          patients={patients}
          onClose={() => setAlertModal(null)}
          onSubmit={handleSubmitAlert}
        />
      )}
    </div>
  )
}

// ─── Module Placeholder ───────────────────────────────────────────────────────

function ModulePlaceholder({ moduleId }: { moduleId: string }) {
  const mod = allModules.find(m => m.id === parseInt(moduleId))
  if (!mod) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px' }}>
      <div style={{
        width: '48px', height: '48px', borderRadius: '12px',
        background: `${mod.color}14`, border: `1px solid ${mod.color}28`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Activity size={22} color={mod.color} />
      </div>
      <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#fff' }}>{mod.title}</h2>
      <p style={{ fontSize: '13px', color: '#8B96AC' }}>Module view coming soon</p>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { moduleId } = useParams()
  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0A0F1E', overflow: 'hidden' }}>
      <DashboardSidebar />
      <main style={{ flex: 1, overflowY: 'auto' }}>
        {moduleId === 'interop-hub'       ? <InteroperabilityHubPage /> :
         moduleId === 'monitoring-hub'    ? <PatientMonitoringHubPage /> :
         moduleId === 'risk-hub'          ? <RiskReadmissionHubPage /> :
         moduleId === 'assistant-hub'     ? <AIClinicalAssistantHubPage /> :
         moduleId === 'population-health' ? <PopulationHealthPage /> :
         moduleId === 'insurance-claims'  ? <InsuranceClaimsPage /> :
         moduleId === 'audit-log'         ? <AuditLogPage /> :
         moduleId === 'patients'          ? <PatientManagementPage /> :
         moduleId === '14' ? <ResourceForecastPage /> :
         moduleId === '3'  ? <PatientTimelinePage /> :
         moduleId === '11' ? <ICD10CodingPage /> :
         moduleId === '10' ? <DecisionSupportPage /> :
         moduleId === '16' ? <EHRPage /> :
         moduleId === '15' ? <DoctorAssignmentPage /> :
         moduleId === '9'  ? <MedicalImagingPage /> :
         moduleId === '4'  ? <ClinicalNLPTextPage /> :
         moduleId === '17' ? <PrescriptionPage /> :
         moduleId ? <ModulePlaceholder moduleId={moduleId} /> : <OverviewContent />}
      </main>
    </div>
  )
}
