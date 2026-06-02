import React, { useState } from 'react';
import { Search, Users, CreditCard, Phone, AlertTriangle, ShieldOff, ShieldCheck } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppHeader from '@/components/shared/AppHeader';
import StatCard from '@/components/shared/StatCard';

const customers = [
  { id: 'cu1', name: 'Anita Devi',   village: 'Madhepur', phone: '+91 94501 11100', orders: 12, creditUsed: 1200, creditLimit: 5000, status: 'active',  flags: 0 },
  { id: 'cu2', name: 'Raj Kumar',    village: 'Laxmipur', phone: '+91 94501 11101', orders: 8,  creditUsed: 0,    creditLimit: 2000, status: 'active',  flags: 0 },
  { id: 'cu3', name: 'Priya Singh',  village: 'Madhepur', phone: '+91 94501 11102', orders: 3,  creditUsed: 800,  creditLimit: 3000, status: 'active',  flags: 1 },
  { id: 'cu4', name: 'Mohan Lal',    village: 'Parsad',   phone: '+91 94501 11103', orders: 6,  creditUsed: 500,  creditLimit: 2000, status: 'blocked', flags: 2 },
  { id: 'cu5', name: 'Sunita Devi',  village: 'Laxmipur', phone: '+91 94501 11104', orders: 21, creditUsed: 2500, creditLimit: 5000, status: 'active',  flags: 0 },
  { id: 'cu6', name: 'Rekha Kumari', village: 'Madhepur', phone: '+91 94501 11105', orders: 2,  creditUsed: 0,    creditLimit: 0,    status: 'active',  flags: 0 },
];

export default function AdminCustomers() {
  const [query, setQuery] = useState('');
  const [tab, setTab]     = useState('all');

  const filtered = customers.filter(c => {
    const matchQ = c.name.toLowerCase().includes(query.toLowerCase()) ||
                   c.village.toLowerCase().includes(query.toLowerCase());
    const matchT = tab === 'all' ||
                   (tab === 'active'  && c.status === 'active') ||
                   (tab === 'blocked' && c.status === 'blocked') ||
                   (tab === 'flagged' && c.flags > 0);
    return matchQ && matchT;
  });

  return (
    <div className="pb-6">
      <AppHeader title="Customers" />
      <div className="p-4 space-y-4">

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2">
          <StatCard title="Total Customers" value="2,450" icon={Users} />
          <StatCard title="Flagged Accounts" value="3" icon={AlertTriangle} />
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or village..."
            className="pl-9"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="all"     className="text-xs">All</TabsTrigger>
            <TabsTrigger value="active"  className="text-xs">Active</TabsTrigger>
            <TabsTrigger value="flagged" className="text-xs">Flagged</TabsTrigger>
            <TabsTrigger value="blocked" className="text-xs">Blocked</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* List */}
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <Card className="p-6 border-border text-center">
              <Users className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No customers match your filters</p>
            </Card>
          ) : (
            filtered.map(c => (
              <Card key={c.id} className="p-4 border-border">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold">{c.name}</p>
                      {c.flags > 0 && (
                        <Badge className="text-[9px] bg-red-100 text-red-700 border-0">
                          {c.flags} flag{c.flags > 1 ? 's' : ''}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{c.village} · {c.orders} orders</p>
                  </div>
                  <Badge
                    className={`text-[9px] border-0 ${
                      c.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {c.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                  {c.creditLimit > 0 && (
                    <span className="flex items-center gap-1">
                      <CreditCard className="w-3 h-3" />
                      Credit: ₹{c.creditUsed.toLocaleString()}/₹{c.creditLimit.toLocaleString()}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    {c.phone}
                  </span>
                </div>
                {c.status === 'blocked' && (
                  <Button size="sm" variant="outline" className="mt-2 w-full text-xs gap-1 h-7">
                    <ShieldCheck className="w-3 h-3" /> Unblock Customer
                  </Button>
                )}
                {c.status === 'active' && c.flags > 0 && (
                  <Button size="sm" variant="outline" className="mt-2 w-full text-xs gap-1 h-7 text-destructive border-destructive/30">
                    <ShieldOff className="w-3 h-3" /> Review & Block
                  </Button>
                )}
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
