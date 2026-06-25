-- ═══════════════════════════════════════════════════════════════
-- Migration 024: Notification Center (templates, campaigns, targeting)
--
-- Lets admins compose, target, schedule and send notifications from the
-- panel. Channels delivered for real:
--   • in_app  — rows inserted into notifications (the bell; realtime).
--   • push    — recipients resolved server-side; the admin UI then calls
--               the existing send-fcm-notification Edge Function.
-- SMS/email/WhatsApp are intentionally NOT included — wiring a provider
-- (Twilio etc.) is a separate integration; we don't fake delivery.
--
-- Targeting: by role / village / language / explicit users / platform-wide.
-- Scheduling: in_app campaigns can be scheduled; dispatch_due_campaigns()
-- (pg_cron, every minute) delivers them. Push is send-now (reliable
-- scheduled push needs a pg_net→Edge wiring — documented, not faked).
--
-- Authorization: notifications.create (compose/send) + notifications.view
-- (read), via dynamic RBAC. Every action audited.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Templates ────────────────────────────────────────────────
create table if not exists notification_templates (
  key         text primary key,
  name        text not null,
  channel     text not null default 'in_app' check (channel in ('in_app','push')),
  notif_type  text not null default 'system' check (notif_type in ('order','credit','promo','scheme','system')),
  title       text not null,
  body        text not null,
  data        jsonb,
  is_active   boolean not null default true,
  updated_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger trg_notification_templates_updated_at before update on notification_templates
  for each row execute function update_updated_at();

-- ── 2. Campaigns ────────────────────────────────────────────────
create table if not exists notification_campaigns (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,
  channel       text not null default 'in_app' check (channel in ('in_app','push')),
  notif_type    text not null default 'system' check (notif_type in ('order','credit','promo','scheme','system')),
  title         text not null,
  body          text not null,
  data          jsonb,
  -- audience: { roles:[], village_ids:[], languages:[], user_ids:[] } — empty ⇒ everyone
  audience      jsonb not null default '{}'::jsonb,
  status        text not null default 'draft'
                  check (status in ('draft','scheduled','sending','sent','failed','cancelled')),
  scheduled_at  timestamptz,
  targeted_count integer not null default 0,
  sent_count     integer not null default 0,
  failed_count   integer not null default 0,
  created_by    uuid references auth.users(id) on delete set null,
  sent_at       timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_notif_campaigns_status     on notification_campaigns(status);
create index if not exists idx_notif_campaigns_scheduled   on notification_campaigns(scheduled_at) where status = 'scheduled';
create index if not exists idx_notif_campaigns_created_at  on notification_campaigns(created_at desc);
create trigger trg_notif_campaigns_updated_at before update on notification_campaigns
  for each row execute function update_updated_at();

-- ── 3. Audience resolution (internal) ───────────────────────────
-- Returns the profile ids matching an audience spec. Empty/absent arrays
-- mean "no filter on that dimension"; all empty ⇒ entire platform.
create or replace function resolve_campaign_audience(p_audience jsonb)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.id
  from profiles p
  where (coalesce(jsonb_array_length(p_audience->'roles'), 0) = 0
         or p.role in (select jsonb_array_elements_text(p_audience->'roles')))
    and (coalesce(jsonb_array_length(p_audience->'village_ids'), 0) = 0
         or p.village_id in (select jsonb_array_elements_text(p_audience->'village_ids')))
    and (coalesce(jsonb_array_length(p_audience->'languages'), 0) = 0
         or p.language in (select jsonb_array_elements_text(p_audience->'languages')))
    and (coalesce(jsonb_array_length(p_audience->'user_ids'), 0) = 0
         or p.id::text in (select jsonb_array_elements_text(p_audience->'user_ids')));
$$;
revoke execute on function resolve_campaign_audience(jsonb) from authenticated, anon;

-- Preview the audience size (admins, for the compose screen).
create or replace function campaign_audience_count(p_audience jsonb)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case when has_permission('notifications.view')
    then (select count(*)::int from resolve_campaign_audience(p_audience))
    else 0 end;
$$;
grant execute on function campaign_audience_count(jsonb) to authenticated;

-- ── 4. Dispatch (internal worker) ───────────────────────────────
-- Resolves audience, inserts the in-app notifications, marks the
-- campaign sent, and returns the recipient list (for the push path).
-- No permission check here — callers (dispatch_campaign / cron) gate.
-- Audience is capped to align with the FCM batch limit and keep payloads
-- bounded.
create or replace function _dispatch_campaign_internal(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c       notification_campaigns%rowtype;
  v_ids   uuid[];
  v_count integer;
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

  if v_count > 0 then
    insert into notifications (user_id, type, title, body, data)
    select uid, c.notif_type, c.title, c.body, c.data
    from unnest(v_ids) as uid;
  end if;

  update notification_campaigns
     set status = 'sent', sent_at = now(),
         targeted_count = v_count, sent_count = v_count, updated_at = now()
   where id = p_id;

  return jsonb_build_object(
    'success', true, 'campaign_id', p_id, 'channel', c.channel,
    'title', c.title, 'body', c.body, 'type', c.notif_type,
    'targeted', v_count, 'recipients', coalesce(to_jsonb(v_ids), '[]'::jsonb)
  );
end;
$$;
revoke execute on function _dispatch_campaign_internal(uuid) from authenticated, anon;

-- ── 5. Management RPCs (notifications.create, audited) ──────────
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
  if p_channel not in ('in_app','push') then raise exception 'Unsupported channel: %', p_channel; end if;
  if coalesce(trim(p_title),'') = '' or coalesce(trim(p_body),'') = '' then
    raise exception 'Title and body are required';
  end if;
  if p_scheduled_at is not null and p_scheduled_at > now() then
    if p_channel <> 'in_app' then
      raise exception 'Only in_app campaigns can be scheduled; send push campaigns immediately';
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

create or replace function dispatch_campaign(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v jsonb;
begin
  if not has_permission('notifications.create') then
    raise exception 'Unauthorized: notifications.create required';
  end if;
  v := _dispatch_campaign_internal(p_id);

  insert into audit_log (actor_id, actor, action, target, detail)
  values (auth.uid(), coalesce((select name from profiles where id = auth.uid()), 'admin'),
          'campaign_dispatched', p_id::text, format('targeted=%s', coalesce(v->>'targeted','0')));

  return v;
end;
$$;
grant execute on function dispatch_campaign(uuid) to authenticated;

create or replace function cancel_campaign(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not has_permission('notifications.create') then
    raise exception 'Unauthorized: notifications.create required';
  end if;
  update notification_campaigns set status = 'cancelled', updated_at = now()
   where id = p_id and status in ('draft','scheduled');
  if not found then return jsonb_build_object('success', false, 'error', 'Only draft/scheduled campaigns can be cancelled'); end if;

  insert into audit_log (actor_id, actor, action, target, detail)
  values (auth.uid(), coalesce((select name from profiles where id = auth.uid()), 'admin'),
          'campaign_cancelled', p_id::text, '');
  return jsonb_build_object('success', true);
end;
$$;
grant execute on function cancel_campaign(uuid) to authenticated;

create or replace function upsert_notification_template(
  p_key text, p_name text, p_channel text, p_notif_type text,
  p_title text, p_body text, p_data jsonb default null, p_is_active boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not has_permission('notifications.create') then
    raise exception 'Unauthorized: notifications.create required';
  end if;
  insert into notification_templates (key, name, channel, notif_type, title, body, data, is_active, updated_by, updated_at)
  values (p_key, p_name, coalesce(p_channel,'in_app'), coalesce(p_notif_type,'system'), p_title, p_body, p_data, p_is_active, auth.uid(), now())
  on conflict (key) do update
    set name=excluded.name, channel=excluded.channel, notif_type=excluded.notif_type,
        title=excluded.title, body=excluded.body, data=excluded.data, is_active=excluded.is_active,
        updated_by=auth.uid(), updated_at=now();

  insert into audit_log (actor_id, actor, action, target, detail)
  values (auth.uid(), coalesce((select name from profiles where id = auth.uid()), 'admin'),
          'notification_template_upsert', p_key, p_name);
  return jsonb_build_object('success', true, 'key', p_key);
end;
$$;
grant execute on function upsert_notification_template(text, text, text, text, text, text, jsonb, boolean) to authenticated;

-- ── 6. Scheduled dispatch (pg_cron, every minute) ───────────────
create or replace function dispatch_due_campaigns()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare r record; n integer := 0;
begin
  for r in
    select id from notification_campaigns
    where status = 'scheduled' and scheduled_at <= now()
    order by scheduled_at
    limit 100
  loop
    perform _dispatch_campaign_internal(r.id);
    n := n + 1;
  end loop;
  return n;
end;
$$;
revoke execute on function dispatch_due_campaigns() from authenticated, anon;
select cron.schedule('dispatch-due-campaigns', '* * * * *', $$ select dispatch_due_campaigns(); $$);

-- ── 7. RLS — read for notifications.view; writes via RPC only ───
alter table notification_templates  enable row level security;
alter table notification_campaigns  enable row level security;

drop policy if exists "notif_templates_read" on notification_templates;
create policy "notif_templates_read" on notification_templates for select using (has_permission('notifications.view'));

drop policy if exists "notif_campaigns_read" on notification_campaigns;
create policy "notif_campaigns_read" on notification_campaigns for select using (has_permission('notifications.view'));

insert into audit_log (actor_id, actor, action, target, detail)
values (
  null, 'system', 'ops_migration', 'notifications',
  'migration_024: notification center — templates + campaigns, audience targeting/resolution, create/dispatch/cancel/template RPCs (notifications.create), scheduled in_app dispatch via pg_cron, RLS read-via-permission/write-via-RPC'
);
