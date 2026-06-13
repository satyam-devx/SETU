// ═══════════════════════════════════════════════════════════
// SETU — SuperAdminSecurity  (v2 — Live DB)
// Fixed: reads real banned users + audit events; block/clear
// actions write to DB via AdminAPI.banUser / unbanUser.
// Fraud scoring is not yet implemented in DB — that section
// shows real banned user list as the actionable security view.
// ═══════════════════════════════════════════════════════════
import React, { useState, useCallback } from 'react';
import {
  Shield, AlertTriangle, Ban, CheckCircle, Search,
  RefreshCw, Loader2, ShieldCheck, ShieldOff, User,
  Phone, MapPin,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
};

export default function SuperAdminSecurity() {
  const [tab,      setTab]      = useState('banned');
  const [query,    setQuery]    = useState('');
  const [acting,   setActing]   = useState(null);
  const [banModal, setBanModal] = useState(null);
  const [banReason,setBanReason]= useState('');

  // Load all users filtered by tab
  const { data, isLoading, error, refetch } = useDataFetch(
    () => AdminAPI.getUsers({ limit: 200 }),
    [],
    { cacheKey: 'security-users', staleTime: 20_000 }
  );

  // Load recent audit log for security events
  const { data: auditData } = useDataFetch(
    () => AdminAPI.getAuditLog({ limit: 20 }),
    [],
    { cacheKey: 'security-audit', staleTime: 30_000 }
  );

  const allUsers   = data ?? [];
  const bannedUsers = allUsers.filter(u => u.is_verified === false);
  const activeUsers = allUsers.filter(u => u.is_verified !== false);

  // Security-relevant audit events
  const securityEvents = (auditData ?? []).filter(e =>
    ['ban_user', 'unban_user', 'assign_role', 'vendor_suspended', 'review_kyc'].includes(e.action)
  );

  const displayed = tab === 'banned' ? bannedUsers : tab === 'events' ? [] : activeUsers;

  const filtered = displayed.filter(u => {
    if (!query) return true;
    return (
      (u.name ?? '').toLowerCase().includes(query.toLowerCase()) ||
      (u.phone ?? '').includes(query) ||
      (u.role  ?? '').includes(query)
    );
  });

  const handleUnban = async (userId) => {
    setActing(userId);
    await AdminAPI.unbanUser(userId);
    refetch();
    setActing(null);
  };

  const handleBan = async () => {
    if (!banModal) return;
    setActing(banModal.id);
    await AdminAPI.banUser(banModal.id, banReason || null);
    refetch();
    setBanModal(null);
    setBanReason('');
    setActing(null);
  };

  return (
    <div className="flex-1 overflow-auto pb-10">
      <AppHeader
        title="Fraud & Security"
        subtitle="User bans, security events, audit trail"
        rightAction={
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={refetch}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        }
      />

      <div className="p-4 space-y-4 max-w-3xl">

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2">
          <StatCard title="Banned Users"    value={isLoading ? '…' : String(bannedUsers.length)}  icon={Ban}        />
          <StatCard title="Security Events" value={isLoading ? '…' : String(securityEvents.length)} icon={Shield} />
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="banned" className="text-xs">
              Banned ({isLoading ? '…' : bannedUsers.length})
            </TabsTrigger>
            <TabsTrigger value="active" className="text-xs">
              Active Users
            </TabsTrigger>
            <TabsTrigger value="events" className="text-xs">
              Security Events
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Search (for users tabs) */}
        {tab !== 'events' && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, phone or role…"
              className="pl-9"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
        )}

        {error && (
          <Card className="p-3 border-destructive/20 bg-destructive/5">
            <p className="text-xs text-destructive">{error.message}</p>
            <Button size="sm" variant="outline" className="mt-2" onClick={refetch}>Retry</Button>
          </Card>
        )}

        {/* Security Events tab */}
        {tab === 'events' && (
          <div className="space-y-2">
            {securityEvents.length === 0 ? (
              <Card className="p-6 border-border text-center">
                <Shield className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No security events recorded yet</p>
              </Card>
            ) : securityEvents.map((e, i) => (
              <Card key={e.id ?? i} className="p-3 border-border">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Badge className="text-[9px] border-0 bg-amber-100 text-amber-700 mb-1 capitalize">
                      {(e.action ?? '').replace(/_/g, ' ')}
                    </Badge>
                    <p className="text-xs">
                      Target: <span className="font-medium">{e.target ?? '—'}</span>
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      by {e.profiles?.name ?? e.actor ?? 'system'}
                      {e.detail ? ` · ${e.detail}` : ''}
                    </p>
                  </div>
                  <p className="text-[10px] text-muted-foreground shrink-0">
                    {new Date(e.created_at).toLocaleDateString('en-IN', { dateStyle: 'short' })}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Users list */}
        {tab !== 'events' && (
          <>
            {isLoading && (
              <div className="space-y-2 animate-pulse">
                {[1,2,3].map(i => <div key={i} className="h-20 bg-muted rounded-xl" />)}
              </div>
            )}

            {!isLoading && filtered.length === 0 && (
              <Card className="p-6 border-border text-center">
                <Shield className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  {tab === 'banned' ? 'No banned users — platform is clean' : 'No users match your search'}
                </p>
              </Card>
            )}

            <div className="space-y-2">
              {filtered.map(u => {
                const isBanned = u.is_verified === false;
                return (
                  <Card key={u.id} className="p-3 border-border">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                          <User className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium">{u.name ?? 'Unknown'}</p>
                            <Badge className={`text-[9px] border-0 ${ROLE_COLORS[u.role] ?? 'bg-muted'}`}>
                              {u.role}
                            </Badge>
                            {isBanned && (
                              <Badge className="text-[9px] border-0 bg-red-100 text-red-700">Banned</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                            {u.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{u.phone}</span>}
                            {u.villages?.name && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{u.villages.name}</span>}
                            <span>Joined {fmtDate(u.created_at)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {isBanned ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1 text-green-600 border-green-200"
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
                            className="h-7 text-xs gap-1 text-destructive border-destructive/30"
                            disabled={acting === u.id}
                            onClick={() => { setBanModal(u); setBanReason(''); }}
                          >
                            <ShieldOff className="w-3 h-3" /> Ban
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Ban modal */}
      <Dialog open={!!banModal} onOpenChange={v => !v && setBanModal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Ban User</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <p className="text-sm text-muted-foreground">
              Banning <span className="font-semibold text-foreground">{banModal?.name}</span> will
              prevent them from accessing the platform. This is logged to the audit trail.
            </p>
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
