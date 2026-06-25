-- ═══════════════════════════════════════════════════════════════
-- Migration 032: Developer Center — ops status (storage / backups /
-- deploys)
--
-- Closes the developer-ops gap with REAL sources:
--   • get_storage_health  — reads storage.buckets / storage.objects
--   • system_status        — durable record of backup & deploy events,
--                            written by CI/cron via record_* RPCs
--                            (developer.manage), NOT faked in the UI
--   • get_system_status    — latest backup + recent deploys for the
--                            Developer Center
--
-- The CI workflow / backup cron call record_deploy() and record_backup()
-- with a service-role key, so the panel always reflects real events.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Storage health (real storage schema) ────────────────────
create or replace function get_storage_health()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, storage
as $$
declare v jsonb;
begin
  if not has_permission('developer.view') then
    raise exception 'Unauthorized: developer.view required';
  end if;
  begin
    select jsonb_build_object(
      'buckets', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'name', b.name, 'public', b.public,
          'objects', (select count(*) from storage.objects o where o.bucket_id = b.id),
          'size_bytes', (select coalesce(sum((o.metadata->>'size')::bigint),0)
                         from storage.objects o where o.bucket_id = b.id)
        ) order by b.name), '[]'::jsonb)
        from storage.buckets b
      ),
      'total_objects', (select count(*) from storage.objects),
      'as_of', now()
    ) into v;
  exception when others then
    v := jsonb_build_object('buckets', '[]'::jsonb, 'total_objects', 0,
                            'note', 'storage schema not accessible in this environment', 'as_of', now());
  end;
  return v;
end;
$$;
grant execute on function get_storage_health() to authenticated;

-- ── 2. System status events (backups, deploys, restores) ────────
create table if not exists system_status (
  id          uuid primary key default uuid_generate_v4(),
  kind        text not null check (kind in ('backup','restore','deploy')),
  status      text not null check (status in ('success','failed','in_progress')),
  ref         text,                       -- git sha, backup id, etc.
  detail      text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_system_status_kind    on system_status(kind, created_at desc);
create index if not exists idx_system_status_created on system_status(created_at desc);

alter table system_status enable row level security;
drop policy if exists "system_status_read" on system_status;
create policy "system_status_read" on system_status
  for select using (has_permission('developer.view') or is_admin());
-- Writes via RPC only.

create or replace function record_system_event(p_kind text, p_status text, p_ref text default null, p_detail text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  -- developer.manage OR service_role (CI/cron). is_admin() implies super_admin.
  if not (has_permission('developer.manage') or auth.role() = 'service_role') then
    raise exception 'Unauthorized: developer.manage required';
  end if;
  if p_kind   not in ('backup','restore','deploy')         then raise exception 'invalid kind'; end if;
  if p_status not in ('success','failed','in_progress')    then raise exception 'invalid status'; end if;

  insert into system_status (kind, status, ref, detail)
  values (p_kind, p_status, p_ref, p_detail) returning id into v_id;

  insert into audit_log (actor_id, actor, action, target, detail)
  values (auth.uid(), coalesce((select name from profiles where id = auth.uid()), 'system'),
          'system_' || p_kind, coalesce(p_ref, v_id::text),
          format('%s %s — %s', p_kind, p_status, coalesce(p_detail,'')));

  return jsonb_build_object('success', true, 'id', v_id);
end;
$$;
grant execute on function record_system_event(text, text, text, text) to authenticated, service_role;

create or replace function get_system_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not has_permission('developer.view') then
    raise exception 'Unauthorized: developer.view required';
  end if;
  return jsonb_build_object(
    'last_backup',  (select row_to_json(s) from (
        select kind, status, ref, detail, created_at from system_status
        where kind = 'backup' order by created_at desc limit 1) s),
    'last_restore', (select row_to_json(s) from (
        select kind, status, ref, detail, created_at from system_status
        where kind = 'restore' order by created_at desc limit 1) s),
    'recent_deploys', (select coalesce(jsonb_agg(row_to_json(s) order by s.created_at desc), '[]'::jsonb) from (
        select kind, status, ref, detail, created_at from system_status
        where kind = 'deploy' order by created_at desc limit 10) s),
    'backups_7d',  (select count(*) from system_status where kind='backup'  and created_at > now() - interval '7 days'),
    'deploys_7d',  (select count(*) from system_status where kind='deploy'  and created_at > now() - interval '7 days'),
    'as_of', now()
  );
end;
$$;
grant execute on function get_system_status() to authenticated;

insert into audit_log (actor_id, actor, action, target, detail)
values (null, 'system', 'ops_migration', 'developer',
  'migration_032: developer ops status — get_storage_health (storage schema), system_status table + record_system_event (developer.manage/service_role) + get_system_status for backups/restores/deploys');
