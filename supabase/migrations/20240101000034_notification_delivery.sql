-- ═══════════════════════════════════════════════════════════════
-- Migration 034: Multi-channel notification delivery
--
-- Closes the SMS / Email / WhatsApp gap with a REAL, provider-agnostic
-- delivery pipeline (no faked sends):
--   • notification_campaigns now accepts sms/email/whatsapp channels
--   • notification_deliveries — a durable per-recipient delivery queue
--   • _dispatch_campaign_internal enqueues deliveries for external
--     channels (resolving phone/email from the profile)
--   • claim_pending_deliveries / mark_delivery — the service-role
--     contract the dispatch-notifications Edge Function uses to send
--     via the configured provider (key supplied via env/secret —
--     operator configures provider from Settings; NO code change)
--   • channel enablement read from platform_config (sms_enabled, …)
--
-- Authorization: notifications.* via RBAC for reads/management; the
-- queue worker uses service_role. Every step is auditable.
-- ═══════════════════════════════════════════════════════════════

-- ── 0. Channel config (admin-editable, no code change) ──────────
insert into platform_config (key, value, description, group_name, data_type, label, is_public, sort_order) values
  ('sms_enabled',      'false', 'Enable SMS delivery channel',      'notifications', 'boolean', 'SMS Enabled',      false, 80),
  ('email_enabled',    'false', 'Enable Email delivery channel',    'notifications', 'boolean', 'Email Enabled',    false, 81),
  ('whatsapp_enabled', 'false', 'Enable WhatsApp delivery channel', 'notifications', 'boolean', 'WhatsApp Enabled', false, 82),
  ('sms_provider',      '',     'SMS provider id (e.g. twilio, msg91)',      'notifications', 'string', 'SMS Provider',      false, 83),
  ('email_provider',    '',     'Email provider id (e.g. resend, ses)',      'notifications', 'string', 'Email Provider',    false, 84),
  ('whatsapp_provider', '',     'WhatsApp provider id (e.g. twilio, gupshup)','notifications','string', 'WhatsApp Provider', false, 85)
on conflict (key) do update set
  group_name = excluded.group_name, data_type = excluded.data_type,
  label = excluded.label, is_public = excluded.is_public, sort_order = excluded.sort_order;

-- ── 1. Extend campaign channels ─────────────────────────────────
do $$
declare v_con text;
begin
  select conname into v_con from pg_constraint
   where conrelid = 'notification_campaigns'::regclass and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%channel%';
  if v_con is not null then
    execute format('alter table notification_campaigns drop constraint %I', v_con);
  end if;
end $$;
alter table notification_campaigns
  add constraint notification_campaigns_channel_chk
  check (channel in ('in_app','push','sms','email','whatsapp'));

-- ── 2. Delivery queue ───────────────────────────────────────────
create table if not exists notification_deliveries (
  id           uuid primary key default uuid_generate_v4(),
  campaign_id  uuid references notification_campaigns(id) on delete cascade,
  user_id      uuid references auth.users(id) on delete set null,
  channel      text not null check (channel in ('sms','email','whatsapp')),
  destination  text not null,                 -- phone or email
  title        text,
  body         text not null,
  status       text not null default 'pending'
                 check (status in ('pending','sending','sent','failed','skipped')),
  provider     text,
  provider_ref text,
  error        text,
  attempts     integer not null default 0,
  created_at   timestamptz not null default now(),
  sent_at      timestamptz
);
create index if not exists idx_notif_deliveries_status  on notification_deliveries(status, created_at) where status in ('pending','sending');
create index if not exists idx_notif_deliveries_campaign on notification_deliveries(campaign_id);
create index if not exists idx_notif_deliveries_created  on notification_deliveries(created_at desc);

alter table notification_deliveries enable row level security;
drop policy if exists "notif_deliveries_read" on notification_deliveries;
create policy "notif_deliveries_read" on notification_deliveries
  for select using (has_permission('notifications.view') or is_admin());
-- Writes via RPC / service_role only.

-- ── 3. Re-emit dispatch to enqueue external-channel deliveries ──
-- in_app  → notifications rows (as before)
-- push    → recipients returned for the FCM Edge Function (as before)
-- sms/email/whatsapp → notification_deliveries rows (picked up by the
--   dispatch-notifications worker). Recipients missing a destination
--   for the channel are recorded as 'skipped' (honest, not silently lost).
create or replace function _dispatch_campaign_internal(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c        notification_campaigns%rowtype;
  v_ids    uuid[];
  v_count  integer;
  v_queued integer := 0;
  v_skipped integer := 0;
begin
  select * into c from notification_campaigns where id = p_id;
  if not found then
    return jsonb_build_object('success', false, 'error', 'Campaign not found');
  end if;
  if c.status not in ('draft', 'scheduled', 'sending') then
    return jsonb_build_object('success', true, 'skipped', true, 'status', c.status);
  end if;

  update notification_campaigns set status = 'sending', updated_at = now() where id = p_id;

  select array_agg(uid) into v_ids
  from (select uid from resolve_campaign_audience(c.audience) as uid limit 5000) t;
  v_count := coalesce(array_length(v_ids, 1), 0);

  if c.channel = 'in_app' then
    if v_count > 0 then
      insert into notifications (user_id, type, title, body, data)
      select uid, c.notif_type, c.title, c.body, c.data from unnest(v_ids) as uid;
    end if;

  elsif c.channel in ('sms','email','whatsapp') and v_count > 0 then
    -- destination = email for email channel, phone otherwise.
    insert into notification_deliveries (campaign_id, user_id, channel, destination, title, body, status)
    select c.id, p.id, c.channel,
           case when c.channel = 'email'
                then coalesce(nullif(au.email, ''), '')
                else coalesce(p.phone, '') end,
           c.title, c.body,
           case when c.channel = 'email'
                then case when coalesce(nullif(au.email,''),'') = '' then 'skipped' else 'pending' end
                else case when coalesce(p.phone,'') = '' then 'skipped' else 'pending' end
           end
    from profiles p
    join auth.users au on au.id = p.id
    where p.id = any(v_ids);

    select count(*) filter (where status='pending'),
           count(*) filter (where status='skipped')
      into v_queued, v_skipped
    from notification_deliveries where campaign_id = c.id;
  end if;

  update notification_campaigns
     set status = 'sent', sent_at = now(),
         targeted_count = v_count,
         sent_count = case when c.channel = 'in_app' then v_count else v_queued end,
         failed_count = v_skipped,
         updated_at = now()
   where id = p_id;

  return jsonb_build_object(
    'success', true, 'campaign_id', p_id, 'channel', c.channel,
    'title', c.title, 'body', c.body, 'type', c.notif_type,
    'targeted', v_count, 'queued', v_queued, 'skipped', v_skipped,
    'recipients', coalesce(to_jsonb(v_ids), '[]'::jsonb)
  );
end;
$$;
revoke execute on function _dispatch_campaign_internal(uuid) from authenticated, anon;

-- ── 4. Re-emit create_campaign to allow the new channels ────────
create or replace function create_campaign(
  p_name         text,
  p_channel      text,
  p_title        text,
  p_body         text,
  p_notif_type   text    default 'system',
  p_audience     jsonb   default '{}'::jsonb,
  p_scheduled_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id     uuid;
  v_status text;
  v_count  integer;
begin
  if not has_permission('notifications.create') then
    raise exception 'Unauthorized: notifications.create required';
  end if;
  if p_channel not in ('in_app','push','sms','email','whatsapp') then
    raise exception 'Unsupported channel: %', p_channel;
  end if;
  -- External channels must be enabled in settings before use.
  if p_channel = 'sms'      and coalesce((select value from platform_config where key='sms_enabled'),'false') <> 'true'      then raise exception 'SMS channel is disabled in Settings'; end if;
  if p_channel = 'email'    and coalesce((select value from platform_config where key='email_enabled'),'false') <> 'true'    then raise exception 'Email channel is disabled in Settings'; end if;
  if p_channel = 'whatsapp' and coalesce((select value from platform_config where key='whatsapp_enabled'),'false') <> 'true' then raise exception 'WhatsApp channel is disabled in Settings'; end if;

  if coalesce(trim(p_title),'') = '' or coalesce(trim(p_body),'') = '' then
    raise exception 'Title and body are required';
  end if;
  if p_scheduled_at is not null and p_scheduled_at > now() then
    if p_channel <> 'in_app' then
      raise exception 'Only in_app campaigns can be scheduled; send other channels immediately';
    end if;
    v_status := 'scheduled';
  else
    v_status := 'draft';
  end if;

  v_count := (select count(*)::int from resolve_campaign_audience(p_audience));

  insert into notification_campaigns (name, channel, notif_type, title, body, audience, status, scheduled_at, targeted_count, created_by)
  values (p_name, p_channel, coalesce(p_notif_type,'system'), p_title, p_body, coalesce(p_audience,'{}'::jsonb), v_status,
          case when v_status = 'scheduled' then p_scheduled_at else null end, v_count, auth.uid())
  returning id into v_id;

  insert into audit_log (actor_id, actor, action, target, detail)
  values (auth.uid(), coalesce((select name from profiles where id = auth.uid()), 'admin'),
          'campaign_created', v_id::text,
          format('%s/%s "%s" → %s recipients (%s)', p_channel, p_notif_type, p_name, v_count, v_status));

  return jsonb_build_object('success', true, 'id', v_id, 'status', v_status, 'targeted', v_count);
end;
$$;
grant execute on function create_campaign(text, text, text, text, text, jsonb, timestamptz) to authenticated;

-- ── 5. Worker contract (service_role) ───────────────────────────
-- The dispatch-notifications Edge Function claims a batch, sends each
-- via the configured provider, then marks the result. SECURITY DEFINER
-- + explicit service_role check so only the trusted worker can drain.
create or replace function claim_pending_deliveries(p_limit integer default 50)
returns setof notification_deliveries
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'Unauthorized: service_role required';
  end if;
  return query
    update notification_deliveries d
       set status = 'sending', attempts = attempts + 1
     where d.id in (
       select id from notification_deliveries
        where status = 'pending'
        order by created_at
        limit greatest(1, least(p_limit, 200))
        for update skip locked
     )
    returning d.*;
end;
$$;
grant execute on function claim_pending_deliveries(integer) to service_role;

create or replace function mark_delivery(p_id uuid, p_status text, p_provider text default null, p_provider_ref text default null, p_error text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'Unauthorized: service_role required';
  end if;
  if p_status not in ('sent','failed') then raise exception 'status must be sent or failed'; end if;
  update notification_deliveries
     set status = p_status, provider = coalesce(p_provider, provider),
         provider_ref = coalesce(p_provider_ref, provider_ref),
         error = p_error, sent_at = case when p_status = 'sent' then now() else sent_at end
   where id = p_id;
end;
$$;
grant execute on function mark_delivery(uuid, text, text, text, text) to service_role;

-- ── 6. Delivery stats for the panel (notifications.view) ────────
create or replace function get_delivery_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (has_permission('notifications.view') or is_admin()) then
    raise exception 'Unauthorized: notifications.view required';
  end if;
  return jsonb_build_object(
    'pending', (select count(*) from notification_deliveries where status='pending'),
    'sending', (select count(*) from notification_deliveries where status='sending'),
    'sent',    (select count(*) from notification_deliveries where status='sent'),
    'failed',  (select count(*) from notification_deliveries where status='failed'),
    'skipped', (select count(*) from notification_deliveries where status='skipped'),
    'by_channel', (
      select coalesce(jsonb_object_agg(channel, n), '{}'::jsonb)
      from (select channel, count(*) n from notification_deliveries group by channel) t
    ),
    'as_of', now()
  );
end;
$$;
grant execute on function get_delivery_stats() to authenticated;

insert into audit_log (actor_id, actor, action, target, detail)
values (null, 'system', 'ops_migration', 'notifications',
  'migration_034: multi-channel delivery — sms/email/whatsapp campaigns, notification_deliveries queue, _dispatch enqueues external deliveries, claim_pending_deliveries/mark_delivery (service_role worker contract), config-driven channel enablement, get_delivery_stats');
