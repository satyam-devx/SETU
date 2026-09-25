// SETU F1-G — network state + recovery coordination.
// Browser/WebView safe: navigator may be unavailable during SSR/tests.
let online = typeof navigator === 'undefined' ? true : navigator.onLine !== false;
const listeners = new Set();
let installed = false;

function notify() { for (const listener of listeners) { try { listener(online); } catch (e) { console.error('[SETU Network] listener error', e); } } }
function install() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('online', () => { online = true; notify(); });
  window.addEventListener('offline', () => { online = false; notify(); });
}
install();

export function isNetworkOnline() { return online; }
export function subscribeNetwork(listener) {
  install();
  if (typeof listener !== 'function') return () => {};
  listeners.add(listener);
  listener(online);
  return () => listeners.delete(listener);
}
