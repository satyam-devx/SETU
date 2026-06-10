import React, { useState, useEffect, useCallback } from 'react';
import { IndianRupee, CheckCircle, AlertTriangle, Clock, Search, Loader2, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppHeader from '@/components/shared/AppHeader';
import StatCard from '@/components/shared/StatCard';
import { AdminAPI } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';

function fmtTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const today = new Date();
  const isToday =
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear();
  return isToday ? `Today ${fmtTime(iso)}` : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) + ' ' + fmtTime(iso);
}

export default function AdminCash() {
  const { user } = useAuth();

  const [deposits,  setDeposits]  = useState([]);
  const [codOrders, setCodOrders] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [tab,       setTab]       = useState('outstanding');
  const [query,     setQuery]     = useState('');
  const [acting,    setActing]    = useState(null); // depositId being confirmed/disputed

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const [depositsRes, ordersRes] = await Promise.all([
      AdminAPI.getCODDeposits(),
      supabase
        .from('orders')
        .select('id, order_number, customer_name, rider_name, total, payment_method, status, created_at')
        .in('payment_method', ['COD', 'cod'])
        .eq('status', 'delivered')
        .order('created_at', { ascending: false })
        .limit(50),
    ]);
    if (depositsRes.error) setLoadError('Failed to load deposit data.');
    else setDeposits(depositsRes.data ?? []);
    setCodOrders(ordersRes.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Realtime: new deposits
  useEffect(() => {
    const channel = supabase
      .channel('admin-cod-deposits')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'cod_deposits' }, payload => {
        // Refetch to get joined rider name
        loadData();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'cod_deposits' }, payload => {
        setDeposits(prev => prev.map(d => d.id === payload.new.id ? { ...d, ...payload.new } : d));
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [loadData]);

  // ── Actions ────────────────────────────────────────────
  const handleConfirm = async (depositId) => {
    if (!user?.id) return;
    setActing(depositId);
    const { error } = await AdminAPI.confirmCODDeposit(depositId, user.id);
    if (error) {
      alert('Failed to confirm deposit. Please try again.');
    } else {
      setDeposits(ds => ds.map(d =>
        d.id === depositId
          ? { ...d, status: 'confirmed', admin_confirmed_at: new Date().toISOString() }
          : d
      ));
    }
    setActing(null);
  };

  const handleDispute = async (depositId) => {
    setActing(depositId);
    const { error } = await AdminAPI.disputeCODDeposit(depositId);
    if (!error) {
      setDeposits(ds => ds.map(d =>
        d.id === depositId ? { ...d, status: 'disputed' } : d
      ));
    }
    setActing(null);
  };

  // ── Derived ────────────────────────────────────────────
  const pending   = deposits.filter(d => d.status === 'pending_confirmation');
  const settled   = deposits.filter(d => d.status === 'confirmed');
  const disputed  = deposits.filter(d => d.status === 'disputed');

  const totalPending  = pending.reduce((s, d) => s + Number(d.amount), 0);
  const totalSettled  = settled.reduce((s, d) => s + Number(d.amount), 0);
  const totalCODToday = codOrders.reduce((s, o) => s + Number(o.total), 0);
  const riderCOD      = deposits
    .filter(d => d.status === 'pending_confirmation')
    .reduce((acc, d) => {
      const name = d.riders?.name ?? 'Rider';
      acc[name] = (acc[name] ?? 0) + Number(d.amount);
      return acc;
    }, {});

  const filteredDeposits = deposits.filter(d => {
    const riderName = d.riders?.name ?? '';
    const matchQ = !query || riderName.toLowerCase().includes(query.toLowerCase());
    if (tab === 'outstanding') return matchQ && d.status === 'pending_confirmation';
    if (tab === 'settled')     return matchQ && d.status === 'confirmed';
    if (tab === 'disputed')    return matchQ && d.status === 'disputed';
    return matchQ;
  });

  return (
    <div className="flex-1 overflow-auto pb-20">
      <AppHeader
        title="COD & Cash"
        subtitle="Hub Reconciliation"
        rightAction={
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={loadData}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        }
      />
      <div className="p-4 space-y-4">

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2">
          <StatCard
            title="COD Today"
            value={loading ? '…' : `₹${totalCODToday.toLocaleString()}`}
            icon={IndianRupee}
            subtitle={`${codOrders.length} orders`}
          />
          <StatCard
            title="Pending Collection"
            value={loading ? '…' : `₹${totalPending.toLocaleString()}`}
            icon={Clock}
            subtitle={`${pending.length} deposits`}
          />
        </div>

        {/* Rider COD summary */}
        {!loading && Object.keys(riderCOD).length > 0 && (
          <Card className="p-3 border-amber-200 bg-amber-50/40">
            <p className="text-xs font-semibold text-amber-800 mb-2">
              ⚡ Cash Held by Riders
            </p>
            <div className="space-y-1">
              {Object.entries(riderCOD).map(([name, amount]) => (
                <div key={name} className="flex justify-between text-xs">
                  <span className="text-amber-700">{name}</span>
                  <span className="font-bold text-amber-800">₹{amount.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {loadError && (
          <Card className="p-3 border-destructive/20 bg-destructive/5 flex items-center justify-between">
            <p className="text-xs text-destructive">{loadError}</p>
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={loadData}>
              <RefreshCw className="w-3 h-3" /> Retry
            </Button>
          </Card>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search riders..."
            className="pl-9 h-10 rounded-xl"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full grid grid-cols-3 h-10 rounded-xl">
            <TabsTrigger value="outstanding" className="text-xs">
              Pending {pending.length > 0 && `(${pending.length})`}
            </TabsTrigger>
            <TabsTrigger value="settled"  className="text-xs">
              Settled {settled.length > 0 && `(${settled.length})`}
            </TabsTrigger>
            <TabsTrigger value="disputed" className="text-xs">
              Disputed {disputed.length > 0 && `(${disputed.length})`}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Deposit cards */}
        {loading ? (
          <div className="space-y-2 animate-pulse">
            {[1, 2].map(i => <div key={i} className="h-28 bg-muted rounded-xl" />)}
          </div>
        ) : filteredDeposits.length === 0 ? (
          <div className="py-10 text-center border-2 border-dashed border-muted rounded-2xl">
            <p className="text-sm text-muted-foreground">No deposits to show.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredDeposits.map(deposit => {
              const isActing = acting === deposit.id;
              const isPending = deposit.status === 'pending_confirmation';
              const isConfirmed = deposit.status === 'confirmed';
              const isDisputed  = deposit.status === 'disputed';

              return (
                <Card
                  key={deposit.id}
                  className={`p-4 border transition-all ${
                    isPending  ? 'border-amber-200 bg-amber-50/30' :
                    isDisputed ? 'border-red-200   bg-red-50/20'   :
                    'border-border'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-sm font-bold">{deposit.riders?.name ?? 'Rider'}</p>
                      <p className="text-[10px] text-muted-foreground uppercase font-semibold">
                        {deposit.riders?.zone ?? '—'} · Submitted {fmtDate(deposit.created_at)}
                      </p>
                      {deposit.notes && (
                        <p className="text-[10px] text-muted-foreground mt-0.5 italic">{deposit.notes}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-black">₹{Number(deposit.amount).toLocaleString()}</p>
                      {isConfirmed && (
                        <p className="text-[10px] text-green-600">
                          {fmtDate(deposit.admin_confirmed_at)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Denominations if stored */}
                  {deposit.denominations && Object.keys(deposit.denominations).length > 0 && (
                    <div className="flex gap-1 flex-wrap mb-3">
                      {Object.entries(deposit.denominations).map(([denom, count]) =>
                        count > 0 ? (
                          <span key={denom} className="text-[10px] px-1.5 py-0.5 bg-muted rounded text-muted-foreground">
                            ₹{denom}×{count}
                          </span>
                        ) : null
                      )}
                    </div>
                  )}

                  {isConfirmed && (
                    <div className="flex items-center gap-2 pt-2 border-t border-border">
                      <Badge className="bg-green-100 text-green-700 border-0 text-[10px]">
                        <CheckCircle className="w-3 h-3 mr-1" /> Reconciled
                      </Badge>
                    </div>
                  )}

                  {isDisputed && (
                    <div className="flex items-center gap-2 pt-2 border-t border-red-100">
                      <Badge className="bg-red-100 text-red-700 border-0 text-[10px]">
                        <AlertTriangle className="w-3 h-3 mr-1" /> Disputed
                      </Badge>
                    </div>
                  )}

                  {isPending && (
                    <div className="flex gap-2 pt-2 border-t border-amber-100">
                      <Button
                        className="flex-1 h-9 text-xs font-bold rounded-lg"
                        disabled={isActing}
                        onClick={() => handleConfirm(deposit.id)}
                      >
                        {isActing
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <><CheckCircle className="w-3.5 h-3.5 mr-1" /> Confirm Collection</>
                        }
                      </Button>
                      <Button
                        variant="outline"
                        className="h-9 px-3 rounded-lg text-destructive border-destructive/20 hover:bg-destructive/5"
                        disabled={isActing}
                        onClick={() => handleDispute(deposit.id)}
                        title="Flag as disputed"
                      >
                        <AlertTriangle className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {/* Settled summary */}
        {!loading && tab === 'settled' && settled.length > 0 && (
          <Card className="p-3 border-green-100 bg-green-50/30">
            <div className="flex justify-between text-sm">
              <span className="text-green-700 font-medium">Total Settled</span>
              <span className="font-bold text-green-800">₹{totalSettled.toLocaleString()}</span>
            </div>
          </Card>
        )}

        {/* COD orders list */}
        <div>
          <h3 className="font-bold text-sm mb-3 px-1">COD Collections Today</h3>
          {codOrders.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No COD orders today.</p>
          ) : (
            <div className="space-y-1.5">
              {codOrders.map(o => (
                <Card key={o.id} className="px-3 py-2 border-border flex items-center justify-between hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-mono font-bold truncate">{o.order_number}</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {o.customer_name ?? 'Customer'} · {o.rider_name ?? 'Unassigned'}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs font-black shrink-0 ml-4">₹{Number(o.total).toLocaleString()}</p>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
