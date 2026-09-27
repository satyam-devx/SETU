import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Bell,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Loader2,
  MapPin,
  Mic,
  Plus,
  RefreshCw,
  Search,
  ShoppingBag,
  ShoppingCart,
  Star,
} from 'lucide-react';
import { useCustomerOrders } from '@/hooks/queries/useOrders';
import { useNotifications } from '@/hooks/queries/useNotifications';
import { useCategoryPreviews, useSevaProvidersByVillage, useSchemes, useVendorsByVillage } from '@/hooks/queries/useCatalog';
import { useProducts } from '@/hooks/queries/useProducts';
import { useFcmToken } from '@/hooks/useFcmToken';
import { useInView } from '@/hooks/useInView';
import { useVillage } from '@/lib/village';
import { useAuth } from '@/lib/AuthContext';
import { useCart } from '@/lib/cartContext';
import { formatCurrency } from '@/lib/utils';
import { safeExternalUrl, safeInternalRedirect } from '@/lib/frontend-security';
import Img from '@/components/shared/Img';
import BannerCard from '@/components/shared/BannerCard';
import EmptyState from '@/components/shared/EmptyState';
import { useRealtimeBanners } from '@/hooks/useRealtimeBanners';
import { BannerSkeleton, ProductCardSkeleton, VendorCardSkeleton } from '@/components/shared/SkeletonCard';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

function SectionHeader({ title, action, to }) {
  return (
    <div className="flex items-end justify-between gap-4 px-4 mb-3">
      <h2 className="text-[18px] leading-tight font-bold tracking-[-0.025em]">{title}</h2>
      {to && (
        <Link to={to} className="shrink-0 text-[13px] font-semibold text-primary flex items-center gap-0.5 active:opacity-60">
          {action || 'See all'}
          <ChevronRight className="w-4 h-4" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}

function CategoryTile({ category }) {
  const sample = category.sample_images?.find(Boolean) || category.image_url;
  return (
    <Link
      to={`/customer/category/${category.id}`}
      className="group flex min-w-0 flex-col items-center gap-2 active:scale-[0.96] transition-transform duration-150"
      aria-label={`Open ${category.name}`}
    >
      <div className="w-[72px] h-[72px] rounded-[22px] bg-muted/60 flex items-center justify-center overflow-hidden border border-border/40 group-hover:border-primary/20 transition-colors">
        {sample ? (
          <Img src={sample} alt="" width={72} height={72} className="w-full h-full object-contain p-2" />
        ) : (
          <span className="text-[28px] leading-none" aria-hidden="true">{category.icon || '🛒'}</span>
        )}
      </div>
      <span className="text-[12px] font-medium text-foreground text-center leading-[15px] line-clamp-2 max-w-[78px]">
        {category.name}
      </span>
    </Link>
  );
}

function HomeProductCard({ product }) {
  const { items, addItem } = useCart();
  const inCart = items.find(item => item.id === product.id);
  const discount = product.mrp > product.price ? Math.round((1 - product.price / product.mrp) * 100) : 0;

  const handleAdd = (event) => {
    event.preventDefault();
    event.stopPropagation();
    addItem(product, 1);
  };

  return (
    <Link
      to={`/customer/product/${product.id}`}
      className="group min-w-[164px] w-[164px] snap-start"
      aria-label={`View ${product.name}`}
    >
      <article className="h-full rounded-[20px] border border-border/60 bg-card overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.04)] active:scale-[0.985] transition-transform duration-150">
        <div className="relative aspect-square bg-muted/40 flex items-center justify-center overflow-hidden">
          <Img src={product.image_url} alt={product.name} className="w-full h-full object-contain p-3" />
          {discount > 0 && (
            <span className="absolute left-2.5 top-2.5 rounded-md bg-primary px-1.5 py-1 text-[9px] font-bold text-primary-foreground">
              {discount}% OFF
            </span>
          )}
          {product.stock != null && Number(product.stock) <= 0 && (
            <div className="absolute inset-0 bg-background/75 backdrop-blur-[1px] flex items-center justify-center">
              <span className="rounded-full bg-foreground/90 px-2.5 py-1 text-[10px] font-semibold text-background">Out of stock</span>
            </div>
          )}
        </div>
        <div className="p-3">
          <p className="text-[13px] font-semibold leading-[17px] line-clamp-2 min-h-[34px]">{product.name}</p>
          {product.name_hindi && <p className="mt-0.5 text-[10px] text-muted-foreground truncate">{product.name_hindi}</p>}
          <div className="mt-2.5 flex items-end justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[15px] font-bold leading-none">{formatCurrency(product.price)}</p>
              {discount > 0 && <p className="mt-1 text-[10px] text-muted-foreground line-through">{formatCurrency(product.mrp)}</p>}
            </div>
            <button
              type="button"
              onClick={handleAdd}
              disabled={product.stock != null && Number(product.stock) <= 0}
              className="w-9 h-9 shrink-0 rounded-xl border border-primary/25 bg-primary/8 text-primary flex items-center justify-center active:scale-90 transition-transform disabled:opacity-40 disabled:active:scale-100"
              aria-label={inCart ? `${product.name} is in cart` : `Add ${product.name}`}
            >
              <Plus className="w-[18px] h-[18px]" strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </article>
    </Link>
  );
}

function VendorStripCard({ vendor }) {
  return (
    <Link to={`/customer/vendor/${vendor.id}`} className="w-[210px] shrink-0 snap-start active:scale-[0.985] transition-transform duration-150">
      <article className="h-[112px] rounded-[20px] border border-border/60 bg-card p-3 flex gap-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        <div className="w-[82px] h-[86px] rounded-[16px] bg-muted/50 overflow-hidden shrink-0 flex items-center justify-center">
          {vendor.image_url ? (
            <Img src={vendor.image_url} alt={vendor.name} width={82} height={86} className="w-full h-full object-cover" />
          ) : (
            <span className="text-2xl" aria-hidden="true">🏪</span>
          )}
        </div>
        <div className="min-w-0 flex-1 py-0.5">
          <h3 className="text-[13px] font-semibold truncate">{vendor.name}</h3>
          <p className="mt-1 text-[11px] text-muted-foreground truncate">{vendor.category || 'Local store'}</p>
          <div className="mt-2 flex items-center gap-1 text-[11px]">
            <Star className="w-3.5 h-3.5 fill-current text-primary" aria-hidden="true" />
            <span className="font-semibold">{vendor.rating > 0 ? vendor.rating.toFixed(1) : 'New'}</span>
            {vendor.review_count > 0 && <span className="text-muted-foreground">({vendor.review_count})</span>}
          </div>
          <div className="mt-1.5 flex items-center gap-1 text-[10px] text-muted-foreground">
            <Clock3 className="w-3 h-3" aria-hidden="true" />
            {vendor.is_open ? 'Open now' : 'Closed'}
          </div>
        </div>
      </article>
    </Link>
  );
}

function ServiceTile({ provider }) {
  return (
    <Link to="/customer/seva" className="w-[150px] shrink-0 snap-start active:scale-[0.97] transition-transform duration-150">
      <div className="rounded-[18px] border border-border/60 bg-card p-3">
        <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center text-lg mb-3" aria-hidden="true">🧰</div>
        <p className="text-[13px] font-semibold truncate">{provider.name}</p>
        <p className="mt-1 text-[11px] text-muted-foreground truncate">{provider.category || 'Local service'}</p>
      </div>
    </Link>
  );
}

function ErrorRetry({ message, onRetry }) {
  return (
    <div className="mx-4 rounded-2xl border border-destructive/15 bg-destructive/5 p-4 flex items-center gap-3">
      <AlertCircle className="w-5 h-5 text-destructive shrink-0" aria-hidden="true" />
      <p className="text-xs text-muted-foreground flex-1">{message}</p>
      <button type="button" onClick={onRetry} className="text-xs font-semibold text-primary shrink-0 flex items-center gap-1">
        <RefreshCw className="w-3.5 h-3.5" /> Retry
      </button>
    </div>
  );
}

export default function CustomerHome() {
  const navigate = useNavigate();
  const { village, villages: allVillages, loading: villageLoading } = useVillage();
  const { user, updateProfile } = useAuth();
  const { cartCount } = useCart();
  const { data: orders = [] } = useCustomerOrders(user?.id, { limit: 100 });
  const { data: notifications = [] } = useNotifications(user?.id, { limit: 30 });
  const unreadCount = useMemo(() => notifications.filter(n => !n.read && !n.is_read).length, [notifications]);
  const { banners, isLoading: bannersLoading, error: bannersError, refetch: refetchBanners } = useRealtimeBanners(village?.id);
  const { data: categories, isLoading: catsLoading, error: catsError, refetch: refetchCats } = useCategoryPreviews();
  const [vendorsRef, vendorsInView] = useInView({ rootMargin: '500px 0px' });
  const [servicesRef, servicesInView] = useInView({ rootMargin: '600px 0px' });
  const [productsRef, productsInView] = useInView({ rootMargin: '700px 0px' });
  const [schemesRef, schemesInView] = useInView({ rootMargin: '800px 0px' });
  const { data: vendors, isLoading: vendorsLoading, error: vendorsError, refetch: refetchVendors } = useVendorsByVillage(village?.id, { enabled: vendorsInView });
  const { data: services, isLoading: servicesLoading } = useSevaProvidersByVillage(village?.id, {}, { enabled: servicesInView });
  const { data: products, isLoading: productsLoading, error: productsError, refetch: refetchProducts } = useProducts({ limit: 12 }, { enabled: productsInView, staleTime: 30_000 });
  const { data: schemes, isLoading: schemesLoading } = useSchemes({ staleTime: 300_000 }, { enabled: schemesInView });
  const [query, setQuery] = useState('');
  const [bannerIndex, setBannerIndex] = useState(0);
  const [villageDialogOpen, setVillageDialogOpen] = useState(false);
  const [selectedVillageId, setSelectedVillageId] = useState(null);
  const [villageSaving, setVillageSaving] = useState(false);
  const [villageError, setVillageError] = useState('');
  const [toast, setToast] = useState(null);

  useFcmToken();

  useEffect(() => {
    const handler = (event) => {
      setToast(event.detail);
      const timer = window.setTimeout(() => setToast(null), 4000);
      return () => window.clearTimeout(timer);
    };
    window.addEventListener('setu:notification', handler);
    return () => window.removeEventListener('setu:notification', handler);
  }, []);

  useEffect(() => {
    if (banners.length <= 1) return undefined;
    const timer = window.setInterval(() => setBannerIndex(index => (index + 1) % banners.length), 4500);
    return () => window.clearInterval(timer);
  }, [banners.length]);

  useEffect(() => {
    if (bannerIndex >= banners.length && banners.length > 0) setBannerIndex(0);
  }, [bannerIndex, banners.length]);

  const liveOrders = useMemo(() => orders.filter(order =>
    user?.id && (order.customerId === user.id || order.customer_id === user.id) &&
    !['delivered', 'cancelled'].includes(order.status)
  ), [orders, user?.id]);

  const visibleCategories = useMemo(() => (categories || []).slice(0, 8), [categories]);
  const visibleProducts = useMemo(() => (products || []).slice(0, 10), [products]);
  const visibleVendors = useMemo(() => {
    const open = (vendors || []).filter(vendor => vendor.is_open);
    const closed = (vendors || []).filter(vendor => !vendor.is_open);
    return [...open, ...closed].slice(0, 8);
  }, [vendors]);

  const openVillageDialog = () => {
    setSelectedVillageId(village?.id || null);
    setVillageError('');
    setVillageDialogOpen(true);
  };

  const handleConfirmVillage = async () => {
    if (villageSaving) return;
    if (!selectedVillageId || selectedVillageId === village?.id) {
      setVillageDialogOpen(false);
      return;
    }
    setVillageSaving(true);
    setVillageError('');
    const { error } = await updateProfile({ village_id: selectedVillageId });
    setVillageSaving(false);
    if (error) {
      setVillageError(error.message || 'Could not change your village. Please try again.');
      return;
    }
    setVillageDialogOpen(false);
  };

  const handleSearch = useCallback((event) => {
    if (event.key === 'Enter' && query.trim()) {
      navigate(`/customer/search?q=${encodeURIComponent(query.trim())}`);
    }
  }, [navigate, query]);

  const activeBanner = banners[bannerIndex] || null;
  const firstName = user?.user_metadata?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'there';

  return (
    <main className="min-h-screen pb-nav bg-background" aria-label="SETU Customer Home">
      {toast && (
        <div className="fixed left-4 right-4 top-4 z-50 animate-slide-down" role="alert" aria-live="polite">
          <div className="rounded-2xl bg-foreground text-background px-4 py-3 shadow-xl flex items-start gap-3">
            <Bell className="w-4 h-4 mt-0.5 text-primary shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold truncate">{toast.title}</p>
              <p className="text-[11px] opacity-80 line-clamp-2">{toast.body}</p>
            </div>
            <button type="button" onClick={() => setToast(null)} className="text-lg leading-none opacity-60" aria-label="Dismiss notification">×</button>
          </div>
        </div>
      )}

      {/* Compact app chrome: location is the primary piece of context, not a decorative hero. */}
      <header className="px-4 pt-[max(14px,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between gap-3 min-h-[44px]">
          <button type="button" onClick={openVillageDialog} className="min-w-0 flex items-center gap-2 text-left active:opacity-60" aria-label="Change delivery location">
            <span className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <MapPin className="w-[18px] h-[18px]" />
            </span>
            <span className="min-w-0">
              <span className="block text-[10px] uppercase tracking-[0.12em] font-semibold text-muted-foreground">Delivering to</span>
              <span className="block text-[14px] font-bold truncate max-w-[205px]">
                {village?.name || (villageLoading ? 'Loading…' : 'Select village')}
                {village?.district ? `, ${village.district}` : ''}
              </span>
            </span>
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </button>

          <div className="flex items-center gap-1 shrink-0">
            <Link to="/customer/notifications" className="relative w-11 h-11 rounded-full flex items-center justify-center active:bg-muted" aria-label={`Notifications, ${unreadCount} unread`}>
              <Bell className="w-[20px] h-[20px]" />
              {unreadCount > 0 && <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-destructive ring-2 ring-background" aria-hidden="true" />}
            </Link>
            <Link to="/customer/cart" className="relative w-11 h-11 rounded-full flex items-center justify-center active:bg-muted" aria-label={`Cart, ${cartCount} items`}>
              <ShoppingCart className="w-[20px] h-[20px]" />
              {cartCount > 0 && <span className="absolute top-1.5 right-1.5 min-w-[17px] h-[17px] rounded-full bg-primary text-primary-foreground text-[9px] px-1 flex items-center justify-center font-bold ring-2 ring-background">{cartCount > 9 ? '9+' : cartCount}</span>}
            </Link>
          </div>
        </div>

        <div className="mt-4 mb-4">
          <p className="text-[13px] text-muted-foreground">Good to see you,</p>
          <h1 className="text-[26px] leading-[31px] font-bold tracking-[-0.04em]">What are you looking for, {firstName}?</h1>
        </div>

        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-[19px] h-[19px] text-muted-foreground pointer-events-none" aria-hidden="true" />
          <input
            type="search"
            inputMode="search"
            value={query}
            onChange={event => setQuery(event.target.value)}
            onKeyDown={handleSearch}
            onClick={() => navigate('/customer/search')}
            placeholder="Search groceries, essentials & more"
            aria-label="Search products and vendors"
            className="w-full h-[52px] rounded-[17px] bg-muted/70 border border-border/50 pl-11 pr-12 text-[14px] placeholder:text-muted-foreground/80 focus:bg-card transition-colors shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]"
          />
          <button type="button" onClick={() => navigate('/customer/voice')} className="absolute right-1.5 top-1.5 w-11 h-11 rounded-[14px] bg-card border border-border/60 text-primary flex items-center justify-center active:scale-95 transition-transform" aria-label="Voice search">
            <Mic className="w-[18px] h-[18px]" />
          </button>
        </div>
      </header>

      {liveOrders.length > 0 && (
        <section className="mt-4 px-4" aria-label="Live order updates">
          <div className="rounded-[18px] bg-primary text-primary-foreground px-4 py-3 flex items-center gap-3 shadow-sm">
            <span className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center shrink-0"><ShoppingBag className="w-[18px] h-[18px]" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] opacity-75">Order in progress</p>
              <p className="text-[13px] font-bold truncate">{liveOrders[0].orderNumber || liveOrders[0].order_number} · {(liveOrders[0].status || '').replace(/_/g, ' ')}</p>
            </div>
            <Link to={`/customer/orders/${liveOrders[0].id}`} className="text-xs font-bold px-2 py-1 active:opacity-60">Track</Link>
          </div>
        </section>
      )}

      {/* Promotional surface. Real admin banners are preserved; the fallback is intentionally informational, not a fake discount. */}
      <section className="mt-5 px-4" aria-label="SETU promotions">
        {bannersLoading ? (
          <BannerSkeleton />
        ) : bannersError ? (
          <ErrorRetry message="Could not load promotions." onRetry={refetchBanners} />
        ) : activeBanner ? (
          <div className="relative overflow-hidden rounded-[22px]">
            {safeExternalUrl(activeBanner.link) ? (
              <a href={safeExternalUrl(activeBanner.link)} target="_blank" rel="noopener noreferrer" className="block active:scale-[0.995] transition-transform">
                <BannerCard banner={activeBanner} className="min-h-[156px] rounded-[22px]" imageEager />
              </a>
            ) : activeBanner.link ? (
              <Link to={safeInternalRedirect(activeBanner.link, '#')} className="block active:scale-[0.995] transition-transform">
                <BannerCard banner={activeBanner} className="min-h-[156px] rounded-[22px]" imageEager />
              </Link>
            ) : (
              <BannerCard banner={activeBanner} className="min-h-[156px] rounded-[22px]" imageEager />
            )}
            {banners.length > 1 && (
              <div className="absolute bottom-3 left-4 flex gap-1.5" aria-label="Promotion pages">
                {banners.map((_, index) => (
                  <button key={index} type="button" onClick={() => setBannerIndex(index)} className="h-1.5 rounded-full bg-white/80 transition-all" style={{ width: index === bannerIndex ? 18 : 6, opacity: index === bannerIndex ? 1 : 0.45 }} aria-label={`Show promotion ${index + 1}`} />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-[22px] bg-secondary/10 border border-secondary/10 px-5 py-5 min-h-[156px] flex items-center justify-between gap-4 overflow-hidden">
            <div className="max-w-[68%]">
              <p className="text-[10px] uppercase tracking-[0.14em] font-bold text-secondary">SETU local commerce</p>
              <h2 className="mt-1.5 text-[21px] leading-[25px] font-bold tracking-[-0.03em]">Everyday essentials, closer to home.</h2>
              <p className="mt-2 text-xs text-muted-foreground">Shop from stores serving {village?.name || 'your village'}.</p>
            </div>
            <div className="text-5xl rotate-[-5deg]" aria-hidden="true">🛍️</div>
          </div>
        )}
      </section>

      <section className="mt-7" aria-labelledby="shop-categories">
        <SectionHeader title="Shop by category" action="View all" to="/customer/categories" />
        {catsLoading ? (
          <div className="px-4 grid grid-cols-4 gap-y-5 gap-x-2 animate-pulse">
            {Array.from({ length: 8 }).map((_, index) => <div key={index} className="h-[96px] rounded-2xl bg-muted" />)}
          </div>
        ) : catsError ? (
          <ErrorRetry message="Could not load categories." onRetry={refetchCats} />
        ) : !visibleCategories.length ? (
          <EmptyState emoji="🛒" title="No categories yet" size="sm" />
        ) : (
          <div className="px-4 grid grid-cols-4 gap-y-5 gap-x-2">
            {visibleCategories.map(category => <CategoryTile key={category.id} category={category} />)}
          </div>
        )}
      </section>

      <section ref={productsRef} className="mt-8" aria-labelledby="popular-products">
        <SectionHeader title="Popular near you" action="See all" to="/customer/search" />
        {productsLoading ? (
          <div className="grid grid-cols-2 gap-3 px-4">{[1, 2].map(index => <ProductCardSkeleton key={index} />)}</div>
        ) : productsError ? (
          <ErrorRetry message="Could not load products." onRetry={refetchProducts} />
        ) : !visibleProducts.length ? (
          <EmptyState emoji="🛒" title="No products yet" size="sm" />
        ) : (
          <div className="flex gap-3 overflow-x-auto px-4 pb-1 snap-x snap-mandatory [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden" role="list">
            {visibleProducts.map(product => <HomeProductCard key={product.id} product={product} />)}
          </div>
        )}
      </section>

      <section ref={vendorsRef} className="mt-8" aria-labelledby="nearby-stores">
        <SectionHeader title="Stores near you" action="Explore" to="/customer/vendors" />
        {vendorsLoading ? (
          <div className="flex gap-3 overflow-hidden px-4">{[1, 2].map(index => <VendorCardSkeleton key={index} />)}</div>
        ) : vendorsError ? (
          <ErrorRetry message="Could not load nearby stores." onRetry={refetchVendors} />
        ) : !visibleVendors.length ? (
          <EmptyState emoji="🏪" title="No nearby stores" description="More local stores will appear as they join SETU." size="sm" />
        ) : (
          <div className="flex gap-3 overflow-x-auto px-4 pb-1 snap-x snap-mandatory [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden" role="list">
            {visibleVendors.map(vendor => <VendorStripCard key={vendor.id} vendor={vendor} />)}
          </div>
        )}
      </section>

      <section ref={servicesRef} className="mt-8" aria-labelledby="local-services">
        <SectionHeader title="Local services" action="See all" to="/customer/seva" />
        {servicesLoading ? (
          <div className="flex gap-3 overflow-hidden px-4">{[1, 2, 3].map(index => <VendorCardSkeleton key={index} />)}</div>
        ) : !services?.length ? (
          <div className="mx-4 rounded-2xl border border-dashed border-border p-5 text-center">
            <p className="text-sm font-semibold">Need a local service?</p>
            <p className="mt-1 text-xs text-muted-foreground">Electricians, plumbers, tailors and more.</p>
            <Link to="/customer/seva" className="inline-flex mt-3 text-xs font-bold text-primary">Browse services <ChevronRight className="w-4 h-4" /></Link>
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto px-4 pb-1 snap-x snap-mandatory [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {services.slice(0, 8).map(provider => <ServiceTile key={provider.id} provider={provider} />)}
          </div>
        )}
      </section>

      {!schemesLoading && !!schemes?.length && (
        <section ref={schemesRef} className="mt-8 px-4" aria-labelledby="government-schemes">
          <SectionHeader title="Government schemes" action="Explore" to="/customer/schemes" />
          <div className="grid gap-2">
            {schemes.slice(0, 2).map(scheme => (
              <Link key={scheme.id} to="/customer/schemes" className="rounded-2xl border border-border/60 bg-card p-4 flex items-center gap-3 active:scale-[0.995] transition-transform">
                <span className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0" aria-hidden="true">🏛️</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold truncate">{scheme.name}</span>
                  <span className="block mt-1 text-[11px] text-muted-foreground line-clamp-1">{scheme.description}</span>
                </span>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mt-8 px-4 mb-5">
        <Link to="/customer/referral" className="block rounded-[22px] border border-primary/15 bg-primary/5 p-5 active:scale-[0.995] transition-transform">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center text-xl shrink-0" aria-hidden="true">🎁</div>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-bold">Refer & Earn</p>
              <p className="mt-1 text-xs text-muted-foreground">Invite friends to SETU — programme coming soon.</p>
            </div>
            <ChevronRight className="w-5 h-5 text-primary shrink-0" />
          </div>
        </Link>
      </section>

      <Dialog open={villageDialogOpen} onOpenChange={open => !villageSaving && setVillageDialogOpen(open)}>
        <DialogContent className="max-w-sm rounded-[24px]">
          <DialogHeader><DialogTitle>Change delivery village</DialogTitle></DialogHeader>
          <div className="space-y-2 py-2 max-h-72 overflow-y-auto">
            {!allVillages?.length ? (
              <div className="flex items-center justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : allVillages.map(villageOption => (
              <button
                key={villageOption.id}
                type="button"
                onClick={() => setSelectedVillageId(villageOption.id)}
                className={`w-full text-left p-3 rounded-2xl border transition-colors flex items-center justify-between ${selectedVillageId === villageOption.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}
              >
                <span><span className="block text-sm font-semibold">{villageOption.name}</span><span className="block text-xs text-muted-foreground mt-0.5">{villageOption.block}{villageOption.district ? `, ${villageOption.district}` : ''}</span></span>
                {selectedVillageId === villageOption.id && <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />}
              </button>
            ))}
          </div>
          {villageError && <p className="text-xs text-destructive">{villageError}</p>}
          <DialogFooter>
            <Button className="w-full rounded-xl" onClick={handleConfirmVillage} disabled={villageSaving || !selectedVillageId}>
              {villageSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Confirm village
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
