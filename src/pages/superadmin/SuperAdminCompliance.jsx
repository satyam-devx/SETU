import React from 'react';
import { Shield, FileText, AlertTriangle, Download } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import AppHeader from '@/components/shared/AppHeader';

const metrics = [
  { name: 'KYC Completion Rate',         value: 91,  target: 95,  status: 'warning'  },
  { name: 'AML Screening',               value: 99,  target: 100, status: 'good'     },
  { name: 'Data Privacy Compliance',      value: 100, target: 100, status: 'good'     },
  { name: 'GST Filing Rate',             value: 78,  target: 90,  status: 'critical' },
  { name: 'Vendor License Verification', value: 85,  target: 90,  status: 'warning'  },
];

const reports = [
  { name: 'Monthly KYC Report',   date: 'May 2025', ready: true  },
  { name: 'Fraud & Risk Report',  date: 'May 2025', ready: true  },
  { name: 'Quarterly Audit',      date: 'Q1 2025',  ready: true  },
  { name: 'RBI Compliance Filing',date: 'May 2025', ready: false },
];

const statusColor = { good: 'text-green-600', warning: 'text-amber-600', critical: 'text-red-600' };
const barColor    = { good: 'bg-green-500',   warning: 'bg-amber-500',   critical: 'bg-red-500'   };

export default function SuperAdminCompliance() {
  const issues = metrics.filter(m => m.status !== 'good').length;

  return (
    <div className="pb-6">
      <AppHeader title="Compliance" />
      <div className="p-4 space-y-4">

        {/* Summary */}
        <div className="grid grid-cols-2 gap-2">
          <Card className="p-3 border-border text-center">
            <p className="text-2xl font-bold text-primary">92%</p>
            <p className="text-xs text-muted-foreground">Overall Score</p>
          </Card>
          <Card className="p-3 border-border text-center">
            <p className="text-2xl font-bold text-amber-600">{issues}</p>
            <p className="text-xs text-muted-foreground">Issues Found</p>
          </Card>
        </div>

        {/* Metrics */}
        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" /> Compliance Metrics
          </h3>
          <div className="space-y-3">
            {metrics.map(item => (
              <div key={item.name}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium">{item.name}</p>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold ${statusColor[item.status]}`}>{item.value}%</span>
                    <span className="text-[10px] text-muted-foreground">/ {item.target}%</span>
                  </div>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${barColor[item.status]}`}
                    style={{ width: `${item.value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Reports */}
        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" /> Regulatory Reports
          </h3>
          <div className="space-y-2">
            {reports.map(r => (
              <div key={r.name} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
                <div>
                  <p className="text-sm font-medium">{r.name}</p>
                  <p className="text-xs text-muted-foreground">{r.date}</p>
                </div>
                {r.ready
                  ? (
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                      <Download className="w-3 h-3" /> Download
                    </Button>
                  ) : (
                    <Badge className="text-[9px] bg-amber-100 text-amber-700 border-0">Pending</Badge>
                  )
                }
              </div>
            ))}
          </div>
        </Card>

        {/* Actions required */}
        <Card className="p-4 border-amber-200 bg-amber-50/40">
          <h3 className="font-semibold text-sm mb-2 flex items-center gap-2 text-amber-800">
            <AlertTriangle className="w-4 h-4" /> Action Required
          </h3>
          <ul className="space-y-1.5 text-xs text-amber-700">
            <li>• GST filing for May 2025 due June 15</li>
            <li>• 23 vendors pending license re-verification</li>
            <li>• KYC renewal needed for 47 customers</li>
            <li>• AML review queue: 3 flagged accounts</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
