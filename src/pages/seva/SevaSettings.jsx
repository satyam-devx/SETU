import React, { useState, useEffect, useCallback } from 'react';
import { Globe, LogOut, Wrench, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import AppHeader from '@/components/shared/AppHeader';
import { useAuth } from '@/lib/AuthContext';
import { SevaAPI } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';

const NOTIF_PREF_KEY = 'setu_seva_job_notifs';

export default function SevaSettings() {
  const { user, signOut, userName, userPhone } = useAuth();
  const { toast } = useToast();

  const [provider, setProvider]     = useState(null);
  const [loading, setLoading]       = useState(true);
  const [savingAvail, setSavingAvail] = useState(false);
  const [notifs, setNotifs]         = useState(() => localStorage.getItem(NOTIF_PREF_KEY) !== 'false');
  const [signingOut, setSigningOut] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data } = await SevaAPI.getMyProvider(user.id);
    setProvider(data);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const toggleAvailable = async (next) => {
    if (!provider) return;
    setSavingAvail(true);
    const prev = provider.is_available;
    setProvider(p => ({ ...p, is_available: next }));
    const { error: e } = await SevaAPI.setAvailable(provider.id, next);
    setSavingAvail(false);
    if (e) {
      setProvider(p => ({ ...p, is_available: prev }));
      toast({ title: 'Could not update availability', description: e.message, variant: 'destructive' });
    } else {
      toast({ title: next ? 'You are now accepting jobs' : 'You are now offline' });
    }
  };

  const toggleNotifs = (next) => {
    setNotifs(next);
    localStorage.setItem(NOTIF_PREF_KEY, String(next));
  };

  const handleSignOut = async () => { setSigningOut(true); await signOut(); };

  return (
    <div className="pb-6">
      <AppHeader title="Settings" showBack />
      <div className="px-4 py-4 space-y-4">

        <Card className="p-4 border-border">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-chart-4/10 flex items-center justify-center">
              <Wrench className="w-5 h-5 text-chart-4" />
            </div>
            <div>
              <p className="text-sm font-semibold">{provider?.name || userName || 'Seva Provider'}</p>
              <p className="text-xs text-muted-foreground">{userPhone || '—'}</p>
              {provider && (
                <Badge className={`mt-0.5 text-[9px] border-0 ${provider.is_verified ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                  {provider.is_verified ? 'Verified Provider' : `KYC ${provider.kyc_status}`}
                </Badge>
              )}
            </div>
          </div>
        </Card>

        <Card className="border-border divide-y divide-border">
          <div className="px-4 py-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Availability</p>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-medium">Accepting Jobs</p>
              <p className="text-xs text-muted-foreground">
                {!provider ? 'Complete verification first'
                  : provider.is_available ? 'You appear in job matching' : 'You will not receive new jobs'}
              </p>
            </div>
            {loading
              ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              : <Switch checked={!!provider?.is_available} disabled={!provider || savingAvail} onCheckedChange={toggleAvailable} />}
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-medium">Job Notifications</p>
              <p className="text-xs text-muted-foreground">Alerts for new job requests on this device</p>
            </div>
            <Switch checked={notifs} onCheckedChange={toggleNotifs} />
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <Globe className="w-4 h-4 text-muted-foreground" />
              <p className="text-sm font-medium">Language</p>
            </div>
            <span className="text-sm text-muted-foreground">Hindi</span>
          </div>
        </Card>

        <Button
          variant="outline"
          className="w-full gap-2 text-destructive border-destructive/30 hover:bg-destructive/5"
          onClick={handleSignOut}
          disabled={signingOut}
        >
          <LogOut className="w-4 h-4" />
          {signingOut ? 'Signing out...' : 'Sign Out'}
        </Button>

        <p className="text-center text-xs text-muted-foreground">SETU v1.0.0 · Made with ❤ for Bharat</p>
      </div>
    </div>
  );
}
