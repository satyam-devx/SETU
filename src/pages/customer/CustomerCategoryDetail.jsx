import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Check, ChevronRight, Loader2, PackageSearch, RefreshCw, Sparkles } from 'lucide-react';
import { fetchProductsByCategoryPage } from '@/hooks/queries/useProducts';
import { useInView } from '@/hooks/useInView';
import { useCategories } from '@/hooks/queries/useCatalog';
import { ProductCardSkeleton } from '@/components/shared/SkeletonCard';
import ProductCard from '@/components/customer/ProductCard';
import AppHeader from '@/components/shared/AppHeader';

const PAGE_SIZE = 20;

export default function CustomerCategoryDetail() {
  const { categoryId } = useParams();
  const navigate = useNavigate();
  const { data: allCategories } = useCategories({ staleTime: 120_000 });
  const category = (allCategories ?? []).find(c => String(c.id) === String(categoryId));

  const [products, setProducts] = useState([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [retry, setRetry] = useState(0);
  const loadMoreLock = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setProducts([]);
    setPage(0);
    setHasMore(false);

    fetchProductsByCategoryPage(categoryId, 0, PAGE_SIZE).then(({ data, error: err }) => {
      if (cancelled) return;
      setIsLoading(false);
      if (err) { setError(err); return; }
      setProducts(data ?? []);
      setHasMore(Boolean(data?.hasMore));
    });

    return () => { cancelled = true; };
  }, [categoryId, retry]);

  const loadMore = async () => {
    if (loadMoreLock.current || isLoadingMore || isLoading || !hasMore) return;
    loadMoreLock.current = true;
    setIsLoadingMore(true);
    const nextPage = page + 1;
    const { data, error: err } = await fetchProductsByCategoryPage(categoryId, nextPage, PAGE_SIZE);
    setIsLoadingMore(false);
    loadMoreLock.current = false;
    if (err) return;
    setProducts(prev => [...prev, ...(data ?? [])]);
    setPage(nextPage);
    setHasMore(Boolean(data?.hasMore));
  };

  const [sentinelRef, sentinelInView] = useInView({ rootMargin: '500px 0px', triggerOnce: false });
  useEffect(() => {
    if (sentinelInView) loadMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sentinelInView]);

  const title = category?.name || 'Category';
  const icon = category?.icon || '🛒';

  return (
    <div className="pb-nav animate-fade-in" role="main">
      <AppHeader
        title={title}
        subtitle={products.length ? `${products.length}${hasMore ? '+' : ''} products available` : 'Shop from SETU local sellers'}
        showBack
        backTo="/customer"
        eyebrow="Shop by category"
        rightAction={(
          <button
            onClick={() => setRetry(v => v + 1)}
            className="touch-target w-10 h-10 rounded-[14px] border border-border/70 bg-background/75 flex items-center justify-center text-muted-foreground active:scale-95"
            aria-label="Refresh category"
          >
            <RefreshCw className="w-[17px] h-[17px]" />
          </button>
        )}
      />

      <section className="px-4 pt-1">
        <div className="relative overflow-hidden rounded-[26px] border border-primary/15 bg-gradient-to-br from-primary/10 via-card to-secondary/5 p-5 shadow-sm">
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/10 blur-2xl" aria-hidden="true" />
          <div className="relative flex items-center gap-4">
            <div className="w-[68px] h-[68px] rounded-[22px] bg-card border border-border/70 shadow-sm flex items-center justify-center text-[32px] shrink-0">
              {icon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-primary">
                <Sparkles className="w-3 h-3" /> SETU Marketplace
              </div>
              <h2 className="text-xl font-extrabold tracking-tight mt-1 truncate">{title}</h2>
              {category?.name_hindi && <p className="text-xs text-muted-foreground mt-0.5">{category.name_hindi}</p>}
            </div>
          </div>

          <div className="relative grid grid-cols-3 gap-2 mt-5">
            {['Local sellers', 'Fresh listings', 'Easy checkout'].map((label, i) => (
              <div key={label} className="rounded-2xl bg-card/80 border border-border/60 px-2.5 py-2.5 text-center">
                <Check className="w-3.5 h-3.5 text-primary mx-auto mb-1" />
                <p className="text-[9px] font-semibold leading-tight">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="px-4 pt-6 pb-2 flex items-end justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Browse products</p>
          <h3 className="text-lg font-extrabold tracking-tight mt-0.5">{products.length ? 'Available now' : 'Loading the shelf…'}</h3>
        </div>
        {products.length > 0 && <span className="text-[11px] font-semibold text-muted-foreground">Sorted by name</span>}
      </div>

      {isLoading && (
        <div className="grid grid-cols-2 gap-3 px-4 pb-6">
          {Array.from({ length: 6 }).map((_, i) => <ProductCardSkeleton key={i} />)}
        </div>
      )}

      {!isLoading && error && (
        <div className="mx-4 my-4 rounded-[24px] border border-destructive/20 bg-destructive/5 p-7 text-center">
          <PackageSearch className="w-10 h-10 mx-auto text-muted-foreground" />
          <h3 className="font-bold mt-3">We couldn't load this shelf</h3>
          <p className="text-xs text-muted-foreground mt-1">Your account and cart are safe. Please try again.</p>
          <button onClick={() => setRetry(v => v + 1)} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-4 py-2.5 text-xs font-bold active:scale-95">
            <RefreshCw className="w-3.5 h-3.5" /> Try again
          </button>
        </div>
      )}

      {!isLoading && !error && products.length === 0 && (
        <div className="mx-4 my-4 rounded-[26px] border border-border bg-card p-8 text-center shadow-sm">
          <div className="w-16 h-16 rounded-[22px] bg-muted mx-auto flex items-center justify-center text-3xl">{icon}</div>
          <h3 className="font-extrabold text-lg mt-4">Nothing here yet</h3>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto mt-1.5 leading-relaxed">No active products are linked to this category yet. Try another category or check back soon.</p>
          <button onClick={() => navigate('/customer/categories')} className="mt-5 inline-flex items-center gap-1 text-xs font-bold text-primary">
            Explore all categories <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {!isLoading && !error && products.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3 px-4 pb-4">
            {products.map(product => <ProductCard key={product.id} product={product} />)}
          </div>
          {hasMore && (
            <div ref={sentinelRef} className="flex items-center justify-center py-7">
              {isLoadingMore ? <Loader2 className="w-5 h-5 animate-spin text-primary" /> : <span className="text-[10px] text-muted-foreground">Scroll for more</span>}
            </div>
          )}
          {!hasMore && <p className="text-[10px] text-muted-foreground text-center py-7">You've reached the end of this category.</p>}
        </>
      )}
    </div>
  );
}
