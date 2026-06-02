import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Star, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { VENDORS } from '@/lib/mockData';

export default function CustomerVendors() {
  const [query, setQuery] = useState('');
  const filtered = VENDORS.filter(v => !query || v.name.toLowerCase().includes(query.toLowerCase()) || v.category.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="pb-20">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3 space-y-2">
        <div className="flex items-center gap-3">
          <Link to="/customer" className="p-1 -ml-1"><ArrowLeft className="w-5 h-5" /></Link>
          <span className="font-semibold text-sm flex-1">All Vendors</span>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search vendors..." className="pl-9 h-8 text-sm" value={query} onChange={e => setQuery(e.target.value)} />
        </div>
      </div>

      <div className="px-4 py-3 space-y-3">
        {filtered.map(v => (
          <Link key={v.id} to={`/customer/vendor/${v.id}`}>
            <Card className="overflow-hidden border-border flex">
              <div className="w-20 h-20 shrink-0"><img src={v.image} alt={v.name} className="w-full h-full object-cover" /></div>
              <div className="p-3 flex-1 min-w-0">
                <div className="flex items-start gap-2">
                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold truncate">{v.name}</h4>
                    <p className="text-xs text-muted-foreground">{v.category}</p>
                  </div>
                  {v.isVerified && <Badge className="shrink-0 bg-accent/10 text-accent border-0 text-[9px]">✓</Badge>}
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                  <span className="text-xs font-medium">{v.rating}</span>
                  <span className="text-[10px] text-muted-foreground">({v.reviewCount})</span>
                  <Badge variant={v.isOpen ? 'default' : 'secondary'} className="text-[9px] h-4 ml-auto">{v.isOpen ? 'Open' : 'Closed'}</Badge>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
