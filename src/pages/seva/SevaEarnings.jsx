import React, { useState, useEffect, useCallback } from 'react';
import { IndianRupee, TrendingUp, Briefcase, Loader2, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import AppHeader from '@/components/shared/AppHeader';
import StatCard from '@/components/shared/StatCard';
import EmptyState from '@/components/shared/EmptyState';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { SevaAPI } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Build a real Mon→Sun earnings series from this week's completed jobs.
function buildWeek(completed) {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); // Monday
  const order = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const totals = Object.fromEntries(order.map(d => [d, 0]));
  for (const j of completed) {
    if (!j.completed_at) continue;
    const d = new Date(j.completed_at);
    if (d >= start) totals[DAYS[d.getDay()]] += Number(j.amount) || 0;
  }
  return order.map(day => ({ day, earned: totals[day] }));
}

export default function SevaEarnings() {
  const { user } = useAuth();
  const [provider, setProvider]   = useState(null);
  const [completed, setCompleted] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    const { data, error: e } = await SevaAPI.getEarnings(user.id);
    if (e) setError('Could not load earnings.');
    setProvider(data?.provider ?? null);
    setCompleted(data?.completed ?? []);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;
  }
  if (error || !provider) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 px-6 text-center">
        <AlertCircle className="w-8 h-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{error || 'No provider profile found.'}</p>
        <Button size="sm" variant="outline" onClick={load}>Try again</Button>
      </div>
    );
  }

  const weekData  = buildWeek(completed);
  const weekTotal = weekData.reduce((s, d) => s + d.earned, 0);
  const monthly   = Number(provider.monthly_earnings) || 0;
  const jobsDone  = provider.jobs_completed || 0;
  const avgPerJob = jobsDone > 0 ? Math.round(monthly / jobsDone) : 0;

  return (
    <div className="pb-6">
      <AppHeader title="Earnings" />
      <div className="px-4 py-4 space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <StatCard title="This Month" value={`₹${monthly.toLocaleString()}`} icon={IndianRupee} />
          <StatCard title="This Week"  value={`₹${weekTotal.toLocaleString()}`} icon={TrendingUp} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <StatCard title="Jobs Completed" value={String(jobsDone)} icon={Briefcase} />
          <StatCard title="Avg per Job"    value={`₹${avgPerJob.toLocaleString()}`} icon={IndianRupee} />
        </div>

        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3">This Week's Earnings</h3>
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekData} barSize={20}>
                <XAxis dataKey="day" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip formatter={v => [`₹${v}`, 'Earned']} />
                <Bar dataKey="earned" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <div>
          <h3 className="font-semibold text-sm mb-2">Completed Jobs</h3>
          {completed.length === 0 ? (
            <EmptyState icon={Briefcase} title="No completed jobs yet" description="Earnings from completed jobs will appear here" />
          ) : (
            <div className="space-y-2">
              {completed.slice(0, 20).map(job => (
                <Card key={job.id} className="p-3 border-border flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{job.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {job.category}{job.completed_at ? ` · ${new Date(job.completed_at).toLocaleDateString()}` : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <p className="text-sm font-bold">₹{Number(job.amount).toLocaleString()}</p>
                    <Badge className="text-[9px] bg-green-100 text-green-700 border-0">paid</Badge>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground text-center px-4">
          Earnings are settled to your registered bank account on the platform payout cycle.
        </p>
      </div>
    </div>
  );
}
