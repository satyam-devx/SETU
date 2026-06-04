import React, { useState } from 'react';
import { Shield, AlertTriangle, Eye, Ban, CheckCircle, Search, TrendingUp } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppHeader from '@/components/shared/AppHeader';
import StatCard from '@/components/shared/StatCard';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';

const FRAUD_EVENTS = [
  { id: 'f1', type: 'Multiple accounts',    user: 'Device ID: A8F2...',   risk: 0.92, status: 'blocked',    time: '10 min ago',  village: 'Laxmipur'  },
  { id: 'f2', type: 'Unusual order pattern', user: 'Customer cu-4821',    risk: 0.78, status: 'flagged',    time: '45 min ago',  village: 'Madhepur'  },
  { id: 'f3', type: 'COD manipulation',      user: 'Rider r-0042',        risk: 0.85, status: 'under_review', time: '2 hr ago',  village: 'Parsad'    },
  { id: 'f4', type: 'Fake KYC document',     user: 'Vendor vn-0091',      risk: 0.95, status: 'blocked',    time: '4 hr ago',   village: 'Madhepur'  },
  { id: 'f5', type: 'Price manipulation',    user: 'Vendor vn-0034',      risk: 0.61, status: 'monitoring', time: '6 hr ago',   village: 'Jhanjharpur'},
];

const FRAUD_TREND = [
  { day: 'Mon', events: 2 }, { day: 'Tue', events: 5 }, { day: 'Wed', events: 3 },
  { day: 'Thu', events: 7 }, { day: 'Fri', events: 4 }, { day: 'Sat', events: 8 }, { day: 'Sun', events: 5 },
];

const riskColor   = (r) => r >= 0.85 ? 'text-red-600' : r >= 0.7 ? 'text-amber-600' : 'text-yellow-600';
const statusStyle = {
  blocked:       'bg-red-100 text-red-700',
  flagged:       'bg-amber-100 text-amber-700',
  under_review:  'bg-blue-100 text-blue-700',
  monitoring:    'bg-yellow-100 text-yellow-700',
  cleared:       'bg-green-100 text-green-700',
};

export default function SuperAdminSecurity() {
  const [tab, setTab]       = useState('all');
  const [query, setQuery]   = useState('');
  const [events, setEvents] = useState(FRAUD_EVENTS);
  const [acting, setActing] = useState(null);

  const filtered = events.filter(e => {
    const matchQ = !query || e.type.toLowerCase().includes(query.toLowerCase()) || e.user.toLowerCase().includes(query.toLowerCase());
    if (tab === 'blocked')  return matchQ && e.status === 'blocked';
    if (tab === 'flagged')  return matchQ && (e.status === 'flagged' || e.status === 'under_review');
    return matchQ;
  });

  const act = (id, newStatus) => {
    setActing(id + newStatus);
    setTimeout(() => {
      setEvents(es => es.map(e => e.id === id ? { ...e, status: newStatus } : e));
      setActing(null);
    }, 500);
  };

  return (
    <div className="flex-1 overflow-auto">
      <AppHeader title="Fraud & Security" />
      <div className="p-4 space-y-4">

        <div className="grid grid-cols-2 gap-2">
          <StatCard title="Active Threats" value={String(events.filter(e => e.status !== 'cleared').length)} icon={AlertTriangle} />
          <StatCard title="Blocked Today"  value={String(events.filter(e => e.status === 'blocked').length)} icon={Ban} />
        </div>

        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" /> Fraud Events (7 days)
          </h3>
          <div className="h-28">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={FRAUD_TREND} barSize={16}>
                <XAxis dataKey="day" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip formatter={v => [v, 'Events']} />
                <Bar dataKey="events" fill="hsl(var(--destructive))" radius={[3,3,0,0]} opacity={0.7} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search events..." className="pl-9" value={query} onChange={e => setQuery(e.target.value)} />
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="all"     className="text-xs">All ({events.length})</TabsTrigger>
            <TabsTrigger value="flagged" className="text-xs">Flagged</TabsTrigger>
            <TabsTrigger value="blocked" className="text-xs">Blocked</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="space-y-2">
          {filtered.map(e => (
            <Card key={e.id} className="p-4 border-border">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{e.type}</p>
                  <p className="text-xs text-muted-foreground">{e.user} · {e.village} · {e.time}</p>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <p className={`text-sm font-bold ${riskColor(e.risk)}`}>{Math.round(e.risk * 100)}% risk</p>
                  <Badge className={`text-[9px] border-0 ${statusStyle[e.status]}`}>{e.status}</Badge>
                </div>
              </div>
              {e.status !== 'blocked' && e.status !== 'cleared' && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1 h-7 text-xs gap-1 text-destructive border-destructive/30"
                    disabled={acting === e.id + 'blocked'}
                    onClick={() => act(e.id, 'blocked')}>
                    <Ban className="w-3 h-3" />
                    {acting === e.id + 'blocked' ? '...' : 'Block'}
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1 h-7 text-xs gap-1"
                    disabled={acting === e.id + 'cleared'}
                    onClick={() => act(e.id, 'cleared')}>
                    <CheckCircle className="w-3 h-3" />
                    {acting === e.id + 'cleared' ? '...' : 'Clear'}
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 w-7 p-0">
                    <Eye className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
