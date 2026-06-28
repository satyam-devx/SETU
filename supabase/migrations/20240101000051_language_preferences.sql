-- ═══════════════════════════════════════════════════════════════
-- Migration 051: Language & Voice preference columns on profiles
--
-- Adds per-user language preference fields so the Language & Voice
-- settings screen can persist all toggles to the database:
--
--   language          — already existed (hi / mai / bh / en)
--   voice_readout     — read prices & notifications aloud (TTS)
--   hindi_numerals    — show prices/counts in Devanagari digits
--   sms_lang          — send SMS order-updates in user's language
--   whatsapp_lang     — send WhatsApp messages in user's language
--   auto_translate    — auto-translate vendor names to preferred script
-- ═══════════════════════════════════════════════════════════════

alter table profiles
  add column if not exists voice_readout   boolean not null default true,
  add column if not exists hindi_numerals  boolean not null default false,
  add column if not exists sms_lang        boolean not null default true,
  add column if not exists whatsapp_lang   boolean not null default true,
  add column if not exists auto_translate  boolean not null default false;

-- RLS: users can update their own preference columns.
-- The existing profiles RLS already allows owners to SELECT/UPDATE
-- their own row, so no new policies are needed — the columns are
-- covered by the existing "profiles_own_update" policy.

insert into audit_log (actor_id, actor, action, target, target_type, detail)
values (
  null, 'system', 'schema_migration', 'profiles', 'table',
  'migration_051: added voice_readout, hindi_numerals, sms_lang, whatsapp_lang, auto_translate columns for Language & Voice settings screen'
);
