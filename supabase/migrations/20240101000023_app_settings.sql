-- ═══════════════════════════════════════════════════════════════
-- Migration 023: Application Settings (typed, grouped, audited)
--
-- Upgrades the existing platform_config key-value store into a real
-- settings system the admin panel can drive without code:
--   • metadata columns (group, data_type, label, is_public, sort_order)
--     so the UI renders the form dynamically — NO hardcoded schema.
--   • get_public_settings() / get_setting() — typed/public reads the app
--     can use (banner, branding, maintenance) without admin access.
--   • set_setting() — the single audited + validated write path, gated
--     by the dynamic RBAC permission 'settings.update'.
--   • Existing upsert_platform_config(_bulk) re-gated to settings.update
--     and now audit-logged (previously unaudited).
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Metadata columns (additive, safe on existing rows) ───────
alter table platform_config
  add column if not exists group_name text    not null default 'general',
  add column if not exists data_type  text    not null default 'string',
  add column if not exists label      text,
  add column if not exists is_public  boolean not null default false,
  add column if not exists sort_order integer not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'platform_config_data_type_chk') then
    alter table platform_config
      add constraint platform_config_data_type_chk
      check (data_type in ('string','text','number','boolean','color','url','json'));
  end if;
end $$;

-- ── 2. Catalog: seed new settings + backfill metadata on existing ──
-- One upsert: new keys are inserted with a default value; EXISTING keys
-- keep their stored value (do-update only touches metadata columns).
insert into platform_config (key, value, description, group_name, data_type, label, is_public, sort_order) values
  -- Branding (public)
  ('platform_name',          'SETU',                       'Public platform name',          'branding', 'string',  'Platform Name',        true,  1),
  ('platform_tagline',       'Rural Commerce OS',          'Tagline shown on login/landing','branding', 'string',  'Tagline',              true,  2),
  ('logo_url',               '',                           'Logo image URL',                'branding', 'url',     'Logo URL',             true,  3),
  ('app_icon_url',           '',                           'App icon URL',                  'branding', 'url',     'App Icon URL',         true,  4),
  ('primary_color',          '#C2410C',                    'Primary brand colour',          'branding', 'color',   'Primary Color',        true,  5),
  ('secondary_color',        '#0F766E',                    'Secondary brand colour',        'branding', 'color',   'Secondary Color',      true,  6),
  -- Support / contact (public)
  ('support_email',          'support@setu.example',       'Support email',                 'support',  'string',  'Support Email',        true,  10),
  ('support_phone',          '1800-000-0000',              'Support phone',                 'support',  'string',  'Support Phone',        true,  11),
  ('support_whatsapp',       '',                           'Support WhatsApp number',       'support',  'string',  'Support WhatsApp',     true,  12),
  -- Social (public)
  ('social_facebook',        '',                           'Facebook URL',                  'social',   'url',     'Facebook',             true,  20),
  ('social_instagram',       '',                           'Instagram URL',                 'social',   'url',     'Instagram',            true,  21),
  ('social_twitter',         '',                           'Twitter/X URL',                 'social',   'url',     'Twitter / X',          true,  22),
  -- Legal/content links (public)
  ('privacy_policy_url',     '',                           'Privacy policy URL',            'content',  'url',     'Privacy Policy URL',   true,  30),
  ('terms_url',              '',                           'Terms of service URL',          'content',  'url',     'Terms URL',            true,  31),
  -- Registration / auth (public toggles)
  ('new_registrations_enabled','true',                     'Allow new sign-ups',            'auth',     'boolean', 'New Registrations',    true,  40),
  ('otp_enabled',            'true',                       'Phone OTP login enabled',       'auth',     'boolean', 'OTP Login',            true,  41),
  ('email_verification_required','false',                  'Require email verification',    'auth',     'boolean', 'Email Verification',   false, 42),
  ('kyc_required_vendor',    'true',                       'Require KYC for vendors',       'auth',     'boolean', 'Vendor KYC Required',  false, 43),
  -- Maintenance (public)
  ('maintenance_mode',       'false',                      'Show maintenance screen to users','flags',  'boolean', 'Maintenance Mode',     true,  50),
  ('maintenance_message',    'We will be back shortly.',   'Maintenance banner message',    'flags',    'text',    'Maintenance Message',  true,  51),
  -- Fees / limits (admin-only; the order RPCs read these via get_fee_config)
  ('platform_commission_pct','1',                          'Platform fee % of order',       'fees',     'number',  'Platform Commission %',false, 60),
  ('delivery_fee_default',   '20',                          'Flat delivery fee (₹)',        'fees',     'number',  'Delivery Fee (₹)',     false, 61),
  ('delivery_fee_free_above','200',                         'Free delivery threshold (₹)',  'fees',     'number',  'Free Delivery Above ₹',false, 62),
  ('rider_earning_per_delivery','80',                       'Rider earning per delivery ₹', 'fees',     'number',  'Rider Earning ₹',      false, 63),
  ('credit_discount_pct',    '10',                          'SETU Credit discount %',       'fees',     'number',  'Credit Discount %',    false, 64),
  ('credit_discount_max',    '500',                         'Max credit discount ₹',        'fees',     'number',  'Max Credit Discount ₹',false, 65),
  ('default_credit_limit',   '500',                         'Starting credit limit ₹',      'limits',   'number',  'Default Credit Limit ₹',false,70),
  ('max_cod_balance_rider',  '1000',                        'Max rider COD balance ₹',      'limits',   'number',  'Max Rider COD ₹',      false, 71),
  ('wallet_max_balance',     '50000',                       'Max wallet balance ₹',         'limits',   'number',  'Max Wallet Balance ₹', false, 72),
  ('order_cancel_window_min','10',                          'Order cancel window (min)',    'limits',   'number',  'Cancel Window (min)',  false, 73)
on conflict (key) do update set
  group_name = excluded.group_name,
  data_type  = excluded.data_type,
  label      = excluded.label,
  is_public  = excluded.is_public,
  sort_order = excluded.sort_order,
  description = coalesce(platform_config.description, excluded.description);
  -- NOTE: value is intentionally NOT updated here — existing values are preserved.

-- ── 3. Public / typed reads ─────────────────────────────────────
-- Non-sensitive settings the app needs (branding, maintenance, public
-- toggles). security definer so anon/login screens can read them.
create or replace function get_public_settings()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
  from platform_config
  where is_public = true;
$$;
grant execute on function get_public_settings() to anon, authenticated, service_role;

-- Single setting read — public keys to anyone, everything to admins.
create or replace function get_setting(p_key text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select value from platform_config
  where key = p_key and (is_public = true or is_admin());
$$;
grant execute on function get_setting(text) to anon, authenticated, service_role;

-- ── 4. Validated + audited single write (settings.update) ───────
create or replace function set_setting(p_key text, p_value text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type text;
  v_old  text;
begin
  if not has_permission('settings.update') then
    raise exception 'Unauthorized: settings.update required';
  end if;

  select data_type, value into v_type, v_old from platform_config where key = p_key;
  if not found then raise exception 'Unknown setting: %', p_key; end if;

  -- Type validation (server-side; never trust the client).
  if v_type = 'number'  and p_value !~ '^-?\d+(\.\d+)?$' then
    raise exception 'Setting % must be a number', p_key;
  elsif v_type = 'boolean' and p_value not in ('true','false') then
    raise exception 'Setting % must be true or false', p_key;
  elsif v_type = 'color' and p_value !~ '^#[0-9a-fA-F]{6}$' then
    raise exception 'Setting % must be a hex colour (#RRGGBB)', p_key;
  elsif v_type = 'url' and p_value <> '' and p_value !~ '^https?://' then
    raise exception 'Setting % must be a URL', p_key;
  elsif v_type = 'json' then
    begin perform p_value::jsonb; exception when others then raise exception 'Setting % must be valid JSON', p_key; end;
  end if;

  update platform_config
     set value = p_value, updated_by = auth.uid(), updated_at = now()
   where key = p_key;

  insert into audit_log (actor_id, actor, action, target, detail)
  values (auth.uid(), coalesce((select name from profiles where id = auth.uid()), 'admin'),
          'setting_updated', p_key, format('%s: %s → %s', p_key, coalesce(v_old,'∅'), p_value));

  return jsonb_build_object('success', true, 'key', p_key, 'value', p_value);
end;
$$;
grant execute on function set_setting(text, text) to authenticated;

-- ── 5. Re-gate + audit the legacy upsert functions ─────────────
-- Previously gated by is_admin() with NO audit. Now: settings.update +
-- audit, so every settings write (whatever path) is governed and logged.
create or replace function upsert_platform_config(
  p_key         text,
  p_value       text,
  p_description text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_old text;
begin
  if not has_permission('settings.update') then
    raise exception 'Unauthorized: settings.update required';
  end if;
  select value into v_old from platform_config where key = p_key;

  insert into platform_config (key, value, description, updated_by, updated_at)
  values (p_key, p_value, coalesce(p_description, ''), auth.uid(), now())
  on conflict (key) do update
    set value = excluded.value, updated_by = auth.uid(), updated_at = now();

  insert into audit_log (actor_id, actor, action, target, detail)
  values (auth.uid(), coalesce((select name from profiles where id = auth.uid()), 'admin'),
          'setting_updated', p_key, format('%s: %s → %s', p_key, coalesce(v_old,'∅'), p_value));
end;
$$;

create or replace function upsert_platform_config_bulk(p_entries jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare entry jsonb;
begin
  if not has_permission('settings.update') then
    raise exception 'Unauthorized: settings.update required';
  end if;
  for entry in select * from jsonb_array_elements(p_entries)
  loop
    perform upsert_platform_config(entry->>'key', entry->>'value', null);
  end loop;
end;
$$;

-- ── 6. Lock direct table writes — all writes go through audited RPCs ──
-- The legacy config_admin_write policy (migration 010) let admins UPDATE
-- platform_config directly, bypassing audit logging. Drop it so the
-- audited set_setting/upsert_platform_config RPCs are the ONLY writers.
drop policy if exists "config_admin_write" on platform_config;

insert into audit_log (actor_id, actor, action, target, detail)
values (
  null, 'system', 'ops_migration', 'platform_config',
  'migration_023: app settings — typed/grouped metadata, get_public_settings/get_setting reads, validated+audited set_setting (settings.update), re-gated+audited upsert_platform_config(_bulk)'
);
