import React, { useState, useEffect, useCallback } from 'react';
import { MapPin, RefreshCw, Search } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import AppHeader from '@/components/shared/AppHeader';
import { AdminAPI } from '@/lib/api';

export default function AdminVillages() {
  const [villages,  setVillages]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [query,     setQuery]     = useState('');

  const loadVillages = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const { data, error } = await AdminAPI.getVillages();
    if (error) setLoadError('Failed to load village data.');
    else setVillages(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { loadVillages(); }, [loadVillages]);

  // ── Derived ────────────────────────────────────────────
  const activeCount   = villages.filter(v => v.is_active).length;
  const inactiveCount = villages.filter(v => !v.is_active).length;

  const filtered = villages.filter(v =>
    !query
    || (v.name     ?? '').toLowerCase().includes(query.toLowerCase())
    || (v.block    ?? '').toLowerCase().includes(query.toLowerCase())
    || (v.district ?? '').toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="flex-1 overflow-auto">
      <AppHeader
        title="Villages"
        subtitle={`${activeCount} active`}
        rightAction={
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={loadVillages}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        }
      />
      <div className="p-4 space-y-3">

        {/* Summary */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <Card className="p-2 border-border">
            <p className="text-xl font-bold">{loading ? '…' : villages.length}</p>
            <p className="text-[10px] text-muted-foreground">Total</p>
          </Card>
          <Card className="p-2 border-border">
            <p className="text-xl font-bold text-green-600">{loading ? '…' : activeCount}</p>
            <p className="text-[10px] text-muted-foreground">Active</p>
          </Card>
          <Card className="p-2 border-border">
            <p className="text-xl font-bold text-muted-foreground">{loading ? '…' : inactiveCount}</p>
            <p className="text-[10px] text-muted-foreground">Inactive</p>
          </Card>
        </div>

        {loadError && (
          <Card className="p-3 border-destructive/20 bg-destructive/5 flex items-center justify-between">
            <p className="text-xs text-destructive">{loadError}</p>
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={loadVillages}>
              <RefreshCw className="w-3 h-3" /> Retry
            </Button>
          </Card>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, block, district..."
            className="pl-9"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="space-y-2 animate-pulse">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-28 bg-muted rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="p-6 border-border text-center">
            <MapPin className="w-7 h-7 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No villages found</p>
          </Card>
        ) : (
          filtered.map(v => (
            <Card
              key={v.id}
              className={`p-4 border transition-opacity ${v.is_active ? 'border-border' : 'border-border opacity-60'}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold">{v.name}</p>
                    <Badge className={`text-[9px] border-0 ${v.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {v.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {[v.block ? `${v.block} Block` : null, v.district].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-primary">{v.health}%</p>
                  <p className="text-[10px] text-muted-foreground">health</p>
                </div>
              </div>

              <Progress value={v.health} className="h-1.5 mb-3" />

              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div className="bg-muted/40 rounded-lg p-1.5">
                  <p className="font-bold">
                    {v.population > 0 ? `${(v.population / 1000).toFixed(0)}k` : '—'}
                  </p>
                  <p className="text-muted-foreground">People</p>
                </div>
                <div className="bg-muted/40 rounded-lg p-1.5">
                  <p className="font-bold">{v.totalVendors}</p>
                  <p className="text-muted-foreground">Vendors</p>
                </div>
                <div className="bg-muted/40 rounded-lg p-1.5">
                  <p className="font-bold text-green-600">{v.activeVendors}</p>
                  <p className="text-muted-foreground">Open</p>
                </div>
                <div className="bg-muted/40 rounded-lg p-1.5">
                  <p className="font-bold">{v.totalOrders}</p>
                  <p className="text-muted-foreground">Orders</p>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
