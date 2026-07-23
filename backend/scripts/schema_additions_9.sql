-- Additive schema: adds patient linkage to chat_sessions so a saved AI Clinical Assistant
-- conversation can be scoped/filtered by patient. Nullable — the global floating assistant
-- widget's general-purpose chats (asked with no patient selected) have no patient_id.

alter table chat_sessions add column if not exists patient_id text references patients(id) on delete set null;
create index if not exists chat_sessions_patient_idx on chat_sessions (patient_id, updated_at desc);
