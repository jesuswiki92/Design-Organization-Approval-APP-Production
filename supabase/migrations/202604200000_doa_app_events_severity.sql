-- Block 5 / Item A: First-class `severity` column on doa_app_events.
--
-- Rationale: severity is currently smuggled inside `metadata.severity`. We want
-- a dedicated column so we can index + query by severity without JSON operators.
--
-- Safe to run multiple times. Backfill pulls legacy severity from metadata.
alter table public.doa_app_events
  add column if not exists severity text not null default 'info'
  check (severity in ('info', 'warn', 'error', 'critical'));

create index if not exists idx_doa_app_events_severity
  on public.doa_app_events (severity);

-- Backfill from legacy metadata.severity if present.
-- We also map legacy 'warning' -> 'warn' for consistency.
update public.doa_app_events
   set severity = case
       when metadata->>'severity' in ('info','warn','error','critical') then metadata->>'severity'
       when metadata->>'severity' = 'warning' then 'warn'
       else 'info'
   end
 where severity is null or severity = 'info';

comment on column public.doa_app_events.severity is
  'Severity level for the event. Prefer this column over metadata.severity (kept for back-compat).';
