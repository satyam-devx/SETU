// ═══════════════════════════════════════════════════════════
// SETU — AdminCustomers (v2 — Live DB)
// Replaces hardcoded mock. Wired to AdminAPI.getUsers().
// Features: search, role filter, ban/unban with reason,
// credit usage display, village display, pagination.
// Route: /admin/customers
// ═══════════════════════════════════════════════════════════
import React, { useState, useMemo } from 'react';
import {
  Search, Users, CreditCard, Phone, AlertTriangle,
  ShieldOff, ShieldCheck, RefreshCw, Loader2,
  ChevronDown, MapPin, Calendar
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import AppHeader from '@/components/shared/AppHeader';
import StatCard from '@/components/shared/StatCard';
import { useDataFetch } from '@/hooks/useDataFetch';
import { AdminAPI } from '@/lib/api';

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });
}

export default function AdminCustomers() {
  const [query,     setQuery]     = useState('');
  const [tab,       setTab]       = useState('all');
  const [banModal,  setBanModal]  = useState(null);  // user object or null
  const [banReason, setBanReason] = useState('');
  const [acting,    setActing]    = useState(null);  // userId being acted on
  const [page,      setPage]      = useState(0);
  const LIMIT = 50;

  const { data, isLoading, error, refetch } = useDataFetch(
    () => AdminAPI.getUsers({ role: 'customer', page, limit: LIMIT }),
    [page],
    { cacheKey: `admin-customers-p${page}`, staleTime: 20_000 }
  );

  const users = data ?? [];

  // ── Derived stats ─────────────────────────────────────
  const totalCount   = users.length;
  const activeCount  = users.filter(u => u.is_verified !== false).length;
  const bannedCount  = users.filter(u => u.is_verified === false).length;

  // ── Filter ────────────────────────────────────────────
  const filtered = useMemo(() => {
    return users.filter(u => {
      const matchQ = !query
        || (u.name ?? '').toLowerCase().includes(query.toLowerCase())
        || (u.phone ?? '').includes(query)
        || (u.villages?.name ?? '').toLowerCase().includes(query.toLowerCase());
      const isBanned = u.is_verified === false;
      if (tab === 'active')  return matchQ && !isBanned;
      if (tab === 'blocked') return matchQ && isBanned;
      return matchQ;
    });
  }, [users, query, tab]);

  // ── Ban ───────────────────────────────────────────────
  const openBanModal = (user) => {
    setBanModal(user);
    setBanReason('');
  };

  const confirmBan = async () => {
    if (!banModal) return;
    setActing(banModal.id);
    const { error: err } = await AdminAPI.banUser(banModal.id, banReason || null);
    if (!err) refetch();
    setActing(null);
    setBanModal(null);
  };

  // ── Unban ─────────────────────────────────────────────
  const handleUnban = async (userId) => {
    setActing(userId);
    const { error: err } = await AdminAPI.unbanUser(userId);
    if (!err) refetch();
    setActing(null);
  };

  return (
    <div className="flex-1 overflow-auto pb-10">
      <AppHeader
        title="Customers"
        subtitle={isLoading ? 'Loading…' : `${totalCount} loaded`}
        rightAction={
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={refetch}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        }
      />

      <div className="p-4 space-y-4 max-w-3xl">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          <StatCard title="Total"   value={totalCount}  icon={Users} />
          <StatCard title="Active"  value={activeCount} icon={ShieldCheck} accent />
          <StatCard title="Banned"  value={bannedCount} icon={ShieldOff} />
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, phone or village…"
            className="pl-9"
            value={query}
            onChange={e => { setQuery(e.target.value); setPage(0); }}
          />
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={v => { setTab(v); setPage(0); }}>
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="all"     className="text-xs">All ({totalCount})</TabsTrigger>
            <TabsTrigger value="active"  className="text-xs">Active ({activeCount})</TabsTrigger>
            <TabsTrigger value="blocked" className="text-xs">Banned ({bannedCount})</TabsTrigger>
          </TabsList>
        </Tabs>

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
            {[1,2,3,4].map(i => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}
          </div>
        )}

        {/* Empty */}
        {!isLoading && !error && filtered.length === 0 && (
          <Card className="p-6 border-border text-center">
            <Users className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No customers match your filters</p>
          </Card>
        )}

        {/* List */}
        <div className="space-y-2">
          {filtered.map(u => {
            const isBanned = u.is_verified === false;
            return (
              <Card key={u.id} className="p-4 border-border">
                <div className="flex items-start justify-between mb-1">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold">{u.name ?? 'Unknown'}</p>
                      <Badge className={`text-[9px] border-0 ${
                        isBanned ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                      }`}>
                        {isBanned ? 'Banned' : 'Active'}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-xs text-muted-foreground">
                      {u.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />{u.phone}
                        </span>
                      )}
                      {u.villages?.name && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />{u.villages.name}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />Joined {fmtDate(u.created_at)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {isBanned ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1"
                        disabled={acting === u.id}
                        onClick={() => handleUnban(u.id)}
                      >
                        {acting === u.id
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : <ShieldCheck className="w-3 h-3" />}
                        Unban
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1 text-destructive border-destructive/30 hover:bg-destructive/5"
                        disabled={acting === u.id}
                        onClick={() => openBanModal(u)}
                      >
                        <ShieldOff className="w-3 h-3" />
                        Ban
                      </Button>
                    )}
                  </div>
                </div>

                {/* Setu score + credit */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1 flex-wrap">
                  <span>Setu Score: <span className="font-semibold text-foreground">{u.setu_score ?? 0}</span></span>
                  <span>Lang: <span className="font-semibold text-foreground">{u.language ?? 'hi'}</span></span>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Pagination */}
        {!isLoading && users.length === LIMIT && (
          <Button
            variant="outline"
            className="w-full text-xs"
            onClick={() => setPage(p => p + 1)}
          >
            Load more
          </Button>
        )}
      </div>

      {/* ── Ban confirmation modal ─────────────────────── */}
      <Dialog open={!!banModal} onOpenChange={v => !v && setBanModal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Ban Customer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <p className="text-sm text-muted-foreground">
              You are about to ban <span className="font-semibold text-foreground">{banModal?.name}</span>.
              They will lose access to the platform. This action is logged.
            </p>
            <div>
              <Label className="text-xs mb-1 block">Reason (optional)</Label>
              <Textarea
                placeholder="e.g. Repeated fraudulent orders, non-payment…"
                className="h-20 text-sm"
                value={banReason}
                onChange={e => setBanReason(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setBanModal(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1 gap-2"
                disabled={!!acting}
                onClick={confirmBan}
              >
                {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldOff className="w-4 h-4" />}
                Confirm Ban
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
