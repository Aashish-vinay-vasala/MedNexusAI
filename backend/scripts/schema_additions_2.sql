-- Additive schema: patient_allergies, backing the Prescription module's allergy panel.
-- Replaces the previous frontend-only ALLERGY_SETS/seedN() fabrication — allergies are now
-- generated once server-side (same deterministic hash-of-id convention) and persisted, matching
-- the vitals/lab_results auto-seed-on-first-view pattern.

create table if not exists patient_allergies (
  id bigint generated always as identity primary key,
  patient_id text not null references patients(id) on delete cascade,
  allergen text not null,
  reaction text not null,
  severity text not null default 'moderate',  -- severe | moderate | mild | none
  recorded_at timestamptz not null default now()
);

create index if not exists patient_allergies_patient_idx on patient_allergies (patient_id);
