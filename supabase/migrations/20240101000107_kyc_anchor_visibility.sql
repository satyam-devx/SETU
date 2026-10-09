-- ═══════════════════════════════════════════════════════════════
-- Migration 107 — AUDIT REMEDIATION: anchors could never see KYC rows (K-04)
--
-- The anchor read policy from migration 014 (and the reviewer policy added in
-- 104) decide "is this user in my village?" with
--     exists (select 1 from profiles target where target.id = kyc_records.user_id ...)
-- That subquery runs under the CALLER's row-level security, and `profiles` has
-- no policy letting an anchor read other users' rows (only own / admin /
-- active-order rider). It therefore always returned no rows: anchors could not
-- see — let alone review — any KYC record, in production as in CI. Found
-- because audit_remediation_test.sql D4 (same-village anchor reviews) failed
-- on a real Postgres.
--
-- FIX
--   • anchor_manages_user(uuid): SECURITY DEFINER predicate (village match,
--     caller must be an anchor with a village). It exposes nothing but a boolean
--     about the caller's own authority.
--   • Recreate kyc_records_anchor_read / kyc_records_reviewer_update on it,
--     scoped `to authenticated`.
--   • get_village_kyc_queue(): the anchor screen's data source — KYC rows for
--     the caller's village with the owner's name/role (the client-side join to
--     `profiles` returned null names for anchors for the same reason). No phone
--     numbers or other profile fields are exposed.
-- Idempotent. Migration 104 (already applied) is left untouched.
-- ═══════════════════════════════════════════════════════════════

create or replace function anchor_manages_user(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from profiles me
      join profiles target on target.id = p_user_id
     where me.id = auth.uid()
       and me.role = 'anchor'
       and me.village_id is not null
       and target.village_id = me.village_id
  )
$$;

revoke execute on function anchor_manages_user(uuid) from public, anon;
grant  execute on function anchor_manages_user(uuid) to authenticated;

drop policy if exists "kyc_records_anchor_read" on kyc_records;
create policy "kyc_records_anchor_read"
  on kyc_records for select
  to authenticated
  using (
    get_my_role() in ('admin', 'super_admin')
    or anchor_manages_user(user_id)
  );

drop policy if exists "kyc_records_reviewer_update" on kyc_records;
create policy "kyc_records_reviewer_update"
  on kyc_records for update
  to authenticated
  using (
    user_id <> auth.uid()
    and (get_my_role() in ('admin', 'super_admin') or anchor_manages_user(user_id))
  )
  with check (
    user_id <> auth.uid()
    and (get_my_role() in ('admin', 'super_admin') or anchor_manages_user(user_id))
  );

create or replace function get_village_kyc_queue()
returns table (
  id             uuid,
  user_id        uuid,
  type           text,
  status         text,
  doc_url        text,
  failure_reason text,
  created_at     timestamptz,
  updated_at     timestamptz,
  user_name      text,
  user_role      text,
  village_id     text
)
language sql
stable
security definer
set search_path = public
as $$
  select k.id, k.user_id, k.type, k.status, k.doc_url, k.failure_reason,
         k.created_at, k.updated_at, p.name, p.role, p.village_id
    from kyc_records k
    join profiles p on p.id = k.user_id
   where p.village_id is not null
     and p.village_id = (select me.village_id from profiles me where me.id = auth.uid() and me.role = 'anchor')
   order by k.created_at desc
$$;

revoke execute on function get_village_kyc_queue() from public, anon;
grant  execute on function get_village_kyc_queue() to authenticated;

insert into audit_log (actor_id, actor, action, target, detail)
values (
  null, 'system', 'security_migration', 'kyc_anchor_visibility_107',
  'migration_107: anchors can now read/review KYC records of their own village only (SECURITY DEFINER anchor_manages_user + get_village_kyc_queue); the previous profiles-subquery policies always evaluated to no rows under RLS.'
);
