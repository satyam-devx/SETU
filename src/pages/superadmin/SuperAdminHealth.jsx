import React, { useState } from 'react';
import { Activity, Server, Cpu, Database, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import AppHeader from '@/components/shared/AppHeader';

const uptimeData = [
  { time: '00:00', uptime: 100   },
  { time: '04:00', uptime: 100   },
  { time: '08:00', uptime: 99.8  },
  { time: '12:00', uptime: 100   },
  { time: '16:00', uptime: 100   },
  { time: '20:00', uptime: 99.7  },
  { time: 'Now',   uptime: 100   },
];

const services = [
  { name: 'API Gateway',        status: 'up',       latency: '38ms',  requests: '2.4k/min' },
  { name: 'Auth Service',       status: 'up',       latency: '22ms',  requests: '180/min'  },
  { name: 'Order Engine',       status: 'up',       latency: '65ms',  requests: '320/min'  },
  { name: 'Payment Service',    status: 'degraded', latency: '320ms', requests: '45/min'   },
  { name: 'AI / LLM Service',   status: 'up',       latency: '1.2s',  requests: '12/min'   },
  { name: 'Push Notifications', status: 'up',       latency: '105ms', requests: '800/min'  },
];

const resources = [
  { name: 'CPU',       value: 42 },
  { name: 'Memory',    value: 67 },
  { name: 'Storage',   value: 35 },
  { name: 'Bandwidth', value: 58 },
];

export default function SuperAdminHealth() {
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  return (
    <div className="pb-6">
      <AppHeader
        title="Platform Health"
        rightAction={
          <Button variant="ghost" size="icon" onClick={handleRefresh}>
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        }
      />
      <div className="p-4 space-y-4">

        {/* Top stats */}
        <div className="grid grid-cols-2 gap-2">
          <Card className="p-3 border-green-200 bg-green-50/40 text-center">
            <p className="text-2xl font-bold text-green-600">99.7%</p>
            <p className="text-xs text-muted-foreground">API Uptime (30d)</p>
          </Card>
          <Card className="p-3 border-border text-center">
            <p className="text-2xl font-bold">94</p>
            <p className="text-xs text-muted-foreground">Health Score</p>
          </Card>
        </div>

        {/* Uptime chart */}
        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" /> Uptime — Last 24h
          </h3>
          <div className="h-28">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={uptimeData}>
                <XAxis dataKey="time" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis
                  domain={[99, 100]}
                  tick={{ fontSize: 9 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={v => `${v}%`}
                />
                <Tooltip formatter={v => [`${v}%`, 'Uptime']} />
                <Line
                  type="monotone"
                  dataKey="uptime"
                  stroke="hsl(150, 40%, 40%)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Services */}
        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Server className="w-4 h-4 text-primary" /> Services
          </h3>
          <div className="space-y-2">
            {services.map(svc => (
              <div key={svc.name} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                <div className={`w-2 h-2 rounded-full shrink-0 ${svc.status === 'up' ? 'bg-green-500' : 'bg-amber-500'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{svc.name}</p>
                  <p className="text-xs text-muted-foreground">{svc.requests}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-medium">{svc.latency}</p>
                  <Badge
                    className={`text-[9px] border-0 ${svc.status === 'up' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}
                  >
                    {svc.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Resource usage */}
        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-primary" /> Resource Usage
          </h3>
          <div className="space-y-2">
            {resources.map(({ name, value }) => (
              <div key={name}>
                <div className="flex justify-between text-xs mb-1">
                  <span>{name}</span>
                  <span className="font-bold">{value}%</span>
                </div>
                <Progress value={value} className="h-1.5" />
              </div>
            ))}
          </div>
        </Card>

        {/* DB stats */}
        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Database className="w-4 h-4 text-primary" /> Database
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Avg Query Time', value: '4.2ms' },
              { label: 'Active Connections', value: '38' },
              { label: 'Cache Hit Rate', value: '96.4%' },
              { label: 'DB Size', value: '2.1 GB' },
            ].map(s => (
              <div key={s.label} className="p-2 bg-muted/40 rounded-lg">
                <p className="text-sm font-bold">{s.value}</p>
                <p className="text-[9px] text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
