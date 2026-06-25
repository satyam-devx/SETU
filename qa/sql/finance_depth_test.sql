-- ═══════════════════════════════════════════════════════════════
-- SETU — Finance Depth Proof (migration 031)
--
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
--        -v ON_ERROR_STOP=1 -f qa/sql/finance_depth_test.sql
--
-- Runs in one transaction, ends with ROLLBACK (non-destructive).
--   T1 — customer cannot generate an invoice
--   T2 — super_admin generates a GST invoice (rate from config), idempotent
--   T3 — create_settlement drains escrow → creates vendor_payout
--   T4 — chargeback record + resolve; lifecycle + audit
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
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','33333333-3333-3333-3333-333333333333','Vend Store','grocery', true);
insert into products (id, vendor_id, name, price, mrp, unit, stock, is_available, category)
values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','Rice', 100, 120, 'kg', 100, true, 'grocery');

-- Fixed GST rate for deterministic assertions.
update platform_config set value = '5' where key = 'gst_rate_pct';

-- Customer places an order (subtotal 100).
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
do $$
declare v jsonb; v_id uuid;
begin
  v := create_order('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
       '[{"product_id":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","qty":1}]'::jsonb,
       'COD','addr', null, null, false, null);
  if not (v->>'success')::boolean then raise exception 'SETUP: order failed: %', v::text; end if;
end $$;
reset role;

-- Give the vendor escrow to settle.
insert into vendor_escrow (vendor_id, balance, total_credited)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 500, 500)
on conflict (vendor_id) do update set balance = 500, total_credited = 500;

-- ── T1: customer cannot generate an invoice ──
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
do $$
declare v_oid uuid;
begin
  select id into v_oid from orders limit 1;
  begin
    perform generate_invoice(v_oid);
    raise exception 'FAIL T1: customer generated an invoice';
  exception when others then
    if position('finance.manage' in sqlerrm) > 0 then raise notice 'PASS T1: generate_invoice denied to customer';
    else raise; end if;
  end;
end $$;

-- ── T2: super_admin generates GST invoice (idempotent) ──
set local request.jwt.claims = '{"sub":"99999999-9999-9999-9999-999999999999","role":"authenticated"}';
do $$
declare v jsonb; v2 jsonb; v_oid uuid;
begin
  select id into v_oid from orders limit 1;
  v := generate_invoice(v_oid);
  if not (v->>'success')::boolean then raise exception 'FAIL T2: invoice failed: %', v::text; end if;
  -- subtotal 100 @ 5%% inclusive → gst = 100 - round(100/1.05,2) = 100 - 95.24 = 4.76
  if (v->>'gst_amount')::numeric <> 4.76 then raise exception 'FAIL T2: GST expected 4.76, got %', v->>'gst_amount'; end if;

  v2 := generate_invoice(v_oid);
  if not (v2->>'already_exists')::boolean then raise exception 'FAIL T2: invoice not idempotent'; end if;
  raise notice 'PASS T2: GST invoice generated (₹4.76) and idempotent';
end $$;

-- ── T3: settlement drains escrow ──
do $$
declare v jsonb; v_bal numeric; v_payouts int;
begin
  v := create_settlement('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'monthly');
  if not (v->>'success')::boolean then raise exception 'FAIL T3: settlement failed: %', v::text; end if;
  if (v->>'amount')::numeric <> 500 then raise exception 'FAIL T3: settled amount expected 500, got %', v->>'amount'; end if;

  select balance into v_bal from vendor_escrow where vendor_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  if v_bal <> 0 then raise exception 'FAIL T3: escrow not drained (got %)', v_bal; end if;

  select count(*) into v_payouts from vendor_payouts where vendor_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and amount = 500;
  if v_payouts <> 1 then raise exception 'FAIL T3: payout not created'; end if;
  raise notice 'PASS T3: settlement drained escrow → vendor_payout';
end $$;

-- ── T4: chargeback lifecycle ──
do $$
declare v jsonb; v_id uuid; v_status text; v_oid uuid;
begin
  select id into v_oid from orders limit 1;
  v := record_chargeback(v_oid, 100, 'disputed by bank', 'cb_ref_1');
  if not (v->>'success')::boolean then raise exception 'FAIL T4: chargeback record failed'; end if;
  v_id := (v->>'chargeback_id')::uuid;

  v := resolve_chargeback(v_id, 'won');
  if not (v->>'success')::boolean then raise exception 'FAIL T4: resolve failed'; end if;

  select status into v_status from chargebacks where id = v_id;
  if v_status <> 'won' then raise exception 'FAIL T4: status not won (got %)', v_status; end if;
  raise notice 'PASS T4: chargeback recorded + resolved';
end $$;

reset role;

do $$
begin
  raise notice '═══════════════════════════════════════════';
  raise notice '  ✅ ALL FINANCE DEPTH TESTS PASSED';
  raise notice '═══════════════════════════════════════════';
end $$;

rollback;
