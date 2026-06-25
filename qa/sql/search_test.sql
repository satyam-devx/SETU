-- ═══════════════════════════════════════════════════════════════
-- SETU — Admin Global Search Proof (migration 029)
--
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
--        -v ON_ERROR_STOP=1 -f qa/sql/search_test.sql
--
-- Runs in one transaction, ends with ROLLBACK (non-destructive).
-- Proves admin_global_search():
--   T1 — non-admin (customer) is denied
--   T2 — short query (<2 chars) returns []
--   T3 — super_admin finds a seeded user, vendor, order and coupon
--   T4 — kinds + navigation paths are correct
-- ═══════════════════════════════════════════════════════════════

begin;

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at, email_confirmed_at)
values
  ('00000000-0000-0000-0000-000000000000','99999999-9999-9999-9999-999999999999','authenticated','authenticated','super@test.local','{}','{}', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000','11111111-1111-1111-1111-111111111111','authenticated','authenticated','c1@test.local','{}','{}', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000','33333333-3333-3333-3333-333333333333','authenticated','authenticated','vo@test.local','{}','{}', now(), now(), now());
update profiles set role='super_admin', name='Zara Searchable', phone='9008007001' where id='99999999-9999-9999-9999-999999999999';
update profiles set role='customer',    name='Carl Customer',   phone='9008007002' where id='11111111-1111-1111-1111-111111111111';
update profiles set role='vendor',       name='Vinod Vendor',    phone='9008007003' where id='33333333-3333-3333-3333-333333333333';

insert into vendors (id, owner_id, name, category, is_active)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','33333333-3333-3333-3333-333333333333','Searchmart Stores','grocery', true);
insert into products (id, vendor_id, name, price, mrp, unit, stock, is_available, category)
values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','Rice', 100, 120, 'kg', 100, true, 'grocery');

-- Seed a coupon (as super_admin via RPC) and an order (as customer via RPC).
set local role authenticated;
set local request.jwt.claims = '{"sub":"99999999-9999-9999-9999-999999999999","role":"authenticated"}';
do $$
declare v jsonb;
begin
  v := upsert_coupon(null,'FINDME10','x','flat',10,null,0,'all',null,null,1,null,null,true);
  if not (v->>'success')::boolean then raise exception 'SETUP: coupon create failed: %', v::text; end if;
end $$;

set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
do $$
declare v jsonb;
begin
  v := create_order('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
       '[{"product_id":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","qty":1}]'::jsonb,
       'COD','addr', null, null, false, null);
  if not (v->>'success')::boolean then raise exception 'SETUP: order create failed: %', v::text; end if;
end $$;

-- ── T1: a customer is denied (is_admin gate) ──
do $$
begin
  begin
    perform admin_global_search('Searchmart');
    raise exception 'FAIL T1: customer was allowed to run admin_global_search';
  exception when others then
    if position('Unauthorized' in sqlerrm) > 0 then raise notice 'PASS T1: admin_global_search denied to customer (%)', sqlerrm;
    else raise; end if;
  end;
end $$;

-- ── T2: short query returns [] for an admin ──
set local request.jwt.claims = '{"sub":"99999999-9999-9999-9999-999999999999","role":"authenticated"}';
do $$
declare v jsonb;
begin
  v := admin_global_search('a');
  if jsonb_array_length(v) <> 0 then raise exception 'FAIL T2: short query should return [], got %', v::text; end if;
  raise notice 'PASS T2: <2 char query returns []';
end $$;

-- ── T3: super_admin finds the seeded user / vendor / order / coupon ──
do $$
declare v jsonb;
begin
  v := admin_global_search('Zara');
  if not exists (select 1 from jsonb_array_elements(v) e where e->>'kind'='user' and e->>'label'='Zara Searchable')
    then raise exception 'FAIL T3a: user not found: %', v::text; end if;

  v := admin_global_search('Searchmart');
  if not exists (select 1 from jsonb_array_elements(v) e where e->>'kind'='vendor' and e->>'label'='Searchmart Stores')
    then raise exception 'FAIL T3b: vendor not found: %', v::text; end if;

  v := admin_global_search('SETU-');
  if not exists (select 1 from jsonb_array_elements(v) e where e->>'kind'='order')
    then raise exception 'FAIL T3c: order not found: %', v::text; end if;

  v := admin_global_search('FINDME');
  if not exists (select 1 from jsonb_array_elements(v) e where e->>'kind'='coupon' and e->>'label'='FINDME10')
    then raise exception 'FAIL T3d: coupon not found: %', v::text; end if;

  raise notice 'PASS T3: super_admin finds user, vendor, order and coupon';
end $$;

-- ── T4: navigation paths are correct per kind ──
do $$
declare v jsonb;
begin
  v := admin_global_search('Zara');
  if not exists (select 1 from jsonb_array_elements(v) e where e->>'kind'='user' and e->>'path'='/superadmin/users')
    then raise exception 'FAIL T4a: user path wrong: %', v::text; end if;

  v := admin_global_search('Searchmart');
  if not exists (select 1 from jsonb_array_elements(v) e where e->>'kind'='vendor' and e->>'path'='/admin/vendors')
    then raise exception 'FAIL T4b: vendor path wrong: %', v::text; end if;

  v := admin_global_search('FINDME');
  if not exists (select 1 from jsonb_array_elements(v) e where e->>'kind'='coupon' and e->>'path'='/admin/coupons')
    then raise exception 'FAIL T4c: coupon path wrong: %', v::text; end if;

  raise notice 'PASS T4: navigation paths correct';
end $$;

reset role;

do $$
begin
  raise notice '═══════════════════════════════════════════';
  raise notice '  ✅ ALL ADMIN SEARCH TESTS PASSED';
  raise notice '═══════════════════════════════════════════';
end $$;

rollback;
