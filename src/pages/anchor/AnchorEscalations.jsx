import React, { useState } from 'react';
import { ArrowUpCircle, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppHeader from '@/components/shared/AppHeader';

const escalations = [
  {
    id: 'e1',
    title: 'Vendor selling fake products',
    raisedBy: 'Meena Devi',
    status: 'open',
    priority: 'high',
    time: '1 hour ago',
    description: 'Sona Kirana Store is selling expired biscuits.',
  },
  {
    id: 'e2',
    title: 'Rider rude behaviour',
    raisedBy: 'Rakesh Kumar',
    status: 'escalated',
    priority: 'medium',
    time: '3 hours ago',
    description: 'Rider was disrespectful during delivery.',
  },
  {
    id: 'e3',
    title: 'Wrong product delivered',
    raisedBy: 'Sunita Singh',
    status: 'resolved',
    priority: 'low',
    time: '1 day ago',
    description: 'Customer received wrong item, refund needed.',
  },
  {
    id: 'e4',
    title: 'Price gouging complaint',
    raisedBy: 'Ramesh Lal',
    status: 'open',
    priority: 'high',
    time: '2 hours ago',
    description: 'Vendor charging 40% above listed price for rice.',
  },
];

const priorityStyle = {
  high:   'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low:    'bg-green-100 text-green-700',
};

const statusStyle = {
  open:      'bg-red-100 text-red-700',
  escalated: 'bg-blue-100 text-blue-700',
  resolved:  'bg-green-100 text-green-700',
};

const StatusIcon = { open: Clock, escalated: ArrowUpCircle, resolved: CheckCircle };

export default function AnchorEscalations() {
  const [tab, setTab] = useState('all');

  const filtered = escalations.filter(e => tab === 'all' || e.status === tab);

  const counts = {
    open:      escalations.filter(e => e.status === 'open').length,
    escalated: escalations.filter(e => e.status === 'escalated').length,
    resolved:  escalations.filter(e => e.status === 'resolved').length,
  };

  return (
    <div className="pb-6">
      <AppHeader title="Escalations" showBack />
      <div className="px-4 py-4 space-y-3">

        {/* Summary */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <Card className="p-2 border-border">
            <p className="text-xl font-bold text-red-500">{counts.open}</p>
            <p className="text-[10px] text-muted-foreground">Open</p>
          </Card>
          <Card className="p-2 border-border">
            <p className="text-xl font-bold text-blue-500">{counts.escalated}</p>
            <p className="text-[10px] text-muted-foreground">Escalated</p>
          </Card>
          <Card className="p-2 border-border">
            <p className="text-xl font-bold text-green-500">{counts.resolved}</p>
            <p className="text-[10px] text-muted-foreground">Resolved</p>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full grid grid-cols-4">
            {['all', 'open', 'escalated', 'resolved'].map(t => (
              <TabsTrigger key={t} value={t} className="text-xs capitalize">{t}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* List */}
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <Card className="p-6 border-border text-center">
              <AlertTriangle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No escalations in this category</p>
            </Card>
          ) : (
            filtered.map(e => {
              const Icon = StatusIcon[e.status];
              return (
                <Card key={e.id} className="p-4 border-border">
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">{e.title}</p>
                      <p className="text-[10px] text-muted-foreground">{e.raisedBy} · {e.time}</p>
                    </div>
                    <Badge className={`text-[9px] shrink-0 ml-2 border-0 ${priorityStyle[e.priority]}`}>
                      {e.priority}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{e.description}</p>
                  <div className="flex items-center justify-between">
                    <Badge className={`text-[9px] border-0 flex items-center gap-1 ${statusStyle[e.status]}`}>
                      <Icon className="w-3 h-3" />
                      {e.status}
                    </Badge>
                    {e.status !== 'resolved' && (
                      <div className="flex gap-2">
                        <Button size="sm" className="h-7 text-xs">Resolve</Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs">Escalate to Admin</Button>
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
