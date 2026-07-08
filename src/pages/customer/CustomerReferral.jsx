import React, { useState } from 'react';
import { Copy, Share2, Users, Gift, CheckCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import AppHeader from '@/components/shared/AppHeader';

const REFERRAL_CODE = 'ANITA-SETU-2025';

const referrals = [
  { name: 'Rekha Kumari',  status: 'active',  earned: 100, date: '2 days ago' },
  { name: 'Mohan Lal',     status: 'pending', earned: 0,   date: '4 days ago' },
  { name: 'Priya Singh',   status: 'active',  earned: 100, date: '1 week ago' },
];

export default function CustomerReferral() {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard?.writeText(REFERRAL_CODE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const totalEarned  = referrals.filter(r => r.status === 'active').reduce((s, r) => s + r.earned, 0);
  const activeCount  = referrals.filter(r => r.status === 'active').length;

  return (
    <div className="pb-6">
      <AppHeader title="Refer & Earn" showBack />
      <div className="px-4 py-4 space-y-4">

        {/* Hero */}
        <Card className="p-5 border-primary/30 bg-primary/5 text-center">
          <Gift className="w-10 h-10 text-primary mx-auto mb-2" />
          <h2 className="font-bold text-lg">Earn ₹100 per referral</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Invite friends to SETU. You get ₹100 when they place their first order.
          </p>
          <div className="mt-4 p-3 bg-background rounded-xl border border-primary/20">
            <p className="text-xs text-muted-foreground mb-1">Your referral code</p>
            <p className="font-mono font-bold text-lg tracking-widest">{REFERRAL_CODE}</p>
          </div>
          <div className="flex gap-2 mt-3">
            <Button className="flex-1 gap-2" onClick={handleCopy}>
              <Copy className="w-4 h-4" />
              {copied ? 'Copied!' : 'Copy Code'}
            </Button>
            <Button variant="outline" className="flex-1 gap-2">
              <Share2 className="w-4 h-4" /> Share
            </Button>
          </div>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <Card className="p-3 border-border">
            <p className="text-2xl font-bold">{referrals.length}</p>
            <p className="text-[10px] text-muted-foreground">Invited</p>
          </Card>
          <Card className="p-3 border-border">
            <p className="text-2xl font-bold text-green-600">{activeCount}</p>
            <p className="text-[10px] text-muted-foreground">Active</p>
          </Card>
          <Card className="p-3 border-border">
            <p className="text-2xl font-bold text-primary">₹{totalEarned}</p>
            <p className="text-[10px] text-muted-foreground">Earned</p>
          </Card>
        </div>

        {/* Referral list */}
        <div>
          <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" /> My Referrals
          </h3>
          <div className="space-y-2">
            {referrals.map((r, i) => (
              <Card key={i} className="p-3 border-border flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/5 flex items-center justify-center font-bold text-primary text-sm shrink-0">
                  {r.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{r.name}</p>
                  <p className="text-xs text-muted-foreground">{r.date}</p>
                </div>
                <div className="text-right shrink-0">
                  {r.status === 'active'
                    ? <Badge className="text-[9px] bg-green-100 text-green-700 border-0 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> ₹{r.earned}
                      </Badge>
                    : <Badge className="text-[9px] bg-amber-100 text-amber-700 border-0">Pending</Badge>
                  }
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* How it works */}
        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3">How it works</h3>
          <div className="space-y-2">
            {[
              { step: '1', text: 'Share your referral code with friends' },
              { step: '2', text: 'They sign up on SETU using your code' },
              { step: '3', text: 'They place their first order' },
              { step: '4', text: 'You both get ₹100 in SETU wallet!' },
            ].map(s => (
              <div key={s.step} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary text-white text-xs flex items-center justify-center shrink-0 font-bold">
                  {s.step}
                </div>
                <p className="text-sm text-muted-foreground pt-0.5">{s.text}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
