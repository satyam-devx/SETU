// ═══════════════════════════════════════════════════════════
// SETU — Super Admin · Roles & Permissions
//
// Configure the dynamic RBAC system (migration 021) entirely from the
// UI: toggle which permissions each role holds. Every change goes
// through set_role_permission() (super-admin-only, audited server-side).
// super_admin is shown read-only (holds all permissions implicitly).
//
// Real data only: roles, permissions catalog, and role→permission grants
// all come from the database. No mock data, no hardcoded permission list.
// ═══════════════════════════════════════════════════════════
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, Loader2, AlertCircle, RefreshCw, Check } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import AppHeader from '@/components/shared/AppHeader';
import { RBACAPI } from '@/lib/api';

const grantKey = (role, perm) => `${role}|${perm}`;

export default function SuperAdminRoles() {
  const [roles, setRoles]       = useState([]);
  const [perms, setPerms]       = useState([]);
  const [grants, setGrants]     = useState(() => new Set());
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [selectedRole, setSelectedRole] = useState(null);
  const [saving, setSaving]     = useState(null);   // permission key being toggled
  const [saveError, setSaveError] = useState(null);
  const [search, setSearch]     = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [rolesRes, permsRes, grantsRes] = await Promise.all([
      RBACAPI.getRoles(),
      RBACAPI.getPermissions(),
      RBACAPI.getRolePermissions(),
    ]);
    if (rolesRes.error || permsRes.error || grantsRes.error) {
      setError('Could not load roles & permissions. Tap retry.');
      setLoading(false);
      return;
    }
    setRoles(rolesRes.data ?? []);
    setPerms(permsRes.data ?? []);
    setGrants(new Set((grantsRes.data ?? []).map(g => grantKey(g.role_key, g.permission_key))));
    setSelectedRole(prev =>
      prev ?? (rolesRes.data ?? []).find(r => r.key !== 'super_admin')?.key ?? null
    );
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Group permissions by module for display.
  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? perms.filter(p => p.key.toLowerCase().includes(q) || (p.description ?? '').toLowerCase().includes(q))
      : perms;
    const map = {};
    for (const p of filtered) (map[p.module] ??= []).push(p);
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [perms, search]);

  const isSuper = selectedRole === 'super_admin';

  const handleToggle = async (permKey, nextGranted) => {
    if (!selectedRole || isSuper) return;
    setSaving(permKey);
    setSaveError(null);

    // Optimistic
    const k = grantKey(selectedRole, permKey);
    setGrants(prev => {
      const next = new Set(prev);
      if (nextGranted) next.add(k); else next.delete(k);
      return next;
    });

    const { error: e } = await RBACAPI.setRolePermission(selectedRole, permKey, nextGranted);
    if (e) {
      // Revert on failure
      setGrants(prev => {
        const next = new Set(prev);
        if (nextGranted) next.delete(k); else next.add(k);
        return next;
      });
      setSaveError(e.message ?? 'Failed to update permission');
    }
    setSaving(null);
  };

  const grantedCount = useMemo(() => {
    if (!selectedRole) return 0;
    if (isSuper) return perms.length;
    return perms.filter(p => grants.has(grantKey(selectedRole, p.key))).length;
  }, [selectedRole, isSuper, perms, grants]);

  // ── Render ───────────────────────────────────────────────
  return (
    <div className="flex-1 overflow-auto pb-24" role="main">
      <AppHeader
        title="Roles & Permissions"
        subtitle="Configure what each role can do · changes apply instantly, audit-logged"
        rightAction={
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={load} aria-label="Refresh roles and permissions">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        }
      />

      <div className="max-w-3xl mx-auto">
      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-20" role="status" aria-live="polite">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-3 py-20 px-6 text-center" role="alert">
          <AlertCircle className="w-8 h-8 text-destructive" />
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" onClick={load} className="gap-2">
            <RefreshCw className="w-4 h-4" /> Retry
          </Button>
        </div>
      ) : roles.length === 0 ? (
        <div className="py-20 text-center text-sm text-muted-foreground">No roles configured.</div>
      ) : (
        <div className="px-4 py-4 space-y-4">
          {/* Role selector */}
          <div className="scroll-strip" role="tablist" aria-label="Roles">
            {roles.map(r => {
              const active = r.key === selectedRole;
              return (
                <button
                  key={r.key}
                  role="tab"
                  aria-selected={active}
                  onClick={() => { setSelectedRole(r.key); setSaveError(null); }}
                  className={`shrink-0 px-3 py-2 rounded-xl border text-sm transition-colors
                    ${active ? 'border-primary bg-primary/5 text-foreground font-medium' : 'border-border text-muted-foreground hover:bg-muted/40'}`}
                >
                  {r.name}
                  {r.is_system && <span className="ml-1 text-[9px] text-muted-foreground">(system)</span>}
                </button>
              );
            })}
          </div>

          {/* Summary + search */}
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{grantedCount}</span> of {perms.length} permissions
              {isSuper && ' · super admin holds all permissions'}
            </p>
          </div>
          <div className="relative">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              placeholder="Search permissions (e.g. orders, refund, approve)"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-10"
            />
          </div>

          {saveError && (
            <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-xl">
              <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-xs text-destructive">{saveError}</p>
            </div>
          )}

          {isSuper && (
            <Card className="p-3 border-amber-300 bg-amber-50/60 flex items-center gap-2">
              <Check className="w-4 h-4 text-amber-700 shrink-0" />
              <p className="text-xs text-amber-800">
                Super Admin implicitly holds every permission and cannot be modified.
              </p>
            </Card>
          )}

          {/* Permission groups */}
          {grouped.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No permissions match “{search}”.</p>
          ) : (
            grouped.map(([module, list]) => (
              <Card key={module} className="p-3 border-border">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  {module.replace(/_/g, ' ')}
                </p>
                <div className="space-y-1">
                  {list.map(p => {
                    const checked = isSuper || grants.has(grantKey(selectedRole, p.key));
                    return (
                      <div key={p.key} className="flex items-center justify-between gap-3 py-1.5">
                        <div className="min-w-0">
                          <p className="text-sm font-medium capitalize">{p.action.replace(/_/g, ' ')}</p>
                          <p className="text-[10px] font-mono text-muted-foreground truncate">{p.key}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {saving === p.key && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
                          <Switch
                            checked={checked}
                            disabled={isSuper || saving === p.key}
                            onCheckedChange={(v) => handleToggle(p.key, v)}
                            aria-label={`${p.key} for ${selectedRole}`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            ))
          )}
        </div>
      )}
      </div>
    </div>
  );
}
