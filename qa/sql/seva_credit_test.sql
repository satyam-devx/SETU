-- ═══════════════════════════════════════════════════════════════
-- SETU — Seva Job Lifecycle & Credit Application Proof
--   migrations 041 (accept/complete seva job), 042 (request_credit),
--   043 (review_credit_request)
--
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
--        -v ON_ERROR_STOP=1 -f qa/sql/seva_credit_test.sql
--
-- Runs in one transaction, ends with ROLLBACK (non-destructive).
-- ═══════════════════════════════════════════════════════════════

begin;

-- ── Seed (as postgres; RLS bypassed) ────────────────────────────
insert into villages (id, name, block, district, state, is_active)
values ('scvtest', 'SC Test Village', 'Madhepur', 'Madhubani', 'Bihar', true)
on conflict (id) do nothing;

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at, email_confirmed_at)
values
  ('00000000-0000-0000-0000-000000000000','c1111111-1111-1111-1111-111111111111','authenticated','authenticated','cust@test.local','{}','{}', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000','50000000-0000-0000-0000-000000000001','authenticated','authenticated','prov1@test.local','{}','{}', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000','50000000-0000-0000-0000-000000000002','authenticated','authenticated','prov2@test.local','{}','{}', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000','59999999-9999-9999-9999-999999999999','authenticated','authenticated','super@test.local','{}','{}', now(), now(), now());

update profiles set role='customer',      name='Cust',  village_id='scvtest' where id='c1111111-1111-1111-1111-111111111111';
update profiles set role='seva_provider', name='Prov1', village_id='scvtest' where id='50000000-0000-0000-0000-000000000001';
update profiles set role='seva_provider', name='Prov2', village_id='scvtest' where id='50000000-0000-0000-0000-000000000002';
update profiles set role='super_admin',   name='Super', village_id='scvtest' where id='59999999-9999-9999-9999-999999999999';

insert into seva_providers (id, user_id, name, category, village_id, is_available, is_verified, hourly_rate, jobs_completed, monthly_earnings, kyc_status)
values
  ('5a000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','Prov1','Electrician','scvtest', true, true, 300, 0, 0, 'verified'),
  ('5a000000-0000-0000-0000-000000000002','50000000-0000-0000-0000-000000000002','Prov2','Plumber','scvtest', true, true, 250, 0, 0, 'verified');

insert into seva_jobs (id, customer_id, customer_name, village_id, title, description, category, amount, urgency, status)
values ('5b000000-0000-0000-0000-000000000001','c1111111-1111-1111-1111-111111111111','Cust','scvtest','Wiring repair','MCB tripping','Electrician', 450, 'today', 'open');

insert into credit_accounts (user_id, credit_limit, outstanding, status)
values ('c1111111-1111-1111-1111-111111111111', 1000, 0, 'active');

-- ═══════════════════════════════════════════════════════════════
-- SEVA JOB LIFECYCLE
-- ═══════════════════════════════════════════════════════════════

-- T1: a non-provider (customer) cannot accept a job.
set local role authenticated;
set local request.jwt.claims = '{"sub":"c1111111-1111-1111-1111-111111111111","role":"authenticated"}';
do $$
begin
  begin
    perform accept_seva_job('5b000000-0000-0000-0000-000000000001');
    raise exception 'FAIL T1: customer was allowed to accept a job';
  exception when others then
    if position('not a registered seva provider' in sqlerrm) > 0 then raise notice 'PASS T1: accept denied to non-provider';
    else raise; end if;
  end;
end $$;

-- T2: a provider claims the open job.
set local request.jwt.claims = '{"sub":"50000000-0000-0000-0000-000000000001","role":"authenticated"}';
do $$
declare v jsonb; v_status text; v_pid uuid;
begin
  v := accept_seva_job('5b000000-0000-0000-0000-000000000001');
  if not (v->>'success')::boolean then raise exception 'FAIL T2: accept failed: %', v::text; end if;
  reset role;
  select status, provider_id into v_status, v_pid from seva_jobs where id='5b000000-0000-0000-0000-000000000001';
  if v_status <> 'accepted' then raise exception 'FAIL T2: status % expected accepted', v_status; end if;
  if v_pid <> '5a000000-0000-0000-0000-000000000001' then raise exception 'FAIL T2: provider_id not set to claimant'; end if;
  raise notice 'PASS T2: provider claimed open job';
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"50000000-0000-0000-0000-000000000001","role":"authenticated"}';
end $$;

-- T3: the job is no longer open — a second provider cannot accept it.
set local request.jwt.claims = '{"sub":"50000000-0000-0000-0000-000000000002","role":"authenticated"}';
do $$
begin
  begin
    perform accept_seva_job('5b000000-0000-0000-0000-000000000001');
    raise exception 'FAIL T3: already-accepted job was claimable';
  exception when others then
    if position('no longer available' in sqlerrm) > 0 then raise notice 'PASS T3: cannot claim an accepted job';
    else raise; end if;
  end;
end $$;

-- T4: a different provider cannot complete someone else's job.
do $$
begin
  begin
    perform complete_seva_job('5b000000-0000-0000-0000-000000000001', 'sneaky');
    raise exception 'FAIL T4: foreign provider completed the job';
  exception when others then
    if position('not your job' in sqlerrm) > 0 then raise notice 'PASS T4: cannot complete another provider''s job';
    else raise; end if;
  end;
end $$;

-- T5: the owning provider completes it → stats credited.
set local request.jwt.claims = '{"sub":"50000000-0000-0000-0000-000000000001","role":"authenticated"}';
do $$
declare v jsonb; v_status text; v_done int; v_earn numeric;
begin
  v := complete_seva_job('5b000000-0000-0000-0000-000000000001', 'fixed MCB');
  if not (v->>'success')::boolean then raise exception 'FAIL T5: complete failed: %', v::text; end if;
  reset role;
  select status into v_status from seva_jobs where id='5b000000-0000-0000-0000-000000000001';
  if v_status <> 'completed' then raise exception 'FAIL T5: status % expected completed', v_status; end if;
  select jobs_completed, monthly_earnings into v_done, v_earn from seva_providers where id='5a000000-0000-0000-0000-000000000001';
  if v_done <> 1 then raise exception 'FAIL T5: jobs_completed % expected 1', v_done; end if;
  if v_earn <> 450 then raise exception 'FAIL T5: monthly_earnings % expected 450', v_earn; end if;
  raise notice 'PASS T5: job completed; provider stats credited (₹450, 1 job)';
  set local role authenticated;
end $$;

-- ═══════════════════════════════════════════════════════════════
-- CREDIT APPLICATION → APPROVAL → DISBURSEMENT
-- ═══════════════════════════════════════════════════════════════

-- T6: request beyond available credit is rejected (limit 1000, outstanding 0).
set local request.jwt.claims = '{"sub":"c1111111-1111-1111-1111-111111111111","role":"authenticated"}';
do $$
begin
  begin
    perform request_credit(99999, 'too much');
    raise exception 'FAIL T6: over-limit credit request accepted';
  exception when others then
    if position('exceeds available credit' in sqlerrm) > 0 then raise notice 'PASS T6: over-limit request rejected';
    else raise; end if;
  end;
end $$;

-- T7: a valid request creates a pending application (no money moves yet).
do $$
declare v jsonb; v_out numeric; n int;
begin
  v := request_credit(500, 'inventory');
  if (v->>'status') <> 'pending' then raise exception 'FAIL T7: expected pending, got %', v::text; end if;
  reset role;
  select outstanding into v_out from credit_accounts where user_id='c1111111-1111-1111-1111-111111111111';
  if v_out <> 0 then raise exception 'FAIL T7: outstanding moved before approval (got %)', v_out; end if;
  select count(*) into n from credit_disbursements where user_id='c1111111-1111-1111-1111-111111111111' and status='pending';
  if n <> 1 then raise exception 'FAIL T7: pending application not recorded'; end if;
  raise notice 'PASS T7: pending application created; outstanding untouched';
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"c1111111-1111-1111-1111-111111111111","role":"authenticated"}';
end $$;

-- T8: a second pending request is blocked.
do $$
begin
  begin
    perform request_credit(100, 'again');
    raise exception 'FAIL T8: stacked pending request allowed';
  exception when others then
    if position('already have a pending' in sqlerrm) > 0 then raise notice 'PASS T8: duplicate pending blocked';
    else raise; end if;
  end;
end $$;

-- T9: a non-finance user cannot review requests.
do $$
declare v_id uuid;
begin
  reset role;
  select id into v_id from credit_disbursements where user_id='c1111111-1111-1111-1111-111111111111' and status='pending';
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"c1111111-1111-1111-1111-111111111111","role":"authenticated"}';
  begin
    perform review_credit_request(v_id, true, null);
    raise exception 'FAIL T9: non-finance user approved a credit request';
  exception when others then
    if position('finance.manage' in sqlerrm) > 0 then raise notice 'PASS T9: review denied to non-finance user';
    else raise; end if;
  end;
end $$;

-- T10: a finance admin (super_admin) approves → disbursed + outstanding increases.
set local request.jwt.claims = '{"sub":"59999999-9999-9999-9999-999999999999","role":"authenticated"}';
do $$
declare v jsonb; v_id uuid; v_out numeric; v_dstatus text; n int;
begin
  reset role;
  select id into v_id from credit_disbursements where user_id='c1111111-1111-1111-1111-111111111111' and status='pending';
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"59999999-9999-9999-9999-999999999999","role":"authenticated"}';

  v := review_credit_request(v_id, true, 'ok');
  if (v->>'status') <> 'disbursed' then raise exception 'FAIL T10: expected disbursed, got %', v::text; end if;

  reset role;
  select outstanding into v_out from credit_accounts where user_id='c1111111-1111-1111-1111-111111111111';
  if v_out <> 500 then raise exception 'FAIL T10: outstanding % expected 500 after disbursement', v_out; end if;
  select status into v_dstatus from credit_disbursements where id=v_id;
  if v_dstatus <> 'disbursed' then raise exception 'FAIL T10: disbursement status % expected disbursed', v_dstatus; end if;
  select count(*) into n from credit_transactions
    where user_id='c1111111-1111-1111-1111-111111111111' and type='disbursement' and amount=500;
  if n < 1 then raise exception 'FAIL T10: no disbursement credit_transaction recorded'; end if;
  raise notice 'PASS T10: approval disbursed ₹500 (outstanding + transaction recorded)';
end $$;

-- ═══════════════════════════════════════════════════════════════
-- ADMIN VILLAGE STATS (migration 044)
-- ═══════════════════════════════════════════════════════════════

-- T11: a non-admin cannot read admin village stats.
set local role authenticated;
set local request.jwt.claims = '{"sub":"c1111111-1111-1111-1111-111111111111","role":"authenticated"}';
do $$
begin
  begin
    perform * from get_admin_village_stats();
    raise exception 'FAIL T11: non-admin read admin village stats';
  exception when others then
    if position('villages.view' in sqlerrm) > 0 then raise notice 'PASS T11: village stats denied to non-admin';
    else raise; end if;
  end;
end $$;

-- T12: a super_admin gets a row for the seeded village.
set local request.jwt.claims = '{"sub":"59999999-9999-9999-9999-999999999999","role":"authenticated"}';
do $$
declare n int;
begin
  select count(*) into n from get_admin_village_stats() where id = 'scvtest';
  if n <> 1 then raise exception 'FAIL T12: admin village stats missing scvtest (got %)', n; end if;
  raise notice 'PASS T12: admin village stats returns seeded village';
end $$;

-- T13: a non-admin cannot read live dashboard stats.
set local request.jwt.claims = '{"sub":"c1111111-1111-1111-1111-111111111111","role":"authenticated"}';
do $$
begin
  begin
    perform get_admin_dashboard_live();
    raise exception 'FAIL T13: non-admin read dashboard stats';
  exception when others then
    if position('admin required' in sqlerrm) > 0 then raise notice 'PASS T13: dashboard stats denied to non-admin';
    else raise; end if;
  end;
end $$;

-- T14: a super_admin gets a populated aggregate object.
set local request.jwt.claims = '{"sub":"59999999-9999-9999-9999-999999999999","role":"authenticated"}';
do $$
declare v jsonb;
begin
  v := get_admin_dashboard_live();
  if v->>'totalOrders' is null then raise exception 'FAIL T14: dashboard stats missing totalOrders'; end if;
  if v->>'totalRiders' is null then raise exception 'FAIL T14: dashboard stats missing totalRiders'; end if;
  raise notice 'PASS T14: admin dashboard live aggregates returned';
end $$;

-- ═══════════════════════════════════════════════════════════════
-- REVENUE ANALYTICS (migration 047)
-- ═══════════════════════════════════════════════════════════════

-- T15: a non-admin cannot read revenue analytics.
set local request.jwt.claims = '{"sub":"c1111111-1111-1111-1111-111111111111","role":"authenticated"}';
do $$
begin
  begin
    perform get_revenue_analytics(30);
    raise exception 'FAIL T15: non-admin read revenue analytics';
  exception when others then
    if position('admin required' in sqlerrm) > 0 then raise notice 'PASS T15: revenue analytics denied to non-admin';
    else raise; end if;
  end;
end $$;

-- T16: a super_admin gets a well-formed aggregate object.
set local request.jwt.claims = '{"sub":"59999999-9999-9999-9999-999999999999","role":"authenticated"}';
do $$
declare v jsonb;
begin
  v := get_revenue_analytics(30);
  if jsonb_typeof(v->'daily')       <> 'array' then raise exception 'FAIL T16: daily not an array'; end if;
  if jsonb_typeof(v->'payment_mix') <> 'array' then raise exception 'FAIL T16: payment_mix not an array'; end if;
  if jsonb_typeof(v->'top_vendors') <> 'array' then raise exception 'FAIL T16: top_vendors not an array'; end if;
  if jsonb_typeof(v->'villages')    <> 'array' then raise exception 'FAIL T16: villages not an array'; end if;
  if v->>'total_revenue' is null then raise exception 'FAIL T16: total_revenue missing'; end if;
  if v->>'total_orders'  is null then raise exception 'FAIL T16: total_orders missing'; end if;
  raise notice 'PASS T16: revenue analytics aggregate returned (daily/mix/vendors/villages)';
end $$;

-- T17: a non-admin cannot read hourly order distribution.
set local request.jwt.claims = '{"sub":"c1111111-1111-1111-1111-111111111111","role":"authenticated"}';
do $$
begin
  begin
    perform get_today_hourly_orders();
    raise exception 'FAIL T17: non-admin read hourly orders';
  exception when others then
    if position('admin required' in sqlerrm) > 0 then raise notice 'PASS T17: hourly orders denied to non-admin';
    else raise; end if;
  end;
end $$;

-- T18: a super_admin gets a json array back.
set local request.jwt.claims = '{"sub":"59999999-9999-9999-9999-999999999999","role":"authenticated"}';
do $$
declare v jsonb;
begin
  v := get_today_hourly_orders();
  if jsonb_typeof(v) <> 'array' then raise exception 'FAIL T18: hourly orders not an array'; end if;
  raise notice 'PASS T18: hourly order distribution returned';
end $$;

reset role;

do $$
begin
  raise notice '═══════════════════════════════════════════';
  raise notice '  ✅ ALL SEVA-JOB, CREDIT & VILLAGE-STATS TESTS PASSED';
  raise notice '═══════════════════════════════════════════';
end $$;

rollback;
