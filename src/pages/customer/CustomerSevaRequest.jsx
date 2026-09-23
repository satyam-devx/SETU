import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Loader2, CheckCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AppHeader from '@/components/shared/AppHeader';
import { createSevaJob, getSevaProviders } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { useVillage } from '@/lib/village';
import { CATEGORIES } from '@/pages/onboarding/SevaVerification';
import { useToast } from '@/components/ui/use-toast';

const URGENCY_OPTIONS = [
  { value: 'today',    label: 'Today' },
  { value: 'tomorrow', label: 'Tomorrow' },
  { value: 'weekend',  label: 'This weekend' },
  { value: 'flexible', label: "I'm flexible" },
];

const DEFAULT_AMOUNT = 200; // shown/editable before any providers exist to average

export default function CustomerSevaRequest() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, userName, userPhone } = useAuth();
  const { village, villageId } = useVillage();
  const { toast } = useToast();

  const [category, setCategory]     = useState(location.state?.category || '');
  const [title, setTitle]           = useState('');
  const [description, setDescription] = useState('');
  const [urgency, setUrgency]       = useState('flexible');
  const [address, setAddress]       = useState('');
  const [phone, setPhone]           = useState(userPhone || '');
  const [amount, setAmount]         = useState(String(DEFAULT_AMOUNT));
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(false);
  const [error, setError]           = useState('');

  // Suggest a starting amount from what providers in this category
  // actually charge, once a category is picked — the customer can
  // still change it; there's no obligation to guess blind.
  useEffect(() => {
    if (!category || !villageId) return;
    getSevaProviders({ villageId, category }).then(({ data }) => {
      const rates = (data || []).map(p => Number(p.hourly_rate)).filter(n => n > 0);
      if (rates.length) {
        const avg = Math.round(rates.reduce((a, b) => a + b, 0) / rates.length);
        setAmount(String(avg));
      }
    });
  }, [category, villageId]);

  const valid = category && title.trim().length >= 3 && address.trim().length >= 5
    && phone.trim().length >= 8 && Number(amount) > 0 && villageId;

  const handleSubmit = async () => {
    if (!user?.id) { setError('You must be logged in.'); return; }
    if (!valid) { setError('Please fill in all the fields above.'); return; }

    setSubmitting(true);
    setError('');
    const { error: e } = await createSevaJob(user.id, {
      customerName: userName || null,
      villageId,
      title:        title.trim(),
      description:  description.trim() || null,
      category,
      amount:       Number(amount),
      urgency,
      address:      address.trim(),
      phone:        phone.trim(),
    });
    setSubmitting(false);

    if (e) {
      setError(e.message || 'Could not post your request. Please try again.');
      toast({ title: 'Could not submit', description: e.message, variant: 'destructive' });
      return;
    }
    setSubmitted(true);
    toast({ title: 'Request posted', description: 'Nearby providers can now accept it.' });
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center gap-4">
        <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center">
          <CheckCircle className="w-8 h-8 text-accent" />
        </div>
        <h2 className="text-lg font-bold">Request posted!</h2>
        <p className="text-sm text-muted-foreground max-w-xs">
          Nearby {category} providers in {village?.name || 'your village'} can now see and accept this request.
        </p>
        <Link to="/customer/seva/bookings" className="w-full max-w-xs">
          <Button className="w-full">View My Requests</Button>
        </Link>
        <Link to="/customer" className="text-xs text-muted-foreground underline">Back to Home</Link>
      </div>
    );
  }

  return (
    <div className="pb-8">
      <AppHeader title="Request a Service" showBack />
      <div className="p-4 space-y-4">
        <Card className="p-4 border-border space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Service *</label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue placeholder="Choose a service" /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">What do you need? *</label>
            <Input maxLength={100} placeholder="e.g. Fan not working in bedroom"
              value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">More details</label>
            <Textarea rows={3} maxLength={500} placeholder="Anything the provider should know"
              value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">When do you need this?</label>
            <Select value={urgency} onValueChange={setUrgency}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {URGENCY_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </Card>

        <Card className="p-4 border-border space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Address *</label>
            <Textarea rows={2} maxLength={300} placeholder="House/street, landmark"
              value={address} onChange={e => setAddress(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Phone *</label>
            <Input type="tel" maxLength={15} value={phone} onChange={e => setPhone(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Budget (₹)</label>
            <Input type="number" inputMode="numeric" min="1" max="99999"
              value={amount} onChange={e => setAmount(e.target.value)} />
            <p className="text-[10px] text-muted-foreground mt-1">
              An estimate based on providers nearby — the final amount is settled directly with the provider.
            </p>
          </div>
        </Card>

        {error && <p className="text-xs text-destructive" role="alert">{error}</p>}

        <Button className="w-full h-11" disabled={!valid || submitting} onClick={handleSubmit}>
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Post Request'}
        </Button>
      </div>
    </div>
  );
}
