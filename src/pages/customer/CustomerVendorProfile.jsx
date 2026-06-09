import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Star, MapPin, Clock, ShoppingBag, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useDataFetch } from '@/hooks/useDataFetch';
import { getVendorById } from '@/lib/api';

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

  // getVendorById selects '*, products(*)' — products nested under vendor
  const { data: vendor, isLoading, error } = useDataFetch(
    () => getVendorById(vendorId),
    [vendorId],
    { cacheKey: `vendor:${vendorId}`, enabled: !!vendorId }
  );

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

  // Products may be nested (from the select join) or absent
  const vendorProducts = (vendor.products ?? [])
    .filter(p => p.is_available !== false)
    .slice(0, 6);

  return (
    <div className="pb-20">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
        <Link to="/customer" className="p-1 -ml-1"><ArrowLeft className="w-5 h-5" /></Link>
        <span className="font-semibold text-sm flex-1 truncate">{name}</span>
      </div>

      <div className="h-40 bg-muted">
        <img src={image} alt={name} className="w-full h-full object-cover" />
      </div>

      <div className="px-4 py-4 space-y-4">
        <div>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-lg font-bold">{name}</h1>
              <p className="text-sm text-muted-foreground">{category}</p>
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

        {vendorProducts.length > 0 ? (
          <div>
            <h3 className="font-semibold text-sm mb-2">Products</h3>
            <div className="grid grid-cols-2 gap-3">
              {vendorProducts.map(p => {
                const pid   = p.id;
                const pname = p.name;
                const pimg  = p.image_url ?? p.image ?? '/placeholder-product.jpg';
                const pPrice = p.price;
                return (
                  <Link key={pid} to={`/customer/product/${pid}`}>
                    <Card className="overflow-hidden border-border">
                      <div className="h-24 bg-muted">
                        <img src={pimg} alt={pname} className="w-full h-full object-cover" />
                      </div>
                      <div className="p-2">
                        <p className="text-xs font-semibold line-clamp-1">{pname}</p>
                        <p className="text-sm font-bold mt-0.5">₹{pPrice}</p>
                      </div>
                    </Card>
                  </Link>
                );
              })}
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
