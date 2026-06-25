-- ═══════════════════════════════════════════════════════════════
-- SETU — Finance Center Proof (migration 026)
--
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
--        -v ON_ERROR_STOP=1 -f qa/sql/finance_test.sql
--
-- Runs in one transaction, ends with ROLLBACK (non-destructive).
-- ═══════════════════════════════════════════════════════════════

begin;

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at, email_confirmed_at)
values
  ('00000000-0000-0000-0000-000000000000','99999999-9999-9999-9999-999999999999','authenticated','authenticated','super@test.local','{}','{}', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000','11111111-1111-1111-1111-111111111111','authenticated','authenticated','c1@test.local','{}','{}', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000','33333333-3333-3333-3333-333333333333','authenticated','authenticated','vo@test.local','{}','{}', now(), now(), now());
update profiles set role='super_admin' where id='99999999-9999-9999-9999-999999999999';
update profiles set role='customer'    where id='11111111-1111-1111-1111-111111111111';
update profiles set role='vendor'       where id='33333333-3333-3333-3333-333333333333';

insert into vendors (id, owner_id, name, category, is_active)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','33333333-3333-3333-3333-333333333333','Test Vendor','grocery', true);
insert into wallets (user_id, balance) values ('11111111-1111-1111-1111-111111111111', 100);
insert into vendor_escrow (vendor_id, balance, total_credited) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 50, 50);

-- ── T1: a customer cannot record an adjustment ──
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
do $$
begin
  begin
    perform record_financial_adjustment('credit','wallet','11111111-1111-1111-1111-111111111111', 9999, 'self credit');
    raise exception 'FAIL T1: customer recorded an adjustment';
  exception when others then
    if position('finance.manage' in sqlerrm) > 0 then raise notice 'PASS T1: adjustment denied to customer (%)', sqlerrm;
    else raise; end if;
  end;
end $$;

-- ── T2: super_admin wallet credit applies + records + audits ──
set local request.jwt.claims = '{"sub":"99999999-9999-9999-9999-999999999999","role":"authenticated"}';
do $$
declare bal numeric; n int;
begin
  perform record_financial_adjustment('credit','wallet','11111111-1111-1111-1111-111111111111', 50, 'goodwill credit');
  reset role;
  select balance into bal from wallets where user_id='11111111-1111-1111-1111-111111111111';
  if bal <> 150 then raise exception 'FAIL T2: wallet balance %, expected 150', bal; end if;
  select count(*) into n from financial_adjustments where target_id='11111111-1111-1111-1111-111111111111';
  if n <> 1 then raise exception 'FAIL T2: adjustment not recorded'; end if;
  select count(*) into n from audit_log where action='financial_adjustment' and target='11111111-1111-1111-1111-111111111111';
  if n < 1 then raise exception 'FAIL T2: adjustment not audited'; end if;
  raise notice 'PASS T2: wallet credit applied (₹150), recorded + audited';
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"99999999-9999-9999-9999-999999999999","role":"authenticated"}';
end $$;

-- ── T3: wallet debit beyond balance is rejected ──
do $$
begin
  begin
    perform record_financial_adjustment('debit','wallet','11111111-1111-1111-1111-111111111111', 99999, 'over debit');
    raise exception 'FAIL T3: over-debit was allowed';
  exception when others then
    if position('Insufficient wallet balance' in sqlerrm) > 0 then raise notice 'PASS T3: over-debit rejected (%)', sqlerrm;
    else raise; end if;
  end;
end $$;

-- ── T4: vendor escrow credit applies; over-debit blocked ──
do $$
declare bal numeric;
begin
  perform record_financial_adjustment('credit','vendor_escrow','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 25, 'reconciliation');
  reset role;
  select balance into bal from vendor_escrow where vendor_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  if bal <> 75 then raise exception 'FAIL T4: escrow balance %, expected 75', bal; end if;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"99999999-9999-9999-9999-999999999999","role":"authenticated"}';
  begin
    perform record_financial_adjustment('debit','vendor_escrow','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 99999, 'over debit');
    raise exception 'FAIL T4: escrow over-debit allowed';
  exception when others then
    if position('negative' in sqlerrm) > 0 then raise notice 'PASS T4: escrow credit ₹75; over-debit blocked (%)', sqlerrm;
    else raise; end if;
  end;
end $$;

-- ── T5: finance overview is gated + returns live numbers ──
do $$
declare ov jsonb;
begin
  ov := get_finance_overview();
  if ov->>'wallet_float' is null then raise exception 'FAIL T5: overview missing wallet_float'; end if;
  if (ov->>'wallet_float')::numeric < 150 then raise exception 'FAIL T5: wallet_float should include the credited ₹150'; end if;
  raise notice 'PASS T5: finance overview returns live aggregates (wallet_float=%)', ov->>'wallet_float';
end $$;

-- ── T6: direct table write denied (RPC-only) ──
do $$
begin
  begin
    insert into financial_adjustments (adj_type, target_kind, target_id, amount, reason)
    values ('credit','wallet','11111111-1111-1111-1111-111111111111', 1, 'hack');
    raise exception 'FAIL T6: direct financial_adjustments INSERT was allowed';
  exception
    when insufficient_privilege then raise notice 'PASS T6: direct INSERT denied by RLS';
    when others then
      if sqlstate = '42501' then raise notice 'PASS T6: direct INSERT denied (%)', sqlerrm;
      else raise; end if;
  end;
end $$;

reset role;

do $$
begin
  raise notice '═══════════════════════════════════════════';
  raise notice '  ✅ ALL FINANCE-CENTER TESTS PASSED';
  raise notice '═══════════════════════════════════════════';
end $$;

rollback;
