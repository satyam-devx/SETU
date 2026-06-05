import React, { useState } from 'react';
import { Bell, Globe, Moon, ChevronRight, LogOut, Bike } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import AppHeader from '@/components/shared/AppHeader';
import { useAuth } from '@/lib/AuthContext';

export default function RiderSettings() {
  const { signOut, userName, userPhone } = useAuth();

  const [notifs, setNotifs]           = useState(true);
  const [orderNotifs, setOrderNotifs] = useState(true);
  const [darkMode, setDarkMode]       = useState(false);
  const [offlineNav, setOfflineNav]   = useState(true);
  const [signingOut, setSigningOut]   = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
  };

  return (
    <div className="pb-6">
      <AppHeader title="Settings" showBack />
      <div className="px-4 py-4 space-y-4">

        {/* Account */}
        <Card className="p-4 border-border">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-chart-3/10 flex items-center justify-center">
              <Bike className="w-5 h-5 text-chart-3" />
            </div>
            <div>
              <p className="text-sm font-semibold">{userName || 'Rider'}</p>
              <p className="text-xs text-muted-foreground">{userPhone || '—'}</p>
              <Badge className="mt-0.5 text-[9px] bg-green-100 text-green-700 border-0">Active Rider</Badge>
            </div>
          </div>
        </Card>

        {/* Notifications & preferences */}
        <Card className="border-border divide-y divide-border">
          <div className="px-4 py-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Preferences</p>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-medium">Notifications</p>
              <p className="text-xs text-muted-foreground">Order alerts and platform updates</p>
            </div>
            <Switch checked={notifs} onCheckedChange={setNotifs} />
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-medium">New Order Sound</p>
              <p className="text-xs text-muted-foreground">Audio alert on new order available</p>
            </div>
            <Switch checked={orderNotifs} onCheckedChange={setOrderNotifs} />
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-medium">Offline Navigation</p>
              <p className="text-xs text-muted-foreground">Download maps for Madhubani district</p>
            </div>
            <Switch checked={offlineNav} onCheckedChange={setOfflineNav} />
          </div>
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
