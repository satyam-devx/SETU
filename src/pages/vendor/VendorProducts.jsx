import React, { useState } from 'react';
import { Plus, Search, Package, Edit, Eye, EyeOff } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AppHeader from '@/components/shared/AppHeader';
import { PRODUCTS } from '@/lib/mockData';

const vendorProducts = PRODUCTS.filter(p => p.vendorId === 'vn1');

export default function VendorProducts() {
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const filtered = vendorProducts.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="pb-20">
      <AppHeader title="Products" subtitle={`${vendorProducts.length} items`} rightAction={
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="text-xs h-8"><Plus className="w-3 h-3 mr-1" /> Add</Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Add New Product</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label className="text-xs">Product Name</Label><Input placeholder="e.g. Basmati Rice 5kg" /></div>
              <div><Label className="text-xs">Name (Hindi)</Label><Input placeholder="e.g. बासमती चावल" /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Price (₹)</Label><Input type="number" placeholder="450" /></div>
                <div><Label className="text-xs">MRP (₹)</Label><Input type="number" placeholder="520" /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Stock</Label><Input type="number" placeholder="25" /></div>
                <div><Label className="text-xs">Unit</Label>
                  <Select defaultValue="piece">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="piece">Piece</SelectItem>
                      <SelectItem value="kg">Kg</SelectItem>
                      <SelectItem value="litre">Litre</SelectItem>
                      <SelectItem value="bag">Bag</SelectItem>
                      <SelectItem value="bottle">Bottle</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label className="text-xs">Description</Label><Textarea placeholder="Product description..." rows={2} /></div>
              <div className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:bg-muted/50">
                <Package className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Tap to add photo or use voice</p>
              </div>
              <Button className="w-full" onClick={() => setAddOpen(false)}>Add Product</Button>
            </div>
          </DialogContent>
        </Dialog>
      } />

      <div className="px-4 py-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search products..." className="pl-10 bg-muted/50 border-0 rounded-xl" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="px-4 space-y-2">
        {filtered.map(product => (
          <Card key={product.id} className="border-border overflow-hidden">
            <div className="flex">
              <div className="w-20 h-20 bg-muted shrink-0">
                <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 p-3 min-w-0">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold truncate">{product.name}</h4>
                    <p className="text-[10px] text-muted-foreground">{product.nameHindi}</p>
                  </div>
                  <Switch defaultChecked={product.isAvailable} />
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm font-bold">₹{product.price}</span>
                  {product.mrp > product.price && <span className="text-[10px] text-muted-foreground line-through">₹{product.mrp}</span>}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-[9px] h-4">{product.stock} in stock</Badge>
                  {product.stock < 10 && <Badge className="text-[9px] h-4 bg-amber-100 text-amber-800 border-0">Low stock</Badge>}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}