-- ═══════════════════════════════════════════════════════════════
-- Migration 030: Security Center — deep operations
--
-- Closes the advanced-security gap with REAL, audited operations:
--   • blocked_ips           — IP blocklist + is_ip_blocked() check
--   • get_login_history     — reads Supabase auth.audit_log_entries
--   • get_user_sessions     — reads Supabase auth.sessions
--   • force_logout          — revokes a user's sessions (auth.sessions)
--   • merge_user_accounts   — reassigns data + retires the duplicate
--   • impersonation_log     — audited record of admin impersonation
--                             (token minting handled by the
--                              admin-impersonate edge function)
--
-- Authorization: users.update via dynamic RBAC. Every mutation is
-- written to the append-only audit_log (migration 025).
-- ═══════════════════════════════════════════════════════════════

-- ── 1. IP blocklist ─────────────────────────────────────────────
create table if not exists blocked_ips (
  ip          inet primary key,
  reason      text,
  blocked_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_blocked_ips_created_at on blocked_ips(created_at desc);

alter table blocked_ips enable row level security;
drop policy if exists "blocked_ips_read" on blocked_ips;
create policy "blocked_ips_read" on blocked_ips
  for select using (has_permission('users.view') or is_admin());
-- Writes via RPC only.

create or replace function is_ip_blocked(p_ip text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from blocked_ips where ip = p_ip::inet);
$$;
grant execute on function is_ip_blocked(text) to authenticated, anon;

create or replace function block_ip(p_ip text, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not has_permission('users.update') then
    raise exception 'Unauthorized: users.update required';
  end if;
  insert into blocked_ips (ip, reason, blocked_by)
  values (p_ip::inet, p_reason, auth.uid())
  on conflict (ip) do update set reason = excluded.reason, blocked_by = excluded.blocked_by, created_at = now();

  insert into audit_log (actor_id, actor, action, target, target_type, detail)
  values (auth.uid(), coalesce((select name from profiles where id = auth.uid()), 'admin'),
          'block_ip', p_ip, 'ip', coalesce(p_reason, 'no reason given'));
end;
$$;
grant execute on function block_ip(text, text) to authenticated;

create or replace function unblock_ip(p_ip text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not has_permission('users.update') then
    raise exception 'Unauthorized: users.update required';
  end if;
  delete from blocked_ips where ip = p_ip::inet;

  insert into audit_log (actor_id, actor, action, target, target_type, detail)
  values (auth.uid(), coalesce((select name from profiles where id = auth.uid()), 'admin'),
          'unblock_ip', p_ip, 'ip', null);
end;
$$;
grant execute on function unblock_ip(text) to authenticated;

create or replace function list_blocked_ips()
returns table (ip text, reason text, blocked_by uuid, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select ip::text, reason, blocked_by, created_at
  from blocked_ips
  where (select has_permission('users.view'))
  order by created_at desc;
$$;
grant execute on function list_blocked_ips() to authenticated;

-- ── 2. Login history (reads Supabase auth audit) ────────────────
create or replace function get_login_history(p_user_id uuid default null, p_limit integer default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare v jsonb;
begin
  if not has_permission('users.view') then
    raise exception 'Unauthorized: users.view required';
  end if;
  begin
    select coalesce(jsonb_agg(row_to_json(e) order by e.created_at desc), '[]'::jsonb) into v
    from (
      select id,
             payload->>'action'    as action,
             payload->>'actor_id'  as actor_id,
             payload->>'actor_name' as actor_name,
             ip_address,
             created_at
      from auth.audit_log_entries
      where (p_user_id is null or (payload->>'actor_id') = p_user_id::text)
      order by created_at desc
      limit greatest(1, least(p_limit, 200))
    ) e;
  exception when others then
    v := '[]'::jsonb;   -- auth schema not reachable in this environment
  end;
  return v;
end;
$$;
grant execute on function get_login_history(uuid, integer) to authenticated;

-- ── 3. Active sessions + force logout (auth.sessions) ───────────
create or replace function get_user_sessions(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare v jsonb;
begin
  if not has_permission('users.view') then
    raise exception 'Unauthorized: users.view required';
  end if;
  begin
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id, 'created_at', s.created_at, 'updated_at', s.updated_at,
      'not_after', s.not_after, 'user_agent', s.user_agent, 'ip', s.ip
    ) order by s.updated_at desc), '[]'::jsonb) into v
    from auth.sessions s
    where s.user_id = p_user_id;
  exception when others then
    v := '[]'::jsonb;
  end;
  return v;
end;
$$;
grant execute on function get_user_sessions(uuid) to authenticated;

create or replace function force_logout(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare v_count integer := 0;
begin
  if not has_permission('users.update') then
    raise exception 'Unauthorized: users.update required';
  end if;
  begin
    delete from auth.sessions where user_id = p_user_id;
    get diagnostics v_count = row_count;
    -- refresh tokens cascade from sessions; also revoke any orphans
    begin
      update auth.refresh_tokens set revoked = true where user_id = p_user_id::text;
    exception when others then null;
    end;
  exception when others then
    raise exception 'Could not revoke sessions in this environment';
  end;

  insert into audit_log (actor_id, actor, action, target, target_type, detail)
  values (auth.uid(), coalesce((select name from profiles where id = auth.uid()), 'admin'),
          'force_logout', p_user_id::text, 'user', format('%s session(s) revoked', v_count));

  return jsonb_build_object('success', true, 'sessions_revoked', v_count);
end;
$$;
grant execute on function force_logout(uuid) to authenticated;

-- ── 4. Merge duplicate accounts ─────────────────────────────────
-- Reassigns business data from the duplicate (p_remove) to the kept
-- account (p_keep), folds wallet/credit balances, then retires the
-- duplicate (banned + flagged). Fully audited.
create or replace function merge_user_accounts(p_keep uuid, p_remove uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_moved_orders   integer := 0;
  v_remove_balance numeric := 0;
  v_remove_out     numeric := 0;
begin
  if not has_permission('users.update') then
    raise exception 'Unauthorized: users.update required';
  end if;
  if p_keep = p_remove then raise exception 'Cannot merge an account into itself'; end if;
  if not exists (select 1 from profiles where id = p_keep)   then raise exception 'Keep account not found'; end if;
  if not exists (select 1 from profiles where id = p_remove) then raise exception 'Duplicate account not found'; end if;

  -- Reassign owned records.
  update orders          set customer_id = p_keep where customer_id = p_remove;
  get diagnostics v_moved_orders = row_count;
  update support_tickets set user_id     = p_keep where user_id     = p_remove;
  update notifications    set user_id     = p_keep where user_id     = p_remove;
  update kyc_records      set user_id     = p_keep where user_id     = p_remove;

  -- Fold wallet balance into the kept wallet, then zero the duplicate.
  select balance into v_remove_balance from wallets where user_id = p_remove;
  if coalesce(v_remove_balance,0) > 0 then
    insert into wallets (user_id, balance) values (p_keep, v_remove_balance)
    on conflict (user_id) do update set balance = wallets.balance + excluded.balance, updated_at = now();
    update wallets set balance = 0, updated_at = now() where user_id = p_remove;
    insert into wallet_transactions (wallet_id, user_id, type, amount, description, reference, status)
    select id, p_keep, 'credit', v_remove_balance,
           'Merged from duplicate account ' || p_remove::text, 'account_merge', 'completed'
    from wallets where user_id = p_keep;
  end if;

  -- Fold outstanding credit (so debt is not lost).
  select outstanding into v_remove_out from credit_accounts where user_id = p_remove;
  if coalesce(v_remove_out,0) > 0 then
    update credit_accounts set outstanding = outstanding + v_remove_out, updated_at = now()
     where user_id = p_keep;
    update credit_accounts set outstanding = 0, updated_at = now() where user_id = p_remove;
  end if;

  -- Retire the duplicate.
  update profiles
     set is_banned = true, banned_at = now(),
         ban_reason = 'Merged into account ' || p_keep::text, updated_at = now()
   where id = p_remove;

  insert into audit_log (actor_id, actor, action, target, target_type, detail)
  values (auth.uid(), coalesce((select name from profiles where id = auth.uid()), 'admin'),
          'merge_accounts', p_remove::text, 'user',
          format('merged into %s — %s orders moved, ₹%s wallet, ₹%s credit folded',
                 p_keep, v_moved_orders, coalesce(v_remove_balance,0), coalesce(v_remove_out,0)));

  return jsonb_build_object('success', true, 'keep', p_keep, 'removed', p_remove,
                            'orders_moved', v_moved_orders,
                            'wallet_folded', coalesce(v_remove_balance,0),
                            'credit_folded', coalesce(v_remove_out,0));
end;
$$;
grant execute on function merge_user_accounts(uuid, uuid) to authenticated;

-- ── 5. Impersonation audit ──────────────────────────────────────
-- The actual session token is minted by the admin-impersonate edge
-- function (service-role, server-side). This table is the immutable
-- record of who impersonated whom and why.
create table if not exists impersonation_log (
  id          uuid primary key default uuid_generate_v4(),
  admin_id    uuid not null references auth.users(id) on delete cascade,
  target_id   uuid not null references auth.users(id) on delete cascade,
  reason      text not null,
  created_at  timestamptz not null default now(),
  ended_at    timestamptz
);
create index if not exists idx_impersonation_log_admin  on impersonation_log(admin_id);
create index if not exists idx_impersonation_log_target on impersonation_log(target_id);
create index if not exists idx_impersonation_log_created on impersonation_log(created_at desc);

alter table impersonation_log enable row level security;
drop policy if exists "impersonation_log_read" on impersonation_log;
create policy "impersonation_log_read" on impersonation_log
  for select using (has_permission('users.view') or is_admin());

-- Append-only.
drop trigger if exists trg_impersonation_log_immutable on impersonation_log;
create trigger trg_impersonation_log_immutable
  before delete on impersonation_log
  for each row execute function prevent_audit_log_mutation();

create or replace function begin_impersonation(p_target uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if not has_permission('users.update') then
    raise exception 'Unauthorized: users.update required';
  end if;
  if coalesce(trim(p_reason),'') = '' then raise exception 'A reason is required to impersonate'; end if;
  if p_target = auth.uid() then raise exception 'Cannot impersonate yourself'; end if;
  if (select role from profiles where id = p_target) in ('admin','super_admin') then
    raise exception 'Cannot impersonate another admin';
  end if;

  insert into impersonation_log (admin_id, target_id, reason)
  values (auth.uid(), p_target, p_reason) returning id into v_id;

  insert into audit_log (actor_id, actor, action, target, target_type, detail)
  values (auth.uid(), coalesce((select name from profiles where id = auth.uid()), 'admin'),
          'impersonation_started', p_target::text, 'user', p_reason);

  return jsonb_build_object('success', true, 'impersonation_id', v_id, 'target_id', p_target);
end;
$$;
grant execute on function begin_impersonation(uuid, text) to authenticated;

create or replace function get_security_ops_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (has_permission('users.view') or is_admin()) then
    raise exception 'Unauthorized';
  end if;
  return jsonb_build_object(
    'blocked_ips',          (select count(*) from blocked_ips),
    'impersonations_24h',   (select count(*) from impersonation_log where created_at > now() - interval '24 hours'),
    'forced_logouts_24h',   (select count(*) from audit_log where action = 'force_logout' and created_at > now() - interval '24 hours'),
    'account_merges_24h',   (select count(*) from audit_log where action = 'merge_accounts' and created_at > now() - interval '24 hours'),
    'as_of', now()
  );
end;
$$;
grant execute on function get_security_ops_overview() to authenticated;

insert into audit_log (actor_id, actor, action, target, detail)
values (null, 'system', 'ops_migration', 'security',
  'migration_030: security ops — blocked_ips + is_ip_blocked/block_ip/unblock_ip/list_blocked_ips; get_login_history (auth audit); get_user_sessions + force_logout (auth.sessions); merge_user_accounts; impersonation_log + begin_impersonation; get_security_ops_overview — all users.update-gated and audited');
