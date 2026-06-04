import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Edit2, ToggleLeft, ToggleRight, Package } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import AppHeader from '@/components/shared/AppHeader';
import { PRODUCTS } from '@/lib/mockData';

const VENDOR_ID = 'vn1';

export default function VendorProducts() {
  const [query, setQuery]   = useState('');
  const [products, setProds] = useState(PRODUCTS.filter(p => p.vendorId === VENDOR_ID));

  const toggle = (id) => setProds(ps => ps.map(p => p.id === id ? { ...p, isAvailable: !p.isAvailable } : p));

  const filtered = products.filter(p =>
    !query || p.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="pb-24">
      <AppHeader
        title="My Products"
        subtitle={`${products.filter(p => p.isAvailable).length} available`}
        rightAction={
          <Link to="/vendor/products/new">
            <Button size="sm" className="h-8 gap-1 text-xs">
              <Plus className="w-3.5 h-3.5" /> Add
            </Button>
          </Link>
        }
      />
      <div className="px-4 py-3 space-y-3">

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search products..." className="pl-9 h-8 text-sm" value={query} onChange={e => setQuery(e.target.value)} />
        </div>

        {filtered.length === 0 ? (
          <Card className="p-8 border-border text-center">
            <Package className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No products found</p>
            <Link to="/vendor/products/new">
              <Button size="sm" className="mt-3 gap-1"><Plus className="w-3 h-3" /> Add Product</Button>
            </Link>
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map(p => (
              <Card key={p.id} className={`p-3 border ${p.isAvailable ? 'border-border' : 'border-border opacity-60'}`}>
                <div className="flex items-start gap-3">
                  <div className="w-14 h-14 rounded-lg bg-muted shrink-0 overflow-hidden">
                    <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.nameHindi} · {p.category}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm font-bold">₹{p.price}</span>
                      {p.mrp > p.price && <span className="text-xs line-through text-muted-foreground">₹{p.mrp}</span>}
                      <Badge variant="outline" className="text-[9px]">Stock: {p.stock}</Badge>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <Switch checked={p.isAvailable} onCheckedChange={() => toggle(p.id)} />
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                {p.stock < 5 && (
                  <div className="mt-2 text-xs text-amber-600 font-medium flex items-center gap-1">
                    ⚠ Low stock — only {p.stock} left
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="fixed bottom-20 right-4">
        <Link to="/vendor/products/new">
          <Button className="rounded-full w-12 h-12 p-0 shadow-lg">
            <Plus className="w-5 h-5" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
