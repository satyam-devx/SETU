import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi, RefreshCw, Package, Clock, AlertTriangle, CheckCircle, Download } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import AppHeader from '@/components/shared/AppHeader';

const cachedData = {
  lastSync: '2025-05-31 11:30 AM',
  vendors: 6,
  products: 42,
  cartItems: 2,
};

const pendingActions = [
  { id: 'a1', type: 'order', desc: 'Order for Basmati Rice — queued for sync', time: '11:45 AM', status: 'queued' },
  { id: 'a2', type: 'rating', desc: 'Rating for SETU-2025-0001 — queued', time: '11:50 AM', status: 'queued' },
];

export default function CustomerOffline() {
  const [isOnline, setIsOnline] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [reconnectProgress, setReconnectProgress] = useState(0);

  const tryReconnect = () => {
    setReconnecting(true);
    setReconnectProgress(0);
    const iv = setInterval(() => {
      setReconnectProgress(p => {
        if (p >= 100) {
          clearInterval(iv);
          setReconnecting(false);
          setIsOnline(true);
          return 100;
        }
        return p + 10;
      });
    }, 200);
  };

  return (
    <div className="pb-24 min-h-screen">
      <AppHeader title="Offline Mode" subtitle="Limited connectivity detected" />

      {/* Status hero */}
      <div className={`px-4 py-6 ${isOnline ? 'bg-accent/5' : 'bg-amber-50'} border-b border-border`}>
        <div className="flex flex-col items-center text-center">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 ${isOnline ? 'bg-accent/20' : 'bg-amber-100'}`}>
            {isOnline ? <Wifi className="w-10 h-10 text-accent" /> : <WifiOff className="w-10 h-10 text-amber-600" />}
          </div>
          <h2 className="text-xl font-bold mb-1">{isOnline ? 'Back Online!' : 'No Internet Connection'}</h2>
          <p className="text-sm text-muted-foreground max-w-xs">
            {isOnline ? 'Syncing your queued actions...' : 'SETU is working in offline mode. Some features are limited but your cart and cached products are available.'}
          </p>
          {!isOnline && !reconnecting && (
            <Button className="mt-4" onClick={tryReconnect}>
              <RefreshCw className="w-4 h-4 mr-2" /> Try to Reconnect
            </Button>
          )}
          {reconnecting && (
            <div className="mt-4 w-full max-w-xs">
              <p className="text-xs text-muted-foreground mb-2">Connecting to SETU servers...</p>
              <Progress value={reconnectProgress} className="h-2" />
            </div>
          )}
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Cached data */}
        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Download className="w-4 h-4 text-primary" /> Cached Data (Available Offline)
          </h3>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-muted rounded-xl p-3">
              <p className="text-xl font-bold text-primary">{cachedData.vendors}</p>
              <p className="text-[10px] text-muted-foreground">Vendors</p>
            </div>
            <div className="bg-muted rounded-xl p-3">
              <p className="text-xl font-bold text-primary">{cachedData.products}</p>
              <p className="text-[10px] text-muted-foreground">Products</p>
            </div>
            <div className="bg-muted rounded-xl p-3">
              <p className="text-xl font-bold text-primary">{cachedData.cartItems}</p>
              <p className="text-[10px] text-muted-foreground">Cart Items</p>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">Last synced: {cachedData.lastSync}</p>
        </Card>

        {/* Pending actions */}
        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-500" /> Queued Actions ({pendingActions.length})
          </h3>
          <p className="text-xs text-muted-foreground mb-3">These will be sent automatically when you reconnect:</p>
          {pendingActions.map(action => (
            <div key={action.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
              <Badge variant="outline" className="bg-amber-100 text-amber-800 text-[9px] shrink-0">{action.type}</Badge>
              <p className="text-xs flex-1">{action.desc}</p>
              <span className="text-[10px] text-muted-foreground">{action.time}</span>
            </div>
          ))}
        </Card>

        {/* What's available offline */}
        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3">What you can do offline:</h3>
          {[
            { label: 'Browse cached products & vendors', available: true },
            { label: 'View your cart', available: true },
            { label: 'Place orders (queued for sync)', available: true },
            { label: 'View past orders', available: true },
            { label: 'Read village noticeboard (cached)', available: true },
            { label: 'Check government schemes', available: true },
            { label: 'Track live order status', available: false },
            { label: 'UPI / Digital payments', available: false },
            { label: 'Real-time rider tracking', available: false },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3 py-1.5">
              {item.available ? <CheckCircle className="w-4 h-4 text-accent shrink-0" /> : <AlertTriangle className="w-4 h-4 text-muted-foreground/40 shrink-0" />}
              <span className={`text-sm ${item.available ? '' : 'text-muted-foreground line-through'}`}>{item.label}</span>
            </div>
          ))}
        </Card>

        {/* SMS fallback */}
        <Card className="p-4 bg-primary/5 border-primary/20">
          <h3 className="font-semibold text-sm mb-2">📱 No internet? Use SMS!</h3>
          <p className="text-xs text-muted-foreground mb-3">Send an SMS to <strong>+91 9876543000</strong> in Hindi or English:</p>
          <div className="space-y-1.5">
            {[
              { cmd: 'ORDER P1 1', desc: 'Order 1 Basmati Rice' },
              { cmd: 'STATUS O1', desc: 'Check order status' },
              { cmd: 'BALANCE', desc: 'Check wallet balance' },
              { cmd: 'CANCEL O1', desc: 'Cancel order' },
            ].map(c => (
              <div key={c.cmd} className="flex gap-3 items-center">
                <Badge variant="outline" className="font-mono text-[9px] shrink-0">{c.cmd}</Badge>
                <span className="text-xs text-muted-foreground">{c.desc}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
