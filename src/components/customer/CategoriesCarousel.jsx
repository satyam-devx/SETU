// ═══════════════════════════════════════════════════════════
// SETU — CategoriesCarousel
//
// Home's "Categories" section, redesigned so adding more
// categories from the admin panel never changes the grid shape.
// The grid stays a fixed 3-column × 2-row deck (exactly what
// used to be hardcoded as `.slice(0, 6)`) — extra categories
// instead page the deck sideways, like a home-screen of app
// icons: snap-scrolled, dot-paginated, swipe-hinted, and capped
// off with a dedicated "Explore all" finale card that hands off
// to the full Categories page.
//
// Built entirely on native CSS scroll-snap + IntersectionObserver-
// free scroll tracking (no carousel library) to stay light on the
// low-end/2G Android devices this app targets — the codebase
// already dropped framer-motion for exactly this reason (see
// CHANGELOG.md / index.css).
// ═══════════════════════════════════════════════════════════
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import CategoryCard from './CategoryCard';

const PAGE_SIZE = 6; // 3 columns × 2 rows — fixed Home grid

export default function CategoriesCarousel({ categories }) {
  const scrollerRef = useRef(null);
  const [page, setPage] = useState(0);
  const [hasScrolled, setHasScrolled] = useState(false);

  // Home intentionally shows only the first 6 categories.
  // All remaining categories stay on the dedicated Categories page,
  // so the Home section never grows into multiple horizontal pages.
  const pages = useMemo(() => {
    if (categories.length === 0) return [];
    return [categories.slice(0, PAGE_SIZE)];
  }, [categories]);

  const hasFinale  = categories.length > PAGE_SIZE;
  const totalPages = pages.length + (hasFinale ? 1 : 0);

  const goToPage = useCallback((i) => {
    const el = scrollerRef.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(i, totalPages - 1));
    el.children[clamped]?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
  }, [totalPages]);

  const handleScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el || el.clientWidth === 0) return;
    setHasScrolled(true);
    const children = Array.from(el.children);
    if (children.length) {
      const nearest = children.reduce((best, child, i) => {
        const distance = Math.abs(child.offsetLeft - el.scrollLeft);
        return distance < best.distance ? { index: i, distance } : best;
      }, { index: 0, distance: Infinity });
      setPage(nearest.index);
    }
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); goToPage(page + 1); }
    if (e.key === 'ArrowLeft')  { e.preventDefault(); goToPage(page - 1); }
  };

  return (
    <div>
      <div className="relative">
        <div
          ref={scrollerRef}
          onScroll={handleScroll}
          onKeyDown={handleKeyDown}
          tabIndex={totalPages > 1 ? 0 : -1}
          className="scroll-strip-snap px-4 gap-3"
          role="region"
          aria-label="Categories, swipe for more"
        >
          {pages.map((pageCats, pi) => (
            <div key={pi} className="grid grid-cols-3 grid-rows-2 gap-3 w-full shrink-0 snap-start" role="list">
              {pageCats.map((cat, ci) => (
                <div
                  key={cat.id}
                  className={pi === 0 ? 'animate-fade-in-delayed' : ''}
                  style={pi === 0 ? { animationDelay: `${ci * 35}ms` } : undefined}
                >
                  <CategoryCard cat={cat} />
                </div>
              ))}
            </div>
          ))}

          {hasFinale && (
            <div className="w-full shrink-0 snap-start flex">
              <Link
                to="/customer/categories"
                className="w-full rounded-2xl border border-dashed border-primary/30 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 flex flex-col items-center justify-center gap-2.5 py-7 text-center active:scale-[0.98] transition-transform"
              >
                <div className="flex -space-x-2.5" aria-hidden="true">
                  {categories.slice(0, 5).map(c => (
                    <span
                      key={c.id}
                      className="w-9 h-9 rounded-full bg-card border-2 border-background flex items-center justify-center text-sm shadow-sm"
                    >
                      {c.icon || '🛒'}
                    </span>
                  ))}
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">Explore all {categories.length} categories</p>
                  <p className="text-[11px] text-muted-foreground flex items-center justify-center gap-0.5 mt-0.5">
                    See everything in one place
                    <ChevronRight className="w-3 h-3" aria-hidden="true" />
                  </p>
                </div>
              </Link>
            </div>
          )}
        </div>

        {totalPages > 1 && !hasScrolled && (
          <div
            className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent flex items-center justify-end"
            aria-hidden="true"
          >
            <ChevronRight className="w-4 h-4 text-primary/70 animate-pulse mr-0.5" />
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-3" role="tablist" aria-label="Category pages">
          {Array.from({ length: totalPages }).map((_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={page === i}
              aria-label={`Page ${i + 1} of ${totalPages}`}
              onClick={() => goToPage(i)}
              className="w-6 h-6 flex items-center justify-center"
            >
              <span
                className={`block h-1.5 rounded-full transition-all duration-300 bg-primary ${
                  page === i ? 'w-4 opacity-100' : 'w-1.5 opacity-30'
                }`}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
