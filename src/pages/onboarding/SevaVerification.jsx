import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, ChevronRight, Wrench, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { SevaAPI } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/ui/use-toast';

const CATEGORIES = [
  'Electrician', 'Plumber', 'Tailoring', 'Beauty & Salon', 'Tutoring',
  'Carpentry', 'Painting', 'Farming Help', 'AC Repair', 'Mobile Repair', 'Mason', 'Agriculture',
];

const STEPS = [
  { id: 1, label: 'Identity & Skill' },
  { id: 2, label: 'Pricing' },
  { id: 3, label: 'Review' },
];

export default function SevaVerification() {
  const navigate  = useNavigate();
  const { user, profile, reloadProfile } = useAuth();
  const { toast }  = useToast();

  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name:       profile?.name && profile.name !== 'SETU User' ? profile.name : '',
    category:   '',
    experience: '',
    hourly_rate: '',
    image_url:  '',
  });
  const [saving, setSaving]       = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError]         = useState('');

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setError(''); };
  const next = () => setStep(s => Math.min(s + 1, STEPS.length));
  const back = () => setStep(s => Math.max(s - 1, 1));

  const step1Valid = form.name.trim().length >= 2 && form.category;

  const handleSubmit = async () => {
    if (!user?.id) { setError('You must be logged in.'); return; }
    if (!step1Valid) { setStep(1); setError('Please enter your name and skill category.'); return; }
    if (!profile?.village_id) { setError('Please set your village in your profile first.'); return; }

    setSaving(true);
    setError('');
    const { error: e } = await SevaAPI.saveProvider(user.id, {
      name:        form.name.trim(),
      category:    form.category,
      village_id:  profile.village_id,
      experience:  form.experience.trim() || null,
      hourly_rate: Number(form.hourly_rate) || 0,
      image_url:   form.image_url.trim() || null,
    });
    setSaving(false);

    if (e) {
      setError(e.message || 'Could not submit your application. Please try again.');
      toast({ title: 'Submission failed', description: e.message, variant: 'destructive' });
      return;
    }
    await reloadProfile();
    setSubmitted(true);
    toast({ title: 'Application submitted', description: 'Your provider profile is under review.' });
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center bg-background">
        <div className="w-16 h-16 bg-accent/20 rounded-full flex items-center justify-center">
          <CheckCircle className="w-8 h-8 text-accent" />
        </div>
        <h2 className="text-xl font-bold">Application Submitted!</h2>
        <p className="text-sm text-muted-foreground max-w-xs">
          Your service provider profile is under review. Once an admin verifies your KYC, you'll be able to
          accept jobs. This usually takes up to 24 hours.
        </p>
        <Button onClick={() => navigate('/', { replace: true })}>Done</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background max-w-md mx-auto">
      <div className="sticky top-0 bg-card z-10 border-b border-border">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-chart-4/20 rounded-lg flex items-center justify-center">
              <Wrench className="w-4 h-4 text-chart-4" />
            </div>
            <div>
              <h1 className="font-bold text-sm">Seva Provider Verification</h1>
              <p className="text-[10px] text-muted-foreground">Step {step} of {STEPS.length}</p>
            </div>
          </div>
          <Progress value={(step / STEPS.length) * 100} className="w-16 h-1.5" />
        </div>
      </div>

      <div className="px-4 py-5">
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold mb-1">Identity & Skills</h2>
              <p className="text-sm text-muted-foreground">Tell us about yourself and your primary skill.</p>
            </div>
            <Card className="p-4 border-border space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Full name *</label>
                <Input placeholder="e.g. Rajesh Kumar" value={form.name} onChange={e => set('name', e.target.value)} maxLength={60} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Primary skill *</label>
                <Select value={form.category} onValueChange={v => set('category', v)}>
                  <SelectTrigger><SelectValue placeholder="Select your skill category" /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Experience</label>
                <Textarea placeholder="e.g. 5 years of home wiring and inverter repair" rows={3}
                  value={form.experience} onChange={e => set('experience', e.target.value)} />
              </div>
            </Card>
            {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
            <Button className="w-full" onClick={next} disabled={!step1Valid}>
              Next: Pricing <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold mb-1">Your Pricing</h2>
            <p className="text-sm text-muted-foreground">Set your base hourly rate. You can change this later in Settings.</p>
            <Card className="p-4 border-border space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Hourly rate (₹)</label>
                <Input type="number" inputMode="numeric" placeholder="e.g. 300"
                  value={form.hourly_rate} onChange={e => set('hourly_rate', e.target.value)} />
              </div>
              <p className="text-[10px] text-muted-foreground">
                SETU fee: 10% per job. Earnings are settled after the customer confirms completion.
              </p>
            </Card>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={back}>Back</Button>
              <Button className="flex-1" onClick={next}>Review <ChevronRight className="w-4 h-4 ml-1" /></Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold mb-1">Review & Submit</h2>
            <p className="text-sm text-muted-foreground">Confirm your details. An admin will verify your KYC before you go live.</p>
            <Card className="p-4 border-border space-y-2 text-sm">
              <Row label="Name" value={form.name} />
              <Row label="Skill" value={form.category} />
              <Row label="Experience" value={form.experience || '—'} />
              <Row label="Hourly rate" value={form.hourly_rate ? `₹${form.hourly_rate}` : '—'} />
              <Row label="Village" value={profile?.village_id || '— (set in profile)'} />
            </Card>
            <Card className="p-3 bg-muted/50 border-border">
              <p className="text-xs text-muted-foreground">
                <strong>Seva Constitution:</strong> Arrive on time, complete quality work, and accept payment only via the SETU app.
              </p>
            </Card>
            {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={back} disabled={saving}>Back</Button>
              <Button className="flex-1 gap-2" onClick={handleSubmit} disabled={saving}>
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</> : 'Submit Application'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right max-w-[60%] truncate">{value}</span>
    </div>
  );
}
