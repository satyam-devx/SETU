// ═══════════════════════════════════════════════════════════
// SETU — SuperAdminAuditLog  (v2 — Live DB)
// Fixed: reads from real audit_log table via AdminAPI.getAuditLog
// ═══════════════════════════════════════════════════════════
import React, { useState } from 'react';
import { Search, Download, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import AppHeader from '@/components/shared/AppHeader';
import { useDataFetch } from '@/hooks/useDataFetch';
import { AdminAPI } from '@/lib/api';

const ACTION_STYLE = {
  vendor_approved:   'bg-green-100 text-green-700',
  vendor_rejected:   'bg-red-100 text-red-700',
  vendor_suspended:  'bg-amber-100 text-amber-700',
  credit_issued:     'bg-blue-100 text-blue-700',
  ban_user:          'bg-red-100 text-red-700',
  unban_user:        'bg-green-100 text-green-700',
  assign_role:       'bg-purple-100 text-purple-700',
  config_updated:    'bg-purple-100 text-purple-700',
  review_kyc:        'bg-blue-100 text-blue-700',
  order_cancelled:   'bg-gray-100 text-gray-700',
  security_migration:'bg-amber-100 text-amber-700',
};

function relTime(iso) {
  if (!iso) return '';
  const diff = Math.floor((Date.now() - new Date(iso)) / 60000);
  if (diff < 60)   return `${diff}m ago`;
  if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function SuperAdminAuditLog() {
  const [query,     setQuery]     = useState('');
  const [actionFil, setActionFil] = useState('all');
  const [page,      setPage]      = useState(0);
  const LIMIT = 50;

  const { data, isLoading, error, refetch } = useDataFetch(
    () => AdminAPI.getAuditLog({ page, limit: LIMIT, action: actionFil === 'all' ? undefined : actionFil }),
    [page, actionFil],
    { cacheKey: `superadmin-audit-${page}-${actionFil}`, staleTime: 15_000 }
  );

  const allLogs = data ?? [];

  const filtered = allLogs.filter(log =>
    !query ||
    (log.action  ?? '').toLowerCase().includes(query.toLowerCase()) ||
    (log.actor   ?? '').toLowerCase().includes(query.toLowerCase()) ||
    (log.target  ?? '').toLowerCase().includes(query.toLowerCase()) ||
    (log.profiles?.name ?? '').toLowerCase().includes(query.toLowerCase())
  );

  const uniqueActions = [...new Set(allLogs.map(l => l.action).filter(Boolean))].sort();

  const handleExport = () => {
    const csv = [
      'Time,Action,Actor,Target,Detail',
      ...filtered.map(l => [
        new Date(l.created_at).toISOString(),
        l.action ?? '',
        l.profiles?.name ?? l.actor ?? '',
        l.target ?? '',
        (l.detail ?? '').replace(/,/g, ';'),
      ].join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'audit-log.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 overflow-auto pb-10">
      <AppHeader
        title="Audit Log"
        subtitle={isLoading ? 'Loading…' : `${filtered.length} events`}
        rightAction={
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={refetch} aria-label="Refresh audit log">
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        }
      />

      <div className="p-4 space-y-3 max-w-3xl">
        {/* Filters */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search actions, actors, targets…"
              className="pl-9"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
          <Select value={actionFil} onValueChange={v => { setActionFil(v); setPage(0); }}>
            <SelectTrigger className="w-40 text-xs">
              <SelectValue placeholder="All actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              {uniqueActions.map(a => (
                <SelectItem key={a} value={a} className="text-xs capitalize">
                  {a.replace(/_/g, ' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={handleExport} title="Export CSV" aria-label="Export audit log as CSV">
            <Download className="w-4 h-4" />
          </Button>
        </div>

        {/* Error */}
        {error && (
          <Card className="p-3 border-destructive/20 bg-destructive/5">
            <p className="text-xs text-destructive">{error.message}</p>
            <Button size="sm" variant="outline" className="mt-2" onClick={refetch}>Retry</Button>
          </Card>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="space-y-2 animate-pulse">
            {[1,2,3,4,5].map(i => <div key={i} className="h-16 bg-muted rounded-xl" />)}
          </div>
        )}

        {/* Empty */}
        {!isLoading && !error && filtered.length === 0 && (
          <Card className="p-6 border-border text-center">
            <p className="text-sm text-muted-foreground">
              {allLogs.length === 0 ? 'No audit events yet' : 'No events match your search'}
            </p>
          </Card>
        )}

        {/* Log entries */}
        <div className="space-y-2">
          {filtered.map((log, i) => (
            <Card key={log.id ?? i} className="p-3 border-border">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <Badge className={`text-[9px] border-0 ${ACTION_STYLE[log.action] ?? 'bg-gray-100 text-gray-700'}`}>
                      {(log.action ?? 'event').replace(/_/g, ' ')}
                    </Badge>
                    {log.target && (
                      <span className="text-xs font-medium truncate">{log.target}</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    by <span className="font-medium text-foreground">
                      {log.profiles?.name ?? log.actor ?? 'system'}
                    </span>
                    {log.detail ? ` · ${log.detail}` : ''}
                  </p>
                </div>
                <p className="text-[10px] text-muted-foreground shrink-0 text-right whitespace-nowrap">
                  {relTime(log.created_at)}
                </p>
              </div>
            </Card>
          ))}
        </div>

        {/* Pagination */}
        {!isLoading && (allLogs.length === LIMIT || page > 0) && (
          <div className="flex gap-2">
            {page > 0 && (
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setPage(p => p - 1)}>
                ← Previous
              </Button>
            )}
            {allLogs.length === LIMIT && (
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setPage(p => p + 1)}>
                Load more →
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
