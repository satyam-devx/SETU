import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapPin, Phone, Clock, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import AppHeader from '@/components/shared/AppHeader';
import { SevaAPI } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';

export default function SevaJobDetail() {
  const { jobId } = useParams();
  const navigate  = useNavigate();
  const { toast } = useToast();

  const [job, setJob]         = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [notes, setNotes]     = useState('');
  const [busy, setBusy]       = useState(false);
  const [completed, setCompleted] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: e } = await SevaAPI.getJobById(jobId);
    if (e || !data) setError('Could not load this job.');
    setJob(data);
    setLoading(false);
  }, [jobId]);

  useEffect(() => { load(); }, [load]);

  const handleStart = async () => {
    setBusy(true);
    const { data, error: e } = await SevaAPI.startJob(jobId);
    setBusy(false);
    if (e) { toast({ title: 'Could not start job', description: e.message, variant: 'destructive' }); return; }
    setJob(data);
  };

  const handleComplete = async () => {
    setBusy(true);
    const { data, error: e } = await SevaAPI.completeJob(jobId, { notes });
    setBusy(false);
    if (e || !data?.success) {
      toast({ title: 'Could not complete job', description: e?.message || 'Try again.', variant: 'destructive' });
      return;
    }
    setCompleted(true);
  };

  if (loading) {
    return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;
  }
  if (error || !job) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 px-6 text-center">
        <AlertCircle className="w-8 h-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{error || 'Job not found.'}</p>
        <Button size="sm" variant="outline" onClick={() => navigate('/seva/jobs')}>Back to jobs</Button>
      </div>
    );
  }

  if (completed || job.status === 'completed') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-xl font-bold">Job Completed!</h2>
        <p className="text-sm text-muted-foreground">₹{job.amount} has been credited to your earnings.</p>
        <Button onClick={() => navigate('/seva/earnings')}>View Earnings</Button>
      </div>
    );
  }

  const stageSteps = [
    { key: 'accepted',    label: 'Accepted' },
    { key: 'in_progress', label: 'In Progress' },
    { key: 'completed',   label: 'Completed' },
  ];
  const stageIndex = Math.max(0, stageSteps.findIndex(s => s.key === job.status));

  return (
    <div className="pb-24">
      <AppHeader title={job.title} subtitle={job.category} showBack />
      <div className="px-4 py-4 space-y-4">

        <Card className="p-4 border-border">
          <div className="flex items-center justify-between mb-1">
            {stageSteps.map((s, i) => (
              <React.Fragment key={s.key}>
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i <= stageIndex ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>
                    {i < stageIndex ? '✓' : i + 1}
                  </div>
                  <span className="text-[9px] text-center text-muted-foreground max-w-[60px] leading-tight">{s.label}</span>
                </div>
                {i < stageSteps.length - 1 && (
                  <div className={`flex-1 h-0.5 mb-4 ${i < stageIndex ? 'bg-primary' : 'bg-muted'}`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </Card>

        <Card className="p-4 border-border space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">{job.title}</h3>
            <Badge className="text-xs chip-primary border-0">₹{job.amount}</Badge>
          </div>
          {job.description && <p className="text-sm text-muted-foreground">{job.description}</p>}
          <div className="space-y-1.5 text-xs text-muted-foreground">
            {job.address && <div className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 shrink-0" />{job.address}</div>}
            <div className="flex items-center gap-2"><Clock className="w-3.5 h-3.5 shrink-0" />Urgency: {job.urgency}</div>
          </div>
        </Card>

        {(job.customer_name || job.phone) && (
          <Card className="p-4 border-border flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
              {(job.customer_name || '?')[0]}
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">{job.customer_name || 'Customer'}</p>
              {job.phone && <p className="text-xs text-muted-foreground">{job.phone}</p>}
            </div>
            {job.phone && (
              <a href={`tel:${job.phone}`}>
                <Button size="icon" variant="outline" className="h-9 w-9"><Phone className="w-4 h-4" /></Button>
              </a>
            )}
          </Card>
        )}

        {job.status === 'in_progress' && (
          <Card className="p-4 border-border">
            <h3 className="font-semibold text-sm mb-2">Work Notes</h3>
            <Textarea placeholder="Describe the work done, materials used..." className="h-20 text-sm" value={notes} onChange={e => setNotes(e.target.value)} />
          </Card>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border px-4 py-3">
        {job.status === 'accepted' && (
          <Button className="w-full" onClick={handleStart} disabled={busy}>
            {busy ? 'Starting…' : 'Start Work'}
          </Button>
        )}
        {job.status === 'in_progress' && (
          <Button className="w-full bg-accent hover:bg-accent/90" onClick={handleComplete} disabled={busy}>
            <CheckCircle className="w-4 h-4 mr-2" />
            {busy ? 'Completing...' : 'Mark as Complete'}
          </Button>
        )}
        {job.status === 'open' && (
          <p className="text-center text-xs text-muted-foreground">Accept this job from the jobs list to begin.</p>
        )}
      </div>
    </div>
  );
}
