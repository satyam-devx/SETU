import React, { useState, useEffect } from 'react';
import { Shield, CreditCard, ArrowRight, Loader2, Info, CheckCircle, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import AppHeader from '@/components/shared/AppHeader';
import { CreditAPI } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { initiateUPIPayment } from '@/lib/payments';

export default function CustomerCredit() {
  const { user, profile } = useAuth();
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [repaying, setRepaying] = useState(false);
  const [amount, setAmount] = useState('');
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);

  const fetchAccount = async () => {
    setLoading(true);
    const { data, error: err } = await CreditAPI.getAccount(user.id);
    if (data) setAccount(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchAccount();
  }, [user.id]);

  const handleApply = async () => {
    const n = parseInt(amount, 10);
    if (!n || n <= 0) return;

    setApplying(true);
    setError(null);
    try {
      const { data, error: err } = await CreditAPI.applyCredit(user.id, n, 'General Purchase');
      if (err) throw err;
      setSuccess('Credit application approved and disbursed!');
      setAmount('');
      fetchAccount();
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      setError(err.message || 'Application failed.');
    } finally {
      setApplying(false);
    }
  };

  const handleRepay = async () => {
    if (!account || account.outstanding <= 0) return;

    setRepaying(true);
    setError(null);
    try {
      // 1. UPI Payment for repayment
      const pResult = await initiateUPIPayment({
        amount: account.outstanding,
        orderId: `REPAY_${user.id}_${Date.now()}`,
        customerName: profile?.name,
        phone: profile?.phone
      });

      if (pResult.cancelled) {
        setRepaying(false);
        return;
      }

      // 2. Update DB
      const { error: err } = await CreditAPI.repay(user.id, account.outstanding);
      if (err) throw err;

      setSuccess('Repayment successful! Your credit limit has been restored.');
      fetchAccount();
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      setError('Repayment failed. Please contact support.');
    } finally {
      setRepaying(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="pb-20">
      <AppHeader title="SETU Credit" showBack />

      <div className="px-4 py-4 space-y-4">
        {success && (
          <div className="p-3 bg-green-50 border border-green-100 rounded-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <p className="text-xs text-green-700 font-medium">{success}</p>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <p className="text-xs text-red-700 font-medium">{error}</p>
          </div>
        )}

        {/* Credit Score Card */}
        <Card className="p-5 border-border bg-gradient-to-br from-background to-secondary/20">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Credit Score</p>
              <p className="text-4xl font-black text-foreground">{account?.score || 500}</p>
            </div>
            <Badge className="bg-green-100 text-green-700 border-green-200">
              {account?.score > 700 ? 'Excellent' : 'Good'}
            </Badge>
          </div>
          <div className="h-2 w-full bg-muted rounded-full overflow-hidden flex">
            <div className="h-full bg-red-400" style={{ width: '30%' }} />
            <div className="h-full bg-amber-400" style={{ width: '30%' }} />
            <div className="h-full bg-green-500" style={{ width: '40%' }} />
            <div className="absolute h-4 w-1 bg-foreground -mt-1" style={{ left: `${(account?.score / 900) * 100}%` }} />
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">Based on your transaction history in Madhepur</p>
        </Card>

        {/* Limit Card */}
        <Card className="p-5 border-accent/20 bg-accent/5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase">Available Limit</p>
              <p className="text-2xl font-bold text-accent">₹{(account?.available || 0).toLocaleString()}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground uppercase">Outstanding</p>
              <p className="text-2xl font-bold text-destructive">₹{(account?.outstanding || 0).toLocaleString()}</p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-accent/10">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">Total Credit Limit</span>
              <span className="font-semibold">₹{(account?.limit || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Repayment Rate</span>
              <span className="text-green-600 font-bold">{account?.repaymentRate || 100}%</span>
            </div>
          </div>
        </Card>

        {/* Repay Button */}
        {account?.outstanding > 0 && (
          <Button
            className="w-full h-12 rounded-xl bg-foreground text-background hover:bg-foreground/90 font-bold gap-2 shadow-lg"
            onClick={handleRepay}
            disabled={repaying}
          >
            {repaying ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
            Repay Outstanding Amount
          </Button>
        )}

        {/* Apply Card */}
        <Card className="p-5 border-border">
          <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
            <ArrowRight className="w-4 h-4 text-primary" /> Apply for Credit
          </h3>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold">₹</span>
              <Input
                type="number"
                placeholder="Amount"
                className="pl-7 h-10"
                value={amount}
                onChange={e => setAmount(e.target.value)}
              />
            </div>
            <Button
              className="h-10 px-6 rounded-lg"
              disabled={applying || !amount || parseInt(amount) > account?.available}
              onClick={handleApply}
            >
              {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
            <Info className="w-3 h-3" /> Approval is instant for amounts under ₹2,000
          </p>
        </Card>

        {/* Security Notice */}
        <div className="p-4 bg-muted/40 rounded-2xl flex items-start gap-3">
          <Shield className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold">SETU Trust Guarantee</p>
            <p className="text-[10px] text-muted-foreground">
              Credit is provided in partnership with local cooperative societies.
              Always borrow responsibly. Interest-free for first 15 days.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
