import React, { useState } from 'react';
import { Search, Filter, Clock, MapPin, User as UserIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import StatusBadge from '@/components/shared/StatusBadge';
import { ORDERS, RIDERS } from '@/lib/mockData';

export default function AdminOrders() {
  const [statusFilter, setStatusFilter] = useState('all');
  const filtered = statusFilter === 'all' ? ORDERS : ORDERS.filter(o => o.status === statusFilter);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold font-heading mb-1">Orders</h1>
      <p className="text-sm text-muted-foreground mb-6">Manage and monitor all orders in Madhepur block</p>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search orders..." className="pl-10" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="preparing">Preparing</SelectItem>
            <SelectItem value="on_the_way">On the Way</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Order #</TableHead>
              <TableHead className="text-xs">Customer</TableHead>
              <TableHead className="text-xs">Vendor</TableHead>
              <TableHead className="text-xs">Rider</TableHead>
              <TableHead className="text-xs">Status</TableHead>
              <TableHead className="text-xs">Payment</TableHead>
              <TableHead className="text-xs text-right">Total</TableHead>
              <TableHead className="text-xs">Time</TableHead>
              <TableHead className="text-xs">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(order => (
              <TableRow key={order.id}>
                <TableCell className="text-xs font-mono">{order.orderNumber}</TableCell>
                <TableCell className="text-xs">{order.customerName}</TableCell>
                <TableCell className="text-xs">{order.vendorName}</TableCell>
                <TableCell className="text-xs">{order.riderName || <span className="text-amber-600">Unassigned</span>}</TableCell>
                <TableCell><StatusBadge status={order.status} /></TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[9px]">{order.paymentMethod}</Badge>
                </TableCell>
                <TableCell className="text-xs font-bold text-right">₹{order.total}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</TableCell>
                <TableCell>
                  {!order.riderId && order.status !== 'cancelled' && order.status !== 'delivered' && (
                    <Select>
                      <SelectTrigger className="h-7 text-xs w-28"><SelectValue placeholder="Assign rider" /></SelectTrigger>
                      <SelectContent>
                        {RIDERS.filter(r => r.isOnline).map(r => (
                          <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}