-- Additive schema: clinical_language_runs, backing the merged "Clinical NLP & Text
-- Generation" module (previously two separate, non-persisted modules: NLP Pipeline's
-- MedSpaCy entity extraction and Clinical Text Generation's Groq-based summarization).
-- device_id-scoped like hl7_conversions (schema_additions_5.sql) -- no login system exists.
--
-- One row per run. "Update" in this app's CRUD sense = re-running analysis/generation
-- after editing the input, which inserts a NEW row rather than mutating the old one
-- (AI output is treated as immutable once generated). parent_id/root_id/version link
-- re-runs back to the record whose input was edited, so History can show either the
-- latest version of each record or every version.

create table if not exists clinical_language_runs (
  id bigint generated always as identity primary key,
  device_id text not null,

  mode text not null,                            -- 'nlp_analyze' | 'note_summary' | 'report_summary' | 'discharge_letter'

  patient_id text,                                -- nullable: nlp_analyze/note_summary allow "no patient selected" (sample notes)
  patient_name text,                              -- denormalized display cache (survives patient edits/deletes)
  risk text,                                      -- risk band at time of run, display-only
  ward text,                                       -- discharge_letter only

  input_text text,                                -- note_text (nlp_analyze/note_summary) or lab_report (report_summary); null for discharge_letter
  input_meta jsonb,                                -- discharge_letter: {diagnoses:[...], medications:[...]} snapshot at run time

  output_entities jsonb,                           -- nlp_analyze only: [{text,type,start,end,is_negated,is_uncertain}]
  output_text text,                                -- note_summary/report_summary/discharge_letter only: raw Groq content

  status text not null default 'success',         -- 'success' | 'error'
  error_message text,

  parent_id bigint,                                -- immediate predecessor version's id, null for the first version (no FK -- see below)
  root_id bigint not null,                         -- groups all versions of one logical record; equals own id on first version
  version integer not null default 1,

  created_at timestamptz not null default now()
);

-- No FK constraint on parent_id/root_id: they're a grouping key, not referential
-- integrity -- deleting one version must never cascade-delete siblings or fail because
-- a sibling still points at it.
create index if not exists clinical_language_runs_device_idx on clinical_language_runs (device_id, created_at desc);
create index if not exists clinical_language_runs_mode_idx on clinical_language_runs (mode);
create index if not exists clinical_language_runs_patient_idx on clinical_language_runs (patient_id);
create index if not exists clinical_language_runs_root_idx on clinical_language_runs (root_id);
