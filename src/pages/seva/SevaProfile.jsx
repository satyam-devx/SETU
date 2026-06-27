import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { IndianRupee, Star, Briefcase, Settings, ChevronRight, LogOut, Award, Calendar, Loader2, Wrench } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import AppHeader from '@/components/shared/AppHeader';
import { SevaAPI } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';

// Only routes that actually exist under /seva.
const menuItems = [
  { label: 'My Jobs',  icon: Briefcase,   path: '/seva/jobs',     desc: 'Open and active jobs' },
  { label: 'Earnings', icon: IndianRupee, path: '/seva/earnings', desc: 'Payments and history' },
  { label: 'Schedule', icon: Calendar,    path: '/seva/schedule', desc: 'Your upcoming jobs' },
  { label: 'Settings', icon: Settings,    path: '/seva/settings', desc: 'Availability and preferences' },
];

export default function SevaProfile() {
  const { user, signOut } = useAuth();
  const [provider, setProvider] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data } = await SevaAPI.getMyProvider(user.id);
    setProvider(data);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const handleSignOut = async () => { setSigningOut(true); await signOut(); };

  if (loading) {
    return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;
  }

  return (
    <div className="pb-20">
      <AppHeader title="Profile" />

      <div className="px-4 py-4">
        <Card className="p-4 border-border">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center text-3xl">
              <Wrench className="w-7 h-7 text-accent" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-bold text-lg truncate">{provider?.name || 'Seva Provider'}</h2>
              <p className="text-sm text-muted-foreground">{provider?.category || '—'}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {provider?.is_verified
                  ? <Badge className="bg-accent/10 text-accent text-[9px] border-0">✓ Verified</Badge>
                  : <Badge className="bg-amber-100 text-amber-700 text-[9px] border-0">KYC {provider?.kyc_status || 'pending'}</Badge>}
                {provider && (
                  <div className="flex items-center gap-0.5">
                    <Star className="w-3 h-3 text-primary fill-primary" />
                    <span className="text-xs font-medium">{Number(provider.rating).toFixed(1)} ({provider.review_count})</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          {provider && (
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <p>💰 ₹{Number(provider.hourly_rate).toLocaleString()}/hr</p>
              <p>🛠️ {provider.experience || 'Experience not set'}</p>
            </div>
          )}
        </Card>
      </div>

      {provider ? (
        <div className="px-4 mb-4 grid grid-cols-3 gap-2">
          <Card className="p-3 text-center border-border">
            <p className="text-xl font-bold text-primary">{provider.jobs_completed}</p>
            <p className="text-[10px] text-muted-foreground">Jobs Done</p>
          </Card>
          <Card className="p-3 text-center border-border">
            <p className="text-xl font-bold text-accent">₹{(Number(provider.monthly_earnings) / 1000).toFixed(1)}k</p>
            <p className="text-[10px] text-muted-foreground">This Month</p>
          </Card>
          <Card className="p-3 text-center border-border">
            <p className="text-xl font-bold text-foreground">{Number(provider.rating).toFixed(1)}</p>
            <p className="text-[10px] text-muted-foreground">Rating</p>
          </Card>
        </div>
      ) : (
        <div className="px-4 mb-4">
          <Card className="p-4 border-amber-300 bg-amber-50/60 flex items-center gap-3">
            <Award className="w-7 h-7 text-amber-600 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-800">Profile not set up</p>
              <p className="text-xs text-amber-700">Complete verification to start accepting jobs.</p>
            </div>
            <Link to="/onboarding/seva"><Button size="sm">Verify</Button></Link>
          </Card>
        </div>
      )}

      <div className="px-4">
        {menuItems.map(item => (
          <Link key={item.label} to={item.path}>
            <div className="flex items-center gap-3 py-3 px-1 hover:bg-muted/50 rounded-lg transition-colors">
              <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
                <item.icon className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-[10px] text-muted-foreground">{item.desc}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
          </Link>
        ))}
        <Separator className="my-3" />
        <button onClick={handleSignOut} disabled={signingOut} className="flex items-center gap-3 py-3 px-1 text-destructive w-full disabled:opacity-60">
          <div className="w-9 h-9 rounded-xl bg-destructive/10 flex items-center justify-center">
            <LogOut className="w-4 h-4" />
          </div>
          <span className="text-sm font-medium">{signingOut ? 'Signing out…' : 'Log Out'}</span>
        </button>
      </div>
    </div>
  );
}
