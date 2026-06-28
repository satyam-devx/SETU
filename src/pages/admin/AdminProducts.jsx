// ═══════════════════════════════════════════════════════════
// SETU — AdminProducts
// Cross-vendor product management:
//   - Search by name, filter by vendor/category
//   - Inline edit price, MRP, stock, availability
//   - Bulk select + bulk delete / toggle availability
//   - Remove individual products
// Route: /admin/products
// ═══════════════════════════════════════════════════════════
import React, { useState, useCallback, useMemo } from 'react';
import {
  Search, Trash2, Check, X, RefreshCw,
  Loader2, PackageX, Package, Plus,
  CheckSquare, Square, Layers,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import AppHeader from '@/components/shared/AppHeader';
import { useDataFetch } from '@/hooks/useDataFetch';
import { AdminAPI } from '@/lib/api';

// ── Create Product Dialog ─────────────────────────────────
const EMPTY_PRODUCT = {
  vendor_id: '', category_id: 'none', name: '', name_hindi: '',
  description: '', price: '', mrp: '', unit: 'piece',
  stock: '0', image_url: '', is_available: true,
};

function CreateProductDialog({ open, onClose, vendors, categories, onCreated }) {
  const [form,   setForm]   = useState(EMPTY_PRODUCT);
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState(null);

  const setF = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErr(null); };

  const handleCreate = async () => {
    if (!form.vendor_id) { setErr('Vendor is required'); return; }
    if (!form.name.trim()) { setErr('Product name is required'); return; }
    if (!form.price || isNaN(Number(form.price)) || Number(form.price) <= 0) {
      setErr('Valid price is required'); return;
    }
    setSaving(true);
    const payload = {
      vendor_id:   form.vendor_id,
      category_id: form.category_id && form.category_id !== 'none' ? form.category_id : null,
      name:        form.name.trim(),
      name_hindi:  form.name_hindi?.trim() || null,
      description: form.description?.trim() || null,
      price:       Number(form.price),
      mrp:         form.mrp ? Number(form.mrp) : Number(form.price),
      unit:        form.unit,
      stock:       Number(form.stock ?? 0),
      image_url:   form.image_url?.trim() || null,
      is_available:form.is_available,
    };
    const { error } = await AdminAPI.createProduct(payload);
    if (error) { setErr(error.message ?? 'Failed to create product'); setSaving(false); return; }
    setSaving(false);
    setForm(EMPTY_PRODUCT);
    onCreated();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Product</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-1">
          {err && (
            <p className="text-xs text-destructive p-2 bg-destructive/10 rounded-lg">{err}</p>
          )}

          <div>
            <Label className="text-xs mb-1 block">Vendor *</Label>
            <Select value={form.vendor_id} onValueChange={v => setF('vendor_id', v)}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select vendor…" /></SelectTrigger>
              <SelectContent>
                {(vendors ?? []).map(v => (
                  <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs mb-1 block">Category</Label>
            <Select value={form.category_id} onValueChange={v => setF('category_id', v)}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select category…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No category</SelectItem>
                {(categories ?? []).map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs mb-1 block">Name (English) *</Label>
              <Input value={form.name} onChange={e => setF('name', e.target.value)} className="h-9 text-sm" placeholder="e.g. Rice 1kg" />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Name (Hindi)</Label>
              <Input value={form.name_hindi} onChange={e => setF('name_hindi', e.target.value)} className="h-9 text-sm" placeholder="चावल" />
            </div>
          </div>

          <div>
            <Label className="text-xs mb-1 block">Description</Label>
            <Textarea value={form.description} onChange={e => setF('description', e.target.value)} className="h-16 text-sm resize-none" placeholder="Optional description…" />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs mb-1 block">Price (₹) *</Label>
              <Input type="number" min="0" value={form.price} onChange={e => setF('price', e.target.value)} className="h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs mb-1 block">MRP (₹)</Label>
              <Input type="number" min="0" value={form.mrp} onChange={e => setF('mrp', e.target.value)} className="h-9 text-sm" placeholder="=Price" />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Stock</Label>
              <Input type="number" min="0" value={form.stock} onChange={e => setF('stock', e.target.value)} className="h-9 text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs mb-1 block">Unit</Label>
              <Select value={form.unit} onValueChange={v => setF('unit', v)}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['piece','kg','gram','litre','ml','dozen','pack','bundle','box'].map(u => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1 block">Image URL</Label>
              <Input value={form.image_url} onChange={e => setF('image_url', e.target.value)} className="h-9 text-sm" placeholder="https://…" />
            </div>
          </div>

          <div className="flex items-center justify-between p-2.5 bg-muted/40 rounded-lg">
            <div>
              <p className="text-sm font-medium">Available</p>
              <p className="text-xs text-muted-foreground">Visible to customers immediately</p>
            </div>
            <Switch checked={form.is_available} onCheckedChange={v => setF('is_available', v)} />
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button className="flex-1 gap-2" disabled={saving} onClick={handleCreate}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Create Product
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Inline-edit cell ─────────────────────────────────────
function EditableCell({ value, type = 'number', onSave, prefix = '' }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal]         = useState(String(value));
  const [saving, setSaving]   = useState(false);

  const commit = async () => {
    if (val === String(value)) { setEditing(false); return; }
    setSaving(true);
    await onSave(type === 'number' ? Number(val) : val);
    setSaving(false);
    setEditing(false);
  };

  if (editing) return (
    <div className="flex items-center gap-1">
      <Input
        autoFocus
        type={type}
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
        className="h-6 w-20 text-xs px-1"
      />
      <button onClick={commit} disabled={saving} className="text-green-600 hover:text-green-700">
        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
      </button>
      <button onClick={() => setEditing(false)} className="text-muted-foreground hover:text-foreground">
        <X className="w-3 h-3" />
      </button>
    </div>
  );

  return (
    <button
      onClick={() => { setVal(String(value)); setEditing(true); }}
      className="text-xs font-medium hover:underline underline-offset-2 text-left"
    >
      {prefix}{value}
    </button>
  );
}

export default function AdminProducts() {
  const [search,      setSearch]      = useState('');
  const [vendorFil,   setVendorFil]   = useState('all');
  const [catFil,      setCatFil]      = useState('all');
  const [selected,    setSelected]    = useState(new Set());
  const [deleting,    setDeleting]    = useState(new Set());
  const [toggling,    setToggling]    = useState(null);
  const [bulkAct,     setBulkAct]     = useState(false);
  const [createOpen,  setCreateOpen]  = useState(false);

  const { data: products, isLoading, error, refetch } = useDataFetch(
    () => AdminAPI.getProducts({ limit: 200 }),
    [],
    { cacheKey: 'admin-products', staleTime: 20_000 }
  );

  const { data: vendors } = useDataFetch(
    () => AdminAPI.getVendors(),
    [],
    { cacheKey: 'admin-vendors-list' }
  );

  const { data: categories } = useDataFetch(
    () => AdminAPI.getCategories(),
    [],
    { cacheKey: 'admin-categories-list' }
  );

  const { data: allCats } = useDataFetch(
    () => AdminAPI.getAllCategories(),
    [],
    { cacheKey: 'admin-categories' }
  );

  const rows = products ?? [];

  // ── Filtered rows ─────────────────────────────────────
  const filtered = useMemo(() => {
    return rows.filter(p => {
      const matchSearch = !search
        || p.name.toLowerCase().includes(search.toLowerCase())
        || (p.vendor_name ?? '').toLowerCase().includes(search.toLowerCase());
      const matchVendor = vendorFil === 'all' || p.vendor_id === vendorFil;
      const matchCat    = catFil    === 'all' || p.category_id === catFil;
      return matchSearch && matchVendor && matchCat;
    });
  }, [rows, search, vendorFil, catFil]);

  // ── Selection ─────────────────────────────────────────
  const allSelected = filtered.length > 0 && filtered.every(p => selected.has(p.id));
  const toggleAll   = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(filtered.map(p => p.id)));
  };
  const toggleOne = (id) => setSelected(prev => {
    const s = new Set(prev);
    s.has(id) ? s.delete(id) : s.add(id);
    return s;
  });

  // ── Inline update ─────────────────────────────────────
  const update = async (id, updates) => {
    await AdminAPI.updateProduct(id, updates);
    refetch();
  };

  // ── Delete single ─────────────────────────────────────
  const deleteSingle = async (id) => {
    if (!window.confirm('Delete this product? This cannot be undone.')) return;
    setDeleting(prev => new Set([...prev, id]));
    await AdminAPI.deleteProduct(id);
    setSelected(prev => { const s = new Set(prev); s.delete(id); return s; });
    setDeleting(prev => { const s = new Set(prev); s.delete(id); return s; });
    refetch();
  };

  // ── Bulk delete ───────────────────────────────────────
  const bulkDelete = async () => {
    if (!window.confirm(`Delete ${selected.size} product(s)? This cannot be undone.`)) return;
    setBulkAct(true);
    await Promise.all([...selected].map(id => AdminAPI.deleteProduct(id)));
    setSelected(new Set());
    setBulkAct(false);
    refetch();
  };

  // ── Bulk toggle availability ──────────────────────────
  const bulkToggle = async (available) => {
    setBulkAct(true);
    await Promise.all([...selected].map(id => AdminAPI.updateProduct(id, { is_available: available })));
    setSelected(new Set());
    setBulkAct(false);
    refetch();
  };

  return (
    <div className="flex-1 overflow-auto pb-10">
      <AppHeader
        title="Products"
        subtitle={`${rows.length} total · ${rows.filter(p => p.is_available).length} available`}
        rightAction={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => setCreateOpen(true)}>
              <Plus className="w-3.5 h-3.5" /> Add
            </Button>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={refetch}>
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        }
      />

      <div className="p-5 space-y-4 max-w-6xl">

        {/* ── Filters ──────────────────────────────────── */}
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search products or vendors…"
              className="pl-9 h-9"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <Select value={vendorFil} onValueChange={setVendorFil}>
            <SelectTrigger className="w-44 h-9 text-xs">
              <SelectValue placeholder="All vendors" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Vendors</SelectItem>
              {(vendors ?? []).map(v => (
                <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={catFil} onValueChange={setCatFil}>
            <SelectTrigger className="w-44 h-9 text-xs">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {(allCats ?? []).map(c => (
                <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* ── Bulk action bar ───────────────────────────── */}
        {selected.size > 0 && (
          <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-xl">
            <Layers className="w-4 h-4 text-primary shrink-0" />
            <span className="text-sm font-medium flex-1">{selected.size} product{selected.size > 1 ? 's' : ''} selected</span>
            <Button size="sm" variant="outline" className="h-7 text-xs" disabled={bulkAct}
              onClick={() => bulkToggle(true)}>Enable</Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" disabled={bulkAct}
              onClick={() => bulkToggle(false)}>Disable</Button>
            <Button size="sm" variant="outline" className="h-7 text-xs text-destructive border-destructive/30"
              disabled={bulkAct} onClick={bulkDelete}>
              {bulkAct ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Trash2 className="w-3 h-3 mr-1" />Delete</>}
            </Button>
            <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setSelected(new Set())}>
              Clear
            </button>
          </div>
        )}

        {/* ── Table ─────────────────────────────────────── */}
        {error && (
          <Card className="p-3 border-destructive/20 bg-destructive/5">
            <p className="text-xs text-destructive">{error.message ?? 'Failed to load products.'}</p>
            <Button size="sm" variant="outline" className="mt-2" onClick={refetch}>Retry</Button>
          </Card>
        )}
        {isLoading ? (
          <div className="space-y-2">
            {[1,2,3,4,5,6].map(i => <div key={i} className="h-12 bg-muted rounded-xl animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="p-8 border-dashed text-center">
            <PackageX className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No products match your filters</p>
          </Card>
        ) : (
          <Card className="border-border overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-2 bg-muted/40 border-b border-border text-xs font-medium text-muted-foreground">
              <button onClick={toggleAll} className="shrink-0">
                {allSelected
                  ? <CheckSquare className="w-4 h-4 text-primary" />
                  : <Square className="w-4 h-4" />}
              </button>
              <span className="w-8 shrink-0"></span>
              <span className="flex-1">Product · Vendor</span>
              <span className="w-20 text-right">Price</span>
              <span className="w-16 text-right">MRP</span>
              <span className="w-16 text-right">Stock</span>
              <span className="w-16 text-center">Avail</span>
              <span className="w-16 text-center">Actions</span>
            </div>

            {/* Rows */}
            <div className="divide-y divide-border">
              {filtered.map(p => (
                <div
                  key={p.id}
                  className={`flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors ${
                    selected.has(p.id) ? 'bg-primary/5' : ''
                  } ${!p.is_available ? 'opacity-60' : ''}`}
                >
                  {/* Checkbox */}
                  <button onClick={() => toggleOne(p.id)} className="shrink-0">
                    {selected.has(p.id)
                      ? <CheckSquare className="w-4 h-4 text-primary" />
                      : <Square className="w-4 h-4 text-muted-foreground" />}
                  </button>

                  {/* Image */}
                  <div className="w-8 h-8 rounded-lg bg-muted shrink-0 overflow-hidden">
                    {p.image_url
                      ? <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                      : <Package className="w-4 h-4 text-muted-foreground m-auto mt-2" />}
                  </div>

                  {/* Name + vendor */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {p.vendor_name ?? '—'} · {p.category_name ?? p.category ?? '—'}
                    </p>
                  </div>

                  {/* Price (inline edit) */}
                  <div className="w-20 text-right">
                    <EditableCell
                      value={p.price}
                      prefix="₹"
                      onSave={v => update(p.id, { price: v })}
                    />
                  </div>

                  {/* MRP */}
                  <div className="w-16 text-right">
                    <EditableCell
                      value={p.mrp ?? p.price}
                      prefix="₹"
                      onSave={v => update(p.id, { mrp: v })}
                    />
                  </div>

                  {/* Stock */}
                  <div className="w-16 text-right">
                    <EditableCell
                      value={p.stock ?? 0}
                      onSave={v => update(p.id, { stock: v })}
                    />
                  </div>

                  {/* Available toggle */}
                  <div className="w-16 flex justify-center">
                    <Switch
                      checked={p.is_available}
                      disabled={toggling === p.id}
                      onCheckedChange={v => {
                        setToggling(p.id);
                        update(p.id, { is_available: v }).then(() => setToggling(null));
                      }}
                    />
                  </div>

                  {/* Delete */}
                  <div className="w-16 flex justify-center">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:bg-destructive/10"
                      disabled={deleting.has(p.id)}
                      onClick={() => deleteSingle(p.id)}
                    >
                      {deleting.has(p.id)
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Trash2 className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="px-4 py-2 bg-muted/20 border-t border-border text-xs text-muted-foreground">
              Showing {filtered.length} of {rows.length} products
              {selected.size > 0 && ` · ${selected.size} selected`}
            </div>
          </Card>
        )}
      </div>

      {createOpen && (
        <CreateProductDialog
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          vendors={vendors ?? []}
          categories={categories ?? []}
          onCreated={refetch}
        />
      )}
    </div>
  );
}
