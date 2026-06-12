// ═══════════════════════════════════════════════════════════
// SETU — AdminVendorApproval (v2 — Live DB)
// Replaces hardcoded mock with real getPendingVendors() call.
// Approve/reject buttons write to vendors table via AdminAPI.
// Route: /admin/vendor-approval
// ═══════════════════════════════════════════════════════════
import React, { useState, useCallback } from 'react';
import {
  CheckCircle, XCircle, Eye, FileText, Clock,
  RefreshCw, Loader2, Store
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import AppHeader from '@/components/shared/AppHeader';
import { useDataFetch } from '@/hooks/useDataFetch';
import { AdminAPI } from '@/lib/api';

export default function AdminVendorApproval() {
  const [expanded,  setExpanded]  = useState(null);
  const [note,      setNote]      = useState('');
  const [acting,    setActing]    = useState(null);  // vendorId + 'approve'/'reject'
  const [dismissed, setDismissed] = useState(new Set()); // locally dismissed after action

  const { data, isLoading, error, refetch } = useDataFetch(
    () => AdminAPI.getPendingVendors(),
    [],
    { cacheKey: 'admin-pending-vendors', staleTime: 15_000 }
  );

  const vendors = (data ?? []).filter(v => !dismissed.has(v.id));

  const handleApprove = async (vendorId) => {
    setActing(vendorId + 'approve');
    const { error: err } = await AdminAPI.approveVendor(vendorId);
    if (!err) {
      setDismissed(prev => new Set([...prev, vendorId]));
      setExpanded(null);
    }
    setActing(null);
  };

  const handleReject = async (vendorId) => {
    setActing(vendorId + 'reject');
    const { error: err } = await AdminAPI.rejectVendor(vendorId, note);
    if (!err) {
      setDismissed(prev => new Set([...prev, vendorId]));
      setExpanded(null);
      setNote('');
    }
    setActing(null);
  };

  function fmtDate(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  return (
    <div className="flex-1 overflow-auto pb-10">
      <AppHeader
        title="Vendor Approvals"
        subtitle={isLoading ? 'Loading…' : `${vendors.length} pending`}
        rightAction={
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={refetch}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        }
      />

      <div className="p-4 space-y-3 max-w-2xl">

        {/* Error */}
        {error && (
          <Card className="p-4 border-destructive/30 bg-destructive/5">
            <p className="text-sm text-destructive">Failed to load pending vendors: {error.message}</p>
            <Button size="sm" variant="outline" className="mt-2" onClick={refetch}>Retry</Button>
          </Card>
        )}

        {/* Loading skeletons */}
        {isLoading && (
          <div className="space-y-2">
            {[1,2,3].map(i => <div key={i} className="h-28 bg-muted rounded-xl animate-pulse" />)}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && vendors.length === 0 && (
          <Card className="p-8 border-border text-center">
            <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-3" />
            <p className="text-sm font-medium">All caught up!</p>
            <p className="text-xs text-muted-foreground">No pending vendor approvals right now.</p>
          </Card>
        )}

        {/* Vendor cards */}
        {vendors.map(v => {
          const kycDocs = v.kyc_records ?? [];
          const isExpanded = expanded === v.id;

          return (
            <Card key={v.id} className="border-border overflow-hidden">
              <div className="p-4">
                {/* Header row */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-start gap-3">
                    {v.image_url ? (
                      <img src={v.image_url} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <Store className="w-5 h-5 text-muted-foreground" />
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-bold">{v.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {v.category} · {v.village ?? '—'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {v.phone ?? 'No phone'} · Applied {fmtDate(v.created_at)}
                      </p>
                    </div>
                  </div>
                  <Badge className="text-[9px] bg-amber-100 text-amber-700 border-0 flex items-center gap-1 shrink-0">
                    <Clock className="w-3 h-3" /> Pending
                  </Badge>
                </div>

                {/* KYC doc badges */}
                {kycDocs.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {kycDocs.map((doc, i) => (
                      <Badge key={i} variant="outline" className="text-[9px] flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        {doc.type}
                        {doc.aadhaar_last4 && ` ••••${doc.aadhaar_last4}`}
                        {' '}
                        <span className={`ml-0.5 ${
                          doc.status === 'verified' ? 'text-green-600' :
                          doc.status === 'submitted' ? 'text-blue-600' : 'text-amber-600'
                        }`}>({doc.status})</span>
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 h-8 text-xs gap-1"
                    disabled={!!acting}
                    onClick={() => handleApprove(v.id)}
                  >
                    {acting === v.id + 'approve'
                      ? <Loader2 className="w-3 h-3 animate-spin" />
                      : <CheckCircle className="w-3 h-3" />}
                    {acting === v.id + 'approve' ? 'Approving…' : 'Approve'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 h-8 text-xs gap-1 text-destructive border-destructive/30"
                    disabled={!!acting}
                    onClick={() => isExpanded ? handleReject(v.id) : setExpanded(v.id)}
                  >
                    {acting === v.id + 'reject'
                      ? <Loader2 className="w-3 h-3 animate-spin" />
                      : <XCircle className="w-3 h-3" />}
                    {acting === v.id + 'reject' ? 'Rejecting…' : 'Reject'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0"
                    onClick={() => setExpanded(isExpanded ? null : v.id)}
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </Button>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-border space-y-2">
                    <p className="text-xs font-medium">Rejection reason (optional)</p>
                    <Textarea
                      placeholder="e.g. Documents unclear, re-submit Aadhaar photo…"
                      className="h-16 text-xs"
                      value={note}
                      onChange={e => setNote(e.target.value)}
                    />
                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mt-1">
                      <div>Category: <span className="font-medium text-foreground">{v.category}</span></div>
                      <div>Village: <span className="font-medium text-foreground">{v.village ?? '—'}</span></div>
                      <div>Tier: <span className="font-medium text-foreground">{v.subscription_tier}</span></div>
                      <div>KYC docs: <span className="font-medium text-foreground">{kycDocs.length}</span></div>
                    </div>
                    {v.image_url && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Shop photo</p>
                        <img src={v.image_url} alt="shop" className="w-full max-h-40 object-cover rounded-lg" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
