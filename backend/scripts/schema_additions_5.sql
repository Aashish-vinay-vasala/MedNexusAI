-- Additive schema: hl7_conversions, backing the HL7 -> FHIR Converter page's persisted
-- conversion history (pasted messages and uploaded .hl7/.txt files), on-demand PDF report
-- generation, and on-demand AI result descriptions. No login system exists yet, so rows are
-- scoped by the same random device_id generated client-side and stored in localStorage that
-- chat_sessions (schema_additions_4.sql) uses -- durable per browser/device, not true
-- cross-device identity.

create table if not exists hl7_conversions (
  id bigint generated always as identity primary key,
  device_id text not null,
  source text not null default 'paste',        -- 'paste' | 'upload'
  filename text,
  file_size integer,
  message_type text,                            -- e.g. ADT^A01, ORM^O01
  status text not null default 'success',       -- 'success' | 'error'
  error_message text,
  hl7_input text not null,
  fhir_output jsonb,
  description text,                             -- cached AI-generated plain-language description
  created_at timestamptz not null default now()
);

create index if not exists hl7_conversions_device_idx on hl7_conversions (device_id, created_at desc);
create index if not exists hl7_conversions_type_idx on hl7_conversions (message_type);
