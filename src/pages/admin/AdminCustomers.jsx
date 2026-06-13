// ═══════════════════════════════════════════════════════════
// SETU — AdminCustomers  (v3 — production-grade)
// Full user management:
//   - All roles (customer, vendor, rider, seva, anchor, admin)
//   - Search, filter by role, ban/unban with reason
//   - User detail modal: profile, order history, Setu score
//   - Pagination (50 per page)
// Route: /admin/customers
// ═══════════════════════════════════════════════════════════
import React, { useState, useMemo } from 'react';
import {
  Search, Users, Phone, ShieldOff, ShieldCheck,
  RefreshCw, Loader2, MapPin, Calendar, ChevronRight,
  ShoppingBag, User, Star,
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
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import AppHeader from '@/components/shared/AppHeader';
import StatCard from '@/components/shared/StatCard';
import { useDataFetch } from '@/hooks/useDataFetch';
import { AdminAPI } from '@/lib/api';

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });
}

const ROLE_COLORS = {
  customer:      'bg-blue-100 text-blue-700',
  vendor:        'bg-green-100 text-green-700',
  rider:         'bg-amber-100 text-amber-700',
  seva_provider: 'bg-purple-100 text-purple-700',
  anchor:        'bg-teal-100 text-teal-700',
  admin:         'bg-red-100 text-red-700',
  super_admin:   'bg-red-200 text-red-800',
};

// ── User Detail Modal ─────────────────────────────────────
function UserDetailModal({ user, onClose, onBan, onUnban }) {
  const [acting, setActing] = useState(null);
  const [banReason, setBanReason] = useState('');
  const [confirmBan, setConfirmBan] = useState(false);

  const { data: orders, isLoading: ordersLoading } = useDataFetch(
    () => AdminAPI.getUserOrders(user.id),
    [user.id],
    { cacheKey: `user-orders-${user.id}`, staleTime: 30_000 }
  );

  const isBanned    = user.is_verified === false;
  const totalSpend  = (orders ?? []).filter(o => o.status === 'delivered').reduce((s, o) => s + Number(o.total ?? 0), 0);

  const handleBan = async () => {
    setActing('ban');
    await onBan(user.id, banReason || null);
    setActing(null);
    onClose();
  };

  const handleUnban = async () => {
    setActing('unban');
    await onUnban(user.id);
    setActing(null);
    onClose();
  };

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-4 h-4" /> {user.name ?? 'User'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Profile info */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            {[
              { label: 'Phone',    value: user.phone ?? '—' },
              { label: 'Village',  value: user.villages?.name ?? '—' },
              { label: 'Role',     value: user.role },
              { label: 'Joined',   value: fmtDate(user.created_at) },
              { label: 'Language', value: user.language ?? 'hi' },
              { label: 'Setu Score', value: user.setu_score ?? 0 },
            ].map(f => (
              <div key={f.label} className="p-2.5 bg-muted/40 rounded-lg">
                <p className="text-muted-foreground">{f.label}</p>
                <p className="font-medium">{f.value}</p>
              </div>
            ))}
          </div>

          {/* Order history */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold">Order History</p>
              {!ordersLoading && (
                <span className="text-xs text-muted-foreground">
                  {(orders ?? []).length} orders · ₹{totalSpend.toLocaleString('en-IN')} total spent
                </span>
              )}
            </div>
            {ordersLoading ? (
              <div className="space-y-1.5">
                {[1,2].map(i => <div key={i} className="h-10 bg-muted rounded animate-pulse" />)}
              </div>
            ) : (orders ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No orders yet</p>
            ) : (
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {(orders ?? []).map(o => (
                  <div key={o.id} className="flex items-center justify-between p-2 bg-muted/40 rounded-lg text-xs">
                    <div>
                      <span className="font-mono text-muted-foreground">{o.order_number}</span>
                      <span className="ml-2">{o.vendor_name ?? '—'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">₹{o.total}</span>
                      <Badge className={`text-[9px] border-0 ${
                        o.status === 'delivered' ? 'bg-green-100 text-green-700' :
                        o.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>{o.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2 border-t border-border">
            {user.phone && (
              <a href={`tel:${user.phone}`}>
                <Button size="sm" variant="outline" className="gap-1 h-8 text-xs">
                  <Phone className="w-3 h-3" /> Call
                </Button>
              </a>
            )}
            {isBanned ? (
              <Button
                size="sm"
                className="gap-1 h-8 text-xs bg-green-600 hover:bg-green-700 flex-1"
                disabled={acting === 'unban'}
                onClick={handleUnban}
              >
                {acting === 'unban' ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShieldCheck className="w-3 h-3" />}
                Unban User
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="gap-1 h-8 text-xs text-destructive border-destructive/30 flex-1"
                onClick={() => setConfirmBan(true)}
              >
                <ShieldOff className="w-3 h-3" /> Ban User
              </Button>
            )}
          </div>

          {/* Ban confirmation inline */}
          {confirmBan && !isBanned && (
            <div className="p-3 border border-destructive/20 bg-destructive/5 rounded-xl space-y-3">
              <p className="text-xs font-medium text-destructive">Confirm Ban</p>
              <Textarea
                placeholder="Reason (optional)"
                className="h-16 text-sm"
                value={banReason}
                onChange={e => setBanReason(e.target.value)}
              />
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => setConfirmBan(false)}>Cancel</Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="flex-1 gap-1"
                  disabled={acting === 'ban'}
                  onClick={handleBan}
                >
                  {acting === 'ban' ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                  Confirm Ban
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main component ────────────────────────────────────────
export default function AdminCustomers() {
  const [query,   setQuery]   = useState('');
  const [tab,     setTab]     = useState('all');
  const [roleFil, setRoleFil] = useState('');
  const [page,    setPage]    = useState(0);
  const [selected,setSelected]= useState(null);
  const [acting,  setActing]  = useState(null);
  const LIMIT = 50;

  const { data, isLoading, error, refetch } = useDataFetch(
    () => AdminAPI.getUsers({ role: roleFil || undefined, page, limit: LIMIT }),
    [page, roleFil],
    { cacheKey: `admin-users-p${page}-r${roleFil}`, staleTime: 20_000 }
  );

  const users = data ?? [];

  const totalCount  = users.length;
  const activeCount = users.filter(u => u.is_verified !== false).length;
  const bannedCount = users.filter(u => u.is_verified === false).length;

  const filtered = useMemo(() => {
    return users.filter(u => {
      const matchQ = !query
        || (u.name ?? '').toLowerCase().includes(query.toLowerCase())
        || (u.phone ?? '').includes(query)
        || (u.villages?.name ?? '').toLowerCase().includes(query.toLowerCase());
      const isBanned = u.is_verified === false;
      if (tab === 'active')  return matchQ && !isBanned;
      if (tab === 'banned')  return matchQ && isBanned;
      return matchQ;
    });
  }, [users, query, tab]);

  const handleBan = async (userId, reason) => {
    setActing(userId);
    const { error: err } = await AdminAPI.banUser(userId, reason);
    if (!err) refetch();
    setActing(null);
  };

  const handleUnban = async (userId) => {
    setActing(userId);
    const { error: err } = await AdminAPI.unbanUser(userId);
    if (!err) refetch();
    setActing(null);
  };

  return (
    <div className="flex-1 overflow-auto pb-10">
      <AppHeader
        title="Users"
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
          <StatCard title="Total"  value={totalCount}  icon={Users} />
          <StatCard title="Active" value={activeCount} icon={ShieldCheck} accent />
          <StatCard title="Banned" value={bannedCount} icon={ShieldOff} />
        </div>

        {/* Filters row */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Name, phone or village…"
              className="pl-9"
              value={query}
              onChange={e => { setQuery(e.target.value); setPage(0); }}
            />
          </div>
          <Select value={roleFil} onValueChange={v => { setRoleFil(v); setPage(0); }}>
            <SelectTrigger className="w-36 text-xs">
              <SelectValue placeholder="All roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All roles</SelectItem>
              <SelectItem value="customer">Customers</SelectItem>
              <SelectItem value="vendor">Vendors</SelectItem>
              <SelectItem value="rider">Riders</SelectItem>
              <SelectItem value="seva_provider">Seva Providers</SelectItem>
              <SelectItem value="anchor">Anchors</SelectItem>
              <SelectItem value="admin">Admins</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Status tabs */}
        <Tabs value={tab} onValueChange={v => { setTab(v); setPage(0); }}>
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="all"    className="text-xs">All ({totalCount})</TabsTrigger>
            <TabsTrigger value="active" className="text-xs">Active ({activeCount})</TabsTrigger>
            <TabsTrigger value="banned" className="text-xs">Banned ({bannedCount})</TabsTrigger>
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
            <p className="text-sm text-muted-foreground">No users match your filters</p>
          </Card>
        )}

        {/* List */}
        <div className="space-y-2">
          {filtered.map(u => {
            const isBanned = u.is_verified === false;
            return (
              <Card
                key={u.id}
                className="p-4 border-border cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => setSelected(u)}
              >
                <div className="flex items-start justify-between mb-1">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold">{u.name ?? 'Unknown'}</p>
                      <Badge className={`text-[9px] border-0 ${ROLE_COLORS[u.role] ?? 'bg-muted'}`}>
                        {u.role}
                      </Badge>
                      {isBanned && (
                        <Badge className="text-[9px] border-0 bg-red-100 text-red-700">Banned</Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-xs text-muted-foreground">
                      {u.phone && (
                        <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{u.phone}</span>
                      )}
                      {u.villages?.name && (
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{u.villages.name}</span>
                      )}
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Joined {fmtDate(u.created_at)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground">Score: {u.setu_score ?? 0}</span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Pagination */}
        {!isLoading && (users.length === LIMIT || page > 0) && (
          <div className="flex gap-2">
            {page > 0 && (
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setPage(p => p - 1)}>
                ← Previous
              </Button>
            )}
            {users.length === LIMIT && (
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setPage(p => p + 1)}>
                Load more →
              </Button>
            )}
          </div>
        )}
      </div>

      {selected && (
        <UserDetailModal
          user={selected}
          onClose={() => setSelected(null)}
          onBan={handleBan}
          onUnban={handleUnban}
        />
      )}
    </div>
  );
}
