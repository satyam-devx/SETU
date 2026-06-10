import React, { useState, useEffect, useCallback } from 'react';
import { Search, Star, Phone, CheckCircle, Wrench, RefreshCw, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppHeader from '@/components/shared/AppHeader';
import { AdminAPI } from '@/lib/api';

const KYC_STYLE = {
  approved: 'bg-green-100 text-green-700',
  pending:  'bg-amber-100 text-amber-700',
  submitted:'bg-blue-100  text-blue-700',
  rejected: 'bg-red-100   text-red-700',
};

export default function AdminSevaProviders() {
  const [providers, setProviders] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [query,     setQuery]     = useState('');
  const [tab,       setTab]       = useState('all');
  const [toggling,  setToggling]  = useState(null);

  const loadProviders = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const { data, error } = await AdminAPI.getSevaProviders();
    if (error) setLoadError('Failed to load seva providers.');
    else setProviders(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { loadProviders(); }, [loadProviders]);

  const handleToggleAvailable = async (id, current) => {
    setToggling(id);
    const { error } = await AdminAPI.setSevaAvailable(id, !current);
    if (!error) setProviders(ps => ps.map(p => p.id === id ? { ...p, is_available: !current } : p));
    setToggling(null);
  };

  // ── Derived ────────────────────────────────────────────
  const availableCount = providers.filter(p => p.is_available).length;
  const verifiedCount  = providers.filter(p => p.is_verified).length;
  const pendingCount   = providers.filter(p => !p.is_verified && p.kyc_status !== 'rejected').length;

  const filtered = providers.filter(p => {
    const matchQ = !query
      || (p.name     ?? '').toLowerCase().includes(query.toLowerCase())
      || (p.category ?? '').toLowerCase().includes(query.toLowerCase())
      || (p.village  ?? '').toLowerCase().includes(query.toLowerCase());
    if (tab === 'available')  return matchQ && p.is_available;
    if (tab === 'offline')    return matchQ && !p.is_available;
    if (tab === 'unverified') return matchQ && !p.is_verified;
    return matchQ;
  });

  return (
    <div className="flex-1 overflow-auto">
      <AppHeader
        title="Seva Providers"
        subtitle={`${availableCount} available · ${providers.length} total`}
        rightAction={
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={loadProviders}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        }
      />
      <div className="p-4 space-y-4">

        {/* Summary */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <Card className="p-2 border-border">
            <p className="text-xl font-bold">{loading ? '…' : providers.length}</p>
            <p className="text-[10px] text-muted-foreground">Total</p>
          </Card>
          <Card className="p-2 border-border">
            <p className="text-xl font-bold text-green-600">{loading ? '…' : availableCount}</p>
            <p className="text-[10px] text-muted-foreground">Available</p>
          </Card>
          <Card className="p-2 border-border">
            <p className="text-xl font-bold text-primary">{loading ? '…' : verifiedCount}</p>
            <p className="text-[10px] text-muted-foreground">Verified</p>
          </Card>
        </div>

        {loadError && (
          <Card className="p-3 border-destructive/20 bg-destructive/5 flex items-center justify-between">
            <p className="text-xs text-destructive">{loadError}</p>
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={loadProviders}>
              <RefreshCw className="w-3 h-3" /> Retry
            </Button>
          </Card>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, category, village..."
            className="pl-9"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="all"        className="text-xs">All</TabsTrigger>
            <TabsTrigger value="available"  className="text-xs">Online</TabsTrigger>
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
            <Wrench className="w-7 h-7 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No providers in this category</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map(sp => {
              const isToggling = toggling === sp.id;

              return (
                <Card key={sp.id} className="p-4 border-border">
                  <div className="flex items-start gap-3 mb-3">
                    {sp.image_url ? (
                      <div className="w-12 h-12 rounded-xl bg-muted overflow-hidden shrink-0">
                        <img src={sp.image_url} alt={sp.name} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <Wrench className="w-5 h-5 text-primary" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold truncate">{sp.name}</p>
                        {sp.is_verified && <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {sp.category}{sp.village ? ` · ${sp.village}` : ''}
                      </p>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                          {sp.rating?.toFixed(1) ?? '—'}
                          {sp.review_count ? ` (${sp.review_count})` : ''}
                        </span>
                        {sp.hourly_rate > 0 && <span>₹{Number(sp.hourly_rate).toLocaleString()}/hr</span>}
                        {sp.jobs_completed > 0 && <span>{sp.jobs_completed} jobs</span>}
                      </div>
                    </div>
                    <Badge className={`shrink-0 text-[9px] border-0 ${KYC_STYLE[sp.kyc_status] ?? KYC_STYLE.pending}`}>
                      {sp.kyc_status}
                    </Badge>
                  </div>

                  {/* Skills chips */}
                  {Array.isArray(sp.skills) && sp.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {sp.skills.slice(0, 4).map(skill => (
                        <span key={skill} className="text-[10px] px-2 py-0.5 bg-muted rounded-full text-muted-foreground">
                          {skill}
                        </span>
                      ))}
                      {sp.skills.length > 4 && (
                        <span className="text-[10px] px-2 py-0.5 bg-muted rounded-full text-muted-foreground">
                          +{sp.skills.length - 4}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Available</span>
                      {isToggling
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Switch
                            checked={sp.is_available}
                            onCheckedChange={() => handleToggleAvailable(sp.id, sp.is_available)}
                          />
                      }
                    </div>
                    <div className="flex gap-1">
                      {sp.phone && (
                        <a href={`tel:${sp.phone}`}>
                          <Button size="sm" variant="outline" className="h-7 w-7 p-0">
                            <Phone className="w-3 h-3" />
                          </Button>
                        </a>
                      )}
                      <Button size="sm" variant="outline" className="h-7 text-xs">View</Button>
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
