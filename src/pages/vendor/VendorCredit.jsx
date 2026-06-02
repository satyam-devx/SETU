import React, { useState } from 'react';
import { CreditCard, ArrowUpRight, ArrowDownLeft, TrendingUp } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import AppHeader from '@/components/shared/AppHeader';

const transactions = [
  { id: 't1', type: 'credit', label: 'Credit limit increase', amount: 5000, date: '2 days ago' },
  { id: 't2', type: 'debit',  label: 'Inventory purchase',    amount: 2000, date: '4 days ago' },
  { id: 't3', type: 'credit', label: 'Repayment received',    amount: 1000, date: '1 week ago' },
  { id: 't4', type: 'debit',  label: 'Stock advance',         amount: 1500, date: '2 weeks ago' },
];

export default function VendorCredit() {
  const [applyMode, setApplyMode] = useState(false);

  const limit     = 10000;
  const used      = 3500;
  const available = limit - used;
  const usagePct  = Math.round((used / limit) * 100);

  return (
    <div className="pb-6">
      <AppHeader title="Business Credit" showBack />
      <div className="px-4 py-4 space-y-4">

        {/* Credit summary */}
        <Card className="p-4 border-border bg-primary/5 border-primary/20">
          <p className="text-xs text-muted-foreground">Available Credit</p>
          <p className="text-3xl font-bold text-primary mt-1">₹{available.toLocaleString()}</p>
          <div className="mt-3">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Used: ₹{used.toLocaleString()}</span>
              <span>Limit: ₹{limit.toLocaleString()}</span>
            </div>
            <Progress value={usagePct} className="h-2" />
          </div>
        </Card>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Button className="h-10 gap-2" onClick={() => setApplyMode(true)}>
            <ArrowUpRight className="w-4 h-4" /> Apply Credit
          </Button>
          <Button variant="outline" className="h-10 gap-2">
            <ArrowDownLeft className="w-4 h-4" /> Repay
          </Button>
        </div>

        {applyMode && (
          <Card className="p-4 border-border border-primary/30 bg-primary/5">
            <h3 className="text-sm font-semibold mb-3">Apply for Credit</h3>
            <div className="space-y-3">
              <div className="flex gap-2 flex-wrap">
                {[2000, 5000, 7500, 10000].map(amt => (
                  <button
                    key={amt}
                    className="text-xs px-3 py-1.5 rounded-full border border-primary/30 bg-white"
                  >
                    ₹{amt.toLocaleString()}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Purpose: Inventory purchase</p>
              <div className="flex gap-2">
                <Button size="sm" className="flex-1">Submit Application</Button>
                <Button size="sm" variant="outline" className="flex-1" onClick={() => setApplyMode(false)}>Cancel</Button>
              </div>
            </div>
          </Card>
        )}

        {/* Credit score */}
        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-primary" /> Credit Score
          </h3>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full border-4 border-primary flex items-center justify-center shrink-0">
              <span className="text-lg font-bold text-primary">720</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-green-600">Good</p>
              <p className="text-xs text-muted-foreground">Eligible for higher limits</p>
              <Badge className="mt-1 text-[9px] bg-green-100 text-green-700 border-0">Top 30% vendors</Badge>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            {[
              { label: 'On-time Payments', value: '98%' },
              { label: 'Avg Order Value', value: '₹1.2k' },
              { label: 'Platform Age', value: '8 mo' },
            ].map(s => (
              <div key={s.label} className="bg-muted/40 rounded-lg p-2">
                <p className="text-sm font-bold">{s.value}</p>
                <p className="text-[9px] text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Transactions */}
        <div>
          <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-muted-foreground" /> Recent Transactions
          </h3>
          <div className="space-y-2">
            {transactions.map(t => (
              <Card key={t.id} className="p-3 border-border flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${t.type === 'credit' ? 'bg-green-100' : 'bg-red-100'}`}>
                  {t.type === 'credit'
                    ? <ArrowDownLeft className="w-4 h-4 text-green-600" />
                    : <ArrowUpRight className="w-4 h-4 text-red-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{t.label}</p>
                  <p className="text-xs text-muted-foreground">{t.date}</p>
                </div>
                <p className={`text-sm font-bold shrink-0 ${t.type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                  {t.type === 'credit' ? '+' : '-'}₹{t.amount.toLocaleString()}
                </p>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
