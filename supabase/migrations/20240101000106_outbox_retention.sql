-- ═══════════════════════════════════════════════════════════════
-- Migration 106 — AUDIT REMEDIATION: outbox retention (O-01)
--
-- setu_event_outbox (migration 099) stores a full-row JSON snapshot for
-- every business event, including every rider_locations write, and NOTHING
-- ever deletes published rows (migration 101 only adds the claim lease).
-- Table, TOAST and index growth is unbounded; claim/aggregate queries
-- degrade over time and the database eventually fills.
--
-- FIX
--   • prune_setu_event_outbox(): deletes PUBLISHED rows older than a
--     retention window (default 3 days), in bounded batches, skipping rows
--     locked by a concurrent claimer.
--   • Never deletes unpublished rows (stuck / dead events stay visible for
--     operators; deleting them would silently lose events).
--   • Index on published_at so the prune is an index range scan.
--   • Scheduled hourly via pg_cron when the extension is present.
-- Idempotent.
-- ═══════════════════════════════════════════════════════════════

create index if not exists idx_setu_event_outbox_published_at
  on public.setu_event_outbox (published_at)
  where published_at is not null;

create or replace function public.prune_setu_event_outbox(
  p_published_keep interval default interval '3 days',
  p_batch          integer  default 20000
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer := 0;
begin
  with doomed as (
    select id
      from public.setu_event_outbox
     where published_at is not null
       and published_at < now() - p_published_keep
     order by id
     limit greatest(p_batch, 1)
     for update skip locked
  )
  delete from public.setu_event_outbox o
   using doomed d
   where o.id = d.id;

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke execute on function public.prune_setu_event_outbox(interval, integer) from public, anon, authenticated;
grant  execute on function public.prune_setu_event_outbox(interval, integer) to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if not exists (select 1 from cron.job where jobname = 'prune-setu-event-outbox') then
      perform cron.schedule('prune-setu-event-outbox', '17 * * * *', 'select public.prune_setu_event_outbox();');
    end if;
  else
    raise notice 'pg_cron not installed — schedule public.prune_setu_event_outbox() hourly from your scheduler.';
  end if;
end $$;

insert into audit_log (actor_id, actor, action, target, detail)
values (
  null, 'system', 'schema_migration', 'setu_event_outbox_retention_106',
  'migration_106: published outbox rows older than 3 days are pruned hourly (bounded batches); unpublished rows are never deleted.'
);
