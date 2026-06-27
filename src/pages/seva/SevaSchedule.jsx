import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Clock, Loader2, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import AppHeader from '@/components/shared/AppHeader';
import { SevaAPI } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const statusStyle = {
  accepted:    'bg-amber-100 text-amber-700',
  in_progress: 'bg-blue-100 text-blue-700',
  completed:   'bg-green-100 text-green-700',
};

function jobDay(job) {
  const d = job.scheduled_at || job.created_at;
  return d ? DAYS[new Date(d).getDay()] : 'Mon';
}
function jobTime(job) {
  const d = job.scheduled_at;
  return d ? new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Flexible';
}

export default function SevaSchedule() {
  const { user } = useAuth();
  const [jobs, setJobs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [selectedDay, setSelectedDay] = useState(DAYS[new Date().getDay()]);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    const { data, error: e } = await SevaAPI.getJobs(user.id);
    if (e) setError('Could not load your schedule.');
    // Only jobs that are still active (accepted / in_progress) belong on the schedule.
    setJobs((data ?? []).filter(j => ['accepted', 'in_progress'].includes(j.status)));
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const byDay = useMemo(() => {
    const map = Object.fromEntries(WEEK.map(d => [d, []]));
    jobs.forEach(j => { const d = jobDay(j); if (map[d]) map[d].push(j); });
    return map;
  }, [jobs]);

  const daySlots = byDay[selectedDay] || [];

  if (loading) {
    return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;
  }

  return (
    <div className="pb-6">
      <AppHeader title="My Schedule" showBack />
      <div className="px-4 py-4 space-y-4">

        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="w-4 h-4" /> {error}
            <Button size="sm" variant="outline" className="ml-auto" onClick={load}>Retry</Button>
          </div>
        )}

        <div className="flex gap-2 overflow-x-auto pb-1">
          {WEEK.map(d => {
            const hasJob = (byDay[d] || []).length > 0;
            const isSelected = selectedDay === d;
            return (
              <button key={d} onClick={() => setSelectedDay(d)}
                className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl border shrink-0 transition-colors ${
                  isSelected ? 'bg-primary text-white border-primary' : 'border-border bg-card text-foreground'}`}>
                <span className="text-xs font-medium">{d}</span>
                {hasJob && <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-primary'}`} />}
              </button>
            );
          })}
        </div>

        <div>
          <h3 className="font-semibold text-sm mb-2">{selectedDay} — Schedule</h3>
          {daySlots.length === 0 ? (
            <Card className="p-6 border-border text-center">
              <Calendar className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No jobs scheduled for {selectedDay}</p>
              <Link to="/seva/jobs"><Button size="sm" variant="outline" className="mt-3">Find Jobs</Button></Link>
            </Card>
          ) : (
            <div className="space-y-2">
              {daySlots.map(job => (
                <Link key={job.id} to={`/seva/jobs/${job.id}`}>
                  <Card className="p-4 border-border">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{job.title}</p>
                        <p className="text-xs text-muted-foreground">{job.customer_name || job.category}</p>
                        <div className="flex items-center gap-1 mt-1">
                          <Clock className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{jobTime(job)}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <p className="text-sm font-bold">₹{job.amount}</p>
                        <Badge className={`text-[9px] border-0 ${statusStyle[job.status] || ''}`}>{job.status}</Badge>
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>

        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3">This Week</h3>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-xl font-bold text-primary">{jobs.length}</p>
              <p className="text-[10px] text-muted-foreground">Active Jobs</p>
            </div>
            <div>
              <p className="text-xl font-bold text-blue-600">{jobs.filter(j => j.status === 'in_progress').length}</p>
              <p className="text-[10px] text-muted-foreground">In Progress</p>
            </div>
            <div>
              <p className="text-xl font-bold text-amber-600">{jobs.filter(j => j.status === 'accepted').length}</p>
              <p className="text-[10px] text-muted-foreground">Upcoming</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
