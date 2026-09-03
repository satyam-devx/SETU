import React from 'react';
import { Gift, Clock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import AppHeader from '@/components/shared/AppHeader';
import { useFeatureFlag } from '@/lib/featureFlags';

// PASS 5 FIX (DATA-01): this screen previously showed a hardcoded
// referral code and a hardcoded list of "friends" with fabricated ₹
// earnings — none of it backed by any table, RPC, or real data (no
// `referrals` table exists anywhere in the schema; see Pass 2/4 audit).
// Real users could mistake those numbers for actual earned money.
//
// Pass 5 does not build the referral backend (out of scope). Instead
// this screen now always shows a truthful "coming soon" state and
// never renders any fabricated financial figures, regardless of the
// `referral` feature flag's value — the flag only controls whether the
// nav entry/route is reachable at all (gated at the router/nav level
// via the existing `useFeatureFlag` mechanism), not what this screen
// displays once reached.

export default function CustomerReferral() {
  // Present for future use once a real referral backend exists; not
  // used to decide what to render here, since there is nothing real to
  // show either way. Kept so the flag's evaluated state stays visible
  // to future development (e.g. via logs / devtools) without gating
  // fabricated content.
  useFeatureFlag('referral');

  return (
    <div className="pb-6">
      <AppHeader title="Refer & Earn" showBack />
      <div className="px-4 py-4">
        <Card className="p-6 border-border text-center">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <Gift className="w-7 h-7 text-primary" />
          </div>
          <h2 className="font-bold text-lg">Refer & Earn is coming soon</h2>
          <p className="text-sm text-muted-foreground mt-2">
            We're still building this feature. There's no referral code or
            reward balance to show yet — check back later.
          </p>
          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Clock className="w-3.5 h-3.5" />
            <span>Nothing to set up right now</span>
          </div>
        </Card>
      </div>
    </div>
  );
}
