import React from 'react';
import { Link } from 'react-router-dom';
import { IndianRupee, Navigation, Star, FileText, HelpCircle, Settings, ChevronRight, LogOut, Shield, Award, Bell, Bike } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import AppHeader from '@/components/shared/AppHeader';
import { RIDERS } from '@/lib/mockData';

const rider = RIDERS[0];

const menuItems = [
  { label: 'Earnings History', icon: IndianRupee, path: '/rider/earnings', desc: 'Detailed payouts & incentives' },
  { label: 'Delivery History', icon: Navigation, path: '/rider/deliveries', desc: 'Past deliveries & performance' },
  { label: 'COD Deposit History', icon: FileText, path: '/rider/cod', desc: 'Cash deposit records' },
  { label: 'Documents', icon: Shield, path: '/rider/documents', desc: 'License, ID, vehicle registration' },
  { label: 'Notifications', icon: Bell, path: '/rider/notifications', desc: 'Alerts and updates' },
  { label: 'Support', icon: HelpCircle, path: '/rider/support', desc: 'Report issues, get help' },
  { label: 'Settings', icon: Settings, path: '/rider/settings', desc: 'Zone preference, vehicle, language' },
];

export default function RiderProfile() {
  const completionPct = Math.round((rider.todayDeliveries / 15) * 100);

  return (
    <div className="pb-20">
      <AppHeader title="Profile" />

      {/* Identity card */}
      <div className="px-4 py-4">
        <Card className="p-4 border-border">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Bike className="w-8 h-8 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-bold text-lg">{rider.name}</h2>
              <p className="text-sm text-muted-foreground">{rider.zone}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge className="bg-accent/10 text-accent text-[9px] border-0">✓ Verified</Badge>
                <Badge className="bg-primary/10 text-primary text-[9px] border-0">{rider.vehicleType}</Badge>
                <div className="flex items-center gap-0.5">
                  <Star className="w-3 h-3 text-primary fill-primary" />
                  <span className="text-xs font-medium">{rider.rating}</span>
                </div>
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">{rider.phone}</p>
        </Card>
      </div>

      {/* Stats */}
      <div className="px-4 mb-4 grid grid-cols-3 gap-2">
        <Card className="p-3 text-center border-border">
          <p className="text-xl font-bold text-primary">{rider.totalDeliveries}</p>
          <p className="text-[10px] text-muted-foreground">Deliveries</p>
        </Card>
        <Card className="p-3 text-center border-border">
          <p className="text-xl font-bold text-accent">₹{(rider.totalEarnings/1000).toFixed(0)}k</p>
          <p className="text-[10px] text-muted-foreground">Earned</p>
        </Card>
        <Card className="p-3 text-center border-border">
          <p className="text-xl font-bold text-foreground">{rider.rating}</p>
          <p className="text-[10px] text-muted-foreground">Rating</p>
        </Card>
      </div>

      {/* Daily target progress */}
      <div className="px-4 mb-4">
        <Card className="p-4 border-border bg-primary/5 border-primary/20">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Award className="w-4 h-4 text-primary" /> Today's Target
            </h3>
            <span className="text-xs text-primary font-bold">{rider.todayDeliveries}/15 deliveries</span>
          </div>
          <div className="w-full h-2 bg-primary/20 rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min(completionPct, 100)}%` }} />
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">Complete 15 deliveries to earn ₹200 bonus</p>
        </Card>
      </div>

      {/* COD balance */}
      <div className="px-4 mb-4">
        <Card className="p-4 border-border border-amber-200 bg-amber-50/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">COD Balance Pending</p>
              <p className="text-xl font-bold text-amber-700">₹{rider.codBalance.toLocaleString()}</p>
              <p className="text-xs text-amber-600">Deposit before 8 PM tonight</p>
            </div>
            <Badge className="bg-amber-100 text-amber-800 border-0">⏳ Due Today</Badge>
          </div>
        </Card>
      </div>

      {/* Menu */}
      <div className="px-4">
        {menuItems.map(item => (
          <Link key={item.label} to={item.path}>
            <div className="flex items-center gap-3 py-3 px-1 hover:bg-muted/50 rounded-lg transition-colors">
              <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
                <item.icon className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-[10px] text-muted-foreground">{item.desc}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
          </Link>
        ))}
        <Separator className="my-3" />
        <button className="flex items-center gap-3 py-3 px-1 text-destructive w-full">
          <div className="w-9 h-9 rounded-xl bg-destructive/10 flex items-center justify-center">
            <LogOut className="w-4 h-4" />
          </div>
          <span className="text-sm font-medium">Log Out</span>
        </button>
      </div>
    </div>
  );
}
