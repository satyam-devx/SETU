/**
 * In-memory stand-in for the Supabase design-system RPCs. Mirrors the SQL migration:
 * per-section merge of global + scoped config, supersede-on-publish, per-scope
 * version numbers, and rejection of invalid configs (via the shared validator).
 */
import { validateConfig } from '../../src/lib/design/schema.js';
export const __db = { rows: [], seq: 0, fail: false, calls: [], onNextList: null };
export const reset = () => { __db.rows = []; __db.seq = 0; __db.fail = false; __db.calls = []; __db.onNextList = null; };
const err = (m) => ({ data: null, error: { message: m } });
const live = (scope) => __db.rows.find((r) => r.scope === scope && r.status === 'published');
const mergeSections = (a = {}, b = {}) => { const out = {}; for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) out[k] = (typeof (a[k] ?? b[k]) === 'object' && !Array.isArray(a[k] ?? b[k])) ? { ...(a[k] || {}), ...(b[k] || {}) } : (b[k] ?? a[k]); return out; };
export const describeDesignError = (e) => String(e?.message || e);
export const DesignSystemAPI = {
  getPublished: async (scope = 'global') => {
    __db.calls.push(['getPublished', scope]); if (__db.fail) return err('Failed to fetch');
    const g = live('global'); if (scope === 'global') return { data: g ? { id: g.id, scope, version: g.version, config: g.config } : null, error: null };
    const s = live(scope); if (!g && !s) return { data: null, error: null };
    return { data: { id: (s || g).id, scope, version: s ? s.version : g.version, config: mergeSections(g?.config, s?.config), inherited_global: !s }, error: null };
  },
  listVersions: async (scope = 'global') => {
    __db.calls.push(['listVersions', scope]); if (__db.fail) return { data: [], error: { message: 'Failed to fetch' } };
    if (__db.onNextList) { const f = __db.onNextList; __db.onNextList = null; f(); }
    return { data: __db.rows.filter((r) => r.scope === scope).sort((a, b) => b.version - a.version).map((r) => ({ ...r, created_at: '2026-10-21T00:00:00Z' })), error: null };
  },
  saveDraft: async (scope, config, note = '') => {
    __db.calls.push(['saveDraft', scope, config, note]); if (__db.fail) return err('Failed to fetch');
    const v = validateConfig(config); if (!v.valid) return err(`Rejected by server: ${v.errors[0].path}`);
    const version = Math.max(0, ...__db.rows.filter((r) => r.scope === scope).map((r) => r.version)) + 1;
    const row = { id: `id${++__db.seq}`, scope, version, config: structuredClone(config), status: 'draft', note, published_at: null };
    __db.rows.push(row); return { data: { id: row.id, scope, version, status: 'draft' }, error: null };
  },
  publish: async (id) => {
    __db.calls.push(['publish', id]); if (__db.fail) return err('Failed to fetch');
    const row = __db.rows.find((r) => r.id === id); if (!row) return err('Version not found');
    __db.rows.forEach((r) => { if (r.scope === row.scope && r.status === 'published') r.status = 'superseded'; });
    row.status = 'published'; row.published_at = 'now'; return { data: { id, scope: row.scope, version: row.version, status: 'published' }, error: null };
  },
};
