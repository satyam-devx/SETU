import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Star, MapPin, Clock, ShoppingBag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { VENDORS, PRODUCTS } from '@/lib/mockData';

export default function CustomerVendorProfile() {
  const { vendorId } = useParams();
  const vendor = VENDORS.find(v => v.id === vendorId) || VENDORS[0];
  const vendorProducts = PRODUCTS.filter(p => p.vendorId === vendor.id).slice(0, 6);

  return (
    <div className="pb-20">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
        <Link to="/customer" className="p-1 -ml-1"><ArrowLeft className="w-5 h-5" /></Link>
        <span className="font-semibold text-sm flex-1 truncate">{vendor.name}</span>
      </div>

      <div className="h-40 bg-muted">
        <img src={vendor.image} alt={vendor.name} className="w-full h-full object-cover" />
      </div>

      <div className="px-4 py-4 space-y-4">
        <div>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-lg font-bold">{vendor.name}</h1>
              <p className="text-sm text-muted-foreground">{vendor.category}</p>
            </div>
            {vendor.isVerified && <Badge className="bg-accent/10 text-accent border-0">✓ Verified</Badge>}
          </div>
          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />{vendor.rating} ({vendor.reviewCount})</span>
            <Badge variant={vendor.isOpen ? 'default' : 'secondary'} className="text-xs">{vendor.isOpen ? 'Open' : 'Closed'}</Badge>
          </div>
        </div>

        <Card className="p-3 border-border space-y-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground"><MapPin className="w-4 h-4 shrink-0" /><span>{vendor.village} Market</span></div>
          <div className="flex items-center gap-2 text-muted-foreground"><Clock className="w-4 h-4 shrink-0" /><span>Delivery: 30-45 min · Radius: {vendor.deliveryRadius}km</span></div>
          <div className="flex items-center gap-2 text-muted-foreground"><ShoppingBag className="w-4 h-4 shrink-0" /><span>Min order: ₹50</span></div>
        </Card>

        {vendorProducts.length > 0 && (
          <div>
            <h3 className="font-semibold text-sm mb-2">Products</h3>
            <div className="grid grid-cols-2 gap-3">
              {vendorProducts.map(p => (
                <Link key={p.id} to={`/customer/product/${p.id}`}>
                  <Card className="overflow-hidden border-border">
                    <div className="h-24 bg-muted"><img src={p.image} alt={p.name} className="w-full h-full object-cover" /></div>
                    <div className="p-2">
                      <p className="text-xs font-semibold line-clamp-1">{p.name}</p>
                      <p className="text-sm font-bold mt-0.5">₹{p.price}</p>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
