-- ═══════════════════════════════════════════════════════════════
-- Migration 105 — AUDIT REMEDIATION: FCM token single-owner (N-01)
--
-- profiles.fcm_token had no uniqueness and was never cleared on logout.
-- When user A logs out of a shared / handed-over device and user B logs in,
-- B's registration writes the same device token onto B's row while A's row
-- keeps it — A's order / wallet / credit pushes then keep landing on B's
-- device (cross-user information disclosure).
--
-- FIX
--   • BEFORE INSERT/UPDATE trigger: a device token can belong to exactly one
--     profile; claiming it clears it from every other profile. SECURITY
--     DEFINER because RLS (rightly) stops one user touching another's row.
--   • One-time cleanup: where a token is currently on several profiles, keep
--     only the most recently updated one. Tokens re-register on next launch.
--   • The client additionally clears the token on sign-out (AuthContext).
-- Idempotent.
-- ═══════════════════════════════════════════════════════════════

create or replace function profiles_fcm_token_single_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.fcm_token is not null
     and new.fcm_token <> ''
     and (tg_op = 'INSERT' or new.fcm_token is distinct from old.fcm_token) then
    update profiles
       set fcm_token = null
     where fcm_token = new.fcm_token
       and id <> new.id;
  end if;
  return new;
end;
$$;

revoke execute on function profiles_fcm_token_single_owner() from public, anon, authenticated;

drop trigger if exists trg_profiles_fcm_token_single_owner on profiles;
create trigger trg_profiles_fcm_token_single_owner
  before insert or update of fcm_token on profiles
  for each row execute function profiles_fcm_token_single_owner();

-- One-time cleanup of tokens already shared across profiles (keep newest owner).
update profiles p
   set fcm_token = null
 where p.fcm_token is not null
   and p.fcm_token <> ''
   and exists (
     select 1 from profiles q
      where q.fcm_token = p.fcm_token
        and q.id <> p.id
        and (q.updated_at, q.id::text) > (p.updated_at, p.id::text)
   );

insert into audit_log (actor_id, actor, action, target, detail)
values (
  null, 'system', 'security_migration', 'fcm_token_single_owner_105',
  'migration_105: FCM device tokens are now single-owner (trigger) and de-duplicated, so a previous user no longer receives pushes on a device another user logged into.'
);
