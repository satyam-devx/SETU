-- SETU Design System Studio: versioned, scoped visual configuration.
-- Direct table access is intentionally denied; all mutations use audited RPCs.
create table if not exists public.design_system_versions (
  id uuid primary key default gen_random_uuid(),
  scope text not null default 'global' check (scope in ('global','customer','vendor','rider','seva','anchor','admin','superadmin')),
  version integer not null,
  config jsonb not null,
  status text not null default 'draft' check (status in ('draft','published','superseded')),
  note text not null default '',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  published_by uuid references public.profiles(id) on delete set null,
  published_at timestamptz,
  unique(scope, version),
  constraint design_system_config_object check (jsonb_typeof(config) = 'object')
);
create index if not exists design_system_versions_scope_status_idx
  on public.design_system_versions(scope, status, version desc);
alter table public.design_system_versions enable row level security;
revoke all on public.design_system_versions from anon, authenticated;

create or replace function public.get_published_design_system(p_scope text default 'global')
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_global public.design_system_versions%rowtype;
  v_scoped public.design_system_versions%rowtype;
  v_config jsonb := '{}'::jsonb;
  v_section text;
begin
  if p_scope not in ('global','customer','vendor','rider','seva','anchor','admin','superadmin') then
    p_scope := 'global';
  end if;
  select * into v_global from public.design_system_versions
   where scope = 'global' and status = 'published' order by version desc limit 1;
  if p_scope = 'global' then
    if v_global.id is null then return null; end if;
    return jsonb_build_object('id',v_global.id,'scope',v_global.scope,'version',v_global.version,'config',v_global.config,'published_at',v_global.published_at);
  end if;
  select * into v_scoped from public.design_system_versions
   where scope = p_scope and status = 'published' order by version desc limit 1;
  if v_global.id is null and v_scoped.id is null then return null; end if;
  v_config := coalesce(v_global.config,'{}'::jsonb) || coalesce(v_scoped.config,'{}'::jsonb);
  -- Merge known nested sections as well, so a portal can override one token
  -- without discarding all inherited global tokens in that section.
  foreach v_section in array array['colors','darkColors','typography','layout','motion','icons','theme'] loop
    v_config := jsonb_set(v_config, array[v_section],
      coalesce(v_global.config->v_section,'{}'::jsonb) || coalesce(v_scoped.config->v_section,'{}'::jsonb), true);
  end loop;
  return jsonb_build_object(
    'id',coalesce(v_scoped.id,v_global.id),
    'scope',p_scope,
    'version',coalesce(v_scoped.version,v_global.version),
    'config',v_config,
    'published_at',coalesce(v_scoped.published_at,v_global.published_at),
    'inherited_global',v_scoped.id is null
  );
end; $$;
revoke all on function public.get_published_design_system(text) from public;
grant execute on function public.get_published_design_system(text) to anon, authenticated, service_role;

create or replace function public.list_design_system_versions(p_scope text default 'global')
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not has_permission('settings.update') then raise exception 'Unauthorized: settings.update required'; end if;
  if p_scope not in ('global','customer','vendor','rider','seva','anchor','admin','superadmin') then
    raise exception 'Invalid design scope';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'id', id, 'scope', scope, 'version', version, 'config', config, 'status', status,
    'note', note, 'created_at', created_at, 'published_at', published_at
  ) order by version desc) from public.design_system_versions where scope = p_scope), '[]'::jsonb);
end; $$;
revoke all on function public.list_design_system_versions(text) from public, anon;
grant execute on function public.list_design_system_versions(text) to authenticated;

create or replace function public.save_design_system_draft(p_scope text, p_config jsonb, p_note text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_version integer; v_id uuid; v_key text; v_value text;
begin
  if not has_permission('settings.update') then raise exception 'Unauthorized: settings.update required'; end if;
  if p_scope not in ('global','customer','vendor','rider','seva','anchor','admin','superadmin') then raise exception 'Invalid design scope'; end if;
  perform pg_advisory_xact_lock(hashtext('design_system:' || p_scope));
  if jsonb_typeof(p_config) <> 'object' then raise exception 'Design config must be a JSON object'; end if;
  if octet_length(p_config::text) > 32768 then raise exception 'Design config is too large'; end if;
  if p_config ? 'colors' then
    if jsonb_typeof(p_config->'colors') <> 'object' then raise exception 'Colors must be an object'; end if;
    for v_key, v_value in select key, value #>> '{}' from jsonb_each(p_config->'colors') loop
      if v_key not in ('background','foreground','card','cardForeground','popover','popoverForeground','primary','primaryForeground','secondary','secondaryForeground','accent','accentForeground','muted','mutedForeground','border','input','ring','destructive','destructiveForeground','setuSaffron','setuTeal','setuEarth','setuSuccess','setuWarning','sidebar','sidebarForeground','sidebarBorder','sidebarAccent','sidebarPrimary','chart1','chart2','chart3','chart4','chart5') then
        raise exception 'Unknown color token: %', v_key;
      end if;
      if jsonb_typeof((p_config->'colors')->v_key) <> 'string' or v_value !~ '^#[0-9A-Fa-f]{6}$' then raise exception 'Invalid hex color for %', v_key; end if;
    end loop;
  end if;
  if p_config ? 'darkColors' then
    if jsonb_typeof(p_config->'darkColors') <> 'object' then raise exception 'Dark colors must be an object'; end if;
    for v_key, v_value in select key, value #>> '{}' from jsonb_each(p_config->'darkColors') loop
      if v_key not in ('background','foreground','card','cardForeground','popover','popoverForeground','primary','primaryForeground','secondary','secondaryForeground','accent','accentForeground','muted','mutedForeground','border','input','ring','destructive','destructiveForeground','setuSaffron','setuTeal','setuEarth','setuSuccess','setuWarning','sidebar','sidebarForeground','sidebarBorder','sidebarAccent','sidebarPrimary','chart1','chart2','chart3','chart4','chart5') then raise exception 'Unknown dark color token: %', v_key; end if;
      if jsonb_typeof((p_config->'darkColors')->v_key) <> 'string' or v_value !~ '^#[0-9A-Fa-f]{6}$' then raise exception 'Invalid dark hex color for %', v_key; end if;
    end loop;
  end if;
  if p_config ? 'typography' then
    if (p_config->'typography'->>'bodyFont') not in ('system','inter','roboto','nunito','mono')
       or (p_config->'typography'->>'headingFont') not in ('system','inter','roboto','nunito','mono')
       or (p_config->'typography'->>'monoFont') not in ('system','inter','roboto','nunito','mono') then
      raise exception 'Unsupported font family';
    end if;
    if coalesce((p_config->'typography'->>'baseFontSize')::integer,16) not between 14 and 20 then raise exception 'Base font size must be 14–20'; end if;
    if coalesce(p_config->'typography'->>'headingScale','standard') not in ('compact','standard','expressive') then raise exception 'Unsupported heading scale'; end if;
    if coalesce(p_config->'typography'->>'bodyWeight','400') not in ('400','500') then raise exception 'Unsupported body weight'; end if;
    if coalesce(p_config->'typography'->>'headingWeight','600') not in ('500','600','700','800') then raise exception 'Unsupported heading weight'; end if;
    if coalesce(p_config->'typography'->>'lineHeight','normal') not in ('tight','normal','relaxed') then raise exception 'Unsupported line height'; end if;
    if coalesce(p_config->'typography'->>'letterSpacing','normal') not in ('tight','normal','wide') then raise exception 'Unsupported letter spacing'; end if;
  end if;
  if p_config ? 'layout' and coalesce(p_config->'layout'->>'radius','12px') not in ('8px','10px','12px','16px','20px') then raise exception 'Unsupported radius'; end if;
  if p_config ? 'layout' and coalesce(p_config->'layout'->>'shadow','soft') not in ('none','soft','elevated') then raise exception 'Unsupported shadow preset'; end if;
  if p_config ? 'layout' and coalesce(p_config->'layout'->>'contentWidth','standard') not in ('compact','standard','wide') then raise exception 'Unsupported content width'; end if;
  if p_config ? 'layout' and coalesce(p_config->'layout'->>'spacingScale','standard') not in ('compact','standard','spacious') then raise exception 'Unsupported spacing scale'; end if;
  if p_config ? 'layout' and coalesce(p_config->'layout'->>'buttonHeight','standard') not in ('compact','standard','large') then raise exception 'Unsupported button height'; end if;
  if p_config ? 'layout' and coalesce(p_config->'layout'->>'inputHeight','standard') not in ('compact','standard','large') then raise exception 'Unsupported input height'; end if;
  if p_config ? 'layout' and coalesce(p_config->'layout'->>'cardPadding','standard') not in ('compact','standard','spacious') then raise exception 'Unsupported card padding'; end if;
  if p_config ? 'layout' and coalesce(p_config->'layout'->>'gridGap','standard') not in ('compact','standard','spacious') then raise exception 'Unsupported grid gap'; end if;
  if p_config ? 'layout' and coalesce(p_config->'layout'->>'breakpoint','standard') not in ('compact','standard','wide') then raise exception 'Unsupported breakpoint'; end if;
  if p_config ? 'layout' and coalesce(p_config->'layout'->>'navDensity','comfortable') not in ('compact','comfortable','spacious') then raise exception 'Unsupported navigation density'; end if;
  if p_config ? 'motion' and coalesce(p_config->'motion'->>'duration','normal') not in ('fast','normal','slow') then raise exception 'Unsupported motion duration'; end if;
  if p_config ? 'motion' and jsonb_typeof(p_config->'motion'->'enabled') not in ('boolean','null') then raise exception 'Motion enabled must be boolean'; end if;
  if p_config ? 'icons' and coalesce((p_config->'icons'->>'size')::integer,20) not between 14 and 32 then raise exception 'Icon size must be 14–32'; end if;
  if p_config ? 'icons' and coalesce((p_config->'icons'->>'strokeWidth')::numeric,2) not between 1 and 3 then raise exception 'Icon stroke width must be 1–3'; end if;
  if (p_config ? 'icons') and ((p_config->'icons') ? 'mappings') then
    if jsonb_typeof(p_config->'icons'->'mappings') <> 'object' then raise exception 'Icon mappings must be an object'; end if;
    for v_key, v_value in select key, value #>> '{}' from jsonb_each(p_config->'icons'->'mappings') loop
      if v_key not in ('home','search','orders','profile','cart','location','settings','help') then raise exception 'Unknown semantic icon key: %',v_key; end if;
      if coalesce(jsonb_typeof((p_config->'icons'->'mappings')->v_key),'null') <> 'string' or v_value not in ('House','Search','Package','UserRound','ShoppingCart','MapPin','Settings','CircleHelp','LayoutDashboard','Heart','Bell','Store','Bike','Map','ShieldCheck') then raise exception 'Unsupported icon mapping: %',v_value; end if;
    end loop;
  end if;
  if p_config ? 'theme' then
    if coalesce(p_config->'theme'->>'defaultMode','system') not in ('system','light','dark') then raise exception 'Unsupported default theme'; end if;
    if p_config->'theme' ? 'allowUserSelection' and jsonb_typeof(p_config->'theme'->'allowUserSelection') <> 'boolean' then raise exception 'allowUserSelection must be boolean'; end if;
  end if;

  select coalesce(max(version),0)+1 into v_version from public.design_system_versions where scope = p_scope;
  insert into public.design_system_versions(scope,version,config,status,note,created_by)
    values (p_scope,v_version,p_config,'draft',left(coalesce(p_note,''),500),auth.uid()) returning id into v_id;
  insert into public.audit_log(actor_id,actor,action,target,target_type,detail)
    values (auth.uid(),coalesce((select name from public.profiles where id=auth.uid()),'super_admin'),'design_system_draft_saved',v_id::text,'design_system',format('Scope %s; version %s',p_scope,v_version));
  return jsonb_build_object('id',v_id,'scope',p_scope,'version',v_version,'status','draft');
end; $$;
revoke all on function public.save_design_system_draft(text,jsonb,text) from public, anon;
grant execute on function public.save_design_system_draft(text,jsonb,text) to authenticated;

create or replace function public.publish_design_system_version(p_version_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_row public.design_system_versions%rowtype; v_scope text;
begin
  if not has_permission('settings.update') then raise exception 'Unauthorized: settings.update required'; end if;
  select scope into v_scope from public.design_system_versions where id=p_version_id;
  if not found then raise exception 'Design version not found'; end if;
  perform pg_advisory_xact_lock(hashtext('design_system:' || v_scope));
  select * into v_row from public.design_system_versions where id=p_version_id for update;
  update public.design_system_versions set status='superseded'
   where scope=v_row.scope and status='published' and id<>v_row.id;
  update public.design_system_versions set status='published', published_by=auth.uid(), published_at=now()
   where id=v_row.id returning * into v_row;
  insert into public.audit_log(actor_id,actor,action,target,target_type,detail)
    values (auth.uid(),coalesce((select name from public.profiles where id=auth.uid()),'super_admin'),'design_system_published',v_row.id::text,'design_system',format('Published %s version %s',v_row.scope,v_row.version));
  return jsonb_build_object('id',v_row.id,'scope',v_row.scope,'version',v_row.version,'status',v_row.status,'published_at',v_row.published_at);
end; $$;
revoke all on function public.publish_design_system_version(uuid) from public, anon;
grant execute on function public.publish_design_system_version(uuid) to authenticated;

insert into public.audit_log(actor_id,actor,action,target,target_type,detail)
values (null,'system','ops_migration','design_system_versions','design_system','Migration 110: added scoped, versioned Design System Studio with validated draft/publish RPCs and public published-theme read');
