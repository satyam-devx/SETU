import React, { useState } from 'react';
import { Search, Star, Phone, CheckCircle, Clock, Wrench } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import AppHeader from '@/components/shared/AppHeader';
import { SEVA_PROVIDERS } from '@/lib/mockData';

export default function AdminSevaProviders() {
  const [query, setQuery]   = useState('');
  const [providers, setProviders] = useState(SEVA_PROVIDERS);

  const toggle = (id) => setProviders(ps => ps.map(p => p.id === id ? { ...p, isAvailable: !p.isAvailable } : p));

  const filtered = providers.filter(p =>
    !query || p.name.toLowerCase().includes(query.toLowerCase()) || p.category.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="flex-1 overflow-auto">
      <AppHeader title="Seva Providers" subtitle={`${providers.filter(p => p.isAvailable).length} available`} />
      <div className="p-4 space-y-4">

        <div className="grid grid-cols-3 gap-2 text-center">
          <Card className="p-2 border-border">
            <p className="text-xl font-bold">{providers.length}</p>
            <p className="text-[10px] text-muted-foreground">Total</p>
          </Card>
          <Card className="p-2 border-border">
            <p className="text-xl font-bold text-green-600">{providers.filter(p => p.isAvailable).length}</p>
            <p className="text-[10px] text-muted-foreground">Available</p>
          </Card>
          <Card className="p-2 border-border">
            <p className="text-xl font-bold text-primary">{providers.filter(p => p.isVerified).length}</p>
            <p className="text-[10px] text-muted-foreground">Verified</p>
          </Card>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search providers..." className="pl-9" value={query} onChange={e => setQuery(e.target.value)} />
        </div>

        <div className="space-y-2">
          {filtered.map(sp => (
            <Card key={sp.id} className="p-4 border-border">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl bg-muted overflow-hidden shrink-0">
                  <img src={sp.image} alt={sp.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold truncate">{sp.name}</p>
                    {sp.isVerified && <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />}
                  </div>
                  <p className="text-xs text-muted-foreground">{sp.category} · {sp.village}</p>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />{sp.rating} ({sp.reviewCount})</span>
                    <span>₹{sp.hourlyRate}/hr</span>
                    <span>{sp.jobsCompleted} jobs</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Available</span>
                  <Switch checked={sp.isAvailable} onCheckedChange={() => toggle(sp.id)} />
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" className="h-7 w-7 p-0"><Phone className="w-3 h-3" /></Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs">View</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
