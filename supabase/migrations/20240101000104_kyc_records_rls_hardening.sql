-- ═══════════════════════════════════════════════════════════════
-- Migration 104 — AUDIT REMEDIATION: kyc_records authorization
--
--  K-01 [HIGH] kyc_records_own_insert / kyc_records_own_update (migration
--       001) only check `user_id = auth.uid()`. Any user — customer,
--       vendor, rider, seva provider — could therefore write
--         update kyc_records set status='verified', verified_at=now()
--       on their OWN row, self-approving their identity documents and
--       hiding themselves from the reviewers' 'submitted' queue.
--
--  K-02 [HIGH — broken wiring] No policy has ever allowed an anchor or
--       admin to UPDATE kyc_records (only SELECT). The review actions in
--       src/lib/api.js (approveKycRecord / rejectKycRecord / reviewKYC)
--       are plain client-side UPDATEs, so under RLS they match 0 rows
--       and `.single()` errors: KYC review could not have worked.
--
-- FIX
--   • Users may only create/modify their own record while it is not yet
--     verified, and only to a 'pending' / 'submitted' state with no
--     verified_at. Verified records become immutable to their owner.
--   • Admins/super-admins, and anchors for users of their own village,
--     may review (update) records — never their own.
--   • Service role (edge functions: verify-aadhaar) bypasses RLS as before.
--
-- Product note: a user whose record is already 'verified' can no longer
-- re-upload over it (the upsert is refused by RLS). Reviewers can reset a
-- record to 'pending'/'rejected' to allow a fresh submission.
--
-- Idempotent (drop policy if exists / create).
-- ═══════════════════════════════════════════════════════════════

drop policy if exists "kyc_records_own_insert" on kyc_records;
create policy "kyc_records_own_insert"
  on kyc_records for insert
  with check (
    user_id = auth.uid()
    and status in ('pending', 'submitted')
    and verified_at is null
  );

drop policy if exists "kyc_records_own_update" on kyc_records;
create policy "kyc_records_own_update"
  on kyc_records for update
  using (
    user_id = auth.uid()
    and status in ('pending', 'submitted', 'rejected')
  )
  with check (
    user_id = auth.uid()
    and status in ('pending', 'submitted')
    and verified_at is null
  );

drop policy if exists "kyc_records_reviewer_update" on kyc_records;
create policy "kyc_records_reviewer_update"
  on kyc_records for update
  using (
    user_id <> auth.uid()
    and (
      get_my_role() in ('admin', 'super_admin')
      or (
        get_my_role() = 'anchor'
        and exists (
          select 1 from profiles target
          where target.id = kyc_records.user_id
            and target.village_id is not null
            and target.village_id = get_my_village_id()
        )
      )
    )
  )
  with check (
    user_id <> auth.uid()
    and (
      get_my_role() in ('admin', 'super_admin')
      or (
        get_my_role() = 'anchor'
        and exists (
          select 1 from profiles target
          where target.id = kyc_records.user_id
            and target.village_id is not null
            and target.village_id = get_my_village_id()
        )
      )
    )
  );

insert into audit_log (actor_id, actor, action, target, detail)
values (
  null, 'system', 'security_migration', 'kyc_records_rls_104',
  'migration_104: kyc_records — owners can no longer self-set status=verified/verified_at (insert/update policies tightened); added reviewer update policy for admin/super_admin and same-village anchors (never on their own record).'
);
