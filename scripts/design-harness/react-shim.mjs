/**
 * Minimal React hooks runtime so Studio state logic can run under plain Node
 * (no npm install, no DOM). Supports useState/useRef/useMemo/useCallback/useEffect
 * for a single hook instance. For component rendering, use the qa/ Vitest suite.
 */
// Minimal hooks runtime: enough to execute a custom hook in Node.
let current = null;
export function renderHook(fn) {
  const inst = { hooks: [], idx: 0, dirty: false, effects: [], result: undefined, renders: 0 };
  const render = () => {
    do {
      inst.dirty = false; inst.idx = 0; inst.effects = []; current = inst;
      inst.result = fn(); current = null; inst.renders++;
      for (const e of inst.effects) { e.h.cleanup?.(); e.h.cleanup = e.fn() || undefined; }
    } while (inst.dirty);
  };
  inst.schedule = () => { inst.dirty = true; if (!inst.rendering) { inst.rendering = true; queueMicrotask(() => { inst.rendering = false; render(); }); } };
  render();
  return { inst, get current() { return inst.result; }, async settle(n = 25) { for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0)); } };
}
const slot = () => { const i = current.idx++; return [current, i]; };
export function useState(init) {
  const [inst, i] = slot();
  if (!(i in inst.hooks)) inst.hooks[i] = { v: typeof init === 'function' ? init() : init };
  const h = inst.hooks[i];
  return [h.v, (n) => { const nv = typeof n === 'function' ? n(h.v) : n; if (!Object.is(nv, h.v)) { h.v = nv; inst.schedule(); } }];
}
export function useRef(init) { const [inst, i] = slot(); if (!(i in inst.hooks)) inst.hooks[i] = { current: init }; return inst.hooks[i]; }
export function useMemo(fn, deps) {
  const [inst, i] = slot(); const h = inst.hooks[i];
  if (!h || !deps || deps.length !== h.deps.length || deps.some((d, k) => !Object.is(d, h.deps[k]))) { inst.hooks[i] = { v: fn(), deps: deps || [] }; }
  return inst.hooks[i].v;
}
export const useCallback = (fn, deps) => useMemo(() => fn, deps);
export function useEffect(fn, deps) {
  const [inst, i] = slot(); const h = inst.hooks[i];
  const changed = !h || !deps || deps.some((d, k) => !Object.is(d, h.deps[k]));
  if (!h) inst.hooks[i] = { deps, cleanup: undefined };
  if (changed) { inst.hooks[i].deps = deps; inst.effects.push({ h: inst.hooks[i], fn }); }
}
export default { useState, useRef, useMemo, useCallback, useEffect };
