-- ═══════════════════════════════════════════════════════════════
-- Migration 065 (PASS 9 — Parts 4-12): missing profiles FKs behind
-- 6 Admin panel "Could not find a relationship" errors
--
-- ROOT CAUSE (identical for every affected screen except Vendor
-- Approvals -- confirmed live against pg_constraint before writing
-- this migration, not assumed)
-- audit_log.actor_id, disputes.reporter_id, image_moderation.
-- uploaded_by, kyc_records.user_id, and support_tickets.user_id are
-- all foreign keys to auth.users(id), NOT to public.profiles(id).
-- PostgREST infers embeddable relationships strictly from actual FK
-- constraints -- it cannot traverse "table -> auth.users -> profiles"
-- as one hop, and auth.users is not exposed via the API regardless.
-- The frontend queries (src/lib/api.js: getAuditLog, getAdminDisputes,
-- getImageModerationQueue, getKYCQueue, getAdminSupportTickets) all
-- correctly ask PostgREST to embed `profiles` via these exact
-- columns/constraint names -- the queries were never wrong, the
-- schema was simply missing the FK path they depend on. This is
-- category (A) from the investigation checklist: a missing FK
-- relative to what the application requires, not a stale PostgREST
-- cache, not ambiguous FKs, not an RLS issue.
--
-- profiles.id IS auth.users.id by construction (every profile is
-- created 1:1 with an auth.users row). Adding a second, direct FK
-- from each of these columns to profiles(id) is the CORRECT,
-- real relationship the application already assumes -- not a
-- fabricated one. A column may legitimately carry more than one
-- foreign key to different tables in Postgres; both remain enforced.
--
-- CONSTRAINT-NAME COLLISION HANDLING
-- getAdminDisputes() and getAdminSupportTickets() use PostgREST's
-- explicit-constraint-name hint syntax (profiles!disputes_reporter_id_fkey,
-- profiles!support_tickets_user_id_fkey) rather than the column-name
-- hint syntax. Those exact constraint names are already taken by the
-- existing auth.users FKs, so for these two specifically: the
-- existing auth.users constraint is renamed (preserved, not dropped
-- or weakened) and the new profiles-pointing constraint takes over
-- the original name the frontend already expects -- avoiding any
-- frontend query change. audit_log, image_moderation, and kyc_records
-- use the column-name hint form (profiles!actor_id etc.), which
-- resolves by column regardless of constraint name, so a new,
-- distinctly-named constraint is sufficient for those three.
--
-- vendors <-> kyc_records (Vendor Approvals) is NOT fixed here.
-- kyc_records has no vendor_id column -- a KYC record belongs to a
-- user, not a vendor; a vendor's owner happens to be that user. There
-- is no direct FK path between these two tables, and adding one
-- (e.g. a fabricated kyc_records.vendor_id) would misrepresent the
-- actual data model purely to satisfy PostgREST, which is explicitly
-- out of scope. This is fixed at the frontend query level instead
-- (see the accompanying source change to getPendingVendors()).
-- ═══════════════════════════════════════════════════════════════

-- audit_log.actor_id -> profiles(id) [column-hint syntax: profiles!actor_id]
alter table audit_log
  add constraint audit_log_actor_id_profiles_fkey
  foreign key (actor_id) references profiles(id) on delete set null;

-- image_moderation.uploaded_by -> profiles(id) [profiles!uploaded_by]
alter table image_moderation
  add constraint image_moderation_uploaded_by_profiles_fkey
  foreign key (uploaded_by) references profiles(id) on delete set null;

-- kyc_records.user_id -> profiles(id) [profiles!user_id]
alter table kyc_records
  add constraint kyc_records_user_id_profiles_fkey
  foreign key (user_id) references profiles(id) on delete cascade;

-- disputes.reporter_id -> profiles(id), reusing the exact constraint
-- name the frontend hint expects (profiles!disputes_reporter_id_fkey).
alter table disputes
  rename constraint disputes_reporter_id_fkey to disputes_reporter_id_authusers_fkey;
alter table disputes
  add constraint disputes_reporter_id_fkey
  foreign key (reporter_id) references profiles(id) on delete cascade;

-- support_tickets.user_id -> profiles(id), reusing the exact
-- constraint name the frontend hint expects
-- (profiles!support_tickets_user_id_fkey).
alter table support_tickets
  rename constraint support_tickets_user_id_fkey to support_tickets_user_id_authusers_fkey;
alter table support_tickets
  add constraint support_tickets_user_id_fkey
  foreign key (user_id) references profiles(id) on delete set null;

insert into audit_log (actor_id, actor, action, target, detail)
values (
  null, 'system', 'security_migration', 'audit_log,disputes,image_moderation,kyc_records,support_tickets',
  'migration_065 (PASS 9 Parts 4-12): added direct foreign keys to public.profiles(id) for audit_log.actor_id, disputes.reporter_id, image_moderation.uploaded_by, kyc_records.user_id, and support_tickets.user_id -- all previously only had a FK to auth.users(id), which PostgREST cannot traverse to satisfy the frontend''s profiles-embed queries. Existing auth.users FKs on disputes.reporter_id and support_tickets.user_id were renamed (preserved) so the new profiles FK could take the exact constraint name the frontend''s explicit-hint queries already reference, avoiding any frontend change for those two. vendors<->kyc_records (Vendor Approvals) intentionally not touched here -- no real FK path exists (kyc_records belongs to a user, not a vendor); fixed at the query level instead.'
);
