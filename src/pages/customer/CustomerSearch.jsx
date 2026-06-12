import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Mic, X, Star, SlidersHorizontal, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Slider } from '@/components/ui/slider';
import EmptyState from '@/components/shared/EmptyState';
import { useDataFetch } from '@/hooks/useDataFetch';
import { getCategories, getProducts, getVendors } from '@/lib/api';

// ── Debounce hook ──────────────────────────────────────────
function useDebounce(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function CustomerSearch() {
  const [params] = useSearchParams();
  const [query,            setQuery]            = useState('');
  const [selectedCategory, setSelectedCategory] = useState(params.get('category') || 'all');
  const [maxPrice,         setMaxPrice]         = useState(1000);
  const [sortBy,           setSortBy]           = useState('popular');
  const [viewMode,         setViewMode]         = useState('products');

  const debouncedQuery = useDebounce(query, 350);

  // ── Fetch categories ──────────────────────────────────────
  const { data: categories } = useDataFetch(
    () => getCategories(),
    [],
    { cacheKey: 'categories' }
  );
  const cats = categories ?? [];

  // ── Fetch products with ilike search ──────────────────────
  const {
    data: rawProducts,
    isLoading: productsLoading,
  } = useDataFetch(
    () => getProducts({
      search:   debouncedQuery || undefined,
      category: selectedCategory !== 'all'
        ? (cats.find(c => c.id === selectedCategory)?.name ?? undefined)
        : undefined,
      limit: 60,
    }),
    [debouncedQuery, selectedCategory],
    {
      cacheKey: `search:products:${debouncedQuery}:${selectedCategory}`,
      staleTime: 15_000,
    }
  );

  // ── Fetch vendors with ilike search ───────────────────────
  const {
    data: rawVendors,
    isLoading: vendorsLoading,
  } = useDataFetch(
    () => getVendors({ limit: 40 }),
    [],
    { cacheKey: 'vendors:all', staleTime: 30_000 }
  );

  // ── Client-side sort & filter on top of API results ───────
  const products = (() => {
    let results = rawProducts ?? [];
    results = results.filter(p => p.price <= maxPrice);
    if (sortBy === 'price_low')  results = [...results].sort((a, b) => a.price - b.price);
    if (sortBy === 'price_high') results = [...results].sort((a, b) => b.price - a.price);
    return results;
  })();

  const vendors = (() => {
    const all = rawVendors ?? [];
    if (!debouncedQuery) return all;
    return all.filter(
      v =>
        v.name.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
        v.category.toLowerCase().includes(debouncedQuery.toLowerCase())
    );
  })();

  const isSearching = productsLoading || vendorsLoading;

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background px-4 py-3 border-b border-border space-y-2">
        <div className="flex items-center gap-2">
          <Link to="/customer" className="shrink-0" aria-label="Close search">
            <X className="w-5 h-5 text-muted-foreground" />
          </Link>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Search products, vendors..."
              className="pl-9 pr-9 h-9 bg-muted/50 border-0"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
            {query && (
              <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>
          <Button variant="ghost" size="icon" className="shrink-0 text-primary" aria-label="Voice search">
            <Mic className="w-5 h-5" />
          </Button>
        </div>

        {/* Filter + categories */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 gap-1 shrink-0">
                <SlidersHorizontal className="w-3 h-3" /> Filter
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[60vh]">
              <SheetHeader><SheetTitle>Filter & Sort</SheetTitle></SheetHeader>
              <div className="space-y-6 mt-4">
                <div>
                  <p className="text-sm font-semibold mb-2">Sort By</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      ['popular',    'Most Popular'],
                      ['price_low',  'Price: Low to High'],
                      ['price_high', 'Price: High to Low'],
                    ].map(([val, label]) => (
                      <button
                        key={val}
                        onClick={() => setSortBy(val)}
                        className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                          sortBy === val ? 'bg-primary text-white border-primary' : 'border-border'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold mb-2">Max Price: ₹{maxPrice}</p>
                  <Slider
                    value={[maxPrice]}
                    onValueChange={([v]) => setMaxPrice(v)}
                    min={50} max={1000} step={50}
                    className="w-full"
                  />
                </div>
              </div>
            </SheetContent>
          </Sheet>

          {/* Category chips from live data */}
          {['all', ...cats.slice(0, 6).map(c => c.id)].map(cId => {
            const cat = cats.find(c => c.id === cId);
            return (
              <button
                key={cId}
                onClick={() => setSelectedCategory(cId)}
                className={`text-xs px-3 py-1 rounded-full border whitespace-nowrap transition-colors shrink-0 ${
                  selectedCategory === cId
                    ? 'bg-primary text-white border-primary'
                    : 'border-border bg-card'
                }`}
              >
                {cId === 'all' ? 'All' : (cat?.name?.split(' ')[0] ?? cId)}
              </button>
            );
          })}
        </div>

        {/* Mode toggle */}
        <div className="flex gap-2 items-center">
          <button
            onClick={() => setViewMode('products')}
            className={`text-xs px-3 py-1 rounded-full transition-colors ${
              viewMode === 'products' ? 'bg-foreground text-background' : 'text-muted-foreground'
            }`}
          >
            Products ({products.length})
          </button>
          <button
            onClick={() => setViewMode('vendors')}
            className={`text-xs px-3 py-1 rounded-full transition-colors ${
              viewMode === 'vendors' ? 'bg-foreground text-background' : 'text-muted-foreground'
            }`}
          >
            Vendors ({vendors.length})
          </button>
          {isSearching && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground ml-auto" />}
        </div>
      </div>

      {/* Results */}
      <div className="px-4 py-3">
        {viewMode === 'products' && (
          !isSearching && products.length === 0
            ? <EmptyState icon={Search} title="No products found" description="Try a different search or remove filters" />
            : <div className="grid grid-cols-2 gap-3">
                {products.map(p => {
                  const image = p.image_url ?? p.image ?? '/placeholder-product.jpg';
                  const mrp   = p.mrp ?? p.price;
                  const disc  = mrp > p.price ? Math.round((mrp - p.price) / mrp * 100) : 0;
                  return (
                    <Link key={p.id} to={`/customer/product/${p.id}`}>
                      <Card className="overflow-hidden border-border">
                        <div className="h-28 bg-muted">
                          <img src={image} alt={p.name} className="w-full h-full object-cover" />
                        </div>
                        <div className="p-3">
                          <h4 className="text-xs font-semibold line-clamp-2">{p.name}</h4>
                          {p.name_hindi && (
                            <p className="text-[10px] text-muted-foreground">{p.name_hindi}</p>
                          )}
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-sm font-bold">₹{p.price}</span>
                            {disc > 0 && (
                              <>
                                <span className="text-[10px] text-muted-foreground line-through">₹{mrp}</span>
                                <Badge className="text-[9px] bg-green-100 text-green-700 border-0 h-4">
                                  {disc}% off
                                </Badge>
                              </>
                            )}
                          </div>
                        </div>
                      </Card>
                    </Link>
                  );
                })}
              </div>
        )}

        {viewMode === 'vendors' && (
          !isSearching && vendors.length === 0
            ? <EmptyState icon={Search} title="No vendors found" description="Try a different search" />
            : <div className="space-y-3">
                {vendors.map(v => {
                  const image       = v.image_url ?? v.image ?? '/placeholder-vendor.jpg';
                  const rating      = v.rating ?? 0;
                  const reviewCount = v.review_count ?? v.reviewCount ?? 0;
                  const isVerified  = v.is_verified ?? v.isVerified ?? false;
                  const isOpen      = v.is_open ?? v.isOpen ?? true;
                  return (
                    <Link key={v.id} to={`/customer/vendor/${v.id}`}>
                      <Card className="overflow-hidden border-border flex">
                        <div className="w-24 h-24 shrink-0">
                          <img src={image} alt={v.name} className="w-full h-full object-cover" />
                        </div>
                        <div className="p-3 flex-1 min-w-0">
                          <div className="flex items-start gap-2">
                            <div className="min-w-0">
                              <h4 className="text-sm font-semibold truncate">{v.name}</h4>
                              <p className="text-xs text-muted-foreground">{v.category}</p>
                            </div>
                            {isVerified && (
                              <Badge className="shrink-0 bg-accent/10 text-accent border-0 text-[9px]">✓</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1.5">
                            <Star className="w-3 h-3 text-primary fill-primary" />
                            <span className="text-xs font-medium">{rating.toFixed(1)}</span>
                            <span className="text-[10px] text-muted-foreground">({reviewCount})</span>
                            <Badge
                              variant={isOpen ? 'default' : 'secondary'}
                              className="text-[9px] h-4 ml-auto"
                            >
                              {isOpen ? 'Open' : 'Closed'}
                            </Badge>
                          </div>
                        </div>
                      </Card>
                    </Link>
                  );
                })}
              </div>
        )}
      </div>
    </div>
  );
}
