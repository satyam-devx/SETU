// ═══════════════════════════════════════════════════════════
// SETU — VendorAddProduct (v2)
// Changes:
//  - Removed CATEGORIES mock → useDataFetch(() => getCategories())
//  - Image upload via Supabase Storage (product-images bucket)
//  - Save wired to upsertProduct with real vendor_id from auth
//  - Image preview + upload progress indicator
//  - Validation includes image (optional but shown as tip)
// ═══════════════════════════════════════════════════════════
import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, CheckCircle, X, Loader2, AlertCircle, ImagePlus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import AppHeader from '@/components/shared/AppHeader';
import { useAuth } from '@/lib/AuthContext';
import { useDataFetch } from '@/hooks/useDataFetch';
import { getCategories, getVendorByOwnerId, upsertProduct } from '@/lib/api';
import { supabase } from '@/lib/supabase';

const UNITS = ['kg', 'g', 'litre', 'ml', 'piece', 'box', 'pack', 'bag', 'dozen', 'bundle'];
const MAX_IMAGE_SIZE_MB = 5;

// ── Upload image to Supabase Storage ────────────────────────
async function uploadProductImage(file, vendorId) {
  const ext      = file.name.split('.').pop() ?? 'jpg';
  const filePath = `${vendorId}/${Date.now()}.${ext}`;

  const { data, error } = await supabase.storage
    .from('product-images')
    .upload(filePath, file, { upsert: false, contentType: file.type });

  if (error) throw error;

  const { data: { publicUrl } } = supabase.storage
    .from('product-images')
    .getPublicUrl(data.path);

  return publicUrl;
}

export default function VendorAddProduct() {
  const navigate = useNavigate();
  const { user }  = useAuth();
  const fileRef   = useRef(null);

  // ── Vendor profile ────────────────────────────────────────
  const { data: vendor } = useDataFetch(
    () => getVendorByOwnerId(user?.id),
    [user?.id],
    { cacheKey: `vendor-profile-${user?.id}`, enabled: !!user?.id }
  );

  // ── Categories from DB ────────────────────────────────────
  const { data: categories, isLoading: catsLoading } = useDataFetch(
    () => getCategories(),
    [],
    { cacheKey: 'categories', staleTime: 120_000 }
  );
  const cats = categories ?? [];

  // ── Form state ────────────────────────────────────────────
  const [form, setForm] = useState({
    name: '', name_hindi: '', category: '', price: '', mrp: '',
    unit: 'kg', stock: '', description: '', is_seasonal: false, is_available: true,
  });
  const [errors,       setErrors]       = useState({});
  const [imageFile,    setImageFile]    = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploadPct,    setUploadPct]    = useState(0);  // 0–100, for fake progress
  const [saving,       setSaving]       = useState(false);
  const [saved,        setSaved]        = useState(false);
  const [saveError,    setSaveError]    = useState(null);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  // ── Image selection ───────────────────────────────────────
  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
      setSaveError(`Image too large — max ${MAX_IMAGE_SIZE_MB} MB`);
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setSaveError(null);
  };

  const clearImage = useCallback(() => {
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    if (fileRef.current) fileRef.current.value = '';
  }, [imagePreview]);

  // ── Validation ────────────────────────────────────────────
  const validate = () => {
    const e = {};
    if (!form.name.trim())                                          e.name     = 'Product name is required';
    if (!form.category)                                             e.category = 'Category is required';
    if (!form.price || isNaN(form.price) || Number(form.price) <= 0) e.price  = 'Valid price required';
    if (!form.stock || isNaN(form.stock) || Number(form.stock) < 0)  e.stock  = 'Valid stock quantity required';
    return e;
  };

  // ── Save ──────────────────────────────────────────────────
  const handleSave = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    if (!vendor?.id) { setSaveError('Vendor profile not loaded. Please refresh.'); return; }

    setSaving(true);
    setSaveError(null);
    setUploadPct(0);

    try {
      // 1. Upload image if provided
      let imageUrl = null;
      if (imageFile) {
        // Fake progress ticks while uploading
        const timer = setInterval(() => setUploadPct(p => Math.min(p + 15, 85)), 200);
        imageUrl = await uploadProductImage(imageFile, vendor.id);
        clearInterval(timer);
        setUploadPct(100);
      }

      // 2. Persist product
      const { data, error } = await upsertProduct({
        vendor_id:    vendor.id,
        name:         form.name.trim(),
        name_hindi:   form.name_hindi.trim() || null,
        category:     form.category,
        price:        Number(form.price),
        mrp:          form.mrp ? Number(form.mrp) : Number(form.price),
        unit:         form.unit,
        stock:        Number(form.stock),
        description:  form.description.trim() || null,
        is_seasonal:  form.is_seasonal,
        is_available: form.is_available,
        image_url:    imageUrl,
      });

      if (error) throw error;

      setSaved(true);
      setTimeout(() => navigate('/vendor/products'), 1800);
    } catch (err) {
      console.error('[VendorAddProduct] save error', err);
      setSaveError(err.message ?? 'Failed to add product. Please try again.');
      setUploadPct(0);
    } finally {
      setSaving(false);
    }
  };

  // ── Success screen ────────────────────────────────────────
  if (saved) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center bg-background">
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

        {/* Error banner */}
        {saveError && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl flex items-start gap-2 text-destructive">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="text-xs font-medium">{saveError}</p>
          </div>
        )}

        {/* ── Photo upload ───────────────────────────────── */}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleImageChange}
        />

        {imagePreview ? (
          <div className="relative w-full h-44 rounded-xl overflow-hidden border border-border">
            <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
            <button
              onClick={clearImage}
              className="absolute top-2 right-2 w-7 h-7 bg-black/60 rounded-full flex items-center justify-center"
            >
              <X className="w-4 h-4 text-white" />
            </button>
            {saving && uploadPct > 0 && uploadPct < 100 && (
              <div className="absolute bottom-0 left-0 right-0 px-3 pb-3">
                <Progress value={uploadPct} className="h-1.5" />
                <p className="text-white text-[10px] mt-1 text-center">Uploading image...</p>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full h-36 rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 hover:border-primary hover:bg-primary/5 transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
              <ImagePlus className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">Add Product Photo</p>
            <p className="text-xs text-muted-foreground">Tap to take photo or upload · Max {MAX_IMAGE_SIZE_MB}MB</p>
          </button>
        )}

        {/* ── Product details ────────────────────────────── */}
        <Card className="p-4 border-border space-y-3">
          <h3 className="font-semibold text-sm">Product Details</h3>

          <div>
            <Label className="text-xs mb-1 block">Product Name (English) *</Label>
            <Input
              placeholder="e.g. Basmati Rice 5kg"
              value={form.name}
              onChange={e => set('name', e.target.value)}
            />
            {errors.name && <p className="text-xs text-destructive mt-0.5">{errors.name}</p>}
          </div>

          <div>
            <Label className="text-xs mb-1 block">Product Name (Hindi)</Label>
            <Input
              placeholder="e.g. बासमती चावल"
              value={form.name_hindi}
              onChange={e => set('name_hindi', e.target.value)}
            />
          </div>

          <div>
            <Label className="text-xs mb-1 block">Category *</Label>
            {catsLoading ? (
              <div className="h-9 bg-muted rounded-md animate-pulse" />
            ) : (
              <select
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={form.category}
                onChange={e => set('category', e.target.value)}
              >
                <option value="">Select category...</option>
                {cats.map(c => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            )}
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

        {/* ── Pricing & stock ────────────────────────────── */}
        <Card className="p-4 border-border space-y-3">
          <h3 className="font-semibold text-sm">Pricing & Stock</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs mb-1 block">Selling Price (₹) *</Label>
              <Input
                type="number"
                placeholder="0"
                value={form.price}
                onChange={e => set('price', e.target.value)}
              />
              {errors.price && <p className="text-xs text-destructive mt-0.5">{errors.price}</p>}
            </div>
            <div>
              <Label className="text-xs mb-1 block">MRP (₹)</Label>
              <Input
                type="number"
                placeholder="0"
                value={form.mrp}
                onChange={e => set('mrp', e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs mb-1 block">Stock Quantity *</Label>
              <Input
                type="number"
                placeholder="0"
                value={form.stock}
                onChange={e => set('stock', e.target.value)}
              />
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
              Discount: {Math.round((Number(form.mrp) - Number(form.price)) / Number(form.mrp) * 100)}% off MRP
            </p>
          )}
        </Card>

        {/* ── Toggles ─────────────────────────────────────── */}
        <Card className="p-4 border-border divide-y divide-border">
          <div className="flex items-center justify-between pb-3">
            <div>
              <p className="text-sm font-medium">Available Now</p>
              <p className="text-xs text-muted-foreground">Customers can order this product</p>
            </div>
            <Switch checked={form.is_available} onCheckedChange={v => set('is_available', v)} />
          </div>
          <div className="flex items-center justify-between pt-3">
            <div>
              <p className="text-sm font-medium">Seasonal Product</p>
              <p className="text-xs text-muted-foreground">Mark if availability varies by season</p>
            </div>
            <Switch checked={form.is_seasonal} onCheckedChange={v => set('is_seasonal', v)} />
          </div>
        </Card>
      </div>

      {/* ── Bottom CTA ──────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border px-4 py-3 flex gap-2">
        <Button variant="outline" className="flex-1" onClick={() => navigate('/vendor/products')}>
          Cancel
        </Button>
        <Button className="flex-1 gap-2" onClick={handleSave} disabled={saving}>
          {saving
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
            : 'Add Product'}
        </Button>
      </div>
    </div>
  );
}
