-- Block 5 / Item I: AI response cache (server-side).
--
-- Key-value cache for expensive AI endpoint responses. Keyed on a caller-chosen
-- string (typically a SHA-256 of the prompt + model + params). Values are
-- opaque strings (typically JSON). `expires_at` is used for TTL.
--
-- Only service_role writes/reads; RLS denies authenticated role access.
create table if not exists public.doa_ai_response_cache (
  key text primary key,
  value text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default timezone('utc'::text, now())
);

comment on table public.doa_ai_response_cache is
  'Server-side cache for AI endpoint responses. Service-role only.';

create index if not exists idx_doa_ai_response_cache_expires_at
  on public.doa_ai_response_cache (expires_at);

alter table public.doa_ai_response_cache enable row level security;

-- Revoke all access from non-service roles; service_role bypasses RLS so it
-- retains full access without an explicit policy.
revoke all on public.doa_ai_response_cache from anon, authenticated;
grant all on public.doa_ai_response_cache to service_role;
