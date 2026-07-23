-- ============================================================
-- MedNexusAI — Supabase Schema + Seed Data
-- Run this in your Supabase SQL Editor
-- ============================================================

-- ─── Tables ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS patients (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  ward       TEXT NOT NULL,
  risk       TEXT NOT NULL CHECK (risk IN ('critical','high','medium','low')),
  age        INTEGER NOT NULL,
  status     TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clinical_alerts (
  id           SERIAL PRIMARY KEY,
  type         TEXT NOT NULL,
  patient      TEXT NOT NULL,
  detail       TEXT NOT NULL,
  time_ago     TEXT NOT NULL,
  severity     TEXT NOT NULL CHECK (severity IN ('critical','high','medium','info')),
  color        TEXT NOT NULL,
  source       TEXT NOT NULL,
  acknowledged BOOLEAN DEFAULT FALSE,
  escalated    BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admissions_daily (
  id           SERIAL PRIMARY KEY,
  day_label    TEXT NOT NULL,
  admissions   INTEGER NOT NULL DEFAULT 0,
  discharges   INTEGER NOT NULL DEFAULT 0,
  readmissions INTEGER NOT NULL DEFAULT 0,
  date         DATE DEFAULT CURRENT_DATE
);

CREATE TABLE IF NOT EXISTS resource_forecast (
  id        SERIAL PRIMARY KEY,
  day_label TEXT NOT NULL,
  bed_usage INTEGER NOT NULL DEFAULT 0,
  staffing  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS activity_feed (
  id         SERIAL PRIMARY KEY,
  icon_name  TEXT NOT NULL,
  color      TEXT NOT NULL,
  label      TEXT NOT NULL,
  detail     TEXT NOT NULL,
  time_ago   TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fhir_resources (
  id            SERIAL PRIMARY KEY,
  patient_id    TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL,
  resource_json JSONB NOT NULL,
  version_id    TEXT NOT NULL DEFAULT '1',
  last_updated  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (patient_id, resource_type)
);

CREATE TABLE IF NOT EXISTS patient_events (
  id          SERIAL PRIMARY KEY,
  patient_id  TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,
  label       TEXT NOT NULL,
  detail      TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  color       TEXT NOT NULL DEFAULT '#8B5CF6',
  source      TEXT NOT NULL DEFAULT 'System',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kpi_snapshot (
  id                    INTEGER PRIMARY KEY DEFAULT 1,
  total_active          INTEGER DEFAULT 0,
  icu_patients          INTEGER DEFAULT 0,
  high_risk             INTEGER DEFAULT 0,
  available_beds        INTEGER DEFAULT 0,
  pending_alerts        INTEGER DEFAULT 0,
  todays_admissions     INTEGER DEFAULT 0,
  total_active_change   INTEGER DEFAULT 0,
  icu_critical          INTEGER DEFAULT 0,
  high_risk_change      INTEGER DEFAULT 0,
  bed_capacity_pct      NUMERIC DEFAULT 0,
  alert_critical        INTEGER DEFAULT 0,
  admissions_change_pct NUMERIC DEFAULT 0,
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Enable Realtime ─────────────────────────────────────────

ALTER TABLE patients          REPLICA IDENTITY FULL;
ALTER TABLE clinical_alerts   REPLICA IDENTITY FULL;
ALTER TABLE admissions_daily  REPLICA IDENTITY FULL;
ALTER TABLE resource_forecast REPLICA IDENTITY FULL;
ALTER TABLE activity_feed     REPLICA IDENTITY FULL;
ALTER TABLE kpi_snapshot      REPLICA IDENTITY FULL;
ALTER TABLE fhir_resources    REPLICA IDENTITY FULL;
ALTER TABLE patient_events    REPLICA IDENTITY FULL;

-- Add tables to realtime publication (run once)
-- ALTER PUBLICATION supabase_realtime ADD TABLE patients, clinical_alerts, admissions_daily, resource_forecast, activity_feed, kpi_snapshot, fhir_resources, patient_events;

-- ─── Seed Data ───────────────────────────────────────────────

INSERT INTO patients (id, name, ward, risk, age, status) VALUES
  ('P4821', 'James Whitfield',  'ICU Ward 3', 'critical', 67, 'Admitted'),
  ('P3309', 'Maria Santos',     'Ward 4',     'high',     54, 'Admitted'),
  ('P5502', 'Robert Chen',      'Ward 2',     'high',     71, 'Admitted'),
  ('P2847', 'Sarah Thompson',   'ICU Ward 1', 'critical', 82, 'Critical'),
  ('P6103', 'David Okonkwo',    'Radiology',  'medium',   45, 'Observation'),
  ('P7821', 'Emily Nakamura',   'Ward 6',     'low',      38, 'Recovering'),
  ('P1205', 'George Abernathy', 'Ward 3',     'medium',   59, 'Admitted'),
  ('P9034', 'Fatima Al-Hassan', 'ICU Ward 2', 'high',     76, 'Critical')
ON CONFLICT (id) DO NOTHING;

INSERT INTO clinical_alerts (type, patient, detail, time_ago, severity, color, source, acknowledged, escalated) VALUES
  ('Sepsis Alert',      'Patient #4821', 'qSOFA score 3 — ICU Ward 3',           '2 min ago',  'critical', '#EF4444', 'Sepsis Warning',       false, false),
  ('Readmission Risk',  'Patient #3309', '87% 30-day readmission probability',   '8 min ago',  'high',     '#F59E0B', 'Readmission',          false, false),
  ('Drug Interaction',  'Patient #5502', 'Warfarin + Aspirin conflict flagged',  '15 min ago', 'critical', '#EF4444', 'Decision Support',     false, false),
  ('ICU Deterioration', 'Patient #2847', 'Vitals declining — immediate review',  '22 min ago', 'critical', '#EF4444', 'ICU Monitoring',       false, false),
  ('Bed Capacity',      'Ward 5',        '94% occupancy — resource alert',       '1 hr ago',   'medium',   '#F59E0B', 'Resource Forecasting', false, false),
  ('Imaging Result',    'Patient #6103', 'Chest X-ray: 94% confidence finding',  '1.5 hr ago', 'info',     '#0EA5E9', 'Medical Imaging AI',   false, false);

INSERT INTO admissions_daily (day_label, admissions, discharges, readmissions, date) VALUES
  ('Mon',   38, 35, 5, CURRENT_DATE - 6),
  ('Tue',   42, 30, 7, CURRENT_DATE - 5),
  ('Wed',   35, 40, 4, CURRENT_DATE - 4),
  ('Thu',   50, 38, 9, CURRENT_DATE - 3),
  ('Fri',   45, 42, 6, CURRENT_DATE - 2),
  ('Sat',   33, 36, 3, CURRENT_DATE - 1),
  ('Today', 42, 28, 8, CURRENT_DATE);

INSERT INTO resource_forecast (day_label, bed_usage, staffing) VALUES
  ('D+1', 78, 72),
  ('D+2', 82, 75),
  ('D+3', 94, 80),
  ('D+4', 88, 82),
  ('D+5', 85, 78),
  ('D+6', 79, 74),
  ('D+7', 76, 71);

INSERT INTO activity_feed (icon_name, color, label, detail, time_ago) VALUES
  ('CheckCircle2',  '#22C55E', 'HL7 Message Processed',    'ADT^A01 — Patient #7821 admitted',    '12s ago'),
  ('Database',      '#0EA5E9', 'FHIR Resource Created',     'Patient/7821 — Bundle committed',      '14s ago'),
  ('Cpu',           '#8B5CF6', 'Risk Model Scored',         'Patient #3309 — risk: 87%',            '1 min ago'),
  ('FileImage',     '#14B8A6', 'Imaging Result Uploaded',   'Chest X-ray #6103 — 94% confidence',  '2 min ago'),
  ('AlertTriangle', '#EF4444', 'Sepsis Alert Triggered',    'Patient #4821 — qSOFA 3',              '2 min ago'),
  ('CheckCircle2',  '#22C55E', 'ICD-10 Code Assigned',      'A41.9 (Sepsis) — Patient #4821',      '3 min ago'),
  ('RefreshCw',     '#F59E0B', 'Readmission Model Updated', 'Batch: 12 patients re-scored',         '5 min ago'),
  ('Database',      '#0EA5E9', 'EHR Record Synced',         'Patient #5502 — medication update',    '7 min ago');

INSERT INTO kpi_snapshot (id, total_active, icu_patients, high_risk, available_beds, pending_alerts, todays_admissions,
                           total_active_change, icu_critical, high_risk_change, bed_capacity_pct, alert_critical, admissions_change_pct)
VALUES (1, 2847, 47, 156, 89, 14, 42, 12, 3, 8, 12.0, 3, 15.0)
ON CONFLICT (id) DO UPDATE SET
  total_active = EXCLUDED.total_active,
  updated_at   = NOW();

-- ─── FHIR Resources (generated per patient, replaces client-side fabrication) ─

WITH cond(name, code) AS (VALUES
  ('Sepsis', 'A41.9'), ('Type 2 Diabetes Mellitus', 'E11.9'), ('Heart Failure', 'I50.9'), ('Pneumonia', 'J18.9'), ('COPD', 'J44.1')
), seed AS (
  SELECT id AS patient_id, (ascii(right(regexp_replace(id, '\D', '', 'g'), 1)) - ascii('0')) AS d FROM patients
)
INSERT INTO fhir_resources (patient_id, resource_type, resource_json, version_id, last_updated)
SELECT s.patient_id, 'Condition',
  jsonb_build_object(
    'resourceType', 'Condition',
    'id', 'cond-' || s.patient_id,
    'clinicalStatus', jsonb_build_object('coding', jsonb_build_array(jsonb_build_object('system', 'http://terminology.hl7.org/CodeSystem/condition-clinical', 'code', 'active'))),
    'verificationStatus', jsonb_build_object('coding', jsonb_build_array(jsonb_build_object('system', 'http://terminology.hl7.org/CodeSystem/condition-ver-status', 'code', 'confirmed'))),
    'severity', jsonb_build_object('coding', jsonb_build_array(jsonb_build_object('system', 'http://snomed.info/sct', 'code', CASE WHEN p.risk = 'critical' THEN '24484000' ELSE '6736007' END, 'display', CASE WHEN p.risk = 'critical' THEN 'Severe' ELSE 'Moderate' END))),
    'code', jsonb_build_object('coding', jsonb_build_array(jsonb_build_object('system', 'http://hl7.org/fhir/sid/icd-10', 'code', c.code, 'display', c.name))),
    'subject', jsonb_build_object('reference', 'Patient/' || s.patient_id),
    'recordedDate', CURRENT_DATE::text
  ),
  '1', NOW()
FROM seed s
JOIN patients p ON p.id = s.patient_id
JOIN LATERAL (SELECT name, code FROM cond OFFSET s.d % 5 LIMIT 1) c ON true
ON CONFLICT (patient_id, resource_type) DO NOTHING;

WITH meds(name, code, dose) AS (VALUES
  ('Warfarin', '372756006', '5mg oral tablet'), ('Metformin', '372567009', '500mg oral tablet'),
  ('Ramipril', '386872004', '10mg oral capsule'), ('Furosemide', '387475002', '40mg oral tablet')
), seed AS (
  SELECT id AS patient_id, (ascii(right(regexp_replace(id, '\D', '', 'g'), 1)) - ascii('0')) AS d FROM patients
)
INSERT INTO fhir_resources (patient_id, resource_type, resource_json, version_id, last_updated)
SELECT s.patient_id, 'MedicationRequest',
  jsonb_build_object(
    'resourceType', 'MedicationRequest',
    'id', 'medrx-' || s.patient_id,
    'status', 'active',
    'intent', 'order',
    'medicationCodeableConcept', jsonb_build_object('coding', jsonb_build_array(jsonb_build_object('system', 'http://snomed.info/sct', 'code', m.code, 'display', m.name)), 'text', m.dose),
    'subject', jsonb_build_object('reference', 'Patient/' || s.patient_id),
    'authoredOn', CURRENT_DATE::text,
    'dosageInstruction', jsonb_build_array(jsonb_build_object('text', m.dose || ' — once daily'))
  ),
  '1', NOW()
FROM seed s
JOIN LATERAL (SELECT name, code, dose FROM meds OFFSET s.d % 4 LIMIT 1) m ON true
ON CONFLICT (patient_id, resource_type) DO NOTHING;

WITH obs(name, code, value) AS (VALUES
  ('Blood Pressure', '55284-4', '138/88 mmHg'), ('Heart Rate', '8867-4', '102 /min'),
  ('Oxygen Saturation', '59408-5', '94 %'), ('Body Temperature', '8310-5', '38.6 °C')
), seed AS (
  SELECT id AS patient_id, (ascii(right(regexp_replace(id, '\D', '', 'g'), 1)) - ascii('0')) AS d FROM patients
)
INSERT INTO fhir_resources (patient_id, resource_type, resource_json, version_id, last_updated)
SELECT s.patient_id, 'Observation',
  jsonb_build_object(
    'resourceType', 'Observation',
    'id', 'obs-' || s.patient_id,
    'status', 'final',
    'category', jsonb_build_array(jsonb_build_object('coding', jsonb_build_array(jsonb_build_object('system', 'http://terminology.hl7.org/CodeSystem/observation-category', 'code', 'vital-signs')))),
    'code', jsonb_build_object('coding', jsonb_build_array(jsonb_build_object('system', 'http://loinc.org', 'code', o.code, 'display', o.name))),
    'subject', jsonb_build_object('reference', 'Patient/' || s.patient_id),
    'effectiveDateTime', NOW()::text,
    'valueString', o.value
  ),
  '1', NOW()
FROM seed s
JOIN LATERAL (SELECT name, code, value FROM obs OFFSET s.d % 4 LIMIT 1) o ON true
ON CONFLICT (patient_id, resource_type) DO NOTHING;

INSERT INTO fhir_resources (patient_id, resource_type, resource_json, version_id, last_updated)
SELECT p.id, 'Encounter',
  jsonb_build_object(
    'resourceType', 'Encounter',
    'id', 'enc-' || p.id,
    'status', CASE WHEN p.status = 'Recovering' THEN 'finished' ELSE 'in-progress' END,
    'class', jsonb_build_object('system', 'http://terminology.hl7.org/CodeSystem/v3-ActCode', 'code', CASE WHEN p.ward ILIKE '%icu%' THEN 'IMP' ELSE 'AMB' END),
    'type', jsonb_build_array(jsonb_build_object('coding', jsonb_build_array(jsonb_build_object('system', 'http://snomed.info/sct', 'code', '11429006', 'display', 'Consultation')))),
    'subject', jsonb_build_object('reference', 'Patient/' || p.id),
    'location', jsonb_build_array(jsonb_build_object('location', jsonb_build_object('display', p.ward)))
  ),
  '1', NOW()
FROM patients p
ON CONFLICT (patient_id, resource_type) DO NOTHING;

INSERT INTO fhir_resources (patient_id, resource_type, resource_json, version_id, last_updated)
SELECT p.id, 'Patient',
  jsonb_build_object(
    'resourceType', 'Patient',
    'id', p.id,
    'meta', jsonb_build_object('versionId', '1', 'lastUpdated', NOW()::text, 'profile', jsonb_build_array('http://hl7.org/fhir/StructureDefinition/Patient')),
    'identifier', jsonb_build_array(jsonb_build_object('system', 'urn:oid:2.16.840.1.113883.2.1.3.2.4.18.28', 'value', p.id, 'use', 'official')),
    'name', jsonb_build_array(jsonb_build_object('use', 'official', 'family', split_part(p.name, ' ', array_length(regexp_split_to_array(p.name, ' '), 1)), 'given', jsonb_build_array(split_part(p.name, ' ', 1)))),
    'gender', CASE WHEN (ascii(right(regexp_replace(p.id, '\D', '', 'g'), 1)) - ascii('0')) % 2 = 0 THEN 'male' ELSE 'female' END,
    'birthDate', (EXTRACT(YEAR FROM CURRENT_DATE)::int - p.age)::text || '-01-01',
    'address', jsonb_build_array(jsonb_build_object('use', 'home', 'city', 'London', 'postalCode', 'E1 6RF', 'country', 'GBR')),
    'generalPractitioner', jsonb_build_array(jsonb_build_object('display', 'Dr. A. Morgan'))
  ),
  '1', NOW()
FROM patients p
ON CONFLICT (patient_id, resource_type) DO NOTHING;

-- ─── Patient Events (timeline, replaces fragile substring-matching) ──────────

INSERT INTO patient_events (patient_id, kind, label, detail, occurred_at, color, source) VALUES
  ('P4821', 'admission', 'Admitted to ICU Ward 3',   'Admitted as critical — ICU Ward 3',              NOW() - INTERVAL '3 days',  '#0EA5E9', 'EHR'),
  ('P4821', 'alert',     'Sepsis Alert Triggered',   'qSOFA score 3 — ICU Ward 3',                     NOW() - INTERVAL '2 min',   '#EF4444', 'Sepsis Warning'),
  ('P4821', 'coding',    'ICD-10 Code Assigned',     'A41.9 (Sepsis)',                                 NOW() - INTERVAL '3 min',   '#22C55E', 'ICD-10 Auto Coding'),

  ('P3309', 'admission', 'Admitted to Ward 4',       'Admitted — high risk',                           NOW() - INTERVAL '2 days',  '#0EA5E9', 'EHR'),
  ('P3309', 'alert',     'Readmission Risk Flagged', '87% 30-day readmission probability',             NOW() - INTERVAL '8 min',   '#F59E0B', 'Readmission'),
  ('P3309', 'risk_score','Risk Model Scored',        'Re-scored — risk: 87%',                          NOW() - INTERVAL '1 min',   '#8B5CF6', 'Risk Assessment'),

  ('P5502', 'admission', 'Admitted to Ward 2',       'Admitted — high risk',                           NOW() - INTERVAL '4 days',  '#0EA5E9', 'EHR'),
  ('P5502', 'alert',     'Drug Interaction Flagged', 'Warfarin + Aspirin conflict flagged',            NOW() - INTERVAL '15 min',  '#EF4444', 'Decision Support'),
  ('P5502', 'medication','EHR Record Synced',        'Medication update recorded',                     NOW() - INTERVAL '7 min',   '#0EA5E9', 'EHR'),

  ('P2847', 'admission', 'Admitted to ICU Ward 1',   'Admitted as critical — ICU Ward 1',              NOW() - INTERVAL '5 days',  '#0EA5E9', 'EHR'),
  ('P2847', 'alert',     'ICU Deterioration',        'Vitals declining — immediate review',            NOW() - INTERVAL '22 min',  '#EF4444', 'ICU Monitoring'),

  ('P6103', 'admission', 'Observation — Radiology',  'Admitted for observation',                       NOW() - INTERVAL '1 day',   '#0EA5E9', 'EHR'),
  ('P6103', 'imaging',   'Imaging Result Uploaded',  'Chest X-ray — 94% confidence finding',           NOW() - INTERVAL '2 min',   '#14B8A6', 'Medical Imaging AI'),
  ('P6103', 'alert',     'Imaging Result Flagged',   'Chest X-ray: 94% confidence finding',            NOW() - INTERVAL '90 min',  '#0EA5E9', 'Medical Imaging AI'),

  ('P7821', 'admission', 'Admitted to Ward 6',       'ADT^A01 — admitted',                             NOW() - INTERVAL '6 days',  '#22C55E', 'HL7 Interface'),
  ('P7821', 'fhir',      'FHIR Resource Created',    'Patient/7821 — Bundle committed',                NOW() - INTERVAL '14 sec',  '#0EA5E9', 'FHIR Converter'),
  ('P7821', 'status',    'Status: Recovering',       'Transitioned to recovering — discharge planning active', NOW() - INTERVAL '1 hour', '#22C55E', 'EHR'),

  ('P1205', 'admission', 'Admitted to Ward 3',       'Admitted — medium risk',                         NOW() - INTERVAL '2 days',  '#0EA5E9', 'EHR'),

  ('P9034', 'admission', 'Admitted to ICU Ward 2',   'Admitted as critical — ICU Ward 2',              NOW() - INTERVAL '3 days',  '#0EA5E9', 'EHR');
