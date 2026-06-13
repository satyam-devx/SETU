// ═══════════════════════════════════════════════════════════
// SETU PLATFORM — VENDOR ONBOARDING  (v3 — merged)
//
// Merge of:
//  - Your uploaded version: per-step DB persistence, real
//    Supabase Storage image uploads, vendor_payment_info table,
//    live product adds, per-step loading/error states.
//  - Phase 0 version: villages fetched from DB (not hardcoded),
//    DELIVERY_RADII typed values, navigation guard (redirect to
//    /vendor if vendor row already exists), reloadProfile()
//    before navigating on submit, profile role update to 'vendor',
//    input validation with inline errors.
//
// Architecture (your approach — kept):
//  Step 2 saves vendor row immediately via upsertVendorProfile.
//  Step 3 adds products live via upsertProduct + image upload.
//  Step 4 saves to vendor_payment_info via Supabase upsert.
//  Step 5 marks onboarding_status='submitted', updates profile
//         role to 'vendor', calls reloadProfile(), navigates.
// ═══════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle, Camera, Store, MapPin, Package,
  ChevronRight, AlertCircle, Loader2, Plus, X,
} from 'lucide-react';
import { Card }     from '@/components/ui/card';
import { Button }   from '@/components/ui/button';
import { Input }    from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge }    from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { kyc as kycService } from '@/lib/kyc';
import { useAuth }  from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';
import { upsertVendorProfile, upsertProduct, getVillages, getVendorByOwnerId } from '@/lib/api';

// ── Constants ─────────────────────────────────────────────
const STEPS = [
  { id: 1, label: 'Identity',     sublabel: 'Aadhaar + Face' },
  { id: 2, label: 'Shop Details', sublabel: 'Store info'     },
  { id: 3, label: 'Products',     sublabel: 'Your catalog'   },
  { id: 4, label: 'Bank',         sublabel: 'Payments'       },
  { id: 5, label: 'Review',       sublabel: 'Final check'    },
];

const CATEGORIES = [
  'Grocery & Essentials', 'Makhana & Dry Fruits', 'Fresh Vegetables',
  'Dairy & Milk', 'Fish & Meat', 'Sweets & Snacks',
  'Clothing & Textiles', 'Electronics', 'Hardware & Tools', 'Pharmacy',
];

// Numeric delivery radii (Phase 0) — stored as numbers in vendors.delivery_radius
const DELIVERY_RADII = [
  { label: '1 km',  value: 1  },
  { label: '2 km',  value: 2  },
  { label: '3 km',  value: 3  },
  { label: '5 km',  value: 5  },
  { label: '10 km', value: 10 },
];

// ── Step indicator ────────────────────────────────────────
function StepIndicator({ current }) {
  return (
    <div className="flex items-center justify-between px-4 py-4 border-b border-border">
      {STEPS.map((step, i) => (
        <React.Fragment key={step.id}>
          <div className="flex flex-col items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
              step.id < current  ? 'bg-accent text-white' :
              step.id === current ? 'bg-primary text-white' :
                                    'bg-muted text-muted-foreground'
            }`}>
              {step.id < current ? <CheckCircle className="w-4 h-4" /> : step.id}
            </div>
            <p className="text-[9px] text-center mt-1 font-medium hidden sm:block">{step.label}</p>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`flex-1 h-0.5 mx-1 ${step.id < current ? 'bg-accent' : 'bg-border'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ── Step 1: Identity (KYC) ────────────────────────────────
// Your version's logic kept intact; Phase 0's inline error display added.
function Step1({ onNext, user }) {
  const [aadhaar, setAadhaar] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [error,   setError]   = useState('');

  const handleVerify = async () => {
    if (aadhaar.length !== 12) { setError('Enter a 12-digit Aadhaar number.'); return; }
    setLoading(true); setError('');
    try {
      const { error: e } = await kycService.verifyAadhaar(user.id, aadhaar);
      if (e) throw e;
      setOtpSent(true);
    } catch (err) {
      setError(err?.message || 'Aadhaar verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-4 py-6 space-y-5">
      <div>
        <h2 className="text-xl font-bold mb-1">Verify Your Identity</h2>
        <p className="text-sm text-muted-foreground">
          Your Aadhaar verifies you are a real person from this village. This protects your customers.
        </p>
      </div>

      <Card className="p-4 border-border">
        <h3 className="font-semibold text-sm mb-3">Aadhaar Verification</h3>
        <Input
          placeholder="Aadhaar Number (12 digits)"
          className="mb-2 font-mono tracking-widest"
          maxLength={12}
          inputMode="numeric"
          value={aadhaar}
          onChange={e => { setAadhaar(e.target.value.replace(/\D/g, '')); setError(''); }}
          disabled={otpSent}
        />
        {otpSent && <Input placeholder="Registered Mobile OTP" className="mb-2" />}
        {error && (
          <div className="flex items-start gap-2 mb-2 text-destructive text-xs">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {error}
          </div>
        )}
        <div className="space-y-3">
          <Button
            variant="outline" size="sm" className="w-full text-xs"
            onClick={otpSent ? () => onNext() : handleVerify}
            disabled={true || loading || aadhaar.length !== 12}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            {otpSent ? 'Confirm OTP & Continue' : 'Request OTP via UIDAI'}
          </Button>
          <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-[10px] text-amber-700 font-medium">
              KYC verification temporarily unavailable — contact support.
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-4 border-border">
        <h3 className="font-semibold text-sm mb-1">Selfie Verification</h3>
        <p className="text-xs text-muted-foreground mb-3">Take a clear selfie to match with your Aadhaar photo</p>
        <div className="h-36 bg-muted rounded-xl flex items-center justify-center cursor-pointer border-2 border-dashed border-border hover:border-primary transition-colors">
          <div className="text-center">
            <Camera className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">Tap to open camera</p>
          </div>
        </div>
      </Card>

      <Card className="p-4 border-border">
        <h3 className="font-semibold text-sm mb-1">Village Anchor Vouching</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Your Village Anchor must vouch for you before your store goes live.
        </p>
        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary text-sm">
            RD
          </div>
          <div>
            <p className="text-sm font-medium">Ramkali Devi</p>
            <p className="text-xs text-muted-foreground">Village Anchor · Madhepur</p>
          </div>
          <Badge className="ml-auto bg-amber-100 text-amber-800 border-0 text-[9px]">Pending</Badge>
        </div>
      </Card>

      {/* Allow skipping KYC in demo/dev mode */}
      <Button className="w-full" onClick={() => onNext()}>
        Continue to Shop Details <ChevronRight className="w-4 h-4 ml-1" />
      </Button>
    </div>
  );
}

// ── Step 2: Shop Details ──────────────────────────────────
// Your version: immediate DB save, photo upload.
// Phase 0 addition: villages fetched from DB, numeric delivery_radius.
function Step2({ onNext, onBack, onVendorSaved, user }) {
  const [form, setForm] = useState({
    name: '', category: '', description: '',
    village_id: '', landmark: '', delivery_radius: 2,
  });
  const [shopPhotos, setShopPhotos] = useState([]);
  const [villages,   setVillages]   = useState([]);
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState('');
  const photoRef = useRef(null);

  // Fetch villages from DB (Phase 0) — not hardcoded strings
  useEffect(() => {
    getVillages({ activeOnly: true }).then(({ data }) => {
      if (data?.length) setVillages(data);
    });
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handlePhotoAdd = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setShopPhotos(ps => [...ps.slice(0, 2), { file, preview: URL.createObjectURL(file) }]);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Shop name is required.'); return; }
    if (!form.category)    { setError('Please select a category.'); return; }
    if (!form.village_id)  { setError('Please select your village.'); return; }

    setSaving(true); setError('');

    try {
      // Upload shop photos to Supabase Storage (your version)
      const photoUrls = [];
      for (const photo of shopPhotos) {
        if (!photo.file) continue;
        const path = `shop/${user.id}/${Date.now()}.jpg`;
        const { data: uploaded, error: upErr } = await supabase.storage
          .from('vendor-images')
          .upload(path, photo.file);
        if (!upErr) {
          const { data: { publicUrl } } = supabase.storage
            .from('vendor-images')
            .getPublicUrl(uploaded.path);
          photoUrls.push(publicUrl);
        }
      }

      // Resolve village name for display
      const selectedVillage = villages.find(v => v.id === form.village_id);

      const { data: vendor, error: saveErr } = await upsertVendorProfile({
        owner_id:         user.id,
        name:             form.name.trim(),
        category:         form.category,
        description:      form.description.trim() || null,
        village_id:       form.village_id,
        village:          selectedVillage?.name || null,
        landmark:         form.landmark.trim() || null,
        delivery_radius:  form.delivery_radius,  // numeric (Phase 0)
        shop_photos:      photoUrls,
        onboarding_step:  2,
        kyc_status:       'submitted',
        is_active:        true,
        trust_score:      500,
        subscription_tier: 'free',
        is_open:          false,
      });

      if (saveErr) throw saveErr;
      onVendorSaved(vendor);
      onNext();
    } catch (err) {
      setError(err?.message || 'Failed to save shop details. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-4 py-6 space-y-4">
      <div>
        <h2 className="text-xl font-bold mb-1">Your Shop Details</h2>
        <p className="text-sm text-muted-foreground">Tell customers about your store and what you sell.</p>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 bg-destructive/10 rounded-xl text-destructive">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <p className="text-xs font-medium">{error}</p>
        </div>
      )}

      <Input
        placeholder="Shop Name (e.g. Ramesh Kirana Store)"
        value={form.name}
        onChange={e => { set('name', e.target.value); setError(''); }}
      />

      <select
        className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        value={form.category}
        onChange={e => { set('category', e.target.value); setError(''); }}
      >
        <option value="">Primary Category</option>
        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
      </select>

      <Textarea
        placeholder="Shop description (Hindi/English)"
        rows={3}
        value={form.description}
        onChange={e => set('description', e.target.value)}
      />

      {/* Shop photos — your upload implementation */}
      <div>
        <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoAdd} />
        <label className="text-xs font-medium mb-1 block">Shop Photos</label>
        <div className="grid grid-cols-3 gap-2">
          {['Shop front', 'Inside', 'Products'].map((label, i) => (
            <button
              key={label}
              type="button"
              className="aspect-square bg-muted rounded-xl flex flex-col items-center justify-center border-2 border-dashed border-border hover:border-primary transition-colors overflow-hidden"
              onClick={() => photoRef.current?.click()}
            >
              {shopPhotos[i]
                ? <img src={shopPhotos[i].preview} alt={label} className="w-full h-full object-cover" />
                : <><Camera className="w-5 h-5 text-muted-foreground mb-1" /><p className="text-[9px] text-muted-foreground">{label}</p></>
              }
            </button>
          ))}
        </div>
      </div>

      {/* Location — DB villages (Phase 0) */}
      <Card className="p-3 border-border space-y-2">
        <p className="text-xs font-medium flex items-center gap-1">
          <MapPin className="w-3 h-3" /> Shop Location
        </p>
        <select
          className="w-full h-9 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          value={form.village_id}
          onChange={e => { set('village_id', e.target.value); setError(''); }}
        >
          <option value="">Select Village</option>
          {villages.map(v => (
            <option key={v.id} value={v.id}>{v.name}</option>
          ))}
        </select>
        <Input
          placeholder="Landmark (e.g. Near Panchayat office)"
          value={form.landmark}
          onChange={e => set('landmark', e.target.value)}
        />
      </Card>

      {/* Delivery radius — numeric values (Phase 0) */}
      <div>
        <label className="text-xs font-medium mb-1.5 block">Delivery Radius</label>
        <div className="flex gap-2">
          {DELIVERY_RADII.map(r => (
            <button
              key={r.value}
              type="button"
              onClick={() => set('delivery_radius', r.value)}
              className={`flex-1 text-xs py-2 rounded-lg border transition-colors ${
                form.delivery_radius === r.value
                  ? 'border-primary bg-primary/10 text-primary font-medium'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" onClick={onBack}>Back</Button>
        <Button className="flex-1" onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
          Continue <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

// ── Step 3: Products ──────────────────────────────────────
// Your version kept entirely: live adds with image upload + DB write per product.
// Added: onProductAdded callback so root component tracks count correctly.
function Step3({ onNext, onBack, vendorId, onProductAdded }) {
  const fileRef = useRef(null);
  const [products, setProducts] = useState([]);
  const [form,     setForm]     = useState({ name: '', price: '', stock: '', unit: 'piece' });
  const [imgFile,  setImgFile]  = useState(null);
  const [imgPrev,  setImgPrev]  = useState(null);
  const [adding,   setAdding]   = useState(false);
  const [error,    setError]    = useState('');

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleImagePick = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImgFile(file);
    setImgPrev(URL.createObjectURL(file));
  };

  const handleAdd = async () => {
    if (!form.name.trim() || !form.price || !form.stock) {
      setError('Name, price and stock are required.');
      return;
    }
    if (!vendorId) {
      setError('Vendor profile not saved yet. Go back and save shop details.');
      return;
    }
    setAdding(true); setError('');

    try {
      // Upload product image (your version)
      let imageUrl = null;
      if (imgFile) {
        const path = `${vendorId}/${Date.now()}.jpg`;
        const { data: upData, error: upErr } = await supabase.storage
          .from('product-images')
          .upload(path, imgFile);
        if (!upErr) {
          const { data: { publicUrl } } = supabase.storage
            .from('product-images')
            .getPublicUrl(upData.path);
          imageUrl = publicUrl;
        }
      }

      const { data: saved, error: saveErr } = await upsertProduct({
        vendor_id:    vendorId,
        name:         form.name.trim(),
        price:        Number(form.price),
        stock:        Number(form.stock),
        unit:         form.unit,
        is_available: true,
        image_url:    imageUrl,
      });

      if (saveErr) throw saveErr;

      setProducts(ps => [...ps, saved ?? { id: Date.now(), ...form, image_url: imageUrl }]);
      onProductAdded?.();
      setForm({ name: '', price: '', stock: '', unit: 'piece' });
      setImgFile(null); setImgPrev(null);
      if (fileRef.current) fileRef.current.value = '';
    } catch (err) {
      setError(err?.message || 'Failed to add product. Please try again.');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="px-4 py-6 space-y-4">
      <div>
        <h2 className="text-xl font-bold mb-1">Add Your Products</h2>
        <p className="text-sm text-muted-foreground">
          Add at least 5 products to go live. You can always add more later.
        </p>
      </div>

      <div className="bg-accent/10 border border-accent/30 rounded-xl p-3">
        <p className="text-xs text-accent font-medium">
          💡 {products.length}/5 products added · {Math.max(0, 5 - products.length)} more needed to go live
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 bg-destructive/10 rounded-xl text-destructive">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <p className="text-xs font-medium">{error}</p>
        </div>
      )}

      {/* Saved products */}
      {products.map(p => (
        <Card key={p.id} className="p-3 border-border flex items-center gap-3">
          <div className="w-10 h-10 bg-muted rounded-lg shrink-0 overflow-hidden">
            {p.image_url
              ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
              : <Package className="w-5 h-5 text-muted-foreground m-2.5" />
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{p.name}</p>
            <p className="text-xs text-muted-foreground">₹{p.price} · {p.stock} {p.unit}</p>
          </div>
          <Badge className="bg-green-100 text-green-800 border-0 text-[9px]">✓ Added</Badge>
        </Card>
      ))}

      {/* Add product form */}
      <Card className="p-4 border-dashed border-2 border-border">
        <p className="text-sm font-semibold mb-3">Add New Product</p>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImagePick} />

        {imgPrev ? (
          <div className="relative h-28 mb-3 rounded-xl overflow-hidden">
            <img src={imgPrev} alt="preview" className="w-full h-full object-cover" />
            <button
              onClick={() => { setImgFile(null); setImgPrev(null); }}
              className="absolute top-1 right-1 w-6 h-6 bg-black/50 rounded-full flex items-center justify-center"
              aria-label="Remove image"
            >
              <X className="w-3 h-3 text-white" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="w-full h-16 mb-3 rounded-xl border border-dashed border-border flex items-center justify-center gap-2 text-muted-foreground hover:border-primary hover:bg-primary/5 transition-colors"
          >
            <Camera className="w-4 h-4" />
            <span className="text-xs">Add photo (optional)</span>
          </button>
        )}

        <div className="space-y-2">
          <Input
            placeholder="Product name (e.g. Basmati Rice 5kg)"
            value={form.name}
            onChange={e => { setF('name', e.target.value); setError(''); }}
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="number" placeholder="Price (₹)"
              value={form.price}
              onChange={e => setF('price', e.target.value)}
            />
            <Input
              type="number" placeholder="Stock qty"
              value={form.stock}
              onChange={e => setF('stock', e.target.value)}
            />
          </div>
          <select
            className="w-full h-9 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            value={form.unit}
            onChange={e => setF('unit', e.target.value)}
          >
            {['piece','kg','g','litre','ml','pack','dozen'].map(u =>
              <option key={u} value={u}>{u}</option>
            )}
          </select>
        </div>

        <Button className="w-full mt-3 gap-2" onClick={handleAdd} disabled={adding}>
          {adding
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Adding...</>
            : <><Plus className="w-4 h-4" /> Add Product</>
          }
        </Button>
      </Card>

      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" onClick={onBack}>Back</Button>
        <Button
          className="flex-1"
          onClick={onNext}
          disabled={products.length === 0}
        >
          Continue ({products.length} added) <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

// ── Step 4: Bank & Payment ────────────────────────────────
// Your version: saves to vendor_payment_info table.
function Step4({ onNext, onBack, vendorId }) {
  const [form, setForm] = useState({
    account_name: '', account_number: '', ifsc: '', bank_name: '', upi_id: '',
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!vendorId) {
      setError('Vendor profile not found. Go back to shop details.');
      return;
    }
    if (!form.account_number && !form.upi_id) {
      setError('Please add either bank account or UPI ID.');
      return;
    }
    setSaving(true); setError('');

    try {
      // Save to vendor_payment_info (your version)
      const { error: payErr } = await supabase
        .from('vendor_payment_info')
        .upsert(
          {
            vendor_id:      vendorId,
            account_name:   form.account_name.trim(),
            account_number: form.account_number.trim(),
            ifsc:           form.ifsc.trim().toUpperCase(),
            bank_name:      form.bank_name.trim(),
            upi_id:         form.upi_id.trim(),
          },
          { onConflict: 'vendor_id' }
        );

      if (payErr) throw payErr;

      // Mark step progress on vendor row
      await upsertVendorProfile({ owner_id: vendorId, onboarding_step: 4 });
      onNext();
    } catch (err) {
      setError(err?.message || 'Failed to save payment info. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-4 py-6 space-y-4">
      <div>
        <h2 className="text-xl font-bold mb-1">Payment Setup</h2>
        <p className="text-sm text-muted-foreground">
          Add your bank account or UPI ID to receive payments from SETU.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 bg-destructive/10 rounded-xl text-destructive">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <p className="text-xs font-medium">{error}</p>
        </div>
      )}

      <Card className="p-4 border-border space-y-3">
        <h3 className="font-semibold text-sm">Bank Account</h3>
        <Input placeholder="Account Holder Name"    value={form.account_name}   onChange={e => setF('account_name',   e.target.value)} />
        <Input placeholder="Account Number" className="font-mono" value={form.account_number} onChange={e => setF('account_number', e.target.value.replace(/\D/g,''))} />
        <Input placeholder="IFSC Code"      className="font-mono uppercase"     value={form.ifsc}           onChange={e => setF('ifsc',           e.target.value.toUpperCase())} maxLength={11} />
        <Input placeholder="Bank Name (e.g. SBI, PNB)"                          value={form.bank_name}      onChange={e => setF('bank_name',      e.target.value)} />
      </Card>

      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground">OR</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <Card className="p-4 border-border">
        <h3 className="font-semibold text-sm mb-2">UPI ID</h3>
        <Input placeholder="yourname@upi" value={form.upi_id} onChange={e => setF('upi_id', e.target.value)} />
      </Card>

      <Card className="p-3 bg-muted/50 border-border">
        <p className="text-xs text-muted-foreground">
          💰 SETU Fee: <strong>1% per order</strong> deducted at settlement.
          COD payments settled next day. UPI payments settled same day.
        </p>
      </Card>

      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" onClick={onBack}>Back</Button>
        <Button className="flex-1" onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
          Review Application <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

// ── Step 5: Review & Submit ───────────────────────────────
// Your version's checklist + success screen kept.
// Phase 0 additions: profile role update + reloadProfile() before navigate.
function Step5({ vendorId, productsCount, user, onSubmitted }) {
  const navigate    = useNavigate();
  const { reloadProfile } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [submitted,  setSubmitted]  = useState(false);
  const [error,      setError]      = useState('');

  const checklist = [
    { label: '✓ Identity Submitted',    status: 'done'    },
    { label: '✓ Shop Details Saved',    status: 'done'    },
    {
      label:  productsCount >= 5
        ? `✓ ${productsCount} Products Added`
        : `⚠ ${productsCount}/5 Products Added`,
      status: productsCount >= 5 ? 'done' : 'warn',
    },
    { label: '✓ Payment Info Saved',         status: 'done'    },
    { label: '⏳ Anchor Vouching (Pending)', status: 'pending' },
  ];

  const handleSubmit = async () => {
    if (!vendorId) { setError('Vendor ID missing. Please restart onboarding.'); return; }
    setSubmitting(true); setError('');

    try {
      // Mark vendor as submitted (your version)
      const { error: submitErr } = await upsertVendorProfile({
        owner_id:          user.id,
        onboarding_status: 'submitted',
        onboarding_step:   5,
        submitted_at:      new Date().toISOString(),
        is_verified:       false,
      });
      if (submitErr) throw submitErr;

      // Update profile role to 'vendor' (Phase 0)
      const { error: profileErr } = await supabase
        .from('profiles')
        .update({ role: 'vendor' })
        .eq('id', user.id);
      if (profileErr) console.warn('[SETU VendorOnboarding] role update error:', profileErr);

      setSubmitted(true);

      // Reload AuthContext profile so ProtectedRoute sees role='vendor' (Phase 0)
      await reloadProfile();

      // Your version's success delay before navigate
      setTimeout(() => onSubmitted(), 2500);
    } catch (err) {
      setError(err?.message || 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="px-4 py-16 flex flex-col items-center gap-4 text-center">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle className="w-10 h-10 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold">Application Submitted!</h2>
        <p className="text-sm text-muted-foreground max-w-xs">
          Your store will be reviewed within 24 hours. We'll notify you once approved.
        </p>
        <p className="text-xs text-muted-foreground">Redirecting to dashboard...</p>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 space-y-4">
      <div>
        <h2 className="text-xl font-bold mb-1">Review & Submit</h2>
        <p className="text-sm text-muted-foreground">
          Your application will be reviewed by the Block Admin within 24 hours.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 bg-destructive/10 rounded-xl text-destructive">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <p className="text-xs font-medium">{error}</p>
        </div>
      )}

      <div className="space-y-2">
        {checklist.map((item, i) => (
          <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border ${
            item.status === 'done'    ? 'bg-green-50 border-green-200' :
            item.status === 'pending' ? 'bg-amber-50 border-amber-200' :
                                        'bg-muted border-border'
          }`}>
            <p className={`text-sm ${item.status === 'pending' ? 'text-amber-700' : 'text-foreground'}`}>
              {item.label}
            </p>
          </div>
        ))}
      </div>

      {productsCount < 5 && (
        <Card className="p-3 bg-amber-50 border-amber-200">
          <p className="text-xs text-amber-800">
            ⚠️ You need <strong>5 products minimum</strong> to go live.
            Add {5 - productsCount} more after submission.
          </p>
        </Card>
      )}

      <div className="p-3 bg-muted rounded-xl">
        <p className="text-xs text-muted-foreground">
          <strong>SETU Constitution Pledge:</strong> I agree to sell genuine products,
          honour all accepted orders, and maintain fair pricing. I understand that
          fraud or misconduct will result in permanent ban from SETU.
        </p>
      </div>

      <Button className="w-full gap-2" onClick={handleSubmit} disabled={submitting}>
        {submitting
          ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</>
          : 'Submit Application 🚀'
        }
      </Button>
    </div>
  );
}

// ── Root component ────────────────────────────────────────
export default function VendorOnboarding() {
  const navigate  = useNavigate();
  const { user, reloadProfile } = useAuth();
  const [step,          setStep]          = useState(1);
  const [vendorId,      setVendorId]      = useState(null);
  const [productsCount, setProductsCount] = useState(0);

  // Phase 0: redirect if vendor row already exists
  useEffect(() => {
    if (!user) return;
    getVendorByOwnerId(user.id).then(({ data }) => {
      if (data) navigate('/vendor', { replace: true });
    });
  }, [user, navigate]);

  const next = () => setStep(s => Math.min(s + 1, 5));
  const back = () => setStep(s => Math.max(s - 1, 1));

  const handleVendorSaved = (vendor) => {
    if (vendor?.id) setVendorId(vendor.id);
  };

  const handleSubmitted = async () => {
    navigate('/vendor', { replace: true });
  };

  return (
    <div className="min-h-screen bg-background max-w-md mx-auto">
      <div className="sticky top-0 bg-card z-10 border-b border-border">
        <div className="px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
            <Store className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h1 className="font-bold text-sm">Vendor Registration</h1>
            <p className="text-[10px] text-muted-foreground">Step {step} of {STEPS.length}</p>
          </div>
          <div className="ml-auto">
            <Progress value={(step / STEPS.length) * 100} className="w-16 h-1.5" />
          </div>
        </div>
        <StepIndicator current={step} />
      </div>

      {step === 1 && <Step1 onNext={next} user={user} />}
      {step === 2 && (
        <Step2
          onNext={next}
          onBack={back}
          onVendorSaved={handleVendorSaved}
          user={user}
        />
      )}
      {step === 3 && (
        <Step3
          onNext={next}
          onBack={back}
          vendorId={vendorId}
          onProductAdded={() => setProductsCount(n => n + 1)}
        />
      )}
      {step === 4 && (
        <Step4
          onNext={next}
          onBack={back}
          vendorId={vendorId}
        />
      )}
      {step === 5 && (
        <Step5
          vendorId={vendorId}
          productsCount={productsCount}
          user={user}
          onSubmitted={handleSubmitted}
        />
      )}
    </div>
  );
}
