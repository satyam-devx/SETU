import React, { useState } from 'react';
import { IndianRupee, CheckCircle, Clock, AlertTriangle, Camera } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppHeader from '@/components/shared/AppHeader';
import { useStore } from '@/lib/store';
import { RIDERS } from '@/lib/mockData';

const RIDER_ID = 'r1';

export default function RiderCOD() {
  const { state } = useStore();
  const rider = RIDERS[0];

  const deliveredOrders = state.orders.filter(o =>
    o.riderId === RIDER_ID && o.status === 'delivered' && o.paymentMethod === 'COD'
  );

  const [depositAmount, setDepositAmount] = useState('');
  const [depositing, setDepositing]       = useState(false);
  const [deposited, setDeposited]         = useState(false);
  const [denominations, setDenominations] = useState({
    '500': '', '200': '', '100': '', '50': '', '20': '', '10': ''
  });

  const denomTotal = Object.entries(denominations).reduce(
    (sum, [note, count]) => sum + (parseInt(note) * (parseInt(count) || 0)), 0
  );

  const handleDeposit = () => {
    setDepositing(true);
    setTimeout(() => { setDepositing(false); setDeposited(true); }, 1000);
  };

  const codTotal = deliveredOrders.reduce((s, o) => s + (o.codAmount || o.total || 0), 0);

  return (
    <div className="pb-6">
      <AppHeader title="COD Management" showBack />
      <div className="px-4 py-4 space-y-4">

        {/* Summary */}
        <Card className="p-5 border-border bg-gradient-to-br from-primary/5 to-background">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">COD Cash on Hand</p>
          <p className="text-4xl font-bold text-primary mt-1">₹{rider.codBalance.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-1">
            From {deliveredOrders.length} COD deliveries today
          </p>
        </Card>

        {/* COD deliveries */}
        {deliveredOrders.length > 0 && (
          <div>
            <h3 className="font-semibold text-sm mb-2">Today's COD Collections</h3>
            <div className="space-y-2">
              {deliveredOrders.map(o => (
                <Card key={o.id} className="p-3 border-border flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{o.orderNumber}</p>
                    <p className="text-xs text-muted-foreground">{o.customerName} · {o.village}</p>
                  </div>
                  <p className="text-sm font-bold text-green-600 shrink-0">+₹{o.total}</p>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Denomination logger */}
        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <IndianRupee className="w-4 h-4 text-primary" /> Denomination Count
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {Object.keys(denominations).map(note => (
              <div key={note}>
                <Label className="text-[10px] mb-0.5 block text-muted-foreground">₹{note} notes</Label>
                <Input
                  type="number"
                  placeholder="0"
                  className="h-8 text-sm text-center"
                  value={denominations[note]}
                  onChange={e => setDenominations(d => ({ ...d, [note]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          {denomTotal > 0 && (
            <div className={`mt-3 p-2 rounded-lg text-sm font-medium text-center ${denomTotal === rider.codBalance ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
              Count total: ₹{denomTotal.toLocaleString()}
              {denomTotal === rider.codBalance ? ' ✓ Matches' : ` · Difference: ₹${Math.abs(denomTotal - rider.codBalance)}`}
            </div>
          )}
        </Card>

        {/* Deposit */}
        {!deposited ? (
          <Card className="p-4 border-border">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" /> Deposit to Hub
            </h3>
            <div className="relative mb-3">
              <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                type="number"
                placeholder={`Enter amount (balance: ₹${rider.codBalance})`}
                className="pl-8"
                value={depositAmount}
                onChange={e => setDepositAmount(e.target.value)}
              />
            </div>
            <Button variant="outline" className="w-full gap-2 mb-2">
              <Camera className="w-4 h-4" /> Attach Photo Proof
            </Button>
            <Button
              className="w-full"
              disabled={!depositAmount || depositing || Number(depositAmount) > rider.codBalance}
              onClick={handleDeposit}
            >
              {depositing ? 'Processing...' : `Deposit ₹${depositAmount || '0'}`}
            </Button>
            {Number(depositAmount) > rider.codBalance && (
              <p className="text-xs text-destructive mt-1 text-center">Amount exceeds balance</p>
            )}
          </Card>
        ) : (
          <Card className="p-4 border-green-200 bg-green-50 text-center">
            <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
            <p className="text-sm font-semibold text-green-700">Deposit recorded!</p>
            <p className="text-xs text-green-600">₹{depositAmount} submitted for reconciliation</p>
          </Card>
        )}

        <Card className="p-3 border-amber-200 bg-amber-50/50">
          <p className="text-xs text-amber-700 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            COD cash must be deposited at the hub before end of shift. Zero tolerance for discrepancies.
          </p>
        </Card>
      </div>
    </div>
  );
}
