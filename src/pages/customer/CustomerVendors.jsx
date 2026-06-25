import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Star, Search, Loader2, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useDataFetch } from '@/hooks/useDataFetch';
import { getVendors } from '@/lib/api';
import { useVillage } from '@/lib/village';
import Img from '@/components/shared/Img';

function VendorsSkeleton() {
  return (
    <div className="px-4 py-3 space-y-3">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="flex h-20 rounded-xl overflow-hidden bg-muted animate-pulse" />
      ))}
    </div>
  );
}

export default function CustomerVendors() {
  const [query, setQuery] = useState('');
  const { village } = useVillage();

  const { data: vendors, isLoading, error, refetch } = useDataFetch(
    () => getVendors({ villageId: village?.id }),
    [village?.id],
    { cacheKey: `vendors:village:${village?.id}`, enabled: true }
  );

  const list = vendors ?? [];
  const filtered = list.filter(v =>
    !query ||
    v.name.toLowerCase().includes(query.toLowerCase()) ||
    v.category.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="pb-20">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3 space-y-2">
        <div className="flex items-center gap-3">
          <Link to="/customer" className="p-1 -ml-1"><ArrowLeft className="w-5 h-5" /></Link>
          <span className="font-semibold text-sm flex-1">All Vendors</span>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search vendors..."
            className="pl-9 h-8 text-sm"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
      </div>

      {isLoading && <VendorsSkeleton />}

      {!isLoading && error && (
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
          <AlertCircle className="w-10 h-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Could not load vendors.</p>
          <button onClick={refetch} className="text-xs text-primary underline">Try again</button>
        </div>
      )}

      {!isLoading && !error && (
        <div className="px-4 py-3 space-y-3">
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-10">
              {query ? 'No vendors match your search.' : 'No vendors available in your village yet.'}
            </p>
          )}
          {filtered.map(v => {
            const image       = v.image_url ?? v.image ?? '/placeholder-vendor.jpg';
            const rating      = v.rating ?? 0;
            const reviewCount = v.review_count ?? v.reviewCount ?? 0;
            const isVerified  = v.is_verified ?? v.isVerified ?? false;
            const isOpen      = v.is_open ?? v.isOpen ?? true;

            return (
              <Link key={v.id} to={`/customer/vendor/${v.id}`}>
                <Card className="overflow-hidden border-border flex">
                  <div className="w-20 h-20 shrink-0">
                    <Img src={image} alt={v.name} width={80} height={80} className="w-full h-full object-cover" />
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
                      <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
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
  );
}
