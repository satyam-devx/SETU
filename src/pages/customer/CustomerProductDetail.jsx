import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Star, ShoppingCart, Heart, Share2, Plus, Minus, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useCart } from '@/lib/cartContext';
import { useDataFetch } from '@/hooks/useDataFetch';
import { getProductById } from '@/lib/api';

// ── Loading skeleton ──────────────────────────────────────
function ProductSkeleton() {
  return (
    <div className="pb-24 animate-pulse">
      <div className="h-14 bg-muted" />
      <div className="h-64 bg-muted" />
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
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const { data: product, isLoading, error } = useDataFetch(
    () => getProductById(productId),
    [productId],
    { cacheKey: `product:${productId}`, enabled: !!productId }
  );

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

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
        <Link to="/customer" className="p-1 -ml-1"><ArrowLeft className="w-5 h-5" /></Link>
        <span className="font-semibold text-sm flex-1 truncate">{name}</span>
        <Button variant="ghost" size="icon"><Share2 className="w-4 h-4" /></Button>
        <Button variant="ghost" size="icon"><Heart className="w-4 h-4" /></Button>
      </div>

      {/* Image */}
      <div className="h-64 bg-muted">
        <img src={image} alt={name} className="w-full h-full object-cover" />
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
          <div className="flex items-center gap-1 mt-1">
            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
            <span className="text-sm font-medium">4.2</span>
            <span className="text-xs text-muted-foreground">(128 reviews)</span>
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
          <Badge variant="outline">{category}</Badge>
        </div>

        <div>
          <h3 className="text-sm font-semibold mb-1">Availability</h3>
          <p className="text-sm text-muted-foreground">{stock} units in stock · Per {unit}</p>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border px-4 py-3 flex items-center gap-3">
        <div className="flex items-center gap-2 border border-border rounded-lg">
          <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="p-2">
            <Minus className="w-4 h-4" />
          </button>
          <span className="w-6 text-center text-sm font-semibold">{quantity}</span>
          <button onClick={() => setQuantity(q => q + 1)} className="p-2">
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <Button
          className="flex-1 gap-2"
          onClick={handleAddToCart}
          disabled={stock === 0}
        >
          <ShoppingCart className="w-4 h-4" />
          {stock === 0
            ? 'Out of Stock'
            : added
            ? 'Added! ✓'
            : `Add to Cart — ₹${price * quantity}`}
        </Button>
      </div>
    </div>
  );
}
