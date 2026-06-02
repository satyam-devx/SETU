import React, { useState } from 'react';
import { MapPin, TrendingUp, Plus, CheckCircle, Clock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppHeader from '@/components/shared/AppHeader';

const activeBlocks = [
  {
    name: 'Madhepur', district: 'Madhubani',
    villages: 12, activeVillages: 8,
    vendors: 48, riders: 12,
    gmv: 825000, readiness: 92, status: 'active',
  },
  {
    name: 'Jhanjharpur', district: 'Madhubani',
    villages: 15, activeVillages: 3,
    vendors: 12, riders: 4,
    gmv: 182000, readiness: 45, status: 'active',
  },
];

const pipeline = [
  { name: 'Rajnagar',   district: 'Madhubani', population: 35000, readiness: 28, anchors: 1 },
  { name: 'Benipatti',  district: 'Madhubani', population: 42000, readiness: 65, anchors: 2 },
  { name: 'Phulparas',  district: 'Madhubani', population: 28000, readiness: 40, anchors: 1 },
];

export default function SuperAdminExpansion() {
  const [showAdd, setShowAdd]         = useState(false);
  const [newBlock, setNewBlock]       = useState({ name: '', district: '' });

  return (
    <div className="pb-6">
      <AppHeader title="Expansion Engine" />
      <div className="p-4 space-y-4">

        {/* Summary */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <Card className="p-2 border-border">
            <p className="text-2xl font-bold text-primary">2</p>
            <p className="text-[10px] text-muted-foreground">Active Blocks</p>
          </Card>
          <Card className="p-2 border-border">
            <p className="text-2xl font-bold">3</p>
            <p className="text-[10px] text-muted-foreground">In Pipeline</p>
          </Card>
          <Card className="p-2 border-border">
            <p className="text-2xl font-bold text-green-600">1</p>
            <p className="text-[10px] text-muted-foreground">Districts</p>
          </Card>
        </div>

        {/* Active blocks */}
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
                      {b.activeVillages}/{b.villages} villages · {b.vendors} vendors · {b.riders} riders
                    </p>
                  </div>
                  <p className="text-sm font-bold shrink-0">₹{(b.gmv / 1000).toFixed(0)}k GMV</p>
                </div>
                <Progress value={b.readiness} className="h-1.5" />
                <p className="text-[10px] text-muted-foreground mt-0.5">{b.readiness}% platform readiness</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Expansion pipeline */}
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
                      {b.district} · Pop. {(b.population / 1000).toFixed(0)}k · {b.anchors} anchor{b.anchors > 1 ? 's' : ''}
                    </p>
                  </div>
                  <Badge className="text-[9px] bg-amber-100 text-amber-700 border-0">
                    {b.readiness}% ready
                  </Badge>
                </div>
                <Progress value={b.readiness} className="h-1.5 mb-2" />
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1 text-xs h-7">Accelerate</Button>
                  <Button size="sm" variant="outline" className="flex-1 text-xs h-7">View Plan</Button>
                </div>
              </Card>
            ))}
          </div>
        </Card>

        {/* Add new block */}
        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" /> Add New Block
          </h3>
          {showAdd ? (
            <div className="space-y-3">
              <div>
                <Label className="text-xs mb-1 block">Block Name</Label>
                <Input
                  placeholder="e.g. Madhwapur"
                  value={newBlock.name}
                  onChange={e => setNewBlock(b => ({ ...b, name: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs mb-1 block">District</Label>
                <Input
                  placeholder="e.g. Madhubani"
                  value={newBlock.district}
                  onChange={e => setNewBlock(b => ({ ...b, district: e.target.value }))}
                />
              </div>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => setShowAdd(false)}>Submit for Review</Button>
                <Button variant="outline" className="flex-1" onClick={() => setShowAdd(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" className="w-full gap-2 border-dashed" onClick={() => setShowAdd(true)}>
              <Plus className="w-4 h-4" /> Add Block to Pipeline
            </Button>
          )}
        </Card>
      </div>
    </div>
  );
}
