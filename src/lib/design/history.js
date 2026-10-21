/**
 * Minimal undo/redo history with change coalescing, so dragging a slider or
 * typing a HEX value is one undo step instead of dozens. Pure functions.
 */
export function createHistory(present, { limit = 100 } = {}) {
  return { past: [], present, future: [], limit, lastKey: null, lastAt: 0 };
}

export function pushHistory(history, next, { key = null, at = Date.now(), coalesceMs = 700 } = {}) {
  if (Object.is(next, history.present)) return history;
  if (key && history.lastKey === key && at - history.lastAt < coalesceMs) {
    return { ...history, present: next, future: [], lastAt: at };
  }
  return {
    ...history,
    past: [...history.past, history.present].slice(-history.limit),
    present: next,
    future: [],
    lastKey: key,
    lastAt: at,
  };
}

export const canUndo = (h) => h.past.length > 0;
export const canRedo = (h) => h.future.length > 0;

export function undo(history) {
  if (!canUndo(history)) return history;
  const past = history.past.slice(0, -1);
  return { ...history, past, present: history.past[history.past.length - 1], future: [history.present, ...history.future], lastKey: null };
}

export function redo(history) {
  if (!canRedo(history)) return history;
  const [present, ...future] = history.future;
  return { ...history, past: [...history.past, history.present], present, future, lastKey: null };
}

/** Replace everything (e.g. after loading another scope). */
export const resetHistory = (history, present) => createHistory(present, { limit: history.limit });
