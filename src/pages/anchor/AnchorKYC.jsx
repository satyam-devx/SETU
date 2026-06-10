import React, { useState, useEffect, useCallback } from 'react';
import { UserCheck, Search, CheckCircle, Clock, XCircle, RefreshCw, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppHeader from '@/components/shared/AppHeader';
import { useVillage } from '@/lib/village';
import { AnchorAPI } from '@/lib/api';

const STATUS_STYLE = {
  pending:    'bg-amber-100 text-amber-700',
  submitted:  'bg-blue-100  text-blue-700',
  verified:   'bg-green-100 text-green-700',
  rejected:   'bg-red-100   text-red-700',
};

const StatusIcon = {
  pending:   Clock,
  submitted: Clock,
  verified:  CheckCircle,
  rejected:  XCircle,
};

// Normalise a raw kyc_records row (with joined profiles) into a display shape
function normaliseRecord(r) {
  const profile = r.profiles ?? {};
  return {
    id:        r.id,
    name:      profile.name  ?? 'Unknown',
    role:      profile.role  ?? '—',
    type:      r.type,
    status:    r.status,
    docUrl:    r.doc_url,
    reason:    r.failure_reason,
    submitted: r.created_at
      ? new Date(r.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
      : '—',
  };
}

export default function AnchorKYC() {
  const { villageId } = useVillage();

  const [records,  setRecords]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [tab,      setTab]      = useState('all');
  const [query,    setQuery]    = useState('');
  const [actingOn, setActingOn] = useState(null); // id currently being approved/rejected

  const loadRecords = useCallback(async () => {
    if (!villageId) return;
    setLoading(true);
    setError(null);
    const { data, error: fetchErr } = await AnchorAPI.getVillageKycRecords(villageId);
    if (fetchErr) setError('Failed to load KYC records. Tap retry.');
    else setRecords((data ?? []).map(normaliseRecord));
    setLoading(false);
  }, [villageId]);

  useEffect(() => { loadRecords(); }, [loadRecords]);

  // ── Actions ────────────────────────────────────────────
  const handleApprove = async (id) => {
    setActingOn(id);
    const { error: e } = await AnchorAPI.approveKycRecord(id);
    if (!e) setRecords(rs => rs.map(r => r.id === id ? { ...r, status: 'verified' } : r));
    setActingOn(null);
  };

  const handleReject = async (id) => {
    setActingOn(id);
    const { error: e } = await AnchorAPI.rejectKycRecord(id);
    if (!e) setRecords(rs => rs.map(r => r.id === id ? { ...r, status: 'rejected' } : r));
    setActingOn(null);
  };

  // ── Derived ────────────────────────────────────────────
  const pendingStatuses = ['pending', 'submitted'];

  const filtered = records.filter(r => {
    const matchTab   = tab === 'all'
      || (tab === 'pending' && pendingStatuses.includes(r.status))
      || r.status === tab;
    const matchQuery = !query || r.name.toLowerCase().includes(query.toLowerCase());
    return matchTab && matchQuery;
  });

  const counts = {
    pending:  records.filter(r => pendingStatuses.includes(r.status)).length,
    verified: records.filter(r => r.status === 'verified').length,
    rejected: records.filter(r => r.status === 'rejected').length,
  };

  return (
    <div className="pb-6">
      <AppHeader title="KYC Management" showBack />
      <div className="px-4 py-4 space-y-3">

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <Card className="p-2 border-border">
            <p className="text-xl font-bold text-amber-500">{loading ? '…' : counts.pending}</p>
            <p className="text-[10px] text-muted-foreground">Pending</p>
          </Card>
          <Card className="p-2 border-border">
            <p className="text-xl font-bold text-green-500">{loading ? '…' : counts.verified}</p>
            <p className="text-[10px] text-muted-foreground">Approved</p>
          </Card>
          <Card className="p-2 border-border">
            <p className="text-xl font-bold text-red-500">{loading ? '…' : counts.rejected}</p>
            <p className="text-[10px] text-muted-foreground">Rejected</p>
          </Card>
        </div>

        {/* Error banner */}
        {error && (
          <Card className="p-3 border-destructive/20 bg-destructive/5 flex items-center justify-between">
            <p className="text-xs text-destructive">{error}</p>
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={loadRecords}>
              <RefreshCw className="w-3 h-3" /> Retry
            </Button>
          </Card>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search people..."
            className="pl-9 h-8 text-sm"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full grid grid-cols-4">
            {['all', 'pending', 'verified', 'rejected'].map(t => (
              <TabsTrigger key={t} value={t} className="text-xs capitalize">{t}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* List */}
        {loading ? (
          <div className="space-y-2 animate-pulse">
            {[1, 2, 3].map(i => <div key={i} className="h-20 bg-muted rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="p-6 border-border text-center">
            <UserCheck className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No KYC records found</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map(k => {
              const Icon    = StatusIcon[k.status] ?? Clock;
              const isActing = actingOn === k.id;
              const isPending = pendingStatuses.includes(k.status);

              return (
                <Card key={k.id} className="p-4 border-border">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold">{k.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {k.role} · {k.type.replace(/_/g, ' ')}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Submitted {k.submitted}
                      </p>
                      {k.reason && (
                        <p className="text-[10px] text-destructive mt-0.5">Reason: {k.reason}</p>
                      )}
                    </div>
                    <Badge className={`text-[9px] flex items-center gap-1 border-0 ${STATUS_STYLE[k.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      <Icon className="w-3 h-3" />
                      {k.status}
                    </Badge>
                  </div>

                  {k.docUrl && (
                    <a
                      href={k.docUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-primary underline mt-1 inline-block"
                    >
                      View Document
                    </a>
                  )}

                  {isPending && (
                    <div className="flex gap-2 mt-3">
                      <Button
                        size="sm"
                        className="flex-1 h-7 text-xs"
                        disabled={isActing}
                        onClick={() => handleApprove(k.id)}
                      >
                        {isActing ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Approve'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 h-7 text-xs text-destructive border-destructive/30"
                        disabled={isActing}
                        onClick={() => handleReject(k.id)}
                      >
                        {isActing ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Reject'}
                      </Button>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
