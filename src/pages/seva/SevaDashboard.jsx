import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, IndianRupee, Star, ChevronRight, Bell, Loader2, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import AppHeader from '@/components/shared/AppHeader';
import StatCard from '@/components/shared/StatCard';
import { SevaAPI } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/ui/use-toast';

export default function SevaDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [provider, setProvider] = useState(null);
  const [jobs, setJobs]         = useState([]);
  const [openCount, setOpenCount] = useState(0);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [savingAvail, setSavingAvail] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    const [{ data: prov, error: provErr }, { data: jobList }, { data: open }] = await Promise.all([
      SevaAPI.getMyProvider(user.id),
      SevaAPI.getJobs(user.id),
      SevaAPI.getOpenJobs(),
    ]);
    if (provErr) setError('Could not load your provider profile.');
    setProvider(prov);
    setJobs(jobList ?? []);
    setOpenCount((open ?? []).length);
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
      toast({ title: next ? 'You are now available' : 'You are now offline' });
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  // Provider has no seva_providers row yet — guide them to onboarding.
  if (!provider) {
    return (
      <div className="pb-20">
        <AppHeader title="Seva Provider" />
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
          <Briefcase className="w-10 h-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {error || 'Your service provider profile isn’t set up yet.'}
          </p>
          <Link to="/onboarding/seva"><Button size="sm">Complete Verification</Button></Link>
        </div>
      </div>
    );
  }

  const activeJobs = jobs.filter(j => ['accepted', 'in_progress'].includes(j.status));
  const avgPerJob = provider.jobs_completed > 0
    ? Math.round(Number(provider.monthly_earnings) / provider.jobs_completed) : 0;

  return (
    <div className="pb-20">
      <AppHeader
        title={provider.name}
        subtitle={provider.category}
        rightAction={
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{provider.is_available ? 'Available' : 'Offline'}</span>
            <Switch checked={!!provider.is_available} disabled={savingAvail} onCheckedChange={toggleAvailable} />
          </div>
        }
      />

      <div className="px-4 py-4 space-y-4">
        {!provider.is_verified && (
          <Card className="p-3 border-amber-300 bg-amber-50/60 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <p className="text-xs text-amber-800">Your KYC is {provider.kyc_status}. Some jobs may be limited until verified.</p>
          </Card>
        )}

        <div className="grid grid-cols-2 gap-2">
          <StatCard title="This Month" value={`₹${Number(provider.monthly_earnings).toLocaleString()}`} icon={IndianRupee} />
          <StatCard title="Jobs Done"  value={String(provider.jobs_completed)} icon={Briefcase} subtitle="lifetime" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <StatCard title="Rating"      value={`${Number(provider.rating).toFixed(1)} ★`} icon={Star} subtitle={`${provider.review_count} reviews`} />
          <StatCard title="Avg / Job"   value={`₹${avgPerJob.toLocaleString()}`} icon={IndianRupee} />
        </div>

        {openCount > 0 && (
          <Link to="/seva/jobs">
            <Card className="p-3 border-amber-300 bg-amber-50/60 flex items-center gap-3">
              <Bell className="w-5 h-5 text-amber-600 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-800">{openCount} open job{openCount > 1 ? 's' : ''} near you</p>
                <p className="text-xs text-amber-700">Tap to review and accept</p>
              </div>
              <ChevronRight className="w-4 h-4 text-amber-600 shrink-0" />
            </Card>
          </Link>
        )}

        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-sm">My Active Jobs</h3>
            <Link to="/seva/schedule" className="text-xs text-primary font-medium">View schedule</Link>
          </div>
          {activeJobs.length === 0 ? (
            <Card className="p-6 border-border text-center">
              <Briefcase className="w-7 h-7 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No active jobs</p>
              <Link to="/seva/jobs"><Button size="sm" className="mt-2">Browse Jobs</Button></Link>
            </Card>
          ) : (
            <div className="space-y-2">
              {activeJobs.map(job => (
                <Link key={job.id} to={`/seva/jobs/${job.id}`}>
                  <Card className="p-3 border-border">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{job.title}</p>
                        <p className="text-xs text-muted-foreground">{job.customer_name ?? 'Customer'} · {job.category}</p>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <p className="text-sm font-bold">₹{job.amount}</p>
                        <Badge className="text-[9px] border-0 bg-amber-100 text-amber-700">{job.status}</Badge>
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Link to="/seva/jobs">
            <Card className="p-3 border-border flex items-center gap-2 hover:bg-muted/40 transition-colors">
              <Briefcase className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Find Jobs</span>
            </Card>
          </Link>
          <Link to="/seva/earnings">
            <Card className="p-3 border-border flex items-center gap-2 hover:bg-muted/40 transition-colors">
              <IndianRupee className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Earnings</span>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}
