-- ═══════════════════════════════════════════════════════════════
-- SETU — Phase 1 Money-Integrity Proof Script
--
-- Proves migration 017 actually closes the audit's three CRITICAL
-- money-trust holes, by attempting the real exploits and asserting
-- they are rejected.
--
-- This is EXECUTABLE evidence — not a unit test that re-implements
-- the logic. It runs the real RPCs / RLS against a real Postgres
-- with Supabase's auth.uid() driven by JWT-claim GUCs, exactly the
-- way the deployed system behaves.
--
-- HOW TO RUN (against a local Supabase):
--   supabase start
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
--        -v ON_ERROR_STOP=1 -f qa/sql/phase1_money_integrity_test.sql
--
-- The whole script runs inside one transaction and ENDS WITH ROLLBACK,
-- so it leaves your database untouched. A failed assertion raises an
-- exception (and ON_ERROR_STOP aborts), so the script is pass/fail:
-- if it prints "ALL PHASE-1 INTEGRITY TESTS PASSED" you're green.
--
-- Covers:
--   A. CRITICAL-A — client cannot create an underpriced order
--                   (direct INSERT denied; create_order recomputes
--                    totals from products.price).
--   B. CRITICAL-B — role-aware update_order_status: outsiders can't
--                   advance an order; a rider can't credit a
--                   different rider's earnings via p_meta.
--   C. CRITICAL-C — "Use SETU Credit" discount is rejected without a
--                   funded, active credit account, and recorded as a
--                   real drawdown when granted.
--   D. #4         — pay_order_from_wallet charges the authoritative
--                   server total and credits vendor escrow atomically.
-- ═══════════════════════════════════════════════════════════════

begin;

-- ── Fixed test UUIDs ────────────────────────────────────────────
-- customers / users
--   C1   11111111…  customer with a wallet
--   COTH 22222222…  unrelated customer (outsider)
--   VOWN 33333333…  vendor owner
--   R1U  44444444…  rider 1 (auth user)
--   R2U  55555555…  rider 2 (auth user)
--   C3   66666666…  customer with sufficient SETU Credit
--   C2CR 77777777…  customer with INSUFFICIENT SETU Credit
-- entities
--   V1   aaaaaaaa…  vendor       P1 bbbbbbbb…  product (₹100, stock 100)
--   R1   cccccccc…  rider 1      R2 dddddddd…  rider 2
--   O1   eeeeeeee…  pre-seeded order (on_the_way, assigned R1) for status tests

-- A temp table to pass order ids created by authenticated calls back
-- to the postgres-role verification blocks.
create temp table _t (k text primary key, v text) on commit drop;
grant all on _t to authenticated;

-- ── Seed as postgres (RLS bypassed) ─────────────────────────────
insert into villages (id, name, block, district, state, is_active)
values ('vtest', 'Test Village', 'TestBlock', 'Madhubani', 'Bihar', true);

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at, email_confirmed_at)
values
  ('00000000-0000-0000-0000-000000000000','11111111-1111-1111-1111-111111111111','authenticated','authenticated','c1@test.local',  '{}','{}', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000','22222222-2222-2222-2222-222222222222','authenticated','authenticated','coth@test.local','{}','{}', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000','33333333-3333-3333-3333-333333333333','authenticated','authenticated','vown@test.local','{}','{}', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000','44444444-4444-4444-4444-444444444444','authenticated','authenticated','r1@test.local',  '{}','{}', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000','55555555-5555-5555-5555-555555555555','authenticated','authenticated','r2@test.local',  '{}','{}', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000','66666666-6666-6666-6666-666666666666','authenticated','authenticated','c3@test.local',  '{}','{}', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000','77777777-7777-7777-7777-777777777777','authenticated','authenticated','c2cr@test.local','{}','{}', now(), now(), now());

-- handle_new_user() auto-created 'customer' profiles; set roles/village.
update profiles set role='customer', village_id='vtest', name='C1'   where id='11111111-1111-1111-1111-111111111111';
update profiles set role='customer', village_id='vtest', name='COTH' where id='22222222-2222-2222-2222-222222222222';
update profiles set role='vendor',   village_id='vtest', name='VOWN' where id='33333333-3333-3333-3333-333333333333';
update profiles set role='rider',     village_id='vtest', name='R1'   where id='44444444-4444-4444-4444-444444444444';
update profiles set role='rider',     village_id='vtest', name='R2'   where id='55555555-5555-5555-5555-555555555555';
update profiles set role='customer', village_id='vtest', name='C3'   where id='66666666-6666-6666-6666-666666666666';
update profiles set role='customer', village_id='vtest', name='C2CR' where id='77777777-7777-7777-7777-777777777777';

insert into vendors (id, owner_id, name, category, village_id, village, is_active, is_open)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','33333333-3333-3333-3333-333333333333',
        'Test Vendor','grocery','vtest','Test Village', true, true);

insert into products (id, vendor_id, name, price, mrp, unit, stock, is_available, category)
values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        'Test Rice', 100, 120, 'kg', 100, true, 'grocery');

insert into riders (id, user_id, name, village_id, village, is_active, is_online, today_earnings, total_earnings, cod_balance)
values
  ('cccccccc-cccc-cccc-cccc-cccccccccccc','44444444-4444-4444-4444-444444444444','Rider One','vtest','Test Village', true, true, 0, 0, 0),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd','55555555-5555-5555-5555-555555555555','Rider Two','vtest','Test Village', true, true, 0, 0, 0);

insert into wallets (user_id, balance)
values ('11111111-1111-1111-1111-111111111111', 1000);

insert into credit_accounts (user_id, credit_limit, outstanding, status, score)
values
  ('66666666-6666-6666-6666-666666666666', 1000, 0, 'active', 700),   -- C3: plenty
  ('77777777-7777-7777-7777-777777777777',   10, 0, 'active', 600);   -- C2CR: too little

-- Pre-seeded order for status tests: on_the_way, assigned to R1, COD, ₹500.
insert into orders (
  id, order_number, customer_id, customer_name, vendor_id, vendor_name,
  rider_id, rider_name, village_id, village, status, payment_method,
  payment_status, subtotal, delivery_fee, platform_fee, total, is_cod
) values (
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee','SETU-TEST01',
  '11111111-1111-1111-1111-111111111111','C1',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','Test Vendor',
  'cccccccc-cccc-cccc-cccc-cccccccccccc','Rider One',
  'vtest','Test Village','on_the_way','COD','collected',
  500, 0, 0, 500, true
);

-- Helper to act as a given user (sets role + JWT claims for auth.uid()).
-- Called as plain SQL between blocks below.

-- ═══════════════════════════════════════════════════════════════
-- TEST A — CRITICAL-A: client cannot create an underpriced order
-- ═══════════════════════════════════════════════════════════════
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

do $$
declare v jsonb;
begin
  -- A1: the old exploit — a direct INSERT with a forged ₹1 total — is denied.
  begin
    insert into orders (order_number, customer_id, vendor_id, status, payment_method, payment_status, subtotal, total)
    values ('SETU-HACK1','11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            'pending','UPI','pending', 1, 1);
    raise exception 'FAIL A1: direct order INSERT was allowed — client can still forge totals';
  exception
    when insufficient_privilege then raise notice 'PASS A1: direct order INSERT denied by RLS';
    when others then
      if sqlstate = '42501' then raise notice 'PASS A1: direct order INSERT denied (%)', sqlerrm;
      else raise; end if;
  end;

  -- A2: create_order recomputes the total from products.price.
  --     ₹100 × 2 = 200 subtotal; delivery 0 (>=200); platform round(200*0.01)=2; total 202.
  v := create_order(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '[{"product_id":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","qty":2}]'::jsonb,
    'COD', 'House 1', 'vtest', null, false
  );
  if not (v->>'success')::boolean then raise exception 'FAIL A2: create_order failed: %', v->>'error'; end if;
  if (v->>'subtotal')::numeric <> 200 then raise exception 'FAIL A2: subtotal expected 200 got %', v->>'subtotal'; end if;
  if (v->>'total')::numeric    <> 202 then raise exception 'FAIL A2: total expected 202 got %',   v->>'total';    end if;
  insert into _t values ('A2_order', v->>'id');
  raise notice 'PASS A2: create_order computed total=₹% server-side (client prices ignored)', v->>'total';

  -- A3: a direct INSERT into order_items (forging a ₹1 line) is denied.
  begin
    insert into order_items (order_id, product_id, name, qty, price)
    values ((select t.v from _t t where t.k='A2_order')::uuid,
            'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','Cheap Rice', 1, 1);
    raise exception 'FAIL A3: direct order_items INSERT was allowed — client can inject ₹1 items';
  exception
    when insufficient_privilege then raise notice 'PASS A3: direct order_items INSERT denied by RLS';
    when others then
      if sqlstate = '42501' then raise notice 'PASS A3: direct order_items INSERT denied (%)', sqlerrm;
      else raise; end if;
  end;
end $$;
reset role;

-- ═══════════════════════════════════════════════════════════════
-- TEST B — CRITICAL-B: role-aware update_order_status
-- ═══════════════════════════════════════════════════════════════
-- B1: an unrelated customer cannot touch someone else's order.
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
do $$
declare v jsonb;
begin
  v := update_order_status('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee','delivered', null, '{}'::jsonb);
  if (v->>'error') is null then raise exception 'FAIL B1: outsider changed order status: %', v::text; end if;
  raise notice 'PASS B1: outsider rejected (%)', v->>'error';
end $$;
reset role;

-- B2: a non-assigned rider cannot deliver and cannot self-credit via p_meta.
set local role authenticated;
set local request.jwt.claims = '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}';
do $$
declare v jsonb;
begin
  v := update_order_status('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee','delivered', null,
       '{"rider_id":"dddddddd-dddd-dddd-dddd-dddddddddddd"}'::jsonb);
  if (v->>'error') is null then raise exception 'FAIL B2: non-assigned rider advanced the order: %', v::text; end if;
  raise notice 'PASS B2: non-assigned rider rejected (%)', v->>'error';
end $$;
reset role;

do $$
declare e numeric;
begin
  select today_earnings into e from riders where id='dddddddd-dddd-dddd-dddd-dddddddddddd';
  if e <> 0 then raise exception 'FAIL B2b: R2 today_earnings became % (cross-rider credit!)', e; end if;
  raise notice 'PASS B2b: R2 earnings still ₹0 (no cross-rider credit)';
end $$;

-- B3: the ASSIGNED rider may deliver; p_meta.rider_id is ignored,
--     credit lands on the order's own rider (R1), not the injected R2.
set local role authenticated;
set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';
do $$
declare v jsonb;
begin
  v := update_order_status('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee','delivered', null,
       '{"rider_id":"dddddddd-dddd-dddd-dddd-dddddddddddd"}'::jsonb);
  if not (v->>'success')::boolean then raise exception 'FAIL B3: assigned rider could not deliver: %', v->>'error'; end if;
  raise notice 'PASS B3: assigned rider delivered the order';
end $$;
reset role;

do $$
declare v_status text; v_rider uuid; e1 numeric; cb numeric; e2 numeric;
begin
  select status, rider_id into v_status, v_rider from orders where id='eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
  if v_status <> 'delivered' then raise exception 'FAIL B3b: status %, expected delivered', v_status; end if;
  if v_rider <> 'cccccccc-cccc-cccc-cccc-cccccccccccc' then
    raise exception 'FAIL B3b: rider_id overwritten to % via p_meta', v_rider; end if;

  select today_earnings, cod_balance into e1, cb from riders where id='cccccccc-cccc-cccc-cccc-cccccccccccc';
  select today_earnings              into e2 from riders where id='dddddddd-dddd-dddd-dddd-dddddddddddd';
  if e1 <> 80  then raise exception 'FAIL B3c: R1 today_earnings %, expected 80', e1; end if;
  if cb <> 500 then raise exception 'FAIL B3c: R1 cod_balance %, expected 500', cb; end if;
  if e2 <> 0   then raise exception 'FAIL B3c: R2 today_earnings % (should be 0)', e2; end if;
  raise notice 'PASS B3b/c: delivered; rider_id stayed R1; R1 credited ₹80 + ₹500 COD; R2 untouched';
end $$;

-- ═══════════════════════════════════════════════════════════════
-- TEST C — CRITICAL-C: SETU Credit discount must be backed
-- ═══════════════════════════════════════════════════════════════
-- C1: customer with NO credit account — discount rejected.
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
do $$
declare v jsonb;
begin
  begin
    v := create_order('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
         '[{"product_id":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","qty":2}]'::jsonb,
         'COD','House 1','vtest',null, true);
    raise exception 'FAIL C1: free discount granted with no credit account: %', v::text;
  exception
    when others then
      if position('Credit' in sqlerrm) > 0 then raise notice 'PASS C1: discount rejected without credit account (%)', sqlerrm;
      else raise; end if;
  end;
end $$;
reset role;

-- C2: customer with INSUFFICIENT available credit — discount rejected.
set local role authenticated;
set local request.jwt.claims = '{"sub":"77777777-7777-7777-7777-777777777777","role":"authenticated"}';
do $$
declare v jsonb;
begin
  begin
    v := create_order('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
         '[{"product_id":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","qty":2}]'::jsonb,
         'COD','House 1','vtest',null, true);
    raise exception 'FAIL C2: discount granted despite insufficient credit: %', v::text;
  exception
    when others then
      if position('Insufficient SETU Credit' in sqlerrm) > 0 then raise notice 'PASS C2: discount rejected for insufficient credit (%)', sqlerrm;
      else raise; end if;
  end;
end $$;
reset role;

-- C3: customer WITH sufficient credit — discount applied AND recorded
--     as a real drawdown (outstanding increases + disbursement row).
set local role authenticated;
set local request.jwt.claims = '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated"}';
do $$
declare v jsonb;
begin
  v := create_order('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
       '[{"product_id":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","qty":2}]'::jsonb,
       'COD','House 1','vtest',null, true);
  if not (v->>'success')::boolean then raise exception 'FAIL C3: create_order failed: %', v->>'error'; end if;
  if (v->>'credit_discount')::numeric <> 20  then raise exception 'FAIL C3: discount expected 20 got %', v->>'credit_discount'; end if;
  if (v->>'total')::numeric           <> 182 then raise exception 'FAIL C3: total expected 182 got %',   v->>'total'; end if;
  raise notice 'PASS C3: discount ₹% applied, total ₹%', v->>'credit_discount', v->>'total';
end $$;
reset role;

do $$
declare o numeric; n int;
begin
  select outstanding into o from credit_accounts where user_id='66666666-6666-6666-6666-666666666666';
  if o <> 20 then raise exception 'FAIL C3b: outstanding expected 20 (backed drawdown) got %', o; end if;
  select count(*) into n from credit_transactions
    where user_id='66666666-6666-6666-6666-666666666666' and type='disbursement' and amount=20;
  if n < 1 then raise exception 'FAIL C3b: no disbursement credit_transaction recorded'; end if;
  raise notice 'PASS C3b: discount is BACKED — outstanding ₹20 + disbursement row recorded';
end $$;

-- ═══════════════════════════════════════════════════════════════
-- TEST D — #4: pay_order_from_wallet charges the authoritative total
-- ═══════════════════════════════════════════════════════════════
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
do $$
declare v jsonb; w jsonb;
begin
  -- subtotal 100, delivery 20 (<200), platform round(1.0)=1, total 121.
  v := create_order('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
       '[{"product_id":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","qty":1}]'::jsonb,
       'wallet','House 1','vtest',null,false);
  if not (v->>'success')::boolean then raise exception 'FAIL D: create_order failed: %', v->>'error'; end if;
  if (v->>'total')::numeric <> 121 then raise exception 'FAIL D: total expected 121 got %', v->>'total'; end if;
  insert into _t values ('D_order', v->>'id');

  w := pay_order_from_wallet((v->>'id')::uuid);
  if not (w->>'success')::boolean then raise exception 'FAIL D: wallet payment failed: %', w::text; end if;
  if (w->>'new_balance')::numeric <> 879 then raise exception 'FAIL D: balance expected 879 got %', w->>'new_balance'; end if;
  raise notice 'PASS D: wallet charged authoritative total ₹121, new balance ₹%', w->>'new_balance';
end $$;
reset role;

do $$
declare v_status text; v_pay text; bal numeric; esc numeric;
begin
  select status, payment_status into v_status, v_pay
    from orders where id=(select t.v from _t t where t.k='D_order')::uuid;
  if v_status <> 'confirmed' or v_pay <> 'paid' then
    raise exception 'FAIL Db: order not confirmed/paid (status=%, payment_status=%)', v_status, v_pay; end if;

  select balance into bal from wallets where user_id='11111111-1111-1111-1111-111111111111';
  if bal <> 879 then raise exception 'FAIL Db: wallet balance % expected 879', bal; end if;

  select balance into esc from vendor_escrow where vendor_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  if esc <> 99 then raise exception 'FAIL Db: vendor escrow % expected 99 (subtotal 100 - platform 1)', esc; end if;

  raise notice 'PASS Db: order confirmed+paid, wallet debited exactly ₹121, vendor escrow credited ₹99';
end $$;

-- ═══════════════════════════════════════════════════════════════
-- TEST E — fees are single-sourced from get_fee_config()
-- ═══════════════════════════════════════════════════════════════
-- Change the platform commission in platform_config; create_order
-- must honour it (proves the fee math is config-driven, not hardcoded).
update platform_config set value = '5' where key = 'platform_commission_pct';

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
do $$
declare v jsonb;
begin
  -- subtotal 100 (<200) → delivery 20; platform round(100*5/100)=5; total 125.
  v := create_order('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
       '[{"product_id":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","qty":1}]'::jsonb,
       'COD','House 1','vtest',null,false);
  if not (v->>'success')::boolean then raise exception 'FAIL E: create_order failed: %', v->>'error'; end if;
  if (v->>'platform_fee')::numeric <> 5 then raise exception 'FAIL E: platform_fee expected 5 (5%% via config) got %', v->>'platform_fee'; end if;
  if (v->>'total')::numeric <> 125 then raise exception 'FAIL E: total expected 125 got %', v->>'total'; end if;
  raise notice 'PASS E: create_order honoured config (commission 5%% -> platform Rs.5, total Rs.125)';
end $$;
reset role;

do $$
begin
  raise notice '═══════════════════════════════════════════';
  raise notice '  ✅ ALL PHASE-1 MONEY-INTEGRITY TESTS PASSED';
  raise notice '═══════════════════════════════════════════';
end $$;

-- Non-destructive: undo everything this script created.
rollback;
