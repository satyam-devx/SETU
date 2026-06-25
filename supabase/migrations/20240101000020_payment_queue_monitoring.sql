-- ═══════════════════════════════════════════════════════════════
-- Migration 020: Payment-queue health & monitoring (Phase 4 — scale)
--
-- The razorpay-webhook already behaves like a durable queue: every
-- event is persisted to payment_events with a unique event_id, the
-- handler is idempotent, and a failed handler returns 500 so Razorpay
-- retries (events stay processed_at IS NULL until they succeed).
--
-- What was missing is VISIBILITY: if an event gets stuck unprocessed
-- (handler keeps failing, or an amount-mismatch parked it for manual
-- review), nothing surfaced it. This migration adds:
--   1. A one-shot alerter (flag_stuck_payment_events) + pg_cron job
--      that raises an audit_log alert for events unprocessed > 30 min.
--   2. An admin-gated get_payment_queue_health() snapshot for the
--      monitoring dashboard.
--
-- Pure monitoring — no change to money-path logic.
-- ═══════════════════════════════════════════════════════════════

-- One audit alert per stuck event (not every cron tick).
alter table payment_events
  add column if not exists alert_sent boolean not null default false;

-- Fast lookup of the stuck-event working set.
create index if not exists idx_payment_events_unprocessed_pending
  on payment_events (created_at)
  where processed_at is null and alert_sent = false;

create or replace function flag_stuck_payment_events()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  r       record;
begin
  for r in
    select event_id, type, created_at
    from payment_events
    where processed_at is null
      and alert_sent = false
      and created_at < now() - interval '30 minutes'
  loop
    insert into audit_log (actor_id, actor, action, target, detail)
    values (
      null, 'system', 'payment_event_stuck', r.event_id,
      format('Webhook event %s (%s) unprocessed for >30 min (since %s) — investigate handler/manual-review queue',
             r.event_id, r.type, r.created_at)
    );
    update payment_events set alert_sent = true where event_id = r.event_id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke execute on function flag_stuck_payment_events() from authenticated, anon;

-- Run every 10 minutes (pg_cron upserts by job name).
select cron.schedule('flag-stuck-payments', '*/10 * * * *', $$ select flag_stuck_payment_events(); $$);

-- Admin snapshot of queue health for the monitoring dashboard.
create or replace function get_payment_queue_health()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v jsonb;
begin
  if not is_admin() then
    raise exception 'Unauthorized: admin role required';
  end if;
  select jsonb_build_object(
    'pending',        (select count(*) from payment_events where processed_at is null),
    'stuck_over_30m', (select count(*) from payment_events
                         where processed_at is null and created_at < now() - interval '30 minutes'),
    'processed_24h',  (select count(*) from payment_events
                         where processed_at >= now() - interval '24 hours'),
    'mismatch_flags_24h', (select count(*) from audit_log
                         where action = 'payment_amount_mismatch' and created_at >= now() - interval '24 hours'),
    'as_of', now()
  ) into v;
  return v;
end;
$$;
grant execute on function get_payment_queue_health() to authenticated;

insert into audit_log (actor_id, actor, action, target, detail)
values (
  null, 'system', 'ops_migration', 'payment_events',
  'migration_020: payment-queue monitoring — flag_stuck_payment_events (pg_cron, alerts on events unprocessed >30m) + get_payment_queue_health admin snapshot'
);
