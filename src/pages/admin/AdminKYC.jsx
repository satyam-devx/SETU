// ═══════════════════════════════════════════════════════════
// SETU — AdminKYC
// KYC review queue: view submitted documents, Aadhaar last-4,
// approve or reject each KYC record individually.
// Route: /admin/kyc
// ═══════════════════════════════════════════════════════════
import React, { useState } from 'react';
import {
  CheckCircle, XCircle, Eye, FileText, RefreshCw,
  Loader2, User, Phone, MapPin, ShieldCheck, Clock, Search
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import AppHeader from '@/components/shared/AppHeader';
import { useDataFetch } from '@/hooks/useDataFetch';
import { AdminAPI } from '@/lib/api';

const DOC_LABELS = {
  aadhaar:         'Aadhaar Card',
  pan:             'PAN Card',
  driving_license: 'Driving Licence',
  vehicle_rc:      'Vehicle RC',
  gstin:           'GST Certificate',
  shop_photo:      'Shop Photo',
  selfie:          'Selfie',
};

const STATUS_STYLE = {
  pending:   'bg-muted text-muted-foreground',
  submitted: 'bg-amber-100 text-amber-700',
  verified:  'bg-green-100 text-green-700',
  rejected:  'bg-red-100 text-red-700',
};

function relTime(iso) {
  if (!iso) return '';
  const diff = Math.floor((Date.now() - new Date(iso)) / 60000);
  if (diff < 60)   return `${diff}m ago`;
  if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
  return `${Math.floor(diff / 1440)}d ago`;
}

export default function AdminKYC() {
  const [tab,       setTab]       = useState('submitted');
  const [query,     setQuery]     = useState('');
  const [docView,   setDocView]   = useState(null);   // kyc record for doc viewer
  const [acting,    setActing]    = useState(null);
  const [rejectFor, setRejectFor] = useState(null);
  const [reason,    setReason]    = useState('');
  const [dismissed, setDismissed] = useState(new Set());

  const { data, isLoading, error, refetch } = useDataFetch(
    () => AdminAPI.getKYCQueue({ status: tab }),
    [tab],
    { cacheKey: `kyc-queue-${tab}`, staleTime: 15_000 }
  );

  const records = (data ?? []).filter(r => !dismissed.has(r.id));

  const filtered = records.filter(r => {
    if (!query) return true;
    const name  = r.profiles?.name ?? '';
    const phone = r.profiles?.phone ?? '';
    return name.toLowerCase().includes(query.toLowerCase()) || phone.includes(query);
  });

  const handleApprove = async (id) => {
    setActing(id);
    const { error: err } = await AdminAPI.reviewKYC(id, 'verified');
    if (!err) setDismissed(prev => new Set([...prev, id]));
    setDocView(null);
    setActing(null);
  };

  const handleReject = async (id) => {
    setActing(id);
    const { error: err } = await AdminAPI.reviewKYC(id, 'rejected', reason || null);
    if (!err) setDismissed(prev => new Set([...prev, id]));
    setRejectFor(null);
    setReason('');
    setDocView(null);
    setActing(null);
  };

  return (
    <div className="flex-1 overflow-auto pb-10">
      <AppHeader
        title="KYC Review"
        subtitle="Verify identity documents submitted by vendors and riders"
        rightAction={
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={refetch}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        }
      />

      <div className="p-4 space-y-4 max-w-3xl">
        {/* Tabs */}
        <Tabs value={tab} onValueChange={v => { setTab(v); setDismissed(new Set()); }}>
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="submitted" className="text-xs">To Review</TabsTrigger>
            <TabsTrigger value="verified"  className="text-xs">Verified</TabsTrigger>
            <TabsTrigger value="rejected"  className="text-xs">Rejected</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or phone…"
            className="pl-9"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>

        {/* Error */}
        {error && (
          <Card className="p-4 border-destructive/30 bg-destructive/5">
            <p className="text-sm text-destructive">{error.message}</p>
            <Button size="sm" variant="outline" className="mt-2" onClick={refetch}>Retry</Button>
          </Card>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="space-y-2">
            {[1,2,3].map(i => <div key={i} className="h-28 bg-muted rounded-xl animate-pulse" />)}
          </div>
        )}

        {/* Empty */}
        {!isLoading && !error && filtered.length === 0 && (
          <Card className="p-8 border-dashed text-center">
            <ShieldCheck className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              {tab === 'submitted' ? 'No documents awaiting review' : `No ${tab} records`}
            </p>
          </Card>
        )}

        {/* KYC Records */}
        <div className="space-y-3">
          {filtered.map(r => {
            const profile = r.profiles ?? {};
            return (
              <Card key={r.id} className="border-border overflow-hidden">
                <div className="p-4">
                  {/* Person info */}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <User className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-bold">{profile.name ?? 'Unknown'}</p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                          {profile.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3" />{profile.phone}
                            </span>
                          )}
                          {profile.villages?.name && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />{profile.villages.name}
                            </span>
                          )}
                          <Badge variant="outline" className="text-[9px] capitalize">
                            {profile.role ?? 'unknown'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <Badge className={`text-[9px] border-0 ${STATUS_STYLE[r.status]}`}>
                        {r.status}
                      </Badge>
                      <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1 justify-end">
                        <Clock className="w-2.5 h-2.5" />{relTime(r.created_at)}
                      </p>
                    </div>
                  </div>

                  {/* Document type + aadhaar last4 */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    <Badge variant="outline" className="text-xs flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      {DOC_LABELS[r.type] ?? r.type}
                      {r.aadhaar_last4 && (
                        <span className="ml-1 text-muted-foreground">••••{r.aadhaar_last4}</span>
                      )}
                    </Badge>
                  </div>

                  {r.status === 'rejected' && r.failure_reason && (
                    <p className="text-xs text-red-600 bg-red-50 p-2 rounded-lg mb-2">
                      Rejected: {r.failure_reason}
                    </p>
                  )}

                  {/* Action buttons */}
                  <div className="flex gap-2">
                    {/* View document */}
                    {r.doc_url && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 h-8 text-xs"
                        onClick={() => setDocView(r)}
                      >
                        <Eye className="w-3 h-3" /> View Doc
                      </Button>
                    )}

                    {r.status === 'submitted' && (
                      <>
                        <Button
                          size="sm"
                          className="flex-1 h-8 text-xs gap-1 bg-green-600 hover:bg-green-700"
                          disabled={acting === r.id}
                          onClick={() => handleApprove(r.id)}
                        >
                          {acting === r.id
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <CheckCircle className="w-3 h-3" />}
                          Verify
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 h-8 text-xs gap-1 text-destructive border-destructive/30"
                          disabled={acting === r.id}
                          onClick={() => { setRejectFor(r.id); }}
                        >
                          <XCircle className="w-3 h-3" /> Reject
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* ── Document viewer modal ─────────────────────── */}
      <Dialog open={!!docView} onOpenChange={v => !v && setDocView(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {DOC_LABELS[docView?.type] ?? docView?.type} — {docView?.profiles?.name}
            </DialogTitle>
          </DialogHeader>
          {docView && (
            <div className="space-y-4">
              {/* Document image */}
              <div className="rounded-xl overflow-hidden border border-border">
                <img
                  src={docView.doc_url}
                  alt="KYC document"
                  className="w-full object-contain max-h-72 bg-muted"
                  onError={e => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }}
                />
                <div className="hidden items-center justify-center h-40 text-sm text-muted-foreground">
                  <FileText className="w-6 h-6 mr-2" /> Unable to load image
                </div>
              </div>

              {/* Meta */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 bg-muted rounded-lg">
                  <p className="text-muted-foreground">Type</p>
                  <p className="font-medium">{DOC_LABELS[docView.type] ?? docView.type}</p>
                </div>
                {docView.aadhaar_last4 && (
                  <div className="p-2.5 bg-muted rounded-lg">
                    <p className="text-muted-foreground">Aadhaar (last 4)</p>
                    <p className="font-medium font-mono">••••{docView.aadhaar_last4}</p>
                  </div>
                )}
                <div className="p-2.5 bg-muted rounded-lg">
                  <p className="text-muted-foreground">Submitted by</p>
                  <p className="font-medium">{docView.profiles?.name ?? '—'}</p>
                </div>
                <div className="p-2.5 bg-muted rounded-lg">
                  <p className="text-muted-foreground">Current status</p>
                  <p className={`font-medium capitalize ${
                    docView.status === 'verified' ? 'text-green-600' :
                    docView.status === 'rejected' ? 'text-red-600' : 'text-amber-600'
                  }`}>{docView.status}</p>
                </div>
              </div>

              {/* Open in new tab */}
              <a
                href={docView.doc_url}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-primary underline underline-offset-2 block"
              >
                Open original document ↗
              </a>

              {docView.status === 'submitted' && (
                <div className="flex gap-2">
                  <Button
                    className="flex-1 gap-2 bg-green-600 hover:bg-green-700"
                    disabled={acting === docView.id}
                    onClick={() => handleApprove(docView.id)}
                  >
                    <CheckCircle className="w-4 h-4" /> Verify
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 gap-2 text-destructive border-destructive/30"
                    onClick={() => { setRejectFor(docView.id); setDocView(null); }}
                  >
                    <XCircle className="w-4 h-4" /> Reject
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Rejection reason modal ────────────────────── */}
      <Dialog open={!!rejectFor} onOpenChange={v => !v && setRejectFor(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reject KYC Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <p className="text-sm text-muted-foreground">
              The applicant will be notified and asked to re-submit.
            </p>
            <Textarea
              placeholder="e.g. Photo is blurry / Name does not match / Document expired"
              className="h-24 text-sm"
              value={reason}
              onChange={e => setReason(e.target.value)}
            />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setRejectFor(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1 gap-2"
                disabled={acting === rejectFor}
                onClick={() => handleReject(rejectFor)}
              >
                {acting === rejectFor
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <XCircle className="w-4 h-4" />}
                Confirm Reject
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
