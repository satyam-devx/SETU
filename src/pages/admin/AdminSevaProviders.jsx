import React, { useState } from 'react';
import { Search, CheckCircle, XCircle, Star, Phone } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppHeader from '@/components/shared/AppHeader';
import StatCard from '@/components/shared/StatCard';

const providers = [
  { id: 'SP-001', name: 'Raju Mistri', service: 'Plumbing', village: 'Rampur', rating: 4.7, jobs: 38, status: 'active', phone: '+91 94501 11111' },
  { id: 'SP-002', name: 'Suresh Electrician', service: 'Electrical', village: 'Bhojpur', rating: 4.5, jobs: 52, status: 'active', phone: '+91 94501 22222' },
  { id: 'SP-003', name: 'Anita Nurse', service: 'Healthcare', village: 'Madhopur', rating: 4.9, jobs: 21, status: 'pending', phone: '+91 94501 33333' },
  { id: 'SP-004', name: 'Vijay Carpenter', service: 'Carpentry', village: 'Rampur', rating: 4.2, jobs: 14, status: 'suspended', phone: '+91 94501 44444' },
];

export default function AdminSevaProviders() {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('all');

  const filtered = providers.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.service.toLowerCase().includes(search.toLowerCase());
    const matchTab = tab === 'all' || p.status === tab;
    return matchSearch && matchTab;
  });

  const statusColor = { active: 'bg-green-100 text-green-700', pending: 'bg-amber-100 text-amber-700', suspended: 'bg-red-100 text-red-700' };

  return (
    <div className="pb-6">
      <AppHeader title="Seva Providers" subtitle="Service provider management" />
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <StatCard title="Active" value="2" icon={CheckCircle} />
          <StatCard title="Pending" value="1" icon={Star} />
          <StatCard title="Suspended" value="1" icon={XCircle} />
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search providers..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
            <TabsTrigger value="active" className="text-xs">Active</TabsTrigger>
            <TabsTrigger value="pending" className="text-xs">Pending</TabsTrigger>
            <TabsTrigger value="suspended" className="text-xs">Suspended</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="space-y-2">
          {filtered.map(p => (
            <Card key={p.id} className="p-4 border-border">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-sm">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.service} · {p.village}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs flex items-center gap-1"><Star className="w-3 h-3 text-amber-400 fill-amber-400" />{p.rating}</span>
                    <span className="text-xs text-muted-foreground">{p.jobs} jobs</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge className={`text-[10px] ${statusColor[p.status]}`}>{p.status}</Badge>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <Phone className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
              {p.status === 'pending' && (
                <div className="flex gap-2 mt-3">
                  <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700 text-xs">Approve</Button>
                  <Button size="sm" variant="outline" className="flex-1 text-destructive text-xs">Reject</Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
