import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, CheckCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import AppHeader from '@/components/shared/AppHeader';
import { CATEGORIES } from '@/lib/mockData';

const UNITS = ['kg', 'g', 'litre', 'ml', 'piece', 'box', 'pack', 'bag', 'dozen', 'bundle'];

export default function VendorAddProduct() {
  const navigate = useNavigate();
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [form, setForm]       = useState({
    name: '', nameHindi: '', category: '', price: '', mrp: '',
    unit: 'kg', stock: '', description: '', isSeasonal: false, isAvailable: true,
  });
  const [errors, setErrors] = useState({});

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const validate = () => {
    const e = {};
    if (!form.name.trim())     e.name     = 'Product name is required';
    if (!form.category)        e.category = 'Category is required';
    if (!form.price || isNaN(form.price) || Number(form.price) <= 0) e.price = 'Valid price required';
    if (!form.stock || isNaN(form.stock) || Number(form.stock) < 0)  e.stock = 'Valid stock required';
    return e;
  };

  const handleSave = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setSaved(true);
      setTimeout(() => navigate('/vendor/products'), 1500);
    }, 800);
  };

  if (saved) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-xl font-bold">Product Added!</h2>
        <p className="text-sm text-muted-foreground">Redirecting to catalog...</p>
      </div>
    );
  }

  return (
    <div className="pb-24">
      <AppHeader title="Add Product" showBack backTo="/vendor/products" />
      <div className="px-4 py-4 space-y-4">

        {/* Photo */}
        <Card className="p-4 border-border border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer h-32 hover:bg-muted/30 transition-colors">
          <Camera className="w-8 h-8 text-muted-foreground" />
          <p className="text-sm font-medium">Add Product Photo</p>
          <p className="text-xs text-muted-foreground">Tap to take photo or upload</p>
        </Card>

        {/* Basic info */}
        <Card className="p-4 border-border space-y-3">
          <h3 className="font-semibold text-sm">Product Details</h3>
          <div>
            <Label className="text-xs mb-1 block">Product Name (English) *</Label>
            <Input placeholder="e.g. Basmati Rice 5kg" value={form.name} onChange={e => set('name', e.target.value)} />
            {errors.name && <p className="text-xs text-destructive mt-0.5">{errors.name}</p>}
          </div>
          <div>
            <Label className="text-xs mb-1 block">Product Name (Hindi)</Label>
            <Input placeholder="e.g. बासमती चावल" value={form.nameHindi} onChange={e => set('nameHindi', e.target.value)} />
          </div>
          <div>
            <Label className="text-xs mb-1 block">Category *</Label>
            <select
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={form.category}
              onChange={e => set('category', e.target.value)}
            >
              <option value="">Select category...</option>
              {CATEGORIES.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
            {errors.category && <p className="text-xs text-destructive mt-0.5">{errors.category}</p>}
          </div>
          <div>
            <Label className="text-xs mb-1 block">Description</Label>
            <Textarea
              placeholder="Brief description of the product..."
              className="h-20 text-sm"
              value={form.description}
              onChange={e => set('description', e.target.value)}
            />
          </div>
        </Card>

        {/* Pricing */}
        <Card className="p-4 border-border space-y-3">
          <h3 className="font-semibold text-sm">Pricing & Stock</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs mb-1 block">Selling Price (₹) *</Label>
              <Input type="number" placeholder="0" value={form.price} onChange={e => set('price', e.target.value)} />
              {errors.price && <p className="text-xs text-destructive mt-0.5">{errors.price}</p>}
            </div>
            <div>
              <Label className="text-xs mb-1 block">MRP (₹)</Label>
              <Input type="number" placeholder="0" value={form.mrp} onChange={e => set('mrp', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs mb-1 block">Stock Quantity *</Label>
              <Input type="number" placeholder="0" value={form.stock} onChange={e => set('stock', e.target.value)} />
              {errors.stock && <p className="text-xs text-destructive mt-0.5">{errors.stock}</p>}
            </div>
            <div>
              <Label className="text-xs mb-1 block">Unit</Label>
              <select
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={form.unit}
                onChange={e => set('unit', e.target.value)}
              >
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          {form.price && form.mrp && Number(form.mrp) > Number(form.price) && (
            <p className="text-xs text-green-600 font-medium">
              Discount: {Math.round((form.mrp - form.price) / form.mrp * 100)}% off MRP
            </p>
          )}
        </Card>

        {/* Toggles */}
        <Card className="p-4 border-border divide-y divide-border">
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-medium">Available Now</p>
              <p className="text-xs text-muted-foreground">Customers can order this product</p>
            </div>
            <Switch checked={form.isAvailable} onCheckedChange={v => set('isAvailable', v)} />
          </div>
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-medium">Seasonal Product</p>
              <p className="text-xs text-muted-foreground">Mark if availability varies by season</p>
            </div>
            <Switch checked={form.isSeasonal} onCheckedChange={v => set('isSeasonal', v)} />
          </div>
        </Card>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border px-4 py-3 flex gap-2">
        <Button variant="outline" className="flex-1" onClick={() => navigate('/vendor/products')}>
          Cancel
        </Button>
        <Button className="flex-1" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Add Product'}
        </Button>
      </div>
    </div>
  );
}
