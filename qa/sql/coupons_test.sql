-- ═══════════════════════════════════════════════════════════════
-- SETU — Coupons Proof (migration 028)
--
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
--        -v ON_ERROR_STOP=1 -f qa/sql/coupons_test.sql
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
insert into products (id, vendor_id, name, price, mrp, unit, stock, is_available, category)
values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','Rice', 100, 120, 'kg', 100, true, 'grocery');

-- ── T1: a customer cannot create a coupon ──
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
do $$
begin
  begin
    perform upsert_coupon(null,'HACK50','x','percent',50,null,0,'all',null,null,1,null,null,true);
    raise exception 'FAIL T1: customer created a coupon';
  exception when others then
    if position('coupons.create' in sqlerrm) > 0 then raise notice 'PASS T1: upsert_coupon denied to customer (%)', sqlerrm;
    else raise; end if;
  end;
end $$;

-- ── T2: super_admin creates a coupon ──
set local request.jwt.claims = '{"sub":"99999999-9999-9999-9999-999999999999","role":"authenticated"}';
do $$
declare v jsonb;
begin
  v := upsert_coupon(null,'SETU50','Half off','percent',50,100,100,'all',null,null,1,null,null,true);
  if not (v->>'success')::boolean then raise exception 'FAIL T2: coupon create failed: %', v::text; end if;
  raise notice 'PASS T2: super_admin created coupon SETU50';
end $$;

-- ── T3: validation — discount, cap and min-order ──
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
do $$
declare v jsonb;
begin
  v := validate_coupon('SETU50', 200, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  if not (v->>'valid')::boolean then raise exception 'FAIL T3: SETU50 should be valid on ₹200'; end if;
  if (v->>'discount')::numeric <> 100 then raise exception 'FAIL T3: discount expected 100 (50%% capped), got %', v->>'discount'; end if;

  v := validate_coupon('SETU50', 50, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  if (v->>'valid')::boolean then raise exception 'FAIL T3: coupon should fail below min order'; end if;
  raise notice 'PASS T3: validation honours percent cap + min order';
end $$;

-- ── T4: create_order applies the coupon, records redemption, bumps used_count ──
do $$
declare v jsonb; n int; uc int;
begin
  v := create_order('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
       '[{"product_id":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","qty":2}]'::jsonb,
       'COD','addr', null, null, false, 'SETU50');
  if not (v->>'success')::boolean then raise exception 'FAIL T4: order failed: %', v::text; end if;
  -- subtotal 200, coupon 100, delivery 0 (>=200), platform round(100*1%)=1, total 101
  if (v->>'coupon_discount')::numeric <> 100 then raise exception 'FAIL T4: coupon_discount expected 100, got %', v->>'coupon_discount'; end if;
  if (v->>'total')::numeric <> 101 then raise exception 'FAIL T4: total expected 101, got %', v->>'total'; end if;
  reset role;
  select count(*) into n from coupon_redemptions where user_id='11111111-1111-1111-1111-111111111111';
  if n <> 1 then raise exception 'FAIL T4: redemption not recorded'; end if;
  select used_count into uc from coupons where code='SETU50';
  if uc <> 1 then raise exception 'FAIL T4: used_count not incremented (%)', uc; end if;
  raise notice 'PASS T4: coupon applied (total ₹101), redemption recorded, used_count=1';
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
end $$;

-- ── T5: per-user limit enforced on a second use ──
do $$
begin
  begin
    perform create_order('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
       '[{"product_id":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","qty":2}]'::jsonb,
       'COD','addr', null, null, false, 'SETU50');
    raise exception 'FAIL T5: coupon reused beyond per-user limit';
  exception when others then
    if position('already used' in sqlerrm) > 0 then raise notice 'PASS T5: per-user limit enforced (%)', sqlerrm;
    else raise; end if;
  end;
end $$;

-- ── T6: invalid coupon code is rejected at order time ──
do $$
begin
  begin
    perform create_order('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
       '[{"product_id":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","qty":1}]'::jsonb,
       'COD','addr', null, null, false, 'NOPE');
    raise exception 'FAIL T6: invalid coupon accepted';
  exception when others then
    if position('Invalid or inactive coupon' in sqlerrm) > 0 then raise notice 'PASS T6: invalid coupon rejected (%)', sqlerrm;
    else raise; end if;
  end;
end $$;

-- ── T7: direct coupons write denied (RPC-only) ──
do $$
begin
  begin
    insert into coupons (code, discount_type, discount_value) values ('HACK', 'flat', 999);
    raise exception 'FAIL T7: direct coupons INSERT was allowed';
  exception
    when insufficient_privilege then raise notice 'PASS T7: direct coupons INSERT denied by RLS';
    when others then
      if sqlstate = '42501' then raise notice 'PASS T7: direct coupons INSERT denied (%)', sqlerrm;
      else raise; end if;
  end;
end $$;

reset role;

do $$
begin
  raise notice '═══════════════════════════════════════════';
  raise notice '  ✅ ALL COUPONS TESTS PASSED';
  raise notice '═══════════════════════════════════════════';
end $$;

rollback;
