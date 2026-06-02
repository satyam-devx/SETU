import React, { useState } from 'react';
import { Activity, Wifi, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import AppHeader from '@/components/shared/AppHeader';

const services = [
  { name: 'Order API',            status: 'healthy',  uptime: 99.9, latency: '42ms' },
  { name: 'Payment Gateway',      status: 'healthy',  uptime: 99.7, latency: '180ms' },
  { name: 'Rider Tracking',       status: 'healthy',  uptime: 98.2, latency: '95ms' },
  { name: 'Notification Service', status: 'degraded', uptime: 97.1, latency: '320ms' },
  { name: 'Voice API',            status: 'healthy',  uptime: 99.5, latency: '210ms' },
];

const realtimeStats = [
  { label: 'Active Riders',  value: 8,  color: 'text-green-600' },
  { label: 'Pending Orders', value: 14, color: 'text-amber-600' },
  { label: 'Open Tickets',   value: 5,  color: 'text-blue-600'  },
  { label: 'Fraud Alerts',   value: 2,  color: 'text-red-600'   },
];

const villageNetwork = [
  { name: 'Madhepur',    coverage: 95 },
  { name: 'Laxmipur',   coverage: 88 },
  { name: 'Parsad',     coverage: 72 },
  { name: 'Jhanjharpur',coverage: 65 },
];

export default function AdminMonitoring() {
  const [refreshing, setRefreshing]   = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setLastRefresh(new Date());
      setRefreshing(false);
    }, 1000);
  };

  return (
    <div className="pb-6">
      <AppHeader
        title="Live Monitoring"
        rightAction={
          <Button variant="ghost" size="icon" onClick={handleRefresh}>
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        }
      />
      <div className="p-4 space-y-4">
        <p className="text-xs text-muted-foreground">
          Last updated: {lastRefresh.toLocaleTimeString()}
        </p>

        {/* Realtime stats */}
        <div className="grid grid-cols-2 gap-2">
          {realtimeStats.map(s => (
            <Card key={s.label} className="p-3 border-border text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
            </Card>
          ))}
        </div>

        {/* System health */}
        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" /> System Health
          </h3>
          <div className="space-y-3">
            {services.map(svc => (
              <div key={svc.name} className="flex items-center gap-3">
                {svc.status === 'healthy'
                  ? <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                  : <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />}
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="text-sm font-medium">{svc.name}</p>
                    <span className="text-xs text-muted-foreground">{svc.latency}</span>
                  </div>
                  <Progress value={svc.uptime} className="h-1.5" />
                  <p className="text-[10px] text-muted-foreground mt-0.5">{svc.uptime}% uptime</p>
                </div>
                <Badge
                  className={`text-[9px] shrink-0 border-0 ${
                    svc.status === 'healthy'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {svc.status}
                </Badge>
              </div>
            ))}
          </div>
        </Card>

        {/* Network coverage */}
        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Wifi className="w-4 h-4 text-primary" /> Network Coverage
          </h3>
          <div className="space-y-2">
            {villageNetwork.map(({ name, coverage }) => (
              <div key={name}>
                <div className="flex justify-between text-xs mb-1">
                  <span>{name}</span>
                  <span className="font-bold">{coverage}%</span>
                </div>
                <Progress
                  value={coverage}
                  className="h-1.5"
                />
              </div>
            ))}
          </div>
        </Card>

        {/* COD live */}
        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3">COD Cash Today</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center p-2 bg-green-50 rounded-lg">
              <p className="text-lg font-bold text-green-600">₹4,200</p>
              <p className="text-[10px] text-muted-foreground">Collected</p>
            </div>
            <div className="text-center p-2 bg-amber-50 rounded-lg">
              <p className="text-lg font-bold text-amber-600">₹1,800</p>
              <p className="text-[10px] text-muted-foreground">Pending</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
