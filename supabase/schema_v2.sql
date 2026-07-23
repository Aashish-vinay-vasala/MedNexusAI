-- ============================================================
-- MedNexusAI — Schema v2 (real backend logic for every module)
-- Run this in your Supabase SQL Editor AFTER seed.sql
-- ============================================================

-- ─── clinical_alerts: add real patient FK + category ──────────

ALTER TABLE clinical_alerts ADD COLUMN IF NOT EXISTS patient_id TEXT REFERENCES patients(id) ON DELETE CASCADE;
ALTER TABLE clinical_alerts ADD COLUMN IF NOT EXISTS category TEXT;

-- ─── New tables ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vitals (
  id          SERIAL PRIMARY KEY,
  patient_id  TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  hr          INTEGER NOT NULL,
  sbp         INTEGER NOT NULL,
  dbp         INTEGER NOT NULL,
  spo2        INTEGER NOT NULL,
  temp        NUMERIC NOT NULL,
  rr          INTEGER NOT NULL,
  gcs         INTEGER NOT NULL DEFAULT 15,
  on_oxygen   BOOLEAN NOT NULL DEFAULT FALSE,
  source      TEXT NOT NULL DEFAULT 'Simulated Monitor',
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS doctors (
  id           SERIAL PRIMARY KEY,
  name         TEXT NOT NULL,
  specialty    TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'Available',
  max_patients INTEGER NOT NULL DEFAULT 8,
  color        TEXT NOT NULL DEFAULT '#0EA5E9'
);

CREATE TABLE IF NOT EXISTS doctor_assignments (
  id          SERIAL PRIMARY KEY,
  patient_id  TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id   INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (patient_id)
);

CREATE TABLE IF NOT EXISTS prescriptions (
  id          SERIAL PRIMARY KEY,
  patient_id  TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  drug        TEXT NOT NULL,
  dose        TEXT NOT NULL,
  route       TEXT NOT NULL,
  frequency   TEXT NOT NULL,
  duration    TEXT NOT NULL,
  prescriber  TEXT NOT NULL,
  warnings    JSONB NOT NULL DEFAULT '[]',
  issued_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ehr_diagnoses (
  id          SERIAL PRIMARY KEY,
  patient_id  TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  code        TEXT NOT NULL,
  description TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ehr_medications (
  id          SERIAL PRIMARY KEY,
  patient_id  TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  dose        TEXT NOT NULL,
  route       TEXT NOT NULL,
  frequency   TEXT NOT NULL,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS icd10_assignments (
  id          SERIAL PRIMARY KEY,
  patient_id  TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  code        TEXT NOT NULL,
  description TEXT NOT NULL,
  confidence  NUMERIC,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS patient_risk_scores (
  id           SERIAL PRIMARY KEY,
  patient_id   TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  dimension    TEXT NOT NULL CHECK (dimension IN ('sepsis','mortality','icu','readmit')),
  score        NUMERIC NOT NULL,
  computed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (patient_id, dimension)
);

CREATE TABLE IF NOT EXISTS bed_usage_daily (
  id         SERIAL PRIMARY KEY,
  date       DATE NOT NULL UNIQUE,
  bed_usage  INTEGER NOT NULL,
  staffing   INTEGER NOT NULL
);

-- ─── Enable Realtime ─────────────────────────────────────────

ALTER TABLE vitals               REPLICA IDENTITY FULL;
ALTER TABLE doctors               REPLICA IDENTITY FULL;
ALTER TABLE doctor_assignments    REPLICA IDENTITY FULL;
ALTER TABLE prescriptions         REPLICA IDENTITY FULL;
ALTER TABLE ehr_diagnoses         REPLICA IDENTITY FULL;
ALTER TABLE ehr_medications       REPLICA IDENTITY FULL;
ALTER TABLE icd10_assignments     REPLICA IDENTITY FULL;
ALTER TABLE patient_risk_scores   REPLICA IDENTITY FULL;
ALTER TABLE bed_usage_daily       REPLICA IDENTITY FULL;

-- Add tables to realtime publication (run once)
-- ALTER PUBLICATION supabase_realtime ADD TABLE vitals, doctors, doctor_assignments, prescriptions, ehr_diagnoses, ehr_medications, icd10_assignments, patient_risk_scores, bed_usage_daily;

-- ─── Seed: doctors (replaces hardcoded roster in DoctorAssignmentPage.tsx) ────

INSERT INTO doctors (name, specialty, status, max_patients, color) VALUES
  ('Dr. Amara Okafor',   'Internal Medicine', 'Available', 8, '#0EA5E9'),
  ('Dr. Liam Sinclair',  'Critical Care',     'Available', 6, '#EF4444'),
  ('Dr. Priya Nair',     'Cardiology',        'Available', 8, '#8B5CF6'),
  ('Dr. Marcus Webb',    'Respiratory',       'Available', 8, '#14B8A6'),
  ('Dr. Sofia Alvarez',  'General Surgery',   'Available', 7, '#F59E0B'),
  ('Dr. Ethan Brooks',   'Nephrology',        'Available', 8, '#22C55E')
ON CONFLICT DO NOTHING;

-- ─── Seed: 14 days of bed-usage history (for Holt-Winters forecasting) ───────

INSERT INTO bed_usage_daily (date, bed_usage, staffing) VALUES
  (CURRENT_DATE - 13, 70, 68), (CURRENT_DATE - 12, 74, 70), (CURRENT_DATE - 11, 79, 73),
  (CURRENT_DATE - 10, 72, 71), (CURRENT_DATE - 9,  68, 69), (CURRENT_DATE - 8,  75, 72),
  (CURRENT_DATE - 7,  81, 76), (CURRENT_DATE - 6,  78, 72), (CURRENT_DATE - 5,  82, 75),
  (CURRENT_DATE - 4,  94, 80), (CURRENT_DATE - 3,  88, 82), (CURRENT_DATE - 2,  85, 78),
  (CURRENT_DATE - 1,  79, 74), (CURRENT_DATE,      76, 71)
ON CONFLICT (date) DO NOTHING;
