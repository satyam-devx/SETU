-- ═══════════════════════════════════════════════════════════════
-- SETU — Security Ops Proof (migration 030)
--
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
--        -v ON_ERROR_STOP=1 -f qa/sql/security_ops_test.sql
--
-- Runs in one transaction, ends with ROLLBACK (non-destructive).
--   T1 — customer cannot block an IP
--   T2 — super_admin blocks/lists/unblocks an IP; is_ip_blocked works
--   T3 — merge_user_accounts moves orders + folds wallet, bans dup
--   T4 — begin_impersonation refuses to target an admin; logs a normal one
-- ═══════════════════════════════════════════════════════════════

begin;

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at, email_confirmed_at)
values
  ('00000000-0000-0000-0000-000000000000','99999999-9999-9999-9999-999999999999','authenticated','authenticated','super@test.local','{}','{}', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000','11111111-1111-1111-1111-111111111111','authenticated','authenticated','c1@test.local','{}','{}', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000','22222222-2222-2222-2222-222222222222','authenticated','authenticated','c2@test.local','{}','{}', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000','33333333-3333-3333-3333-333333333333','authenticated','authenticated','vo@test.local','{}','{}', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000','88888888-8888-8888-8888-888888888888','authenticated','authenticated','admin2@test.local','{}','{}', now(), now(), now());
update profiles set role='super_admin', name='Super'  where id='99999999-9999-9999-9999-999999999999';
update profiles set role='customer',    name='Keep'   where id='11111111-1111-1111-1111-111111111111';
update profiles set role='customer',    name='Dup'    where id='22222222-2222-2222-2222-222222222222';
update profiles set role='vendor',       name='Vend'   where id='33333333-3333-3333-3333-333333333333';
update profiles set role='admin',        name='Admin2' where id='88888888-8888-8888-8888-888888888888';

insert into vendors (id, owner_id, name, category, is_active)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','33333333-3333-3333-3333-333333333333','Vend Store','grocery', true);
insert into products (id, vendor_id, name, price, mrp, unit, stock, is_available, category)
values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','Rice', 100, 120, 'kg', 100, true, 'grocery');

-- Give the duplicate an order + wallet balance to migrate.
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
do $$
declare v jsonb;
begin
  v := create_order('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
       '[{"product_id":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","qty":1}]'::jsonb,
       'COD','addr', null, null, false, null);
  if not (v->>'success')::boolean then raise exception 'SETUP: order failed: %', v::text; end if;
end $$;
reset role;
insert into wallets (user_id, balance) values ('22222222-2222-2222-2222-222222222222', 250)
on conflict (user_id) do update set balance = 250;

-- ── T1: customer cannot block an IP ──
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
do $$
begin
  begin
    perform block_ip('1.2.3.4', 'nope');
    raise exception 'FAIL T1: customer blocked an IP';
  exception when others then
    if position('users.update' in sqlerrm) > 0 then raise notice 'PASS T1: block_ip denied to customer';
    else raise; end if;
  end;
end $$;

-- ── T2: super_admin block / is_ip_blocked / unblock ──
set local request.jwt.claims = '{"sub":"99999999-9999-9999-9999-999999999999","role":"authenticated"}';
do $$
begin
  perform block_ip('203.0.113.9', 'abuse');
  if not is_ip_blocked('203.0.113.9') then raise exception 'FAIL T2: ip not blocked'; end if;
  if (select count(*) from list_blocked_ips() where ip = '203.0.113.9') <> 1 then raise exception 'FAIL T2: not listed'; end if;
  perform unblock_ip('203.0.113.9');
  if is_ip_blocked('203.0.113.9') then raise exception 'FAIL T2: ip still blocked after unblock'; end if;
  raise notice 'PASS T2: block/list/is_ip_blocked/unblock work';
end $$;

-- ── T3: merge accounts ──
do $$
declare v jsonb; v_orders int; v_bal numeric; v_dup_banned boolean;
begin
  v := merge_user_accounts('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222');
  if not (v->>'success')::boolean then raise exception 'FAIL T3: merge failed: %', v::text; end if;

  select count(*) into v_orders from orders where customer_id = '22222222-2222-2222-2222-222222222222';
  if v_orders <> 0 then raise exception 'FAIL T3: dup still owns % orders', v_orders; end if;

  select balance into v_bal from wallets where user_id = '11111111-1111-1111-1111-111111111111';
  if coalesce(v_bal,0) < 250 then raise exception 'FAIL T3: wallet not folded (got %)', v_bal; end if;

  select is_banned into v_dup_banned from profiles where id = '22222222-2222-2222-2222-222222222222';
  if not v_dup_banned then raise exception 'FAIL T3: duplicate not retired/banned'; end if;
  raise notice 'PASS T3: orders moved, wallet folded, duplicate retired';
end $$;

-- ── T4: impersonation guards ──
do $$
declare v jsonb;
begin
  -- cannot impersonate an admin (a DIFFERENT admin, not the caller)
  begin
    perform begin_impersonation('88888888-8888-8888-8888-888888888888', 'why');
    raise exception 'FAIL T4: impersonated an admin';
  exception when others then
    if position('another admin' in sqlerrm) > 0 then raise notice 'PASS T4a: cannot impersonate admin';
    else raise; end if;
  end;
  -- requires a reason
  begin
    perform begin_impersonation('11111111-1111-1111-1111-111111111111', '');
    raise exception 'FAIL T4: impersonation without reason';
  exception when others then
    if position('reason is required' in sqlerrm) > 0 then raise notice 'PASS T4b: reason required';
    else raise; end if;
  end;
  -- valid impersonation logs a row
  v := begin_impersonation('11111111-1111-1111-1111-111111111111', 'support investigation');
  if not (v->>'success')::boolean then raise exception 'FAIL T4: valid impersonation failed'; end if;
  reset role;
  if (select count(*) from impersonation_log where target_id = '11111111-1111-1111-1111-111111111111') <> 1
    then raise exception 'FAIL T4: impersonation not logged'; end if;
  raise notice 'PASS T4: impersonation guards + audit log';
end $$;

reset role;

do $$
begin
  raise notice '═══════════════════════════════════════════';
  raise notice '  ✅ ALL SECURITY OPS TESTS PASSED';
  raise notice '═══════════════════════════════════════════';
end $$;

rollback;
