import React, { useState, useEffect } from 'react';
import { CreditCard, ArrowUpRight, ArrowDownLeft, TrendingUp, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import AppHeader from '@/components/shared/AppHeader';
import { CreditAPI } from '@/lib/api';
import { useStore } from '@/lib/store';

const REPAY_AMOUNTS = [200, 500, 1000, 1200];

export default function CustomerCredit() {
  const { state } = useStore();
  const [account, setAccount] = useState(null);
  const [applying, setApplying] = useState(false);
  const [applyAmt, setApplyAmt] = useState('');
  const [applyPurpose, setApplyPurpose] = useState('');
  const [applySubmitted, setApplySubmitted] = useState(false);
  const [repayAmt, setRepayAmt] = useState('');
  const [repaying, setRepaying] = useState(false);
  const [repaid, setRepaid]     = useState(false);
  const [showApply, setShowApply] = useState(false);
  const [showRepay, setShowRepay] = useState(false);

  useEffect(() => {
    CreditAPI.getAccount('u1').then(({ data }) => data && setAccount(data));
  }, []);

  const handleApply = () => {
    if (!applyAmt) return;
    setApplying(true);
    CreditAPI.applyCredit('u1', parseInt(applyAmt), applyPurpose).then(({ data }) => {
      setApplying(false);
      if (data) { setApplySubmitted(true); setShowApply(false); }
    });
  };

  const handleRepay = () => {
    if (!repayAmt) return;
    setRepaying(true);
    CreditAPI.repay('u1', parseInt(repayAmt)).then(({ data }) => {
      setRepaying(false);
      if (data) { setRepaid(true); setShowRepay(false); setTimeout(() => setRepaid(false), 3000); }
    });
  };

  const score = state.currentUser.setuScore;

  const TRANSACTIONS = [
    { type: 'debit',  label: 'Used at checkout',          amount: 450,  date: '2 days ago',  status: 'outstanding' },
    { type: 'debit',  label: 'Used at checkout',          amount: 320,  date: '5 days ago',  status: 'outstanding' },
    { type: 'credit', label: 'Repayment',                 amount: 1000, date: '1 week ago',  status: 'completed'   },
    { type: 'debit',  label: 'Used at checkout',          amount: 280,  date: '2 weeks ago', status: 'paid'        },
  ];

  return (
    <div className="pb-6">
      <AppHeader title="SETU Credit" showBack />
      <div className="px-4 py-4 space-y-4">

        {/* Credit summary */}
        {account && (
          <Card className="p-5 border-primary/20 bg-gradient-to-br from-primary/10 to-background">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Available Credit</p>
            <p className="text-4xl font-bold text-primary mt-1">₹{account.available.toLocaleString()}</p>
            <div className="mt-3">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Used: ₹{account.outstanding.toLocaleString()}</span>
                <span>Limit: ₹{account.limit.toLocaleString()}</span>
              </div>
              <Progress value={Math.round((account.outstanding / account.limit) * 100)} className="h-2" />
            </div>
            <div className="mt-3 flex items-center gap-3">
              <Badge className="bg-green-100 text-green-700 border-0 text-xs">Active</Badge>
              <span className="text-xs text-muted-foreground">Repayment rate: {account.repaymentRate}%</span>
            </div>
          </Card>
        )}

        {repaid && (
          <Card className="p-3 border-green-200 bg-green-50 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <p className="text-sm text-green-700 font-medium">Repayment recorded successfully!</p>
          </Card>
        )}
        {applySubmitted && (
          <Card className="p-3 border-blue-200 bg-blue-50 flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-600" />
            <p className="text-sm text-blue-700 font-medium">Application submitted — decision within 24 hours</p>
          </Card>
        )}

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-2">
          <Button className="h-11 gap-2" onClick={() => { setShowApply(s => !s); setShowRepay(false); }}>
            <ArrowUpRight className="w-4 h-4" /> Use Credit
          </Button>
          <Button variant="outline" className="h-11 gap-2" onClick={() => { setShowRepay(s => !s); setShowApply(false); }}>
            <ArrowDownLeft className="w-4 h-4" /> Repay
          </Button>
        </div>

        {/* Apply panel */}
        {showApply && (
          <Card className="p-4 border-primary/30 bg-primary/5">
            <h3 className="font-semibold text-sm mb-3">Apply for Credit</h3>
            <div className="flex gap-2 flex-wrap mb-3">
              {[500, 1000, 2000, 3000].map(a => (
                <button key={a} onClick={() => setApplyAmt(String(a))}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${applyAmt === String(a) ? 'bg-primary text-white border-primary' : 'border-border bg-card'}`}>
                  ₹{a.toLocaleString()}
                </button>
              ))}
            </div>
            <Input placeholder="Or enter amount" type="number" className="mb-2" value={applyAmt} onChange={e => setApplyAmt(e.target.value)} />
            <Input placeholder="Purpose (e.g. groceries, medicine)" className="mb-3" value={applyPurpose} onChange={e => setApplyPurpose(e.target.value)} />
            <p className="text-xs text-muted-foreground mb-3">Repayment due within 15 days · No interest</p>
            <Button className="w-full" onClick={handleApply} disabled={applying || !applyAmt}>
              {applying ? 'Applying...' : 'Apply Now'}
            </Button>
          </Card>
        )}

        {/* Repay panel */}
        {showRepay && (
          <Card className="p-4 border-accent/30 bg-accent/5">
            <h3 className="font-semibold text-sm mb-3">Repay Credit</h3>
            <div className="flex gap-2 flex-wrap mb-3">
              {REPAY_AMOUNTS.map(a => (
                <button key={a} onClick={() => setRepayAmt(String(a))}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${repayAmt === String(a) ? 'bg-accent text-white border-accent' : 'border-border bg-card'}`}>
                  ₹{a}
                </button>
              ))}
            </div>
            <Input placeholder="Or enter amount" type="number" className="mb-3" value={repayAmt} onChange={e => setRepayAmt(e.target.value)} />
            <Button className="w-full bg-accent hover:bg-accent/90" onClick={handleRepay} disabled={repaying || !repayAmt}>
              {repaying ? 'Processing...' : `Repay ₹${repayAmt || '0'}`}
            </Button>
          </Card>
        )}

        {/* Credit score */}
        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" /> Your SETU Score
          </h3>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full border-4 border-primary flex items-center justify-center shrink-0">
              <span className="text-lg font-bold text-primary">{score}</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-green-600">Good Standing</p>
              <p className="text-xs text-muted-foreground">Eligible for up to ₹5,000</p>
              <Badge className="mt-1 text-[9px] bg-primary/10 text-primary border-0">Top 30% customers</Badge>
            </div>
          </div>
        </Card>

        {/* Transactions */}
        <div>
          <h3 className="font-semibold text-sm mb-2">Credit History</h3>
          <div className="space-y-2">
            {TRANSACTIONS.map((t, i) => (
              <Card key={i} className="p-3 border-border flex items-center gap-3">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${t.type === 'credit' ? 'bg-green-100' : 'bg-primary/10'}`}>
                  {t.type === 'credit'
                    ? <ArrowDownLeft className="w-4 h-4 text-green-600" />
                    : <ArrowUpRight className="w-4 h-4 text-primary" />}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{t.label}</p>
                  <p className="text-xs text-muted-foreground">{t.date}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-bold ${t.type === 'credit' ? 'text-green-600' : 'text-primary'}`}>
                    {t.type === 'credit' ? '-' : '+'}₹{t.amount}
                  </p>
                  <Badge variant="outline" className={`text-[9px] ${t.status === 'outstanding' ? 'bg-amber-50 text-amber-700' : ''}`}>
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
