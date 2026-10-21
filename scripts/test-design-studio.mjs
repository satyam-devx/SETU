/**
 * Executes the Studio state machine (useDesignStudio) against an in-memory fake of
 * the database RPCs. Run with:
 *   node --import ./scripts/design-harness/register.mjs --test scripts/test-design-studio.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.window = { addEventListener() {}, removeEventListener() {} };
const { renderHook } = await import('./design-harness/react-shim.mjs');
const api = await import('./design-harness/fake-api.mjs');
const { useDesignStudio } = await import('../src/pages/superadmin/design-system/useDesignStudio.js');
const { DEFAULT_DESIGN, sanitizeConfig, mergeDesign } = await import('../src/lib/design/schema.js');
const { autoFixContrast } = await import('../src/lib/design/a11y.js');
const { __db, reset } = api;

async function mount(opts = {}) { const h = renderHook(() => useDesignStudio(opts)); await h.settle(); return h; }
const act = async (h, fn) => { const r = await fn(h.current); await h.settle(); return r; };
const seedGlobal = (config) => { __db.rows.push({ id: `g${++__db.seq}`, scope: 'global', version: 1, config, status: 'published', note: '', published_at: 'x' }); };

test('initial load of an empty database uses defaults and is clean', async () => {
  reset(); const h = await mount();
  assert.equal(h.current.loading, false); assert.equal(h.current.loadFailed, false);
  assert.deepEqual(h.current.draft, DEFAULT_DESIGN); assert.equal(h.current.dirty, false); assert.equal(h.current.versions.length, 0);
});

test('edits track changes, coalesce per control, and undo/redo', async () => {
  reset(); const h = await mount();
  await act(h, (s) => { for (let i = 0; i < 5; i++) s.setColor('light', 'primary', ['#111111', '#222222', '#333333', '#444444', '#555555'][i]); });
  assert.equal(h.current.dirty, true); assert.equal(h.current.changes.length, 1); assert.equal(h.current.draft.colors.primary, '#555555');
  await act(h, (s) => s.setSection('layout', 'radius', '8px'));
  assert.equal(h.current.changes.length, 2);
  await act(h, (s) => s.undo()); assert.equal(h.current.draft.layout.radius, '12px');
  await act(h, (s) => s.undo()); assert.equal(h.current.draft.colors.primary, DEFAULT_DESIGN.colors.primary, 'five rapid edits undo as ONE step');
  assert.equal(h.current.dirty, false); assert.equal(h.current.canUndo, false); assert.equal(h.current.canRedo, true);
  await act(h, (s) => s.redo()); assert.equal(h.current.draft.colors.primary, '#555555');
});

test('saveDraft stores the full config for global, tags a11y failures, and flags savedDraftCurrent', async () => {
  reset(); const h = await mount();
  await act(h, (s) => { s.setNote('Festival colors'); s.setColor('light', 'primary', '#123456'); });
  const saved = await act(h, (s) => s.saveDraft());
  assert.ok(saved && saved.version === 1);
  const call = __db.calls.find((c) => c[0] === 'saveDraft');
  assert.equal(call[1], 'global'); assert.equal(call[2].colors.primary, '#123456'); assert.ok(call[2].darkColors && call[2].typography, 'global saves everything');
  assert.match(call[3], /^Festival colors \[a11y: \d+ AA failures?\]$/, `note was: ${call[3]}`);
  assert.equal(h.current.savedDraftCurrent, true); assert.equal(h.current.versions[0].status, 'draft');
  await act(h, (s) => s.setSection('layout', 'radius', '16px'));
  assert.equal(h.current.savedDraftCurrent, false, 'further edits invalidate the saved draft');
});

test('after auto-fix there is no a11y tag in the note', async () => {
  reset(); const h = await mount();
  await act(h, (s) => s.replaceDraft(autoFixContrast(s.draft).config));
  assert.equal(h.current.audit.summary.errors, 0);
  await act(h, (s) => s.saveDraft());
  assert.equal(__db.calls.find((c) => c[0] === 'saveDraft')[3], '');
});

test('publish: saves, publishes, updates baseline, notifies, and records the live version', async () => {
  reset(); let notified = 0; const h = await mount({ onPublished: () => { notified++; } });
  await act(h, (s) => s.setColor('light', 'primary', '#123456'));
  const res = await act(h, (s) => s.publish());
  assert.equal(res.ok, true); assert.equal(res.version, 1); assert.equal(notified, 1);
  assert.equal(h.current.dirty, false); assert.equal(h.current.publishedRow.version, 1); assert.equal(h.current.baseline.colors.primary, '#123456');
  assert.equal(h.current.canUndo, true, 'undo history survives publishing');
  // a second publish with an already-saved draft must not double-save
  await act(h, (s) => s.setColor('light', 'primary', '#654321'));
  await act(h, (s) => s.saveDraft());
  const before = __db.calls.filter((c) => c[0] === 'saveDraft').length;
  await act(h, (s) => s.publish());
  assert.equal(__db.calls.filter((c) => c[0] === 'saveDraft').length, before, 'reuses the saved draft');
  assert.equal(h.current.publishedRow.version, 2, "v1 published, then the saved draft v2 was reused");
});

test('scoped portals save ONLY overrides and keep inheriting Global changes', async () => {
  reset(); seedGlobal(sanitizeConfig({ colors: { primary: '#4F46E5' } }));
  const h = await mount({ initialScope: 'vendor' });
  assert.equal(h.current.draft.colors.primary, '#4F46E5', 'scoped editor starts from the Global design');
  assert.equal(h.current.overrideCount, 0);
  await act(h, (s) => s.setColor('light', 'accent', '#112233'));
  assert.equal(h.current.overrideCount, 1);
  await act(h, (s) => s.publish());
  const saved = __db.calls.find((c) => c[0] === 'saveDraft');
  assert.deepEqual(saved[2], { colors: { accent: '#112233' } }, 'payload is the minimal override, not a frozen copy');
  // another admin changes Global primary later
  __db.rows.find((r) => r.scope === 'global').config = sanitizeConfig({ colors: { primary: '#0E7490' } });
  await act(h, (s) => s.reload());
  assert.equal(h.current.draft.colors.primary, '#0E7490', 'Global change propagates into the portal');
  assert.equal(h.current.draft.colors.accent, '#112233', 'portal override preserved');
  await act(h, (s) => s.resetToInherited());
  assert.equal(h.current.overrideCount, 0);
});

test('publishing is blocked with a conflict when someone else published first; force overrides', async () => {
  reset(); const h = await mount();
  await act(h, (s) => s.setColor('light', 'primary', '#123456'));
  // another admin publishes v1 after we loaded
  __db.rows.push({ id: 'other', scope: 'global', version: 1, config: DEFAULT_DESIGN, status: 'published', note: 'theirs', published_at: 'x' });
  const blocked = await act(h, (s) => s.publish());
  assert.equal(blocked.ok, false); assert.equal(blocked.conflict, true);
  assert.deepEqual(h.current.conflict, { latest: 1, yours: null });
  assert.equal(__db.calls.filter((c) => c[0] === 'publish').length, 0, 'nothing was published');
  const forced = await act(h, (s) => s.publish({ force: true }));
  assert.equal(forced.ok, true); assert.equal(h.current.conflict, null);
  assert.equal(h.current.publishedRow.version, 2); assert.equal(__db.rows.find((r) => r.id === 'other').status, 'superseded');
});

test('rollbackTo makes an older version live and reloads the editor', async () => {
  reset(); const h = await mount();
  await act(h, (s) => s.setColor('light', 'primary', '#111111')); await act(h, (s) => s.publish());
  await act(h, (s) => s.setColor('light', 'primary', '#222222')); await act(h, (s) => s.publish());
  assert.equal(h.current.publishedRow.version, 2);
  const v1 = h.current.versions.find((v) => v.version === 1); assert.equal(v1.status, 'superseded');
  const r = await act(h, (s) => s.rollbackTo(v1));
  assert.equal(r.ok, true); assert.equal(h.current.publishedRow.version, 1);
  assert.equal(h.current.draft.colors.primary, '#111111'); assert.equal(h.current.dirty, false);
  assert.match(h.current.notice, /Rolled back: v1/);
});

test('restoreVersion loads a stored version into the editor as a single undoable step', async () => {
  reset(); const h = await mount();
  await act(h, (s) => s.setColor('light', 'primary', '#111111')); await act(h, (s) => s.publish());
  await act(h, (s) => s.setColor('light', 'primary', '#999999'));
  await act(h, (s) => s.restoreVersion(h.current.versions[0]));
  assert.equal(h.current.draft.colors.primary, '#111111');
  await act(h, (s) => s.undo()); assert.equal(h.current.draft.colors.primary, '#999999');
});

test('a failed load blocks saving and publishing instead of overwriting the real design with defaults', async () => {
  reset(); __db.fail = true; const h = await mount();
  assert.equal(h.current.loadFailed, true); assert.match(h.current.error, /Failed to fetch/);
  const before = __db.calls.length;
  assert.equal(await act(h, (s) => s.saveDraft()), null);
  assert.deepEqual(await act(h, (s) => s.publish()), { ok: false });
  assert.equal(__db.calls.length, before, 'no write RPCs were attempted');
  __db.fail = false; await act(h, (s) => s.reload());
  assert.equal(h.current.loadFailed, false);
});

test('server-side rejection surfaces as an error and does not mark the draft saved', async () => {
  reset(); const h = await mount();
  // simulate a client/server drift: poison the draft past what the server accepts
  await act(h, (s) => s.setSection('layout', 'radius', '3px'));
  const saved = await act(h, (s) => s.saveDraft());
  assert.equal(saved, null); assert.match(h.current.error, /Rejected by server/); assert.equal(h.current.savedDraftCurrent, false); assert.equal(h.current.busy, null);
});

test('switching scope loads that scope and drops the old draft', async () => {
  reset(); seedGlobal(sanitizeConfig({ colors: { primary: '#4F46E5' } }));
  const h = await mount();
  await act(h, (s) => s.setColor('light', 'accent', '#112233'));
  assert.equal(h.current.dirty, true);
  await act(h, (s) => s.setScope('rider'));
  assert.equal(h.current.scope, 'rider'); assert.equal(h.current.dirty, false); assert.equal(h.current.draft.colors.accent, DEFAULT_DESIGN.colors.accent);
  assert.equal(h.current.draft.colors.primary, '#4F46E5');
});
