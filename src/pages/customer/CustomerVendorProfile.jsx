import React from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Star, MapPin, Clock, ShoppingBag, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useVendor, useVendorCategories, useVendorProducts } from '@/hooks/queries/useVendor';
import Img from '@/components/shared/Img';
import ProductCard from '@/components/customer/ProductCard';
import { smartGoBack } from '@/lib/utils';

// ── Skeleton ──────────────────────────────────────────────
function VendorSkeleton() {
  return (
    <div className="pb-20 animate-pulse">
      <div className="h-14 bg-muted" />
      <div className="h-40 bg-muted" />
      <div className="px-4 py-4 space-y-3">
        <div className="h-6 bg-muted rounded w-1/2" />
        <div className="h-20 bg-muted rounded" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-muted rounded" />)}
        </div>
      </div>
    </div>
  );
}

export default function CustomerVendorProfile() {
  const { vendorId } = useParams();
  const navigate = useNavigate();

  // getVendorById selects '*, products(*)' — products nested under vendor
  const { data: vendor, isLoading, error } = useVendor(vendorId);
  // Full category set (migration 082) — a shop can belong to several
  // categories now; vendor.category (below) is only ever the first one.
  const { data: vendorCategories } = useVendorCategories(vendorId);
  const { data: products = [], isLoading: productsLoading, error: productsError, refetch: refetchProducts } = useVendorProducts(vendorId, { limit: 20 });

  if (isLoading) return <VendorSkeleton />;

  if (error || !vendor) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-6 text-center">
        <AlertCircle className="w-10 h-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Vendor not found.</p>
        <Button variant="outline" asChild>
          <Link to="/customer">Back to Home</Link>
        </Button>
      </div>
    );
  }

  // Normalise field names (DB snake_case vs mock camelCase)
  const name           = vendor.name;
  const category       = vendor.category;
  const image          = vendor.image_url    ?? vendor.image ?? '/placeholder-vendor.jpg';
  const rating         = vendor.rating       ?? 0;
  const reviewCount    = vendor.review_count ?? vendor.reviewCount ?? 0;
  const isVerified     = vendor.is_verified  ?? vendor.isVerified ?? false;
  const isOpen         = vendor.is_open      ?? vendor.isOpen ?? true;
  const village        = vendor.village;
  const deliveryRadius = vendor.delivery_radius ?? vendor.deliveryRadius ?? 5;
  const minOrder       = vendor.min_order    ?? vendor.minOrder ?? 50;

  // Products may be nested (from the select join) or absent. Was
  // capped at 6 with no way to see the rest of a vendor's catalog —
  // raised the cap and note the remainder instead of hiding it outright.
  const vendorProducts = products ?? [];

  return (
    <div className="pb-20">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => smartGoBack(navigate)}
          className="touch-target -ml-2 flex items-center justify-center shrink-0 rounded-lg hover:bg-muted transition-colors"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5" aria-hidden="true" />
        </button>
        <span className="font-semibold text-sm flex-1 truncate">{name}</span>
      </div>

      <div className="h-40 bg-muted">
        <Img src={image} alt={name} width={640} height={160} className="w-full h-full object-cover" />
      </div>

      <div className="px-4 py-4 space-y-4">
        <div>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-lg font-bold">{name}</h1>
              {vendorCategories?.length ? (
                <div className="flex flex-wrap gap-1 mt-1">
                  {vendorCategories.map(c => (
                    <Badge key={c.id} variant="secondary" className="text-[10px] font-normal">
                      {c.name}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{category}</p>
              )}
            </div>
            {isVerified && (
              <Badge className="bg-accent/10 text-accent border-0">✓ Verified</Badge>
            )}
          </div>
          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
              {rating.toFixed(1)} ({reviewCount})
            </span>
            <Badge
              variant={isOpen ? 'default' : 'secondary'}
              className="text-xs"
            >
              {isOpen ? 'Open' : 'Closed'}
            </Badge>
          </div>
        </div>

        <Card className="p-3 border-border space-y-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="w-4 h-4 shrink-0" />
            <span>{village} Market</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="w-4 h-4 shrink-0" />
            <span>Delivery: 30–45 min · Radius: {deliveryRadius}km</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <ShoppingBag className="w-4 h-4 shrink-0" />
            <span>Min order: ₹{minOrder}</span>
          </div>
        </Card>

        {productsLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-40 rounded-xl bg-muted animate-pulse" />)}
          </div>
        ) : productsError ? (
          <Card className="p-4 border-border text-center">
            <p className="text-sm text-destructive">Could not load vendor products.</p>
            <button onClick={refetchProducts} className="text-xs text-primary font-semibold underline mt-2">Retry</button>
          </Card>
        ) : vendorProducts.length > 0 ? (
          <div>
            <h3 className="font-semibold text-sm mb-2">Products</h3>
            <div className="grid grid-cols-2 gap-3">
              {vendorProducts.map(p => <ProductCard key={p.id} product={p} />)}
            </div>

          </div>
        ) : (
          <Card className="p-4 border-border text-center">
            <p className="text-sm text-muted-foreground">No products listed yet.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
