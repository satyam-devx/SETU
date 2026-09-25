// SETU — navigation and URL security helpers.
const HTTP_PROTOCOLS = new Set(['http:', 'https:']);

export function safeExternalUrl(value, fallback = null) {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  try {
    const raw = value.trim().replace(/[\u0000-\u001f\u007f]/g, '');
    const url = new URL(raw, window.location.origin);
    if (!HTTP_PROTOCOLS.has(url.protocol)) return fallback;
    return url.href;
  } catch {
    return fallback;
  }
}

export function safeInternalRedirect(value, fallback = '/') {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  try {
    const url = new URL(value, window.location.origin);
    if (url.origin !== window.location.origin) return fallback;
    if (!url.pathname.startsWith('/')) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

export function safeTel(value, fallback = null) {
  if (typeof value !== 'string') return fallback;
  const cleaned = value.trim().replace(/[^0-9+]/g, '');
  return /^\+?[0-9]{7,15}$/.test(cleaned) ? `tel:${cleaned}` : fallback;
}
