// ═══════════════════════════════════════════════════════════
// SETU — AdminAuditLog  (new)
// Shows every admin action logged in audit_log table.
// Searchable, filterable, paginated.
// Route: /admin/audit-log
// ═══════════════════════════════════════════════════════════
import React, { useState } from 'react';
import {
  ClipboardList, Search, RefreshCw, ChevronDown,
  User, Shield, ShoppingBag, UserX, UserCheck,
  Key, Megaphone, FileCheck,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import AppHeader from '@/components/shared/AppHeader';
import { useDataFetch } from '@/hooks/useDataFetch';
import { AdminAPI } from '@/lib/api';

const ACTION_ICONS = {
  ban_user:        UserX,
  unban_user:      UserCheck,
  assign_role:     Key,
  approve_vendor:  Shield,
  reject_vendor:   Shield,
  suspend_vendor:  Shield,
  unsuspend_vendor:Shield,
  verify_rider:    ShoppingBag,
  broadcast:       Megaphone,
  review_kyc:      FileCheck,
};

const ACTION_COLORS = {
  ban_user:         'bg-red-100 text-red-700',
  unban_user:       'bg-green-100 text-green-700',
  assign_role:      'bg-blue-100 text-blue-700',
  approve_vendor:   'bg-green-100 text-green-700',
  reject_vendor:    'bg-red-100 text-red-700',
  suspend_vendor:   'bg-amber-100 text-amber-700',
  unsuspend_vendor: 'bg-green-100 text-green-700',
  verify_rider:     'bg-blue-100 text-blue-700',
  broadcast:        'bg-purple-100 text-purple-700',
  review_kyc:       'bg-teal-100 text-teal-700',
};

const ACTION_OPTIONS = [
  { value: '', label: 'All actions' },
  { value: 'ban_user',         label: 'Ban user' },
  { value: 'unban_user',       label: 'Unban user' },
  { value: 'assign_role',      label: 'Role change' },
  { value: 'approve_vendor',   label: 'Approve vendor' },
  { value: 'reject_vendor',    label: 'Reject vendor' },
  { value: 'suspend_vendor',   label: 'Suspend vendor' },
  { value: 'verify_rider',     label: 'Verify rider' },
];

function fmtTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

export default function AdminAuditLog() {
  const [page,       setPage]       = useState(0);
  const [query,      setQuery]      = useState('');
  const [actionFil,  setActionFil]  = useState('');
  const LIMIT = 50;

  const { data, isLoading, error, refetch } = useDataFetch(
    () => AdminAPI.getAuditLog({ page, limit: LIMIT, action: actionFil || undefined }),
    [page, actionFil],
    { cacheKey: `audit-log-p${page}-a${actionFil}`, staleTime: 30_000 }
  );

  const rows = (data ?? []).filter(r => {
    if (!query) return true;
    return (
      (r.action    ?? '').includes(query.toLowerCase()) ||
      (r.actor     ?? '').toLowerCase().includes(query.toLowerCase()) ||
      (r.target    ?? '').includes(query) ||
      (r.detail    ?? '').toLowerCase().includes(query.toLowerCase()) ||
      (r.profiles?.name ?? '').toLowerCase().includes(query.toLowerCase())
    );
  });

  return (
    <div className="flex-1 overflow-auto pb-10">
      <AppHeader
        title="Audit Log"
        subtitle="Every admin action, permanently recorded"
        rightAction={
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={refetch}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        }
      />

      <div className="p-4 space-y-4 max-w-3xl">

        {/* Filters */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by actor, action, target…"
              className="pl-9"
              value={query}
              onChange={e => { setQuery(e.target.value); setPage(0); }}
            />
          </div>
          <Select value={actionFil} onValueChange={v => { setActionFil(v); setPage(0); }}>
            <SelectTrigger className="w-40 text-xs">
              <SelectValue placeholder="All actions" />
            </SelectTrigger>
            <SelectContent>
              {ACTION_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Error */}
        {error && (
          <Card className="p-4 border-destructive/30 bg-destructive/5">
            <p className="text-sm text-destructive">{error.message}</p>
            <Button size="sm" variant="outline" className="mt-2" onClick={refetch}>Retry</Button>
          </Card>
        )}

        {/* Loading skeleton */}
        {isLoading && (
          <div className="space-y-2">
            {[1,2,3,4,5].map(i => <div key={i} className="h-14 bg-muted rounded-xl animate-pulse" />)}
          </div>
        )}

        {/* Empty */}
        {!isLoading && !error && rows.length === 0 && (
          <Card className="p-8 border-dashed text-center">
            <ClipboardList className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No audit records found</p>
          </Card>
        )}

        {/* Log rows */}
        {!isLoading && (
          <div className="space-y-2">
            {rows.map(r => {
              const Icon  = ACTION_ICONS[r.action] ?? Shield;
              const color = ACTION_COLORS[r.action] ?? 'bg-muted text-muted-foreground';
              return (
                <Card key={r.id} className="p-3 border-border flex items-start gap-3">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={`text-[9px] border-0 ${color}`}>
                        {r.action}
                      </Badge>
                      <span className="text-xs font-medium">
                        {r.profiles?.name ?? r.actor ?? 'system'}
                      </span>
                      {r.profiles?.role && (
                        <span className="text-[10px] text-muted-foreground">
                          ({r.profiles.role})
                        </span>
                      )}
                    </div>
                    {r.target && (
                      <p className="text-xs text-muted-foreground mt-0.5 font-mono truncate">
                        Target: {r.target}
                      </p>
                    )}
                    {r.detail && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {r.detail}
                      </p>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground shrink-0">
                    {fmtTime(r.created_at)}
                  </p>
                </Card>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {!isLoading && (rows.length === LIMIT || page > 0) && (
          <div className="flex gap-2">
            {page > 0 && (
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setPage(p => p - 1)}>
                ← Previous
              </Button>
            )}
            {rows.length === LIMIT && (
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setPage(p => p + 1)}>
                Next →
              </Button>
            )}
          </div>
        )}

        <p className="text-xs text-muted-foreground text-center">
          All admin actions are permanently logged and cannot be deleted.
        </p>
      </div>
    </div>
  );
}
