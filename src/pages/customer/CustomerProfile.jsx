import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { User, Phone, MapPin, Star, ShoppingBag, Wallet, Gift, Settings, ChevronRight, Edit2, CheckCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import AppHeader from '@/components/shared/AppHeader';
import { useStore } from '@/lib/store';

export default function CustomerProfile() {
  const { state } = useStore();
  const user = state.currentUser;

  const [editing, setEditing] = useState(false);
  const [name, setName]       = useState(user.name);
  const [saved, setSaved]     = useState(false);

  const totalOrders = state.orders.filter(o => o.customerId === 'u1' || !o.customerId).length;
  const delivered   = state.orders.filter(o => o.status === 'delivered').length;

  const handleSave = () => {
    setSaved(true);
    setEditing(false);
    setTimeout(() => setSaved(false), 2000);
  };

  const MENU_ITEMS = [
    { label: 'My Orders',         icon: ShoppingBag, path: '/customer/orders',       badge: null },
    { label: 'Wallet & Payments', icon: Wallet,      path: '/customer/wallet',       badge: null },
    { label: 'SETU Credit',       icon: Star,        path: '/customer/credit',       badge: null },
    { label: 'My Addresses',      icon: MapPin,      path: '/customer/addresses',    badge: null },
    { label: 'Refer & Earn',      icon: Gift,        path: '/customer/referral',     badge: '₹100' },
    { label: 'Settings',          icon: Settings,    path: '/customer/settings',     badge: null },
  ];

  return (
    <div className="pb-20">
      <AppHeader title="My Profile" showBack />
      <div className="px-4 py-4 space-y-4">

        {/* Profile card */}
        <Card className="p-4 border-border">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary shrink-0">
              {name[0]}
            </div>
            <div className="flex-1 min-w-0">
              {editing ? (
                <div className="flex gap-2">
                  <Input value={name} onChange={e => setName(e.target.value)} className="h-8 text-sm flex-1" />
                  <Button size="sm" className="h-8" onClick={handleSave}>Save</Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold truncate">{name}</h2>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setEditing(true)}>
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}
              <div className="flex items-center gap-1.5 mt-0.5">
                <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">{user.phone}</p>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">{user.village}</p>
              </div>
            </div>
          </div>

          {saved && (
            <div className="flex items-center gap-2 text-green-600 text-xs mb-3">
              <CheckCircle className="w-3.5 h-3.5" /> Profile updated
            </div>
          )}

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 bg-muted/40 rounded-xl">
              <p className="text-lg font-bold">{totalOrders}</p>
              <p className="text-[10px] text-muted-foreground">Orders</p>
            </div>
            <div className="p-2 bg-muted/40 rounded-xl">
              <p className="text-lg font-bold text-primary">{user.setuScore}</p>
              <p className="text-[10px] text-muted-foreground">SETU Score</p>
            </div>
            <div className="p-2 bg-muted/40 rounded-xl">
              <p className="text-lg font-bold text-green-600">{delivered}</p>
              <p className="text-[10px] text-muted-foreground">Delivered</p>
            </div>
          </div>
        </Card>

        {/* SETU Score card */}
        <Card className="p-4 border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">SETU Score</p>
              <p className="text-3xl font-bold text-primary">{user.setuScore}</p>
              <Badge className="mt-1 text-[9px] bg-green-100 text-green-700 border-0">Good Standing</Badge>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Perks unlocked</p>
              <p className="text-sm font-medium">Credit · Schemes</p>
              <Link to="/customer/trust">
                <Button variant="ghost" size="sm" className="text-xs text-primary px-0 h-6">
                  View details →
                </Button>
              </Link>
            </div>
          </div>
        </Card>

        {/* Menu */}
        <Card className="border-border divide-y divide-border">
          {MENU_ITEMS.map(item => (
            <Link key={item.path} to={item.path}>
              <div className="flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors">
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <item.icon className="w-4 h-4 text-primary" />
                </div>
                <span className="text-sm font-medium flex-1">{item.label}</span>
                {item.badge && (
                  <Badge className="text-[9px] bg-accent/10 text-accent border-0">{item.badge}</Badge>
                )}
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </div>
            </Link>
          ))}
        </Card>
      </div>
    </div>
  );
}
