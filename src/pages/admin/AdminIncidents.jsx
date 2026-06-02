import React, { useState } from 'react';
import { AlertTriangle, CheckCircle, Clock, Search, ArrowUpCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppHeader from '@/components/shared/AppHeader';

const incidents = [
  {
    id: 'I-001',
    title: 'Fraud order suspected',
    category: 'fraud',
    severity: 'critical',
    status: 'open',
    reporter: 'System',
    time: '30 min ago',
    description: 'Multiple orders from same device ID with different accounts.',
  },
  {
    id: 'I-002',
    title: 'Vendor selling counterfeit goods',
    category: 'vendor',
    severity: 'high',
    status: 'investigating',
    reporter: 'Anchor Ramkali',
    time: '3 hr ago',
    description: 'Bihar Fish Market reported for selling stale products.',
  },
  {
    id: 'I-003',
    title: 'Rider harassment complaint',
    category: 'rider',
    severity: 'high',
    status: 'escalated',
    reporter: 'Customer Anita Devi',
    time: '1 day ago',
    description: 'Customer complained of disrespectful behaviour during delivery.',
  },
  {
    id: 'I-004',
    title: 'Payment gateway timeout',
    category: 'system',
    severity: 'medium',
    status: 'resolved',
    reporter: 'System',
    time: '2 days ago',
    description: 'UPI payment failures for 12 minutes during peak hour.',
  },
  {
    id: 'I-005',
    title: 'COD reconciliation discrepancy',
    category: 'cash',
    severity: 'medium',
    status: 'open',
    reporter: 'Admin User',
    time: '6 hr ago',
    description: '₹450 missing from Suraj Kumar\'s COD handover.',
  },
];

const severityStyle = {
  critical: 'bg-red-600 text-white',
  high:     'bg-red-100 text-red-700',
  medium:   'bg-amber-100 text-amber-700',
  low:      'bg-green-100 text-green-700',
};

const statusStyle = {
  open:          'bg-red-100 text-red-700',
  investigating: 'bg-amber-100 text-amber-700',
  escalated:     'bg-blue-100 text-blue-700',
  resolved:      'bg-green-100 text-green-700',
};

const StatusIcon = {
  open:          AlertTriangle,
  investigating: Clock,
  escalated:     ArrowUpCircle,
  resolved:      CheckCircle,
};

export default function AdminIncidents() {
  const [tab, setTab]     = useState('all');
  const [query, setQuery] = useState('');

  const filtered = incidents.filter(i => {
    const matchTab   = tab === 'all' || i.status === tab;
    const matchQuery = !query || i.title.toLowerCase().includes(query.toLowerCase()) || i.reporter.toLowerCase().includes(query.toLowerCase());
    return matchTab && matchQuery;
  });

  const counts = {
    open:          incidents.filter(i => i.status === 'open').length,
    investigating: incidents.filter(i => i.status === 'investigating').length,
    escalated:     incidents.filter(i => i.status === 'escalated').length,
    resolved:      incidents.filter(i => i.status === 'resolved').length,
  };

  return (
    <div className="pb-6">
      <AppHeader title="Incident Management" />
      <div className="p-4 space-y-4">

        {/* Summary row */}
        <div className="grid grid-cols-4 gap-2 text-center">
          {[
            { label: 'Open',      val: counts.open,          color: 'text-red-500' },
            { label: 'Invest.',   val: counts.investigating,  color: 'text-amber-500' },
            { label: 'Escalated', val: counts.escalated,      color: 'text-blue-500' },
            { label: 'Resolved',  val: counts.resolved,       color: 'text-green-500' },
          ].map(s => (
            <Card key={s.label} className="p-2 border-border">
              <p className={`text-lg font-bold ${s.color}`}>{s.val}</p>
              <p className="text-[9px] text-muted-foreground">{s.label}</p>
            </Card>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search incidents..."
            className="pl-9"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full grid grid-cols-4">
            {['all', 'open', 'investigating', 'resolved'].map(t => (
              <TabsTrigger key={t} value={t} className="text-xs capitalize">
                {t === 'investigating' ? 'Active' : t}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* List */}
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <Card className="p-6 border-border text-center">
              <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No incidents in this category</p>
            </Card>
          ) : (
            filtered.map(inc => {
              const Icon = StatusIcon[inc.status];
              return (
                <Card key={inc.id} className="p-4 border-border">
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">{inc.title}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {inc.id} · {inc.reporter} · {inc.time}
                      </p>
                    </div>
                    <Badge className={`text-[9px] shrink-0 ml-2 border-0 ${severityStyle[inc.severity]}`}>
                      {inc.severity}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{inc.description}</p>
                  <div className="flex items-center justify-between">
                    <Badge className={`text-[9px] border-0 flex items-center gap-1 ${statusStyle[inc.status]}`}>
                      <Icon className="w-3 h-3" />
                      {inc.status}
                    </Badge>
                    {inc.status !== 'resolved' && (
                      <div className="flex gap-2">
                        <Button size="sm" className="h-7 text-xs">Investigate</Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs">Escalate</Button>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
