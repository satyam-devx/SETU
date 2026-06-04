import React, { useState } from 'react';
import { Search, Star, MapPin, CheckCircle, XCircle, Phone } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppHeader from '@/components/shared/AppHeader';
import { VENDORS } from '@/lib/mockData';

export default function AdminVendors() {
  const [tab, setTab]       = useState('active');
  const [query, setQuery]   = useState('');
  const [vendors, setVendors] = useState(VENDORS);

  const toggleOpen = (id) => setVendors(vs => vs.map(v => v.id === id ? { ...v, isOpen: !v.isOpen } : v));

  const filtered = vendors.filter(v => {
    const matchQ = !query || v.name.toLowerCase().includes(query.toLowerCase()) || v.village.toLowerCase().includes(query.toLowerCase());
    if (tab === 'active')   return matchQ && v.isVerified && v.isOpen;
    if (tab === 'offline')  return matchQ && v.isVerified && !v.isOpen;
    if (tab === 'unverified') return matchQ && !v.isVerified;
    return matchQ;
  });

  return (
    <div className="flex-1 overflow-auto">
      <AppHeader title="Vendors" subtitle={`${vendors.filter(v => v.isVerified).length} active`} />
      <div className="p-4 space-y-4">

        <div className="grid grid-cols-3 gap-2 text-center">
          <Card className="p-2 border-border">
            <p className="text-xl font-bold text-green-600">{vendors.filter(v => v.isOpen).length}</p>
            <p className="text-[10px] text-muted-foreground">Open Now</p>
          </Card>
          <Card className="p-2 border-border">
            <p className="text-xl font-bold">{vendors.filter(v => v.isVerified).length}</p>
            <p className="text-[10px] text-muted-foreground">Verified</p>
          </Card>
          <Card className="p-2 border-border">
            <p className="text-xl font-bold text-amber-500">{vendors.filter(v => !v.isVerified).length}</p>
            <p className="text-[10px] text-muted-foreground">Pending</p>
          </Card>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search vendors..." className="pl-9" value={query} onChange={e => setQuery(e.target.value)} />
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="active"     className="text-xs">Active</TabsTrigger>
            <TabsTrigger value="offline"    className="text-xs">Offline</TabsTrigger>
            <TabsTrigger value="unverified" className="text-xs">Pending</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="space-y-2">
          {filtered.length === 0 ? (
            <Card className="p-6 border-border text-center">
              <p className="text-sm text-muted-foreground">No vendors in this category</p>
            </Card>
          ) : (
            filtered.map(v => (
              <Card key={v.id} className="p-4 border-border">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-12 h-12 rounded-xl bg-muted overflow-hidden shrink-0">
                    <img src={v.image} alt={v.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold truncate">{v.name}</p>
                      {v.isVerified && <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />}
                    </div>
                    <p className="text-xs text-muted-foreground">{v.category}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{v.village}</span>
                      <span className="flex items-center gap-1"><Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />{v.rating}</span>
                    </div>
                  </div>
                  <div className="shrink-0">
                    <Badge className={`text-[9px] border-0 ${v.isOpen ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {v.isOpen ? 'Open' : 'Closed'}
                    </Badge>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Store open</span>
                    <Switch checked={v.isOpen} onCheckedChange={() => toggleOpen(v.id)} />
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" className="h-7 w-7 p-0">
                      <Phone className="w-3 h-3" />
                    </Button>
                    {!v.isVerified && (
                      <Button size="sm" className="h-7 text-xs gap-1">
                        <CheckCircle className="w-3 h-3" /> Approve
                      </Button>
                    )}
                    {v.isVerified && (
                      <Button size="sm" variant="outline" className="h-7 text-xs">View</Button>
                    )}
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
