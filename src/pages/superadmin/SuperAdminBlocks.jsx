import React from 'react';
import { MapPin, Store, Users, Bike, TrendingUp, CheckCircle, Clock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { VILLAGES } from '@/lib/mockData';

const blocks = [
  {
    id: 'b1', name: 'Madhepur', district: 'Madhubani', status: 'active',
    villages: 18, activeVillages: 12, population: 85000,
    vendors: 48, riders: 12, customers: 1850,
    monthlyGMV: 580000, ordersThisMonth: 325,
    launchDate: '2024-11-01', setuScore: 82,
  },
  {
    id: 'b2', name: 'Jhanjharpur', district: 'Madhubani', status: 'active',
    villages: 22, activeVillages: 8, population: 120000,
    vendors: 32, riders: 8, customers: 920,
    monthlyGMV: 245000, ordersThisMonth: 136,
    launchDate: '2025-01-15', setuScore: 68,
  },
  {
    id: 'b3', name: 'Rajnagar', district: 'Madhubani', status: 'onboarding',
    villages: 14, activeVillages: 0, population: 62000,
    vendors: 0, riders: 0, customers: 0,
    monthlyGMV: 0, ordersThisMonth: 0,
    launchDate: null, setuScore: 0,
  },
  {
    id: 'b4', name: 'Phulparas', district: 'Madhubani', status: 'planned',
    villages: 19, activeVillages: 0, population: 78000,
    vendors: 0, riders: 0, customers: 0,
    monthlyGMV: 0, ordersThisMonth: 0,
    launchDate: null, setuScore: 0,
  },
  {
    id: 'b5', name: 'Basopatti', district: 'Madhubani', status: 'planned',
    villages: 16, activeVillages: 0, population: 55000,
    vendors: 0, riders: 0, customers: 0,
    monthlyGMV: 0, ordersThisMonth: 0,
    launchDate: null, setuScore: 0,
  },
];

const statusConfig = {
  active: { label: 'Active', className: 'bg-green-100 text-green-800' },
  onboarding: { label: 'Onboarding', className: 'bg-amber-100 text-amber-800' },
  planned: { label: 'Planned', className: 'bg-gray-100 text-gray-600' },
};

export default function SuperAdminBlocks() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold font-heading mb-1">Blocks & Geography</h1>
      <p className="text-sm text-muted-foreground mb-6">Expand SETU block by block across Madhubani district</p>

      {/* Map placeholder */}
      <Card className="h-52 bg-muted border-border mb-6 flex items-center justify-center">
        <div className="text-center">
          <MapPin className="w-12 h-12 text-primary mx-auto mb-2" />
          <p className="font-semibold">Madhubani District Map</p>
          <p className="text-xs text-muted-foreground">Interactive block coverage view</p>
          <div className="flex gap-3 mt-3 justify-center text-xs">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-accent inline-block" /> Active</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-amber-500 inline-block" /> Onboarding</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-gray-400 inline-block" /> Planned</span>
          </div>
        </div>
      </Card>

      <div className="space-y-4">
        {blocks.map(block => (
          <Card key={block.id} className="p-5 border-border">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-base">{block.name} Block</h3>
                  <Badge variant="outline" className={`text-[9px] ${statusConfig[block.status].className}`}>
                    {statusConfig[block.status].label}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{block.district} District · Pop: {block.population.toLocaleString()}</p>
                {block.launchDate && <p className="text-xs text-muted-foreground">Launched: {new Date(block.launchDate).toLocaleDateString('en-IN')}</p>}
              </div>
              {block.status === 'active' && (
                <div className="text-right">
                  <p className="text-lg font-bold">₹{(block.monthlyGMV / 1000).toFixed(0)}K</p>
                  <p className="text-xs text-muted-foreground">monthly GMV</p>
                </div>
              )}
              {block.status === 'planned' && (
                <Button size="sm" className="text-xs h-7">Start Onboarding</Button>
              )}
            </div>

            {block.status === 'active' && (
              <>
                <div className="grid grid-cols-4 gap-3 mb-4">
                  <div className="text-center p-2 bg-muted rounded-lg">
                    <p className="text-lg font-bold">{block.vendors}</p>
                    <p className="text-[10px] text-muted-foreground">Vendors</p>
                  </div>
                  <div className="text-center p-2 bg-muted rounded-lg">
                    <p className="text-lg font-bold">{block.riders}</p>
                    <p className="text-[10px] text-muted-foreground">Riders</p>
                  </div>
                  <div className="text-center p-2 bg-muted rounded-lg">
                    <p className="text-lg font-bold">{block.customers.toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground">Customers</p>
                  </div>
                  <div className="text-center p-2 bg-muted rounded-lg">
                    <p className="text-lg font-bold">{block.ordersThisMonth}</p>
                    <p className="text-[10px] text-muted-foreground">Orders</p>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span>Village Coverage</span>
                    <span>{block.activeVillages}/{block.villages} villages · SETU Score: {block.setuScore}</span>
                  </div>
                  <Progress value={(block.activeVillages / block.villages) * 100} className="h-2" />
                </div>
              </>
            )}

            {block.status === 'onboarding' && (
              <div className="grid grid-cols-3 gap-3">
                {['Vendor Recruitment', 'Rider Hiring', 'Community Awareness'].map((step, i) => (
                  <div key={step} className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-center">
                    <Clock className="w-5 h-5 text-amber-600 mx-auto mb-1" />
                    <p className="text-xs font-medium">{step}</p>
                    <p className="text-[10px] text-muted-foreground">In Progress</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}