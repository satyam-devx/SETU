import React, { useState, useEffect } from 'react';
import {
  ArrowUpRight, ArrowDownLeft, Plus, IndianRupee,
  Clock, Loader2, AlertCircle, RefreshCw,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import AppHeader from '@/components/shared/AppHeader';
import { useAuth } from '@/lib/AuthContext';
import { getWallet, getWalletTransactions } from '@/lib/api';
import { loadRazorpayScript, initiatePayment } from '@/lib/payments';

const QUICK_AMOUNTS = [100, 200, 500, 1000];

export default function CustomerWallet() {
  const { user, profile } = useAuth();

  const [wallet,       setWallet]       = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loadingWallet,setLoadingWallet]= useState(true);
  const [loadingTxns,  setLoadingTxns]  = useState(true);
  const [walletError,  setWalletError]  = useState(null);

  const [showTopup, setShowTopup] = useState(false);
  const [amount,    setAmount]    = useState('');
  const [topping,   setTopping]   = useState(false);
  const [error,     setError]     = useState(null);
  const [done,      setDone]      = useState(false);

  // ── Load wallet & transactions on mount ───────────────────
  const loadWallet = async () => {
    if (!user) return;
    setLoadingWallet(true);
    const { data, error: e } = await getWallet(user.id);
    if (e) setWalletError(e.message);
    else   setWallet(data ?? { balance: 0 });
    setLoadingWallet(false);
  };

  const loadTransactions = async () => {
    if (!user) return;
    setLoadingTxns(true);
    const { data } = await getWalletTransactions(user.id, { limit: 20 });
    setTransactions(data ?? []);
    setLoadingTxns(false);
  };

  useEffect(() => {
    loadRazorpayScript();
    loadWallet();
    loadTransactions();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // ── Razorpay top-up ───────────────────────────────────────
  const handleTopup = async () => {
    const n = parseInt(amount, 10);
    if (!n || n < 10) return;

    setTopping(true);
    setError(null);

    try {
      const rzpResult = await initiatePayment({
        amount:        n,
        customerId:    user.id,
        customerName:  profile?.name,
        customerPhone: profile?.phone,
        type:          'wallet_topup',
      });

      if (rzpResult.error) throw new Error(rzpResult.error);

      if (!rzpResult.cancelled) {
        setDone(true);
        setShowTopup(false);
        setAmount('');
        // Refresh wallet to show updated balance (webhook will have credited it)
        await loadWallet();
        await loadTransactions();
        setTimeout(() => setDone(false), 4000);
      }
    } catch (err) {
      setError(err.message ?? 'Top-up failed. Please try again.');
    } finally {
      setTopping(false);
    }
  };

  const balance = wallet?.balance ?? 0;

  return (
    <div className="pb-6">
      <AppHeader title="SETU Wallet" showBack />
      <div className="px-4 py-4 space-y-4">

        {/* Global error */}
        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl flex items-start gap-2 text-destructive">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="text-xs font-medium">{error}</p>
          </div>
        )}

        {/* Balance card */}
        {loadingWallet ? (
          <Card className="p-6 border-primary/20 bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center h-28">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </Card>
        ) : walletError ? (
          <Card className="p-6 border-destructive/20 bg-destructive/5 flex flex-col items-center gap-2">
            <AlertCircle className="w-6 h-6 text-destructive" />
            <p className="text-xs text-destructive text-center">Could not load wallet balance.</p>
            <Button size="sm" variant="outline" onClick={loadWallet}>
              <RefreshCw className="w-3 h-3 mr-1" /> Retry
            </Button>
          </Card>
        ) : (
          <Card className="p-6 border-primary/20 bg-gradient-to-br from-primary/10 to-primary/5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Wallet Balance</p>
            <div className="flex items-baseline gap-1">
              <IndianRupee className="w-6 h-6 text-primary" />
              <p className="text-4xl font-bold text-primary">{balance.toLocaleString('en-IN')}</p>
            </div>
            {done && (
              <p className="text-xs text-green-600 mt-1 font-medium">
                ✓ Payment successful! Balance updated.
              </p>
            )}
          </Card>
        )}

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-2">
          <Button className="h-11 gap-2" onClick={() => setShowTopup(s => !s)}>
            <Plus className="w-4 h-4" /> Add Money
          </Button>
          <Button variant="outline" className="h-11 gap-2" disabled>
            <ArrowUpRight className="w-4 h-4" /> Transfer
          </Button>
        </div>

        {/* Topup panel */}
        {showTopup && (
          <Card className="p-4 border-primary/30 bg-primary/5">
            <h3 className="font-semibold text-sm mb-3">Add Money to Wallet</h3>
            <div className="flex gap-2 flex-wrap mb-3">
              {QUICK_AMOUNTS.map(a => (
                <button
                  key={a}
                  onClick={() => setAmount(String(a))}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    amount === String(a)
                      ? 'bg-primary text-white border-primary'
                      : 'border-border bg-card'
                  }`}
                >
                  ₹{a}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  type="number"
                  placeholder="Enter amount"
                  className="pl-8"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                />
              </div>
              <Button
                onClick={handleTopup}
                disabled={!amount || topping}
                className="shrink-0 min-w-[80px]"
              >
                {topping ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Via UPI / Card · Secure Razorpay</p>
          </Card>
        )}

        {/* Transaction history */}
        <div>
          <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" /> Recent Transactions
          </h3>

          {loadingTxns && (
            <div className="flex justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!loadingTxns && transactions.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-6">No transactions yet.</p>
          )}

          {!loadingTxns && transactions.length > 0 && (
            <div className="space-y-2">
              {transactions.slice(0, 10).map(t => {
                const isCredit = t.type === 'credit';
                const date     = t.created_at
                  ? new Date(t.created_at).toLocaleDateString('en-IN', { dateStyle: 'medium' })
                  : (t.date ?? '');
                return (
                  <Card key={t.id} className="p-3 border-border flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isCredit ? 'bg-green-100' : 'bg-red-100'
                      }`}
                    >
                      {isCredit
                        ? <ArrowDownLeft className="w-4 h-4 text-green-600" />
                        : <ArrowUpRight  className="w-4 h-4 text-red-600"   />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {t.description ?? (isCredit ? 'Credit' : 'Debit')}
                      </p>
                      <p className="text-xs text-muted-foreground">{date}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-bold ${isCredit ? 'text-green-600' : 'text-red-600'}`}>
                        {isCredit ? '+' : '-'}₹{t.amount.toLocaleString('en-IN')}
                      </p>
                      <Badge
                        variant="outline"
                        className={`text-[9px] ${t.status === 'completed' ? '' : 'bg-amber-50'}`}
                      >
                        {t.status ?? 'pending'}
                      </Badge>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
