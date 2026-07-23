-- Additive schema: decision_support_runs, backing persisted history for the Decision
-- Support module's drug-interaction checker (pairwise and multi-drug regimen modes).
-- device_id-scoped like hl7_conversions/clinical_language_runs -- no login system exists.
--
-- Append-only: unlike clinical_language_runs, a "check" has no meaningful edit/re-run
-- lifecycle (there is no input to revise other than the drug list itself, which just
-- becomes a new check), so there is no parent_id/root_id/version chain here -- every
-- run is simply its own row.

create table if not exists decision_support_runs (
  id bigint generated always as identity primary key,
  device_id text not null,

  mode text not null,                             -- 'pairwise' | 'regimen'

  patient_id text,                                 -- nullable: checks allow "no patient selected"
  patient_name text,                                -- denormalized display cache (survives patient edits/deletes)

  drugs jsonb not null,                             -- input drug names, e.g. ["Warfarin","Aspirin"]
  interactions jsonb not null default '[]',         -- [{drug_a,drug_b,interacts,severity,effect,mechanism}]
  highest_severity text,                            -- 'critical' | 'high' | 'medium' | null (no interaction found)
  interaction_count integer not null default 0,

  status text not null default 'success',           -- 'success' | 'error'
  error_message text,

  created_at timestamptz not null default now()
);

create index if not exists decision_support_runs_device_idx on decision_support_runs (device_id, created_at desc);
create index if not exists decision_support_runs_mode_idx on decision_support_runs (mode);
create index if not exists decision_support_runs_patient_idx on decision_support_runs (patient_id);
