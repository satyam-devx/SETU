import React, { useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Mic, X, Star, SlidersHorizontal } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Slider } from '@/components/ui/slider';
import EmptyState from '@/components/shared/EmptyState';
import { PRODUCTS, VENDORS, CATEGORIES } from '@/lib/mockData';

export default function CustomerSearch() {
  const [params] = useSearchParams();
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(params.get('category') || 'all');
  const [maxPrice, setMaxPrice] = useState(1000);
  const [sortBy, setSortBy] = useState('popular');
  const [viewMode, setViewMode] = useState('products');

  const filteredProducts = useMemo(() => {
    let results = PRODUCTS;
    if (query) results = results.filter(p => p.name.toLowerCase().includes(query.toLowerCase()) || (p.nameHindi && p.nameHindi.includes(query)));
    if (selectedCategory !== 'all') results = results.filter(p => {
      const cat = CATEGORIES.find(c => c.id === selectedCategory);
      return cat && p.category === cat.name;
    });
    results = results.filter(p => p.price <= maxPrice);
    if (sortBy === 'price_low') results = [...results].sort((a, b) => a.price - b.price);
    if (sortBy === 'price_high') results = [...results].sort((a, b) => b.price - a.price);
    return results;
  }, [query, selectedCategory, maxPrice, sortBy]);

  const filteredVendors = useMemo(() => {
    if (!query) return VENDORS;
    return VENDORS.filter(v => v.name.toLowerCase().includes(query.toLowerCase()) || v.category.toLowerCase().includes(query.toLowerCase()));
  }, [query]);

  return (
    <div className="pb-20">
      <div className="sticky top-0 z-10 bg-background px-4 py-3 border-b border-border space-y-2">
        <div className="flex items-center gap-2">
          <Link to="/customer" className="shrink-0"><X className="w-5 h-5 text-muted-foreground" /></Link>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input autoFocus placeholder="Search products, vendors..." className="pl-9 pr-9 h-9 bg-muted/50 border-0" value={query} onChange={e => setQuery(e.target.value)} />
            {query && <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="w-4 h-4 text-muted-foreground" /></button>}
          </div>
          <Button variant="ghost" size="icon" className="shrink-0 text-primary"><Mic className="w-5 h-5" /></Button>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 gap-1 shrink-0"><SlidersHorizontal className="w-3 h-3" /> Filter</Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[60vh]">
              <SheetHeader><SheetTitle>Filter & Sort</SheetTitle></SheetHeader>
              <div className="space-y-6 mt-4">
                <div>
                  <p className="text-sm font-semibold mb-2">Sort By</p>
                  <div className="flex flex-wrap gap-2">
                    {[['popular','Most Popular'],['price_low','Price: Low to High'],['price_high','Price: High to Low']].map(([val,label]) => (
                      <button key={val} onClick={() => setSortBy(val)} className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${sortBy === val ? 'bg-primary text-white border-primary' : 'border-border'}`}>{label}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold mb-2">Max Price: ₹{maxPrice}</p>
                  <Slider value={[maxPrice]} onValueChange={([v]) => setMaxPrice(v)} min={50} max={1000} step={50} className="w-full" />
                </div>
              </div>
            </SheetContent>
          </Sheet>
          {['all', ...CATEGORIES.slice(0,6).map(c => c.id)].map(cId => {
            const cat = CATEGORIES.find(c => c.id === cId);
            return (
              <button key={cId} onClick={() => setSelectedCategory(cId)} className={`text-xs px-3 py-1 rounded-full border whitespace-nowrap transition-colors shrink-0 ${selectedCategory === cId ? 'bg-primary text-white border-primary' : 'border-border bg-card'}`}>
                {cId === 'all' ? 'All' : cat?.name.split(' ')[0]}
              </button>
            );
          })}
        </div>
        <div className="flex gap-2">
          <button onClick={() => setViewMode('products')} className={`text-xs px-3 py-1 rounded-full transition-colors ${viewMode === 'products' ? 'bg-foreground text-background' : 'text-muted-foreground'}`}>Products ({filteredProducts.length})</button>
          <button onClick={() => setViewMode('vendors')} className={`text-xs px-3 py-1 rounded-full transition-colors ${viewMode === 'vendors' ? 'bg-foreground text-background' : 'text-muted-foreground'}`}>Vendors ({filteredVendors.length})</button>
        </div>
      </div>

      <div className="px-4 py-3">
        {viewMode === 'products' && (
          filteredProducts.length === 0
            ? <EmptyState icon={Search} title="No products found" description="Try a different search or remove filters" />
            : <div className="grid grid-cols-2 gap-3">
                {filteredProducts.map(p => (
                  <Link key={p.id} to={`/customer/product/${p.id}`}>
                    <Card className="overflow-hidden border-border">
                      <div className="h-28 bg-muted">
                        <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="p-3">
                        <h4 className="text-xs font-semibold line-clamp-2">{p.name}</h4>
                        <p className="text-[10px] text-muted-foreground">{p.nameHindi}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-sm font-bold">₹{p.price}</span>
                          {p.mrp > p.price && <span className="text-[10px] text-muted-foreground line-through">₹{p.mrp}</span>}
                          {p.mrp > p.price && <Badge className="text-[9px] bg-green-100 text-green-700 border-0 h-4">{Math.round((p.mrp-p.price)/p.mrp*100)}% off</Badge>}
                        </div>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
        )}
        {viewMode === 'vendors' && (
          filteredVendors.length === 0
            ? <EmptyState icon={Search} title="No vendors found" description="Try a different search" />
            : <div className="space-y-3">
                {filteredVendors.map(v => (
                  <Link key={v.id} to={`/customer/vendor/${v.id}`}>
                    <Card className="overflow-hidden border-border flex">
                      <div className="w-24 h-24 shrink-0">
                        <img src={v.image} alt={v.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="p-3 flex-1 min-w-0">
                        <div className="flex items-start gap-2">
                          <div className="min-w-0">
                            <h4 className="text-sm font-semibold truncate">{v.name}</h4>
                            <p className="text-xs text-muted-foreground">{v.category}</p>
                          </div>
                          {v.isVerified && <Badge className="shrink-0 bg-accent/10 text-accent border-0 text-[9px]">✓</Badge>}
                        </div>
                        <div className="flex items-center gap-2 mt-1.5">
                          <Star className="w-3 h-3 text-primary fill-primary" />
                          <span className="text-xs font-medium">{v.rating}</span>
                          <span className="text-[10px] text-muted-foreground">({v.reviewCount})</span>
                          <Badge variant={v.isOpen ? 'default' : 'secondary'} className="text-[9px] h-4 ml-auto">{v.isOpen ? 'Open' : 'Closed'}</Badge>
                        </div>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
        )}
      </div>
    </div>
  );
}
