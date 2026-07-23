-- Additive schema: drug_interaction_ai_cache, a global (not device-scoped) cache of
-- interaction verdicts computed from real FDA drug label text via Groq, for drug pairs
-- that aren't in decision_support.py's curated table. This is real-world reference data
-- shared across every user, not per-device history like decision_support_runs -- looking
-- up the same pair twice should hit this cache instead of re-querying openFDA + Groq.

create table if not exists drug_interaction_ai_cache (
  id bigint generated always as identity primary key,

  drug_a text not null,                             -- normalized (lowercase, trimmed), lexicographically first
  drug_b text not null,                             -- normalized (lowercase, trimmed), lexicographically second

  interacts boolean not null,
  severity text,                                    -- 'critical' | 'high' | 'medium' | null
  effect text,
  mechanism text,

  source text not null default 'fda_ai',            -- how this verdict was derived ('fda_ai' | 'unverified')
  checked_at timestamptz not null default now(),

  unique (drug_a, drug_b)
);
