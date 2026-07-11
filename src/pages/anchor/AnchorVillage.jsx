import React, { useState, useEffect } from 'react';
import { MapPin, Users, Store, Bike, Star, Phone, CheckCircle, XCircle, Loader2, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppHeader from '@/components/shared/AppHeader';
import VillageMap from '@/components/maps/VillageMap';
import { useVillage } from '@/lib/village';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

// ── Data loaders ──────────────────────────────────────────
async function fetchVillageDirectory(villageId) {
  const [vendorsRes, ridersRes, sevaRes] = await Promise.all([
    supabase
      .from('vendors')
      .select('id, business_name, category, phone, rating, review_count, is_verified, is_open, lat, lng')
      .eq('village_id', villageId)
      .order('rating', { ascending: false }),

    supabase
      .from('riders')
      .select('id, name, phone, zone, vehicle_type, rating, total_deliveries, is_online, avatar_url')
      .eq('village_id', villageId)
      .order('is_online', { ascending: false }),

    supabase
      .from('seva_providers')
      .select('id, name, category, phone, hourly_rate, rating, is_available, image_url')
      .eq('village_id', villageId)
      .order('is_available', { ascending: false }),
  ]);

  return {
    vendors:       vendorsRes.data   ?? [],
    riders:        ridersRes.data    ?? [],
    sevaProviders: sevaRes.data      ?? [],
    errors: [vendorsRes.error, ridersRes.error, sevaRes.error].filter(Boolean),
  };
}

// ── Loading skeleton ──────────────────────────────────────
function ListSkeleton({ count = 3 }) {
  return (
    <div className="space-y-2 animate-pulse">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="h-16 bg-muted rounded-xl" />
      ))}
    </div>
  );
}

export default function AnchorVillage() {
  const { village, villageId } = useVillage();
  const [tab, setTab]  = useState('vendors');

  const [vendors,       setVendors]       = useState([]);
  const [riders,        setRiders]        = useState([]);
  const [sevaProviders, setSevaProviders] = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [loadError,     setLoadError]     = useState(null);

  // ── Map vendor pins from real DB coordinates ──────────────
  // No Math.random — real lat/lng from vendor rows
  const vendorPins = vendors
    .filter(v => typeof v.lat === 'number' && typeof v.lng === 'number')
    .map(v => ({ id: v.id, name: v.business_name, lat: v.lat, lng: v.lng, category: v.category }));

  const loadData = async () => {
    if (!villageId) return;
    setLoading(true);
    setLoadError(null);

    const { vendors: v, riders: r, sevaProviders: s, errors } = await fetchVillageDirectory(villageId);

    if (errors.length > 0) {
      console.error('[AnchorVillage] Fetch errors:', errors);
      setLoadError('Some data failed to load. Pull to retry.');
    }

    setVendors(v);
    setRiders(r);
    setSevaProviders(s);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [villageId]);

  // ── Realtime: rider online status changes ─────────────────
  useEffect(() => {
    if (!isSupabaseConfigured) return; // demo mode has no real Supabase project — see CHANGELOG.md
    if (!villageId) return;
    const channel = supabase
      .channel(`village-riders-${villageId}`)
      .on('postgres_changes', {
        event:  'UPDATE',
        schema: 'public',
        table:  'riders',
        filter: `village_id=eq.${villageId}`,
      }, (payload) => {
        setRiders(prev => prev.map(r => r.id === payload.new.id ? { ...r, ...payload.new } : r));
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [villageId]);

  const villageName = village?.name ?? 'Village';
  const block       = village?.block ?? '';
  const population  = village?.population ?? 0;

  return (
    <div className="pb-6">
      <AppHeader
        title={`${villageName} Village`}
        subtitle={`${block}${block ? ' Block' : ''} · Pop. ${population > 0 ? (population / 1000).toFixed(1) + 'k' : '—'}`}
        showBack={false}
      />

      <div className="px-4 py-3 space-y-3">
        {/* Village Map — real coordinates, no Math.random */}
        <div className="w-full h-48 rounded-2xl overflow-hidden border border-border shadow-sm">
          <VillageMap
            villageName={villageName}
            vendors={vendorPins}
          />
        </div>

        {/* Error banner */}
        {loadError && (
          <Card className="p-3 border-destructive/20 bg-destructive/5 flex items-center justify-between">
            <p className="text-xs text-destructive">{loadError}</p>
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={loadData}>
              <RefreshCw className="w-3 h-3" /> Retry
            </Button>
          </Card>
        )}

        {/* Village header stats */}
        <Card className="p-4 border-border">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-xl font-bold text-primary">
                {loading ? <span className="inline-block w-6 h-5 bg-muted rounded animate-pulse" /> : vendors.length}
              </p>
              <p className="text-[10px] text-muted-foreground">Vendors</p>
            </div>
            <div>
              <p className="text-xl font-bold">
                {loading ? <span className="inline-block w-6 h-5 bg-muted rounded animate-pulse" /> : riders.length}
              </p>
              <p className="text-[10px] text-muted-foreground">Riders</p>
            </div>
            <div>
              <p className="text-xl font-bold">
                {loading ? <span className="inline-block w-6 h-5 bg-muted rounded animate-pulse" /> : sevaProviders.length}
              </p>
              <p className="text-[10px] text-muted-foreground">Seva Providers</p>
            </div>
          </div>
        </Card>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="vendors" className="text-xs">Vendors</TabsTrigger>
            <TabsTrigger value="riders"  className="text-xs">Riders</TabsTrigger>
            <TabsTrigger value="seva"    className="text-xs">Seva</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Vendors */}
        {tab === 'vendors' && (
          <div className="space-y-2">
            {loading ? <ListSkeleton count={3} /> : vendors.length === 0 ? (
              <Card className="p-6 border-border text-center">
                <p className="text-sm text-muted-foreground">No vendors registered yet</p>
              </Card>
            ) : vendors.map(v => (
              <Card key={v.id} className="p-3 border-border flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Store className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold truncate">{v.business_name}</p>
                    {v.is_verified
                      ? <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
                      : <XCircle    className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                  </div>
                  <p className="text-xs text-muted-foreground">{v.category}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                    <span className="text-xs">{v.rating?.toFixed(1) ?? '—'}</span>
                    <Badge className={`text-[9px] border-0 ${v.is_open ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {v.is_open ? 'Open' : 'Closed'}
                    </Badge>
                  </div>
                </div>
                {v.phone && (
                  <a href={`tel:${v.phone}`}>
                    <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0">
                      <Phone className="w-3.5 h-3.5" />
                    </Button>
                  </a>
                )}
              </Card>
            ))}
          </div>
        )}

        {/* Riders */}
        {tab === 'riders' && (
          <div className="space-y-2">
            {loading ? <ListSkeleton count={3} /> : riders.length === 0 ? (
              <Card className="p-6 border-border text-center">
                <p className="text-sm text-muted-foreground">No riders registered yet</p>
              </Card>
            ) : riders.map(r => (
              <Card key={r.id} className="p-3 border-border flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                    {(r.name ?? 'R').split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background
                    ${r.is_online ? 'bg-green-500' : 'bg-gray-400'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{r.name}</p>
                  <p className="text-xs text-muted-foreground">{r.zone} · {r.vehicle_type}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                    <span className="text-xs">{r.rating?.toFixed(1) ?? '—'}</span>
                    <span className="text-xs text-muted-foreground">{r.total_deliveries ?? 0} trips</span>
                  </div>
                </div>
                <div className="text-right shrink-0 flex flex-col items-end gap-1">
                  <Badge className={`text-[9px] border-0 ${r.is_online ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {r.is_online ? 'Online' : 'Offline'}
                  </Badge>
                  {r.phone && (
                    <a href={`tel:${r.phone}`}>
                      <Button size="icon" variant="ghost" className="h-8 w-8">
                        <Phone className="w-3.5 h-3.5" />
                      </Button>
                    </a>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Seva Providers */}
        {tab === 'seva' && (
          <div className="space-y-2">
            {loading ? <ListSkeleton count={3} /> : sevaProviders.length === 0 ? (
              <Card className="p-6 border-border text-center">
                <p className="text-sm text-muted-foreground">No seva providers registered yet</p>
              </Card>
            ) : sevaProviders.map(sp => (
              <Card key={sp.id} className="p-3 border-border flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                  {sp.image_url
                    ? <img src={sp.image_url} alt={sp.name} className="w-full h-full object-cover rounded-xl" />
                    : <Users className="w-5 h-5 text-accent" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{sp.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {sp.category} · ₹{sp.hourly_rate}/hr
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                    <span className="text-xs">{sp.rating?.toFixed(1) ?? '—'}</span>
                    <Badge className={`text-[9px] border-0 ${sp.is_available ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {sp.is_available ? 'Available' : 'Busy'}
                    </Badge>
                  </div>
                </div>
                {sp.phone && (
                  <a href={`tel:${sp.phone}`}>
                    <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0">
                      <Phone className="w-3.5 h-3.5" />
                    </Button>
                  </a>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
