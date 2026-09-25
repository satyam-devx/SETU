// F1-G/F1-H: durable queue for explicitly safe/retryable mutations.
// Financial mutations must NOT be queued here unless their server contract
// explicitly guarantees idempotent replay and reconciliation.

const STORAGE_KEY = 'setu.offline.mutation.queue.v1';
const MAX_QUEUE_ITEMS = 50;
const MAX_ITEM_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_ATTEMPTS = 5;
let flushing = false;

function read() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || '[]';
    const now = Date.now();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(item => item && now - Number(item.createdAt || now) <= MAX_ITEM_AGE_MS);
  } catch {
    return [];
  }
}

function write(items) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(-MAX_QUEUE_ITEMS)));
    return true;
  } catch (error) {
    // Quota/private-mode failures must be visible to the caller; silently
    // pretending a mutation was queued creates a false durability guarantee.
    console.warn('[SETU] offline mutation queue storage unavailable:', error?.message || error);
    return false;
  }
}

function createId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `offline-${crypto.randomUUID()}`;
  }
  return `offline-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getOfflineMutationQueue() {
  const items = read();
  write(items); // compact expired entries opportunistically
  return items;
}

export function enqueueOfflineMutation(mutation) {
  const item = {
    id: mutation.id || createId(),
    createdAt: Date.now(),
    attempts: 0,
    ...mutation,
  };
  const q = read();
  q.push(item);
  if (!write(q)) return null;
  return item;
}

export function registerOfflineMutationHandler(key, handler) {
  if (!globalThis.__SETU_OFFLINE_HANDLERS__) globalThis.__SETU_OFFLINE_HANDLERS__ = {};
  globalThis.__SETU_OFFLINE_HANDLERS__[key] = handler;
  return () => { delete globalThis.__SETU_OFFLINE_HANDLERS__[key]; };
}

export async function flushOfflineMutations() {
  if (flushing || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    return { flushed: 0, remaining: read().length };
  }

  flushing = true;
  let q = read();
  let flushed = 0;
  try {
    for (const item of [...q]) {
      const handler = globalThis.__SETU_OFFLINE_HANDLERS__?.[item.handlerKey];
      if (typeof handler !== 'function') continue;
      try {
        await handler(item.payload);
        flushed++;
        q = q.filter(x => x.id !== item.id);
        write(q);
      } catch (error) {
        item.attempts++;
        item.lastErrorAt = Date.now();
        item.lastError = error?.message || String(error || 'Mutation failed');
        if (item.attempts >= MAX_ATTEMPTS) {
          q = q.filter(x => x.id !== item.id);
        }
        write(q);
        // A transient failure in one mutation must not block unrelated
        // queued mutations behind it. The failed item remains queued until
        // its retry budget is exhausted or its age expires.
        continue;
      }
    }
  } finally {
    flushing = false;
  }
  return { flushed, remaining: q.length };
}
