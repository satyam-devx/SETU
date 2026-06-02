import React from 'react';
import { Shield, AlertTriangle, Eye, Lock, Activity, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import StatCard from '@/components/shared/StatCard';
import { SUPER_ADMIN_STATS, AUDIT_LOG } from '@/lib/mockData';

const fraudAlerts = [
  { id: 'f1', type: 'Suspicious Order Pattern', severity: 'high', entity: 'Order SETU-2025-0007', detail: 'Same customer placed 5 orders in 20 min, all cancelled', time: '2025-05-29T14:10:00', status: 'investigating' },
  { id: 'f2', type: 'COD Discrepancy', severity: 'medium', entity: 'Rider Suraj Kumar', detail: '₹300 discrepancy in daily reconciliation', time: '2025-05-30T22:00:00', status: 'resolved' },
  { id: 'f3', type: 'Fake Review Suspected', severity: 'low', entity: 'Vendor Mithila Sweets', detail: '15 reviews from same IP in 1 hour', time: '2025-05-31T08:30:00', status: 'open' },
];

const severityConfig = {
  high: 'bg-red-100 text-red-800',
  medium: 'bg-amber-100 text-amber-800',
  low: 'bg-yellow-100 text-yellow-800',
};

const statusConfig = {
  investigating: 'bg-blue-100 text-blue-800',
  resolved: 'bg-green-100 text-green-800',
  open: 'bg-gray-100 text-gray-800',
};

const securityChecks = [
  { label: '2FA on all admin accounts', status: true },
  { label: 'End-to-end encryption (payments)', status: true },
  { label: 'HTTPS / TLS 1.3', status: true },
  { label: 'Automated fraud detection', status: true },
  { label: 'Daily audit log review', status: true },
  { label: 'Penetration test (last: Q1 2025)', status: true },
  { label: 'DPDP Act 2023 compliance', status: true },
  { label: 'Data residency in India', status: true },
];

export default function SuperAdminSecurity() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold font-heading mb-1">Fraud & Security</h1>
      <p className="text-sm text-muted-foreground mb-6">Zero tolerance for fraud. Every exception investigated.</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard title="Fraud Alerts" value={`${SUPER_ADMIN_STATS.fraudAlerts}`} icon={AlertTriangle} className="border-destructive/30" />
        <StatCard title="API Uptime" value={`${SUPER_ADMIN_STATS.apiUptime}%`} icon={Activity} />
        <StatCard title="Compliance Score" value={`${SUPER_ADMIN_STATS.complianceScore}%`} icon={Shield} />
        <StatCard title="Security Checks" value={`${securityChecks.filter(c => c.status).length}/${securityChecks.length}`} subtitle="All green" icon={Lock} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="col-span-2">
          <Card className="border-border">
            <div className="p-4 border-b border-border">
              <h3 className="font-semibold text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-destructive" /> Active Fraud Alerts</h3>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Type</TableHead>
                  <TableHead className="text-xs">Severity</TableHead>
                  <TableHead className="text-xs">Entity</TableHead>
                  <TableHead className="text-xs">Detail</TableHead>
                  <TableHead className="text-xs">Time</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fraudAlerts.map(alert => (
                  <TableRow key={alert.id}>
                    <TableCell className="text-xs font-medium">{alert.type}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[9px] ${severityConfig[alert.severity]}`}>{alert.severity}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">{alert.entity}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate">{alert.detail}</TableCell>
                    <TableCell className="text-[10px] text-muted-foreground">{new Date(alert.time).toLocaleString('en-IN')}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[9px] ${statusConfig[alert.status]}`}>{alert.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {alert.status !== 'resolved' && <Button size="sm" variant="outline" className="h-6 text-[10px]">Review</Button>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>

        <Card className="p-5 border-border">
          <h3 className="font-semibold text-sm mb-4 flex items-center gap-2"><CheckCircle className="w-4 h-4 text-accent" /> Security Checklist</h3>
          <div className="space-y-2">
            {securityChecks.map((check, i) => (
              <div key={i} className="flex items-center gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-accent shrink-0" />
                <span className="text-xs">{check.label}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="border-border">
        <div className="p-4 border-b border-border">
          <h3 className="font-semibold text-sm">Full Audit Log</h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Actor</TableHead>
              <TableHead className="text-xs">Action</TableHead>
              <TableHead className="text-xs">Entity</TableHead>
              <TableHead className="text-xs">Timestamp</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {AUDIT_LOG.map(log => (
              <TableRow key={log.id}>
                <TableCell className="text-xs font-medium">{log.actor}</TableCell>
                <TableCell className="text-xs">{log.action}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{log.entity}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{new Date(log.timestamp).toLocaleString('en-IN')}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
