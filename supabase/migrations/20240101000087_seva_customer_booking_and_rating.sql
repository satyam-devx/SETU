-- ════════════════════════════════════════════════════════
-- SEVA JOBS: customer booking loop — rating + cancel
--
-- seva_jobs_customer_insert (for posting a request) and
-- seva_jobs_customer_read (for tracking it) have existed since the
-- very first migration — but nothing in the app ever called them.
-- The seva provider portal could accept/complete jobs, but no
-- customer-facing page ever created one, so the whole feature had no
-- real input. That frontend gap is fixed in the app code alongside
-- this migration; this migration adds the two pieces of server-side
-- support that were missing entirely:
--   1. seva_providers.rating/review_count have been displayed
--      everywhere as if real, but no column ever recorded a
--      per-job rating and nothing ever updated that aggregate.
--   2. A customer had no way to cancel a request they posted — only
--      a provider could update a job's status (seva_jobs_provider_update),
--      and only after accepting it.
-- ════════════════════════════════════════════════════════

alter table seva_jobs
  add column if not exists rating         smallint check (rating between 1 and 5),
  add column if not exists review_comment text;

-- Rate a completed job. Routed through a security-definer RPC rather
-- than a direct client update — same posture as rate_order (see
-- migration 050's comment on that function) — because this needs to
-- atomically roll the new rating into seva_providers' running average,
-- which a raw client UPDATE could get wrong (races, or a client simply
-- computing the average incorrectly) or skip entirely.
create or replace function rate_seva_job(
  p_job_id  uuid,
  p_rating  smallint,
  p_comment text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job seva_jobs;
begin
  select * into v_job from seva_jobs where id = p_job_id;
  if v_job.id is null then
    raise exception 'Job not found';
  end if;
  if v_job.customer_id is distinct from auth.uid() then
    raise exception 'Not authorized to rate this job';
  end if;
  if v_job.status <> 'completed' then
    raise exception 'Only a completed job can be rated';
  end if;
  if v_job.rating is not null then
    raise exception 'This job has already been rated';
  end if;
  if p_rating < 1 or p_rating > 5 then
    raise exception 'Rating must be between 1 and 5';
  end if;

  update seva_jobs
    set rating = p_rating, review_comment = p_comment, updated_at = now()
    where id = p_job_id;

  update seva_providers sp
    set review_count = sp.review_count + 1,
        rating = round(
          (((coalesce(sp.rating, 0) * sp.review_count) + p_rating)::numeric
            / (sp.review_count + 1)),
          2
        )
    where sp.id = v_job.provider_id;
end;
$$;

grant execute on function rate_seva_job(uuid, smallint, text) to authenticated;

-- Cancel a request the customer posted — only while it's still 'open'
-- (unclaimed). Once a provider has accepted it, cancelling is a
-- mediation matter (the anchor disputes/escalations flow already
-- covers that), not a one-tap customer action, so this deliberately
-- does not allow cancelling an accepted/in_progress job.
create or replace function cancel_seva_job(p_job_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job seva_jobs;
begin
  select * into v_job from seva_jobs where id = p_job_id;
  if v_job.id is null then
    raise exception 'Job not found';
  end if;
  if v_job.customer_id is distinct from auth.uid() then
    raise exception 'Not authorized to cancel this job';
  end if;
  if v_job.status <> 'open' then
    raise exception 'Only an open, unaccepted request can be cancelled';
  end if;

  update seva_jobs set status = 'cancelled', updated_at = now() where id = p_job_id;
end;
$$;

grant execute on function cancel_seva_job(uuid) to authenticated;
