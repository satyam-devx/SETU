import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2, Save, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import AppHeader from '@/components/shared/AppHeader';
import { useAuth } from '@/lib/AuthContext';
import { useDataFetch } from '@/hooks/useDataFetch';
import { getProductById, getCategories, getVendorByOwnerId, upsertProduct } from '@/lib/api';

export default function VendorEditProduct() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  // NOTE: the product fetch used to be gated on vendor?.id (enabled: !!productId
  // && !!vendor?.id) to double as an ownership filter. That created a two-step
  // dependent fetch: while `vendor` was still resolving, `enabled` was false, so
  // this hook's `isLoading` initialised to `false` (its lazy useState only looks
  // at `enabled` once, on mount) even though nothing had loaded yet — the render
  // below then fell through to the "Product not found" card for that whole
  // window, before snapping to the real form once vendor resolved. That's the
  // "briefly redirects to another page" glitch. Fetching the product
  // independently (by id alone, no vendor?.id dependency) and checking
  // ownership separately below removes the dependent-fetch race entirely.
  const { data: vendor, isLoading: vendorLoading } = useDataFetch(() => getVendorByOwnerId(user?.id), [user?.id], { cacheKey: `vendor-profile-${user?.id}`, enabled: !!user?.id });
  const { data: product, isLoading: productLoading, error: loadError } = useDataFetch(() => getProductById(productId), [productId], { enabled: !!productId });
  const { data: categories } = useDataFetch(() => getCategories(), [], { cacheKey: 'categories', staleTime: 120000 });
  const isLoading = vendorLoading || productLoading;
  const notOwned  = !!product && !!vendor?.id && (product.vendor_id ?? product.vendorId) !== vendor.id;
  const [form,setForm]=useState(null); const [saving,setSaving]=useState(false); const [error,setError]=useState('');
  useEffect(()=>{
    if(product) setForm({
      name: product.name ?? '', name_hindi: product.name_hindi ?? '', category: product.category ?? '',
      price: product.price ?? '', mrp: product.mrp ?? '', unit: product.unit ?? 'piece',
      stock: product.stock ?? 0, description: product.description ?? '',
      is_seasonal: !!product.is_seasonal, is_available: product.is_available !== false,
      image_url: product.image_url ?? product.image ?? '',
    });
  },[product]);
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const save=async()=>{
    if(!form || !vendor?.id) return;
    setError('');
    if(!form.name.trim() || !form.category || Number(form.price)<=0 || Number(form.stock)<0) return setError('Please enter a name, category, valid price and non-negative stock.');
    setSaving(true);
    const {error:e}=await upsertProduct({
      id: productId, vendor_id: vendor.id, name: form.name.trim(), name_hindi: form.name_hindi.trim()||null,
      category: form.category, price:Number(form.price), mrp:Number(form.mrp)||Number(form.price), unit:form.unit,
      stock:Number(form.stock), description:form.description.trim()||null, is_seasonal:form.is_seasonal,
      is_available:form.is_available, image_url:form.image_url.trim()||null,
    });
    setSaving(false); if(e) return setError(e.message||'Could not save product.'); navigate('/vendor/products',{replace:true});
  };
  if(isLoading) return <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">Loading product…</div>;
  if(loadError || !product || notOwned) return <div className="p-6"><Card className="p-6 text-center"><AlertCircle className="mx-auto mb-2"/><p className="text-sm">Product not found or could not be loaded.</p><Button className="mt-3" onClick={()=>navigate('/vendor/products')}>Back to products</Button></Card></div>;
  // `form` is seeded from `product` by the effect above, which — like every
  // effect — runs one render AFTER `product` itself becomes available. So
  // there's always exactly one render where `product` is already valid but
  // `form` is still null. Lumping `!form` in with the checks above (as a
  // previous fix did) meant THIS render hit the "not found" card too — a
  // real, visible flash despite `product` having loaded correctly. Treating
  // it as "still loading" instead (never "not found", never rendering the
  // form with a null `form`) removes that flash for good.
  if(!form) return <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">Loading product…</div>;
  return <div className="pb-24"><AppHeader title="Edit Product" showBack backTo="/vendor/products"/><div className="p-4 space-y-4">
    {error&&<div className="p-3 rounded-xl bg-destructive/10 text-destructive text-xs flex gap-2"><AlertCircle className="w-4 h-4 shrink-0"/>{error}</div>}
    <Card className="p-4 space-y-3"><h3 className="font-semibold text-sm">Product details</h3>
      <Field label="Product name *"><Input value={form.name} onChange={e=>set('name',e.target.value)}/></Field>
      <Field label="Hindi name"><Input value={form.name_hindi} onChange={e=>set('name_hindi',e.target.value)}/></Field>
      <Field label="Category *"><select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={form.category} onChange={e=>set('category',e.target.value)}><option value="">Select category</option>{(categories??[]).map(c=><option key={c.id} value={c.name}>{c.name}</option>)}</select></Field>
      <div className="grid grid-cols-2 gap-3"><Field label="Price *"><Input type="number" min="0.01" value={form.price} onChange={e=>set('price',e.target.value)}/></Field><Field label="MRP"><Input type="number" min="0" value={form.mrp} onChange={e=>set('mrp',e.target.value)}/></Field></div>
      <div className="grid grid-cols-2 gap-3"><Field label="Unit"><Input value={form.unit} onChange={e=>set('unit',e.target.value)}/></Field><Field label="Stock *"><Input type="number" min="0" value={form.stock} onChange={e=>set('stock',e.target.value)}/></Field></div>
      <Field label="Image URL"><Input type="url" placeholder="https://..." value={form.image_url} onChange={e=>set('image_url',e.target.value)}/></Field>
      <Field label="Description"><Textarea value={form.description} onChange={e=>set('description',e.target.value)}/></Field>
      <div className="flex items-center justify-between"><div><p className="text-sm font-medium">Available for sale</p><p className="text-xs text-muted-foreground">Hide it without deleting it.</p></div><Switch checked={form.is_available} onCheckedChange={v=>set('is_available',v)}/></div>
    </Card>
    <Button className="w-full gap-2" onClick={save} disabled={saving}>{saving?<Loader2 className="w-4 h-4 animate-spin"/>:<Save className="w-4 h-4"/>}{saving?'Saving…':'Save changes'}</Button>
  </div></div>;
}
function Field({label,children}){return <div><Label className="text-xs mb-1 block">{label}</Label>{children}</div>}
