// ═══════════════════════════════════════════════════════════
// SETU — VendorSubscription (v2)
// Changes:
//  - Redesigned from a single cramped line per plan to match the
//    rest of the vendor portal's card-based visual language
//    (VendorCredit's hero + detail cards).
//  - Added missing showBack (this page had no way back except the
//    hardware/browser back button).
//  - Same data as before (vendor.subscription_tier) — no new fetches.
// ═══════════════════════════════════════════════════════════
import React from 'react';
import { Link } from 'react-router-dom';
import { Check, Crown, Sparkles, Building2, ArrowRight, ShieldCheck } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import AppHeader from '@/components/shared/AppHeader';
import { useAuth } from '@/lib/AuthContext';
import { useVendorByOwner } from '@/hooks/queries/useVendor';

const PLANS = [
  {
    name: 'Free', icon: Sparkles, price: 0,
    tagline: 'Everything you need to get started',
    features: ['Up to 20 products', 'Basic analytics', 'Standard support'],
  },
  {
    name: 'Pro', icon: Crown, price: 499, popular: true,
    tagline: 'For shops ready to grow',
    features: ['Unlimited products', 'Advanced analytics', 'Priority support', 'SETU Credit access'],
  },
  {
    name: 'Enterprise', icon: Building2, price: 1499,
    tagline: 'Dedicated support for larger operations',
    features: ['Everything in Pro', 'Dedicated manager', 'API access', 'Custom operations'],
  },
];

export default function VendorSubscription() {
  const { user } = useAuth();
  const { data: vendor, isLoading } = useVendorByOwner(user?.id);
  const current = String(vendor?.subscription_tier || 'free').toLowerCase();
  const currentPlan = PLANS.find(p => p.name.toLowerCase() === current) ?? PLANS[0];

  return (
    <div className="pb-20">
      <AppHeader title="Subscription" subtitle="Manage your plan" showBack backTo="/vendor/profile" />
      <div className="p-4 space-y-4">

        {/* ── Current plan hero ─────────────────────────────── */}
        <Card className="p-5 border-primary/20 bg-primary/5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <currentPlan.icon className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Current Plan</p>
              <p className="text-lg font-bold">{isLoading ? '…' : currentPlan.name}</p>
            </div>
            <Badge className="bg-primary text-primary-foreground border-0">
              {isLoading ? '…' : current.toUpperCase()}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-3 flex items-start gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            Plan and billing status are read from your vendor account. SETU will confirm any commercial change before charging you.
          </p>
        </Card>

        {/* ── Plans ──────────────────────────────────────────── */}
        <div className="space-y-3">
          {PLANS.map(plan => {
            const Icon = plan.icon;
            const active = current === plan.name.toLowerCase();
            return (
              <Card
                key={plan.name}
                className={`p-4 border relative ${active ? 'border-primary ring-1 ring-primary/20' : 'border-border'}`}
              >
                {plan.popular && !active && (
                  <Badge className="absolute -top-2 right-4 bg-accent text-accent-foreground border-0 text-[9px]">
                    Most Popular
                  </Badge>
                )}
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${active ? 'bg-primary/10' : 'bg-muted'}`}>
                    <Icon className={`w-5 h-5 ${active ? 'text-primary' : ''}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{plan.name}</p>
                      {active && <Badge className="text-[9px] bg-primary text-primary-foreground border-0">Current</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">{plan.tagline}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold">{plan.price ? `₹${plan.price.toLocaleString('en-IN')}` : 'Free'}</p>
                    {plan.price > 0 && <p className="text-[10px] text-muted-foreground">/month</p>}
                  </div>
                </div>

                <div className="mt-3 space-y-1.5 pl-1">
                  {plan.features.map(f => (
                    <p key={f} className="text-xs flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 shrink-0 text-accent" />
                      {f}
                    </p>
                  ))}
                </div>

                {!active && (
                  <Link to="/vendor/support" className="block mt-4">
                    <Button variant="outline" className="w-full h-9 text-xs gap-1">
                      Contact SETU about this plan <ArrowRight className="w-3 h-3" />
                    </Button>
                  </Link>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
