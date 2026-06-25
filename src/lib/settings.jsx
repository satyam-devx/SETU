// ═══════════════════════════════════════════════════════════
// SETU — Public Settings (client)
//
// Loads non-sensitive platform settings (branding, support, maintenance)
// via get_public_settings() (migration 023) so the app can render the
// platform name, theme, and maintenance state without admin access.
// Admin-only settings are never exposed here.
// ═══════════════════════════════════════════════════════════
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { isSupabaseConfigured } from './supabase';
import { SettingsAPI } from './api';

const SettingsContext = createContext({
  settings: {},
  get: () => undefined,
  isMaintenance: false,
  loading: true,
  reload: () => {},
});

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState({});
  const [loading, setLoading]   = useState(true);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) { setSettings({}); setLoading(false); return; }
    setLoading(true);
    const { data } = await SettingsAPI.getPublic();
    setSettings(data && typeof data === 'object' ? data : {});
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const get = useCallback((key, fallback) => {
    const v = settings[key];
    return v === undefined || v === null ? fallback : v;
  }, [settings]);

  const isMaintenance = settings.maintenance_mode === 'true';

  return (
    <SettingsContext.Provider value={{ settings, get, isMaintenance, loading, reload: load }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function usePublicSettings() {
  return useContext(SettingsContext);
}
