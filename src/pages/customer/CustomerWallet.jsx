import React, { useState, useEffect } from 'react';
import { ArrowUpRight, ArrowDownLeft, Plus, IndianRupee, Clock, Loader2, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import AppHeader from '@/components/shared/AppHeader';
import { useStore } from '@/lib/store';
import { useAuth } from '@/lib/AuthContext';
import { PaymentAPI } from '@/lib/api';
import { loadRazorpayScript, initiatePayment } from '@/lib/payments';

const QUICK_AMOUNTS = [100, 200, 500, 1000];

export default function CustomerWallet() {
  const { state, dispatch } = useStore();
  const { user, profile } = useAuth();
  const wallet = state.wallet;

  const [showTopup, setShowTopup] = useState(false);
  const [amount, setAmount]       = useState('');
  const [topping, setTopping]     = useState(false);
  const [error, setError]         = useState(null);
  const [done, setDone]           = useState(false);

  useEffect(() => {
    loadRazorpayScript();
  }, []);

  const handleTopup = async () => {
    const n = parseInt(amount, 10);
    if (!n || n < 10) return;

    setTopping(true);
    setError(null);

    try {
      const rzpResult = await initiatePayment({
        amount: n,
        customerId: user.id,
        customerName: profile?.name,
        customerPhone: profile?.phone,
        type: 'wallet_topup'
      });

      if (rzpResult.error) throw new Error(rzpResult.error);

      if (!rzpResult.cancelled) {
        setDone(true);
        setShowTopup(false);
        setAmount('');
        setTimeout(() => setDone(false), 3000);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setTopping(false);
    }
  };

  return (
    <div className="pb-6">
      <AppHeader title="SETU Wallet" showBack />
      <div className="px-4 py-4 space-y-4">
        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl flex items-start gap-2 text-destructive">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="text-xs font-medium">{error}</p>
          </div>
        )}

        {/* Balance card */}
        <Card className="p-6 border-primary/20 bg-gradient-to-br from-primary/10 to-primary/5">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Wallet Balance</p>
          <div className="flex items-baseline gap-1">
            <IndianRupee className="w-6 h-6 text-primary" />
            <p className="text-4xl font-bold text-primary">{wallet.balance.toLocaleString()}</p>
          </div>
          {done && <p className="text-xs text-green-600 mt-1 font-medium">✓ Payment successful! Wallet will be updated shortly.</p>}
        </Card>

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-2">
          <Button className="h-11 gap-2" onClick={() => setShowTopup(s => !s)}>
            <Plus className="w-4 h-4" /> Add Money
          </Button>
          <Button variant="outline" className="h-11 gap-2">
            <ArrowUpRight className="w-4 h-4" /> Transfer
          </Button>
        </div>

        {/* Topup panel */}
        {showTopup && (
          <Card className="p-4 border-primary/30 bg-primary/5">
            <h3 className="font-semibold text-sm mb-3">Add Money to Wallet</h3>
            <div className="flex gap-2 flex-wrap mb-3">
              {QUICK_AMOUNTS.map(a => (
                <button key={a} onClick={() => setAmount(String(a))}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${amount === String(a) ? 'bg-primary text-white border-primary' : 'border-border bg-card'}`}>
                  ₹{a}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input type="number" placeholder="Enter amount" className="pl-8" value={amount} onChange={e => setAmount(e.target.value)} />
              </div>
              <Button onClick={handleTopup} disabled={!amount || topping} className="shrink-0 min-w-[80px]">
                {topping ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Via UPI / Card · Secure Razorpay</p>
          </Card>
        )}

        {/* SETU Credit */}
        <Card className="p-4 border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">SETU Credit</p>
              <p className="text-2xl font-bold text-accent mt-0.5">₹{(wallet.creditLimit - wallet.creditUsed).toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Available of ₹{wallet.creditLimit.toLocaleString()} limit</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Score</p>
              <p className="text-2xl font-bold">{wallet.creditScore}</p>
              <Badge className="text-[9px] bg-green-100 text-green-700 border-0">Good</Badge>
            </div>
          </div>
          <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-accent rounded-full" style={{ width: `${(wallet.creditUsed / wallet.creditLimit) * 100}%` }} />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">Used: ₹{wallet.creditUsed.toLocaleString()}</p>
        </Card>

        {/* Transaction history */}
        <div>
          <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" /> Recent Transactions
          </h3>
          <div className="space-y-2">
            {wallet.transactions.slice(0, 8).map(t => (
              <Card key={t.id} className="p-3 border-border flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${t.type === 'credit' ? 'bg-green-100' : 'bg-red-100'}`}>
                  {t.type === 'credit'
                    ? <ArrowDownLeft className="w-4 h-4 text-green-600" />
                    : <ArrowUpRight className="w-4 h-4 text-red-600" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{t.description}</p>
                  <p className="text-xs text-muted-foreground">{t.date}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-bold ${t.type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                    {t.type === 'credit' ? '+' : '-'}₹{t.amount.toLocaleString()}
                  </p>
                  <Badge variant="outline" className={`text-[9px] ${t.status === 'completed' ? '' : 'bg-amber-50'}`}>
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
