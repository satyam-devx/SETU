import React, { useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Check, Clock3, Heart, MapPin, Minus, Plus,
  Share2, ShoppingBag, ShieldCheck, Sparkles, Truck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCart } from '@/lib/cartContext';
import { useProduct, useProductCategories } from '@/hooks/queries/useProducts';
import Img from '@/components/shared/Img';
import AppHeader from '@/components/shared/AppHeader';
import { toast } from '@/components/ui/use-toast';

function ProductSkeleton() {
  return (
    <div className="pb-28 animate-pulse">
      <div className="h-[72px] bg-muted" />
      <div className="aspect-square bg-muted" />
      <div className="px-4 py-5 space-y-4">
        <div className="h-7 bg-muted rounded-xl w-3/4" />
        <div className="h-10 bg-muted rounded-xl w-1/3" />
        <div className="h-24 bg-muted rounded-2xl" />
      </div>
    </div>
  );
}

export default function CustomerProductDetail() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [liked, setLiked] = useState(false);

  const { data: product, isLoading, error } = useProduct(productId);
  const { data: productCategories } = useProductCategories(productId, { staleTime: 120_000 });

  const meta = useMemo(() => {
    if (!product) return null;
    const price = Number(product.price || 0);
    const mrp = Number(product.mrp ?? price);
    return {
      name: product.name,
      hindi: product.name_hindi ?? product.nameHindi,
      price,
      mrp,
      stock: Number(product.stock ?? 0),
      unit: product.unit ?? 'piece',
      image: product.image_url ?? product.image ?? '/placeholder-product.jpg',
      category: product.category,
      vendorId: product.vendor_id ?? product.vendorId,
      vendorName: product.vendors?.name ?? product.vendorName ?? 'SETU Seller',
      vendorVillage: product.vendors?.village,
      description: product.description,
      discount: mrp > price ? Math.round((mrp - price) / mrp * 100) : 0,
      available: product.is_available !== false,
    };
  }, [product]);

  if (isLoading) return <ProductSkeleton />;

  if (error || !meta) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
        <div className="w-16 h-16 rounded-[22px] bg-muted flex items-center justify-center text-2xl">🛍️</div>
        <h2 className="font-extrabold text-lg mt-4">Product unavailable</h2>
        <p className="text-xs text-muted-foreground mt-1">This product may have been removed or is temporarily unavailable.</p>
        <Button className="mt-5" onClick={() => navigate('/customer')}>Back to Home</Button>
      </div>
    );
  }

  const handleAdd = () => {
    addItem(product, quantity);
    setAdded(true);
    toast({ title: 'Added to cart', description: `${meta.name} × ${quantity}` });
    setTimeout(() => setAdded(false), 1800);
  };

  const handleShare = async () => {
    const shareData = { title: meta.name, text: `${meta.name} — ₹${meta.price} on SETU`, url: window.location.href };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch { /* cancelled */ }
      return;
    }
    try {
      await navigator.clipboard.writeText(shareData.url);
      toast({ title: 'Link copied', description: 'Product link copied to clipboard.' });
    } catch {
      toast({ title: 'Could not share', description: 'Copy the link from your address bar.', variant: 'destructive' });
    }
  };

  return (
    <div className="pb-28 animate-fade-in">
      <AppHeader
        title="Product"
        subtitle="SETU marketplace"
        showBack
        backTo="/customer"
        eyebrow="Product details"
        rightAction={(
          <div className="flex gap-1">
            <button onClick={() => setLiked(v => !v)} className="touch-target w-10 h-10 rounded-[14px] border border-border/70 bg-background/75 flex items-center justify-center active:scale-95" aria-label={liked ? 'Remove from wishlist' : 'Add to wishlist'}>
              <Heart className={`w-[17px] h-[17px] ${liked ? 'fill-primary text-primary' : 'text-muted-foreground'}`} />
            </button>
            <button onClick={handleShare} className="touch-target w-10 h-10 rounded-[14px] border border-border/70 bg-background/75 flex items-center justify-center text-muted-foreground active:scale-95" aria-label="Share product">
              <Share2 className="w-[17px] h-[17px]" />
            </button>
          </div>
        )}
      />

      <section className="px-3">
        <div className="relative overflow-hidden rounded-[28px] border border-border/70 bg-card shadow-sm">
          <div className="absolute left-4 top-4 z-10 flex gap-2">
            {meta.discount > 0 && <Badge className="rounded-full bg-primary text-primary-foreground border-0 px-3 py-1 text-[10px]">{meta.discount}% OFF</Badge>}
            {meta.stock > 0 && meta.stock <= 5 && <Badge variant="outline" className="rounded-full bg-card/90 text-[10px]">Only {meta.stock} left</Badge>}
          </div>
          <div className="aspect-square bg-gradient-to-br from-muted/70 via-background to-primary/5 p-6">
            <Img src={meta.image} alt={meta.name} width={800} className="w-full h-full object-contain drop-shadow-[0_18px_25px_rgba(30,20,10,0.12)]" />
          </div>
          <div className="px-4 pb-4 flex items-center justify-between text-[10px] text-muted-foreground">
            <span className="inline-flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-primary" /> SETU verified listing</span>
            <span>{meta.unit}</span>
          </div>
        </div>
      </section>

      <section className="px-4 pt-5">
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-primary">
          <Sparkles className="w-3 h-3" /> Local marketplace
        </div>
        <h1 className="text-[24px] font-extrabold tracking-tight mt-1 leading-tight">{meta.name}</h1>
        {meta.hindi && <p className="text-sm text-muted-foreground mt-1">{meta.hindi}</p>}

        <div className="flex items-end gap-2 mt-3">
          <span className="text-[28px] leading-none font-black">₹{meta.price.toLocaleString('en-IN')}</span>
          {meta.mrp > meta.price && <span className="text-sm text-muted-foreground line-through mb-0.5">₹{meta.mrp.toLocaleString('en-IN')}</span>}
          {meta.discount > 0 && <span className="text-[10px] font-bold text-green-700 mb-1">Save ₹{(meta.mrp - meta.price).toLocaleString('en-IN')}</span>}
        </div>
      </section>

      <section className="px-4 mt-5">
        <div className="grid grid-cols-3 gap-2">
          {[
            [Truck, 'Local delivery'],
            [Clock3, '30–45 min'],
            [ShieldCheck, 'Secure checkout'],
          ].map(([Icon, label]) => (
            <div key={label} className="rounded-2xl border border-border bg-card p-3 text-center">
              <Icon className="w-4 h-4 text-primary mx-auto" />
              <p className="text-[9px] font-semibold mt-1.5 leading-tight">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {meta.vendorId && (
        <section className="px-4 mt-5">
          <Link to={`/customer/vendor/${meta.vendorId}`} className="block rounded-[22px] border border-border bg-card p-4 shadow-sm active:scale-[0.99] transition-transform">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-extrabold">{meta.vendorName.slice(0, 1).toUpperCase()}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5"><p className="font-bold text-sm truncate">{meta.vendorName}</p><Check className="w-3.5 h-3.5 text-primary" /></div>
                <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1"><MapPin className="w-3 h-3" /> {meta.vendorVillage || 'Local SETU seller'}</p>
              </div>
              <span className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center"><ArrowLeft className="w-4 h-4 rotate-180" /></span>
            </div>
          </Link>
        </section>
      )}

      <section className="px-4 mt-5 space-y-3">
        <div className="rounded-[22px] border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-sm">About this product</h2>
            <span className="text-[10px] text-muted-foreground">{meta.unit}</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed mt-2">{meta.description || `Quality ${meta.name} sourced through local SETU sellers. Product availability and delivery time may vary by your location.`}</p>
        </div>

        <div className="rounded-[22px] border border-border bg-card p-4">
          <h2 className="font-bold text-sm">Categories</h2>
          <div className="flex flex-wrap gap-2 mt-3">
            {(productCategories?.length ? productCategories : [{ id: 'fallback', name: meta.category || 'SETU' }]).map(c => (
              <Badge key={c.id} variant="outline" className="rounded-full px-3 py-1 text-[10px]">{c.name}</Badge>
            ))}
          </div>
        </div>
      </section>

      <div className="fixed bottom-0 left-0 right-0 z-40 max-w-lg mx-auto border-t border-border/70 bg-background/90 backdrop-blur-xl px-3 pt-3 pb-safe shadow-[0_-10px_30px_rgba(30,20,10,0.08)]">
        <div className="flex items-center gap-2">
          <div className="h-12 rounded-2xl border border-border bg-card flex items-center px-1">
            <button onClick={() => setQuantity(q => Math.max(1, q - 1))} disabled={quantity <= 1} className="w-10 h-10 rounded-xl flex items-center justify-center disabled:opacity-30" aria-label="Decrease quantity"><Minus className="w-4 h-4" /></button>
            <span className="w-7 text-center text-sm font-bold">{quantity}</span>
            <button onClick={() => setQuantity(q => Math.min(q + 1, meta.stock))} disabled={quantity >= meta.stock || meta.stock <= 0} className="w-10 h-10 rounded-xl flex items-center justify-center disabled:opacity-30" aria-label="Increase quantity"><Plus className="w-4 h-4" /></button>
          </div>
          <Button className="h-12 flex-1 rounded-2xl gap-2 font-bold shadow-lg" onClick={handleAdd} disabled={meta.stock <= 0 || !meta.available}>
            <ShoppingBag className="w-[18px] h-[18px]" />
            {!meta.available || meta.stock <= 0 ? 'Unavailable' : added ? 'Added to Cart ✓' : `Add to Cart · ₹${(meta.price * quantity).toLocaleString('en-IN')}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
