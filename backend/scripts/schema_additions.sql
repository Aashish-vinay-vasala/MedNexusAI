-- Additive schema for the 3 new modules that need real persistence:
-- Lab Results Trend Analyzer, Insurance Claims Generator, Audit & Compliance Log.
--
-- Safe to run once against the same Supabase project the rest of the app uses.
-- Every new module works on fallback/demo data without this migration; running
-- it upgrades those modules to live, persisted data (matching the existing
-- pattern for kpi_snapshot, patients, clinical_alerts, etc.).

create table if not exists lab_results (
  id bigint generated always as identity primary key,
  patient_id text not null,
  panel text not null,             -- 'CBC' | 'BMP' | 'LFT'
  marker text not null,             -- 'WBC', 'Hemoglobin', 'Creatinine', ...
  value numeric not null,
  unit text not null,
  ref_low numeric,
  ref_high numeric,
  recorded_at timestamptz not null default now()
);

create index if not exists lab_results_patient_idx on lab_results (patient_id, recorded_at desc);

create table if not exists insurance_claims (
  id bigint generated always as identity primary key,
  patient_id text not null,
  icd10_codes text[] not null default '{}',
  procedure_summary text,
  status text not null default 'draft',   -- draft | submitted | paid | denied
  amount numeric,
  created_at timestamptz not null default now()
);

create index if not exists insurance_claims_patient_idx on insurance_claims (patient_id, created_at desc);

create table if not exists audit_log (
  id bigint generated always as identity primary key,
  actor text not null default 'clinician',
  action text not null,             -- create | update | view
  resource_type text not null,      -- 'ehr_diagnosis' | 'ehr_medication' | 'prescription' | ...
  resource_id text,
  patient_id text,
  detail text,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_created_idx on audit_log (created_at desc);
