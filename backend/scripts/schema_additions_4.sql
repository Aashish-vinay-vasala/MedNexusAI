-- Additive schema: chat_sessions / chat_messages, backing the global floating AI Assistant
-- widget's persisted conversation history. No login system exists yet, so sessions are scoped
-- by a random device_id generated client-side and stored in localStorage (durable per
-- browser/device, not true cross-device identity).

create table if not exists chat_sessions (
  id bigint generated always as identity primary key,
  device_id text not null,
  title text,
  page_context text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chat_sessions_device_idx on chat_sessions (device_id, updated_at desc);

create table if not exists chat_messages (
  id bigint generated always as identity primary key,
  session_id bigint not null references chat_sessions(id) on delete cascade,
  role text not null,             -- 'user' | 'assistant'
  content text not null,
  sources jsonb,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_session_idx on chat_messages (session_id, created_at);
