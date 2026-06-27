import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, MapPin, IndianRupee, Search, Loader2, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import AppHeader from '@/components/shared/AppHeader';
import EmptyState from '@/components/shared/EmptyState';
import { SevaAPI } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';

const urgencyStyle = {
  today:    'bg-red-100 text-red-700',
  tomorrow: 'bg-amber-100 text-amber-700',
  weekend:  'bg-blue-100 text-blue-700',
  flexible: 'bg-green-100 text-green-700',
};

export default function SevaJobs() {
  const { toast } = useToast();
  const [jobs, setJobs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [query, setQuery]     = useState('');
  const [accepting, setAccepting] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: e } = await SevaAPI.getOpenJobs();
    if (e) setError('Could not load jobs.');
    setJobs(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = jobs.filter(j =>
    !query ||
    j.title.toLowerCase().includes(query.toLowerCase()) ||
    (j.category || '').toLowerCase().includes(query.toLowerCase())
  );

  const handleAccept = async (jobId) => {
    setAccepting(jobId);
    const { data, error: e } = await SevaAPI.acceptJob(jobId);
    setAccepting(null);
    if (e || !data?.success) {
      toast({ title: 'Could not accept job', description: e?.message || 'It may have been taken.', variant: 'destructive' });
      load(); // refresh — job may no longer be open
      return;
    }
    toast({ title: 'Job accepted', description: 'Find it under My Active Jobs.' });
    setJobs(list => list.filter(j => j.id !== jobId)); // remove from open list
  };

  return (
    <div className="pb-20">
      <AppHeader title="Available Jobs" subtitle={loading ? 'Loading…' : `${jobs.length} open near you`} />
      <div className="px-4 py-3 space-y-3">

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search jobs..." className="pl-9 h-8 text-sm" value={query} onChange={e => setQuery(e.target.value)} />
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <AlertCircle className="w-8 h-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button size="sm" variant="outline" onClick={load}>Try again</Button>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Briefcase} title="No open jobs" description={query ? 'Try different search terms' : 'New jobs in your area will appear here'} />
        ) : (
          <div className="space-y-3">
            {filtered.map(job => (
              <Card key={job.id} className="border border-border">
                <Link to={`/seva/jobs/${job.id}`}>
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold">{job.title}</p>
                        <p className="text-xs text-muted-foreground">{job.category}{job.customer_name ? ` · ${job.customer_name}` : ''}</p>
                      </div>
                      <Badge className={`text-[9px] border-0 shrink-0 ml-2 ${urgencyStyle[job.urgency] || urgencyStyle.flexible}`}>
                        {job.urgency}
                      </Badge>
                    </div>
                    {job.description && <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{job.description}</p>}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      {job.address && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{job.address}</span>}
                      <span className="flex items-center gap-1 font-bold text-foreground"><IndianRupee className="w-3 h-3" />₹{job.amount}</span>
                    </div>
                  </div>
                </Link>
                <div className="px-4 pb-3 flex gap-2">
                  <Button size="sm" className="flex-1 h-8 text-xs"
                    disabled={accepting === job.id}
                    onClick={() => handleAccept(job.id)}>
                    {accepting === job.id ? 'Accepting...' : 'Accept Job'}
                  </Button>
                  <Link to={`/seva/jobs/${job.id}`} className="flex-1">
                    <Button size="sm" variant="outline" className="w-full h-8 text-xs">View Details</Button>
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
