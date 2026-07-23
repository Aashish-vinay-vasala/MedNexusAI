export interface Patient {
  id: string
  name: string
  ward: string
  risk: 'critical' | 'high' | 'medium' | 'low'
  age: number
  status: string
  created_at?: string
}

export interface ClinicalAlert {
  id: number
  type: string
  patient: string
  patient_id?: string | null
  category?: string | null
  detail: string
  time_ago: string
  severity: 'critical' | 'high' | 'medium' | 'info'
  color: string
  source: string
  acknowledged: boolean
  escalated: boolean
  created_at: string
}

export interface AdmissionRecord {
  id: number
  day_label: string
  admissions: number
  discharges: number
  readmissions: number
  date: string
}

export interface ForecastRecord {
  id: number
  day_label: string
  bed_usage: number
  staffing: number
}

export interface ActivityItem {
  id: number
  icon_name: string
  color: string
  label: string
  detail: string
  time_ago: string
  created_at: string
}

export interface FHIRResource {
  id: number
  patient_id: string
  resource_type: 'Patient' | 'Condition' | 'MedicationRequest' | 'Observation' | 'Encounter'
  resource_json: Record<string, unknown>
  version_id: string
  last_updated: string
}

export interface PatientEvent {
  id: number
  patient_id: string
  kind: string
  label: string
  detail: string
  occurred_at: string
  color: string
  source: string
}

export interface Vitals {
  id: number
  patient_id: string
  hr: number
  sbp: number
  dbp: number
  spo2: number
  temp: number
  rr: number
  gcs: number
  on_oxygen: boolean
  source: string
  recorded_at: string
}

export interface Doctor {
  id: number
  name: string
  specialty: string
  status: string
  max_patients: number
  color: string
}

export interface DoctorAssignment {
  id: number
  patient_id: string
  doctor_id: number
  assigned_at: string
}

export interface Prescription {
  id: number
  patient_id: string
  drug: string
  dose: string
  route: string
  frequency: string
  duration: string
  prescriber: string
  warnings: { severity: string; message: string }[]
  issued_at: string
}

export interface EHRDiagnosis {
  id: number
  patient_id: string
  code: string
  description: string
  recorded_at: string
}

export interface EHRMedication {
  id: number
  patient_id: string
  name: string
  dose: string
  route: string
  frequency: string
  active: boolean
  recorded_at: string
}

export interface ICD10Assignment {
  id: number
  patient_id: string
  code: string
  description: string
  confidence: number | null
  assigned_at: string
}

export interface PatientRiskScore {
  id: number
  patient_id: string
  dimension: 'sepsis' | 'mortality' | 'icu' | 'readmit'
  score: number
  computed_at: string
}

export interface BedUsageRecord {
  id: number
  date: string
  bed_usage: number
  staffing: number
}

export interface LabResult {
  id: number
  patient_id: string
  panel: 'CBC' | 'BMP' | 'LFT'
  marker: string
  value: number
  unit: string
  ref_low: number | null
  ref_high: number | null
  recorded_at: string
}

export interface InsuranceClaim {
  id: number
  patient_id: string
  icd10_codes: string[]
  procedure_summary: string | null
  status: 'draft' | 'submitted' | 'paid' | 'denied'
  amount: number | null
  created_at: string
}

export interface AuditLogEntry {
  id: number
  actor: string
  action: 'create' | 'update' | 'view'
  resource_type: string
  resource_id: string | null
  patient_id: string | null
  detail: string | null
  created_at: string
}

export interface ImagingStudy {
  id: number
  patient_id: string
  study_type: string
  modality: string
  study_date: string
  status: string
  finding: string
  confidence: number
  flagged: boolean
  created_at: string
}

export interface ChatSessionSummary {
  id: number
  title: string | null
  page_context: string | null
  patient_id: string | null
  updated_at: string
}

export interface PatientAllergy {
  id: number
  patient_id: string
  allergen: string
  reaction: string
  severity: 'severe' | 'moderate' | 'mild' | 'none'
  recorded_at: string
}

export interface DrugFormulary {
  drugs: string[]
  routes: string[]
  frequencies: string[]
  durations: string[]
}

export interface HL7Sample {
  label: string
  type: string
  message: string
}

export interface HL7ConversionSummary {
  id: number
  source: 'paste' | 'upload'
  filename: string | null
  message_type: string | null
  status: 'success' | 'error'
  created_at: string
}

export interface HL7ConversionRecord extends HL7ConversionSummary {
  device_id: string
  file_size: number | null
  error_message: string | null
  hl7_input: string
  fhir_output: object | null
  description: string | null
}

export interface HL7Stats {
  by_type: { type: string; count: number }[]
  by_day: { date: string; count: number }[]
  success_count: number
  error_count: number
}

export type ClinicalRunMode = 'nlp_analyze' | 'note_summary' | 'report_summary' | 'discharge_letter'

export interface ClinicalEntity {
  text: string
  type: string
  start: number
  end: number
  is_negated?: boolean
  is_uncertain?: boolean
}

export interface ClinicalRunSummary {
  id: number
  mode: ClinicalRunMode
  patient_id: string | null
  patient_name: string | null
  status: 'success' | 'error'
  version: number
  root_id: number
  created_at: string
}

export interface ClinicalRunRecord extends ClinicalRunSummary {
  device_id: string
  risk: string | null
  ward: string | null
  input_text: string | null
  input_meta: Record<string, unknown> | null
  output_entities: ClinicalEntity[] | null
  output_text: string | null
  error_message: string | null
  parent_id: number | null
}

export interface ClinicalStats {
  by_mode: { mode: string; count: number }[]
  by_day: { date: string; count: number }[]
  entity_type_freq: { type: string; count: number }[]
  success_count: number
  error_count: number
}

export type DecisionSupportMode = 'pairwise' | 'regimen'

export type InteractionSource = 'curated' | 'fda_ai' | 'unverified' | 'none'

export interface DrugInteraction {
  drug_a: string
  drug_b: string
  interacts: boolean
  severity: 'critical' | 'high' | 'medium' | null
  effect: string | null
  mechanism: string | null
  source?: InteractionSource
}

export interface DecisionSupportRunSummary {
  id: number
  mode: DecisionSupportMode
  patient_id: string | null
  patient_name: string | null
  drugs: string[]
  highest_severity: 'critical' | 'high' | 'medium' | null
  interaction_count: number
  status: 'success' | 'error'
  created_at: string
}

export interface DecisionSupportRunRecord extends DecisionSupportRunSummary {
  device_id: string
  interactions: DrugInteraction[]
  error_message: string | null
}

export interface DecisionSupportStats {
  by_mode: { mode: string; count: number }[]
  by_day: { date: string; count: number }[]
  severity_freq: { severity: string; count: number }[]
  top_drugs: { drug: string; count: number }[]
  success_count: number
  error_count: number
}

export interface KPISnapshot {
  id: number
  total_active: number
  icu_patients: number
  high_risk: number
  available_beds: number
  pending_alerts: number
  todays_admissions: number
  total_active_change: number
  icu_critical: number
  high_risk_change: number
  bed_capacity_pct: number
  alert_critical: number
  admissions_change_pct: number
  updated_at: string
}
