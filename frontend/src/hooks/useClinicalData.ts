import { useEffect, useState, useCallback } from 'react'
import { apiGet, apiPost, apiPut, apiPatch, apiDelete, BACKEND_URL } from '../lib/backend'
import { usePolledResource } from './usePolling'
import type {
  Patient, ClinicalAlert, AdmissionRecord, ForecastRecord, ActivityItem, KPISnapshot, FHIRResource, PatientEvent,
  Vitals, Doctor, DoctorAssignment, Prescription, EHRDiagnosis, EHRMedication, ICD10Assignment, PatientRiskScore, BedUsageRecord,
  LabResult, InsuranceClaim, AuditLogEntry, PatientAllergy, DrugFormulary, HL7Sample, ImagingStudy, ChatSessionSummary,
  HL7ConversionSummary, HL7Stats, ClinicalRunMode, ClinicalRunSummary, ClinicalRunRecord, ClinicalStats,
} from '../types/clinical'

const EMPTY_KPI: KPISnapshot = {
  id: 1, total_active: 0, icu_patients: 0, high_risk: 0, available_beds: 0, pending_alerts: 0,
  todays_admissions: 0, total_active_change: 0, icu_critical: 0, high_risk_change: 0,
  bed_capacity_pct: 0, alert_critical: 0, admissions_change_pct: 0, updated_at: '',
}

// ─── KPI ───────────────────────────────────────────────────────────────────

export function useKPI(): KPISnapshot {
  const [kpi] = usePolledResource<KPISnapshot>(() => apiGet('/api/v1/kpi'), 5000, [], EMPTY_KPI)
  return kpi
}

/** Persists a freshly backend-computed KPI set (POST /api/v1/kpi/recompute), deriving
 * real day-over-day deltas server-side from whatever was previously stored. */
export async function saveKPI(computed: {
  total_active: number; icu_patients: number; icu_critical: number; high_risk: number
  available_beds: number; bed_capacity_pct: number; pending_alerts: number; alert_critical: number
  todays_admissions: number; admissions_change_pct: number
}): Promise<void> {
  await apiPut('/api/v1/kpi', computed)
}

// ─── Patients (search) ───────────────────────────────────────────────────────

export function usePatients(query: string): Patient[] {
  const [patients, setPatients] = useState<Patient[]>([])

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setPatients([]); return }
    try {
      setPatients(await apiGet<Patient[]>(`/api/v1/patients?q=${encodeURIComponent(q)}&limit=8`))
    } catch { /* keep previous results on transient failure */ }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => search(query), 250)
    return () => clearTimeout(timer)
  }, [query, search])

  return patients
}

export function useAllPatients(): Patient[] {
  const [patients] = usePolledResource<Patient[]>(() => apiGet('/api/v1/patients'), 10000, [], [])
  return patients
}

export async function createPatient(patient: Omit<Patient, 'created_at'>): Promise<Patient> {
  return apiPost('/api/v1/patients', patient)
}

export async function updatePatient(id: string, updates: Partial<Omit<Patient, 'id' | 'created_at'>>): Promise<Patient> {
  return apiPut(`/api/v1/patients/${encodeURIComponent(id)}`, updates)
}

export async function deletePatient(id: string): Promise<void> {
  await apiDelete(`/api/v1/patients/${encodeURIComponent(id)}`)
}

// ─── Alerts ──────────────────────────────────────────────────────────────────

export function useAlerts() {
  const [alerts, setAlerts] = usePolledResource<ClinicalAlert[]>(() => apiGet('/api/v1/alerts'), 5000, [], [])

  const acknowledge = async (id: number) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, acknowledged: true, escalated: false } : a))
    const updated = await apiPatch<ClinicalAlert>(`/api/v1/alerts/${id}`, { acknowledged: true, escalated: false })
    setAlerts(prev => prev.map(a => a.id === id ? updated : a))
  }

  const escalate = async (id: number) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, escalated: true, acknowledged: false } : a))
    const updated = await apiPatch<ClinicalAlert>(`/api/v1/alerts/${id}`, { escalated: true, acknowledged: false })
    setAlerts(prev => prev.map(a => a.id === id ? updated : a))
  }

  const unsetAlert = async (id: number) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, acknowledged: false, escalated: false } : a))
    const updated = await apiPatch<ClinicalAlert>(`/api/v1/alerts/${id}`, { acknowledged: false, escalated: false })
    setAlerts(prev => prev.map(a => a.id === id ? updated : a))
  }

  const addAlert = async (alert: Omit<ClinicalAlert, 'id' | 'created_at' | 'acknowledged' | 'escalated'>) => {
    const created = await apiPost<ClinicalAlert>('/api/v1/alerts', { ...alert, acknowledged: false, escalated: false })
    setAlerts(prev => [created, ...prev])
    return created
  }

  const editAlert = async (id: number, updates: Partial<Omit<ClinicalAlert, 'id' | 'created_at' | 'acknowledged' | 'escalated'>>) => {
    const updated = await apiPut<ClinicalAlert>(`/api/v1/alerts/${id}`, updates)
    setAlerts(prev => prev.map(a => a.id === id ? updated : a))
    return updated
  }

  const removeAlert = async (id: number) => {
    setAlerts(prev => prev.filter(a => a.id !== id))
    await apiDelete(`/api/v1/alerts/${id}`)
  }

  return { alerts, acknowledge, escalate, unsetAlert, addAlert, editAlert, removeAlert }
}

export async function deleteAlert(id: number): Promise<void> {
  await apiDelete(`/api/v1/alerts/${id}`)
}

/** Creates a clinical alert; the backend also write-throughs it onto the patient's timeline
 * (patient_events) so it's visible from PatientTimelinePage too. */
export async function createAlert(alert: Omit<ClinicalAlert, 'id' | 'created_at'>): Promise<ClinicalAlert | null> {
  try {
    return await apiPost<ClinicalAlert>('/api/v1/alerts', alert)
  } catch {
    return null
  }
}

// ─── Admissions ──────────────────────────────────────────────────────────────

export function useAdmissions(): AdmissionRecord[] {
  const [data] = usePolledResource<AdmissionRecord[]>(() => apiGet('/api/v1/admissions'), 10000, [], [])
  return data
}

// ─── Resource Forecast ───────────────────────────────────────────────────────

export function useForecast(): ForecastRecord[] {
  const [data] = usePolledResource<ForecastRecord[]>(() => apiGet('/api/v1/forecast'), 10000, [], [])
  return data
}

/** Replaces the 7-row resource_forecast table with freshly computed values (backend/forecast.py). */
export async function saveForecast(rows: { day_label: string; bed_usage: number; staffing: number }[]): Promise<void> {
  await apiPut('/api/v1/forecast', { rows })
}

// ─── FHIR Resources (per patient) ─────────────────────────────────────────────

/** `refreshKey` lets callers force an immediate re-fetch (e.g. right after a resource
 * save/delete) instead of waiting for the next poll tick. */
export function useFHIRResources(patientId: string | undefined, refreshKey = 0): FHIRResource[] {
  const [data] = usePolledResource<FHIRResource[]>(
    () => patientId ? apiGet(`/api/v1/fhir/resources?patient_id=${encodeURIComponent(patientId)}`) : Promise.resolve([]),
    10000, [patientId, refreshKey], [],
  )
  return patientId ? data : []
}

export function useFHIRResourceStats(refreshKey = 0): { by_type: { type: string; count: number }[]; total: number } {
  const [data] = usePolledResource<{ by_type: { type: string; count: number }[]; total: number }>(
    () => apiGet('/api/v1/fhir/resources/stats'),
    15000, [refreshKey], { by_type: [], total: 0 },
  )
  return data
}

export async function upsertFHIRResource(patientId: string, resourceType: string, resourceJson: Record<string, unknown>, versionId = '1'): Promise<FHIRResource> {
  return apiPost('/api/v1/fhir/resources', { patient_id: patientId, resource_type: resourceType, resource_json: resourceJson, version_id: versionId })
}

export async function deleteFHIRResource(patientId: string, resourceType: string): Promise<void> {
  await apiDelete(`/api/v1/fhir/resources/${encodeURIComponent(patientId)}/${encodeURIComponent(resourceType)}`)
}

// ─── Patient Events (timeline, per patient) ───────────────────────────────────

export function usePatientEvents(patientId: string | undefined): PatientEvent[] {
  const [data] = usePolledResource<PatientEvent[]>(
    () => patientId ? apiGet(`/api/v1/patients/${encodeURIComponent(patientId)}/events`) : Promise.resolve([]),
    10000, [patientId], [],
  )
  return patientId ? data : []
}

// ─── Activity Feed ───────────────────────────────────────────────────────────

export function useActivityFeed(): ActivityItem[] {
  const [items] = usePolledResource<ActivityItem[]>(() => apiGet('/api/v1/activity'), 10000, [], [])
  return items
}

export async function createActivity(entry: Omit<ActivityItem, 'id' | 'created_at'>): Promise<void> {
  await apiPost('/api/v1/activity', entry)
}

// ─── Vitals (per patient, latest reading — server auto-seeds on first view) ──

export function useVitals(patientId: string | undefined): Vitals | null {
  const [data] = usePolledResource<Vitals | null>(
    () => patientId ? apiGet(`/api/v1/vitals?patient_id=${encodeURIComponent(patientId)}`) : Promise.resolve(null),
    8000, [patientId], null,
  )
  return patientId ? data : null
}

/** Returns the patient's latest vitals, which the backend generates and persists server-side
 * on first view if none exists yet (deterministic, risk-banded synthetic reading). */
export async function ensureVitals(patient: Patient): Promise<Vitals> {
  return apiGet<Vitals>(`/api/v1/vitals?patient_id=${encodeURIComponent(patient.id)}`)
}

export async function updateVitals(id: number, updates: Partial<Omit<Vitals, 'id' | 'patient_id'>>): Promise<Vitals> {
  return apiPut(`/api/v1/vitals/${id}`, updates)
}

export async function deleteVitals(id: number): Promise<void> {
  await apiDelete(`/api/v1/vitals/${id}`)
}

// ─── Doctors (roster) ──────────────────────────────────────────────────────

export function useDoctors(): Doctor[] {
  const [doctors] = usePolledResource<Doctor[]>(() => apiGet('/api/v1/doctors'), 0, [], [])
  return doctors
}

export function useDoctorAssignments(): DoctorAssignment[] {
  const [assignments] = usePolledResource<DoctorAssignment[]>(() => apiGet('/api/v1/doctor-assignments'), 10000, [], [])
  return assignments
}

export async function saveDoctorAssignments(assignments: { patient_id: string; doctor_id: number }[]): Promise<void> {
  await apiPut('/api/v1/doctor-assignments', { assignments })
}

// ─── Prescriptions (per patient) ─────────────────────────────────────────────

export function usePrescriptions(patientId: string | undefined): Prescription[] {
  const [data] = usePolledResource<Prescription[]>(
    () => patientId ? apiGet(`/api/v1/prescriptions?patient_id=${encodeURIComponent(patientId)}`) : Promise.resolve([]),
    3000, [patientId], [],
  )
  return patientId ? data : []
}

export async function addPrescription(rx: Omit<Prescription, 'id' | 'issued_at'>): Promise<Prescription> {
  return apiPost('/api/v1/prescriptions', rx)
}

export async function deletePrescription(id: number): Promise<void> {
  await apiDelete(`/api/v1/prescriptions/${id}`)
}

// ─── EHR: diagnoses & medications (per patient) ──────────────────────────────

export function useEHRDiagnoses(patientId: string | undefined): EHRDiagnosis[] {
  const [data] = usePolledResource<EHRDiagnosis[]>(
    () => patientId ? apiGet(`/api/v1/ehr/diagnoses?patient_id=${encodeURIComponent(patientId)}`) : Promise.resolve([]),
    3000, [patientId], [],
  )
  return patientId ? data : []
}

export async function addEHRDiagnosis(d: Omit<EHRDiagnosis, 'id' | 'recorded_at'>): Promise<void> {
  await apiPost('/api/v1/ehr/diagnoses', d)
}

export async function updateEHRDiagnosis(id: number, updates: Partial<Pick<EHRDiagnosis, 'code' | 'description'>>): Promise<void> {
  await apiPut(`/api/v1/ehr/diagnoses/${id}`, updates)
}

export async function deleteEHRDiagnosis(id: number): Promise<void> {
  await apiDelete(`/api/v1/ehr/diagnoses/${id}`)
}

export function useEHRMedications(patientId: string | undefined): EHRMedication[] {
  const [data] = usePolledResource<EHRMedication[]>(
    () => patientId ? apiGet(`/api/v1/ehr/medications?patient_id=${encodeURIComponent(patientId)}`) : Promise.resolve([]),
    3000, [patientId], [],
  )
  return patientId ? data : []
}

export async function addEHRMedication(m: Omit<EHRMedication, 'id' | 'recorded_at'>): Promise<void> {
  await apiPost('/api/v1/ehr/medications', m)
}

export async function updateEHRMedication(id: number, updates: Partial<Omit<EHRMedication, 'id' | 'patient_id' | 'recorded_at'>>): Promise<void> {
  await apiPut(`/api/v1/ehr/medications/${id}`, updates)
}

export async function deleteEHRMedication(id: number): Promise<void> {
  await apiDelete(`/api/v1/ehr/medications/${id}`)
}

// ─── ICD-10 assignments (per patient) ────────────────────────────────────────

export function useICD10Assignments(patientId: string | undefined): ICD10Assignment[] {
  const [data] = usePolledResource<ICD10Assignment[]>(
    () => patientId ? apiGet(`/api/v1/ehr/icd10-assignments?patient_id=${encodeURIComponent(patientId)}`) : Promise.resolve([]),
    3000, [patientId], [],
  )
  return patientId ? data : []
}

export async function addICD10Assignment(a: Omit<ICD10Assignment, 'id' | 'assigned_at'>): Promise<ICD10Assignment> {
  return apiPost('/api/v1/ehr/icd10-assignments', a)
}

export async function updateICD10Assignment(id: number, updates: Partial<Pick<ICD10Assignment, 'code' | 'description' | 'confidence'>>): Promise<ICD10Assignment> {
  return apiPut(`/api/v1/ehr/icd10-assignments/${id}`, updates)
}

export async function deleteICD10Assignment(id: number): Promise<void> {
  await apiDelete(`/api/v1/ehr/icd10-assignments/${id}`)
}

// ─── Patient risk scores (per patient, one row per dimension) ───────────────

export function usePatientRiskScores(patientId: string | undefined): PatientRiskScore[] {
  const [data] = usePolledResource<PatientRiskScore[]>(
    () => patientId ? apiGet(`/api/v1/risk-scores?patient_id=${encodeURIComponent(patientId)}`) : Promise.resolve([]),
    3000, [patientId], [],
  )
  return patientId ? data : []
}

export async function saveRiskScores(scores: Omit<PatientRiskScore, 'id' | 'computed_at'>[]): Promise<void> {
  await apiPut('/api/v1/risk-scores', { scores })
}

export async function deleteRiskScore(id: number): Promise<void> {
  await apiDelete(`/api/v1/risk-scores/${id}`)
}

/** Unfiltered — every patient/dimension row, for population-level aggregation (Overview). */
export function useAllRiskScores(): PatientRiskScore[] {
  const [data] = usePolledResource<PatientRiskScore[]>(() => apiGet('/api/v1/risk-scores'), 10000, [], [])
  return data
}

// ─── Bed usage history (for forecasting) ─────────────────────────────────────

export function useBedUsageHistory(): BedUsageRecord[] {
  const [data] = usePolledResource<BedUsageRecord[]>(() => apiGet('/api/v1/bed-usage'), 0, [], [])
  return data
}

// ─── Lab Results (per patient — server auto-seeds on first view) ────────────

export async function ensureLabResults(patient: Patient): Promise<LabResult[]> {
  return apiGet<LabResult[]>(`/api/v1/lab-results?patient_id=${encodeURIComponent(patient.id)}`)
}

export async function addLabResult(r: Omit<LabResult, 'id' | 'recorded_at'>): Promise<void> {
  await apiPost('/api/v1/lab-results', r)
}

export async function updateLabResult(id: number, updates: Partial<Pick<LabResult, 'value' | 'unit' | 'ref_low' | 'ref_high'>>): Promise<LabResult> {
  return apiPut(`/api/v1/lab-results/${id}`, updates)
}

export async function deleteLabResult(id: number): Promise<void> {
  await apiDelete(`/api/v1/lab-results/${id}`)
}

// ─── Patient allergies (per patient — server auto-seeds on first view) ──────

export function useAllergies(patientId: string | undefined): PatientAllergy[] {
  const [data] = usePolledResource<PatientAllergy[]>(
    () => patientId ? apiGet(`/api/v1/patients/${encodeURIComponent(patientId)}/allergies`) : Promise.resolve([]),
    3000, [patientId], [],
  )
  return patientId ? data : []
}

export async function addAllergy(patientId: string, a: Omit<PatientAllergy, 'id' | 'patient_id' | 'recorded_at'>): Promise<void> {
  await apiPost(`/api/v1/patients/${encodeURIComponent(patientId)}/allergies`, a)
}

export async function deleteAllergy(patientId: string, allergyId: number): Promise<void> {
  await apiDelete(`/api/v1/patients/${encodeURIComponent(patientId)}/allergies/${allergyId}`)
}

// ─── Imaging studies (per patient — server auto-seeds on first view) ────────

export async function ensureImagingStudies(patientId: string): Promise<ImagingStudy[]> {
  return apiGet<ImagingStudy[]>(`/api/v1/imaging/studies?patient_id=${encodeURIComponent(patientId)}`)
}

export async function updateImagingStudy(id: number, updates: Partial<Pick<ImagingStudy, 'status' | 'finding' | 'confidence' | 'flagged'>>): Promise<ImagingStudy> {
  return apiPut(`/api/v1/imaging/studies/${id}`, updates)
}

export async function deleteImagingStudy(id: number): Promise<void> {
  await apiDelete(`/api/v1/imaging/studies/${id}`)
}

// ─── Reference data (drug formulary, HL7 samples) ────────────────────────────

export function useDrugFormulary(): DrugFormulary {
  const [data] = usePolledResource<DrugFormulary>(
    () => apiGet('/api/v1/reference/drug-formulary'), 0, [], { drugs: [], routes: [], frequencies: [], durations: [] },
  )
  return data
}

export function useHL7Samples(): HL7Sample[] {
  const [data] = usePolledResource<{ samples: HL7Sample[] }>(() => apiGet('/api/v1/hl7/samples'), 0, [], { samples: [] })
  return data.samples
}

// ─── HL7 -> FHIR conversion history & stats (device-scoped, no login) ────────

/** `refreshKey` lets callers force an immediate re-fetch (e.g. right after a convert/delete)
 * instead of waiting for the next poll tick — bump it via the returned setter's counterpart. */
export function useHL7History(deviceId: string, refreshKey: number): HL7ConversionSummary[] {
  const [data] = usePolledResource<{ history: HL7ConversionSummary[] }>(
    () => apiGet(`/api/v1/hl7/history?device_id=${encodeURIComponent(deviceId)}`),
    15000, [deviceId, refreshKey], { history: [] },
  )
  return data.history
}

export function useHL7Stats(deviceId: string, refreshKey: number): HL7Stats {
  const [data] = usePolledResource<HL7Stats>(
    () => apiGet(`/api/v1/hl7/stats?device_id=${encodeURIComponent(deviceId)}`),
    15000, [deviceId, refreshKey], { by_type: [], by_day: [], success_count: 0, error_count: 0 },
  )
  return data
}

export async function deleteHL7Record(id: number, deviceId: string): Promise<void> {
  await apiDelete(`/api/v1/hl7/history/${id}?device_id=${encodeURIComponent(deviceId)}`)
}

// ─── Clinical NLP & Text Generation history & stats (device-scoped, no login) ───

export interface ClinicalRunRequest {
  device_id: string
  mode: ClinicalRunMode
  patient_id?: string | null
  patient_name?: string | null
  risk?: string | null
  ward?: string | null
  note_text?: string | null
  lab_report?: string | null
  input_meta?: Record<string, unknown> | null
  parent_id?: number | null
}

/** `refreshKey` lets callers force an immediate re-fetch (e.g. right after a run/delete)
 * instead of waiting for the next poll tick — bump it via the returned setter's counterpart. */
export function useClinicalHistory(deviceId: string, filters: { mode?: string; patient_id?: string }, refreshKey: number): ClinicalRunSummary[] {
  const params = new URLSearchParams({ device_id: deviceId })
  if (filters.mode) params.set('mode', filters.mode)
  if (filters.patient_id) params.set('patient_id', filters.patient_id)

  const [data] = usePolledResource<{ history: ClinicalRunSummary[] }>(
    () => apiGet(`/api/v1/clinical/history?${params.toString()}`),
    15000, [deviceId, filters.mode, filters.patient_id, refreshKey], { history: [] },
  )
  return data.history
}

export function useClinicalStats(deviceId: string, refreshKey: number): ClinicalStats {
  const [data] = usePolledResource<ClinicalStats>(
    () => apiGet(`/api/v1/clinical/stats?device_id=${encodeURIComponent(deviceId)}`),
    15000, [deviceId, refreshKey], { by_mode: [], by_day: [], entity_type_freq: [], success_count: 0, error_count: 0 },
  )
  return data
}

export async function runClinical(req: ClinicalRunRequest): Promise<ClinicalRunRecord> {
  return apiPost('/api/v1/clinical/run', req)
}

export async function fetchClinicalRecord(id: number, deviceId: string): Promise<ClinicalRunRecord> {
  return apiGet(`/api/v1/clinical/history/${id}?device_id=${encodeURIComponent(deviceId)}`)
}

export async function fetchClinicalVersions(id: number, deviceId: string): Promise<ClinicalRunSummary[]> {
  const data = await apiGet<{ versions: ClinicalRunSummary[] }>(`/api/v1/clinical/history/${id}/versions?device_id=${encodeURIComponent(deviceId)}`)
  return data.versions
}

export async function deleteClinicalRecord(id: number, deviceId: string): Promise<void> {
  await apiDelete(`/api/v1/clinical/history/${id}?device_id=${encodeURIComponent(deviceId)}`)
}

async function downloadBlob(res: Response, filename: string) {
  if (!res.ok) throw new Error('PDF generation failed')
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function downloadClinicalRecordPdf(id: number, deviceId: string): Promise<void> {
  const res = await fetch(`${BACKEND_URL}/api/v1/clinical/history/${id}/pdf?device_id=${encodeURIComponent(deviceId)}`)
  await downloadBlob(res, `clinical-run-${id}.pdf`)
}

export async function downloadClinicalHistoryPdf(deviceId: string, ids: number[]): Promise<void> {
  const res = await fetch(`${BACKEND_URL}/api/v1/clinical/history/export-pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ device_id: deviceId, ids }),
  })
  await downloadBlob(res, 'clinical-history-export.pdf')
}

// ─── Insurance Claims (per patient) ──────────────────────────────────────────

export function useClaims(patientId: string | undefined): InsuranceClaim[] {
  const [data] = usePolledResource<InsuranceClaim[]>(
    () => patientId ? apiGet(`/api/v1/claims?patient_id=${encodeURIComponent(patientId)}`) : Promise.resolve([]),
    3000, [patientId], [],
  )
  return patientId ? data : []
}

export async function addClaim(c: Omit<InsuranceClaim, 'id' | 'created_at'>): Promise<void> {
  await apiPost('/api/v1/claims', c)
}

export async function updateClaimStatus(id: number, status: InsuranceClaim['status']): Promise<void> {
  await apiPatch(`/api/v1/claims/${id}`, { status })
}

// ─── Audit & Compliance Log ──────────────────────────────────────────────────

export function useAuditLog(): AuditLogEntry[] {
  const [entries] = usePolledResource<AuditLogEntry[]>(() => apiGet('/api/v1/audit-log'), 10000, [], [])
  return entries
}

export async function logAudit(entry: Omit<AuditLogEntry, 'id' | 'created_at'>): Promise<void> {
  await apiPost('/api/v1/audit-log', entry)
}

// ─── Chat Sessions (AI Clinical Assistant history, device-scoped, no login) ─

/** `refreshKey` lets callers force an immediate re-fetch (e.g. right after a rename/delete)
 * instead of waiting for the next poll tick. Pass `patientId` to scope to conversations
 * about a specific patient — omit it for the global floating assistant widget's history. */
export function useChatSessions(deviceId: string, refreshKey: number, patientId?: string): ChatSessionSummary[] {
  const params = new URLSearchParams({ device_id: deviceId })
  if (patientId) params.set('patient_id', patientId)

  const [data] = usePolledResource<{ sessions: ChatSessionSummary[] }>(
    () => apiGet(`/api/v1/assistant/sessions?${params.toString()}`),
    15000, [deviceId, patientId, refreshKey], { sessions: [] },
  )
  return data.sessions
}

export async function fetchChatSessionMessages(sessionId: number, deviceId: string): Promise<{ role: string; content: string; sources?: unknown; created_at: string }[]> {
  const data = await apiGet<{ messages: { role: string; content: string; sources?: unknown; created_at: string }[] }>(
    `/api/v1/assistant/sessions/${sessionId}/messages?device_id=${encodeURIComponent(deviceId)}`,
  )
  return data.messages
}

export async function renameChatSession(sessionId: number, deviceId: string, title: string): Promise<void> {
  await apiPut(`/api/v1/assistant/sessions/${sessionId}`, { device_id: deviceId, title })
}

export async function deleteChatSession(sessionId: number, deviceId: string): Promise<void> {
  await apiDelete(`/api/v1/assistant/sessions/${sessionId}?device_id=${encodeURIComponent(deviceId)}`)
}

// ─── All Diagnoses (unfiltered, for population-level analytics) ─────────────

export function useAllDiagnoses(): Pick<EHRDiagnosis, 'code' | 'description'>[] {
  const [diagnoses] = usePolledResource<Pick<EHRDiagnosis, 'code' | 'description'>[]>(() => apiGet('/api/v1/diagnoses'), 0, [], [])
  return diagnoses
}
