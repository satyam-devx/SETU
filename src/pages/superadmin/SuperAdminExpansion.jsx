// ═══════════════════════════════════════════════════════════
// SETU — SuperAdminExpansion  (v2 — Live DB)
// Real expansion view derived from the villages/vendors/riders
// tables. Active blocks (have vendors or riders) vs pipeline
// blocks (mapped villages, not yet activated). No mock data.
// ═══════════════════════════════════════════════════════════
import React, { useMemo } from 'react';
import { TrendingUp, CheckCircle, Clock, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import AppHeader from '@/components/shared/AppHeader';
import { useDataFetch } from '@/hooks/useDataFetch';
import { supabase } from '@/lib/supabase';

async function fetchExpansionData() {
  const [villagesRes, vendorsRes, ridersRes] = await Promise.all([
    supabase.from('villages').select('*').order('block').order('name'),
    supabase.from('vendors').select('village_id, is_verified, is_active'),
    supabase.from('riders').select('village_id, is_active'),
  ]);
  const firstError = villagesRes.error || vendorsRes.error || ridersRes.error || null;
  if (firstError) return { error: firstError };
  return {
    data: {
      villages: villagesRes.data ?? [],
      vendors:  vendorsRes.data  ?? [],
      riders:   ridersRes.data   ?? [],
    },
  };
}

export default function SuperAdminExpansion() {
  const { data, isLoading, error, refetch } = useDataFetch(
    fetchExpansionData,
    [],
    { cacheKey: 'superadmin-expansion', staleTime: 60_000 }
  );

  const villages = data?.villages ?? [];
  const vendors  = data?.vendors  ?? [];
  const riders   = data?.riders   ?? [];

  const blocks = useMemo(() => {
    const map = {};
    villages.forEach(v => {
      if (!v.block) return;
      if (!map[v.block]) {
        map[v.block] = { name: v.block, district: v.district, villages: [], activeVillages: 0, population: 0 };
      }
      map[v.block].villages.push(v);
      if (v.is_active) map[v.block].activeVillages++;
      map[v.block].population += v.population ?? 0;
    });
    return Object.values(map).map(block => {
      const villageIds = new Set(block.villages.map(v => v.id));
      const blockVendors = vendors.filter(v => villageIds.has(v.village_id) && v.is_verified && v.is_active !== false).length;
      const blockRiders  = riders.filter(r => villageIds.has(r.village_id) && r.is_active !== false).length;
      const totalVillages = block.villages.length;
      const readiness = totalVillages > 0 ? Math.round((block.activeVillages / totalVillages) * 100) : 0;
      const anchors = block.villages.filter(v => v.anchor_id).length;
      return {
        ...block,
        totalVillages,
        vendors: blockVendors,
        riders:  blockRiders,
        readiness,
        anchors,
        isActive: blockVendors > 0 || blockRiders > 0,
      };
    });
  }, [villages, vendors, riders]);

  const activeBlocks = blocks.filter(b => b.isActive);
  const pipeline     = blocks.filter(b => !b.isActive);
  const districtCount = new Set(villages.map(v => v.district).filter(Boolean)).size;

  return (
    <div className="pb-6">
      <AppHeader
        title="Expansion Engine"
        subtitle="Block rollout across geographies"
        rightAction={
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={refetch} aria-label="Refresh expansion data">
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        }
      />
      <div className="p-4 space-y-4 max-w-2xl">

        {error && (
          <Card className="p-3 border-destructive/20 bg-destructive/5">
            <p className="text-xs text-destructive">{error.message ?? 'Failed to load expansion data.'}</p>
            <Button size="sm" variant="outline" className="mt-2" onClick={refetch}>Retry</Button>
          </Card>
        )}

        {/* Summary */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <Card className="p-2 border-border">
            <p className="text-2xl font-bold text-primary">{isLoading ? '…' : activeBlocks.length}</p>
            <p className="text-[10px] text-muted-foreground">Active Blocks</p>
          </Card>
          <Card className="p-2 border-border">
            <p className="text-2xl font-bold">{isLoading ? '…' : pipeline.length}</p>
            <p className="text-[10px] text-muted-foreground">In Pipeline</p>
          </Card>
          <Card className="p-2 border-border">
            <p className="text-2xl font-bold text-green-600">{isLoading ? '…' : districtCount}</p>
            <p className="text-[10px] text-muted-foreground">Districts</p>
          </Card>
        </div>

        {isLoading && (
          <div className="space-y-3 animate-pulse">
            {[1,2].map(i => <div key={i} className="h-28 bg-muted rounded-xl" />)}
          </div>
        )}

        {!isLoading && blocks.length === 0 && (
          <Card className="p-6 border-border text-center">
            <p className="text-sm text-muted-foreground">No blocks mapped yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Add villages with a <code className="bg-muted px-1 rounded">block</code> to begin rollout.
            </p>
          </Card>
        )}

        {/* Active blocks */}
        {!isLoading && activeBlocks.length > 0 && (
          <Card className="p-4 border-border">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" /> Active Blocks
            </h3>
            <div className="space-y-4">
              {activeBlocks.map(b => (
                <div key={b.name}>
                  <div className="flex items-start justify-between mb-1">
                    <div>
                      <p className="text-sm font-semibold">{b.name} Block</p>
                      <p className="text-xs text-muted-foreground">
                        {b.activeVillages}/{b.totalVillages} villages · {b.vendors} vendors · {b.riders} riders
                      </p>
                    </div>
                    <Badge className="text-[9px] bg-green-100 text-green-700 border-0 shrink-0">{b.readiness}% ready</Badge>
                  </div>
                  <Progress value={b.readiness} className="h-1.5" />
                  <p className="text-[10px] text-muted-foreground mt-0.5">{b.readiness}% village coverage</p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Pipeline */}
        {!isLoading && pipeline.length > 0 && (
          <Card className="p-4 border-border">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" /> Expansion Pipeline
            </h3>
            <div className="space-y-3">
              {pipeline.map(b => (
                <Card key={b.name} className="p-3 border-border">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-sm font-semibold">{b.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {b.district ? `${b.district} · ` : ''}{b.totalVillages} villages
                        {b.population > 0 ? ` · Pop. ${(b.population / 1000).toFixed(0)}k` : ''}
                        {` · ${b.anchors} anchor${b.anchors === 1 ? '' : 's'}`}
                      </p>
                    </div>
                    <Badge className="text-[9px] bg-amber-100 text-amber-700 border-0 shrink-0">
                      {b.readiness}% ready
                    </Badge>
                  </div>
                  <Progress value={b.readiness} className="h-1.5" />
                </Card>
              ))}
            </div>
          </Card>
        )}

        {!isLoading && (
          <Card className="p-3 border-blue-200 bg-blue-50/40 flex items-start gap-2">
            <TrendingUp className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-800">
              Blocks and villages are managed from the <span className="font-semibold">Blocks &amp; Geo</span> and
              Admin → Villages screens. A block activates automatically once it has verified vendors or active riders.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
