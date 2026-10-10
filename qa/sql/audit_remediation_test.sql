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
--   H1-H4 NULL-safe admin guards + service-only outbox claim
--   G1-G7 anon cannot execute user/backend RPCs or read admin views; allow-list + RLS helpers intact
--   F1-F4 outbox retention prunes only old published rows (service-only)
--   E1-E2 fcm_token is single-owner and clearable
--   D1-D9 kyc_records (incl. anchor queue RPC + cross-village isolation): no self-approval, same-village anchor can review,
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
declare v_village text; v_village2 text;
begin
  select id into v_village from villages limit 1;
  if v_village is null then raise exception 'FAIL D0: no village seeded (migration 040)'; end if;
  update profiles set role='customer', village_id=v_village where id='a1111111-1111-1111-1111-111111111111';
  update profiles set role='anchor',   village_id=v_village, name='AuditAnchor' where id='a2222222-2222-2222-2222-222222222222';

  -- an anchor of a DIFFERENT village (only when the seed has a second village)
  select id into v_village2 from villages where id <> v_village limit 1;
  if v_village2 is not null then
    insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at, email_confirmed_at)
    values ('00000000-0000-0000-0000-000000000000','a3333333-3333-3333-3333-333333333333','authenticated','authenticated','audit_anchor2@test.local','{}','{}', now(), now(), now());
    update profiles set role='anchor', village_id=v_village2, name='OtherAnchor' where id='a3333333-3333-3333-3333-333333333333';
  end if;
end $$;

-- Production has Supabase's project default privileges (ALL on public tables for `authenticated`);
-- a bare CI stack grants SELECT only (see migration 039). Mirror production inside this rolled-back
-- transaction so the RLS policies — not the table-privilege layer — are what is under test.
grant insert, update on kyc_records to authenticated;

set local role authenticated;
set local request.jwt.claims = '{"sub":"a1111111-1111-1111-1111-111111111111","role":"authenticated"}';

do $$
begin
  begin
    insert into kyc_records (user_id, type, status, verified_at)
    values ('a1111111-1111-1111-1111-111111111111', 'aadhaar', 'verified', now());
    raise exception 'FAIL D1: user inserted a pre-verified KYC record';
  exception when insufficient_privilege then
    if sqlerrm not ilike '%row-level security%' then
      raise exception 'FAIL D1: denied for the wrong reason (privilege layer, not RLS): %', sqlerrm;
    end if;
    raise notice 'PASS D1: self-insert of status=verified denied by RLS';
  end;

  insert into kyc_records (user_id, type, status, doc_url)
  values ('a1111111-1111-1111-1111-111111111111', 'aadhaar', 'submitted', 'kyc/a1/doc');
  raise notice 'PASS D2: user can submit own document';

  begin
    update kyc_records set status='verified', verified_at=now()
     where user_id='a1111111-1111-1111-1111-111111111111' and type='aadhaar';
    raise exception 'FAIL D3: user self-approved their KYC record';
  exception when insufficient_privilege then
    if sqlerrm not ilike '%row-level security%' then
      raise exception 'FAIL D3: denied for the wrong reason (privilege layer, not RLS): %', sqlerrm;
    end if;
    raise notice 'PASS D3: self-approval denied by RLS';
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

  select count(*) into n from get_village_kyc_queue()
   where user_id = 'a1111111-1111-1111-1111-111111111111' and user_name is not null;
  if n <> 1 then raise exception 'FAIL D7: anchor KYC queue does not list the village record (%)', n; end if;
  raise notice 'PASS D7: anchor KYC queue lists same-village records via RPC';

  -- anchor may not approve their own record
  insert into kyc_records (user_id, type, status) values ('a2222222-2222-2222-2222-222222222222','pan','submitted');
  begin
    update kyc_records set status='verified', verified_at=now()
     where user_id='a2222222-2222-2222-2222-222222222222' and type='pan';
    raise exception 'FAIL D6: anchor approved their own KYC';
  exception when insufficient_privilege then
    if sqlerrm not ilike '%row-level security%' then
      raise exception 'FAIL D6: denied for the wrong reason (privilege layer, not RLS): %', sqlerrm;
    end if;
    raise notice 'PASS D6: anchor cannot self-approve (RLS)';
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
-- A customer gets an empty anchor queue.
do $$
declare n int;
begin
  select count(*) into n from get_village_kyc_queue();
  if n <> 0 then raise exception 'FAIL D8: non-anchor received % KYC queue rows', n; end if;
  raise notice 'PASS D8: non-anchors get an empty KYC queue';
end $$;

-- An anchor of another village can neither see nor review the record.
set local request.jwt.claims = '{"sub":"a3333333-3333-3333-3333-333333333333","role":"authenticated"}';
do $$
declare n int;
begin
  if not exists (select 1 from profiles where id = 'a3333333-3333-3333-3333-333333333333') then
    raise notice 'SKIP D9: seed has only one village';
    return;
  end if;
  select count(*) into n from kyc_records where user_id = 'a1111111-1111-1111-1111-111111111111';
  if n <> 0 then raise exception 'FAIL D9: other-village anchor can read % KYC rows', n; end if;
  update kyc_records set status = 'rejected' where user_id = 'a1111111-1111-1111-1111-111111111111';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL D9: other-village anchor modified % KYC rows', n; end if;
  raise notice 'PASS D9: other-village anchor has no read or review access';
end $$;
reset role;

-- ── E : FCM token single-owner (migration 105) ──────────────────
do $$
declare
  v_device text := 'audit-device-1';
  v_a1 constant uuid := 'a1111111-1111-1111-1111-111111111111';
  v_a2 constant uuid := 'a2222222-2222-2222-2222-222222222222';
  t1 text; t2 text;
begin
  update profiles set fcm_token = v_device where id = v_a1;
  update profiles set fcm_token = v_device where id = v_a2;   -- same device, new user
  select fcm_token into t1 from profiles where id = v_a1;
  select fcm_token into t2 from profiles where id = v_a2;
  if t1 is not null then raise exception 'FAIL E1: previous owner still holds the device token (%)', t1; end if;
  if t2 is distinct from v_device then raise exception 'FAIL E1: new owner lost the token (%)', t2; end if;
  raise notice 'PASS E1: device token moved to the newest owner only';

  update profiles set fcm_token = null where id = v_a2;
  select fcm_token into t2 from profiles where id = v_a2;
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

-- ── G : unauthenticated lockdown (migration 108) ────────────────
do $$
declare
  fn text; n int;
begin
  -- G1/G2: RPCs that treat `auth.uid() is null` as "trusted backend" are not callable by anon,
  -- yet logged-in users and the service role keep EXECUTE.
  foreach fn in array array[
    'public.pay_from_wallet(uuid,numeric,uuid)',
    'public.update_order_status(uuid,text,uuid,jsonb)',
    'public.cancel_order_with_refund(uuid,uuid,text,text)',
    'public.set_default_address(uuid,uuid)',
    'public.pay_order_from_wallet(uuid)',
    'public.create_order(uuid,jsonb,text,text,text,text,boolean,text,text,uuid)'
  ] loop
    if has_function_privilege('anon', fn, 'execute') then
      raise exception 'FAIL G1: anon can still execute %', fn;
    end if;
    if not has_function_privilege('authenticated', fn, 'execute') then
      raise exception 'FAIL G2: authenticated lost EXECUTE on %', fn;
    end if;
    if not has_function_privilege('service_role', fn, 'execute') then
      raise exception 'FAIL G2: service_role lost EXECUTE on %', fn;
    end if;
  end loop;
  raise notice 'PASS G1/G2: anon cannot execute user/backend RPCs; authenticated + service_role unchanged';

  -- G3: pre-login functions and the RLS helpers stay callable by anon (policies evaluate them).
  foreach fn in array array[
    'public.get_public_settings()', 'public.my_feature_flags()', 'public.is_admin()',
    'public.get_my_role()', 'public.get_my_village_id()', 'public.has_permission(text)',
    'public.get_fee_config()'
  ] loop
    if not has_function_privilege('anon', fn, 'execute') then
      raise exception 'FAIL G3: allow-listed % is no longer anon-executable (RLS/pre-login would break)', fn;
    end if;
  end loop;
  raise notice 'PASS G3: allow-listed pre-login / RLS-helper functions remain anon-executable';

  -- G4: the lockdown did not re-open functions that were service-only before it.
  select count(*) into n from pg_proc
   where pronamespace = 'public'::regnamespace
     and proname in ('topup_wallet', 'credit_wallet', 'apply_wallet_topup_payment',
                     'apply_credit_repayment_payment', 'check_rate_limit', 'process_dispatch_timeouts')
     and has_function_privilege('authenticated', oid, 'execute');
  if n <> 0 then raise exception 'FAIL G4: % service-only function(s) are executable by authenticated', n; end if;
  raise notice 'PASS G4: service-only functions stay closed to authenticated';

  -- G5: analytics / reconciliation relations are service-role only; category_previews stays public.
  foreach fn in array array[
    'public.analytics_daily_order_metrics', 'public.analytics_daily_payment_metrics',
    'public.analytics_daily_delivery_metrics', 'public.analytics_daily_financial_metrics',
    'public.reconciliation_dashboard', 'public.admin_dashboard_stats'
  ] loop
    if to_regclass(fn) is null then continue; end if;
    if has_table_privilege('anon', fn, 'select') or has_table_privilege('authenticated', fn, 'select') then
      raise exception 'FAIL G5: % is readable by anon/authenticated', fn;
    end if;
    if not has_table_privilege('service_role', fn, 'select') then
      raise exception 'FAIL G5: service_role cannot read %', fn;
    end if;
  end loop;
  if not has_table_privilege('anon', 'public.category_previews', 'select') then
    raise exception 'FAIL G5: category_previews (public catalog) is no longer readable';
  end if;
  raise notice 'PASS G5: admin analytics views closed; public catalog view still readable';
end $$;

-- G6: the actual exploit — an unauthenticated caller can no longer drain a wallet.
set local role anon;
do $$
begin
  begin
    perform pay_from_wallet(gen_random_uuid(), 1, null);
    raise exception 'FAIL G6: anon executed pay_from_wallet';
  exception when insufficient_privilege then
    raise notice 'PASS G6: anon is refused at the privilege layer (permission denied)';
  end;
  begin
    perform update_order_status(gen_random_uuid(), 'cancelled', null, '{}'::jsonb);
    raise exception 'FAIL G6: anon executed update_order_status';
  exception when insufficient_privilege then
    raise notice 'PASS G6: anon cannot drive order status';
  end;
end $$;
reset role;

-- G7: a logged-in user still cannot debit someone else's wallet (the identity guard holds).
set local role authenticated;
set local request.jwt.claims = '{"sub":"a1111111-1111-1111-1111-111111111111","role":"authenticated"}';
do $$
begin
  begin
    perform pay_from_wallet('a2222222-2222-2222-2222-222222222222', 1, null);
    raise exception 'FAIL G7: authenticated user debited another user''s wallet';
  exception when raise_exception then
    if sqlerrm not ilike '%cannot debit another user%' then raise; end if;
    raise notice 'PASS G7: cross-user wallet debit refused for authenticated callers';
  end;
end $$;
reset role;

-- ── H : NULL-safe admin guards (migration 109) ──────────────────
-- An authenticated identity with NO profile row (get_my_role() is NULL) must be refused by the
-- `if not is_admin()` / `if not (has_permission(..) or is_admin())` guards, not waved through by IF NULL.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a9999999-9999-9999-9999-999999999999","role":"authenticated"}', true);
do $$
begin
  if public.is_admin() is distinct from false then
    raise exception 'FAIL H1: is_admin() returned % for a profile-less identity (must be false, never NULL)', public.is_admin();
  end if;
  raise notice 'PASS H1: is_admin() is false (not NULL) when the caller has no profile';

  begin
    perform public.get_finance_overview();
    raise exception 'FAIL H2: profile-less identity read the finance overview';
  exception when raise_exception then
    if sqlerrm not ilike '%unauthorized%' then raise; end if;
    raise notice 'PASS H2: get_finance_overview refuses a profile-less identity';
  end;

  begin
    perform public.get_village_dashboard_stats('x');
    raise exception 'FAIL H3: profile-less identity read village stats';
  exception when raise_exception then
    if sqlerrm not ilike '%unauthorized%' then raise; end if;
    raise notice 'PASS H3: get_village_dashboard_stats refuses a profile-less identity';
  end;
end $$;
reset role;

do $$
begin
  if has_function_privilege('authenticated', 'public.setu_claim_outbox_batch(integer,text,integer,integer)', 'execute')
     or has_function_privilege('anon', 'public.setu_claim_outbox_batch(integer,text,integer,integer)', 'execute') then
    raise exception 'FAIL H4: setu_claim_outbox_batch is executable by a non-service role';
  end if;
  if not has_function_privilege('service_role', 'public.setu_claim_outbox_batch(integer,text,integer,integer)', 'execute') then
    raise exception 'FAIL H4: the outbox worker (service_role) lost EXECUTE';
  end if;
  raise notice 'PASS H4: outbox claim is service-role only';
end $$;

do $$ begin raise notice 'ALL AUDIT-REMEDIATION TESTS PASSED'; end $$;

rollback;
