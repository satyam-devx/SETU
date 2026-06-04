import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapPin, Phone, IndianRupee, Clock, Camera, CheckCircle, Star } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import AppHeader from '@/components/shared/AppHeader';
import { SevaAPI } from '@/lib/api';

const JOBS = {
  j1: { id: 'j1', title: 'Electrical wiring repair', category: 'Electrician', village: 'Madhepur', amount: 450, urgency: 'today', customer: 'Ram Kumar', phone: '+91 94501 11100', address: 'House No. 5, Ward 2, Madhepur', description: 'MCB tripping repeatedly. Need urgent fix for main board in kitchen and one room circuit.', status: 'accepted' },
  j2: { id: 'j2', title: 'Water pump installation', category: 'Plumber', village: 'Laxmipur', amount: 800, urgency: 'tomorrow', customer: 'Sunita Devi', phone: '+91 94501 11101', address: 'Near Laxmi Temple, Laxmipur', description: 'New submersible pump 1HP, needs fitting and pipe connections.', status: 'confirmed' },
};

export default function SevaJobDetail() {
  const { jobId }   = useParams();
  const navigate    = useNavigate();
  const job         = JOBS[jobId] || Object.values(JOBS)[0];

  const [stage, setStage]         = useState(job.status || 'accepted'); // accepted | arrived | in_progress | completed
  const [notes, setNotes]         = useState('');
  const [rating, setRating]       = useState(0);
  const [completing, setCompleting] = useState(false);
  const [completed, setCompleted]   = useState(false);

  const handleArrive = () => setStage('arrived');
  const handleStart  = () => setStage('in_progress');

  const handleComplete = () => {
    setCompleting(true);
    SevaAPI.completeJob(job.id, { notes, stage: 'completed' }).then(() => {
      setCompleting(false);
      setCompleted(true);
    });
  };

  if (completed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-xl font-bold">Job Completed!</h2>
        <p className="text-sm text-muted-foreground">₹{job.amount} will be credited to your account.</p>
        <Button onClick={() => navigate('/seva/earnings')}>View Earnings</Button>
      </div>
    );
  }

  const stageSteps = [
    { key: 'accepted',    label: 'Job Accepted' },
    { key: 'arrived',     label: 'Reached Location' },
    { key: 'in_progress', label: 'Work In Progress' },
    { key: 'completed',   label: 'Completed' },
  ];
  const stageIndex = stageSteps.findIndex(s => s.key === stage);

  return (
    <div className="pb-24">
      <AppHeader title={job.title} subtitle={job.category} showBack />
      <div className="px-4 py-4 space-y-4">

        {/* Progress */}
        <Card className="p-4 border-border">
          <div className="flex items-center justify-between mb-1">
            {stageSteps.map((s, i) => (
              <React.Fragment key={s.key}>
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i <= stageIndex ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>
                    {i < stageIndex ? '✓' : i + 1}
                  </div>
                  <span className="text-[9px] text-center text-muted-foreground max-w-[50px] leading-tight">{s.label}</span>
                </div>
                {i < stageSteps.length - 1 && (
                  <div className={`flex-1 h-0.5 mb-4 ${i < stageIndex ? 'bg-primary' : 'bg-muted'}`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </Card>

        {/* Job info */}
        <Card className="p-4 border-border space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">{job.title}</h3>
            <Badge className="text-xs bg-primary/10 text-primary border-0">₹{job.amount}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{job.description}</p>
          <div className="space-y-1.5 text-xs text-muted-foreground">
            <div className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 shrink-0" />{job.address}</div>
            <div className="flex items-center gap-2"><Clock className="w-3.5 h-3.5 shrink-0" />Urgency: {job.urgency}</div>
          </div>
        </Card>

        {/* Customer contact */}
        <Card className="p-4 border-border flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
            {job.customer[0]}
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">{job.customer}</p>
            <p className="text-xs text-muted-foreground">{job.phone}</p>
          </div>
          <Button size="icon" variant="outline" className="h-9 w-9">
            <Phone className="w-4 h-4" />
          </Button>
        </Card>

        {/* Work notes */}
        {stage === 'in_progress' && (
          <Card className="p-4 border-border">
            <h3 className="font-semibold text-sm mb-2">Work Notes</h3>
            <Textarea placeholder="Describe the work done, materials used..." className="h-20 text-sm mb-2" value={notes} onChange={e => setNotes(e.target.value)} />
            <Button variant="outline" className="w-full gap-2">
              <Camera className="w-4 h-4" /> Add Photo Proof
            </Button>
          </Card>
        )}
      </div>

      {/* Action button */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border px-4 py-3">
        {stage === 'accepted' && (
          <Button className="w-full" onClick={handleArrive}>I've Reached the Location</Button>
        )}
        {stage === 'arrived' && (
          <Button className="w-full" onClick={handleStart}>Start Work</Button>
        )}
        {stage === 'in_progress' && (
          <Button className="w-full bg-accent hover:bg-accent/90" onClick={handleComplete} disabled={completing}>
            <CheckCircle className="w-4 h-4 mr-2" />
            {completing ? 'Completing...' : 'Mark as Complete'}
          </Button>
        )}
      </div>
    </div>
  );
}
