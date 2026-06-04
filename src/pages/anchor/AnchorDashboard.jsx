import React from 'react';
import { Link } from 'react-router-dom';
import { Users, MessageSquare, Newspaper, BarChart3, ChevronRight, UserCheck, AlertTriangle, TrendingUp } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import AppHeader from '@/components/shared/AppHeader';
import StatCard from '@/components/shared/StatCard';
import { useStore } from '@/lib/store';
import { VILLAGES, VENDORS, RIDERS } from '@/lib/mockData';

const ANCHOR = { name: 'Ramkali Devi', village: 'Madhepur', since: 'Jan 2024', score: 91 };

export default function AnchorDashboard() {
  const { state } = useStore();

  const village       = VILLAGES[0];
  const activeVendors = VENDORS.filter(v => v.isOpen).length;
  const activeOrders  = state.orders.filter(o => !['delivered', 'cancelled'].includes(o.status)).length;
  const pendingKYC    = 4;
  const openDisputes  = 2;

  const quickLinks = [
    { label: 'KYC Management',  path: '/anchor/kyc',         icon: UserCheck,    badge: pendingKYC,   color: 'text-blue-600'   },
    { label: 'Disputes',        path: '/anchor/disputes',    icon: MessageSquare, badge: openDisputes, color: 'text-amber-600' },
    { label: 'Noticeboard',     path: '/anchor/noticeboard', icon: Newspaper,     badge: null,         color: 'text-purple-600' },
    { label: 'Village Reports', path: '/anchor/reports',     icon: BarChart3,     badge: null,         color: 'text-green-600'  },
    { label: 'Escalations',     path: '/anchor/escalations', icon: AlertTriangle, badge: 1,            color: 'text-red-600'    },
    { label: 'Village Map',     path: '/anchor/village',     icon: Users,         badge: null,         color: 'text-primary'    },
  ];

  return (
    <div className="pb-20">
      <AppHeader
        title={`Namaskar, ${ANCHOR.name.split(' ')[0]}`}
        subtitle={`${village.name} Village Anchor`}
      />
      <div className="px-4 py-4 space-y-4">

        {/* Score card */}
        <Card className="p-4 border-border bg-gradient-to-br from-primary/5 to-background">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Anchor Performance Score</p>
              <p className="text-3xl font-bold text-primary">{ANCHOR.score}</p>
              <p className="text-xs text-muted-foreground">Active since {ANCHOR.since}</p>
            </div>
            <div className="text-right">
              <Badge className="bg-green-100 text-green-700 border-0">Top 10%</Badge>
              <p className="text-xs text-muted-foreground mt-1">{village.name} Block</p>
            </div>
          </div>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2">
          <StatCard title="Active Orders"   value={String(activeOrders)}  icon={TrendingUp}   subtitle="in Madhepur" />
          <StatCard title="Active Vendors"  value={String(activeVendors)} icon={Users}         subtitle={`of ${VENDORS.length} total`} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <StatCard title="Pending KYC"    value={String(pendingKYC)}    icon={UserCheck}     />
          <StatCard title="Open Disputes"  value={String(openDisputes)}  icon={MessageSquare} />
        </div>

        {/* Alerts */}
        {(pendingKYC > 0 || openDisputes > 0) && (
          <Card className="p-3 border-amber-200 bg-amber-50/40">
            <p className="text-xs font-semibold text-amber-800 mb-2">⚡ Needs Your Attention</p>
            {pendingKYC > 0 && (
              <Link to="/anchor/kyc">
                <div className="flex items-center justify-between py-1.5">
                  <p className="text-xs text-amber-700">{pendingKYC} KYC applications pending review</p>
                  <ChevronRight className="w-3.5 h-3.5 text-amber-600" />
                </div>
              </Link>
            )}
            {openDisputes > 0 && (
              <Link to="/anchor/disputes">
                <div className="flex items-center justify-between py-1.5 border-t border-amber-200">
                  <p className="text-xs text-amber-700">{openDisputes} disputes need resolution</p>
                  <ChevronRight className="w-3.5 h-3.5 text-amber-600" />
                </div>
              </Link>
            )}
          </Card>
        )}

        {/* Quick links */}
        <div className="grid grid-cols-2 gap-2">
          {quickLinks.map(item => (
            <Link key={item.path} to={item.path}>
              <Card className="p-3 border-border flex items-center gap-2 hover:bg-muted/40 transition-colors">
                <item.icon className={`w-4 h-4 shrink-0 ${item.color}`} />
                <span className="text-sm font-medium flex-1 leading-tight">{item.label}</span>
                {item.badge > 0 && (
                  <Badge className="text-[9px] bg-primary text-white border-0 h-4 min-w-4 px-1 shrink-0">
                    {item.badge}
                  </Badge>
                )}
              </Card>
            </Link>
          ))}
        </div>

        {/* Village vitals */}
        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3">{village.name} Vitals</h3>
          <div className="space-y-2">
            {[
              { label: 'Population',      value: `${(village.population / 1000).toFixed(0)}k` },
              { label: 'Active Riders',   value: String(RIDERS.filter(r => r.isOnline).length) },
              { label: 'Platform Orders', value: String(state.orders.length) + ' total' },
              { label: 'Block',           value: village.block },
            ].map(row => (
              <div key={row.label} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{row.label}</span>
                <span className="font-medium">{row.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
