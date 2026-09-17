import React from 'react';
import { Check, Crown, Sparkles, Building2, TrendingUp } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import AppHeader from '@/components/shared/AppHeader';

const plans = [
  {
    name: 'Free', icon: Sparkles, price: 0, current: false,
    features: ['Up to 20 products', 'Basic analytics', 'Standard support', '5% commission'],
  },
  {
    name: 'Pro', icon: Crown, price: 499, current: true, popular: true,
    features: ['Unlimited products', 'Advanced analytics', 'Priority support', '3% commission', 'Featured placement', 'SETU Credit access'],
  },
  {
    name: 'Enterprise', icon: Building2, price: 1499, current: false,
    features: ['Everything in Pro', 'Dedicated manager', 'API access', '1.5% commission', 'Custom branding', 'Bulk operations'],
  },
];

export default function VendorSubscription() {
  return (
    <div className="pb-20">
      <AppHeader title="Subscription" subtitle="Manage your plan" />
      <div className="p-4 space-y-4">
        <Card className="p-4 border-border bg-gradient-to-br from-primary/5 to-accent/5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-lg">Pro Plan</h3>
                <Badge className="bg-primary/10 text-primary text-[9px] border-0">Active</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">₹499/month · Renews on Oct 17, 2026</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-primary">₹499</p>
              <p className="text-[10px] text-muted-foreground">per month</p>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-muted-foreground">Billing cycle usage</span>
              <span className="font-medium">12 / 30 days</span>
            </div>
            <Progress value={40} className="h-1.5" />
          </div>
        </Card>

        <div>
          <h3 className="font-semibold text-sm mb-3">Available Plans</h3>
          <div className="space-y-3">
            {plans.map(plan => (
              <Card key={plan.name} className={`p-4 border-border ${plan.current ? 'border-primary ring-1 ring-primary/20' : ''}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${plan.current ? 'bg-primary/10' : 'bg-muted'}`}>
                      <plan.icon className={`w-5 h-5 ${plan.current ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm">{plan.name}</p>
                        {plan.popular && <Badge className="text-[9px] bg-primary text-primary-foreground border-0">Popular</Badge>}
                        {plan.current && <Badge className="text-[9px] bg-accent/10 text-accent border-0">Current</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">₹{plan.price}/month</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5 mb-3">
                  {plan.features.map(f => (
                    <div key={f} className="flex items-center gap-2 text-xs">
                      <Check className="w-3.5 h-3.5 text-green-500 shrink-0" />
                      <span className={plan.current ? 'text-foreground' : 'text-muted-foreground'}>{f}</span>
                    </div>
                  ))}
                </div>
                <Button className="w-full" variant={plan.current ? 'outline' : 'default'} disabled={plan.current}>
                  {plan.current ? 'Current Plan' : `Upgrade to ${plan.name}`}
                </Button>
              </Card>
            ))}
          </div>
        </div>

        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-2 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" /> Savings with Pro</h3>
          <p className="text-xs text-muted-foreground">You're saving ₹2,400/month on commissions compared to the Free plan, based on your current order volume.</p>
        </Card>
      </div>
    </div>
  );
}
