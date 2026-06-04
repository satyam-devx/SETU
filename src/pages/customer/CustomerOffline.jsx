import React, { useState } from 'react';
import { WifiOff, Download, CheckCircle, Package, Map, Smartphone, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import AppHeader from '@/components/shared/AppHeader';

const OFFLINE_FEATURES = [
  { icon: Package, label: 'Browse saved catalog',    desc: 'View products saved during last sync',       available: true  },
  { icon: Map,     label: 'Offline map navigation',  desc: 'Navigate without internet',                  available: true  },
  { icon: Package, label: 'Place COD orders',        desc: 'Orders sync when back online',               available: true  },
  { icon: Smartphone, label: 'Voice order (offline)', desc: 'Basic voice commands without cloud AI',    available: false },
];

export default function CustomerOffline() {
  const [syncing, setSyncing]     = useState(false);
  const [synced, setSynced]       = useState(false);
  const [syncProgress, setSyncProg] = useState(0);
  const [isOnline]                = useState(navigator.onLine ?? true);

  const handleSync = () => {
    setSyncing(true);
    setSyncProg(0);
    const interval = setInterval(() => {
      setSyncProg(p => {
        if (p >= 100) { clearInterval(interval); setSyncing(false); setSynced(true); return 100; }
        return p + 10;
      });
    }, 150);
  };

  return (
    <div className="pb-6">
      <AppHeader title="Offline Mode" showBack />
      <div className="px-4 py-4 space-y-4">

        {/* Status */}
        <Card className={`p-4 border ${isOnline ? 'border-green-200 bg-green-50/40' : 'border-amber-200 bg-amber-50/40'}`}>
          <div className="flex items-center gap-3">
            {isOnline
              ? <CheckCircle className="w-8 h-8 text-green-600 shrink-0" />
              : <WifiOff className="w-8 h-8 text-amber-600 shrink-0" />
            }
            <div>
              <p className="text-sm font-semibold">{isOnline ? 'You are Online' : 'You are Offline'}</p>
              <p className="text-xs text-muted-foreground">
                {isOnline ? 'All features available. Tap sync to update offline cache.' : 'Offline features active. Orders will sync when connected.'}
              </p>
            </div>
          </div>
        </Card>

        {/* Sync button */}
        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Download className="w-4 h-4 text-primary" /> Sync for Offline Use
          </h3>
          {syncing ? (
            <div>
              <Progress value={syncProgress} className="h-2 mb-2" />
              <p className="text-xs text-muted-foreground text-center">Syncing data... {syncProgress}%</p>
            </div>
          ) : synced ? (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="w-4 h-4" />
              <p className="text-sm font-medium">Synced successfully!</p>
            </div>
          ) : (
            <Button className="w-full gap-2" onClick={handleSync} disabled={!isOnline}>
              <RefreshCw className="w-4 h-4" />
              Sync Now
            </Button>
          )}
          {synced && (
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="bg-muted/40 rounded-lg p-2">
                <p className="font-bold">10</p>
                <p className="text-muted-foreground">Products</p>
              </div>
              <div className="bg-muted/40 rounded-lg p-2">
                <p className="font-bold">6</p>
                <p className="text-muted-foreground">Vendors</p>
              </div>
              <div className="bg-muted/40 rounded-lg p-2">
                <p className="font-bold">3</p>
                <p className="text-muted-foreground">Villages</p>
              </div>
            </div>
          )}
        </Card>

        {/* Features */}
        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3">Offline Capabilities</h3>
          <div className="space-y-3">
            {OFFLINE_FEATURES.map(f => (
              <div key={f.label} className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${f.available ? 'bg-primary/10' : 'bg-muted'}`}>
                  <f.icon className={`w-4 h-4 ${f.available ? 'text-primary' : 'text-muted-foreground'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{f.label}</p>
                    {!f.available && <Badge className="text-[9px] bg-muted text-muted-foreground border-0">Soon</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">{f.desc}</p>
                </div>
                {f.available
                  ? <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                  : <div className="w-4 h-4 rounded-full border-2 border-border shrink-0" />
                }
              </div>
            ))}
          </div>
        </Card>

        {/* Low bandwidth tip */}
        <Card className="p-3 border-blue-100 bg-blue-50/40">
          <p className="text-xs text-blue-800 font-medium mb-1">💡 Low Data Mode</p>
          <p className="text-xs text-blue-700">SETU uses less than 2MB per session in low-bandwidth mode. Text-only browsing uses under 500KB.</p>
        </Card>
      </div>
    </div>
  );
}
