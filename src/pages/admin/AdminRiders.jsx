import React from 'react';
import { MapPin, Star, IndianRupee, Phone } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import StatCard from '@/components/shared/StatCard';
import { RIDERS, ADMIN_STATS } from '@/lib/mockData';

export default function AdminRiders() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold font-heading mb-1">Riders</h1>
      <p className="text-sm text-muted-foreground mb-6">Monitor rider performance, assignments, and COD balances</p>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <StatCard title="Online Riders" value={`${ADMIN_STATS.activeRiders}`} subtitle={`of ${ADMIN_STATS.totalRiders} total`} />
        <StatCard title="COD Balance (All)" value={`₹${RIDERS.reduce((s, r) => s + r.codBalance, 0).toLocaleString()}`} />
        <StatCard title="Avg Rating" value={(RIDERS.reduce((s, r) => s + r.rating, 0) / RIDERS.length).toFixed(1)} />
      </div>

      {/* Map placeholder */}
      <Card className="h-48 bg-muted border-border mb-6 flex items-center justify-center">
        <div className="text-center">
          <MapPin className="w-10 h-10 text-primary mx-auto mb-2" />
          <p className="text-sm font-medium">Live Rider Map</p>
          <p className="text-xs text-muted-foreground">Madhepur Block</p>
        </div>
      </Card>

      <Card className="border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Rider</TableHead>
              <TableHead className="text-xs">Zone</TableHead>
              <TableHead className="text-xs">Status</TableHead>
              <TableHead className="text-xs">Today</TableHead>
              <TableHead className="text-xs">Earnings</TableHead>
              <TableHead className="text-xs">COD Balance</TableHead>
              <TableHead className="text-xs">Rating</TableHead>
              <TableHead className="text-xs">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {RIDERS.map(rider => (
              <TableRow key={rider.id}>
                <TableCell>
                  <div>
                    <p className="text-sm font-medium">{rider.name}</p>
                    <p className="text-[10px] text-muted-foreground">{rider.phone}</p>
                  </div>
                </TableCell>
                <TableCell className="text-xs">{rider.zone}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={`text-[9px] ${rider.isOnline ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                    {rider.isOnline ? 'Online' : 'Offline'}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs">{rider.todayDeliveries} deliveries</TableCell>
                <TableCell className="text-xs font-medium">₹{rider.todayEarnings}</TableCell>
                <TableCell className={`text-xs font-bold ${rider.codBalance > 1000 ? 'text-amber-600' : 'text-foreground'}`}>
                  ₹{rider.codBalance}
                  {rider.codBalance > 1000 && <Badge className="ml-1 text-[8px] bg-amber-100 text-amber-800 border-0">High</Badge>}
                </TableCell>
                <TableCell className="text-xs"><Star className="w-3 h-3 text-primary fill-primary inline mr-1" />{rider.rating}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" className="h-7 w-7"><Phone className="w-3 h-3" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}