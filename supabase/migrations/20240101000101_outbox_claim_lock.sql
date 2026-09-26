-- SETU Kafka outbox: atomic multi-replica claim.
--
-- setu-kafka-worker runs 2-12 replicas under KEDA (keda/kafka-worker-scaledobject.yaml).
-- The original publish loop did a plain
--   SELECT ... WHERE published_at IS NULL ORDER BY created_at LIMIT N
-- with no row locking, so concurrent replicas could select and publish the
-- same outbox rows to Kafka more than once. Consumers dedupe via a Redis
-- claim keyed on event_id, so this never corrupted business state, but it
-- defeated the point of scaling the deployment and wasted broker throughput.
--
-- This adds a claim step using FOR UPDATE SKIP LOCKED so concurrent
-- replicas each get a disjoint batch of rows, with a lease
-- (claimed_until) that expires if a replica dies mid-batch — after which
-- any replica can safely reclaim the same rows.

alter table public.setu_event_outbox
  add column if not exists claimed_until timestamptz,
  add column if not exists claimed_by text;

-- The old partial index only needs to support "still unpublished"
-- lookups; the claim function itself filters on claimed_until, so no
-- index change is required there, but WHERE published_at IS NULL already
-- exists (idx_setu_event_outbox_unpublished from 20240101000099).

create or replace function public.setu_claim_outbox_batch(
  p_limit integer,
  p_worker_id text,
  p_max_attempts integer default 20,
  p_lease_seconds integer default 30
)
returns setof public.setu_event_outbox
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    update public.setu_event_outbox o
    set claimed_until = now() + make_interval(secs => greatest(p_lease_seconds, 1)),
        claimed_by = p_worker_id
    from (
      select id
      from public.setu_event_outbox
      where published_at is null
        and attempts < p_max_attempts
        and (claimed_until is null or claimed_until < now())
      order by created_at asc
      limit greatest(p_limit, 1)
      for update skip locked
    ) claim
    where o.id = claim.id
    returning o.*;
end;
$$;

revoke all on function public.setu_claim_outbox_batch(integer, text, integer, integer) from public;
grant execute on function public.setu_claim_outbox_batch(integer, text, integer, integer) to service_role;

comment on function public.setu_claim_outbox_batch is
  'Atomically claims up to p_limit unpublished (or lease-expired) outbox rows for p_worker_id using FOR UPDATE SKIP LOCKED, so multiple setu-kafka-worker replicas never claim the same row. Caller must clear claimed_until when it marks a row published.';
