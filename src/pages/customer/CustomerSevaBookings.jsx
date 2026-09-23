import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle, Star, Phone, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import AppHeader from '@/components/shared/AppHeader';
import EmptyState from '@/components/shared/EmptyState';
import { getMySevaJobs, cancelSevaJob, rateSevaJob } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/ui/use-toast';

const STATUS_STYLE = {
  open:        'bg-blue-100 text-blue-700',
  accepted:    'bg-amber-100 text-amber-700',
  in_progress: 'bg-amber-100 text-amber-700',
  completed:   'bg-green-100 text-green-700',
  cancelled:   'bg-muted text-muted-foreground',
};
const STATUS_LABEL = {
  open: 'Waiting for a provider', accepted: 'Accepted', in_progress: 'In Progress',
  completed: 'Completed', cancelled: 'Cancelled',
};

function RateForm({ job, onDone }) {
  const [stars, setStars]     = useState(0);
  const [comment, setComment] = useState('');
  const [saving, setSaving]   = useState(false);
  const { toast } = useToast();

  const submit = async () => {
    if (!stars) return;
    setSaving(true);
    const { error } = await rateSevaJob(job.id, stars, comment.trim() || null);
    setSaving(false);
    if (error) {
      toast({ title: 'Could not submit rating', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Thanks for rating!' });
    onDone();
  };

  return (
    <div className="mt-2 pt-2 border-t border-border space-y-2">
      <p className="text-xs font-medium text-foreground">Rate this provider</p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} onClick={() => setStars(n)} aria-label={`${n} star`}>
            <Star className={`w-5 h-5 ${n <= stars ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground'}`} />
          </button>
        ))}
      </div>
      <Textarea rows={2} maxLength={300} placeholder="Optional comment"
        value={comment} onChange={e => setComment(e.target.value)} />
      <Button size="sm" disabled={!stars || saving} onClick={submit}>
        {saving ? 'Saving…' : 'Submit Rating'}
      </Button>
    </div>
  );
}

function JobCard({ job, onChanged }) {
  const [cancelling, setCancelling] = useState(false);
  const { toast } = useToast();

  const handleCancel = async () => {
    setCancelling(true);
    const { error } = await cancelSevaJob(job.id);
    setCancelling(false);
    if (error) {
      toast({ title: 'Could not cancel', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Request cancelled' });
    onChanged();
  };

  return (
    <Card className="p-4 border-border">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{job.title}</p>
          <p className="text-xs text-muted-foreground">{job.category} · ₹{Number(job.amount).toLocaleString()}</p>
        </div>
        <Badge className={`text-[10px] shrink-0 border-0 ${STATUS_STYLE[job.status] || ''}`}>
          {STATUS_LABEL[job.status] || job.status}
        </Badge>
      </div>

      {(job.status === 'accepted' || job.status === 'in_progress') && job.seva_providers && (
        <div className="mt-2 pt-2 border-t border-border flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{job.seva_providers.name}</p>
          {job.seva_providers.phone && (
            <a href={`tel:${job.seva_providers.phone}`} className="text-xs font-semibold text-primary flex items-center gap-1">
              <Phone className="w-3 h-3" /> Call
            </a>
          )}
        </div>
      )}

      {job.status === 'open' && (
        <div className="mt-2 pt-2 border-t border-border">
          <Button size="sm" variant="outline" className="text-destructive" disabled={cancelling} onClick={handleCancel}>
            <X className="w-3.5 h-3.5 mr-1" />{cancelling ? 'Cancelling…' : 'Cancel Request'}
          </Button>
        </div>
      )}

      {job.status === 'completed' && (
        job.rating ? (
          <div className="mt-2 pt-2 border-t border-border flex items-center gap-1">
            {[1, 2, 3, 4, 5].map(n => (
              <Star key={n} className={`w-3.5 h-3.5 ${n <= job.rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground'}`} />
            ))}
          </div>
        ) : (
          <RateForm job={job} onDone={onChanged} />
        )
      )}
    </Card>
  );
}

export default function CustomerSevaBookings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [jobs, setJobs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data, error: e } = await getMySevaJobs(user.id);
    if (e) setError('Could not load your requests.'); else setError(null);
    setJobs(data ?? []);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="pb-8">
      <AppHeader title="My Requests" showBack />
      <div className="p-4 space-y-3">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : error ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <AlertCircle className="w-6 h-6 text-destructive" />
            <p className="text-xs text-muted-foreground">{error}</p>
            <button onClick={load} className="text-xs text-primary font-semibold underline">Retry</button>
          </div>
        ) : !jobs.length ? (
          <EmptyState
            emoji="🧰"
            title="No requests yet"
            description="Request a local service and track it here."
            size="sm"
            action={() => navigate('/customer/seva')}
            actionLabel="Browse Services"
          />
        ) : (
          jobs.map(job => <JobCard key={job.id} job={job} onChanged={load} />)
        )}
      </div>
    </div>
  );
}
