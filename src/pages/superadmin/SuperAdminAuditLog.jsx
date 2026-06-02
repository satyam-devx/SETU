import React, { useState } from 'react';
import { Search, Filter, Shield, User, Settings, AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AppHeader from '@/components/shared/AppHeader';

const logs = [
  { id: 1, action: 'Vendor Suspended', actor: 'Admin Ravi', target: 'Suresh Store', type: 'admin', time: '2 min ago', severity: 'high' },
  { id: 2, action: 'Credit Limit Updated', actor: 'Admin Priya', target: 'Meera Devi (Customer)', type: 'config', time: '15 min ago', severity: 'medium' },
  { id: 3, action: 'Fraud Flag Raised', actor: 'System', target: 'Order #1028', type: 'security', time: '1 hr ago', severity: 'high' },
  { id: 4, action: 'Rider Onboarded', actor: 'Admin Ravi', target: 'Deepak Singh', type: 'admin', time: '2 hr ago', severity: 'low' },
  { id: 5, action: 'Platform Fee Changed', actor: 'Super Admin', target: 'Global Config', type: 'config', time: '3 hr ago', severity: 'medium' },
  { id: 6, action: 'Block Added', actor: 'Super Admin', target: 'IP 192.168.1.45', type: 'security', time: '5 hr ago', severity: 'high' },
  { id: 7, action: 'Village Anchor Assigned', actor: 'Admin Priya', target: 'Bhojpur Village', type: 'admin', time: '1 day ago', severity: 'low' },
];

const severityColor = { high: 'bg-red-100 text-red-700', medium: 'bg-amber-100 text-amber-700', low: 'bg-green-100 text-green-700' };
const typeIcon = { admin: User, config: Settings, security: Shield };

export default function SuperAdminAuditLog() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  const filtered = logs.filter(l => {
    const matchSearch = l.action.toLowerCase().includes(search.toLowerCase()) || l.actor.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === 'all' || l.type === typeFilter;
    return matchSearch && matchType;
  });

  return (
    <div className="pb-6">
      <AppHeader title="Audit Log" subtitle="All platform actions" />
      <div className="p-4 space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search actions..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-32">
              <Filter className="w-4 h-4 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="config">Config</SelectItem>
              <SelectItem value="security">Security</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          {filtered.map(log => {
            const Icon = typeIcon[log.type] || AlertTriangle;
            return (
              <Card key={log.id} className="p-3 border-border">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold truncate">{log.action}</p>
                      <Badge className={`text-[10px] shrink-0 ${severityColor[log.severity]}`}>{log.severity}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">by <span className="text-foreground">{log.actor}</span> · {log.target}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{log.time}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
