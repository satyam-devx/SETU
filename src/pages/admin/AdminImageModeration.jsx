// ═══════════════════════════════════════════════════════════
// SETU — AdminImageModeration
// Review queue for uploaded images: product, vendor, KYC, banner.
// Approve publishes the image; reject flags it with reason.
// Route: /admin/image-moderation
// ═══════════════════════════════════════════════════════════
import React, { useState } from 'react';
import {
  CheckCircle, XCircle, Eye, RefreshCw, Loader2,
  Image as ImageIcon, Store, Package, FileText
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import AppHeader from '@/components/shared/AppHeader';
import { useDataFetch } from '@/hooks/useDataFetch';
import { AdminAPI } from '@/lib/api';

const ENTITY_ICONS = {
  product: Package,
  vendor:  Store,
  kyc:     FileText,
  banner:  ImageIcon,
};

const STATUS_STYLE = {
  pending:  'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

function relTime(iso) {
  if (!iso) return '';
  const diff = Math.floor((Date.now() - new Date(iso)) / 60000);
  if (diff < 60)   return `${diff}m ago`;
  if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
  return `${Math.floor(diff / 1440)}d ago`;
}

export default function AdminImageModeration() {
  const [tab,       setTab]       = useState('pending');
  const [preview,   setPreview]   = useState(null);   // image object
  const [acting,    setActing]    = useState(null);   // imageId being reviewed
  const [reason,    setReason]    = useState('');
  const [rejectFor, setRejectFor] = useState(null);   // imageId awaiting rejection note
  const [dismissed, setDismissed] = useState(new Set());

  const { data, isLoading, error, refetch } = useDataFetch(
    () => AdminAPI.getImageQueue({ status: tab }),
    [tab],
    { cacheKey: `image-mod-${tab}`, staleTime: 15_000 }
  );

  const images = (data ?? []).filter(img => !dismissed.has(img.id));

  const handleApprove = async (img) => {
    setActing(img.id);
    await AdminAPI.reviewImage(img.id, 'approved');
    setDismissed(prev => new Set([...prev, img.id]));
    setActing(null);
    setPreview(null);
  };

  const handleReject = async (imageId) => {
    setActing(imageId);
    await AdminAPI.reviewImage(imageId, 'rejected', reason || null);
    setDismissed(prev => new Set([...prev, imageId]));
    setRejectFor(null);
    setReason('');
    setActing(null);
    setPreview(null);
  };

  return (
    <div className="flex-1 overflow-auto pb-10">
      <AppHeader
        title="Image Moderation"
        subtitle="Review uploaded images before they go public"
        rightAction={
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={refetch}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        }
      />

      <div className="p-5 space-y-4 max-w-4xl">
        <Tabs value={tab} onValueChange={v => { setTab(v); setDismissed(new Set()); }}>
          <TabsList className="grid grid-cols-3 w-full max-w-xs">
            <TabsTrigger value="pending"  className="text-xs">Pending</TabsTrigger>
            <TabsTrigger value="approved" className="text-xs">Approved</TabsTrigger>
            <TabsTrigger value="rejected" className="text-xs">Rejected</TabsTrigger>
          </TabsList>
        </Tabs>

        {error && (
          <Card className="p-3 border-destructive/20 bg-destructive/5">
            <p className="text-xs text-destructive">{error.message ?? 'Failed to load moderation queue.'}</p>
            <Button size="sm" variant="outline" className="mt-2" onClick={refetch}>Retry</Button>
          </Card>
        )}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="h-48 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        ) : images.length === 0 ? (
          <Card className="p-8 border-dashed text-center">
            <ImageIcon className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              {tab === 'pending' ? 'No images awaiting review' : `No ${tab} images`}
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {images.map(img => {
              const EntityIcon = ENTITY_ICONS[img.entity_type] ?? ImageIcon;
              return (
                <Card key={img.id} className="border-border overflow-hidden flex flex-col">
                  {/* Image */}
                  <div
                    className="relative h-36 bg-muted cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    role="button"
                    tabIndex={0}
                    aria-label="Preview uploaded image"
                    onClick={() => setPreview(img)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPreview(img); }
                    }}
                  >
                    <img
                      src={img.public_url}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={e => { e.target.style.display = 'none'; }}
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Eye className="w-6 h-6 text-white" />
                    </div>
                    <Badge className={`absolute top-2 left-2 text-[9px] border-0 ${STATUS_STYLE[img.status]}`}>
                      {img.status}
                    </Badge>
                  </div>

                  {/* Info */}
                  <div className="p-2.5 flex-1 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <EntityIcon className="w-3 h-3 text-muted-foreground shrink-0" />
                      <span className="text-xs font-medium capitalize">{img.entity_type}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      By: {img.profiles?.name ?? 'Unknown'} · {relTime(img.created_at)}
                    </p>
                    {img.reject_reason && (
                      <p className="text-[10px] text-red-600 truncate">{img.reject_reason}</p>
                    )}
                  </div>

                  {/* Actions (pending only) */}
                  {img.status === 'pending' && (
                    <div className="flex gap-1 p-2 pt-0">
                      <Button
                        size="sm"
                        className="flex-1 h-7 text-xs gap-1 bg-green-600 hover:bg-green-700"
                        disabled={acting === img.id}
                        onClick={() => handleApprove(img)}
                      >
                        {acting === img.id
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : <CheckCircle className="w-3 h-3" />}
                        OK
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 h-7 text-xs gap-1 text-destructive border-destructive/30"
                        disabled={acting === img.id}
                        onClick={() => setRejectFor(img.id)}
                      >
                        <XCircle className="w-3 h-3" />Reject
                      </Button>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Fullscreen preview ────────────────────────── */}
      <Dialog open={!!preview} onOpenChange={v => !v && setPreview(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="capitalize">
              {preview?.entity_type} Image
            </DialogTitle>
          </DialogHeader>
          {preview && (
            <div className="space-y-3">
              <img
                src={preview.public_url}
                alt=""
                className="w-full max-h-80 object-contain bg-muted rounded-xl"
              />
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div>Entity ID: <span className="font-mono text-foreground">{preview.entity_id ?? '—'}</span></div>
                <div>Uploaded by: <span className="text-foreground">{preview.profiles?.name ?? 'Unknown'}</span></div>
                <div>Status: <span className={`font-semibold ${preview.status === 'approved' ? 'text-green-600' : preview.status === 'rejected' ? 'text-red-600' : 'text-amber-600'}`}>{preview.status}</span></div>
                <div>Path: <span className="font-mono text-foreground truncate">{preview.storage_path}</span></div>
              </div>
              {preview.status === 'pending' && (
                <div className="flex gap-2 pt-2">
                  <Button
                    className="flex-1 gap-2 bg-green-600 hover:bg-green-700"
                    disabled={acting === preview.id}
                    onClick={() => handleApprove(preview)}
                  >
                    <CheckCircle className="w-4 h-4" /> Approve
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 gap-2 text-destructive border-destructive/30"
                    disabled={acting === preview.id}
                    onClick={() => { setRejectFor(preview.id); setPreview(null); }}
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
            <DialogTitle>Reject Image</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <p className="text-sm text-muted-foreground">
              Provide an optional reason for rejection. This will be stored for reference.
            </p>
            <Textarea
              placeholder="e.g. Image is blurry, reupload required / Inappropriate content detected"
              className="h-24 text-sm"
              value={reason}
              onChange={e => setReason(e.target.value)}
            />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setRejectFor(null)}>Cancel</Button>
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
