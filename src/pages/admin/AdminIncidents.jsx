// ═══════════════════════════════════════════════════════════
// SETU — AdminIncidents  (v2 — Live DB)
// Operational incident triage backed by REAL disputes data
// (AdminAPI.getDisputes). Active disputes are surfaced as incidents,
// severity-ranked by type/status. Resolution happens on the Disputes
// screen (linked), so this view stays a focused, read-only triage board.
// Route: /admin/incidents
// ═══════════════════════════════════════════════════════════
import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle, Clock, Search, ArrowUpCircle, RefreshCw, Scale } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppHeader from '@/components/shared/AppHeader';
import { useDataFetch } from '@/hooks/useDataFetch';
import { AdminAPI } from '@/lib/api';

// Map a dispute (type + status) to an incident severity.
const TYPE_SEVERITY = { fraud: 'critical', payment: 'high', quality: 'high', delivery: 'medium', order: 'medium', other: 'low' };
function severityOf(d) {
  if (d.status === 'escalated') return 'critical';
  return TYPE_SEVERITY[d.type] ?? 'low';
}

const severityStyle = {
  critical: 'bg-red-600 text-white',
  high:     'bg-red-100 text-red-700',
  medium:   'bg-amber-100 text-amber-700',
  low:      'bg-green-100 text-green-700',
};
const statusStyle = {
  open:          'bg-red-100 text-red-700',
  under_review:  'bg-amber-100 text-amber-700',
  escalated:     'bg-blue-100 text-blue-700',
  resolved:      'bg-green-100 text-green-700',
  closed:        'bg-muted text-muted-foreground',
};
const StatusIcon = {
  open:          AlertTriangle,
  under_review:  Clock,
  escalated:     ArrowUpCircle,
  resolved:      CheckCircle,
  closed:        CheckCircle,
};
const SEVERITY_RANK = { critical: 0, high: 1, medium: 2, low: 3 };

function relTime(iso) {
  if (!iso) return '';
  const diff = Math.floor((Date.now() - new Date(iso)) / 60000);
  if (diff < 60)   return `${diff}m ago`;
  if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
  return `${Math.floor(diff / 1440)}d ago`;
}

export default function AdminIncidents() {
  const [tab, setTab]     = useState('active');
  const [query, setQuery] = useState('');

  const { data, isLoading, error, refetch } = useDataFetch(
    () => AdminAPI.getDisputes({}),
    [],
    { cacheKey: 'admin-incidents', staleTime: 20_000 }
  );

  const incidents = useMemo(() => {
    return (data ?? []).map(d => ({
      id:          d.id,
      title:       d.description?.split('\n')[0]?.slice(0, 80) || `${(d.type ?? 'other')} dispute`,
      type:        d.type ?? 'other',
      severity:    severityOf(d),
      status:      d.status,
      reporter:    d.profiles?.name ?? 'Unknown',
      time:        relTime(d.created_at),
      description: d.description ?? '',
      order:       d.orders?.order_number ?? null,
    })).sort((a, b) => (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9));
  }, [data]);

  const counts = {
    open:         incidents.filter(i => i.status === 'open').length,
    under_review: incidents.filter(i => i.status === 'under_review').length,
    escalated:    incidents.filter(i => i.status === 'escalated').length,
    resolved:     incidents.filter(i => i.status === 'resolved' || i.status === 'closed').length,
  };

  const filtered = incidents.filter(i => {
    const matchTab =
      tab === 'all' ? true :
      tab === 'active' ? !['resolved', 'closed'].includes(i.status) :
      tab === 'resolved' ? ['resolved', 'closed'].includes(i.status) :
      i.status === tab;
    const matchQuery = !query
      || i.title.toLowerCase().includes(query.toLowerCase())
      || i.reporter.toLowerCase().includes(query.toLowerCase());
    return matchTab && matchQuery;
  });

  return (
    <div className="flex-1 overflow-auto pb-6">
      <AppHeader
        title="Incident Management"
        subtitle="Active disputes triaged by severity"
        rightAction={
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={refetch} aria-label="Refresh incidents">
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        }
      />
      <div className="p-4 space-y-4 max-w-3xl">

        {/* Summary row */}
        <div className="grid grid-cols-4 gap-2 text-center">
          {[
            { label: 'Open',      val: counts.open,         color: 'text-red-500' },
            { label: 'In Review', val: counts.under_review, color: 'text-amber-500' },
            { label: 'Escalated', val: counts.escalated,    color: 'text-blue-500' },
            { label: 'Resolved',  val: counts.resolved,     color: 'text-green-500' },
          ].map(s => (
            <Card key={s.label} className="p-2 border-border">
              <p className={`text-lg font-bold ${s.color}`}>{isLoading ? '…' : s.val}</p>
              <p className="text-[9px] text-muted-foreground">{s.label}</p>
            </Card>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search incidents…"
            className="pl-9"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full grid grid-cols-4">
            {['active', 'escalated', 'resolved', 'all'].map(t => (
              <TabsTrigger key={t} value={t} className="text-xs capitalize">{t}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Error */}
        {error && (
          <Card className="p-3 border-destructive/20 bg-destructive/5">
            <p className="text-xs text-destructive">{error.message ?? 'Failed to load incidents.'}</p>
            <Button size="sm" variant="outline" className="mt-2" onClick={refetch}>Retry</Button>
          </Card>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="space-y-2 animate-pulse">
            {[1,2,3].map(i => <div key={i} className="h-24 bg-muted rounded-xl" />)}
          </div>
        )}

        {/* List */}
        {!isLoading && !error && (
          <div className="space-y-2">
            {filtered.length === 0 ? (
              <Card className="p-6 border-border text-center">
                <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No incidents in this category</p>
              </Card>
            ) : (
              filtered.map(inc => {
                const Icon = StatusIcon[inc.status] ?? AlertTriangle;
                return (
                  <Card key={inc.id} className="p-4 border-border">
                    <div className="flex items-start justify-between mb-1 gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{inc.title}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {inc.reporter} · {inc.time}{inc.order ? ` · ${inc.order}` : ''}
                        </p>
                      </div>
                      <Badge className={`text-[9px] shrink-0 border-0 ${severityStyle[inc.severity]}`}>
                        {inc.severity}
                      </Badge>
                    </div>
                    {inc.description && (
                      <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{inc.description}</p>
                    )}
                    <div className="flex items-center justify-between">
                      <Badge className={`text-[9px] border-0 flex items-center gap-1 ${statusStyle[inc.status] ?? ''}`}>
                        <Icon className="w-3 h-3" />
                        {inc.status?.replace('_', ' ')}
                      </Badge>
                      {!['resolved', 'closed'].includes(inc.status) && (
                        <Link to="/admin/disputes">
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                            <Scale className="w-3 h-3" /> Resolve in Disputes
                          </Button>
                        </Link>
                      )}
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
