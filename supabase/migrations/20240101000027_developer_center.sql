-- ═══════════════════════════════════════════════════════════════
-- Migration 027: Developer Center (real ops observability)
--
-- Surfaces REAL platform internals to Super Admin from the panel:
--   • Database health    — DB size + per-table size/rows (pg_stat)
--   • Cron jobs          — pg_cron schedule + last run status
--   • Migration status   — applied migrations (supabase_migrations)
--   • Recent errors      — client_error_logs (migration 019)
--   • Payment queue      — reuses get_payment_queue_health (migration 020)
--   • Overview snapshot
--
-- Gated by a new dynamic-RBAC permission 'developer.view' (super_admin
-- implicit). Read-only — no writes here.
--
-- NOT included (would require the Supabase Management API / platform
-- integration, not the SQL layer — so they are NOT faked): storage
-- health, raw API gateway health, backup/restore status, deploy history.
-- ═══════════════════════════════════════════════════════════════

-- New permission (config-driven; super_admin implicit, admins may be
-- granted it from the Roles screen).
insert into permissions (key, module, action, description) values
  ('developer.view',   'developer', 'view',   'View developer/ops dashboards'),
  ('developer.manage', 'developer', 'manage', 'Manage developer/ops tooling')
on conflict (key) do nothing;

-- ── Database health ─────────────────────────────────────────────
create or replace function get_database_health()
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
    'db_size',       pg_size_pretty(pg_database_size(current_database())),
    'db_size_bytes', pg_database_size(current_database()),
    'tables', (
      select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select relname as name,
               n_live_tup as rows,
               pg_size_pretty(pg_total_relation_size(relid)) as size,
               pg_total_relation_size(relid) as size_bytes
        from pg_stat_user_tables
        where schemaname = 'public'
        order by pg_total_relation_size(relid) desc
        limit 25
      ) t
    ),
    'as_of', now()
  );
end;
$$;
grant execute on function get_database_health() to authenticated;

-- ── Cron jobs + last run ────────────────────────────────────────
create or replace function get_cron_jobs()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v jsonb;
begin
  if not has_permission('developer.view') then
    raise exception 'Unauthorized: developer.view required';
  end if;
  begin
    select coalesce(jsonb_agg(jsonb_build_object(
      'jobid', j.jobid, 'jobname', j.jobname, 'schedule', j.schedule, 'active', j.active,
      'last_status', r.status, 'last_run', r.start_time
    ) order by j.jobname), '[]'::jsonb)
    into v
    from cron.job j
    left join lateral (
      select status, start_time from cron.job_run_details d
      where d.jobid = j.jobid order by start_time desc limit 1
    ) r on true;
  exception when others then
    -- job_run_details may be unavailable on older pg_cron — list jobs only.
    begin
      select coalesce(jsonb_agg(jsonb_build_object(
        'jobid', jobid, 'jobname', jobname, 'schedule', schedule, 'active', active
      ) order by jobname), '[]'::jsonb) into v from cron.job;
    exception when others then
      v := '[]'::jsonb;
    end;
  end;
  return v;
end;
$$;
grant execute on function get_cron_jobs() to authenticated;

-- ── Migration status ────────────────────────────────────────────
create or replace function get_migration_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v jsonb;
begin
  if not has_permission('developer.view') then
    raise exception 'Unauthorized: developer.view required';
  end if;
  begin
    select jsonb_build_object(
      'count',  (select count(*) from supabase_migrations.schema_migrations),
      'latest', (select max(version) from supabase_migrations.schema_migrations),
      'recent', (select coalesce(jsonb_agg(version order by version desc), '[]'::jsonb)
                 from (select version from supabase_migrations.schema_migrations
                       order by version desc limit 15) t)
    ) into v;
  exception when others then
    v := jsonb_build_object('count', 0, 'latest', null, 'recent', '[]'::jsonb,
                            'note', 'migration table not accessible in this environment');
  end;
  return v;
end;
$$;
grant execute on function get_migration_status() to authenticated;

-- ── Recent client errors ────────────────────────────────────────
create or replace function get_recent_errors(p_limit integer default 50)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when (select has_permission('developer.view')) then
    coalesce((
      select jsonb_agg(row_to_json(e))
      from (
        select id, level, message, url, created_at
        from client_error_logs
        order by created_at desc
        limit greatest(1, least(p_limit, 200))
      ) e
    ), '[]'::jsonb)
  else '[]'::jsonb end;
$$;
grant execute on function get_recent_errors(integer) to authenticated;

-- ── Overview snapshot ───────────────────────────────────────────
create or replace function get_developer_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_mig integer;
begin
  if not has_permission('developer.view') then
    raise exception 'Unauthorized: developer.view required';
  end if;
  begin
    select count(*) into v_mig from supabase_migrations.schema_migrations;
  exception when others then v_mig := null; end;

  return jsonb_build_object(
    'db_size',                pg_size_pretty(pg_database_size(current_database())),
    'migrations_applied',     v_mig,
    'cron_jobs',              (select count(*) from cron.job),
    'cron_jobs_active',       (select count(*) from cron.job where active),
    'errors_24h',             (select count(*) from client_error_logs where created_at > now() - interval '24 hours'),
    'pending_payment_events', (select count(*) from payment_events where processed_at is null),
    'as_of', now()
  );
end;
$$;
grant execute on function get_developer_overview() to authenticated;

insert into audit_log (actor_id, actor, action, target, detail)
values (
  null, 'system', 'ops_migration', 'developer',
  'migration_027: developer center — developer.view permission + get_database_health/get_cron_jobs/get_migration_status/get_recent_errors/get_developer_overview (read-only ops observability)'
);
