// ═══════════════════════════════════════════════════════════
// SETU — AdminDisputes  (new)
// View and resolve disputes escalated from anchors or users.
// Route: /admin/disputes
// ═══════════════════════════════════════════════════════════
import React, { useState } from 'react';
import {
  Scale, Search, RefreshCw, Loader2,
  User, Phone, AlertTriangle, CheckCircle, Clock,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import AppHeader from '@/components/shared/AppHeader';
import { useDataFetch } from '@/hooks/useDataFetch';
import { AdminAPI } from '@/lib/api';

const TYPE_LABELS = {
  order:    { label: 'Order',    color: 'bg-blue-100 text-blue-700'   },
  payment:  { label: 'Payment',  color: 'bg-amber-100 text-amber-700' },
  quality:  { label: 'Quality',  color: 'bg-orange-100 text-orange-700' },
  delivery: { label: 'Delivery', color: 'bg-teal-100 text-teal-700'   },
  fraud:    { label: 'Fraud',    color: 'bg-red-100 text-red-700'     },
  other:    { label: 'Other',    color: 'bg-muted text-muted-foreground' },
};

const STATUS_STYLE = {
  open:         'bg-amber-100 text-amber-700',
  under_review: 'bg-blue-100 text-blue-700',
  resolved:     'bg-green-100 text-green-700',
  escalated:    'bg-red-100 text-red-700',
  closed:       'bg-muted text-muted-foreground',
};

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });
}

export default function AdminDisputes() {
  const [tab,     setTab]     = useState('open');
  const [query,   setQuery]   = useState('');
  const [resolve, setResolve] = useState(null);
  const [resText, setResText] = useState('');
  const [saving,  setSaving]  = useState(false);

  const { data, isLoading, error, refetch } = useDataFetch(
    () => AdminAPI.getDisputes({ status: tab === 'all' ? undefined : tab }),
    [tab],
    { cacheKey: `admin-disputes-${tab}`, staleTime: 20_000 }
  );

  const disputes = (data ?? []).filter(d => {
    if (!query) return true;
    return (
      (d.profiles?.name  ?? '').toLowerCase().includes(query.toLowerCase()) ||
      (d.description      ?? '').toLowerCase().includes(query.toLowerCase()) ||
      (d.orders?.order_number ?? '').includes(query)
    );
  });

  const openCount     = (data ?? []).filter(d => d.status === 'open').length;
  const escalateCount = (data ?? []).filter(d => d.status === 'escalated').length;

  const handleResolve = async () => {
    if (!resolve || !resText.trim()) return;
    setSaving(true);
    const { error: err } = await AdminAPI.resolveDispute(resolve.id, resText.trim());
    if (!err) {
      setResolve(null);
      setResText('');
      refetch();
    }
    setSaving(false);
  };

  return (
    <div className="flex-1 overflow-auto pb-10">
      <AppHeader
        title="Disputes"
        subtitle={`${openCount} open · ${escalateCount} escalated`}
        rightAction={
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={refetch}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        }
      />

      <div className="p-4 space-y-4 max-w-3xl">

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="open"         className="text-xs">Open</TabsTrigger>
            <TabsTrigger value="under_review" className="text-xs">In Review</TabsTrigger>
            <TabsTrigger value="escalated"    className="text-xs">Escalated</TabsTrigger>
            <TabsTrigger value="all"          className="text-xs">All</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, description, order…"
            className="pl-9"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>

        {error && (
          <Card className="p-4 border-destructive/30 bg-destructive/5">
            <p className="text-sm text-destructive">{error.message}</p>
            <Button size="sm" variant="outline" className="mt-2" onClick={refetch}>Retry</Button>
          </Card>
        )}

        {isLoading && (
          <div className="space-y-2">
            {[1,2,3].map(i => <div key={i} className="h-28 bg-muted rounded-xl animate-pulse" />)}
          </div>
        )}

        {!isLoading && !error && disputes.length === 0 && (
          <Card className="p-8 border-dashed text-center">
            <Scale className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No disputes in this category</p>
          </Card>
        )}

        <div className="space-y-3">
          {disputes.map(d => {
            const typeStyle   = TYPE_LABELS[d.type]   ?? TYPE_LABELS.other;
            const statusStyle = STATUS_STYLE[d.status] ?? '';
            return (
              <Card key={d.id} className="p-4 border-border">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <User className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-bold">{d.profiles?.name ?? 'Unknown'}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {d.profiles?.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />{d.profiles.phone}
                          </span>
                        )}
                        <span>{fmtDate(d.created_at)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge className={`text-[9px] border-0 ${statusStyle}`}>{d.status}</Badge>
                    <Badge className={`text-[9px] border-0 ${typeStyle.color}`}>{typeStyle.label}</Badge>
                  </div>
                </div>

                <p className="text-sm text-foreground mb-2 line-clamp-2">{d.description}</p>

                {d.orders?.order_number && (
                  <p className="text-xs text-muted-foreground mb-2">
                    Order: <span className="font-mono font-medium">{d.orders.order_number}</span>
                    {d.orders.total && ` · ₹${d.orders.total}`}
                    {d.orders.vendor_name && ` · ${d.orders.vendor_name}`}
                  </p>
                )}

                {d.resolution && (
                  <div className="p-2 bg-green-50 rounded-lg text-xs text-green-700 mb-2">
                    Resolution: {d.resolution}
                  </div>
                )}

                {(d.status === 'open' || d.status === 'under_review' || d.status === 'escalated') && (
                  <Button
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => { setResolve(d); setResText(''); }}
                  >
                    <CheckCircle className="w-3 h-3" /> Resolve
                  </Button>
                )}
              </Card>
            );
          })}
        </div>
      </div>

      {/* Resolve dialog */}
      <Dialog open={!!resolve} onOpenChange={v => !v && setResolve(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Resolve Dispute</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <p className="text-sm text-muted-foreground">
              Raised by <span className="font-semibold text-foreground">{resolve?.profiles?.name}</span>.
              Describe the resolution and close this dispute.
            </p>
            <div>
              <Label className="text-xs mb-1 block">Resolution *</Label>
              <Textarea
                placeholder="e.g. Refund of ₹200 issued. Vendor warned about quality."
                className="h-24 text-sm"
                value={resText}
                onChange={e => setResText(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setResolve(null)}>
                Cancel
              </Button>
              <Button
                className="flex-1 gap-2"
                disabled={!resText.trim() || saving}
                onClick={handleResolve}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Mark Resolved
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
