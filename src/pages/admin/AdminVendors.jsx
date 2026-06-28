// ═══════════════════════════════════════════════════════════
// SETU — AdminVendors  (v3 — production-grade)
// Full vendor management:
//   - List with search, tabs (active/offline/unverified/suspended)
//   - Inline open/close toggle
//   - Vendor detail drawer: stats, products, KYC, actions
//   - Approve / Reject / Suspend / Unsuspend
//   - Per-vendor analytics (order count, revenue)
// Route: /admin/vendors
// ═══════════════════════════════════════════════════════════
import React, { useState, useCallback } from 'react';
import {
  Search, Star, MapPin, CheckCircle, Phone, RefreshCw,
  Loader2, ChevronRight, Store, ShieldOff, ShieldCheck,
  Package,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import AppHeader from '@/components/shared/AppHeader';
import StatCard from '@/components/shared/StatCard';
import { useDataFetch } from '@/hooks/useDataFetch';
import { AdminAPI } from '@/lib/api';

const KYC_STYLE = {
  approved: 'bg-green-100 text-green-700',
  pending:  'bg-amber-100 text-amber-700',
  submitted:'bg-blue-100  text-blue-700',
  rejected: 'bg-red-100   text-red-700',
};

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });
}

function fmtCurrency(n) {
  return `₹${Number(n ?? 0).toLocaleString('en-IN')}`;
}

// ── Vendor Detail Modal ───────────────────────────────────
function VendorDetailModal({ vendor, onClose, onRefetch }) {
  const [acting,       setActing]       = useState(null);
  const [suspendModal, setSuspendModal] = useState(false);
  const [suspendReason,setSuspendReason]= useState('');
  const [rejectModal,  setRejectModal]  = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const { data: detail, isLoading: detailLoading } = useDataFetch(
    () => AdminAPI.getVendorDetail(vendor.id),
    [vendor.id],
    { cacheKey: `vendor-detail-${vendor.id}`, staleTime: 30_000 }
  );

  const { data: analytics, isLoading: analyticsLoading } = useDataFetch(
    () => AdminAPI.getVendorAnalytics(vendor.id),
    [vendor.id],
    { cacheKey: `vendor-analytics-${vendor.id}`, staleTime: 60_000 }
  );

  const vd = detail ?? vendor;
  const totalRevenue = (analytics?.orders ?? [])
    .filter(o => o.status === 'delivered')
    .reduce((s, o) => s + Number(o.total ?? 0), 0);
  const totalOrders   = (analytics?.orders ?? []).length;
  const activeProducts = (analytics?.products ?? []).filter(p => p.is_available).length;

  const handleApprove = async () => {
    setActing('approve');
    const { error } = await AdminAPI.approveVendor(vendor.id);
    if (!error) { onRefetch(); onClose(); }
    setActing(null);
  };

  const handleReject = async () => {
    setActing('reject');
    const { error } = await AdminAPI.rejectVendor(vendor.id, rejectReason);
    if (!error) { onRefetch(); setRejectModal(false); onClose(); }
    setActing(null);
  };

  const handleSuspend = async () => {
    setActing('suspend');
    const { error } = await AdminAPI.suspendVendor(vendor.id, suspendReason);
    if (!error) { onRefetch(); setSuspendModal(false); onClose(); }
    setActing(null);
  };

  const handleUnsuspend = async () => {
    setActing('unsuspend');
    const { error } = await AdminAPI.unsuspendVendor(vendor.id);
    if (!error) { onRefetch(); onClose(); }
    setActing(null);
  };

  const isSuspended = vd.is_active === false;
  const isPending   = !vd.is_verified && vd.kyc_status !== 'rejected';

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Store className="w-4 h-4" /> {vd.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status badges */}
          <div className="flex flex-wrap gap-2">
            {vd.is_verified   && <Badge className="bg-green-100 text-green-700 border-0 text-xs">Verified</Badge>}
            {isSuspended      && <Badge className="bg-red-100 text-red-700 border-0 text-xs">Suspended</Badge>}
            {isPending        && <Badge className="bg-amber-100 text-amber-700 border-0 text-xs">Pending Approval</Badge>}
            <Badge variant="outline" className="text-xs capitalize">{vd.kyc_status}</Badge>
            <Badge variant="outline" className="text-xs">{vd.subscription_tier}</Badge>
          </div>

          {/* Info */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            {[
              { label: 'Category', value: vd.category },
              { label: 'Village',  value: vd.village ?? '—' },
              { label: 'Phone',    value: vd.phone ?? '—' },
              { label: 'Joined',   value: fmtDate(vd.created_at) },
              { label: 'Rating',   value: vd.rating ? `${vd.rating} ★ (${vd.review_count} reviews)` : '—' },
              { label: 'Trust Score', value: vd.trust_score ?? '—' },
            ].map(f => (
              <div key={f.label} className="p-2.5 bg-muted/40 rounded-lg">
                <p className="text-muted-foreground">{f.label}</p>
                <p className="font-medium">{f.value}</p>
              </div>
            ))}
          </div>

          {/* Analytics */}
          {analyticsLoading ? (
            <div className="h-16 bg-muted rounded animate-pulse" />
          ) : (
            <div className="grid grid-cols-3 gap-2 text-xs text-center">
              <div className="p-2.5 bg-primary/5 rounded-xl">
                <p className="text-base font-bold">{totalOrders}</p>
                <p className="text-muted-foreground">Orders</p>
              </div>
              <div className="p-2.5 bg-primary/5 rounded-xl">
                <p className="text-base font-bold">{fmtCurrency(totalRevenue)}</p>
                <p className="text-muted-foreground">Revenue</p>
              </div>
              <div className="p-2.5 bg-primary/5 rounded-xl">
                <p className="text-base font-bold">{activeProducts}</p>
                <p className="text-muted-foreground">Active Products</p>
              </div>
            </div>
          )}

          {/* KYC records */}
          {detailLoading ? (
            <div className="h-12 bg-muted rounded animate-pulse" />
          ) : (detail?.kyc_records ?? []).length > 0 ? (
            <div>
              <p className="text-xs font-semibold mb-2">KYC Documents</p>
              <div className="space-y-1.5">
                {detail.kyc_records.map(k => (
                  <div key={k.id} className="flex items-center justify-between p-2 bg-muted/40 rounded-lg text-xs">
                    <span className="capitalize">{k.type.replace(/_/g, ' ')}</span>
                    <div className="flex items-center gap-2">
                      {k.aadhaar_last4 && <span className="text-muted-foreground">••••{k.aadhaar_last4}</span>}
                      <Badge className={`text-[9px] border-0 ${KYC_STYLE[k.status] ?? ''}`}>{k.status}</Badge>
                      {k.doc_url && (
                        <a href={k.doc_url} target="_blank" rel="noreferrer" className="text-primary underline">View</a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Products count */}
          {(analytics?.products ?? []).length > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground p-2.5 bg-muted/40 rounded-lg">
              <Package className="w-3.5 h-3.5 shrink-0" />
              <span>
                {(analytics.products ?? []).length} products ·{' '}
                {(analytics.products ?? []).filter(p => p.stock === 0).length} out of stock
              </span>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
            {vd.phone && (
              <a href={`tel:${vd.phone}`}>
                <Button size="sm" variant="outline" className="gap-1 h-8 text-xs">
                  <Phone className="w-3 h-3" /> Call
                </Button>
              </a>
            )}

            {isPending && (
              <>
                <Button
                  size="sm"
                  className="gap-1 h-8 text-xs bg-green-600 hover:bg-green-700"
                  disabled={!!acting}
                  onClick={handleApprove}
                >
                  {acting === 'approve'
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <CheckCircle className="w-3 h-3" />}
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1 h-8 text-xs text-destructive border-destructive/30"
                  disabled={!!acting}
                  onClick={() => setRejectModal(true)}
                >
                  Reject
                </Button>
              </>
            )}

            {vd.is_verified && !isSuspended && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1 h-8 text-xs text-amber-600 border-amber-300 hover:bg-amber-50"
                disabled={!!acting}
                onClick={() => setSuspendModal(true)}
              >
                <ShieldOff className="w-3 h-3" /> Suspend
              </Button>
            )}

            {isSuspended && (
              <Button
                size="sm"
                className="gap-1 h-8 text-xs bg-green-600 hover:bg-green-700"
                disabled={!!acting}
                onClick={handleUnsuspend}
              >
                {acting === 'unsuspend'
                  ? <Loader2 className="w-3 h-3 animate-spin" />
                  : <ShieldCheck className="w-3 h-3" />}
                Reinstate
              </Button>
            )}
          </div>
        </div>

        {/* Suspend modal */}
        {suspendModal && (
          <div className="mt-4 p-4 border border-amber-200 bg-amber-50 rounded-xl space-y-3">
            <p className="text-sm font-medium text-amber-900">Suspend Vendor</p>
            <p className="text-xs text-amber-700">
              Vendor will be hidden from customers and unable to receive orders.
            </p>
            <Textarea
              placeholder="Reason for suspension (optional)"
              className="h-16 text-sm"
              value={suspendReason}
              onChange={e => setSuspendReason(e.target.value)}
            />
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setSuspendModal(false)}>Cancel</Button>
              <Button
                size="sm"
                variant="destructive"
                className="flex-1 gap-1"
                disabled={acting === 'suspend'}
                onClick={handleSuspend}
              >
                {acting === 'suspend' ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                Confirm Suspend
              </Button>
            </div>
          </div>
        )}

        {/* Reject modal */}
        {rejectModal && (
          <div className="mt-4 p-4 border border-red-200 bg-red-50 rounded-xl space-y-3">
            <p className="text-sm font-medium text-red-900">Reject Vendor Application</p>
            <Textarea
              placeholder="Reason for rejection (optional)"
              className="h-16 text-sm"
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
            />
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setRejectModal(false)}>Cancel</Button>
              <Button
                size="sm"
                variant="destructive"
                className="flex-1 gap-1"
                disabled={acting === 'reject'}
                onClick={handleReject}
              >
                {acting === 'reject' ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                Confirm Reject
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Main component ────────────────────────────────────────
export default function AdminVendors() {
  const [tab,       setTab]       = useState('all');
  const [query,     setQuery]     = useState('');
  const [toggling,  setToggling]  = useState(null);
  const [selected,  setSelected]  = useState(null);

  const { data, isLoading, error, refetch } = useDataFetch(
    () => AdminAPI.getVendors(),
    [],
    { cacheKey: 'admin-vendors-v3', staleTime: 20_000 }
  );

  const vendors = data ?? [];

  const openCount       = vendors.filter(v => v.is_open).length;
  const verifiedCount   = vendors.filter(v => v.is_verified).length;
  const pendingCount    = vendors.filter(v => !v.is_verified && v.kyc_status !== 'rejected').length;
  const suspendedCount  = vendors.filter(v => v.is_active === false).length;

  const filtered = vendors.filter(v => {
    const matchQ = !query
      || (v.name    ?? '').toLowerCase().includes(query.toLowerCase())
      || (v.village ?? '').toLowerCase().includes(query.toLowerCase())
      || (v.category ?? '').toLowerCase().includes(query.toLowerCase());
    if (tab === 'active')    return matchQ && v.is_verified && v.is_active !== false && v.is_open;
    if (tab === 'offline')   return matchQ && v.is_verified && v.is_active !== false && !v.is_open;
    if (tab === 'pending')   return matchQ && !v.is_verified && v.kyc_status !== 'rejected';
    if (tab === 'suspended') return matchQ && v.is_active === false;
    return matchQ;
  });

  const handleToggleOpen = async (vendorId, current) => {
    setToggling(vendorId);
    const { error } = await AdminAPI.setVendorOpen(vendorId, !current);
    if (!error) refetch();
    setToggling(null);
  };

  return (
    <div className="flex-1 overflow-auto">
      <AppHeader
        title="Vendors"
        subtitle={`${verifiedCount} verified · ${openCount} open`}
        rightAction={
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={refetch}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        }
      />
      <div className="p-4 space-y-4 max-w-3xl">

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 text-center">
          {[
            { label: 'Open',      value: openCount,      color: 'text-green-600' },
            { label: 'Verified',  value: verifiedCount,  color: '' },
            { label: 'Pending',   value: pendingCount,   color: 'text-amber-600' },
            { label: 'Suspended', value: suspendedCount, color: 'text-red-600' },
          ].map(s => (
            <Card key={s.label} className="p-2 border-border">
              <p className={`text-xl font-bold ${s.color}`}>{isLoading ? '…' : s.value}</p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
            </Card>
          ))}
        </div>

        {/* Error */}
        {error && (
          <Card className="p-3 border-destructive/20 bg-destructive/5 flex items-center justify-between">
            <p className="text-xs text-destructive">Failed to load vendors</p>
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={refetch}>
              <RefreshCw className="w-3 h-3" /> Retry
            </Button>
          </Card>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, village, category…"
            className="pl-9"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full grid grid-cols-5">
            <TabsTrigger value="all"       className="text-xs">All</TabsTrigger>
            <TabsTrigger value="active"    className="text-xs">Open</TabsTrigger>
            <TabsTrigger value="offline"   className="text-xs">Closed</TabsTrigger>
            <TabsTrigger value="pending"   className="text-xs">Pending</TabsTrigger>
            <TabsTrigger value="suspended" className="text-xs">Suspended</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Loading */}
        {isLoading && (
          <div className="space-y-2 animate-pulse">
            {[1,2,3].map(i => <div key={i} className="h-28 bg-muted rounded-xl" />)}
          </div>
        )}

        {/* Empty */}
        {!isLoading && filtered.length === 0 && (
          <Card className="p-6 border-border text-center">
            <Store className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No vendors in this filter</p>
          </Card>
        )}

        {/* List */}
        <div className="space-y-2">
          {filtered.map(v => {
            const isSuspended = v.is_active === false;
            const isPending   = !v.is_verified && v.kyc_status !== 'rejected';
            return (
              <Card
                key={v.id}
                className={`p-4 border-border cursor-pointer hover:bg-muted/30 transition-colors ${isSuspended ? 'opacity-60' : ''}`}
                onClick={() => setSelected(v)}
              >
                <div className="flex items-start gap-3">
                  {v.image_url ? (
                    <div className="w-12 h-12 rounded-xl bg-muted overflow-hidden shrink-0">
                      <img src={v.image_url} alt={v.name} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-lg font-bold text-primary">{(v.name ?? 'V')[0]}</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-semibold truncate">{v.name}</p>
                      {v.is_verified && <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />}
                      {isSuspended   && <Badge className="text-[9px] border-0 bg-red-100 text-red-700">Suspended</Badge>}
                      {isPending     && <Badge className="text-[9px] border-0 bg-amber-100 text-amber-700">Pending</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">{v.category}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      {v.village && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />{v.village}
                        </span>
                      )}
                      {v.rating > 0 && (
                        <span className="flex items-center gap-1">
                          <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                          {v.rating?.toFixed(1)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {toggling === v.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Switch
                        checked={v.is_open}
                        disabled={isSuspended}
                        onCheckedChange={() => handleToggleOpen(v.id, v.is_open)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Toggle ${v.name ?? 'vendor'} open status`}
                      />
                    )}
                    <button
                      type="button"
                      aria-label={`View ${v.name ?? 'vendor'} details`}
                      onClick={(e) => { e.stopPropagation(); setSelected(v); }}
                      className="text-muted-foreground hover:text-foreground rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {selected && (
        <VendorDetailModal
          vendor={selected}
          onClose={() => setSelected(null)}
          onRefetch={refetch}
        />
      )}
    </div>
  );
}
