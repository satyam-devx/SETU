import React, { useState, useEffect } from 'react';
import { IndianRupee, CheckCircle, AlertTriangle, Clock, Search, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppHeader from '@/components/shared/AppHeader';
import StatCard from '@/components/shared/StatCard';
import { useStore } from '@/lib/store';
import { AdminAPI } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';

export default function AdminCash() {
  const { state } = useStore();
  const { user }  = useAuth();
  const [tab, setTab]     = useState('outstanding');
  const [query, setQuery] = useState('');
  const [acting, setActing] = useState(null);

  // Realtime state for deposits
  const [pendingDeposits, setPendingDeposits] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDeposits();
  }, []);

  const fetchDeposits = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('cod_deposits')
      .select('*, riders(name, zone)')
      .order('created_at', { ascending: false });

    if (data) setPendingDeposits(data);
    setIsLoading(false);
  };

  const handleConfirmDeposit = async (depositId) => {
    setActing(depositId);
    try {
      const { error } = await AdminAPI.confirmCODDeposit(depositId, user.id);
      if (error) throw error;
      // Refresh
      fetchDeposits();
    } catch (err) {
      console.error('[AdminCash] confirmation failed:', err);
      alert('Failed to confirm deposit.');
    } finally {
      setActing(null);
    }
  };

  const codOrders = state.orders.filter(o =>
    (o.paymentMethod?.toUpperCase() === 'COD' || o.is_cod) && o.status === 'delivered'
  );

  const totalCOD   = codOrders.reduce((s, o) => s + (o.total || 0), 0);
  const totalRiderBalance = state.riders.reduce((s, r) => s + (r.codBalance || 0), 0);

  const filteredDeposits = pendingDeposits.filter(d => {
    const riderName = d.riders?.name || '';
    const matchesQ = !query || riderName.toLowerCase().includes(query.toLowerCase());
    if (tab === 'outstanding') return matchesQ && d.status === 'pending_confirmation';
    if (tab === 'settled')     return matchesQ && d.status === 'confirmed';
    return matchesQ;
  });

  return (
    <div className="flex-1 overflow-auto pb-20">
      <AppHeader title="COD & Cash" subtitle="Hub Reconciliation" />
      <div className="p-4 space-y-4">

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2">
          <StatCard
            title="Total COD Today"
            value={`₹${totalCOD.toLocaleString()}`}
            icon={IndianRupee}
            trend={`${codOrders.length} orders`}
          />
          <StatCard
            title="Cash on Hand (Riders)"
            value={`₹${totalRiderBalance.toLocaleString()}`}
            icon={Clock}
            trend="Needs collection"
          />
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search riders..." className="pl-9 h-10 rounded-xl" value={query} onChange={e => setQuery(e.target.value)} />
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full grid grid-cols-2 h-10 rounded-xl">
            <TabsTrigger value="outstanding" className="text-xs">Pending Deposits</TabsTrigger>
            <TabsTrigger value="settled"     className="text-xs">Settled</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Loading state */}
        {isLoading && (
          <div className="py-10 text-center">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
          </div>
        )}

        {/* Deposit rows */}
        <div className="space-y-2">
          {!isLoading && filteredDeposits.map(deposit => (
            <Card key={deposit.id} className={`p-4 border transition-all ${
              deposit.status === 'pending_confirmation' ? 'border-amber-200 bg-amber-50/30' : 'border-border'
            }`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-sm font-bold text-foreground">{deposit.riders?.name || 'Rider'}</p>
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold">
                    {deposit.riders?.zone || 'Zone A'} · Submitted {new Date(deposit.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-foreground">₹{deposit.amount.toLocaleString()}</p>
                </div>
              </div>

              {deposit.status === 'confirmed' ? (
                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-0 text-[10px] py-0.5">
                    <CheckCircle className="w-3 h-3 mr-1" /> Reconciled
                  </Badge>
                  <p className="text-[10px] text-muted-foreground">
                    Confirmed at {new Date(deposit.admin_confirmed_at).toLocaleTimeString()}
                  </p>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button
                    className="flex-1 h-9 text-xs font-bold rounded-lg"
                    disabled={acting === deposit.id}
                    onClick={() => handleConfirmDeposit(deposit.id)}
                  >
                    {acting === deposit.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Confirm Collection'}
                  </Button>
                  <Button variant="outline" className="h-9 px-3 rounded-lg text-destructive border-destructive/20 hover:bg-destructive/5">
                    <AlertTriangle className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </Card>
          ))}

          {!isLoading && filteredDeposits.length === 0 && (
            <div className="py-10 text-center border-2 border-dashed border-muted rounded-2xl">
              <p className="text-sm text-muted-foreground">No deposits to show.</p>
            </div>
          )}
        </div>

        {/* COD order tracker */}
        <div>
          <h3 className="font-bold text-sm mb-3 px-1">COD Collections Today</h3>
          <div className="space-y-1.5">
            {codOrders.map(o => (
              <Card key={o.id} className="px-3 py-2 border-border flex items-center justify-between hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-mono font-bold truncate">{o.orderNumber || o.order_number}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{o.customerName || o.customer_name} · {o.riderName || 'Unassigned'}</p>
                  </div>
                </div>
                <p className="text-xs font-black shrink-0 ml-4">₹{o.total}</p>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
