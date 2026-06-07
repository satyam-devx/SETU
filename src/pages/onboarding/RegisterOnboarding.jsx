import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loader2, User, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/lib/AuthContext';

export default function RegisterOnboarding() {
  const navigate = useNavigate();
  const location = useLocation();
  const phone    = location.state?.phone || '';

  const { user, updateProfile, isLoading, portalPath } = useAuth();

  const [name,    setName]    = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  // If no authenticated user, go back to login
  useEffect(() => {
    if (!isLoading && !user) navigate('/login', { replace: true });
  }, [user, isLoading, navigate]);

  const handleContinue = async () => {
    if (!name.trim()) {
      setError('Please enter your name.');
      return;
    }

    setLoading(true);
    setError('');

    // Best-effort name update — if it fails we still let the user in.
    // The profile row already exists (created by the DB trigger on signup).
    // The name can always be changed later from profile settings.
    await updateProfile({ name: name.trim(), phone: phone || undefined });

    // Navigate regardless of whether the update succeeded.
    // portalPath is '/customer' for the default customer role.
    const destination = (portalPath && portalPath !== '/') ? portalPath : '/customer';
    navigate(destination, { replace: true });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/30 flex flex-col items-center justify-center p-6">
      <div className="text-center mb-10">
        <h1 className="font-heading text-5xl font-bold text-foreground tracking-tight">SETU</h1>
        <p className="text-muted-foreground text-sm mt-1 font-light">Rural Commerce Operating System</p>
      </div>

      <Card className="w-full max-w-sm p-6 border-border shadow-xl">
        <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 mb-5 mx-auto">
          <User className="w-6 h-6 text-primary" />
        </div>

        <h2 className="text-xl font-bold text-center text-foreground mb-1">
          Welcome to SETU!
        </h2>
        <p className="text-sm text-muted-foreground text-center mb-6">
          What should we call you?
        </p>

        <div className="mb-4">
          <Input
            type="text"
            placeholder="Your full name"
            value={name}
            onChange={e => { setName(e.target.value); setError(''); }}
            onKeyDown={e => e.key === 'Enter' && handleContinue()}
            className="h-11"
            autoFocus
            autoComplete="name"
            disabled={loading}
          />
          {error && <p className="text-xs text-destructive mt-2">{error}</p>}
        </div>

        <Button
          className="w-full h-11 gap-2 text-sm font-semibold"
          onClick={handleContinue}
          disabled={loading || !name.trim()}
        >
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Entering SETU...</>
          ) : (
            <>Continue <ArrowRight className="w-4 h-4" /></>
          )}
        </Button>
      </Card>

      <p className="text-muted-foreground/40 text-xs mt-6">SETU v1.0 · बिहार में बना</p>
    </div>
  );
}
