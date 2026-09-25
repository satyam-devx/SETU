import React, { useMemo, useState } from 'react';
import { imageSources } from '@/lib/media';

export default function Img({
  src,
  alt = '',
  width,
  height,
  quality = 72,
  sizes,
  eager = false,
  className = '',
  fallback = null,
  ...rest
}) {
  const [stage, setStage] = useState(0);
  const sources = useMemo(() => imageSources(src, { width, quality }), [src, width, quality]);

  if (!src || stage === 2) {
    return fallback ?? (
      <div
        className={`bg-muted flex items-center justify-center text-muted-foreground text-xs ${className}`}
        style={{ width, height }}
        role="img"
        aria-label={alt || 'image unavailable'}
      >🛒</div>
    );
  }

  const useOptimized = stage === 0 && sources.srcSet;
  const fallbackSrc = stage === 0 ? sources.src : src;

  return (
    <picture>
      {useOptimized && sources.sources.map((source) => (
        <source key={source.type} type={source.type} srcSet={source.srcSet} sizes={sizes || `${width}px`} />
      ))}
      <img
        src={fallbackSrc}
        srcSet={useOptimized ? sources.srcSet : undefined}
        sizes={useOptimized ? (sizes || `${width}px`) : undefined}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        fetchPriority={eager ? 'high' : 'auto'}
        decoding="async"
        width={width}
        height={height}
        className={className}
        onError={() => setStage((s) => (s < 2 ? s + 1 : s))}
        {...rest}
      />
    </picture>
  );
}
