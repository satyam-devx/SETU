// SETU — Phase 8 Media Engineering
// Centralizes responsive image delivery, CDN transforms and base-path-safe assets.

const SUPABASE_PUBLIC_OBJECT = '/storage/v1/object/public/';
const SUPABASE_RENDER_IMAGE = '/storage/v1/render/image/public/';

export const IMAGE_SIZES = {
  thumb: 160,
  card: 320,
  detail: 640,
  original: 1280,
};

const CDN_BASE = String(import.meta.env.VITE_IMAGE_CDN_URL || '').replace(/\/$/, '');

export function assetUrl(path) {
  if (!path) return path;
  if (/^(?:https?:|data:|blob:|\/\/)/i.test(path)) return path;
  const base = import.meta.env.BASE_URL || '/';
  const clean = String(path).replace(/^\/+/, '');
  return `${base.replace(/\/$/, '/')}${clean}`;
}

function transformUrl(url, width, { quality = 72, format = 'webp' } = {}) {
  if (!url || typeof url !== 'string') return url;

  // Optional image CDN. Contract: the CDN accepts the original URL as `url`
  // and width/quality/format as query parameters. It is opt-in so existing
  // Supabase deployments keep working without configuration changes.
  if (CDN_BASE) {
    const params = new URLSearchParams({ url, w: String(Math.round(width)), q: String(quality), fm: format });
    return `${CDN_BASE}?${params.toString()}`;
  }

  if (url.includes(SUPABASE_PUBLIC_OBJECT)) {
    const base = url.split('?')[0].replace(SUPABASE_PUBLIC_OBJECT, SUPABASE_RENDER_IMAGE);
    const params = new URLSearchParams();
    params.set('width', String(Math.round(width)));
    params.set('quality', String(quality));
    params.set('resize', 'contain');
    // Supabase Image Transform uses the origin format for this deployment;
    // do not advertise AVIF/WebP while asking Supabase for unsupported formats.
    return `${base}?${params.toString()}`;
  }

  return url;
}

export function imageSources(url, { width, quality = 72, formats = ['avif', 'webp'] } = {}) {
  if (!url || !width) return { src: url, srcSet: '', sources: [] };
  const widths = [...new Set([Math.round(width * 0.5), Math.round(width), Math.round(width * 1.5), Math.round(width * 2)])]
    .filter(Boolean)
    .map((w) => Math.max(80, Math.min(IMAGE_SIZES.original, w)));
  const uniqueWidths = [...new Set(widths)].sort((a, b) => a - b);
  const supportsFormatVariants = !url.includes(SUPABASE_PUBLIC_OBJECT);
  const sources = supportsFormatVariants ? formats.map((format) => ({
    type: `image/${format}`,
    srcSet: uniqueWidths.map((w) => `${transformUrl(url, w, { quality, format })} ${w}w`).join(', '),
  })) : [];
  return {
    src: transformUrl(url, Math.round(width), { quality, format: 'webp' }),
    srcSet: uniqueWidths.map((w) => `${transformUrl(url, w, { quality, format: 'webp' })} ${w}w`).join(', '),
    sources,
  };
}

export function optimizedSrc(url, opts = {}) {
  const width = opts.width;
  if (!url || !width) return url;
  return transformUrl(url, width, opts);
}

/** Remove a Supabase public storage object when an old image is replaced/deleted. */
export async function deleteStorageObject(supabaseClient, bucket, objectUrl) {
  if (!supabaseClient || !bucket || !objectUrl) return { error: null };
  try {
    const marker = `/storage/v1/object/public/${bucket}/`;
    const index = String(objectUrl).indexOf(marker);
    if (index === -1) return { error: null };
    const path = decodeURIComponent(String(objectUrl).slice(index + marker.length).split('?')[0]);
    if (!path) return { error: null };
    return await supabaseClient.storage.from(bucket).remove([path]);
  } catch (error) {
    return { error };
  }
}
