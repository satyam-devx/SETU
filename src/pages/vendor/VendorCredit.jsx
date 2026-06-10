// ═══════════════════════════════════════════════════════════
// SETU — VendorCredit (v2)
// Changes:
//  - Removed hardcoded credit limit + mock transactions
//  - Fetches credit_accounts for this vendor from Supabase
//  - Fetches credit_transactions for this vendor
//  - Apply credit persisted via CreditAPI.applyCredit
//  - Score + stats derived from account row
//  - Full loading, error, and empty states
// ═══════════════════════════════════════════════════════════
import React, { useState, useEffect, useCallback } from 'react';
import {
  CreditCard, ArrowUpRight, ArrowDownLeft, TrendingUp,
  Loader2, AlertCircle, RefreshCw, CheckCircle, Clock,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import AppHeader from '@/components/shared/AppHeader';
import { useAuth } from '@/lib/AuthContext';
import { useDataFetch } from '@/hooks/useDataFetch';
import { getVendorByOwnerId, CreditAPI } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';

const APPLY_AMOUNTS = [2000, 5000, 7500, 10000];

export default function VendorCredit() {
  const { user } = useAuth();

  // ── Vendor profile ────────────────────────────────────────
  const { data: vendor } = useDataFetch(
    () => getVendorByOwnerId(user?.id),
    [user?.id],
    { cacheKey: `vendor-profile-${user?.id}`, enabled: !!user?.id }
  );

  // ── Credit account ────────────────────────────────────────
  const [account,     setAccount]     = useState(null);
  const [acctLoading, setAcctLoading] = useState(true);
  const [acctError,   setAcctError]   = useState(null);

  // ── Credit transactions ───────────────────────────────────
  const [transactions,  setTransactions]  = useState([]);
  const [txnLoading,    setTxnLoading]    = useState(true);

  // ── Action state ──────────────────────────────────────────
  const [applyAmt,     setApplyAmt]     = useState('');
  const [applyPurpose, setApplyPurpose] = useState('Inventory purchase');
  const [applying,     setApplying]     = useState(false);
  const [applied,      setApplied]      = useState(false);
  const [actionErr,    setActionErr]    = useState(null);
  const [showApply,    setShowApply]    = useState(false);

  // ── Load account ──────────────────────────────────────────
  const loadAccount = useCallback(async (vendorId) => {
    setAcctLoading(true);
    setAcctError(null);
    const { data, error } = await supabase
      .from('credit_accounts')
      .select('*')
      .eq('vendor_id', vendorId)
      .maybeSingle();
    if (error) setAcctError(error.message);
    else        setAccount(data);
    setAcctLoading(false);
  }, []);

  // ── Load transactions ─────────────────────────────────────
  const loadTransactions = useCallback(async (vendorId) => {
    setTxnLoading(true);
    const { data } = await supabase
      .from('credit_transactions')
      .select('*')
      .eq('vendor_id', vendorId)
      .order('created_at', { ascending: false })
      .limit(15);
    setTransactions(data ?? []);
    setTxnLoading(false);
  }, []);

  useEffect(() => {
    if (vendor?.id) {
      loadAccount(vendor.id);
      loadTransactions(vendor.id);
    }
  }, [vendor?.id, loadAccount, loadTransactions]);

  // ── Apply for credit ──────────────────────────────────────
  const handleApply = async () => {
    if (!applyAmt || !vendor?.id) return;
    setApplying(true);
    setActionErr(null);

    const { error } = await CreditAPI.applyCredit(
      vendor.id,
      parseInt(applyAmt, 10),
      applyPurpose
    );

    setApplying(false);
    if (error) {
      setActionErr(error.message ?? 'Application failed. Please try again.');
      return;
    }

    setApplied(true);
    setShowApply(false);
    setApplyAmt('');
    // Refresh account
    await loadAccount(vendor.id);
    await loadTransactions(vendor.id);
    setTimeout(() => setApplied(false), 4000);
  };

  // ── Derived display values ────────────────────────────────
  const creditLimit   = account?.credit_limit  ?? 0;
  const outstanding   = account?.outstanding   ?? 0;
  const available     = creditLimit - outstanding;
  const usagePct      = creditLimit > 0 ? Math.round((outstanding / creditLimit) * 100) : 0;
  const score         = account?.score        ?? vendor?.trust_score ?? 500;
  const onTimeRate    = account?.on_time_rate  ?? 100;
  const platformAge   = account?.platform_age_months ?? '—';

  // Score label
  const scoreLabel = score >= 750 ? 'Excellent'
    : score >= 650 ? 'Good'
    : score >= 550 ? 'Fair'
    : 'Building';

  const scoreColor = score >= 750 ? 'text-green-600'
    : score >= 650 ? 'text-blue-600'
    : 'text-amber-600';

  return (
    <div className="pb-6">
      <AppHeader title="Business Credit" showBack />
      <div className="px-4 py-4 space-y-4">

        {/* Action error */}
        {actionErr && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl flex items-start gap-2 text-destructive">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="text-xs font-medium">{actionErr}</p>
          </div>
        )}

        {/* Applied success */}
        {applied && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-600" />
            <p className="text-xs font-medium text-blue-700">
              Application submitted — decision within 24 hours.
            </p>
          </div>
        )}

        {/* Credit summary */}
        {acctLoading ? (
          <div className="h-28 bg-muted rounded-xl animate-pulse" />
        ) : acctError ? (
          <Card className="p-4 border-destructive/20 bg-destructive/5 flex flex-col items-center gap-2">
            <AlertCircle className="w-6 h-6 text-destructive" />
            <p className="text-xs text-destructive">{acctError}</p>
            <Button size="sm" variant="outline" onClick={() => vendor?.id && loadAccount(vendor.id)}>
              <RefreshCw className="w-3 h-3 mr-1" /> Retry
            </Button>
          </Card>
        ) : account ? (
          <Card className="p-5 border-primary/20 bg-primary/5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Available Credit</p>
            <p className="text-3xl font-bold text-primary mt-1">{formatCurrency(available)}</p>
            <div className="mt-3">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Used: {formatCurrency(outstanding)}</span>
                <span>Limit: {formatCurrency(creditLimit)}</span>
              </div>
              <Progress value={usagePct} className="h-2" />
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Badge className={`text-[9px] border-0 ${account.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                {account.status ?? 'Active'}
              </Badge>
              {account.next_due_date && (
                <span className="text-[10px] text-muted-foreground">
                  Next due: {new Date(account.next_due_date).toLocaleDateString('en-IN')}
                </span>
              )}
            </div>
          </Card>
        ) : (
          <Card className="p-6 border-border text-center">
            <CreditCard className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm font-medium">No credit account yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Apply below to get working capital for inventory
            </p>
          </Card>
        )}

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            className="h-10 gap-2"
            onClick={() => setShowApply(s => !s)}
          >
            <ArrowUpRight className="w-4 h-4" /> Apply Credit
          </Button>
          <Button variant="outline" className="h-10 gap-2" disabled>
            <ArrowDownLeft className="w-4 h-4" /> Repay
          </Button>
        </div>

        {/* Apply panel */}
        {showApply && (
          <Card className="p-4 border-primary/30 bg-primary/5">
            <h3 className="text-sm font-semibold mb-3">Apply for Credit</h3>
            <div className="space-y-3">
              <div className="flex gap-2 flex-wrap">
                {APPLY_AMOUNTS.map(amt => (
                  <button
                    key={amt}
                    onClick={() => setApplyAmt(String(amt))}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                      applyAmt === String(amt)
                        ? 'bg-primary text-white border-primary'
                        : 'border-border bg-card'
                    }`}
                  >
                    {formatCurrency(amt)}
                  </button>
                ))}
              </div>
              <Input
                type="number"
                placeholder="Or enter amount"
                value={applyAmt}
                onChange={e => setApplyAmt(e.target.value)}
              />
              <Input
                placeholder="Purpose (e.g. Inventory purchase, Equipment)"
                value={applyPurpose}
                onChange={e => setApplyPurpose(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Repayment: 30 days · Interest: 0% for first 3 months
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={handleApply}
                  disabled={applying || !applyAmt}
                >
                  {applying
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> Applying...</>
                    : 'Submit Application'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowApply(false)}
                >
                  Cancel
                </Button>
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
              <span className="text-lg font-bold text-primary">{score}</span>
            </div>
            <div>
              <p className={`text-sm font-semibold ${scoreColor}`}>{scoreLabel}</p>
              <p className="text-xs text-muted-foreground">
                {score >= 700 ? 'Eligible for higher limits' : 'Make timely repayments to improve'}
              </p>
              {score >= 700 && (
                <Badge className="mt-1 text-[9px] bg-green-100 text-green-700 border-0">
                  Top 30% vendors
                </Badge>
              )}
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            {[
              { label: 'On-time Payments', value: `${onTimeRate}%` },
              { label: 'Avg Order Value',  value: vendor?.avg_order_value ? formatCurrency(vendor.avg_order_value) : '—' },
              { label: 'Platform Age',     value: platformAge !== '—' ? `${platformAge} mo` : '—' },
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

          {txnLoading && (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!txnLoading && transactions.length === 0 && (
            <Card className="p-4 border-border text-center">
              <p className="text-sm text-muted-foreground">No credit transactions yet.</p>
            </Card>
          )}

          {!txnLoading && transactions.length > 0 && (
            <div className="space-y-2">
              {transactions.map(t => {
                const isCredit = t.type === 'credit' || t.type === 'disbursal';
                const date = t.created_at
                  ? new Date(t.created_at).toLocaleDateString('en-IN', { dateStyle: 'medium' })
                  : '';
                return (
                  <Card key={t.id} className="p-3 border-border flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
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
                        {isCredit ? '+' : '−'}{formatCurrency(t.amount)}
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
