import React from 'react';
import { Trophy, Target, Zap, Gift } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import AppHeader from '@/components/shared/AppHeader';

const incentives = [
  { title: 'Daily Star', description: 'Complete 10 deliveries today', target: 10, current: 7, reward: '₹50 bonus', type: 'daily' },
  { title: 'Weekend Warrior', description: 'Complete 25 deliveries this weekend', target: 25, current: 12, reward: '₹150 bonus', type: 'weekly' },
  { title: 'Top Rated', description: 'Maintain 4.8+ rating this month', target: 4.8, current: 4.6, reward: '₹200 bonus', type: 'monthly' },
];

const badges = [
  { name: 'Fast Delivery', icon: Zap, earned: true },
  { name: 'Top Earner', icon: Trophy, earned: true },
  { name: 'Customer Favorite', icon: Gift, earned: false },
];

export default function RiderIncentives() {
  return (
    <div className="pb-6">
      <AppHeader title="Incentives & Rewards" showBack />
      <div className="px-4 py-4 space-y-4">
        <Card className="p-4 border-border bg-primary/5 border-primary/20">
          <p className="text-xs text-muted-foreground">Total Earned This Month</p>
          <p className="text-3xl font-bold text-primary mt-1">₹1,240</p>
          <p className="text-xs text-muted-foreground mt-1">Base: ₹980 + Incentives: ₹260</p>
        </Card>

        <div>
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Target className="w-4 h-4 text-primary" /> Active Challenges</h3>
          <div className="space-y-3">
            {incentives.map(inc => {
              const pct = Math.min(100, Math.round((inc.current / inc.target) * 100));
              return (
                <Card key={inc.title} className="p-4 border-border">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-sm font-semibold">{inc.title}</p>
                      <p className="text-xs text-muted-foreground">{inc.description}</p>
                    </div>
                    <Badge className="bg-green-100 text-green-700 border-0 text-xs shrink-0">{inc.reward}</Badge>
                  </div>
                  <Progress value={pct} className="h-2 mb-1" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{inc.current} / {inc.target}</span>
                    <span>{pct}% complete</span>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        <div>
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Trophy className="w-4 h-4 text-primary" /> Your Badges</h3>
          <div className="grid grid-cols-3 gap-3">
            {badges.map(b => (
              <Card key={b.name} className={`p-3 text-center border ${b.earned ? 'border-primary/30 bg-primary/5' : 'border-border opacity-50'}`}>
                <b.icon className={`w-6 h-6 mx-auto mb-1 ${b.earned ? 'text-primary' : 'text-muted-foreground'}`} />
                <p className="text-[10px] font-medium">{b.name}</p>
                {b.earned && <Badge className="text-[8px] mt-1 bg-primary/10 text-primary border-0">Earned</Badge>}
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
