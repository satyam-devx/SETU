import React from 'react';
import { Link } from 'react-router-dom';
import { Users, Newspaper, Star, IndianRupee, CheckCircle, AlertTriangle, MessageSquare, TrendingUp, ChevronRight, Award } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import AppHeader from '@/components/shared/AppHeader';

const anchor = {
  name: 'Ramkali Devi',
  village: 'Madhepur',
  block: 'Madhepur',
  tier: 'Gold Anchor',
  rating: 4.9,
  villageScore: 82,
  monthlyCommission: 3240,
  totalEarned: 28600,
  usersOnboarded: 47,
  activeUsers: 38,
  disputesResolved: 12,
  ordersThisMonth: 325,
  pendingVerifications: 3,
};

const recentActivity = [
  { type: 'onboard', text: 'Mohan Lal joined via your referral', time: '2h ago', icon: '👤' },
  { type: 'order', text: 'Village placed 12 orders today', time: '4h ago', icon: '📦' },
  { type: 'dispute', text: 'Priya Singh dispute resolved', time: '1d ago', icon: '✅' },
  { type: 'news', text: 'Your notice on PM Kisan was viewed 34 times', time: '2d ago', icon: '📰' },
];

const tasks = [
  { label: 'Verify Anita Devi\'s KYC documents', priority: 'high', link: '/anchor/village' },
  { label: 'Post weekly village news update', priority: 'medium', link: '/anchor/noticeboard' },
  { label: 'Resolve open dispute #D-004', priority: 'high', link: '/anchor/disputes' },
];

export default function AnchorDashboard() {
  return (
    <div className="pb-24">
      <AppHeader title="Anchor Portal" subtitle={`${anchor.village} · ${anchor.tier}`} notificationCount={3} />

      {/* Anchor profile card */}
      <div className="px-4 py-4">
        <Card className="bg-gradient-to-br from-primary to-primary/80 text-white p-5 rounded-2xl border-0">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs opacity-70 uppercase tracking-wide">Village Anchor</p>
              <h2 className="text-xl font-bold">{anchor.name}</h2>
              <p className="text-sm opacity-80">{anchor.village}, {anchor.block} Block</p>
            </div>
            <div className="flex flex-col items-end">
              <Badge className="bg-white/20 text-white border-0 text-xs mb-1">
                <Award className="w-3 h-3 mr-1" /> {anchor.tier}
              </Badge>
              <span className="text-xs opacity-70">⭐ {anchor.rating} rating</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-2">
            <div className="text-center bg-white/10 rounded-xl p-2">
              <p className="text-lg font-bold">₹{anchor.monthlyCommission.toLocaleString()}</p>
              <p className="text-[10px] opacity-70">This Month</p>
            </div>
            <div className="text-center bg-white/10 rounded-xl p-2">
              <p className="text-lg font-bold">{anchor.usersOnboarded}</p>
              <p className="text-[10px] opacity-70">Users Onboarded</p>
            </div>
            <div className="text-center bg-white/10 rounded-xl p-2">
              <p className="text-lg font-bold">{anchor.villageScore}</p>
              <p className="text-[10px] opacity-70">Village Score</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Village Score */}
      <div className="px-4 mb-4">
        <Card className="p-4 border-border">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-sm">Village SETU Score</h3>
            <span className="text-lg font-bold text-primary">{anchor.villageScore}/100</span>
          </div>
          <Progress value={anchor.villageScore} className="h-3" />
          <div className="grid grid-cols-3 gap-2 mt-3 text-center">
            <div>
              <p className="text-xs font-bold text-accent">92%</p>
              <p className="text-[10px] text-muted-foreground">Delivery Rate</p>
            </div>
            <div>
              <p className="text-xs font-bold text-primary">78%</p>
              <p className="text-[10px] text-muted-foreground">Credit Health</p>
            </div>
            <div>
              <p className="text-xs font-bold text-chart-3">85%</p>
              <p className="text-[10px] text-muted-foreground">Engagement</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Pending tasks */}
      {tasks.length > 0 && (
        <div className="px-4 mb-4">
          <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" /> Action Required
          </h3>
          <div className="space-y-2">
            {tasks.map((task, i) => (
              <Link key={i} to={task.link}>
                <Card className={`p-3 border flex items-center justify-between mb-2 ${task.priority === 'high' ? 'border-destructive/30 bg-destructive/5' : 'border-border'}`}>
                  <p className="text-sm flex-1">{task.label}</p>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`text-[9px] ${task.priority === 'high' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>
                      {task.priority}
                    </Badge>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="px-4 mb-4">
        <h3 className="font-semibold text-sm mb-2">Quick Actions</h3>
        <div className="grid grid-cols-2 gap-2">
          <Link to="/anchor/noticeboard">
            <Card className="p-4 border-border text-center hover:bg-muted/50 cursor-pointer transition-colors">
              <Newspaper className="w-6 h-6 text-primary mx-auto mb-2" />
              <p className="text-xs font-medium">Post Notice</p>
            </Card>
          </Link>
          <Link to="/anchor/village">
            <Card className="p-4 border-border text-center hover:bg-muted/50 cursor-pointer transition-colors">
              <Users className="w-6 h-6 text-accent mx-auto mb-2" />
              <p className="text-xs font-medium">Village Members</p>
            </Card>
          </Link>
          <Link to="/anchor/disputes">
            <Card className="p-4 border-border text-center hover:bg-muted/50 cursor-pointer transition-colors">
              <MessageSquare className="w-6 h-6 text-chart-3 mx-auto mb-2" />
              <p className="text-xs font-medium">Resolve Dispute</p>
            </Card>
          </Link>
          <Link to="/anchor/reports">
            <Card className="p-4 border-border text-center hover:bg-muted/50 cursor-pointer transition-colors">
              <TrendingUp className="w-6 h-6 text-chart-4 mx-auto mb-2" />
              <p className="text-xs font-medium">My Reports</p>
            </Card>
          </Link>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="px-4">
        <h3 className="font-semibold text-sm mb-2">Recent Activity</h3>
        <div className="space-y-2">
          {recentActivity.map((a, i) => (
            <Card key={i} className="p-3 border-border">
              <div className="flex items-center gap-3">
                <span className="text-xl">{a.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{a.text}</p>
                  <p className="text-[10px] text-muted-foreground">{a.time}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
