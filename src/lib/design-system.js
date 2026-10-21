/**
 * Design System public surface.
 * Token definitions, validation and color math live in src/lib/design/* (pure,
 * unit-tested modules). This file keeps the long-standing import path and adds
 * the Supabase RPC client.
 */
import { supabase } from '@/lib/supabase';
import { OPTIONS } from '@/lib/design/schema';

export {
  DESIGN_SCOPES, DEFAULT_DESIGN, mergeDesign, sanitizeConfig, validateConfig, scopeFromPath,
} from '@/lib/design/schema';

export const FONT_OPTIONS = OPTIONS.fontFamily.map(({ value, label }) => ({ value, label }));

/** Normalize Supabase/PostgREST errors into something a human can act on. */
export function describeDesignError(error) {
  if (!error) return '';
  const message = String(error.message || error);
  if (/Unauthorized|permission denied|42501/i.test(message)) return 'You need the settings.update permission to do that.';
  if (/Could not find the function|PGRST202|does not exist/i.test(message)) return 'The design-system migration (110) has not been applied to this database yet.';
  if (/Failed to fetch|NetworkError|network/i.test(message)) return 'Network problem. Check your connection and try again.';
  return message;
}

export const DesignSystemAPI = {
  getPublished: async (scope = 'global') => {
    const { data, error } = await supabase.rpc('get_published_design_system', { p_scope: scope });
    return { data: data && typeof data === 'object' ? data : null, error };
  },
  listVersions: async (scope = 'global') => {
    const { data, error } = await supabase.rpc('list_design_system_versions', { p_scope: scope });
    return { data: Array.isArray(data) ? data : [], error };
  },
  saveDraft: async (scope, config, note = '') => {
    const { data, error } = await supabase.rpc('save_design_system_draft', { p_scope: scope, p_config: config, p_note: note });
    return { data, error };
  },
  publish: async (versionId) => {
    const { data, error } = await supabase.rpc('publish_design_system_version', { p_version_id: versionId });
    return { data, error };
  },
};
