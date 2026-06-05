import React, { useState } from 'react';
import { Bell, Globe, Moon, Shield, Trash2, LogOut, ChevronRight, Smartphone } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import AppHeader from '@/components/shared/AppHeader';
import { useStore } from '@/lib/store';
import { useAuth } from '@/lib/AuthContext';

export default function CustomerSettings() {
  const { state }                   = useStore();
  const { signOut, userName, userPhone } = useAuth();

  const [notifs, setNotifs]           = useState(true);
  const [orderNotifs, setOrderNotifs] = useState(true);
  const [promoNotifs, setPromoNotifs] = useState(false);
  const [darkMode, setDarkMode]       = useState(false);
  const [biometric, setBiometric]     = useState(false);
  const [signingOut, setSigningOut]   = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
  };

  const displayName  = userName  || state.currentUser.name;
  const displayPhone = userPhone || state.currentUser.phone;

  return (
    <div className="pb-20">
      <AppHeader title="Settings" showBack />
      <div className="px-4 py-4 space-y-4">

        {/* Account info */}
        <Card className="p-4 border-border">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-lg">
              {displayName[0]}
            </div>
            <div>
              <p className="text-sm font-semibold">{displayName}</p>
              <p className="text-xs text-muted-foreground">{displayPhone}</p>
              <Badge className="mt-0.5 text-[9px] bg-green-100 text-green-700 border-0">Verified</Badge>
            </div>
          </div>
        </Card>

        {/* Notifications */}
        <Card className="border-border divide-y divide-border">
          <div className="px-4 py-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Notifications</p>
          </div>
          {[
            { label: 'All Notifications',    sub: 'Master toggle',        val: notifs,      set: setNotifs      },
            { label: 'Order Updates',        sub: 'Status, delivery etc.', val: orderNotifs, set: setOrderNotifs },
            { label: 'Promotions & Offers',  sub: 'Deals, cashback',      val: promoNotifs, set: setPromoNotifs },
          ].map(item => (
            <div key={item.label} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.sub}</p>
              </div>
              <Switch checked={item.val} onCheckedChange={item.set} />
            </div>
          ))}
        </Card>

        {/* Appearance */}
        <Card className="border-border divide-y divide-border">
          <div className="px-4 py-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Appearance</p>
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
              <div>
                <p className="text-sm font-medium">Language</p>
                <p className="text-xs text-muted-foreground">Current: Hindi</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
        </Card>

        {/* Security */}
        <Card className="border-border divide-y divide-border">
          <div className="px-4 py-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Security</p>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <Smartphone className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Biometric Login</p>
                <p className="text-xs text-muted-foreground">Fingerprint / Face ID</p>
              </div>
            </div>
            <Switch checked={biometric} onCheckedChange={setBiometric} />
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <Shield className="w-4 h-4 text-muted-foreground" />
              <p className="text-sm font-medium">Privacy Policy</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
        </Card>

        {/* Danger zone */}
        <Card className="border-border divide-y divide-border">
          <Button
            variant="ghost"
            className="w-full justify-start px-4 py-3 h-auto gap-3 text-destructive hover:text-destructive hover:bg-destructive/5"
          >
            <Trash2 className="w-4 h-4" />
            <div className="text-left">
              <p className="text-sm font-medium">Delete Account</p>
              <p className="text-xs text-muted-foreground">Permanently remove your data</p>
            </div>
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start px-4 py-3 h-auto gap-3 text-destructive hover:text-destructive hover:bg-destructive/5"
            onClick={handleSignOut}
            disabled={signingOut}
          >
            <LogOut className="w-4 h-4" />
            <p className="text-sm font-medium">{signingOut ? 'Signing out...' : 'Sign Out'}</p>
          </Button>
        </Card>

        <p className="text-center text-xs text-muted-foreground">SETU v1.0.0 · Made with ❤ for Bharat</p>
      </div>
    </div>
  );
}
