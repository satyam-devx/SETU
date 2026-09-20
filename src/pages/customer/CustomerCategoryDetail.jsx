// ═══════════════════════════════════════════════════════════
// SETU — CustomerCategoryDetail
//
// What clicking a category (Home's carousel, or the "All Categories"
// grid/shelves) now opens, instead of /customer/search?category=X.
// Search is a general browse-everything page with text/price/sort
// filters; this is the category's own page — name, icon, and every
// product in it, with real pagination instead of one shelf capped
// at 8 items.
//
// Products come from getProductsByCategory (migration 082's
// product_categories junction), so a product tagged with several
// categories shows up on all of their pages, not just one.
// ═══════════════════════════════════════════════════════════
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertCircle, Loader2 } from 'lucide-react';
import { useDataFetch } from '@/hooks/useDataFetch';
import { useInView } from '@/hooks/useInView';
import { getCategories, getProductsByCategory } from '@/lib/api';
import { ProductCardSkeleton } from '@/components/shared/SkeletonCard';
import EmptyState from '@/components/shared/EmptyState';
import ProductCard from '@/components/customer/ProductCard';
import { smartGoBack } from '@/lib/utils';

const PAGE_SIZE = 20;

export default function CustomerCategoryDetail() {
  const { categoryId } = useParams();
  const navigate = useNavigate();

  // getCategories() is cached app-wide (cacheKey: 'categories') and
  // already fetched on Home/Categories before a customer could ever
  // reach this page by tapping a tile — .find() off the cached list
  // instead of a second network round trip for one row.
  const { data: allCategories } = useDataFetch(
    () => getCategories(), [], { cacheKey: 'categories', staleTime: 120_000 }
  );
  const category = (allCategories ?? []).find(c => c.id === categoryId);

  const [products,    setProducts]    = useState([]);
  const [page,         setPage]        = useState(0);
  const [hasMore,      setHasMore]     = useState(true);
  const [isLoading,    setIsLoading]   = useState(true);
  const [isLoadingMore,setIsLoadingMore] = useState(false);
  const [error,        setError]       = useState(null);
  const [loadSeq,       setLoadSeq]     = useState(0); // bump to retry/reset

  // Reset and reload from page 0 whenever the category itself changes
  // (or "Try again" is tapped, via loadSeq).
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setProducts([]);
    setPage(0);
    setHasMore(true);

    getProductsByCategory(categoryId, { page: 0, limit: PAGE_SIZE }).then(({ data, error: err }) => {
      if (cancelled) return;
      setIsLoading(false);
      if (err) { setError(err); return; }
      setProducts(data ?? []);
      setHasMore((data ?? []).length === PAGE_SIZE);
    });

    return () => { cancelled = true; };
  }, [categoryId, loadSeq]);

  const loadMore = async () => {
    if (isLoadingMore || isLoading || !hasMore) return;
    setIsLoadingMore(true);
    const nextPage = page + 1;
    const { data, error: err } = await getProductsByCategory(categoryId, { page: nextPage, limit: PAGE_SIZE });
    setIsLoadingMore(false);
    if (err) return; // leave the page as-is; the sentinel will retry on next scroll
    setProducts(prev => [...prev, ...(data ?? [])]);
    setPage(nextPage);
    setHasMore((data ?? []).length === PAGE_SIZE);
  };

  // Infinite scroll — reuses the same IntersectionObserver hook the
  // Categories page's lazy shelves already use, rather than a new
  // scroll-position listener.
  const [sentinelRef, sentinelInView] = useInView({ rootMargin: '400px 0px', triggerOnce: false });
  useEffect(() => {
    if (sentinelInView) loadMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sentinelInView]);

  return (
    <div className="pb-20">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => smartGoBack(navigate, '/customer/categories')}
            className="touch-target -ml-2 flex items-center justify-center shrink-0 rounded-lg hover:bg-muted transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5" aria-hidden="true" />
          </button>
          <span className="text-lg shrink-0" aria-hidden="true">{category?.icon || '🛒'}</span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm truncate">{category?.name || 'Category'}</p>
            {category?.name_hindi && (
              <p className="text-[10px] text-muted-foreground truncate">{category.name_hindi}</p>
            )}
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="grid grid-cols-2 gap-3 p-4">
          {Array.from({ length: 6 }).map((_, i) => <ProductCardSkeleton key={i} />)}
        </div>
      )}

      {!isLoading && error && (
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
          <AlertCircle className="w-10 h-10 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">Could not load products.</p>
          <button onClick={() => setLoadSeq(s => s + 1)} className="text-xs text-primary underline">
            Try again
          </button>
        </div>
      )}

      {!isLoading && !error && products.length === 0 && (
        <EmptyState
          emoji="🛒"
          title="No products here yet"
          description="Check back soon — vendors are still stocking this category."
          size="lg"
        />
      )}

      {!isLoading && !error && products.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3 p-4">
            {products.map(p => <ProductCard key={p.id} product={p} />)}
          </div>

          {hasMore && (
            <div ref={sentinelRef} className="flex items-center justify-center py-6">
              {isLoadingMore && (
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" aria-hidden="true" />
              )}
            </div>
          )}
          {!hasMore && products.length >= PAGE_SIZE && (
            <p className="text-xs text-muted-foreground text-center py-6">
              You've reached the end.
            </p>
          )}
        </>
      )}
    </div>
  );
}
