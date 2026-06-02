import React from 'react';
import { Link } from 'react-router-dom';
import { User, MapPin, CreditCard, HelpCircle, Settings, LogOut, ChevronRight, Star, Heart, Bell, Shield, FileText } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import AppHeader from '@/components/shared/AppHeader';

const menuItems = [
  { label: 'My Addresses', icon: MapPin, path: '/customer/addresses', desc: 'Manage delivery addresses' },
  { label: 'Wallet & Payments', icon: CreditCard, path: '/customer/wallet', desc: 'Balance, credit & transactions' },
  { label: 'SETU Credit', icon: Shield, path: '/customer/wallet', desc: 'Buy now, pay later' },
  { label: 'Notifications', icon: Bell, path: '/customer/notifications', desc: 'Manage notification preferences' },
  { label: 'My Reviews', icon: Star, path: '/customer/reviews', desc: 'Reviews you have given' },
  { label: 'Favorites', icon: Heart, path: '/customer/favorites', desc: 'Saved vendors & products' },
  { label: 'Government Schemes', icon: FileText, path: '/customer/schemes', desc: 'Eligible schemes near you' },
  { label: 'Help & Support', icon: HelpCircle, path: '/customer/support', desc: 'Get help with your orders' },
  { label: 'Settings', icon: Settings, path: '/customer/settings', desc: 'Language, privacy, account' },
];

export default function CustomerProfile() {
  return (
    <div className="pb-20">
      <AppHeader title="Profile" />

      {/* Profile card */}
      <div className="px-4 py-4">
        <Card className="p-4 border-border">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <User className="w-8 h-8 text-primary" />
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-lg">Anita Devi</h2>
              <p className="text-sm text-muted-foreground">+91 98765 43200</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">SETU Score: 720</span>
                <span className="text-xs text-muted-foreground">Madhepur</span>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Quick stats */}
      <div className="px-4 mb-4 grid grid-cols-3 gap-2">
        <Card className="p-3 text-center border-border">
          <p className="text-xl font-bold text-primary">28</p>
          <p className="text-[10px] text-muted-foreground">Orders</p>
        </Card>
        <Card className="p-3 text-center border-border">
          <p className="text-xl font-bold text-accent">₹1,250</p>
          <p className="text-[10px] text-muted-foreground">Wallet</p>
        </Card>
        <Card className="p-3 text-center border-border">
          <p className="text-xl font-bold text-foreground">350</p>
          <p className="text-[10px] text-muted-foreground">Credits</p>
        </Card>
      </div>

      {/* Menu items */}
      <div className="px-4">
        <div className="space-y-1">
          {menuItems.map((item, i) => (
            <Link key={item.label} to={item.path}>
              <div className="flex items-center gap-3 py-3 px-1 hover:bg-muted/50 rounded-lg transition-colors">
                <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
                  <item.icon className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </div>
            </Link>
          ))}
        </div>
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