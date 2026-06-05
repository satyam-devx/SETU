import React, { useState } from 'react';
import { Bell, Globe, Moon, ChevronRight, LogOut, Store, Clock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import AppHeader from '@/components/shared/AppHeader';
import { useAuth } from '@/lib/AuthContext';

const BUSINESS_HOURS = [
  { day: 'Monday – Friday', hours: '8:00 AM – 9:00 PM' },
  { day: 'Saturday',        hours: '8:00 AM – 10:00 PM' },
  { day: 'Sunday',          hours: '9:00 AM – 6:00 PM' },
];

export default function VendorSettings() {
  const { signOut, userName, userPhone } = useAuth();

  const [orderNotifs, setOrderNotifs] = useState(true);
  const [stockAlerts, setStockAlerts] = useState(true);
  const [darkMode, setDarkMode]       = useState(false);
  const [autoAccept, setAutoAccept]   = useState(false);
  const [signingOut, setSigningOut]   = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
  };

  return (
    <div className="pb-20">
      <AppHeader title="Settings" showBack />
      <div className="px-4 py-4 space-y-4">

        {/* Account */}
        <Card className="p-4 border-border">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-accent/10 flex items-center justify-center">
              <Store className="w-5 h-5 text-accent" />
            </div>
            <div>
              <p className="text-sm font-semibold">{userName || 'Vendor'}</p>
              <p className="text-xs text-muted-foreground">{userPhone || '—'}</p>
              <Badge className="mt-0.5 text-[9px] bg-green-100 text-green-700 border-0">Verified Vendor</Badge>
            </div>
          </div>
        </Card>

        {/* Order settings */}
        <Card className="border-border divide-y divide-border">
          <div className="px-4 py-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Order Settings</p>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-medium">New Order Alerts</p>
              <p className="text-xs text-muted-foreground">Sound + push notification</p>
            </div>
            <Switch checked={orderNotifs} onCheckedChange={setOrderNotifs} />
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-medium">Auto-Accept Orders</p>
              <p className="text-xs text-muted-foreground">Confirm within 3 minutes automatically</p>
            </div>
            <Switch checked={autoAccept} onCheckedChange={setAutoAccept} />
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-medium">Low Stock Alerts</p>
              <p className="text-xs text-muted-foreground">When stock drops below 5</p>
            </div>
            <Switch checked={stockAlerts} onCheckedChange={setStockAlerts} />
          </div>
        </Card>

        {/* Business hours */}
        <Card className="p-4 border-border">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" /> Business Hours
            </h3>
            <Button variant="ghost" size="sm" className="h-6 text-xs text-primary px-0">Edit</Button>
          </div>
          <div className="space-y-1.5">
            {BUSINESS_HOURS.map(bh => (
              <div key={bh.day} className="flex justify-between text-xs">
                <span className="text-muted-foreground">{bh.day}</span>
                <span className="font-medium">{bh.hours}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Appearance */}
        <Card className="border-border divide-y divide-border">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <Moon className="w-4 h-4 text-muted-foreground" />
              <p className="text-sm font-medium">Dark Mode</p>
            </div>
            <Switch checked={darkMode} onCheckedChange={setDarkMode} />
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <Globe className="w-4 h-4 text-muted-foreground" />
              <p className="text-sm font-medium">Language</p>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <span className="text-sm">Hindi</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </div>
        </Card>

        {/* Sign out */}
        <Button
          variant="outline"
          className="w-full gap-2 text-destructive border-destructive/30 hover:bg-destructive/5"
          onClick={handleSignOut}
          disabled={signingOut}
        >
          <LogOut className="w-4 h-4" />
          {signingOut ? 'Signing out...' : 'Sign Out'}
        </Button>

        <p className="text-center text-xs text-muted-foreground">SETU v1.0.0 · Made with ❤ for Bharat</p>
      </div>
    </div>
  );
}
