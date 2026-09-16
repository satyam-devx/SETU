// ═══════════════════════════════════════════════════════════
// SETU — CategoryCard
// Extracted from CustomerHome so it can be shared with the
// CustomerCategories page (both the Home carousel and the full
// "All Categories" grid render the exact same tile).
//
// A 2x2 collage of real product photos from that category (falling
// back to the category's own icon for any cell with no photo, or the
// whole tile when the category has none at all yet), with an
// accurate "+N more" count floating on the bottom edge — replaces the
// old single-emoji tile with something that actually shows what's
// inside the category.
// ═══════════════════════════════════════════════════════════
import React from 'react';
import { Link } from 'react-router-dom';
import Img from '@/components/shared/Img';

export default function CategoryCard({ cat }) {
  const samples  = (cat.sample_images ?? []).filter(Boolean).slice(0, 4);
  const total    = cat.product_count ?? 0;
  const more     = Math.max(0, total - samples.length);
  const IconTile = ({ className = '' }) => (
    <div className={`flex items-center justify-center text-lg bg-primary/5 ${className}`} aria-hidden="true">
      {cat.icon || '🛒'}
    </div>
  );

  return (
    <Link
      to={`/customer/search?category=${cat.id}`}
      role="listitem"
      className="flex flex-col gap-1.5"
    >
      <div className="relative bg-muted/40 border border-border/60 rounded-2xl p-1.5">
        {samples.length === 0 ? (
          // No product photos yet for this category — one honest tile
          // instead of four identical, repetitive icon cells.
          <div className="aspect-square rounded-xl overflow-hidden">
            <Img
              src={cat.image_url}
              alt=""
              width={120}
              height={120}
              className="w-full h-full object-cover"
              fallback={<IconTile className="w-full h-full" />}
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="aspect-square rounded-lg overflow-hidden bg-card">
                {samples[i]
                  ? <Img src={samples[i]} alt="" width={60} height={60} className="w-full h-full object-cover" fallback={<IconTile className="w-full h-full" />} />
                  : <IconTile className="w-full h-full" />}
              </div>
            ))}
          </div>
        )}

        {more > 0 && (
          <div className="absolute left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2 bg-card border border-border rounded-full px-2.5 py-1 shadow-sm">
            <span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap">+{more} more</span>
          </div>
        )}
      </div>
      <span className="text-sm font-bold text-foreground leading-tight line-clamp-2 px-0.5">
        {cat.name}
      </span>
    </Link>
  );
}
