import React, { useState, useEffect, useCallback } from 'react';
import { Search, Phone, MapPin, Package, Star, RefreshCw, Loader2, ShieldCheck } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppHeader from '@/components/shared/AppHeader';
import StatCard from '@/components/shared/StatCard';
import { AdminAPI } from '@/lib/api';
import { supabase } from '@/lib/supabase';

const KYC_STYLE = {
  approved: 'bg-green-100 text-green-700',
  pending:  'bg-amber-100 text-amber-700',
  submitted:'bg-blue-100  text-blue-700',
  rejected: 'bg-red-100   text-red-700',
};

export default function AdminRiders() {
  const [riders,    setRiders]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [query,     setQuery]     = useState('');
  const [tab,       setTab]       = useState('all');
  const [toggling,  setToggling]  = useState(null);

  // We also need live orders to compute "on trip"
  const [activeOrderRiderIds, setActiveOrderRiderIds] = useState(new Set());

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const [ridersRes, ordersRes] = await Promise.all([
      AdminAPI.getRiders(),
      supabase
        .from('orders')
        .select('rider_id')
        .not('rider_id', 'is', null)
        .not('status', 'in', '("delivered","cancelled")'),
    ]);
    if (ridersRes.error) setLoadError('Failed to load riders. Tap retry.');
    else setRiders(ridersRes.data ?? []);
    const ids = new Set((ordersRes.data ?? []).map(o => o.rider_id));
    setActiveOrderRiderIds(ids);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Realtime: rider online status
  useEffect(() => {
    const channel = supabase
      .channel('admin-riders-online')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'riders' }, (payload) => {
        setRiders(prev => prev.map(r => r.id === payload.new.id ? { ...r, ...payload.new } : r));
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const handleToggleActive = async (riderId, current) => {
    setToggling(riderId);
    const { error } = await AdminAPI.setRiderActive(riderId, !current);
    if (!error) setRiders(rs => rs.map(r => r.id === riderId ? { ...r, is_active: !current } : r));
    setToggling(null);
  };

  const handleVerify = async (riderId) => {
    setToggling(riderId);
    const { error } = await AdminAPI.verifyRider(riderId);
    if (!error) setRiders(rs => rs.map(r => r.id === riderId ? { ...r, is_verified: true, kyc_status: 'approved' } : r));
    setToggling(null);
  };

  // ── Derived ────────────────────────────────────────────
  const filtered = riders.filter(r => {
    const matchQ = !query
      || (r.name ?? '').toLowerCase().includes(query.toLowerCase())
      || (r.phone ?? '').includes(query);
    if (tab === 'online')   return matchQ && r.is_online;
    if (tab === 'offline')  return matchQ && !r.is_online;
    if (tab === 'inactive') return matchQ && !r.is_active;
    return matchQ && r.is_active;
  });

  const onlineCount  = riders.filter(r => r.is_online).length;
  const onTripCount  = riders.filter(r => activeOrderRiderIds.has(r.id)).length;
  const availCount   = onlineCount - onTripCount;

  return (
    <div className="flex-1 overflow-auto">
      <AppHeader
        title="Riders"
        subtitle={`${onlineCount} online · ${riders.length} total`}
        rightAction={
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={loadData}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        }
      />
      <div className="p-4 space-y-4">

        <div className="grid grid-cols-3 gap-2">
          <StatCard title="Online"    value={loading ? '…' : String(onlineCount)} icon={MapPin}  />
          <StatCard title="On Trip"   value={loading ? '…' : String(onTripCount)} icon={Package} />
          <StatCard title="Available" value={loading ? '…' : String(Math.max(0, availCount))} icon={Star} />
        </div>

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
            className="pl-9"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="all"      className="text-xs">All</TabsTrigger>
            <TabsTrigger value="online"   className="text-xs">Online</TabsTrigger>
            <TabsTrigger value="offline"  className="text-xs">Offline</TabsTrigger>
            <TabsTrigger value="inactive" className="text-xs">Inactive</TabsTrigger>
          </TabsList>
        </Tabs>

        {loading ? (
          <div className="space-y-2 animate-pulse">
            {[1, 2, 3].map(i => <div key={i} className="h-36 bg-muted rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="p-6 border-border text-center">
            <p className="text-sm text-muted-foreground">No riders in this category</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map(rider => {
              const isOnTrip  = activeOrderRiderIds.has(rider.id);
              const isToggling = toggling === rider.id;

              return (
                <Card key={rider.id} className="p-4 border-border">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-10 h-10 rounded-full bg-primary/5 flex items-center justify-center font-bold text-primary text-sm">
                          {(rider.name ?? '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-background
                          ${rider.is_online ? 'bg-green-500' : 'bg-gray-400'}`} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{rider.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {rider.zone ?? '—'} · {rider.vehicle_type ?? 'Bike'}
                          {rider.vehicle_number ? ` · ${rider.vehicle_number}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                        <span className="text-xs font-medium">{rider.rating?.toFixed(1) ?? '—'}</span>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5 justify-end">
                        {isOnTrip && (
                          <Badge className="text-[9px] bg-blue-100 text-blue-700 border-0">On Trip</Badge>
                        )}
                        <Badge className={`text-[9px] border-0 ${KYC_STYLE[rider.kyc_status] ?? KYC_STYLE.pending}`}>
                          {rider.kyc_status === 'approved'
                            ? <><ShieldCheck className="w-2.5 h-2.5 inline mr-0.5" />KYC</>
                            : rider.kyc_status}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center mb-3">
                    <div className="bg-muted/40 rounded-lg p-1.5">
                      <p className="text-xs font-bold">{rider.today_deliveries ?? 0}</p>
                      <p className="text-[9px] text-muted-foreground">Today</p>
                    </div>
                    <div className="bg-muted/40 rounded-lg p-1.5">
                      <p className="text-xs font-bold">₹{Number(rider.today_earnings ?? 0).toLocaleString()}</p>
                      <p className="text-[9px] text-muted-foreground">Earned</p>
                    </div>
                    <div className="bg-muted/40 rounded-lg p-1.5">
                      <p className="text-xs font-bold">₹{Number(rider.cod_balance ?? 0).toLocaleString()}</p>
                      <p className="text-[9px] text-muted-foreground">COD</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Active</span>
                      {isToggling
                        ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        : <Switch
                            checked={rider.is_active}
                            onCheckedChange={() => handleToggleActive(rider.id, rider.is_active)}
                          />
                      }
                    </div>
                    <div className="flex gap-1">
                      {rider.phone && (
                        <a href={`tel:${rider.phone}`} aria-label={`Call ${rider.name ?? 'rider'}`}>
                          <Button size="sm" variant="outline" className="h-7 w-7 p-0" aria-label={`Call ${rider.name ?? 'rider'}`}>
                            <Phone className="w-3 h-3" />
                          </Button>
                        </a>
                      )}
                      {rider.kyc_status !== 'approved' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1"
                          disabled={isToggling}
                          onClick={() => handleVerify(rider.id)}
                        >
                          <ShieldCheck className="w-3 h-3" /> Verify
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
