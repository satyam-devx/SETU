import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ShoppingCart, Share2, Plus, Minus, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useCart } from '@/lib/cartContext';
import { useProduct, useProductCategories } from '@/hooks/queries/useProducts';
import Img from '@/components/shared/Img';
import { toast } from '@/components/ui/use-toast';
import { smartGoBack } from '@/lib/utils';

// ── Loading skeleton ──────────────────────────────────────
function ProductSkeleton() {
  return (
    <div className="pb-24 animate-pulse">
      <div className="h-14 bg-muted" />
      <div className="aspect-square bg-muted" />
      <div className="px-4 py-4 space-y-4">
        <div className="h-6 bg-muted rounded w-2/3" />
        <div className="h-8 bg-muted rounded w-1/3" />
        <div className="h-16 bg-muted rounded" />
        <div className="h-20 bg-muted rounded" />
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

  const { data: product, isLoading, error } = useProduct(productId);
  // Full category set (migration 082) — product.category (below) is
  // only ever the first of possibly several.
  const { data: productCategories } = useProductCategories(productId, { staleTime: 120_000 });

  if (isLoading) return <ProductSkeleton />;

  if (error || !product) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-6 text-center">
        <AlertCircle className="w-10 h-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Product not found.</p>
        <Button variant="outline" asChild>
          <Link to="/customer">Back to Home</Link>
        </Button>
      </div>
    );
  }

  // Normalise field names — DB uses snake_case, mock uses camelCase
  const name       = product.name;
  const nameHindi  = product.name_hindi  ?? product.nameHindi;
  const price      = product.price;
  const mrp        = product.mrp ?? price;
  const category   = product.category;
  const stock      = product.stock ?? 0;
  const isAvailable = product.is_available ?? true;
  const unit       = product.unit ?? 'piece';
  const image      = product.image_url   ?? product.image ?? '/placeholder-product.jpg';
  const vendorId   = product.vendor_id   ?? product.vendorId;
  const vendorName = product.vendors?.name ?? product.vendorName;
  const vendorVillage = product.vendors?.village;

  const discount = mrp > price ? Math.round((mrp - price) / mrp * 100) : 0;

  const handleAddToCart = () => {
    addItem(product, quantity);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const handleShare = async () => {
    const shareData = {
      title: name,
      text: `${name} — ₹${price} on SETU`,
      url: window.location.href,
    };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch { /* user cancelled — not an error */ }
      return;
    }
    // Browsers without the Web Share API (most desktop browsers): copy
    // the link instead of silently doing nothing.
    try {
      await navigator.clipboard.writeText(shareData.url);
      toast({ title: 'Link copied', description: 'Product link copied to clipboard.' });
    } catch {
      toast({ title: 'Could not share', description: 'Please copy the link from your address bar.', variant: 'destructive' });
    }
  };

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => smartGoBack(navigate)}
          className="touch-target -ml-2 flex items-center justify-center shrink-0 rounded-lg hover:bg-muted transition-colors"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5" aria-hidden="true" />
        </button>
        <span className="font-semibold text-sm flex-1 truncate">{name}</span>
        <Button variant="ghost" size="icon" onClick={handleShare} aria-label="Share this product">
          <Share2 className="w-4 h-4" />
        </Button>
      </div>

      {/* Image — aspect-square + object-contain, not a fixed h-64 box
          with object-cover: vendor photos come in whatever aspect
          ratio they were shot in, and cropping to fill a box shorter
          than the photo was cutting the top and bottom off. */}
      <div className="aspect-square bg-muted">
        <Img src={image} alt={name} width={640} className="w-full h-full object-contain" />
      </div>

      {/* Details */}
      <div className="px-4 py-4 space-y-4">
        <div>
          <div className="flex items-start justify-between gap-2">
            <div>
              <h1 className="text-lg font-bold">{name}</h1>
              {nameHindi && <p className="text-sm text-muted-foreground">{nameHindi}</p>}
            </div>
            {discount > 0 && (
              <Badge className="bg-green-100 text-green-700 border-0 shrink-0">{discount}% off</Badge>
            )}
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-bold">₹{price}</span>
            {mrp > price && <span className="text-sm text-muted-foreground line-through">₹{mrp}</span>}
          </div>
        </div>

        {vendorId && (
          <Card className="p-3 border-border">
            <p className="text-xs text-muted-foreground">Sold by</p>
            <Link to={`/customer/vendor/${vendorId}`} className="text-sm font-semibold hover:text-primary">
              {vendorName ?? 'Vendor'}
            </Link>
            {vendorVillage && (
              <p className="text-xs text-muted-foreground mt-0.5">{vendorVillage}</p>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">Est. delivery: 30–45 min</p>
          </Card>
        )}

        <div>
          <h3 className="text-sm font-semibold mb-2">Description</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {product.description
              ? product.description
              : `Fresh and high quality ${name}. Sourced directly from local farmers and vendors in the ${category} category.`}
          </p>
        </div>

        <div>
          <h3 className="text-sm font-semibold mb-2">Category</h3>
          <div className="flex flex-wrap gap-1.5">
            {productCategories?.length
              ? productCategories.map(c => <Badge key={c.id} variant="outline">{c.name}</Badge>)
              : <Badge variant="outline">{category}</Badge>}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold mb-1">Availability</h3>
          <p className="text-sm text-muted-foreground">{stock} units in stock · Per {unit}</p>
          {stock > 0 && stock <= 5 && (
            <p className="text-xs text-amber-600 font-medium mt-1">Only {stock} left — order soon</p>
          )}
        </div>
      </div>

      {/* Bottom Bar — was `fixed bottom-0` with no z-index or safe-area
          handling, so it sat directly behind CustomerLayout's MobileNav
          (fixed bottom-0, z-50) and its Add to Cart button was
          unreachable. CustomerLayout now hides MobileNav (and the
          floating cart FAB) on this route entirely, so this bar is the
          only fixed-bottom element here — it just needs pb-safe for the
          phone's own gesture-bar/home-indicator inset, not an offset to
          clear a nav bar that's no longer there. */}
      <div className="fixed bottom-0 left-0 right-0 z-40 max-w-lg mx-auto bg-background border-t border-border px-4 pt-3 pb-safe flex items-center gap-3">
        <div className="flex items-center gap-2 border border-border rounded-lg">
          <button
            onClick={() => setQuantity(q => Math.max(1, q - 1))}
            className="p-2 disabled:opacity-30"
            disabled={quantity <= 1}
            aria-label="Decrease quantity"
          >
            <Minus className="w-4 h-4" />
          </button>
          <span className="w-6 text-center text-sm font-semibold">{quantity}</span>
          <button
            onClick={() => setQuantity(q => Math.min(q + 1, Math.max(stock, 1)))}
            className="p-2 disabled:opacity-30"
            disabled={quantity >= stock}
            aria-label="Increase quantity"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <Button
          className="flex-1 gap-2"
          onClick={handleAddToCart}
          disabled={stock === 0 || !isAvailable}
        >
          <ShoppingCart className="w-4 h-4" />
          {!isAvailable
            ? 'Currently Unavailable'
            : stock === 0
            ? 'Out of Stock'
            : added
            ? 'Added! ✓'
            : `Add to Cart — ₹${price * quantity}`}
        </Button>
      </div>
    </div>
  );
}
