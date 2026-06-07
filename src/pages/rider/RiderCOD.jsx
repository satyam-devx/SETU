import React, { useState } from 'react';
import { IndianRupee, CheckCircle, Clock, AlertTriangle, Camera, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppHeader from '@/components/shared/AppHeader';
import { useStore } from '@/lib/store';
import { RiderAPI } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';

export default function RiderCOD() {
  const { state }     = useStore();
  const { profile }   = useAuth();
  const riderUuid     = profile?.rider_id;
  const riderStore    = state.riders.find(r => r.id === riderUuid || r.user_id === profile?.id) || { codBalance: profile?.cod_balance || 0 };

  const deliveredOrders = state.orders.filter(o =>
    o.status === 'delivered' && (o.paymentMethod === 'COD' || o.is_cod)
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

  const handleDeposit = async () => {
    const amount = parseInt(depositAmount, 10);
    if (!amount || amount <= 0) return;

    setDepositing(true);
    try {
      const { data, error } = await RiderAPI.submitCODDeposit(riderUuid, amount, denominations);
      if (error) throw error;
      setDeposited(true);
    } catch (err) {
      console.error('[RiderCOD] deposit failed:', err);
      alert('Failed to record deposit. Please try again.');
    } finally {
      setDepositing(false);
    }
  };

  const codBalance = riderStore.codBalance;

  return (
    <div className="pb-20">
      <AppHeader title="COD Management" showBack />
      <div className="px-4 py-4 space-y-4">

        {/* Summary */}
        <Card className="p-5 border-border bg-gradient-to-br from-primary/5 to-background shadow-sm">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">COD Cash on Hand</p>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-bold text-primary">₹</span>
            <p className="text-4xl font-black text-primary tracking-tight">{codBalance.toLocaleString()}</p>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Collected from {deliveredOrders.length} deliveries today
          </p>
        </Card>

        {/* COD deliveries */}
        {deliveredOrders.length > 0 && (
          <div>
            <h3 className="font-bold text-sm mb-2 px-1">Today's Collections</h3>
            <div className="space-y-2">
              {deliveredOrders.map(o => (
                <Card key={o.id} className="p-3 border-border flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono font-bold truncate">{o.orderNumber || o.order_number}</p>
                    <p className="text-[10px] text-muted-foreground">{o.customerName || o.customer_name} · {o.village}</p>
                  </div>
                  <p className="text-sm font-black text-green-600 shrink-0">+₹{o.total}</p>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Denomination logger */}
        <Card className="p-4 border-border">
          <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
            <IndianRupee className="w-4 h-4 text-primary" /> Denomination Count
          </h3>
          <div className="grid grid-cols-3 gap-3">
            {['500', '200', '100', '50', '20', '10'].map(note => (
              <div key={note}>
                <Label className="text-[10px] font-bold mb-1 block text-muted-foreground">₹{note}</Label>
                <Input
                  type="number"
                  placeholder="0"
                  className="h-9 text-sm text-center rounded-lg"
                  value={denominations[note]}
                  onChange={e => setDenominations(d => ({ ...d, [note]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          {denomTotal > 0 && (
            <div className={`mt-4 p-2.5 rounded-xl text-xs font-bold text-center border ${
              denomTotal === codBalance
                ? 'bg-green-50 text-green-700 border-green-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}>
              Count Total: ₹{denomTotal.toLocaleString()}
              {denomTotal === codBalance ? ' (Matches)' : ` (Diff: ₹${Math.abs(denomTotal - codBalance)})`}
            </div>
          )}
        </Card>

        {/* Deposit */}
        {!deposited ? (
          <Card className="p-4 border-primary/20 shadow-md">
            <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" /> Submit Deposit to Hub
            </h3>
            <div className="relative mb-3">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">₹</span>
              <Input
                type="number"
                placeholder={`Balance: ₹${codBalance}`}
                className="pl-7 h-11 text-base font-bold"
                value={depositAmount}
                onChange={e => setDepositAmount(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-2 mb-3">
               <Button variant="outline" className="h-10 text-xs gap-2 rounded-xl">
                 <Camera className="w-3.5 h-3.5" /> Photo Proof
               </Button>
               <Button
                className="h-10 text-xs font-bold rounded-xl"
                disabled={!depositAmount || depositing || Number(depositAmount) > codBalance}
                onClick={handleDeposit}
               >
                 {depositing ? <Loader2 className="w-4 h-4 animate-spin" /> : `Deposit ₹${depositAmount || '0'}`}
               </Button>
            </div>
            {Number(depositAmount) > codBalance && (
              <p className="text-[10px] text-destructive font-bold text-center">⚠ Amount exceeds your cash balance</p>
            )}
          </Card>
        ) : (
          <Card className="p-6 border-green-200 bg-green-50 text-center animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-full bg-green-200 flex items-center justify-center mx-auto mb-3">
               <CheckCircle className="w-7 h-7 text-green-600" />
            </div>
            <p className="text-sm font-bold text-green-800">Deposit Submitted!</p>
            <p className="text-xs text-green-700 mt-1">₹{depositAmount} pending reconciliation by admin</p>
          </Card>
        )}

        <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl">
          <p className="text-[10px] text-amber-700 font-medium flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            Warning: All cash must be deposited at the Madhepur Hub before 9 PM. Any shortage will be deducted from earnings.
          </p>
        </div>
      </div>
    </div>
  );
}
