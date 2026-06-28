// ═══════════════════════════════════════════════════════════
// SETU — SuperAdminBlocks  (v2 — Live DB)
// Fixed: reads real villages table grouped by block.
// ═══════════════════════════════════════════════════════════
import React, { useMemo } from 'react';
import { MapPin, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import AppHeader from '@/components/shared/AppHeader';
import BlocksMap from '@/components/maps/BlocksMap';
import { useDataFetch } from '@/hooks/useDataFetch';
import { supabase } from '@/lib/supabase';

async function fetchBlockData() {
  const [villagesRes, vendorsRes, ridersRes, customersRes] = await Promise.all([
    supabase.from('villages').select('*').order('block').order('name'),
    supabase.from('vendors').select('village_id, is_verified, is_active'),
    supabase.from('riders').select('village_id, is_online, is_active'),
    supabase.from('profiles').select('village_id, role').eq('role', 'customer'),
  ]);
  return {
    data: {
      villages:  villagesRes.data  ?? [],
      vendors:   vendorsRes.data   ?? [],
      riders:    ridersRes.data    ?? [],
      customers: customersRes.data ?? [],
    }
  };
}

export default function SuperAdminBlocks() {
  const { data, isLoading, error, refetch } = useDataFetch(
    fetchBlockData,
    [],
    { cacheKey: 'superadmin-blocks', staleTime: 60_000 }
  );

  const villages  = data?.villages  ?? [];
  const vendors   = data?.vendors   ?? [];
  const riders    = data?.riders    ?? [];
  const customers = data?.customers ?? [];

  // Group villages by block
  const blocks = useMemo(() => {
    const map = {};
    villages.forEach(v => {
      if (!map[v.block]) {
        map[v.block] = { name: v.block, district: v.district, villages: [], activeVillages: 0 };
      }
      map[v.block].villages.push(v);
      if (v.is_active) map[v.block].activeVillages++;
    });

    // Attach vendor/rider/customer counts per block
    return Object.values(map).map(block => {
      const villageIds = new Set(block.villages.map(v => v.id));
      const blockVendors   = vendors.filter(v => villageIds.has(v.village_id));
      const blockRiders    = riders.filter(r => villageIds.has(r.village_id));
      const blockCustomers = customers.filter(c => villageIds.has(c.village_id));
      return {
        ...block,
        totalVillages:  block.villages.length,
        vendors:        blockVendors.filter(v => v.is_verified && v.is_active !== false).length,
        riders:         blockRiders.filter(r => r.is_active !== false).length,
        onlineRiders:   blockRiders.filter(r => r.is_online).length,
        customers:      blockCustomers.length,
        population:     block.villages.reduce((s, v) => s + (v.population ?? 0), 0),
        hasAnchor:      block.villages.some(v => v.anchor_id),
      };
    });
  }, [villages, vendors, riders, customers]);

  return (
    <div className="flex-1 overflow-auto pb-6">
      <AppHeader
        title="Blocks & Geography"
        subtitle={`${blocks.length} blocks · ${villages.length} villages`}
        rightAction={
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={refetch} aria-label="Refresh blocks">
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        }
      />

      <div className="p-4 space-y-4 max-w-3xl">

        {/* Real interactive map (OpenStreetMap, no API key) */}
        {!isLoading && blocks.length > 0 && <BlocksMap blocks={blocks} />}

        {error && (
          <Card className="p-3 border-destructive/20 bg-destructive/5">
            <p className="text-xs text-destructive">{error.message}</p>
            <Button size="sm" variant="outline" className="mt-2" onClick={refetch}>Retry</Button>
          </Card>
        )}

        {isLoading && (
          <div className="space-y-3 animate-pulse">
            {[1,2,3].map(i => <div key={i} className="h-32 bg-muted rounded-xl" />)}
          </div>
        )}

        {!isLoading && blocks.length === 0 && (
          <Card className="p-6 border-border text-center">
            <MapPin className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No villages in the database yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Add villages to the <code className="bg-muted px-1 rounded">villages</code> table to see blocks here
            </p>
          </Card>
        )}

        <div className="space-y-4">
          {blocks.map(block => {
            const coveragePct = block.totalVillages > 0
              ? Math.round((block.activeVillages / block.totalVillages) * 100)
              : 0;
            const isActive = block.vendors > 0 || block.riders > 0;

            return (
              <Card key={block.name} className="p-4 border-border">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="font-semibold text-base">{block.name} Block</h3>
                      <Badge
                        variant="outline"
                        className={`text-[9px] ${isActive ? 'bg-green-100 text-green-800 border-green-200' : 'bg-gray-100 text-gray-600'}`}
                      >
                        {isActive ? 'Active' : 'Not started'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {block.district} District
                      {block.population > 0 ? ` · Pop. ${block.population.toLocaleString('en-IN')}` : ''}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 mb-3 text-center">
                  <div className="p-2 bg-muted/40 rounded-lg">
                    <p className="text-base font-bold">{block.vendors}</p>
                    <p className="text-[9px] text-muted-foreground">Vendors</p>
                  </div>
                  <div className="p-2 bg-muted/40 rounded-lg">
                    <p className="text-base font-bold">{block.riders}</p>
                    <p className="text-[9px] text-muted-foreground">Riders</p>
                  </div>
                  <div className="p-2 bg-muted/40 rounded-lg">
                    <p className="text-base font-bold">{block.customers}</p>
                    <p className="text-[9px] text-muted-foreground">Customers</p>
                  </div>
                  <div className="p-2 bg-muted/40 rounded-lg">
                    <p className="text-base font-bold">{block.onlineRiders}</p>
                    <p className="text-[9px] text-muted-foreground">Online</p>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Village coverage</span>
                    <span>{block.activeVillages}/{block.totalVillages} villages</span>
                  </div>
                  <Progress value={coveragePct} className="h-1.5" />
                </div>

                {/* Villages list */}
                {block.villages.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {block.villages.slice(0, 8).map(v => (
                      <Badge
                        key={v.id}
                        variant="outline"
                        className={`text-[9px] ${v.is_active ? 'border-green-200 text-green-700' : 'text-muted-foreground'}`}
                      >
                        {v.name}
                      </Badge>
                    ))}
                    {block.villages.length > 8 && (
                      <Badge variant="outline" className="text-[9px] text-muted-foreground">
                        +{block.villages.length - 8} more
                      </Badge>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
