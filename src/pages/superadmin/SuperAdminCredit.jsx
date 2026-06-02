import React from 'react';
import { CreditCard, TrendingUp, AlertTriangle, CheckCircle, Users } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, BarChart, Bar } from 'recharts';
import StatCard from '@/components/shared/StatCard';
import { SUPER_ADMIN_STATS } from '@/lib/mockData';

const creditAccounts = [
  { name: 'Anita Devi', village: 'Madhepur', limit: 5000, used: 1200, score: 720, status: 'good', repaymentRate: 100 },
  { name: 'Raj Kumar', village: 'Laxmipur', limit: 3000, used: 2800, score: 580, status: 'at_risk', repaymentRate: 85 },
  { name: 'Priya Singh', village: 'Madhepur', limit: 2000, used: 0, score: 680, status: 'good', repaymentRate: 100 },
  { name: 'Mohan Lal', village: 'Parsad', limit: 4000, used: 3900, score: 510, status: 'overdue', repaymentRate: 72 },
  { name: 'Rekha Kumari', village: 'Laxmipur', limit: 1500, used: 500, score: 750, status: 'good', repaymentRate: 100 },
];

const disbursalTrend = [
  { month: 'Jan', disbursed: 45000, repaid: 38000 },
  { month: 'Feb', disbursed: 62000, repaid: 55000 },
  { month: 'Mar', disbursed: 88000, repaid: 74000 },
  { month: 'Apr', disbursed: 120000, repaid: 105000 },
  { month: 'May', disbursed: 135000, repaid: 118000 },
];

const statusColors = { good: 'bg-green-100 text-green-800', at_risk: 'bg-amber-100 text-amber-800', overdue: 'bg-red-100 text-red-800' };

export default function SuperAdminCredit() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold font-heading mb-1">SETU Credit</h1>
      <p className="text-sm text-muted-foreground mb-6">Micro-credit management for rural customers</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard title="Total Disbursed" value={`₹${(SUPER_ADMIN_STATS.totalCreditDisbursed/1000).toFixed(0)}K`} icon={CreditCard} />
        <StatCard title="Outstanding" value={`₹${(SUPER_ADMIN_STATS.creditOutstanding/1000).toFixed(0)}K`} icon={TrendingUp} />
        <StatCard title="Default Rate" value={`${SUPER_ADMIN_STATS.defaultRate}%`} subtitle="Target: <3%" icon={AlertTriangle} />
        <StatCard title="Active Accounts" value="342" icon={Users} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card className="p-5 border-border">
          <h3 className="font-semibold text-sm mb-4">Monthly Disbursal vs Repayment</h3>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={disbursalTrend}>
                <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v/1000).toFixed(0)}K`} />
                <Tooltip formatter={(v) => [`₹${v.toLocaleString()}`]} />
                <Bar dataKey="disbursed" fill="hsl(24, 80%, 50%)" radius={[4,4,0,0]} name="Disbursed" />
                <Bar dataKey="repaid" fill="hsl(150, 40%, 40%)" radius={[4,4,0,0]} name="Repaid" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5 border-border">
          <h3 className="font-semibold text-sm mb-3">Credit Risk Distribution</h3>
          <div className="space-y-4 mt-4">
            {[
              { label: 'Good Standing', count: 285, total: 342, color: 'bg-accent' },
              { label: 'At Risk (overdue 1-30d)', count: 42, total: 342, color: 'bg-amber-500' },
              { label: 'Overdue (30d+)', count: 15, total: 342, color: 'bg-destructive' },
            ].map(item => (
              <div key={item.label}>
                <div className="flex justify-between text-xs mb-1"><span>{item.label}</span><span className="font-bold">{item.count} accounts</span></div>
                <Progress value={(item.count / item.total) * 100} className="h-2" />
              </div>
            ))}
          </div>
          <div className="mt-4 p-3 bg-muted rounded-lg">
            <p className="text-xs text-muted-foreground">SETU Credit is based on purchase history, not formal credit scores. Village-level social accountability reduces defaults.</p>
          </div>
        </Card>
      </div>

      <Card className="border-border">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-sm">Credit Accounts</h3>
          <Button size="sm" className="text-xs h-7">Export Report</Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Customer</TableHead>
              <TableHead className="text-xs">Village</TableHead>
              <TableHead className="text-xs">Credit Limit</TableHead>
              <TableHead className="text-xs">Used</TableHead>
              <TableHead className="text-xs">Utilization</TableHead>
              <TableHead className="text-xs">Score</TableHead>
              <TableHead className="text-xs">Repayment</TableHead>
              <TableHead className="text-xs">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {creditAccounts.map((acc, i) => (
              <TableRow key={i}>
                <TableCell className="text-sm font-medium">{acc.name}</TableCell>
                <TableCell className="text-xs">{acc.village}</TableCell>
                <TableCell className="text-xs">₹{acc.limit.toLocaleString()}</TableCell>
                <TableCell className="text-xs">₹{acc.used.toLocaleString()}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Progress value={(acc.used / acc.limit) * 100} className="h-1.5 w-16" />
                    <span className="text-xs">{Math.round((acc.used / acc.limit) * 100)}%</span>
                  </div>
                </TableCell>
                <TableCell className="text-xs font-bold">{acc.score}</TableCell>
                <TableCell className="text-xs">{acc.repaymentRate}%</TableCell>
                <TableCell>
                  <Badge variant="outline" className={`text-[9px] ${statusColors[acc.status]}`}>
                    {acc.status === 'good' ? '✓ Good' : acc.status === 'at_risk' ? '⚠ At Risk' : '✗ Overdue'}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}