-- ═══════════════════════════════════════════════════════════════
-- SETU — Audit Remediation Proof Script (migration 103)
--
-- HOW TO RUN (against a local Supabase):
--   supabase start
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
--        -v ON_ERROR_STOP=1 -f qa/sql/audit_remediation_test.sql
--
-- One transaction, ENDS WITH ROLLBACK (non-destructive).
--
-- Covers:
--   A1  credit_transactions.reference exists (finalizer dependency)
--   A2  finalize_order_financial_capture no longer reads ct.reference
--   B1  apply_wallet_topup_payment credits exactly once (replay-safe)
--   B2  apply_wallet_topup_payment rejects an amount mismatch
--   B3  apply_wallet_topup_payment rejects a credit_repayment order
--   B4  apply_credit_repayment_payment reduces outstanding exactly once,
--       surplus goes to the wallet, replay is a no-op
--   C1  service-only RPCs are NOT executable by anon / authenticated
--       (PUBLIC revoked), but ARE executable by service_role
--   F1-F4 outbox retention prunes only old published rows (service-only)
--   E1-E2 fcm_token is single-owner and clearable
--   D1-D6 kyc_records: no self-approval, same-village anchor can review,
--       nobody approves their own record, verified rows immutable to owner
-- ═══════════════════════════════════════════════════════════════

begin;

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at, email_confirmed_at)
values
  ('00000000-0000-0000-0000-000000000000','a1111111-1111-1111-1111-111111111111','authenticated','authenticated','audit1@test.local','{}','{}', now(), now(), now());

update profiles set role='customer', name='Audit1' where id='a1111111-1111-1111-1111-111111111111';

-- ── A1 ───────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema='public' and table_name='credit_transactions' and column_name='reference') then
    raise exception 'FAIL A1: credit_transactions.reference missing';
  end if;
  raise notice 'PASS A1: credit_transactions.reference exists';
end $$;

-- ── A2 ───────────────────────────────────────────────────────────
do $$
declare v_def text;
begin
  select pg_get_functiondef('public.finalize_order_financial_capture(uuid,text,numeric)'::regprocedure) into v_def;
  if v_def ilike '%ct.reference%' then
    raise exception 'FAIL A2: finalizer still reads ct.reference';
  end if;
  if v_def not ilike '%Order discount%' then
    raise exception 'FAIL A2: finalizer does not match disbursements on purpose';
  end if;
  raise notice 'PASS A2: finalizer matches credit disbursements via purpose';
end $$;

-- ── B1 / B2 / B3 : wallet top-up ─────────────────────────────────
insert into payment_orders (razorpay_order_id, user_id, amount, status, notes) values
  ('order_audit_topup', 'a1111111-1111-1111-1111-111111111111', 100, 'created', '{"type":"wallet_topup"}'),
  ('order_audit_credit', 'a1111111-1111-1111-1111-111111111111', 500, 'created', '{"type":"credit_repayment"}');

do $$
declare v jsonb; bal numeric; n int;
begin
  v := apply_wallet_topup_payment('order_audit_topup', 'pay_audit_1', 100);
  if not (v->>'success')::boolean then raise exception 'FAIL B1: first apply failed: %', v; end if;
  v := apply_wallet_topup_payment('order_audit_topup', 'pay_audit_1', 100);   -- webhook retry
  if not coalesce((v->>'already_applied')::boolean, false) then raise exception 'FAIL B1: replay not detected: %', v; end if;
  select balance into bal from wallets where user_id='a1111111-1111-1111-1111-111111111111';
  if bal <> 100 then raise exception 'FAIL B1: wallet credited % (expected exactly 100)', bal; end if;
  select count(*) into n from wallet_transactions where user_id='a1111111-1111-1111-1111-111111111111' and reference='pay_audit_1';
  if n <> 1 then raise exception 'FAIL B1: % wallet_transactions rows for the payment (expected 1)', n; end if;
  raise notice 'PASS B1: wallet top-up applied exactly once across a replay';

  v := apply_wallet_topup_payment('order_audit_topup', 'pay_audit_x', 999);
  -- already completed order: amount check happens first, so a forged amount is refused outright
  if (v->>'success')::boolean then raise exception 'FAIL B2: amount mismatch accepted: %', v; end if;
  if v->>'error' <> 'amount_mismatch' then raise exception 'FAIL B2: wrong error: %', v; end if;
  raise notice 'PASS B2: amount mismatch rejected';

  v := apply_wallet_topup_payment('order_audit_credit', 'pay_audit_y', 500);
  if (v->>'success')::boolean then raise exception 'FAIL B3: credit_repayment order accepted as wallet top-up: %', v; end if;
  if v->>'error' <> 'payment_order_type_mismatch' then raise exception 'FAIL B3: wrong error: %', v; end if;
  raise notice 'PASS B3: payment type cross-check enforced';
end $$;

-- ── B4 : credit repayment ────────────────────────────────────────
insert into credit_accounts (user_id, credit_limit, outstanding)
values ('a1111111-1111-1111-1111-111111111111', 1000, 300);

do $$
declare v jsonb; o numeric; bal numeric; n int;
begin
  v := apply_credit_repayment_payment('order_audit_credit', 'pay_audit_2', 500);
  if not (v->>'success')::boolean then raise exception 'FAIL B4: apply failed: %', v; end if;
  v := apply_credit_repayment_payment('order_audit_credit', 'pay_audit_2', 500);   -- retry
  if not coalesce((v->>'already_applied')::boolean, false) then raise exception 'FAIL B4: replay not detected: %', v; end if;

  select outstanding into o from credit_accounts where user_id='a1111111-1111-1111-1111-111111111111';
  if o <> 0 then raise exception 'FAIL B4: outstanding % (expected 0)', o; end if;

  select balance into bal from wallets where user_id='a1111111-1111-1111-1111-111111111111';
  if bal <> 300 then raise exception 'FAIL B4: wallet % (expected 100 top-up + 200 surplus = 300)', bal; end if;

  select count(*) into n from credit_transactions
   where user_id='a1111111-1111-1111-1111-111111111111' and type='repayment' and reference='pay_audit_2';
  if n <> 1 then raise exception 'FAIL B4: % repayment rows (expected 1)', n; end if;
  raise notice 'PASS B4: repayment applied exactly once; surplus 200 credited to wallet';
end $$;

-- ── C1 : grants ──────────────────────────────────────────────────
do $$
declare
  fn text;
  fns text[] := array[
    'public.apply_wallet_topup_payment(text,text,numeric)',
    'public.apply_credit_repayment_payment(text,text,numeric)',
    'public.process_dispatch_timeouts(integer)',
    'public.dispatch_ready_order(uuid)',
    'public.check_rate_limit(text,integer,integer)',
    'public.prune_rate_limit_hits()',
    'public.refresh_admin_dashboard_stats()',
    'public.get_live_admin_analytics()'
  ];
begin
  foreach fn in array fns loop
    if has_function_privilege('anon', fn, 'execute') then
      raise exception 'FAIL C1: anon can execute %', fn;
    end if;
    if has_function_privilege('authenticated', fn, 'execute') then
      raise exception 'FAIL C1: authenticated can execute %', fn;
    end if;
    if not has_function_privilege('service_role', fn, 'execute') then
      raise exception 'FAIL C1: service_role cannot execute %', fn;
    end if;
  end loop;
  raise notice 'PASS C1: service-only RPCs are not executable by anon/authenticated';
end $$;

-- ── D : kyc_records authorization (migration 104) ───────────────
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at, email_confirmed_at)
values
  ('00000000-0000-0000-0000-000000000000','a2222222-2222-2222-2222-222222222222','authenticated','authenticated','audit_anchor@test.local','{}','{}', now(), now(), now());

do $$
declare v_village text;
begin
  select id into v_village from villages limit 1;
  if v_village is null then raise exception 'FAIL D0: no village seeded (migration 040)'; end if;
  update profiles set role='customer', village_id=v_village where id='a1111111-1111-1111-1111-111111111111';
  update profiles set role='anchor',   village_id=v_village, name='AuditAnchor' where id='a2222222-2222-2222-2222-222222222222';
end $$;

set local role authenticated;
set local request.jwt.claims = '{"sub":"a1111111-1111-1111-1111-111111111111","role":"authenticated"}';

do $$
begin
  begin
    insert into kyc_records (user_id, type, status, verified_at)
    values ('a1111111-1111-1111-1111-111111111111', 'aadhaar', 'verified', now());
    raise exception 'FAIL D1: user inserted a pre-verified KYC record';
  exception when insufficient_privilege then
    raise notice 'PASS D1: self-insert of status=verified denied';
  end;

  insert into kyc_records (user_id, type, status, doc_url)
  values ('a1111111-1111-1111-1111-111111111111', 'aadhaar', 'submitted', 'kyc/a1/doc');
  raise notice 'PASS D2: user can submit own document';

  begin
    update kyc_records set status='verified', verified_at=now()
     where user_id='a1111111-1111-1111-1111-111111111111' and type='aadhaar';
    raise exception 'FAIL D3: user self-approved their KYC record';
  exception when insufficient_privilege then
    raise notice 'PASS D3: self-approval denied';
  end;
end $$;

-- Anchor of the same village reviews the customer's record.
set local request.jwt.claims = '{"sub":"a2222222-2222-2222-2222-222222222222","role":"authenticated"}';
do $$
declare n int; st text;
begin
  update kyc_records set status='verified', verified_at=now()
   where user_id='a1111111-1111-1111-1111-111111111111' and type='aadhaar';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL D4: same-village anchor could not review (rows=%)', n; end if;
  raise notice 'PASS D4: same-village anchor can approve';

  -- anchor may not approve their own record
  insert into kyc_records (user_id, type, status) values ('a2222222-2222-2222-2222-222222222222','pan','submitted');
  begin
    update kyc_records set status='verified', verified_at=now()
     where user_id='a2222222-2222-2222-2222-222222222222' and type='pan';
    raise exception 'FAIL D6: anchor approved their own KYC';
  exception when insufficient_privilege then
    raise notice 'PASS D6: anchor cannot self-approve';
  end;
end $$;

-- Owner can no longer tamper with a verified record.
set local request.jwt.claims = '{"sub":"a1111111-1111-1111-1111-111111111111","role":"authenticated"}';
do $$
declare n int;
begin
  update kyc_records set doc_url='kyc/a1/swapped'
   where user_id='a1111111-1111-1111-1111-111111111111' and type='aadhaar';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL D5: owner modified a verified record (rows=%)', n; end if;
  raise notice 'PASS D5: verified record immutable to owner';
end $$;
reset role;

-- ── E : FCM token single-owner (migration 105) ──────────────────
do $$
declare t1 text; t2 text;
begin
  update profiles set fcm_token = 'tok_audit_device'  where id = 'a1111111-1111-1111-1111-111111111111';
  update profiles set fcm_token = 'tok_audit_device'  where id = 'a2222222-2222-2222-2222-222222222222';  -- same device, new user
  select fcm_token into t1 from profiles where id = 'a1111111-1111-1111-1111-111111111111';
  select fcm_token into t2 from profiles where id = 'a2222222-2222-2222-2222-222222222222';
  if t1 is not null then raise exception 'FAIL E1: previous owner still holds the device token (%)', t1; end if;
  if t2 is distinct from 'tok_audit_device' then raise exception 'FAIL E1: new owner lost the token (%)', t2; end if;
  raise notice 'PASS E1: device token moved to the newest owner only';

  update profiles set fcm_token = null where id = 'a2222222-2222-2222-2222-222222222222';
  select fcm_token into t2 from profiles where id = 'a2222222-2222-2222-2222-222222222222';
  if t2 is not null then raise exception 'FAIL E2: token could not be cleared'; end if;
  raise notice 'PASS E2: token can be cleared (sign-out)';
end $$;

-- ── F : outbox retention (migration 106) ────────────────────────
insert into setu_event_outbox (event_type, aggregate_type, aggregate_id, payload, published_at, created_at) values
  ('audit.test', 'audit', 'audit_old_published',    '{}', now() - interval '10 days', now() - interval '10 days'),
  ('audit.test', 'audit', 'audit_recent_published', '{}', now() - interval '1 hour',  now() - interval '1 hour'),
  ('audit.test', 'audit', 'audit_old_unpublished',  '{}', null,                       now() - interval '40 days');

do $$
declare n int;
begin
  perform prune_setu_event_outbox();
  select count(*) into n from setu_event_outbox where aggregate_id = 'audit_old_published';
  if n <> 0 then raise exception 'FAIL F1: old published row not pruned'; end if;
  select count(*) into n from setu_event_outbox where aggregate_id = 'audit_recent_published';
  if n <> 1 then raise exception 'FAIL F2: recent published row was pruned'; end if;
  select count(*) into n from setu_event_outbox where aggregate_id = 'audit_old_unpublished';
  if n <> 1 then raise exception 'FAIL F3: unpublished row was pruned (event loss)'; end if;
  if has_function_privilege('anon', 'public.prune_setu_event_outbox(interval,integer)', 'execute')
     or has_function_privilege('authenticated', 'public.prune_setu_event_outbox(interval,integer)', 'execute') then
    raise exception 'FAIL F4: prune is executable by anon/authenticated';
  end if;
  raise notice 'PASS F1-F4: outbox prune removes only old published rows and is service-only';
end $$;

do $$ begin raise notice 'ALL AUDIT-REMEDIATION TESTS PASSED'; end $$;

rollback;
