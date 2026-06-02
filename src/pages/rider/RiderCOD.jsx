import React, { useState } from 'react';
import { Wallet, AlertCircle, CheckCircle, ArrowDownCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import AppHeader from '@/components/shared/AppHeader';
import StatCard from '@/components/shared/StatCard';

const deposits = [
  { id: 'DEP-201', amount: 1200, date: 'Today, 3:00 PM', status: 'deposited', orders: 4 },
  { id: 'DEP-200', amount: 850, date: 'Yesterday, 5:30 PM', status: 'deposited', orders: 3 },
  { id: 'DEP-199', amount: 640, date: 'May 29, 4:00 PM', status: 'deposited', orders: 2 },
];

export default function RiderCOD() {
  const [showConfirm, setShowConfirm] = useState(false);
  const pendingAmount = 1540;

  return (
    <div className="pb-20">
      <AppHeader title="COD Management" subtitle="Cash on Delivery" showBack />

      <div className="px-4 py-3 grid grid-cols-2 gap-2">
        <StatCard title="Pending COD" value={`₹${pendingAmount}`} subtitle="To be deposited" icon={Wallet} />
        <StatCard title="Total Collected" value="₹4,230" subtitle="This week" icon={ArrowDownCircle} />
      </div>

      {pendingAmount > 1000 && (
        <div className="px-4 mb-3">
          <Card className="p-3 border-amber-300 bg-amber-50/60">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800">Deposit Required</p>
                <p className="text-xs text-amber-700">Your pending COD exceeds ₹1,000. Please deposit at your nearest collection point.</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      <div className="px-4 mb-4">
        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-1">Pending Collection</h3>
          <p className="text-3xl font-bold text-foreground">₹{pendingAmount}</p>
          <p className="text-xs text-muted-foreground mb-4">From 5 deliveries today</p>
          {!showConfirm ? (
            <Button className="w-full" onClick={() => setShowConfirm(true)}>
              Mark as Deposited
            </Button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-center text-muted-foreground">Confirm deposit of ₹{pendingAmount}?</p>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowConfirm(false)}>Cancel</Button>
                <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => setShowConfirm(false)}>
                  <CheckCircle className="w-4 h-4 mr-1" /> Confirm
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>

      <div className="px-4">
        <h3 className="font-semibold text-sm mb-2">Deposit History</h3>
        <div className="space-y-2">
          {deposits.map(dep => (
            <Card key={dep.id} className="p-3 border-border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">₹{dep.amount}</p>
                  <p className="text-xs text-muted-foreground">{dep.orders} orders · {dep.date}</p>
                </div>
                <Badge className="bg-green-100 text-green-700 text-[10px]">
                  <CheckCircle className="w-3 h-3 mr-1" /> Deposited
                </Badge>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
