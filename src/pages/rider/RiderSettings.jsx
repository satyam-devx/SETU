import React, { useState } from 'react';
import { Bell, Globe, Moon, ChevronRight, LogOut } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import AppHeader from '@/components/shared/AppHeader';

export default function RiderSettings() {
  const [notifs, setNotifs] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  return (
    <div className="pb-6">
      <AppHeader title="Settings" showBack />
      <div className="px-4 py-4 space-y-3">
        <Card className="border-border divide-y divide-border">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3"><Bell className="w-4 h-4 text-muted-foreground" /><span className="text-sm font-medium">Notifications</span></div>
            <Switch checked={notifs} onCheckedChange={setNotifs} />
          </div>
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3"><Moon className="w-4 h-4 text-muted-foreground" /><span className="text-sm font-medium">Dark Mode</span></div>
            <Switch checked={darkMode} onCheckedChange={setDarkMode} />
          </div>
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3"><Globe className="w-4 h-4 text-muted-foreground" /><span className="text-sm font-medium">Language</span></div>
            <div className="flex items-center gap-1 text-muted-foreground"><span className="text-sm">Hindi</span><ChevronRight className="w-4 h-4" /></div>
          </div>
        </Card>
        <Button variant="outline" className="w-full gap-2 text-destructive border-destructive/30 hover:bg-destructive/5">
          <LogOut className="w-4 h-4" /> Sign Out
        </Button>
      </div>
    </div>
  );
}
