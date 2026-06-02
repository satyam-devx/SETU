import React, { useState } from 'react';
import { UserCheck, Search, CheckCircle, Clock, XCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppHeader from '@/components/shared/AppHeader';

const kycList = [
  { id: 'k1', name: 'Ramkumar Singh',   type: 'Vendor',   status: 'pending',  docs: 'Aadhaar, PAN', submitted: '2 days ago' },
  { id: 'k2', name: 'Sunita Devi',      type: 'Customer', status: 'approved', docs: 'Aadhaar',       submitted: '5 days ago' },
  { id: 'k3', name: 'Mohan Lal',        type: 'Rider',    status: 'pending',  docs: 'Aadhaar, DL',   submitted: '1 day ago' },
  { id: 'k4', name: 'Priya Kumari',     type: 'Vendor',   status: 'rejected', docs: 'Aadhaar',       submitted: '3 days ago' },
];

const statusStyle = {
  pending:  'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

const StatusIcon = { pending: Clock, approved: CheckCircle, rejected: XCircle };

export default function AnchorKYC() {
  const [tab, setTab]     = useState('all');
  const [query, setQuery] = useState('');

  const filtered = kycList.filter(k => {
    const matchTab   = tab === 'all' || k.status === tab;
    const matchQuery = !query || k.name.toLowerCase().includes(query.toLowerCase());
    return matchTab && matchQuery;
  });

  const counts = {
    pending:  kycList.filter(k => k.status === 'pending').length,
    approved: kycList.filter(k => k.status === 'approved').length,
    rejected: kycList.filter(k => k.status === 'rejected').length,
  };

  return (
    <div className="pb-6">
      <AppHeader title="KYC Management" showBack />
      <div className="px-4 py-4 space-y-3">

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <Card className="p-2 border-border">
            <p className="text-xl font-bold text-amber-500">{counts.pending}</p>
            <p className="text-[10px] text-muted-foreground">Pending</p>
          </Card>
          <Card className="p-2 border-border">
            <p className="text-xl font-bold text-green-500">{counts.approved}</p>
            <p className="text-[10px] text-muted-foreground">Approved</p>
          </Card>
          <Card className="p-2 border-border">
            <p className="text-xl font-bold text-red-500">{counts.rejected}</p>
            <p className="text-[10px] text-muted-foreground">Rejected</p>
          </Card>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search people..."
            className="pl-9 h-8 text-sm"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full grid grid-cols-4">
            {['all', 'pending', 'approved', 'rejected'].map(t => (
              <TabsTrigger key={t} value={t} className="text-xs capitalize">{t}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* List */}
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <Card className="p-6 border-border text-center">
              <UserCheck className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No KYC records found</p>
            </Card>
          ) : (
            filtered.map(k => {
              const Icon = StatusIcon[k.status];
              return (
                <Card key={k.id} className="p-4 border-border">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold">{k.name}</p>
                      <p className="text-xs text-muted-foreground">{k.type} · {k.docs}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Submitted {k.submitted}</p>
                    </div>
                    <Badge className={`text-[9px] flex items-center gap-1 border-0 ${statusStyle[k.status]}`}>
                      <Icon className="w-3 h-3" />
                      {k.status}
                    </Badge>
                  </div>
                  {k.status === 'pending' && (
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" className="flex-1 h-7 text-xs">Approve</Button>
                      <Button size="sm" variant="outline" className="flex-1 h-7 text-xs text-destructive border-destructive/30">
                        Reject
                      </Button>
                    </div>
                  )}
                </Card>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
