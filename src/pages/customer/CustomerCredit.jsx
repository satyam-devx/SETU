import React, { useState, useEffect, useCallback } from 'react';
import {
  CreditCard, ArrowUpRight, ArrowDownLeft, TrendingUp,
  CheckCircle, Clock, AlertCircle, Loader2, RefreshCw,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import AppHeader from '@/components/shared/AppHeader';
import { useAuth } from '@/lib/AuthContext';
import { CreditAPI } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { loadRazorpayScript, initiatePayment } from '@/lib/payments';

const REPAY_AMOUNTS = [200, 500, 1000, 1200];

export default function CustomerCredit() {
  const { user, profile } = useAuth();

  // ── Account state ─────────────────────────────────────────
  const [account,     setAccount]     = useState(null);
  const [loadingAcct, setLoadingAcct] = useState(true);
  const [acctError,   setAcctError]   = useState(null);

  // ── Transactions state ────────────────────────────────────
  const [transactions,  setTransactions]  = useState([]);
  const [loadingTxns,   setLoadingTxns]   = useState(true);

  // ── Action state ──────────────────────────────────────────
  const [applyAmt,       setApplyAmt]       = useState('');
  const [applyPurpose,   setApplyPurpose]   = useState('');
  const [applying,       setApplying]       = useState(false);
  const [applySubmitted, setApplySubmitted] = useState(false);

  const [repayAmt,  setRepayAmt]  = useState('');
  const [repaying,  setRepaying]  = useState(false);
  const [repaid,    setRepaid]    = useState(false);

  const [error,      setError]      = useState(null);
  const [showApply,  setShowApply]  = useState(false);
  const [showRepay,  setShowRepay]  = useState(false);

  // ── Fetch account ─────────────────────────────────────────
  const loadAccount = useCallback(async () => {
    if (!user) return;
    setLoadingAcct(true);
    setAcctError(null);
    const { data, error: e } = await CreditAPI.getAccount(user.id);
    if (e) setAcctError(e.message ?? 'Could not load credit account.');
    else   setAccount(data);
    setLoadingAcct(false);
  }, [user]);

  // ── Fetch credit transactions ─────────────────────────────
  const loadTransactions = useCallback(async () => {
    if (!user) return;
    setLoadingTxns(true);
    // Credit transactions live in credit_transactions table
    const { data, error: e } = await supabase
      .from('credit_transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    if (!e) setTransactions(data ?? []);
    setLoadingTxns(false);
  }, [user]);

  useEffect(() => {
    loadRazorpayScript();
    loadAccount();
    loadTransactions();
  }, [loadAccount, loadTransactions]);

  // ── Apply for credit ──────────────────────────────────────
  const handleApply = async () => {
    if (!applyAmt) return;
    setApplying(true);
    setError(null);
    const { data, error: apiError } = await CreditAPI.applyCredit(
      user.id,
      parseInt(applyAmt, 10),
      applyPurpose
    );
    setApplying(false);
    if (apiError) {
      setError(apiError.message ?? 'Credit application failed.');
      return;
    }
    setApplySubmitted(true);
    setShowApply(false);
    await loadAccount();
    await loadTransactions();
  };

  // ── Repay via Razorpay ────────────────────────────────────
  const handleRepay = async () => {
    if (!repayAmt) return;
    setRepaying(true);
    setError(null);
    try {
      const rzpResult = await initiatePayment({
        amount:        parseInt(repayAmt, 10),
        customerId:    user.id,
        customerName:  profile?.name,
        customerPhone: profile?.phone,
        type:          'credit_repayment',
      });

      if (rzpResult.error) throw new Error(rzpResult.error);

      if (!rzpResult.cancelled) {
        setRepaid(true);
        setShowRepay(false);
        setRepayAmt('');
        await loadAccount();
        await loadTransactions();
        setTimeout(() => setRepaid(false), 3000);
      }
    } catch (err) {
      setError(err.message ?? 'Repayment failed. Please try again.');
    } finally {
      setRepaying(false);
    }
  };

  // ── Derived values ────────────────────────────────────────
  const creditLimit   = account?.credit_limit  ?? account?.limit       ?? 0;
  const outstanding   = account?.outstanding    ?? 0;
  const available     = creditLimit - outstanding;
  const usagePct      = creditLimit > 0 ? Math.round((outstanding / creditLimit) * 100) : 0;
  const repaymentRate = account?.repayment_rate ?? account?.repaymentRate ?? 100;
  const score         = profile?.setu_score ?? account?.score ?? 500;

  return (
    <div className="pb-6">
      <AppHeader title="SETU Credit" showBack />
      <div className="px-4 py-4 space-y-4">

        {/* Global error */}
        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl flex items-start gap-2 text-destructive">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="text-xs font-medium">{error}</p>
          </div>
        )}

        {/* Credit summary */}
        {loadingAcct ? (
          <Card className="p-6 border-primary/20 bg-gradient-to-br from-primary/10 to-background flex items-center justify-center h-28">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </Card>
        ) : acctError ? (
          <Card className="p-6 border-destructive/20 bg-destructive/5 flex flex-col items-center gap-2">
            <AlertCircle className="w-6 h-6 text-destructive" />
            <p className="text-xs text-destructive">{acctError}</p>
            <Button size="sm" variant="outline" onClick={loadAccount}>
              <RefreshCw className="w-3 h-3 mr-1" /> Retry
            </Button>
          </Card>
        ) : account ? (
          <Card className="p-5 border-primary/20 bg-gradient-to-br from-primary/10 to-background">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Available Credit</p>
            <p className="text-4xl font-bold text-primary mt-1">₹{available.toLocaleString('en-IN')}</p>
            <div className="mt-3">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Used: ₹{outstanding.toLocaleString('en-IN')}</span>
                <span>Limit: ₹{creditLimit.toLocaleString('en-IN')}</span>
              </div>
              <Progress value={usagePct} className="h-2" />
            </div>
            <div className="mt-3 flex items-center gap-3">
              <Badge className="bg-green-100 text-green-700 border-0 text-xs">
                {account.status ?? 'Active'}
              </Badge>
              <span className="text-xs text-muted-foreground">
                Repayment rate: {repaymentRate}%
              </span>
            </div>
          </Card>
        ) : (
          <Card className="p-4 border-border text-center">
            <p className="text-sm text-muted-foreground">No credit account linked yet.</p>
          </Card>
        )}

        {/* Status toasts */}
        {repaid && (
          <Card className="p-3 border-green-200 bg-green-50 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <p className="text-sm text-green-700 font-medium">
              Repayment successful! Account updated.
            </p>
          </Card>
        )}
        {applySubmitted && (
          <Card className="p-3 border-blue-200 bg-blue-50 flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-600" />
            <p className="text-sm text-blue-700 font-medium">
              Application submitted — decision within 24 hours.
            </p>
          </Card>
        )}

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            className="h-11 gap-2"
            onClick={() => { setShowApply(s => !s); setShowRepay(false); }}
          >
            <ArrowUpRight className="w-4 h-4" /> Use Credit
          </Button>
          <Button
            variant="outline"
            className="h-11 gap-2"
            onClick={() => { setShowRepay(s => !s); setShowApply(false); }}
          >
            <ArrowDownLeft className="w-4 h-4" /> Repay
          </Button>
        </div>

        {/* Apply panel */}
        {showApply && (
          <Card className="p-4 border-primary/30 bg-primary/5">
            <h3 className="font-semibold text-sm mb-3">Apply for Credit</h3>
            <div className="flex gap-2 flex-wrap mb-3">
              {[500, 1000, 2000, 3000].map(a => (
                <button
                  key={a}
                  onClick={() => setApplyAmt(String(a))}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    applyAmt === String(a)
                      ? 'bg-primary text-white border-primary'
                      : 'border-border bg-card'
                  }`}
                >
                  ₹{a.toLocaleString()}
                </button>
              ))}
            </div>
            <Input
              placeholder="Or enter amount"
              type="number"
              className="mb-2"
              value={applyAmt}
              onChange={e => setApplyAmt(e.target.value)}
            />
            <Input
              placeholder="Purpose (e.g. groceries, medicine)"
              className="mb-3"
              value={applyPurpose}
              onChange={e => setApplyPurpose(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mb-3">
              Repayment due within 15 days · No interest
            </p>
            <Button className="w-full" onClick={handleApply} disabled={applying || !applyAmt}>
              {applying
                ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Applying...</>
                : 'Apply Now'}
            </Button>
          </Card>
        )}

        {/* Repay panel */}
        {showRepay && (
          <Card className="p-4 border-accent/30 bg-accent/5">
            <h3 className="font-semibold text-sm mb-3">Repay Credit</h3>
            <div className="flex gap-2 flex-wrap mb-3">
              {REPAY_AMOUNTS.map(a => (
                <button
                  key={a}
                  onClick={() => setRepayAmt(String(a))}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    repayAmt === String(a)
                      ? 'bg-accent text-white border-accent'
                      : 'border-border bg-card'
                  }`}
                >
                  ₹{a}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Amount"
                type="number"
                className="flex-1"
                value={repayAmt}
                onChange={e => setRepayAmt(e.target.value)}
              />
              <Button
                className="bg-accent hover:bg-accent/90 min-w-[100px]"
                onClick={handleRepay}
                disabled={repaying || !repayAmt}
              >
                {repaying ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Repay'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Repay using UPI / Card</p>
          </Card>
        )}

        {/* SETU Score */}
        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" /> Your SETU Score
          </h3>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full border-4 border-primary flex items-center justify-center shrink-0">
              <span className="text-lg font-bold text-primary">{score}</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-green-600">Account Standing</p>
              <p className="text-xs text-muted-foreground">Improve score by timely repayments</p>
            </div>
          </div>
        </Card>

        {/* Transaction history */}
        <div>
          <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" /> Credit Transactions
          </h3>

          {loadingTxns && (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!loadingTxns && transactions.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">No transactions yet.</p>
          )}

          {!loadingTxns && transactions.length > 0 && (
            <div className="space-y-2">
              {transactions.map(t => {
                const isCredit = t.type === 'credit' || t.type === 'disbursal';
                const date     = t.created_at
                  ? new Date(t.created_at).toLocaleDateString('en-IN', { dateStyle: 'medium' })
                  : '';
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
                        {t.description ?? (isCredit ? 'Credit disbursed' : 'Repayment')}
                      </p>
                      <p className="text-xs text-muted-foreground">{date}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-bold ${isCredit ? 'text-green-600' : 'text-red-600'}`}>
                        {isCredit ? '+' : '-'}₹{t.amount.toLocaleString('en-IN')}
                      </p>
                      <Badge variant="outline" className="text-[9px]">
                        {t.status ?? 'completed'}
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
