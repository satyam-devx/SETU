import React from 'react';
import { Globe, IndianRupee, Users, Store, Shield, Activity, CreditCard, AlertTriangle, TrendingUp, CheckCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import StatCard from '@/components/shared/StatCard';
import { SUPER_ADMIN_STATS, ANALYTICS_DATA, VILLAGES, AUDIT_LOG } from '@/lib/mockData';

const gmvTrend = [
  { month: 'Jan', gmv: 85000 }, { month: 'Feb', gmv: 125000 }, { month: 'Mar', gmv: 185000 },
  { month: 'Apr', gmv: 310000 }, { month: 'May', gmv: 825000 },
];

const blockHealth = [
  { name: 'Madhepur', orders: 461, vendors: 48, riders: 12, health: 94 },
  { name: 'Jhanjharpur', orders: 280, vendors: 32, riders: 8, health: 87 },
  { name: 'Rajnagar', orders: 0, vendors: 0, riders: 0, health: 0 },
];

export default function SuperAdminDashboard() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold font-heading">Platform Overview</h1>
          <p className="text-sm text-muted-foreground">SETU Control Center · All blocks · Real-time</p>
        </div>
        <div className="flex items-center gap-2">
          {SUPER_ADMIN_STATS.fraudAlerts > 0 && (
            <Badge className="bg-destructive text-destructive-foreground"><AlertTriangle className="w-3 h-3 mr-1" /> {SUPER_ADMIN_STATS.fraudAlerts} Fraud Alerts</Badge>
          )}
          <Badge variant="outline" className="text-xs"><Activity className="w-3 h-3 mr-1 inline" /> {SUPER_ADMIN_STATS.apiUptime}% Uptime</Badge>
        </div>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <StatCard title="Total GMV" value={`₹${(SUPER_ADMIN_STATS.totalGMV/100000).toFixed(1)}L`} trend="Monthly ₹8.25L" trendUp icon={IndianRupee} />
        <StatCard title="Active Blocks" value={`${SUPER_ADMIN_STATS.activeBlocks}/${SUPER_ADMIN_STATS.totalBlocks}`} icon={Globe} />
        <StatCard title="Total Customers" value={SUPER_ADMIN_STATS.totalCustomers.toLocaleString()} trend="15 new today" trendUp icon={Users} />
        <StatCard title="Credit Outstanding" value={`₹${(SUPER_ADMIN_STATS.creditOutstanding/1000).toFixed(0)}K`} subtitle={`${SUPER_ADMIN_STATS.defaultRate}% default`} icon={CreditCard} />
        <StatCard title="Platform Health" value={`${SUPER_ADMIN_STATS.platformHealth}%`} icon={Activity} />
      </div>

      {/* GMV Chart + Block health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card className="col-span-2 p-5 border-border">
          <h3 className="font-semibold text-sm mb-4">GMV Growth</h3>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={gmvTrend}>
                <defs>
                  <linearGradient id="saGmvGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(150, 40%, 40%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(150, 40%, 40%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v/1000).toFixed(0)}K`} />
                <Tooltip formatter={(v) => [`₹${v.toLocaleString()}`, 'GMV']} />
                <Area type="monotone" dataKey="gmv" stroke="hsl(150, 40%, 40%)" fill="url(#saGmvGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5 border-border">
          <h3 className="font-semibold text-sm mb-4">Block Health</h3>
          <div className="space-y-4">
            {blockHealth.map(block => (
              <div key={block.name}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{block.name}</span>
                  <span className={`text-xs font-bold ${block.health >= 90 ? 'text-accent' : block.health >= 70 ? 'text-amber-600' : 'text-muted-foreground'}`}>{block.health}%</span>
                </div>
                <Progress value={block.health} className="h-2" />
                <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                  <span>{block.orders} orders</span>
                  <span>{block.vendors} vendors</span>
                  <span>{block.riders} riders</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Credit + Security + Audit */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card className="p-5 border-border">
          <h3 className="font-semibold text-sm mb-4 flex items-center gap-2"><CreditCard className="w-4 h-4 text-primary" /> SETU Credit Overview</h3>
          <div className="space-y-3">
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Total Disbursed</span><span className="font-bold">₹{(SUPER_ADMIN_STATS.totalCreditDisbursed/1000).toFixed(0)}K</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Outstanding</span><span className="font-bold text-amber-600">₹{(SUPER_ADMIN_STATS.creditOutstanding/1000).toFixed(0)}K</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Default Rate</span><span className="font-bold text-accent">{SUPER_ADMIN_STATS.defaultRate}%</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Active Accounts</span><span className="font-bold">342</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Avg Credit Limit</span><span className="font-bold">₹3,200</span></div>
          </div>
        </Card>

        <Card className="p-5 border-border">
          <h3 className="font-semibold text-sm mb-4 flex items-center gap-2"><Shield className="w-4 h-4 text-destructive" /> Security Status</h3>
          <div className="space-y-3">
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">API Uptime</span><span className="font-bold text-accent">{SUPER_ADMIN_STATS.apiUptime}%</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Compliance Score</span><span className="font-bold">{SUPER_ADMIN_STATS.complianceScore}%</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Fraud Alerts</span><span className="font-bold text-destructive">{SUPER_ADMIN_STATS.fraudAlerts}</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">2FA Coverage</span><span className="font-bold text-accent">100%</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Last Security Audit</span><span className="font-bold">3 days ago</span></div>
          </div>
        </Card>

        <Card className="p-5 border-border">
          <h3 className="font-semibold text-sm mb-4">Recent Audit Log</h3>
          <div className="space-y-3">
            {AUDIT_LOG.map(log => (
              <div key={log.id} className="border-b border-border pb-2 last:border-0">
                <p className="text-xs font-medium">{log.action}</p>
                <p className="text-[10px] text-muted-foreground">{log.actor} · {log.entity}</p>
                <p className="text-[10px] text-muted-foreground/60">{new Date(log.timestamp).toLocaleString('en-IN')}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Compliance */}
      <Card className="p-5 border-border">
        <h3 className="font-semibold text-sm mb-3">Compliance & Regulatory</h3>
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'DPDP Act 2023', status: 'Compliant', color: 'text-accent' },
            { label: 'ONDC Integration', status: 'Active', color: 'text-accent' },
            { label: 'PCI-DSS (via Razorpay)', status: 'Compliant', color: 'text-accent' },
            { label: 'RBI Credit Guidelines', status: 'Review Pending', color: 'text-amber-600' },
          ].map(item => (
            <div key={item.label} className="text-center">
              <p className={`text-sm font-bold ${item.color}`}>{item.status}</p>
              <p className="text-xs text-muted-foreground">{item.label}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}