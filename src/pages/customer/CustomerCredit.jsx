import React, { useState } from 'react';
import { Shield, ChevronRight, CheckCircle, Clock, AlertTriangle, IndianRupee, CreditCard, TrendingUp, Calendar } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AppHeader from '@/components/shared/AppHeader';
import { WALLET } from '@/lib/mockData';

const repaymentSchedule = [
  { id: 'r1', dueDate: '2025-06-07', amount: 400, status: 'upcoming', description: 'Order SETU-2025-0002' },
  { id: 'r2', dueDate: '2025-06-14', amount: 300, status: 'upcoming', description: 'Order SETU-2025-0003' },
  { id: 'r3', dueDate: '2025-05-31', amount: 500, status: 'overdue', description: 'Order SETU-2025-0001' },
];

const creditHistory = [
  { date: '2025-05-01', type: 'disbursed', amount: 1000, desc: 'Credit for order SETU-2025-0001' },
  { date: '2025-05-07', type: 'repaid', amount: 500, desc: 'Repayment via UPI' },
  { date: '2025-05-15', type: 'disbursed', amount: 700, desc: 'Credit for order SETU-2025-0003' },
  { date: '2025-05-21', type: 'repaid', amount: 700, desc: 'Repayment via SETU Wallet' },
];

const TABS = ['Overview', 'Apply', 'Repay', 'History'];

export default function CustomerCredit() {
  const [tab, setTab] = useState('Overview');
  const [applyStep, setApplyStep] = useState(1);
  const available = WALLET.creditLimit - WALLET.creditUsed;

  return (
    <div className="pb-24">
      <AppHeader title="SETU Credit" subtitle="Buy Now, Pay Later" showBack />

      {/* Tab bar */}
      <div className="flex border-b border-border sticky top-0 bg-card z-10">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`flex-1 py-3 text-xs font-medium transition-colors border-b-2 ${tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}>{t}</button>
        ))}
      </div>

      <div className="px-4 py-4">
        {tab === 'Overview' && (
          <div className="space-y-4">
            {/* Credit card */}
            <Card className="bg-gradient-to-br from-foreground to-foreground/80 text-background p-5 rounded-2xl border-0">
              <p className="text-xs opacity-60 uppercase tracking-wide mb-1">SETU Credit Account</p>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-xs opacity-70">Available Credit</p>
                  <h2 className="text-3xl font-bold">₹{available.toLocaleString()}</h2>
                </div>
                <div className="text-right">
                  <p className="text-xs opacity-70">Used</p>
                  <p className="text-xl font-bold">₹{WALLET.creditUsed.toLocaleString()}</p>
                </div>
              </div>
              <Progress value={(WALLET.creditUsed / WALLET.creditLimit) * 100} className="h-1.5 mt-3 bg-white/20" />
              <div className="flex justify-between text-[10px] opacity-60 mt-1">
                <span>₹0</span>
                <span>Limit: ₹{WALLET.creditLimit.toLocaleString()}</span>
              </div>
            </Card>

            {/* SETU Score */}
            <Card className="p-4 border-border">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm">SETU Credit Score</h3>
                <span className={`text-2xl font-bold ${WALLET.creditScore >= 700 ? 'text-accent' : WALLET.creditScore >= 600 ? 'text-amber-600' : 'text-destructive'}`}>{WALLET.creditScore}</span>
              </div>
              <Progress value={(WALLET.creditScore / 900) * 100} className="h-3 mb-2" />
              <div className="flex justify-between text-[10px] text-muted-foreground mb-3">
                <span>300 (Poor)</span><span>600 (Fair)</span><span>750 (Good)</span><span>900 (Excellent)</span>
              </div>
              <div className="space-y-2">
                {[
                  { label: 'Order History', score: 95, max: 100 },
                  { label: 'Repayment Rate', score: 100, max: 100 },
                  { label: 'Anchor Endorsement', score: 80, max: 100 },
                  { label: 'Active on SETU', score: 85, max: 100 },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-3 text-xs">
                    <span className="text-muted-foreground w-32">{item.label}</span>
                    <Progress value={(item.score / item.max) * 100} className="flex-1 h-1.5" />
                    <span className="font-medium w-8 text-right">{item.score}</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Upcoming repayments */}
            {repaymentSchedule.some(r => r.status === 'overdue') && (
              <Card className="p-4 border-destructive/30 bg-destructive/5">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                  <h3 className="font-semibold text-sm text-destructive">Overdue Repayment</h3>
                </div>
                {repaymentSchedule.filter(r => r.status === 'overdue').map(r => (
                  <div key={r.id} className="flex items-center justify-between">
                    <p className="text-sm">{r.description} — ₹{r.amount}</p>
                    <Button size="sm" className="h-7 text-xs bg-destructive hover:bg-destructive/90" onClick={() => setTab('Repay')}>Pay Now</Button>
                  </div>
                ))}
              </Card>
            )}

            <Card className="p-4 border-border">
              <h3 className="font-semibold text-sm mb-3">Upcoming Repayments</h3>
              {repaymentSchedule.filter(r => r.status === 'upcoming').map(r => (
                <div key={r.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <p className="text-sm">{r.description}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3" /> Due: {r.dueDate}</p>
                  </div>
                  <span className="font-bold">₹{r.amount}</span>
                </div>
              ))}
            </Card>

            <Button className="w-full" onClick={() => setTab('Apply')}>Increase Credit Limit <ChevronRight className="w-4 h-4 ml-1" /></Button>
          </div>
        )}

        {tab === 'Apply' && (
          <div className="space-y-4">
            {applyStep === 1 && (
              <>
                <div>
                  <h2 className="text-xl font-bold mb-1">Apply for Credit</h2>
                  <p className="text-sm text-muted-foreground">SETU Credit is based on your purchase history and trust in the community — not a CIBIL score.</p>
                </div>
                <Card className="p-4 border-border space-y-3">
                  <h3 className="font-semibold text-sm">How much do you need?</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {['₹1,000', '₹2,000', '₹5,000', '₹10,000', '₹15,000', '₹20,000'].map(amt => (
                      <button key={amt} className="text-sm py-2.5 rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-colors font-medium">{amt}</button>
                    ))}
                  </div>
                  <Input placeholder="Or enter custom amount" />
                </Card>
                <Card className="p-4 border-border space-y-2">
                  <h3 className="font-semibold text-sm">Purpose of Credit</h3>
                  <Select>
                    <SelectTrigger><SelectValue placeholder="What will you use it for?" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="groceries">Groceries & Daily Needs</SelectItem>
                      <SelectItem value="festival">Festival Shopping</SelectItem>
                      <SelectItem value="farming">Farm Inputs</SelectItem>
                      <SelectItem value="education">Child Education</SelectItem>
                      <SelectItem value="medical">Medical Expenses</SelectItem>
                      <SelectItem value="home">Home Repair</SelectItem>
                    </SelectContent>
                  </Select>
                </Card>
                <Card className="p-3 bg-muted/50 border-border">
                  <p className="text-xs text-muted-foreground">
                    <strong>No Interest for 7 days.</strong> After that, <strong>1% per week</strong> on outstanding balance. 
                    SETU Credit is designed to help, not trap you in debt. Your Village Anchor is here if you need help.
                  </p>
                </Card>
                <Button className="w-full" onClick={() => setApplyStep(2)}>Check Eligibility</Button>
              </>
            )}
            {applyStep === 2 && (
              <>
                <div className="text-center py-4">
                  <div className="w-16 h-16 bg-accent/20 rounded-full flex items-center justify-center mx-auto mb-3">
                    <CheckCircle className="w-8 h-8 text-accent" />
                  </div>
                  <h2 className="text-xl font-bold mb-1">You're Eligible!</h2>
                  <p className="text-sm text-muted-foreground">Based on your SETU score of {WALLET.creditScore} and 24 orders.</p>
                </div>
                <Card className="p-4 border-border space-y-3">
                  <div className="flex justify-between"><span className="text-sm text-muted-foreground">Credit Amount</span><span className="font-bold">₹5,000</span></div>
                  <div className="flex justify-between"><span className="text-sm text-muted-foreground">Interest-Free Period</span><span className="font-bold text-accent">7 days</span></div>
                  <div className="flex justify-between"><span className="text-sm text-muted-foreground">After 7 days</span><span className="font-bold">1% / week</span></div>
                  <div className="flex justify-between"><span className="text-sm text-muted-foreground">Repayment via</span><span className="font-bold">UPI / Wallet / Cash</span></div>
                </Card>
                <div className="bg-muted/50 rounded-xl p-3">
                  <p className="text-xs text-muted-foreground">By accepting, I agree to repay on time. I understand that non-repayment affects my entire village's credit access and my SETU trust score.</p>
                </div>
                <Button className="w-full">Accept & Activate Credit ✓</Button>
                <Button variant="outline" className="w-full" onClick={() => setApplyStep(1)}>Go Back</Button>
              </>
            )}
          </div>
        )}

        {tab === 'Repay' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold mb-1">Make a Repayment</h2>
            <Card className="p-4 border-destructive/30 bg-destructive/5">
              <p className="text-sm font-medium text-destructive">Outstanding: ₹{WALLET.creditUsed}</p>
              <p className="text-xs text-muted-foreground">Overdue: ₹500 — Pay immediately to avoid late fees</p>
            </Card>
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Amount to Pay</p>
              <div className="flex gap-2 flex-wrap">
                {['₹500', '₹700', '₹1,000', 'Full Amount'].map(a => (
                  <button key={a} className="text-sm px-4 py-2 rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-colors">{a}</button>
                ))}
              </div>
              <Input placeholder="Enter custom amount" />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Payment Method</p>
              {[
                { label: 'UPI', icon: '📱', desc: 'Instant settlement' },
                { label: 'SETU Wallet', icon: '💰', desc: `Balance: ₹${WALLET.balance}` },
                { label: 'Cash at Village Point', icon: '💵', desc: 'Give cash to Village Anchor' },
              ].map(m => (
                <Card key={m.label} className="p-3 border-border flex items-center gap-3 cursor-pointer hover:border-primary transition-colors">
                  <span className="text-xl">{m.icon}</span>
                  <div>
                    <p className="text-sm font-medium">{m.label}</p>
                    <p className="text-xs text-muted-foreground">{m.desc}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto" />
                </Card>
              ))}
            </div>
            <Button className="w-full">Pay ₹500 Now</Button>
          </div>
        )}

        {tab === 'History' && (
          <div className="space-y-2">
            {creditHistory.map((h, i) => (
              <Card key={i} className="p-3 border-border">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${h.type === 'repaid' ? 'bg-green-100' : 'bg-primary/10'}`}>
                    {h.type === 'repaid' ? <CheckCircle className="w-4 h-4 text-accent" /> : <CreditCard className="w-4 h-4 text-primary" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{h.desc}</p>
                    <p className="text-[10px] text-muted-foreground">{h.date}</p>
                  </div>
                  <span className={`font-bold text-sm ${h.type === 'repaid' ? 'text-accent' : 'text-foreground'}`}>
                    {h.type === 'repaid' ? '-' : '+'}₹{h.amount}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
