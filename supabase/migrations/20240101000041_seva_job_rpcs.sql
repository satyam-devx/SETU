-- ═══════════════════════════════════════════════════════════════
-- Migration 041: Seva provider job lifecycle (real backend)
--
-- The Seva provider portal was UI-only (hardcoded jobs, mock provider).
-- This wires it to real data:
--   1. seva_providers_own_read — a provider must always read their OWN
--      row; the existing public_read only exposes is_available=true rows,
--      so an offline/unverified provider couldn't load their dashboard.
--   2. accept_seva_job  — claim an OPEN job. Direct UPDATE is impossible
--      because seva_jobs_provider_update's USING checks provider_id = me,
--      which is null for open jobs. SECURITY DEFINER + provider check.
--   3. complete_seva_job — provider marks their job done; credits
--      jobs_completed + monthly_earnings. Audited.
-- ═══════════════════════════════════════════════════════════════

-- 1. Own-row read for providers (regardless of availability)
drop policy if exists "seva_providers_own_read" on seva_providers;
create policy "seva_providers_own_read"
  on seva_providers for select using (user_id = auth.uid());

-- 2. Claim an open job
create or replace function accept_seva_job(p_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_provider_id uuid;
  v_job seva_jobs%rowtype;
begin
  select id into v_provider_id from seva_providers where user_id = auth.uid();
  if v_provider_id is null then
    raise exception 'Unauthorized: not a registered seva provider';
  end if;

  select * into v_job from seva_jobs where id = p_job_id for update;
  if not found then raise exception 'Job not found'; end if;
  if v_job.status <> 'open' then
    raise exception 'Job is no longer available (status: %)', v_job.status;
  end if;

  update seva_jobs
     set provider_id = v_provider_id,
         status      = 'accepted',
         updated_at  = now()
   where id = p_job_id;

  insert into audit_log (actor_id, actor, action, target, target_type, detail)
  values (auth.uid(), coalesce((select name from profiles where id = auth.uid()), 'seva_provider'),
          'seva_job_accepted', p_job_id::text, 'seva_job', v_job.title);

  return jsonb_build_object('success', true, 'job_id', p_job_id, 'status', 'accepted');
end;
$$;
grant execute on function accept_seva_job(uuid) to authenticated;

-- 3. Complete an accepted job (credits provider stats)
create or replace function complete_seva_job(p_job_id uuid, p_notes text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_provider_id uuid;
  v_job seva_jobs%rowtype;
begin
  select id into v_provider_id from seva_providers where user_id = auth.uid();
  if v_provider_id is null then
    raise exception 'Unauthorized: not a registered seva provider';
  end if;

  select * into v_job from seva_jobs where id = p_job_id for update;
  if not found then raise exception 'Job not found'; end if;
  if v_job.provider_id is distinct from v_provider_id then
    raise exception 'Unauthorized: not your job';
  end if;
  if v_job.status not in ('accepted','in_progress') then
    -- Idempotent: already finalised.
    return jsonb_build_object('success', true, 'skipped', true, 'status', v_job.status);
  end if;

  update seva_jobs
     set status       = 'completed',
         completed_at = now(),
         notes        = coalesce(p_notes, notes),
         updated_at   = now()
   where id = p_job_id;

  update seva_providers
     set jobs_completed   = jobs_completed + 1,
         monthly_earnings = monthly_earnings + v_job.amount,
         updated_at       = now()
   where id = v_provider_id;

  insert into audit_log (actor_id, actor, action, target, target_type, detail)
  values (auth.uid(), coalesce((select name from profiles where id = auth.uid()), 'seva_provider'),
          'seva_job_completed', p_job_id::text, 'seva_job', format('completed — ₹%s', v_job.amount));

  return jsonb_build_object('success', true, 'job_id', p_job_id, 'status', 'completed', 'amount', v_job.amount);
end;
$$;
grant execute on function complete_seva_job(uuid, text) to authenticated;
