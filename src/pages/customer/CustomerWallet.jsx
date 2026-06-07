import React, { useState } from 'react';
import { ArrowUpRight, ArrowDownLeft, Plus, IndianRupee, Clock, Loader2, CheckCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import AppHeader from '@/components/shared/AppHeader';
import { useStore } from '@/lib/store';
import { useAuth } from '@/lib/AuthContext';
import { PaymentAPI } from '@/lib/api';
import { initiateUPIPayment } from '@/lib/payments';

const QUICK_AMOUNTS = [100, 200, 500, 1000];

export default function CustomerWallet() {
  const { state, dispatch } = useStore();
  const { user, profile }       = useAuth();
  const wallet = state.wallet;

  const [showTopup, setShowTopup] = useState(false);
  const [amount, setAmount]       = useState('');
  const [topping, setTopping]     = useState(false);
  const [done, setDone]           = useState(false);
  const [error, setError]         = useState(null);

  const handleTopup = async () => {
    const n = parseInt(amount, 10);
    if (!n || n < 10) return;

    setTopping(true);
    setError(null);

    try {
      // 1. Initiate Real UPI Payment
      const pResult = await initiateUPIPayment({
        amount: n,
        orderId: `WALLET_${user.id}_${Date.now()}`,
        customerName: profile?.name,
        phone: profile?.phone
      });

      if (pResult.cancelled) {
        setTopping(false);
        setError('Payment cancelled.');
        return;
      }

      // 2. Credit wallet in DB via API
      const { data, error: apiErr } = await PaymentAPI.walletTopup(
        user.id,
        n,
        pResult.razorpayPaymentId
      );

      if (apiErr) throw apiErr;

      // 3. Update Store
      dispatch({ type: 'WALLET_TOPUP', payload: { amount: n } });

      setDone(true);
      setShowTopup(false);
      setAmount('');
      setTimeout(() => setDone(false), 3000);

    } catch (err) {
      console.error('[Wallet] topup failed:', err);
      setError('Could not complete top-up. Please try again.');
    } finally {
      setTopping(false);
    }
  };

  return (
    <div className="pb-6">
      <AppHeader title="SETU Wallet" showBack />
      <div className="px-4 py-4 space-y-4">

        {/* Balance card */}
        <Card className="p-6 border-primary/20 bg-gradient-to-br from-primary/10 to-primary/5 relative overflow-hidden">
          <div className="relative z-10">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Wallet Balance</p>
            <div className="flex items-baseline gap-1">
              <IndianRupee className="w-6 h-6 text-primary" />
              <p className="text-4xl font-bold text-primary">{(wallet?.balance ?? 0).toLocaleString()}</p>
            </div>
            {done && (
              <div className="flex items-center gap-1.5 mt-2 animate-in slide-in-from-left-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <p className="text-xs text-green-600 font-semibold">Wallet topped up successfully!</p>
              </div>
            )}
            {error && (
               <p className="text-xs text-red-600 mt-2 font-medium">⚠️ {error}</p>
            )}
          </div>
          <div className="absolute right-[-10%] bottom-[-20%] opacity-10">
            <Wallet className="w-32 h-32 text-primary" />
          </div>
        </Card>

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-2">
          <Button className="h-11 gap-2 rounded-xl" onClick={() => setShowTopup(s => !s)}>
            <Plus className="w-4 h-4" /> Add Money
          </Button>
          <Button variant="outline" className="h-11 gap-2 rounded-xl">
            <ArrowUpRight className="w-4 h-4" /> Transfer
          </Button>
        </div>

        {/* Topup panel */}
        {showTopup && (
          <Card className="p-4 border-primary/30 bg-primary/5 animate-in fade-in zoom-in-95">
            <h3 className="font-semibold text-sm mb-3">Add Money to Wallet</h3>
            <div className="flex gap-2 flex-wrap mb-3">
              {QUICK_AMOUNTS.map(a => (
                <button key={a} onClick={() => setAmount(String(a))}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                    amount === String(a)
                      ? 'bg-primary text-white border-primary shadow-sm scale-105'
                      : 'border-border bg-card hover:bg-muted'
                  }`}>
                  ₹{a}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input type="number" placeholder="Enter amount" className="pl-8 h-10 rounded-lg" value={amount} onChange={e => setAmount(e.target.value)} />
              </div>
              <Button onClick={handleTopup} disabled={!amount || topping} className="shrink-0 h-10 rounded-lg px-6">
                {topping ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add'}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">Instant top-up via UPI · Powered by Razorpay</p>
          </Card>
        )}

        {/* SETU Credit */}
        <Card className="p-4 border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">SETU Credit</p>
              <p className="text-2xl font-bold text-accent mt-0.5">₹{(wallet?.creditLimit - wallet?.creditUsed || 0).toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Available of ₹{(wallet?.creditLimit || 0).toLocaleString()} limit</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Score</p>
              <p className="text-2xl font-bold">{wallet?.creditScore || 500}</p>
              <Badge className="text-[9px] bg-green-100 text-green-700 border-0">Good</Badge>
            </div>
          </div>
          <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-accent rounded-full" style={{ width: `${(wallet?.creditUsed / wallet?.creditLimit) * 100}%` }} />
          </div>
        </Card>

        {/* Transaction history */}
        <div>
          <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" /> Recent Transactions
          </h3>
          <div className="space-y-2">
            {(wallet?.transactions || []).slice(0, 10).map(t => (
              <Card key={t.id} className="p-3 border-border flex items-center gap-3 hover:bg-muted/30 transition-colors">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${t.type === 'credit' ? 'bg-green-100' : 'bg-red-100'}`}>
                  {t.type === 'credit'
                    ? <ArrowDownLeft className="w-4 h-4 text-green-600" />
                    : <ArrowUpRight className="w-4 h-4 text-red-600" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{t.description}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-bold ${t.type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                    {t.type === 'credit' ? '+' : '-'}₹{t.amount.toLocaleString()}
                  </p>
                  <Badge variant="outline" className={`text-[8px] h-4 py-0 ${t.status === 'completed' ? 'border-green-200 text-green-700' : 'bg-amber-50'}`}>
                    {t.status}
                  </Badge>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
