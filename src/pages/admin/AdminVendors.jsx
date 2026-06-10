import React, { useState, useEffect, useCallback } from 'react';
import { Search, Star, MapPin, CheckCircle, Phone, RefreshCw, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppHeader from '@/components/shared/AppHeader';
import { AdminAPI } from '@/lib/api';

export default function AdminVendors() {
  const [vendors,   setVendors]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [tab,       setTab]       = useState('active');
  const [query,     setQuery]     = useState('');
  const [toggling,  setToggling]  = useState(null);
  const [approving, setApproving] = useState(null);

  const loadVendors = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const { data, error } = await AdminAPI.getVendors();
    if (error) setLoadError('Failed to load vendors.');
    else setVendors(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { loadVendors(); }, [loadVendors]);

  const handleToggleOpen = async (vendorId, current) => {
    setToggling(vendorId);
    const { error } = await AdminAPI.setVendorOpen(vendorId, !current);
    if (!error) setVendors(vs => vs.map(v => v.id === vendorId ? { ...v, is_open: !current } : v));
    setToggling(null);
  };

  const handleApprove = async (vendorId) => {
    setApproving(vendorId);
    const { error } = await AdminAPI.approveVendor(vendorId);
    if (!error) setVendors(vs => vs.map(v => v.id === vendorId ? { ...v, is_verified: true, kyc_status: 'approved' } : v));
    setApproving(null);
  };

  // ── Derived ────────────────────────────────────────────
  const openCount       = vendors.filter(v => v.is_open).length;
  const verifiedCount   = vendors.filter(v => v.is_verified).length;
  const pendingCount    = vendors.filter(v => !v.is_verified && v.kyc_status !== 'rejected').length;

  const filtered = vendors.filter(v => {
    const matchQ = !query
      || (v.name ?? '').toLowerCase().includes(query.toLowerCase())
      || (v.village ?? '').toLowerCase().includes(query.toLowerCase());
    if (tab === 'active')     return matchQ && v.is_verified && v.is_open;
    if (tab === 'offline')    return matchQ && v.is_verified && !v.is_open;
    if (tab === 'unverified') return matchQ && !v.is_verified;
    return matchQ;
  });

  return (
    <div className="flex-1 overflow-auto">
      <AppHeader
        title="Vendors"
        subtitle={`${verifiedCount} verified · ${openCount} open`}
        rightAction={
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={loadVendors}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        }
      />
      <div className="p-4 space-y-4">

        <div className="grid grid-cols-3 gap-2 text-center">
          <Card className="p-2 border-border">
            <p className="text-xl font-bold text-green-600">{loading ? '…' : openCount}</p>
            <p className="text-[10px] text-muted-foreground">Open Now</p>
          </Card>
          <Card className="p-2 border-border">
            <p className="text-xl font-bold">{loading ? '…' : verifiedCount}</p>
            <p className="text-[10px] text-muted-foreground">Verified</p>
          </Card>
          <Card className="p-2 border-border">
            <p className="text-xl font-bold text-amber-500">{loading ? '…' : pendingCount}</p>
            <p className="text-[10px] text-muted-foreground">Pending</p>
          </Card>
        </div>

        {loadError && (
          <Card className="p-3 border-destructive/20 bg-destructive/5 flex items-center justify-between">
            <p className="text-xs text-destructive">{loadError}</p>
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={loadVendors}>
              <RefreshCw className="w-3 h-3" /> Retry
            </Button>
          </Card>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search vendors..."
            className="pl-9"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="active"     className="text-xs">Active</TabsTrigger>
            <TabsTrigger value="offline"    className="text-xs">Offline</TabsTrigger>
            <TabsTrigger value="unverified" className="text-xs">Pending</TabsTrigger>
          </TabsList>
        </Tabs>

        {loading ? (
          <div className="space-y-2 animate-pulse">
            {[1, 2, 3].map(i => <div key={i} className="h-32 bg-muted rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="p-6 border-border text-center">
            <p className="text-sm text-muted-foreground">No vendors in this category</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map(v => {
              const isToggling  = toggling  === v.id;
              const isApproving = approving === v.id;

              return (
                <Card key={v.id} className="p-4 border-border">
                  <div className="flex items-start gap-3 mb-3">
                    {v.image_url ? (
                      <div className="w-12 h-12 rounded-xl bg-muted overflow-hidden shrink-0">
                        <img src={v.image_url} alt={v.name} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-lg font-bold text-primary">
                          {(v.name ?? 'V')[0]}
                        </span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold truncate">{v.name}</p>
                        {v.is_verified && <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />}
                      </div>
                      <p className="text-xs text-muted-foreground">{v.category}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        {v.village && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />{v.village}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                          {v.rating?.toFixed(1) ?? '—'}
                        </span>
                      </div>
                    </div>
                    <Badge className={`shrink-0 text-[9px] border-0 ${v.is_open ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {v.is_open ? 'Open' : 'Closed'}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Store open</span>
                      {isToggling
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Switch
                            checked={v.is_open}
                            onCheckedChange={() => handleToggleOpen(v.id, v.is_open)}
                          />
                      }
                    </div>
                    <div className="flex gap-1">
                      {v.phone && (
                        <a href={`tel:${v.phone}`}>
                          <Button size="sm" variant="outline" className="h-7 w-7 p-0">
                            <Phone className="w-3 h-3" />
                          </Button>
                        </a>
                      )}
                      {!v.is_verified && (
                        <Button
                          size="sm"
                          className="h-7 text-xs gap-1"
                          disabled={isApproving}
                          onClick={() => handleApprove(v.id)}
                        >
                          {isApproving
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <><CheckCircle className="w-3 h-3" /> Approve</>
                          }
                        </Button>
                      )}
                      {v.is_verified && (
                        <Button size="sm" variant="outline" className="h-7 text-xs">View</Button>
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
