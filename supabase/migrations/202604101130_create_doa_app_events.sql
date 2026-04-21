create table if not exists public.doa_app_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default timezone('utc'::text, now()),
  event_name text not null,
  event_category text not null,
  event_source text not null default 'server',
  outcome text not null default 'info',
  actor_user_id uuid null,
  request_id text null,
  session_id text null,
  route text null,
  method text null,
  entity_type text null,
  entity_id text null,
  entity_code text null,
  metadata jsonb not null default '{}'::jsonb,
  user_agent text null,
  ip_address text null,
  referrer text null,
  constraint doa_app_events_event_source_check check (event_source in ('server', 'client')),
  constraint doa_app_events_outcome_check check (outcome in ('attempt', 'success', 'failure', 'info'))
);

comment on table public.doa_app_events is
  'Canonical phase 1 application observability log for DOA Operations Hub.';

comment on column public.doa_app_events.metadata is
  'Redacted JSON metadata for operational events. Raw message bodies and sensitive payloads must not be stored here.';

create index if not exists doa_app_events_created_at_idx
  on public.doa_app_events (created_at desc);

create index if not exists doa_app_events_event_name_created_at_idx
  on public.doa_app_events (event_name, created_at desc);

create index if not exists doa_app_events_actor_created_at_idx
  on public.doa_app_events (actor_user_id, created_at desc);

create index if not exists doa_app_events_entity_created_at_idx
  on public.doa_app_events (entity_type, entity_id, created_at desc);

create index if not exists doa_app_events_request_id_idx
  on public.doa_app_events (request_id)
  where request_id is not null;

create index if not exists doa_app_events_metadata_gin_idx
  on public.doa_app_events
  using gin (metadata jsonb_path_ops);

alter table public.doa_app_events enable row level security;

revoke all on public.doa_app_events from anon, authenticated;
grant all on public.doa_app_events to service_role;
