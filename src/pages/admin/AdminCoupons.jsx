// ═══════════════════════════════════════════════════════════
// SETU — Admin · Coupons
//
// Create, edit and (de)activate discount coupons. Real CRUD via
// upsert_coupon / set_coupon_active (coupons.create / coupons.manage,
// audited). Discounts are enforced server-side at checkout. No mocks.
// ═══════════════════════════════════════════════════════════
import React, { useState, useEffect, useCallback } from 'react';
import { Ticket, Plus, Loader2, AlertCircle, RefreshCw, Lock, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { CouponAPI } from '@/lib/api';
import { usePermissions } from '@/lib/permissions';

const BLANK = {
  id: null, code: '', description: '', discountType: 'percent', discountValue: '',
  maxDiscount: '', minOrder: '', appliesTo: 'all', vendorId: '',
  usageLimit: '', perUserLimit: '1', validTo: '', isActive: true,
};

export default function AdminCoupons() {
  const { can } = usePermissions();
  const allowed = can('coupons.create');

  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [form, setForm]       = useState(null);   // null = closed, object = open
  const [busy, setBusy]       = useState(false);
  const [formErr, setFormErr] = useState(null);
  const [toggling, setToggling] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: e } = await CouponAPI.list();
    if (e) { setError('Could not load coupons. Tap retry.'); setLoading(false); return; }
    setCoupons(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openEdit = (c) => setForm({
    id: c.id, code: c.code, description: c.description ?? '', discountType: c.discount_type,
    discountValue: String(c.discount_value), maxDiscount: c.max_discount != null ? String(c.max_discount) : '',
    minOrder: String(c.min_order ?? 0), appliesTo: c.applies_to, vendorId: c.vendor_id ?? '',
    usageLimit: c.usage_limit != null ? String(c.usage_limit) : '', perUserLimit: String(c.per_user_limit ?? 1),
    validTo: c.valid_to ? c.valid_to.slice(0, 16) : '', isActive: c.is_active,
  });

  const save = async () => {
    setFormErr(null);
    if (!form.code.trim() || !form.discountValue) { setFormErr('Code and value are required.'); return; }
    setBusy(true);
    const { data, error: e } = await CouponAPI.upsert({
      ...form,
      validTo: form.validTo ? new Date(form.validTo).toISOString() : null,
      vendorId: form.appliesTo === 'vendor' ? (form.vendorId || null) : null,
    });
    if (e || !data?.success) { setFormErr(e?.message ?? 'Save failed'); setBusy(false); return; }
    setForm(null);
    setBusy(false);
    await load();
  };

  const toggle = async (c) => {
    setToggling(c.id);
    await CouponAPI.setActive(c.id, !c.is_active);
    await load();
    setToggling(null);
  };

  if (!allowed) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 px-6 text-center" role="alert">
        <Lock className="w-8 h-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">You don’t have permission to manage coupons.</p>
      </div>
    );
  }

  return (
    <div className="pb-24 max-w-2xl mx-auto" role="main">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-2">
        <Ticket className="w-5 h-5 text-primary" />
        <h1 className="font-semibold flex-1">Coupons</h1>
        <Button size="sm" className="gap-1" onClick={() => { setForm({ ...BLANK }); setFormErr(null); }}>
          <Plus className="w-4 h-4" /> New
        </Button>
      </div>

      <div className="px-4 py-4 space-y-3">
        {form && (
          <Card className="p-4 border-primary/30 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">{form.id ? 'Edit coupon' : 'New coupon'}</p>
              <button onClick={() => setForm(null)} className="text-muted-foreground"><X className="w-4 h-4" /></button>
            </div>
            <Input placeholder="CODE (e.g. SETU50)" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} className="h-9" />
            <Input placeholder="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="h-9" />
            <div className="flex gap-2">
              <select value={form.discountType} onChange={e => setForm(f => ({ ...f, discountType: e.target.value }))}
                className="h-9 rounded-lg border border-input bg-background px-2 text-sm">
                <option value="percent">% off</option>
                <option value="flat">₹ flat</option>
              </select>
              <Input type="number" placeholder={form.discountType === 'percent' ? '% value' : '₹ value'} value={form.discountValue} onChange={e => setForm(f => ({ ...f, discountValue: e.target.value }))} className="h-9 flex-1" />
              {form.discountType === 'percent' && (
                <Input type="number" placeholder="Max ₹ cap" value={form.maxDiscount} onChange={e => setForm(f => ({ ...f, maxDiscount: e.target.value }))} className="h-9 w-28" />
              )}
            </div>
            <div className="flex gap-2">
              <Input type="number" placeholder="Min order ₹" value={form.minOrder} onChange={e => setForm(f => ({ ...f, minOrder: e.target.value }))} className="h-9 flex-1" />
              <Input type="number" placeholder="Total uses (blank=∞)" value={form.usageLimit} onChange={e => setForm(f => ({ ...f, usageLimit: e.target.value }))} className="h-9 flex-1" />
              <Input type="number" placeholder="Per user" value={form.perUserLimit} onChange={e => setForm(f => ({ ...f, perUserLimit: e.target.value }))} className="h-9 w-24" />
            </div>
            <div className="flex gap-2 items-center">
              <select value={form.appliesTo} onChange={e => setForm(f => ({ ...f, appliesTo: e.target.value }))}
                className="h-9 rounded-lg border border-input bg-background px-2 text-sm">
                <option value="all">All vendors</option>
                <option value="vendor">Specific vendor</option>
              </select>
              {form.appliesTo === 'vendor' && (
                <Input placeholder="Vendor ID (UUID)" value={form.vendorId} onChange={e => setForm(f => ({ ...f, vendorId: e.target.value }))} className="h-9 flex-1" />
              )}
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground">Valid until</label>
              <Input type="datetime-local" value={form.validTo} onChange={e => setForm(f => ({ ...f, validTo: e.target.value }))} className="h-9 flex-1" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Active</span>
              <Switch checked={form.isActive} onCheckedChange={v => setForm(f => ({ ...f, isActive: v }))} />
            </div>
            {formErr && <p className="text-xs text-destructive">{formErr}</p>}
            <Button className="w-full" disabled={busy} onClick={save}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : (form.id ? 'Save changes' : 'Create coupon')}
            </Button>
          </Card>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center" role="alert">
            <AlertCircle className="w-8 h-8 text-destructive" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" onClick={load} className="gap-2"><RefreshCw className="w-4 h-4" /> Retry</Button>
          </div>
        ) : coupons.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">No coupons yet. Create your first one.</p>
        ) : (
          coupons.map(c => (
            <Card key={c.id} className="p-3 border-border">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm">{c.code}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full border-0 ${c.is_active ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>
                      {c.is_active ? 'active' : 'inactive'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {c.discount_type === 'percent' ? `${c.discount_value}% off` : `₹${c.discount_value} off`}
                    {c.max_discount ? ` (max ₹${c.max_discount})` : ''} · min ₹{c.min_order}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Used {c.used_count}{c.usage_limit ? `/${c.usage_limit}` : ''} · per user {c.per_user_limit}
                    {c.valid_to ? ` · until ${new Date(c.valid_to).toLocaleDateString()}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {toggling === c.id ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    : <Switch checked={c.is_active} onCheckedChange={() => toggle(c)} aria-label={`Toggle ${c.code}`} />}
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { openEdit(c); setFormErr(null); }}>Edit</Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
