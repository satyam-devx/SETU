import React from 'react';
import { Link } from 'react-router-dom';
import { Store, IndianRupee, BarChart3, CreditCard, Settings, HelpCircle, Star, Users, ChevronRight, LogOut, FileText, Award } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import AppHeader from '@/components/shared/AppHeader';

const menuItems = [
  { label: 'Earnings & Payouts', icon: IndianRupee, path: '/vendor/earnings', desc: 'Revenue, settlements & history' },
  { label: 'Analytics', icon: BarChart3, path: '/vendor/analytics', desc: 'Performance & insights' },
  { label: 'Customer Reviews', icon: Star, path: '/vendor/reviews', desc: 'View & respond to reviews' },
  { label: 'SETU Vendor Credit', icon: CreditCard, path: '/vendor/credit', desc: 'Working capital loans' },
  { label: 'Subscription', icon: Award, path: '/vendor/subscription', desc: 'Current plan: Pro' },
  { label: 'Business Documents', icon: FileText, path: '/vendor/documents', desc: 'FSSAI, GST, Bank details' },
  { label: 'Support', icon: HelpCircle, path: '/vendor/support', desc: 'Get help with your store' },
  { label: 'Settings', icon: Settings, path: '/vendor/settings', desc: 'Store hours, radius, preferences' },
];

export default function VendorProfile() {
  return (
    <div className="pb-20">
      <AppHeader title="Profile" />
      <div className="px-4 py-4">
        <Card className="p-4 border-border">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center">
              <Store className="w-8 h-8 text-accent" />
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-lg">Ramesh Kirana Store</h2>
              <p className="text-sm text-muted-foreground">Grocery & Essentials</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge className="bg-accent/10 text-accent text-[9px] border-0">✓ Verified</Badge>
                <Badge className="bg-primary/5 text-primary text-[9px] border-0">Pro</Badge>
                <div className="flex items-center gap-0.5">
                  <Star className="w-3 h-3 text-primary fill-primary" />
                  <span className="text-xs font-medium">4.5</span>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="px-4 mb-4 grid grid-cols-3 gap-2">
        <Card className="p-3 text-center border-border">
          <p className="text-xl font-bold text-primary">145</p>
          <p className="text-[10px] text-muted-foreground">Orders</p>
        </Card>
        <Card className="p-3 text-center border-border">
          <p className="text-xl font-bold text-accent">₹65K</p>
          <p className="text-[10px] text-muted-foreground">Revenue</p>
        </Card>
        <Card className="p-3 text-center border-border">
          <p className="text-xl font-bold text-foreground">128</p>
          <p className="text-[10px] text-muted-foreground">Reviews</p>
        </Card>
      </div>

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
          <div className="w-9 h-9 rounded-xl bg-destructive/10 flex items-center justify-center"><LogOut className="w-4 h-4" /></div>
          <span className="text-sm font-medium">Log Out</span>
        </button>
      </div>
    </div>
  );
}
