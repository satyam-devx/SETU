import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, MessageSquare, Newspaper, BarChart3, ChevronRight, UserCheck, AlertTriangle, TrendingUp } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import AppHeader from '@/components/shared/AppHeader';
import StatCard from '@/components/shared/StatCard';
import { useVillage } from '@/lib/village';
import { useStore } from '@/lib/store';
import { AnchorAPI } from '@/lib/api';
import { supabase } from '@/lib/supabase';

export default function AnchorDashboard() {
  const { village, villageId } = useVillage();
  const { state } = useStore();

  const [anchorProfile, setAnchorProfile] = useState(null);
  const [stats, setStats]                 = useState(null);
  const [loadingStats, setLoadingStats]   = useState(true);

  // Load anchor profile (name, setu_score)
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from('profiles')
        .select('name, setu_score, created_at')
        .eq('id', user.id)
        .single()
        .then(({ data }) => { if (data) setAnchorProfile(data); });
    });
  }, []);

  // Load village stats
  useEffect(() => {
    if (!villageId) return;
    setLoadingStats(true);
    AnchorAPI.getVillageStats(villageId).then(({ data }) => {
      if (data) setStats(data);
      setLoadingStats(false);
    });
  }, [villageId]);

  const anchorName  = anchorProfile?.name ?? 'Anchor';
  const anchorScore = anchorProfile?.setu_score ?? '—';
  const anchorSince = anchorProfile?.created_at
    ? new Date(anchorProfile.created_at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
    : '—';

  const activeOrders  = stats?.activeOrders  ?? state.orders.filter(o => !['delivered','cancelled'].includes(o.status)).length;
  const activeVendors = stats?.activeVendors ?? 0;
  const pendingKYC    = stats?.pendingKYC    ?? 0;

  // Open disputes are fetched by AnchorDisputes, we keep a light signal here
  const [openDisputes, setOpenDisputes] = useState(0);
  const [openEscalations, setOpenEscalations] = useState(0);

  useEffect(() => {
    if (!villageId) return;
    AnchorAPI.getDisputes(villageId).then(({ data }) => {
      setOpenDisputes((data ?? []).filter(d => d.status === 'open').length);
    });
    AnchorAPI.getEscalations(villageId).then(({ data }) => {
      setOpenEscalations((data ?? []).filter(e => e.status === 'open').length);
    });
  }, [villageId]);

  const quickLinks = [
    { label: 'KYC Management',  path: '/anchor/kyc',         icon: UserCheck,     badge: pendingKYC,    color: 'text-blue-600'   },
    { label: 'Disputes',        path: '/anchor/disputes',    icon: MessageSquare, badge: openDisputes,  color: 'text-amber-600'  },
    { label: 'Noticeboard',     path: '/anchor/noticeboard', icon: Newspaper,     badge: null,          color: 'text-purple-600' },
    { label: 'Village Reports', path: '/anchor/reports',     icon: BarChart3,     badge: null,          color: 'text-green-600'  },
    { label: 'Escalations',     path: '/anchor/escalations', icon: AlertTriangle, badge: openEscalations, color: 'text-red-600'   },
    { label: 'Village Map',     path: '/anchor/village',     icon: Users,         badge: null,          color: 'text-primary'    },
  ];

  return (
    <div className="pb-20">
      <AppHeader
        title={`Namaskar, ${anchorName.split(' ')[0]}`}
        subtitle={`${village?.name ?? ''} Village Anchor`}
      />
      <div className="px-4 py-4 space-y-4">

        {/* Score card */}
        <Card className="p-4 border-border bg-gradient-to-br from-primary/5 to-background">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Anchor Performance Score</p>
              <p className="text-3xl font-bold text-primary">{anchorScore}</p>
              <p className="text-xs text-muted-foreground">Active since {anchorSince}</p>
            </div>
            <div className="text-right">
              <Badge className="bg-green-100 text-green-700 border-0">Top 10%</Badge>
              <p className="text-xs text-muted-foreground mt-1">{village?.block ?? ''} Block</p>
            </div>
          </div>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2">
          <StatCard title="Active Orders"  value={loadingStats ? '…' : String(activeOrders)}  icon={TrendingUp} subtitle={`in ${village?.name ?? ''}`} />
          <StatCard title="Active Vendors" value={loadingStats ? '…' : String(activeVendors)} icon={Users}      subtitle={`of ${stats?.totalVendors ?? '?'} total`} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <StatCard title="Pending KYC"   value={loadingStats ? '…' : String(pendingKYC)}   icon={UserCheck}     />
          <StatCard title="Open Disputes" value={String(openDisputes)}                       icon={MessageSquare} />
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
          <h3 className="font-semibold text-sm mb-3">{village?.name ?? 'Village'} Vitals</h3>
          <div className="space-y-2">
            {[
              { label: 'Population',      value: village?.population > 0 ? `${(village.population / 1000).toFixed(0)}k` : '—' },
              { label: 'Active Riders',   value: loadingStats ? '…' : `${stats?.onlineRiders ?? 0} / ${stats?.totalRiders ?? 0}` },
              { label: 'Platform Orders', value: loadingStats ? '…' : `${stats?.totalOrders ?? 0} total` },
              { label: 'Block',           value: village?.block ?? '—' },
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
