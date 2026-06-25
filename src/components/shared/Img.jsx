// ═══════════════════════════════════════════════════════════
// SETU — <Img>  (Phase 5 — 2G image diet)
//
// Drop-in replacement for <img> on remote vendor/product photos:
//   • lazy-loads off-screen images (loading="lazy")
//   • async-decodes so it never blocks the main thread
//   • requests a resized/recompressed source via optimizedSrc()
//   • falls back to the original URL if the transform 404s, then to a
//     muted placeholder if the image itself fails to load
//   • takes explicit width/height to avoid cumulative layout shift
//
// Usage:
//   <Img src={p.image_url} alt={p.name} width={160} className="rounded-xl" />
//
// Always pass a meaningful `alt` (a11y). Use alt="" only for purely
// decorative images.
// ═══════════════════════════════════════════════════════════
import React, { useState } from 'react';
import { optimizedSrc } from '@/lib/img';

export default function Img({
  src,
  alt = '',
  width,
  height,
  quality,
  className = '',
  fallback = null,
  ...rest
}) {
  // 0 = optimized, 1 = original (transform failed), 2 = broken
  const [stage, setStage] = useState(0);

  if (!src || stage === 2) {
    return (
      fallback ?? (
        <div
          className={`bg-muted flex items-center justify-center text-muted-foreground text-xs ${className}`}
          style={{ width, height }}
          role="img"
          aria-label={alt || 'image unavailable'}
        >
          {/* simple glyph placeholder */}
          🛒
        </div>
      )
    );
  }

  const finalSrc = stage === 0 ? optimizedSrc(src, { width, quality }) : src;

  return (
    <img
      src={finalSrc}
      alt={alt}
      loading="lazy"
      decoding="async"
      width={width}
      height={height}
      className={className}
      onError={() => setStage((s) => (s < 2 ? s + 1 : s))}
      {...rest}
    />
  );
}
