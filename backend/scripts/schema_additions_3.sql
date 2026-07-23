-- Additive schema: imaging_studies, backing the Medical Imaging AI module's per-patient
-- study history panel. Replaces the previous frontend-only generateStudies() fabrication —
-- studies are now generated once server-side (same deterministic hash-of-id convention as
-- vitals/lab_results) and persisted, matching the auto-seed-on-first-view pattern.

create table if not exists imaging_studies (
  id bigint generated always as identity primary key,
  patient_id text not null references patients(id) on delete cascade,
  study_type text not null,
  modality text not null,
  study_date date not null,
  status text not null default 'Pending Review',  -- Pending Review | Reviewed
  finding text not null,
  confidence numeric not null,
  flagged boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists imaging_studies_patient_idx on imaging_studies (patient_id);
