import React, { useState } from 'react';
import { IndianRupee, CheckCircle, AlertTriangle, Clock, Search } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppHeader from '@/components/shared/AppHeader';
import StatCard from '@/components/shared/StatCard';
import { useStore } from '@/lib/store';
import { RIDERS } from '@/lib/mockData';

export default function AdminCash() {
  const { state } = useStore();
  const [tab, setTab]     = useState('outstanding');
  const [query, setQuery] = useState('');
  const [confirming, setConfirming] = useState(null);
  const [deposits, setDeposits]     = useState({});

  const codOrders = state.orders.filter(o => (o.paymentMethod === 'COD' || o.paymentMethod === 'cod') && o.status === 'delivered');
  const totalCOD   = codOrders.reduce((s, o) => s + (o.total || 0), 0);
  const collected  = RIDERS.reduce((s, r) => s + r.codBalance, 0);
  const totalRiderBalance = RIDERS.reduce((s, r) => s + r.codBalance, 0);

  const riderRows = RIDERS.filter(r =>
    !query || r.name.toLowerCase().includes(query.toLowerCase())
  );

  const handleConfirmDeposit = (riderId) => {
    setConfirming(riderId);
    setTimeout(() => {
      setDeposits(d => ({ ...d, [riderId]: true }));
      setConfirming(null);
    }, 600);
  };

  return (
    <div className="flex-1 overflow-auto">
      <AppHeader title="COD & Cash" subtitle="Daily reconciliation" />
      <div className="p-4 space-y-4">

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2">
          <StatCard title="Today's COD Total" value={`₹${totalCOD.toLocaleString()}`}    icon={IndianRupee} />
          <StatCard title="Pending Deposit"   value={`₹${totalRiderBalance.toLocaleString()}`} icon={Clock} />
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search riders..." className="pl-9" value={query} onChange={e => setQuery(e.target.value)} />
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="outstanding" className="text-xs">Outstanding</TabsTrigger>
            <TabsTrigger value="settled"     className="text-xs">Settled</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Rider COD rows */}
        <div className="space-y-2">
          {riderRows.map(rider => {
            const riderCOD    = state.orders.filter(o => o.riderId === rider.id && o.status === 'delivered' && o.paymentMethod === 'COD');
            const riderTotal  = riderCOD.reduce((s, o) => s + (o.total || 0), 0);
            const isDeposited = deposits[rider.id];
            if (tab === 'settled'     && !isDeposited) return null;
            if (tab === 'outstanding' &&  isDeposited) return null;
            return (
              <Card key={rider.id} className={`p-4 border ${!isDeposited && rider.codBalance > 0 ? 'border-amber-200 bg-amber-50/30' : 'border-border'}`}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-sm font-semibold">{rider.name}</p>
                    <p className="text-xs text-muted-foreground">{rider.zone} · {riderCOD.length} COD deliveries</p>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-bold text-amber-600">₹{rider.codBalance.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">on hand</p>
                  </div>
                </div>

                {isDeposited ? (
                  <Badge className="w-full justify-center bg-green-100 text-green-700 border-0 py-1">
                    <CheckCircle className="w-3 h-3 mr-1" /> Deposited
                  </Badge>
                ) : (
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1 h-8 text-xs"
                      disabled={confirming === rider.id}
                      onClick={() => handleConfirmDeposit(rider.id)}>
                      <CheckCircle className="w-3 h-3 mr-1" />
                      {confirming === rider.id ? 'Confirming...' : `Confirm ₹${rider.codBalance}`}
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 text-xs text-destructive border-destructive/30">
                      Flag Discrepancy
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        {/* COD order detail */}
        {codOrders.length > 0 && (
          <div>
            <h3 className="font-semibold text-sm mb-2">COD Orders Today</h3>
            <div className="space-y-1.5">
              {codOrders.map(o => (
                <Card key={o.id} className="px-3 py-2 border-border flex items-center justify-between">
                  <div>
                    <p className="text-xs font-mono">{o.orderNumber}</p>
                    <p className="text-xs text-muted-foreground">{o.customerName} · {o.riderName || 'Unassigned'}</p>
                  </div>
                  <p className="text-sm font-bold">₹{o.total}</p>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
