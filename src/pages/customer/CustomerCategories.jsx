// ═══════════════════════════════════════════════════════════
// SETU — CustomerCategories
//
// The page Home's "Categories → See All" now actually leads to
// (it used to redirect to /customer/search, which has no concept
// of "all categories" at all). Two parts:
//   1. A complete, searchable grid of every category — fixes the
//      Home page's hardcoded 6-category cap for real, here.
//   2. A lazy-loaded "shelf" of real products under each category
//      that has any, so this page is a destination in its own
//      right and not just another tile screen.
// Each shelf only fetches once it's about to scroll into view
// (useInView) to keep the initial load light for 2G/low-end
// Android — this app's primary environment.
// ═══════════════════════════════════════════════════════════
import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useDataFetch } from '@/hooks/useDataFetch';
import { useInView } from '@/hooks/useInView';
import { getCategoryPreviews, getProducts } from '@/lib/api';
import { CategorySkeleton, ProductCardSkeleton } from '@/components/shared/SkeletonCard';
import EmptyState from '@/components/shared/EmptyState';
import CategoryCard from '@/components/customer/CategoryCard';
import ProductCard from '@/components/customer/ProductCard';
import { smartGoBack } from '@/lib/utils';

function ShelfSkeletonRow() {
  return (
    <div className="flex gap-3">
      {[1, 2, 3].map(i => (
        <div key={i} className="w-40 shrink-0"><ProductCardSkeleton /></div>
      ))}
    </div>
  );
}

// One category's horizontal product shelf. Fetches nothing until
// the section is within `rootMargin` of the viewport.
function CategoryShelf({ cat }) {
  const [ref, inView] = useInView({ rootMargin: '400px 0px' });

  const { data: products, isLoading, error } = useDataFetch(
    () => getProducts({ category: cat.name, limit: 8 }),
    [cat.name],
    { cacheKey: `categories-page:shelf:${cat.id}`, enabled: inView, staleTime: 60_000 }
  );

  return (
    <section ref={ref} className="mb-6" aria-labelledby={`cat-shelf-${cat.id}`}>
      <div className="section-header px-4">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg shrink-0" aria-hidden="true">{cat.icon || '🛒'}</span>
          <div className="min-w-0">
            <h3 id={`cat-shelf-${cat.id}`} className="section-title truncate">{cat.name}</h3>
            {cat.name_hindi && (
              <p className="text-[10px] text-muted-foreground truncate">{cat.name_hindi}</p>
            )}
          </div>
        </div>
        <Link to={`/customer/category/${cat.id}`} className="section-link shrink-0">View all</Link>
      </div>

      <div className="scroll-strip px-4">
        {!inView || isLoading ? (
          <ShelfSkeletonRow />
        ) : error ? (
          <p className="text-xs text-muted-foreground py-4">Could not load products.</p>
        ) : (
          (products ?? []).map(p => (
            <div key={p.id} className="w-40 shrink-0"><ProductCard product={p} /></div>
          ))
        )}
      </div>
    </section>
  );
}

export default function CustomerCategories() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const { data: categories, isLoading, error, refetch } = useDataFetch(
    () => getCategoryPreviews(),
    [],
    { cacheKey: 'category-previews' }
  );

  const list = categories ?? [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(c =>
      c.name?.toLowerCase().includes(q) ||
      c.name_hindi?.toLowerCase().includes(q)
    );
  }, [list, query]);

  // Only categories with real stock get a product shelf — an empty
  // shelf would just look broken for a category the admin hasn't
  // stocked yet (the grid above still lists it either way).
  const shelvesToShow = useMemo(
    () => filtered.filter(c => (c.product_count ?? 0) > 0),
    [filtered]
  );

  return (
    <div className="pb-20">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3 space-y-2">
        <div className="flex items-center gap-3">
          <button
            onClick={() => smartGoBack(navigate)}
            className="touch-target -ml-2 flex items-center justify-center shrink-0 rounded-lg hover:bg-muted transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5" aria-hidden="true" />
          </button>
          <span className="font-semibold text-sm flex-1">All Categories</span>
          {!isLoading && !error && list.length > 0 && (
            <span className="chip-primary rounded-full px-2 py-0.5 text-[11px] font-semibold">
              {list.length}
            </span>
          )}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
          <Input
            placeholder="Search categories..."
            className="pl-9 h-8 text-sm"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
      </div>

      {isLoading && <div className="px-4 py-4"><CategorySkeleton count={9} /></div>}

      {!isLoading && error && (
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
          <AlertCircle className="w-10 h-10 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">Could not load categories.</p>
          <button onClick={refetch} className="text-xs text-primary underline">Try again</button>
        </div>
      )}

      {!isLoading && !error && list.length === 0 && (
        <EmptyState emoji="🛒" title="No categories yet" size="lg" />
      )}

      {!isLoading && !error && list.length > 0 && (
        <>
          <section className="px-4 pt-4" aria-labelledby="all-cats-title">
            <div className="section-header">
              <h3 id="all-cats-title" className="section-title">Browse by category</h3>
            </div>
            {filtered.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">
                No categories match &ldquo;{query}&rdquo;.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-3" role="list">
                {filtered.map(cat => <CategoryCard key={cat.id} cat={cat} />)}
              </div>
            )}
          </section>

          {shelvesToShow.length > 0 && (
            <div className="mt-6">
              <h3 className="section-title px-4 mb-1">Explore products</h3>
              {shelvesToShow.map(cat => <CategoryShelf key={cat.id} cat={cat} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
