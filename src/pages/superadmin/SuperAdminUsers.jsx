// ═══════════════════════════════════════════════════════════
// SETU — SuperAdminUsers
// Cross-platform user management for Super Admin.
// Features: search all users, filter by role,
// assign/change role via security-definer RPC,
// ban/unban, view profile details.
// Route: /superadmin/users
// ═══════════════════════════════════════════════════════════
import React, { useState, useMemo } from 'react';
import {
  Search, Users, ShieldCheck, ShieldOff, RefreshCw,
  Loader2, UserCog, ChevronDown, Phone, MapPin, Calendar,
  Crown, Bike, Store, Wrench, Anchor, User, AlertCircle
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import AppHeader from '@/components/shared/AppHeader';
import StatCard from '@/components/shared/StatCard';
import { useDataFetch } from '@/hooks/useDataFetch';
import { AdminAPI } from '@/lib/api';

const ROLES = [
  { value: 'customer',       label: 'Customer',       icon: User,         color: 'text-blue-600'   },
  { value: 'vendor',         label: 'Vendor',         icon: Store,        color: 'text-orange-600' },
  { value: 'rider',          label: 'Rider',          icon: Bike,         color: 'text-green-600'  },
  { value: 'seva_provider',  label: 'Seva Provider',  icon: Wrench,       color: 'text-purple-600' },
  { value: 'anchor',         label: 'Village Anchor', icon: Anchor,       color: 'text-teal-600'   },
  { value: 'admin',          label: 'Admin',          icon: ShieldCheck,  color: 'text-red-600'    },
  { value: 'super_admin',    label: 'Super Admin',    icon: Crown,        color: 'text-yellow-600' },
];

const ROLE_BADGE_COLOR = {
  customer:      'bg-blue-100 text-blue-700',
  vendor:        'bg-orange-100 text-orange-700',
  rider:         'bg-green-100 text-green-700',
  seva_provider: 'bg-purple-100 text-purple-700',
  anchor:        'bg-teal-100 text-teal-700',
  admin:         'bg-red-100 text-red-700',
  super_admin:   'bg-yellow-100 text-yellow-700',
};

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });
}

export default function SuperAdminUsers() {
  const [roleFil,    setRoleFil]    = useState('all');
  const [query,      setQuery]      = useState('');
  const [page,       setPage]       = useState(0);
  const [selected,   setSelected]   = useState(null);  // user for detail modal
  const [roleModal,  setRoleModal]  = useState(null);  // user for role change
  const [newRole,    setNewRole]    = useState('');
  const [banModal,   setBanModal]   = useState(null);
  const [banReason,  setBanReason]  = useState('');
  const [acting,     setActing]     = useState(null);
  const [actionErr,  setActionErr]  = useState(null);
  const LIMIT = 100;

  const { data, isLoading, error, refetch } = useDataFetch(
    () => AdminAPI.getUsers({ role: roleFil === 'all' ? undefined : roleFil, page, limit: LIMIT }),
    [roleFil, page],
    { cacheKey: `superadmin-users-${roleFil}-${page}`, staleTime: 20_000 }
  );

  const users = data ?? [];

  const filtered = useMemo(() => {
    if (!query) return users;
    return users.filter(u =>
      (u.name ?? '').toLowerCase().includes(query.toLowerCase()) ||
      (u.phone ?? '').includes(query) ||
      (u.villages?.name ?? '').toLowerCase().includes(query.toLowerCase())
    );
  }, [users, query]);

  // Role counts
  const roleCounts = useMemo(() => {
    return users.reduce((acc, u) => {
      acc[u.role] = (acc[u.role] ?? 0) + 1;
      return acc;
    }, {});
  }, [users]);

  const handleRoleChange = async () => {
    if (!roleModal || !newRole) return;
    setActing(roleModal.id);
    setActionErr(null);
    const { error: err } = await AdminAPI.assignRole(roleModal.id, newRole);
    if (err) { setActionErr(err.message ?? 'Role change failed'); }
    else { refetch(); setRoleModal(null); }
    setActing(null);
  };

  const handleBan = async () => {
    if (!banModal) return;
    setActing(banModal.id);
    setActionErr(null);
    const { error: err } = await AdminAPI.banUser(banModal.id, banReason || null);
    if (err) { setActionErr(err.message ?? 'Ban failed'); }
    else { refetch(); setBanModal(null); setBanReason(''); }
    setActing(null);
  };

  const handleUnban = async (user) => {
    setActing(user.id);
    await AdminAPI.unbanUser(user.id);
    refetch();
    setActing(null);
  };

  return (
    <div className="flex-1 overflow-auto pb-10">
      <AppHeader
        title="Users"
        subtitle="All platform users across every role"
        rightAction={
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={refetch}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        }
      />

      <div className="p-5 space-y-5 max-w-5xl">

        {/* Role stats */}
        <div className="grid grid-cols-4 gap-2">
          {ROLES.slice(0, 4).map(r => (
            <StatCard
              key={r.value}
              title={r.label}
              value={roleCounts[r.value] ?? 0}
              icon={r.icon}
            />
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, phone, or village…"
              className="pl-9 h-9"
              value={query}
              onChange={e => { setQuery(e.target.value); setPage(0); }}
            />
          </div>
          <Select value={roleFil} onValueChange={v => { setRoleFil(v); setPage(0); }}>
            <SelectTrigger className="w-44 h-9 text-xs">
              <SelectValue placeholder="All roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              {ROLES.map(r => (
                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Error */}
        {error && (
          <Card className="p-4 border-destructive/30 bg-destructive/5">
            <p className="text-sm text-destructive">{error.message}</p>
          </Card>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="space-y-2">
            {[1,2,3,4,5].map(i => <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />)}
          </div>
        )}

        {/* User list */}
        {!isLoading && (
          <Card className="border-border overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-2 bg-muted/40 border-b border-border text-xs font-medium text-muted-foreground">
              <span className="flex-1">User</span>
              <span className="w-28">Role</span>
              <span className="w-28 hidden sm:block">Joined</span>
              <span className="w-20">Status</span>
              <span className="w-28 text-right">Actions</span>
            </div>

            <div className="divide-y divide-border">
              {filtered.length === 0 ? (
                <div className="p-8 text-center">
                  <Users className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No users match your filters</p>
                </div>
              ) : filtered.map(u => {
                const RoleIcon = ROLES.find(r => r.value === u.role)?.icon ?? User;
                const isBanned = u.is_verified === false;

                return (
                  <div key={u.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors">
                    {/* Avatar + name */}
                    <div className="flex-1 min-w-0 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <RoleIcon className="w-4 h-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{u.name ?? 'No name'}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {u.phone ?? '—'} {u.villages?.name ? `· ${u.villages.name}` : ''}
                        </p>
                      </div>
                    </div>

                    {/* Role */}
                    <div className="w-28">
                      <Badge className={`text-[9px] border-0 ${ROLE_BADGE_COLOR[u.role] ?? 'bg-muted text-muted-foreground'}`}>
                        {u.role}
                      </Badge>
                    </div>

                    {/* Joined */}
                    <div className="w-28 text-xs text-muted-foreground hidden sm:block">
                      {fmtDate(u.created_at)}
                    </div>

                    {/* Status */}
                    <div className="w-20">
                      <Badge className={`text-[9px] border-0 ${isBanned ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                        {isBanned ? 'Banned' : 'Active'}
                      </Badge>
                    </div>

                    {/* Actions */}
                    <div className="w-28 flex items-center justify-end gap-1">
                      {/* Change role */}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs gap-1"
                        onClick={() => { setRoleModal(u); setNewRole(u.role); setActionErr(null); }}
                      >
                        <UserCog className="w-3.5 h-3.5" />
                      </Button>
                      {/* Ban/unban */}
                      {isBanned ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs text-green-600"
                          disabled={acting === u.id}
                          onClick={() => handleUnban(u)}
                        >
                          {acting === u.id
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <ShieldCheck className="w-3.5 h-3.5" />}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs text-destructive"
                          disabled={acting === u.id}
                          onClick={() => { setBanModal(u); setBanReason(''); setActionErr(null); }}
                        >
                          <ShieldOff className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="px-4 py-2 bg-muted/20 border-t border-border text-xs text-muted-foreground">
              Showing {filtered.length} of {users.length} users loaded
            </div>
          </Card>
        )}

        {/* Pagination */}
        {!isLoading && users.length === LIMIT && (
          <Button variant="outline" className="w-full text-xs" onClick={() => setPage(p => p + 1)}>
            Load more
          </Button>
        )}
      </div>

      {/* ── Role change modal ─────────────────────────── */}
      <Dialog open={!!roleModal} onOpenChange={v => !v && setRoleModal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Change Role</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <p className="text-sm">
              Changing role for <span className="font-semibold">{roleModal?.name}</span>
            </p>

            {actionErr && (
              <div className="flex items-center gap-2 p-2.5 bg-destructive/10 rounded-lg text-xs text-destructive">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {actionErr}
              </div>
            )}

            <div>
              <Label className="text-xs mb-1 block">New Role</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role…" />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map(r => (
                    <SelectItem key={r.value} value={r.value}>
                      <span className="flex items-center gap-2">
                        <r.icon className={`w-3.5 h-3.5 ${r.color}`} />
                        {r.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {(newRole === 'admin' || newRole === 'super_admin') && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>Granting admin access gives full platform control. Only assign to trusted team members.</span>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setRoleModal(null)}>Cancel</Button>
              <Button
                className="flex-1 gap-2"
                disabled={acting === roleModal?.id || newRole === roleModal?.role}
                onClick={handleRoleChange}
              >
                {acting === roleModal?.id
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Saving…</>
                  : 'Confirm Change'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Ban modal ─────────────────────────────────── */}
      <Dialog open={!!banModal} onOpenChange={v => !v && setBanModal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Ban User</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <p className="text-sm text-muted-foreground">
              Banning <span className="font-semibold text-foreground">{banModal?.name}</span> will
              prevent them from using the platform. All actions are logged.
            </p>
            {actionErr && (
              <p className="text-xs text-destructive bg-destructive/10 p-2 rounded-lg">{actionErr}</p>
            )}
            <div>
              <Label className="text-xs mb-1 block">Reason (optional)</Label>
              <Textarea
                placeholder="Reason for ban…"
                className="h-20 text-sm"
                value={banReason}
                onChange={e => setBanReason(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setBanModal(null)}>Cancel</Button>
              <Button
                variant="destructive"
                className="flex-1 gap-2"
                disabled={acting === banModal?.id}
                onClick={handleBan}
              >
                {acting === banModal?.id
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <ShieldOff className="w-4 h-4" />}
                Confirm Ban
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
