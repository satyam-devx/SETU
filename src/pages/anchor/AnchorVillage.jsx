import React, { useState } from 'react';
import { Search, UserCheck, UserX, Phone, ChevronRight, Star, TrendingUp, Clock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppHeader from '@/components/shared/AppHeader';

const members = [
  { id: 'u1', name: 'Anita Devi', phone: '98765 43200', role: 'customer', joined: '2024-12-01', orders: 24, creditScore: 720, kycStatus: 'verified', trustLevel: 'high', lastActive: '2h ago' },
  { id: 'u2', name: 'Raj Kumar', phone: '98765 43201', role: 'customer', joined: '2025-01-15', orders: 18, creditScore: 580, kycStatus: 'verified', trustLevel: 'medium', lastActive: '1d ago' },
  { id: 'u3', name: 'Priya Singh', phone: '98765 43202', role: 'customer', joined: '2025-02-10', orders: 8, creditScore: 680, kycStatus: 'verified', trustLevel: 'medium', lastActive: '3d ago' },
  { id: 'u4', name: 'Sunita Kumari', phone: '98765 43203', role: 'vendor', joined: '2025-03-05', orders: 0, creditScore: 0, kycStatus: 'pending', trustLevel: 'new', lastActive: '5h ago', pendingDocs: ['Aadhaar', 'Shop photo'] },
  { id: 'u5', name: 'Bhola Yadav', phone: '98765 43204', role: 'customer', joined: '2025-05-28', orders: 2, creditScore: 0, kycStatus: 'pending', trustLevel: 'new', lastActive: '1h ago', pendingDocs: ['Aadhaar'] },
];

const trustColors = { high: 'bg-green-100 text-green-800', medium: 'bg-amber-100 text-amber-800', new: 'bg-gray-100 text-gray-600', low: 'bg-red-100 text-red-800' };

export default function AnchorVillage() {
  const [search, setSearch] = useState('');
  const filtered = members.filter(m => m.name.toLowerCase().includes(search.toLowerCase()));
  const pending = members.filter(m => m.kycStatus === 'pending');
  const verified = members.filter(m => m.kycStatus === 'verified');

  return (
    <div className="pb-24">
      <AppHeader title="My Village" subtitle={`Madhepur · ${members.length} members`} showBack backTo="/anchor" />

      <div className="px-4 py-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search members..." className="pl-9 bg-muted/50 border-0" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <Tabs defaultValue="pending" className="px-4">
        <TabsList className="w-full mb-4">
          <TabsTrigger value="pending" className="flex-1">Pending KYC ({pending.length})</TabsTrigger>
          <TabsTrigger value="all" className="flex-1">All Members ({members.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <div className="mb-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <p className="text-xs text-amber-800 font-medium">⚠️ As the Village Anchor, you are responsible for verifying these people. Your reputation is tied to their behavior on SETU.</p>
          </div>
          {pending.map(m => (
            <Card key={m.id} className="p-4 border-amber-200 bg-amber-50/50 mb-3">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h4 className="font-semibold text-sm">{m.name}</h4>
                  <p className="text-xs text-muted-foreground">{m.phone} · {m.role}</p>
                </div>
                <Badge variant="outline" className="bg-amber-100 text-amber-800 text-[9px]">Pending KYC</Badge>
              </div>
              <div className="mb-3">
                <p className="text-xs text-muted-foreground mb-1">Missing documents:</p>
                <div className="flex gap-1 flex-wrap">
                  {m.pendingDocs?.map(doc => <Badge key={doc} variant="outline" className="text-[9px]">{doc}</Badge>)}
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="flex-1 h-8 text-xs bg-accent hover:bg-accent/90">
                  <UserCheck className="w-3 h-3 mr-1" /> Verify & Vouch
                </Button>
                <Button size="sm" variant="outline" className="flex-1 h-8 text-xs text-destructive">
                  <UserX className="w-3 h-3 mr-1" /> Reject
                </Button>
                <Button size="sm" variant="outline" className="h-8 w-8 shrink-0">
                  <Phone className="w-3 h-3" />
                </Button>
              </div>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="all">
          <div className="space-y-2">
            {filtered.map(m => (
              <Card key={m.id} className="p-3 border-border">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center font-bold text-primary text-sm shrink-0">
                    {m.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold">{m.name}</h4>
                      <Badge variant="outline" className={`text-[9px] ${trustColors[m.trustLevel]}`}>{m.trustLevel}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{m.role} · {m.orders} orders · Active {m.lastActive}</p>
                    {m.creditScore > 0 && <p className="text-[10px] text-muted-foreground">Credit Score: {m.creditScore}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {m.kycStatus === 'verified' ? (
                      <Badge className="bg-green-100 text-green-800 border-0 text-[9px]">✓ KYC</Badge>
                    ) : (
                      <Badge className="bg-amber-100 text-amber-800 border-0 text-[9px]">Pending</Badge>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
