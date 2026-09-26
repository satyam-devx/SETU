-- ═══════════════════════════════════════════════════════════════
-- Migration 102: fix infinite-recursion bug in profiles_own_update
--
-- PROBLEM
-- profiles_own_update's WITH CHECK (introduced 013, extended by 014,
-- last redefined by 025) pins immutable/admin-only columns by
-- comparing the proposed NEW value against the row's CURRENT value
-- via a raw subquery on `profiles` itself, e.g.:
--     role = (select role from profiles where id = auth.uid())
-- (and five more of the same shape, for is_verified / setu_score /
-- aadhaar_verified / is_banned / village_id).
--
-- Evaluating that subquery for role `authenticated` (not exempt from
-- RLS) requires Postgres to apply profiles' own row-security to the
-- subquery's access to `profiles` -- i.e. profiles_own_update needs
-- itself evaluated in order to evaluate itself. Postgres detects this
-- and raises "infinite recursion detected in policy for relation
-- \"profiles\"". This is NOT scoped to privilege-escalation attempts —
-- it fires on EVERY self-update to a profile by a non-superuser
-- session, including completely benign edits (name, phone,
-- avatar_url, language preference, etc.).
--
-- Caught by qa/sql/rls_permission_guards_test.sql (T3: a customer
-- attempting to set their own role='admin'), but this is a live
-- production bug: any customer/vendor/rider editing their own profile
-- from the app hits this same "infinite recursion" error, not just
-- the escalation attempt the test makes on purpose.
--
-- FIX
-- Replace every raw `profiles`-querying subquery in the WITH CHECK
-- with a call to a new SECURITY DEFINER helper, get_my_profile(),
-- which reads the caller's own row bypassing RLS entirely -- the same
-- pattern already used by get_my_role() / is_admin() /
-- get_my_village_id() everywhere else in this schema (migration 063).
-- Same columns pinned, same semantics, no self-reference.
-- ═══════════════════════════════════════════════════════════════

create or replace function get_my_profile()
returns profiles
language sql
stable
security definer
set search_path = public
as $$
  select * from profiles where id = auth.uid()
$$;

drop policy if exists "profiles_own_update" on profiles;
create policy "profiles_own_update"
  on profiles for update
  using     (auth.uid() = id)
  with check (
    auth.uid() = id
    and role             = (select role             from get_my_profile())
    and is_verified      = (select is_verified      from get_my_profile())
    and setu_score       = (select setu_score       from get_my_profile())
    and aadhaar_verified = (select aadhaar_verified from get_my_profile())
    and is_banned        = (select is_banned        from get_my_profile())
    and (
      village_id = (select village_id from get_my_profile())
      or (select village_id from get_my_profile()) is null
    )
  );

insert into audit_log (actor_id, actor, action, target, detail)
values (
  null, 'system', 'security_migration', 'profiles_rls',
  'migration_102: fixed "infinite recursion detected in policy for relation profiles" on profiles_own_update -- its WITH CHECK compared proposed values against a raw self-querying subquery on profiles, which recurses under RLS for role authenticated on every self-update, not just escalation attempts. Replaced with get_my_profile(), a SECURITY DEFINER helper matching the existing get_my_role()/is_admin()/get_my_village_id() pattern.'
);
