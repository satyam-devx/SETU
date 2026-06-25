// ═══════════════════════════════════════════════════════════
// SETU — Image optimization helpers (Phase 5 — 2G image diet)
//
// Vendor/product images are arbitrary URLs. On a 2G connection a few
// full-resolution photos can dominate page load. optimizedSrc() asks
// the host to serve a resized, recompressed image when it can:
//
//   • Supabase Storage public objects → the render/image transform
//     endpoint (width + quality). Requires image transformations
//     enabled on the project; if not, the <Img> component below falls
//     back to the original URL on error.
//
// Unknown hosts are returned unchanged — the win there comes from the
// <Img> component's lazy-loading + explicit dimensions (no layout
// shift, deferred off-screen fetches), which help regardless of host.
// ═══════════════════════════════════════════════════════════

const SUPABASE_PUBLIC_OBJECT = '/storage/v1/object/public/';
const SUPABASE_RENDER_IMAGE  = '/storage/v1/render/image/public/';

/**
 * @param {string} url
 * @param {{width?: number, quality?: number}} opts
 * @returns {string} an optimized URL when supported, else the original
 */
export function optimizedSrc(url, { width, quality = 70 } = {}) {
  if (!url || typeof url !== 'string') return url;

  if (url.includes(SUPABASE_PUBLIC_OBJECT)) {
    const base = url.split('?')[0].replace(SUPABASE_PUBLIC_OBJECT, SUPABASE_RENDER_IMAGE);
    const params = new URLSearchParams();
    if (width) params.set('width', String(Math.round(width)));
    params.set('quality', String(quality));
    params.set('resize', 'cover');
    return `${base}?${params.toString()}`;
  }

  return url;
}
