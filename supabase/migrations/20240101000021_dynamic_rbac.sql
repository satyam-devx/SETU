-- ═══════════════════════════════════════════════════════════════
-- Migration 021: Dynamic RBAC (configurable permissions)
--
-- Replaces hardcoded authorization (is_admin() / fixed role enum) with a
-- DATABASE-DRIVEN permission system so authorization is configuration,
-- not code. Adding a permission or changing what a role can do is a row
-- change made from the Super Admin panel — no deploy.
--
-- Model (single role per user — keeps the existing profiles.role):
--   permissions       — catalog of module.action capabilities
--   roles             — the assignable roles (system + custom)
--   role_permissions  — which permissions each role has
--   has_permission(key)            — authoritative check (super_admin ⇒ all)
--   current_user_permissions()     — the caller's full permission set (for UI gating)
--   set_role_permission / create_role / create_permission — super-admin,
--   audited management RPCs (writes go ONLY through these; tables are
--   read-only to clients via RLS).
--
-- Every management action is written to audit_log (who/what/old→new/when).
-- IP/device aren't available in the SQL context — those are captured at
-- the Edge/HTTP layer; documented in SECURITY.md.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. permissions catalog ──────────────────────────────────────
create table if not exists permissions (
  key         text primary key,             -- 'module.action', e.g. 'users.view'
  module      text not null,
  action      text not null,
  description text,
  is_system   boolean not null default true, -- seeded vs admin-created
  created_at  timestamptz not null default now(),
  unique (module, action)
);
create index if not exists idx_permissions_module on permissions(module);

-- ── 2. roles ─────────────────────────────────────────────────────
create table if not exists roles (
  key         text primary key,             -- matches profiles.role for assignable roles
  name        text not null,
  description text,
  is_system   boolean not null default false, -- system roles can't be deleted
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── 3. role → permission mapping ─────────────────────────────────
create table if not exists role_permissions (
  role_key       text not null references roles(key) on delete cascade,
  permission_key text not null references permissions(key) on delete cascade,
  granted_by     uuid references auth.users(id) on delete set null,
  granted_at     timestamptz not null default now(),
  primary key (role_key, permission_key)
);
create index if not exists idx_role_permissions_role on role_permissions(role_key);

-- ── 4. Seed the role catalog (matches the existing role enum) ────
insert into roles (key, name, description, is_system) values
  ('customer',      'Customer',         'End customer placing orders',                 true),
  ('vendor',        'Vendor',           'Shop owner selling products',                 true),
  ('rider',         'Delivery Rider',   'Delivers orders',                             true),
  ('seva_provider', 'Seva Provider',    'Provides local services',                     true),
  ('anchor',        'Village Anchor',   'Village-level operations & mediation',        true),
  ('admin',         'Block Admin',      'Operates the platform for a block/region',    true),
  ('super_admin',   'Super Admin',      'Full platform control',                       true)
on conflict (key) do nothing;

-- ── 5. Seed the permission catalog: module × action matrix ───────
-- A generous, future-proof matrix. Extra rows are harmless (just never
-- checked) and adding a module/action later is a single insert from the
-- panel via create_permission(). This is the "configuration not code"
-- guarantee from the spec.
insert into permissions (key, module, action, description)
select m.module || '.' || a.action,
       m.module, a.action,
       initcap(a.action) || ' ' || initcap(replace(m.module,'_',' '))
from   (values
          ('users'),('roles'),('orders'),('products'),('inventory'),
          ('payments'),('wallet'),('refunds'),('coupons'),('analytics'),
          ('reports'),('marketing'),('notifications'),('support'),('finance'),
          ('cms'),('ai'),('settings'),('kyc'),('disputes'),('feature_flags'),
          ('vendors'),('riders'),('villages')
        ) as m(module)
cross join (values
          ('view'),('create'),('update'),('delete'),('approve'),('reject'),
          ('export'),('assign'),('manage'),('grant'),('revoke')
        ) as a(action)
on conflict (key) do nothing;

-- ── 6. Seed role_permissions ─────────────────────────────────────
-- super_admin is special-cased to ALL in has_permission()/current_user_
-- permissions(), so we don't seed its (large) row set.
-- admin gets everything EXCEPT: role management, grant/revoke actions,
-- feature-flag mutation, and settings.manage — those stay super-admin only.
insert into role_permissions (role_key, permission_key)
select 'admin', p.key
from   permissions p
where  p.module <> 'roles'
  and  p.action not in ('grant','revoke')
  and  not (p.module = 'feature_flags' and p.action in ('create','update','delete','manage'))
  and  not (p.module = 'settings'      and p.action = 'manage')
on conflict do nothing;

-- ── 7. Authorization functions ───────────────────────────────────

-- The authoritative check used by RLS/RPCs and the UI alike.
create or replace function has_permission(p_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when get_my_role() = 'super_admin' then true
    else exists (
      select 1 from role_permissions rp
      where rp.role_key = get_my_role()
        and rp.permission_key = p_key
    )
  end;
$$;
grant execute on function has_permission(text) to authenticated;

-- The caller's full permission set — the frontend loads this once to
-- gate UI. super_admin ⇒ every catalog key.
create or replace function current_user_permissions()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select case
    when get_my_role() = 'super_admin'
      then coalesce((select array_agg(key order by key) from permissions), '{}')
    else coalesce(
      (select array_agg(permission_key order by permission_key)
         from role_permissions where role_key = get_my_role()),
      '{}'
    )
  end;
$$;
grant execute on function current_user_permissions() to authenticated;

-- ── 8. Management RPCs (super-admin only, audited) ───────────────
-- Writes to the RBAC tables happen ONLY through these. Each verifies the
-- caller is super_admin and records the change to audit_log.

create or replace function set_role_permission(
  p_role_key       text,
  p_permission_key text,
  p_granted        boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_had boolean;
begin
  if get_my_role() <> 'super_admin' then
    raise exception 'Unauthorized: super_admin role required';
  end if;
  if p_role_key = 'super_admin' then
    raise exception 'super_admin has all permissions implicitly and cannot be modified';
  end if;
  if not exists (select 1 from roles where key = p_role_key) then
    raise exception 'Unknown role: %', p_role_key;
  end if;
  if not exists (select 1 from permissions where key = p_permission_key) then
    raise exception 'Unknown permission: %', p_permission_key;
  end if;

  v_had := exists (
    select 1 from role_permissions
    where role_key = p_role_key and permission_key = p_permission_key
  );

  if p_granted then
    insert into role_permissions (role_key, permission_key, granted_by)
    values (p_role_key, p_permission_key, auth.uid())
    on conflict do nothing;
  else
    delete from role_permissions
    where role_key = p_role_key and permission_key = p_permission_key;
  end if;

  insert into audit_log (actor_id, actor, action, target, detail)
  values (
    auth.uid(),
    coalesce((select name from profiles where id = auth.uid()), 'super_admin'),
    case when p_granted then 'permission_granted' else 'permission_revoked' end,
    p_role_key,
    format('%s %s (was: %s)', p_permission_key, case when p_granted then 'granted' else 'revoked' end,
           case when v_had then 'present' else 'absent' end)
  );

  return jsonb_build_object('success', true, 'role', p_role_key,
                            'permission', p_permission_key, 'granted', p_granted);
end;
$$;
grant execute on function set_role_permission(text, text, boolean) to authenticated;

create or replace function create_role(
  p_key         text,
  p_name        text,
  p_description text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if get_my_role() <> 'super_admin' then
    raise exception 'Unauthorized: super_admin role required';
  end if;
  if p_key is null or p_key !~ '^[a-z][a-z0-9_]*$' then
    raise exception 'Role key must be lowercase snake_case';
  end if;

  insert into roles (key, name, description, is_system)
  values (p_key, coalesce(p_name, p_key), p_description, false)
  on conflict (key) do update set name = excluded.name, description = excluded.description, updated_at = now();

  insert into audit_log (actor_id, actor, action, target, detail)
  values (auth.uid(), coalesce((select name from profiles where id = auth.uid()), 'super_admin'),
          'role_created', p_key, coalesce(p_name, p_key));

  return jsonb_build_object('success', true, 'role', p_key);
end;
$$;
grant execute on function create_role(text, text, text) to authenticated;

create or replace function create_permission(
  p_module      text,
  p_action      text,
  p_description text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_key text;
begin
  if get_my_role() <> 'super_admin' then
    raise exception 'Unauthorized: super_admin role required';
  end if;
  if p_module !~ '^[a-z][a-z0-9_]*$' or p_action !~ '^[a-z][a-z0-9_]*$' then
    raise exception 'module and action must be lowercase snake_case';
  end if;
  v_key := p_module || '.' || p_action;

  insert into permissions (key, module, action, description, is_system)
  values (v_key, p_module, p_action, coalesce(p_description, initcap(p_action) || ' ' || initcap(p_module)), false)
  on conflict (key) do nothing;

  insert into audit_log (actor_id, actor, action, target, detail)
  values (auth.uid(), coalesce((select name from profiles where id = auth.uid()), 'super_admin'),
          'permission_created', v_key, coalesce(p_description, ''));

  return jsonb_build_object('success', true, 'permission', v_key);
end;
$$;
grant execute on function create_permission(text, text, text) to authenticated;

-- ── 9. RLS — read for admins; writes ONLY via the RPCs above ─────
alter table permissions      enable row level security;
alter table roles            enable row level security;
alter table role_permissions enable row level security;

-- Catalog is readable by any authenticated admin (super_admin or admin).
drop policy if exists "permissions_admin_read" on permissions;
create policy "permissions_admin_read" on permissions for select using (is_admin());

drop policy if exists "roles_read" on roles;
create policy "roles_read" on roles for select using (is_admin());

drop policy if exists "role_permissions_admin_read" on role_permissions;
create policy "role_permissions_admin_read" on role_permissions for select using (is_admin());
-- No INSERT/UPDATE/DELETE policies → all client writes denied; the
-- security-definer RPCs above (owned by postgres) are the only writers.

insert into audit_log (actor_id, actor, action, target, detail)
values (
  null, 'system', 'security_migration', 'rbac',
  'migration_021: dynamic RBAC — permissions/roles/role_permissions tables, has_permission()/current_user_permissions(), super-admin-only audited management RPCs (set_role_permission/create_role/create_permission); writes locked to RPCs via RLS'
);
