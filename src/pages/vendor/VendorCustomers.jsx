import React, { useState } from 'react';
import { Users, Search, Star, ShoppingBag, Phone } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import AppHeader from '@/components/shared/AppHeader';

const customers = [
  { id: 'c1', name: 'Meena Devi',    village: 'Madhepur',  orders: 12, totalSpent: 2450, lastOrder: '2 days ago',  rating: 4.8, phone: '+91 94501 11100' },
  { id: 'c2', name: 'Ramesh Kumar',  village: 'Laxmipur',  orders: 8,  totalSpent: 1800, lastOrder: '1 week ago',  rating: 4.5, phone: '+91 94501 11101' },
  { id: 'c3', name: 'Sunita Singh',  village: 'Madhepur',  orders: 23, totalSpent: 5600, lastOrder: 'Yesterday',   rating: 4.9, phone: '+91 94501 11102' },
  { id: 'c4', name: 'Mohan Lal',     village: 'Parsad',    orders: 4,  totalSpent: 900,  lastOrder: '2 weeks ago', rating: 4.2, phone: '+91 94501 11103' },
  { id: 'c5', name: 'Priya Kumari',  village: 'Madhepur',  orders: 17, totalSpent: 3200, lastOrder: '3 days ago',  rating: 4.7, phone: '+91 94501 11104' },
];

export default function VendorCustomers() {
  const [query, setQuery] = useState('');

  const filtered = customers.filter(c =>
    !query ||
    c.name.toLowerCase().includes(query.toLowerCase()) ||
    c.village.toLowerCase().includes(query.toLowerCase())
  );

  const totalRevenue = customers.reduce((s, c) => s + c.totalSpent, 0);
  const totalOrders  = customers.reduce((s, c) => s + c.orders, 0);

  return (
    <div className="pb-6">
      <AppHeader title="My Customers" showBack />
      <div className="px-4 py-4 space-y-3">

        {/* Summary */}
        <div className="grid grid-cols-3 gap-2">
          <Card className="p-3 border-border text-center">
            <p className="text-2xl font-bold">{customers.length}</p>
            <p className="text-[10px] text-muted-foreground">Customers</p>
          </Card>
          <Card className="p-3 border-border text-center">
            <p className="text-2xl font-bold">{totalOrders}</p>
            <p className="text-[10px] text-muted-foreground">Total Orders</p>
          </Card>
          <Card className="p-3 border-border text-center">
            <p className="text-2xl font-bold text-primary">₹{(totalRevenue / 1000).toFixed(1)}k</p>
            <p className="text-[10px] text-muted-foreground">Revenue</p>
          </Card>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search customers..."
            className="pl-9 h-8 text-sm"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>

        {/* List */}
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <Card className="p-6 border-border text-center">
              <Users className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No customers found</p>
            </Card>
          ) : (
            filtered.map(c => (
              <Card key={c.id} className="p-4 border-border">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-sm font-semibold">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.village} · Last order: {c.lastOrder}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                    <span className="text-xs font-medium">{c.rating}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <ShoppingBag className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{c.orders} orders</span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    ₹{c.totalSpent.toLocaleString()} spent
                  </Badge>
                  <div className="flex items-center gap-1.5 ml-auto">
                    <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{c.phone}</span>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
