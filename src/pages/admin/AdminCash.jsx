import React from 'react';
import { IndianRupee, CheckCircle, AlertTriangle, Clock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import StatCard from '@/components/shared/StatCard';
import { RIDERS, ADMIN_STATS } from '@/lib/mockData';

const reconciliationLog = [
  { id: 1, rider: 'Suraj Kumar', collected: 4200, deposited: 3000, pending: 1200, lastDeposit: '2025-05-30 9:00 PM', status: 'pending' },
  { id: 2, rider: 'Vikash Yadav', collected: 3600, deposited: 2800, pending: 800, lastDeposit: '2025-05-30 9:30 PM', status: 'pending' },
  { id: 3, rider: 'Amit Singh', collected: 1800, deposited: 1800, pending: 0, lastDeposit: '2025-05-30 8:00 PM', status: 'reconciled' },
];

export default function AdminCash() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold font-heading mb-1">COD & Cash Reconciliation</h1>
      <p className="text-sm text-muted-foreground mb-6">Daily cash reconciliation — every rupee must be accounted for</p>

      <div className="grid grid-cols-4 gap-3 mb-6">
        <StatCard title="COD Collected Today" value={`₹${ADMIN_STATS.codCollected.toLocaleString()}`} icon={IndianRupee} />
        <StatCard title="COD Pending Deposit" value={`₹${ADMIN_STATS.codPending.toLocaleString()}`} icon={Clock} className={ADMIN_STATS.codPending > 3000 ? 'border-amber-300' : ''} />
        <StatCard title="Deposited Today" value={`₹${(ADMIN_STATS.codCollected - ADMIN_STATS.codPending).toLocaleString()}`} icon={CheckCircle} />
        <StatCard title="Discrepancy" value="₹0" subtitle="All reconciled" icon={AlertTriangle} />
      </div>

      <Card className="border-border mb-6">
        <div className="p-4 border-b border-border">
          <h3 className="font-semibold text-sm">Rider Cash Status — {new Date().toLocaleDateString('en-IN')}</h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Rider</TableHead>
              <TableHead className="text-xs">COD Collected</TableHead>
              <TableHead className="text-xs">Deposited</TableHead>
              <TableHead className="text-xs">Pending</TableHead>
              <TableHead className="text-xs">Last Deposit</TableHead>
              <TableHead className="text-xs">Status</TableHead>
              <TableHead className="text-xs">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reconciliationLog.map(row => (
              <TableRow key={row.id}>
                <TableCell className="text-sm font-medium">{row.rider}</TableCell>
                <TableCell className="text-sm">₹{row.collected.toLocaleString()}</TableCell>
                <TableCell className="text-sm">₹{row.deposited.toLocaleString()}</TableCell>
                <TableCell className={`text-sm font-bold ${row.pending > 0 ? 'text-amber-600' : 'text-accent'}`}>₹{row.pending.toLocaleString()}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{row.lastDeposit}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={`text-[9px] ${row.status === 'reconciled' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                    {row.status === 'reconciled' ? '✓ Reconciled' : '⏳ Pending'}
                  </Badge>
                </TableCell>
                <TableCell>
                  {row.status !== 'reconciled' && (
                    <Button size="sm" className="h-7 text-xs">Confirm Deposit</Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Card className="p-5 border-border bg-destructive/5 border-destructive/20">
        <h3 className="font-semibold text-sm text-destructive mb-2 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> Cash Rules (SETU Constitution)
        </h3>
        <ul className="text-xs text-muted-foreground space-y-1">
          <li>• Daily reconciliation must complete before rider leaves for the night</li>
          <li>• Zero tolerance for discrepancies — investigate every ₹10 difference</li>
          <li>• Photo-proof of cash deposit required for amounts &gt; ₹2,000</li>
          <li>• Auto-alert if any rider has &gt; ₹5,000 undeposited</li>
        </ul>
      </Card>
    </div>
  );
}
