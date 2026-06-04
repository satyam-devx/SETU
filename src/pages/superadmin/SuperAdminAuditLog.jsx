import React, { useState } from 'react';
import { Search, Download, Filter } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import AppHeader from '@/components/shared/AppHeader';
import { AUDIT_LOG } from '@/lib/mockData';
import { useStore } from '@/lib/store';

const ACTION_STYLE = {
  vendor_approved:  'bg-green-100 text-green-700',
  vendor_rejected:  'bg-red-100 text-red-700',
  credit_issued:    'bg-blue-100 text-blue-700',
  account_blocked:  'bg-red-100 text-red-700',
  config_updated:   'bg-purple-100 text-purple-700',
  rider_suspended:  'bg-amber-100 text-amber-700',
  order_cancelled:  'bg-gray-100 text-gray-700',
  user_created:     'bg-green-100 text-green-700',
};

export default function SuperAdminAuditLog() {
  const { state } = useStore();
  const [query, setQuery] = useState('');

  // Merge seed audit log with live order events
  const liveEvents = state.orders
    .filter(o => o.status === 'cancelled' && o.cancelReason)
    .map(o => ({
      id: `live_${o.id}`,
      action: 'order_cancelled',
      actor: 'Customer',
      target: o.orderNumber,
      detail: o.cancelReason,
      timestamp: o.cancelledAt || o.createdAt,
      ip: '—',
    }));

  const allLogs = [...liveEvents, ...AUDIT_LOG].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const filtered = allLogs.filter(log =>
    !query ||
    (log.action || '').toLowerCase().includes(query.toLowerCase()) ||
    (log.actor || '').toLowerCase().includes(query.toLowerCase()) ||
    (log.target || '').toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="flex-1 overflow-auto">
      <AppHeader title="Audit Log" subtitle={`${allLogs.length} events`} />
      <div className="p-4 space-y-3">

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search actions, actors..." className="pl-9" value={query} onChange={e => setQuery(e.target.value)} />
          </div>
          <Button variant="outline" size="icon"><Filter className="w-4 h-4" /></Button>
          <Button variant="outline" size="icon"><Download className="w-4 h-4" /></Button>
        </div>

        <div className="space-y-2">
          {filtered.map((log, i) => (
            <Card key={log.id || i} className="p-3 border-border">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <Badge className={`text-[9px] border-0 ${ACTION_STYLE[log.action] || 'bg-gray-100 text-gray-700'}`}>
                      {(log.action || 'event').replace(/_/g, ' ')}
                    </Badge>
                    <span className="text-xs font-medium truncate">{log.target}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    by <span className="font-medium text-foreground">{log.actor}</span>
                    {log.detail ? ` · ${log.detail}` : ''}
                  </p>
                  {log.ip && log.ip !== '—' && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">IP: {log.ip}</p>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground shrink-0 text-right">
                  {new Date(log.timestamp).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                </p>
              </div>
            </Card>
          ))}
          {filtered.length === 0 && (
            <Card className="p-6 border-border text-center">
              <p className="text-sm text-muted-foreground">No events match your search</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
