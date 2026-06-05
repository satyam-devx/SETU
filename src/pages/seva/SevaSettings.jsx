import React, { useState } from 'react';
import { Bell, Globe, Moon, ChevronRight, LogOut, Wrench } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import AppHeader from '@/components/shared/AppHeader';
import { useAuth } from '@/lib/AuthContext';

const RADIUS_OPTIONS = ['2 km', '5 km', '10 km', '15 km'];

export default function SevaSettings() {
  const { signOut, userName, userPhone } = useAuth();

  const [notifs, setNotifs]           = useState(true);
  const [available, setAvailable]     = useState(true);
  const [darkMode, setDarkMode]       = useState(false);
  const [selectedRadius, setRadius]   = useState('5 km');
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
            <div className="w-11 h-11 rounded-xl bg-chart-4/10 flex items-center justify-center">
              <Wrench className="w-5 h-5 text-chart-4" />
            </div>
            <div>
              <p className="text-sm font-semibold">{userName || 'Seva Provider'}</p>
              <p className="text-xs text-muted-foreground">{userPhone || '—'}</p>
              <Badge className="mt-0.5 text-[9px] bg-green-100 text-green-700 border-0">Active Provider</Badge>
            </div>
          </div>
        </Card>

        {/* Availability and notifications */}
        <Card className="border-border divide-y divide-border">
          <div className="px-4 py-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Availability</p>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-medium">Job Notifications</p>
              <p className="text-xs text-muted-foreground">Alerts for new job requests</p>
            </div>
            <Switch checked={notifs} onCheckedChange={setNotifs} />
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-medium">Availability Status</p>
              <p className="text-xs text-muted-foreground">
                {available ? 'Accepting new jobs' : 'Not accepting jobs'}
              </p>
            </div>
            <Switch checked={available} onCheckedChange={setAvailable} />
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

        {/* Service radius */}
        <Card className="p-4 border-border">
          <h3 className="text-sm font-semibold mb-3">Service Radius</h3>
          <div className="flex gap-2 flex-wrap">
            {RADIUS_OPTIONS.map(r => (
              <button
                key={r}
                onClick={() => setRadius(r)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  selectedRadius === r
                    ? 'bg-primary text-white border-primary'
                    : 'border-border bg-card text-foreground'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            You will only receive job requests within {selectedRadius} of your location.
          </p>
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
