import React, { useState } from 'react';
import { Search, CheckCircle, XCircle, Star, MapPin } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { VENDORS } from '@/lib/mockData';

const pendingVendors = [
  { id: 'pv1', name: 'New Electronics Hub', category: 'Electronics', village: 'Madhepur', phone: '+91 98765 43230', appliedAt: '2025-05-30' },
  { id: 'pv2', name: 'Fresh Bakery House', category: 'Sweets & Snacks', village: 'Laxmipur', phone: '+91 98765 43231', appliedAt: '2025-05-31' },
];

export default function AdminVendors() {
  const [tab, setTab] = useState('active');

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold font-heading mb-1">Vendors</h1>
      <p className="text-sm text-muted-foreground mb-6">Manage vendor onboarding, verification, and performance</p>

      <Tabs value={tab} onValueChange={setTab} className="mb-4">
        <TabsList>
          <TabsTrigger value="active">Active ({VENDORS.length})</TabsTrigger>
          <TabsTrigger value="pending">Pending Approval ({pendingVendors.length})</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === 'pending' && (
        <div className="space-y-3 mb-6">
          {pendingVendors.map(v => (
            <Card key={v.id} className="p-4 border-border bg-amber-50/50 border-amber-200">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold">{v.name}</h4>
                  <p className="text-sm text-muted-foreground">{v.category} · {v.village} · Applied {v.appliedAt}</p>
                  <p className="text-xs text-muted-foreground">{v.phone}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="h-8 text-xs bg-accent hover:bg-accent/90"><CheckCircle className="w-3 h-3 mr-1" /> Approve</Button>
                  <Button size="sm" variant="outline" className="h-8 text-xs text-destructive"><XCircle className="w-3 h-3 mr-1" /> Reject</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === 'active' && (
        <>
          <div className="relative max-w-sm mb-4">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search vendors..." className="pl-10" />
          </div>
          <Card className="border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Vendor</TableHead>
                  <TableHead className="text-xs">Category</TableHead>
                  <TableHead className="text-xs">Village</TableHead>
                  <TableHead className="text-xs">Rating</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Plan</TableHead>
                  <TableHead className="text-xs">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {VENDORS.map(v => (
                  <TableRow key={v.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <img src={v.image} alt={v.name} className="w-8 h-8 rounded-lg object-cover" />
                        <div>
                          <p className="text-sm font-medium">{v.name}</p>
                          {v.isVerified && <Badge className="text-[8px] bg-accent/10 text-accent border-0">Verified</Badge>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">{v.category}</TableCell>
                    <TableCell className="text-xs flex items-center gap-1"><MapPin className="w-3 h-3" /> {v.village}</TableCell>
                    <TableCell className="text-xs"><Star className="w-3 h-3 text-primary fill-primary inline mr-1" />{v.rating}</TableCell>
                    <TableCell><Badge variant="outline" className={`text-[9px] ${v.isOpen ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>{v.isOpen ? 'Open' : 'Closed'}</Badge></TableCell>
                    <TableCell><Badge variant="outline" className="text-[9px]">{v.subscriptionTier}</Badge></TableCell>
                    <TableCell><Button variant="ghost" size="sm" className="text-xs h-7">View</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}