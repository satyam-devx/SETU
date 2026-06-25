// ═══════════════════════════════════════════════════════════
// SETU — Permissions (dynamic RBAC client)
//
// Loads the caller's permission set from current_user_permissions()
// (migration 021) once on auth, and exposes can(key) for gating UI.
// Authorization is ALSO enforced server-side (RLS + has_permission in
// RPCs) — this client layer is for UX only, never the security boundary.
// ═══════════════════════════════════════════════════════════
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from './supabase';
import { useAuth } from './AuthContext';

const PermissionsContext = createContext({
  permissions: new Set(),
  can: () => false,
  isSuperAdmin: false,
  loading: true,
  reload: () => {},
});

export function PermissionsProvider({ children }) {
  const { profile, isAuthenticated } = useAuth();
  const [permissions, setPermissions] = useState(new Set());
  const [loading, setLoading] = useState(true);

  const isSuperAdmin = profile?.role === 'super_admin';

  const load = useCallback(async () => {
    if (!isAuthenticated || !profile) {
      setPermissions(new Set());
      setLoading(false);
      return;
    }
    // Demo / unconfigured: super_admin sees everything, others see nothing.
    if (!isSupabaseConfigured) {
      setPermissions(new Set(isSuperAdmin ? ['*'] : []));
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data } = await supabase.rpc('current_user_permissions');
      setPermissions(new Set(Array.isArray(data) ? data : []));
    } catch {
      setPermissions(new Set());
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, profile, isSuperAdmin]);

  useEffect(() => { load(); }, [load]);

  const can = useCallback((key) => {
    if (isSuperAdmin) return true;          // mirrors has_permission() server-side
    if (permissions.has('*')) return true;
    return permissions.has(key);
  }, [permissions, isSuperAdmin]);

  return (
    <PermissionsContext.Provider value={{ permissions, can, isSuperAdmin, loading, reload: load }}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  return useContext(PermissionsContext);
}

/**
 * Conditionally render children only if the user holds `permission`.
 *   <Can permission="orders.update"><EditButton/></Can>
 */
export function Can({ permission, children, fallback = null }) {
  const { can } = usePermissions();
  return can(permission) ? children : fallback;
}
