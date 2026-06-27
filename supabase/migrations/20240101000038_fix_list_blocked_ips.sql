-- ═══════════════════════════════════════════════════════════════
-- Migration 038: fix list_blocked_ips() IP rendering + gate
--
-- ROOT CAUSE:
--   list_blocked_ips() returned `ip::text`, which for an inet host
--   value renders with the netmask (e.g. '203.0.113.9/32'). Callers
--   (and the security-ops proof) compare against the bare address
--   '203.0.113.9', so a freshly-blocked IP appeared "not listed" even
--   though is_ip_blocked() (which compares as inet) reported it blocked.
--
--   Also the function's visibility gate was only has_permission(
--   'users.view'), while the blocked_ips RLS policy is
--   has_permission('users.view') OR is_admin(). Align the two.
--
-- FIX: return host(ip) (bare address) and match the RLS gate.
-- ═══════════════════════════════════════════════════════════════

create or replace function list_blocked_ips()
returns table (ip text, reason text, blocked_by uuid, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select host(ip), reason, blocked_by, created_at
  from blocked_ips
  where (select has_permission('users.view') or is_admin())
  order by created_at desc;
$$;
grant execute on function list_blocked_ips() to authenticated;
