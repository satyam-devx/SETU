import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DesignSystemAPI, describeDesignError } from '@/lib/design-system';
import { auditDesign } from '@/lib/design/a11y';
import { diffConfigs, extractOverrides } from '@/lib/design/diff';
import {
  canRedo, canUndo, createHistory, pushHistory, redo as redoHistory, resetHistory, undo as undoHistory,
} from '@/lib/design/history';
import { DEFAULT_DESIGN, mergeDesign, sanitizeConfig } from '@/lib/design/schema';

const NOTE_MAX = 500;
const toFull = (base, raw) => sanitizeConfig(mergeDesign(base, raw || {}));

/**
 * All Studio state and actions. The page and panels stay presentational.
 *
 * Draft model:
 *  - `draft` is always a complete config (what the preview renders).
 *  - Global saves the full config. Scoped portals save only their overrides on
 *    top of Global, so they keep inheriting everything they did not change.
 *  - Undo/redo covers every edit; slider drags and typing coalesce per control.
 */
export function useDesignStudio({ initialScope = 'global', onPublished } = {}) {
  const [scope, setScope] = useState(initialScope);
  const [history, setHistory] = useState(() => createHistory(DEFAULT_DESIGN));
  const [baseline, setBaseline] = useState(DEFAULT_DESIGN);
  const [inherited, setInherited] = useState(DEFAULT_DESIGN);
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState(null); // 'save' | 'publish' | null
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [note, setNote] = useState('');
  const [pending, setPending] = useState(null); // { id, version, key }
  const [conflict, setConflict] = useState(null); // { latest, yours }

  const loadId = useRef(0);
  const baseVersion = useRef(null);
  const draft = history.present;

  /* ------------------------------------------------------------- loading */

  const load = useCallback(async (targetScope) => {
    const id = ++loadId.current;
    setLoading(true);
    setError('');
    setNotice('');
    setConflict(null);
    const calls = [DesignSystemAPI.getPublished(targetScope), DesignSystemAPI.listVersions(targetScope)];
    if (targetScope !== 'global') calls.push(DesignSystemAPI.getPublished('global'));
    const [pub, list, glob] = await Promise.all(calls);
    if (id !== loadId.current) return; // a newer load superseded this one

    const failure = pub.error || list.error || glob?.error;
    setLoadFailed(Boolean(failure));
    if (failure) setError(describeDesignError(failure));

    const inheritedConfig = targetScope === 'global' ? DEFAULT_DESIGN : toFull(DEFAULT_DESIGN, glob?.data?.config);
    const effective = toFull(DEFAULT_DESIGN, pub.data?.config);
    setInherited(inheritedConfig);
    setBaseline(effective);
    setVersions(list.data);
    baseVersion.current = list.data.find((v) => v.status === 'published')?.version ?? null;
    setHistory((h) => resetHistory(h, effective));
    setPending(null);
    setLoading(false);
  }, []);

  useEffect(() => { load(scope); }, [scope, load]);

  /* -------------------------------------------------------------- editing */

  const commit = useCallback((next, key = null) => {
    setHistory((h) => pushHistory(h, typeof next === 'function' ? next(h.present) : next, { key }));
  }, []);

  const setSection = useCallback((section, key, value) => {
    commit((c) => ({ ...c, [section]: { ...c[section], [key]: value } }), `${section}.${key}`);
  }, [commit]);

  const setColor = useCallback((mode, key, value) => {
    const palette = mode === 'dark' ? 'darkColors' : 'colors';
    commit((c) => ({ ...c, [palette]: { ...c[palette], [key]: value } }), `${palette}.${key}`);
  }, [commit]);

  const setMapping = useCallback((key, value) => {
    commit((c) => ({ ...c, icons: { ...c.icons, mappings: { ...c.icons.mappings, [key]: value } } }), `icons.mappings.${key}`);
  }, [commit]);

  /** Replace the whole draft (preset, import, auto-fix, restore): always its own undo step. */
  const replaceDraft = useCallback((config) => commit(sanitizeConfig(config)), [commit]);

  const undo = useCallback(() => setHistory(undoHistory), []);
  const redo = useCallback(() => setHistory(redoHistory), []);
  const resetToPublished = useCallback(() => commit(baseline), [commit, baseline]);
  const resetToInherited = useCallback(() => commit(inherited), [commit, inherited]);

  /* -------------------------------------------------------------- derived */

  const changes = useMemo(() => diffConfigs(baseline, draft), [baseline, draft]);
  const audit = useMemo(() => auditDesign(draft), [draft]);
  const overrideCount = useMemo(() => (scope === 'global' ? 0 : diffConfigs(inherited, draft).length), [scope, inherited, draft]);
  const payload = useMemo(() => (scope === 'global' ? draft : extractOverrides(inherited, draft)), [scope, inherited, draft]);
  const payloadKey = useMemo(() => JSON.stringify(payload), [payload]);
  const publishedRow = useMemo(() => versions.find((v) => v.status === 'published') || null, [versions]);
  const dirty = changes.length > 0;
  const savedDraftCurrent = Boolean(pending && pending.key === payloadKey);

  /* -------------------------------------------------------------- saving */

  const noteWithAuditTag = useCallback(() => {
    const failures = audit.summary.errors;
    const tag = failures ? ` [a11y: ${failures} AA failure${failures === 1 ? '' : 's'}]` : '';
    return `${note.trim().slice(0, NOTE_MAX - tag.length)}${tag}`.trim();
  }, [note, audit.summary.errors]);

  const refreshVersions = useCallback(async () => {
    const list = await DesignSystemAPI.listVersions(scope);
    if (!list.error) setVersions(list.data);
    return list;
  }, [scope]);

  const persistDraft = useCallback(async () => {
    const { data, error: e } = await DesignSystemAPI.saveDraft(scope, payload, noteWithAuditTag());
    if (e) throw e;
    const saved = { id: data.id, version: data.version, key: payloadKey };
    setPending(saved);
    return saved;
  }, [scope, payload, payloadKey, noteWithAuditTag]);

  const saveDraft = useCallback(async () => {
    if (busy || loadFailed) return null;
    setBusy('save');
    setError('');
    setNotice('');
    try {
      const saved = await persistDraft();
      await refreshVersions();
      setNotice(`Draft v${saved.version} saved. It is not live until you publish.`);
      return saved;
    } catch (e) {
      setError(describeDesignError(e));
      return null;
    } finally {
      setBusy(null);
    }
  }, [busy, loadFailed, persistDraft, refreshVersions]);

  /**
   * Save (if needed) and publish. Before publishing, checks that nobody else
   * published to this scope since this session loaded; pass { force: true } to override.
   */
  const publish = useCallback(async ({ force = false } = {}) => {
    if (busy || loadFailed) return { ok: false };
    setBusy('publish');
    setError('');
    setNotice('');
    try {
      const latest = await DesignSystemAPI.listVersions(scope);
      if (latest.error) throw latest.error;
      const latestPublished = latest.data.find((v) => v.status === 'published')?.version ?? null;
      if (!force && latestPublished !== baseVersion.current) {
        setVersions(latest.data);
        setConflict({ latest: latestPublished, yours: baseVersion.current });
        return { ok: false, conflict: true };
      }
      const target = savedDraftCurrent ? pending : await persistDraft();
      const { data, error: e } = await DesignSystemAPI.publish(target.id);
      if (e) throw e;
      const refreshed = await refreshVersions();
      baseVersion.current = refreshed.data?.find((v) => v.status === 'published')?.version ?? data?.version ?? null;
      setBaseline(draft);
      setPending(null);
      setConflict(null);
      setNotice(`Published ${scope} design v${data?.version}. It is live for new sessions now.`);
      onPublished?.();
      return { ok: true, version: data?.version };
    } catch (e) {
      setError(describeDesignError(e));
      return { ok: false };
    } finally {
      setBusy(null);
    }
  }, [busy, loadFailed, scope, savedDraftCurrent, pending, persistDraft, refreshVersions, draft, onPublished]);

  /** One-click rollback: make an earlier version live again. Discards unsaved edits (the caller confirms). */
  const rollbackTo = useCallback(async (version) => {
    if (busy || loadFailed) return { ok: false };
    setBusy('publish');
    setError('');
    try {
      const { error: e } = await DesignSystemAPI.publish(version.id);
      if (e) throw e;
      await load(scope);
      setNotice(`Rolled back: v${version.version} is live again for new sessions.`);
      onPublished?.();
      return { ok: true };
    } catch (e) {
      setError(describeDesignError(e));
      return { ok: false };
    } finally {
      setBusy(null);
    }
  }, [busy, loadFailed, scope, load, onPublished]);

  /** Full config a stored version resolves to (scoped versions only hold overrides). */
  const versionConfig = useCallback((version) => toFull(inherited, version.config), [inherited]);

  const restoreVersion = useCallback((version) => {
    commit(toFull(inherited, version.config));
    setNotice(`Loaded v${version.version} into the editor. Save a draft to keep it.`);
  }, [commit, inherited]);

  /* ------------------------------------------------------------ shortcuts */

  const latest = useRef({});
  latest.current = { saveDraft, undo, redo };

  useEffect(() => {
    const onKeyDown = (e) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const key = e.key.toLowerCase();
      const el = e.target;
      const typing = el && (el.tagName === 'TEXTAREA' || el.isContentEditable
        || (el.tagName === 'INPUT' && !['range', 'color', 'checkbox', 'radio'].includes(el.type)));
      if (key === 's') {
        e.preventDefault();
        latest.current.saveDraft();
      } else if (key === 'z' && !typing) {
        e.preventDefault();
        if (e.shiftKey) latest.current.redo(); else latest.current.undo();
      } else if (key === 'y' && !typing) {
        e.preventDefault();
        latest.current.redo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  return {
    scope, setScope, draft, baseline, inherited, versions, publishedRow,
    loading, loadFailed, busy, error, setError, notice, setNotice, note, setNote,
    pending, savedDraftCurrent, conflict, clearConflict: () => setConflict(null),
    changes, overrideCount, audit, dirty,
    canUndo: canUndo(history), canRedo: canRedo(history),
    undo, redo, setSection, setColor, setMapping, replaceDraft, resetToPublished, resetToInherited,
    saveDraft, publish, rollbackTo, restoreVersion, versionConfig, reload: () => load(scope),
  };
}
