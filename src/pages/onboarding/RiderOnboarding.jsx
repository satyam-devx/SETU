// ═══════════════════════════════════════════════════════════
// SETU PLATFORM — RIDER ONBOARDING  (v3 — audit pass)
//
// Changes in this version:
//  1. CRASH FIX: this route is intentionally public (reachable
//     pre-login, same as vendor/seva onboarding), but nothing here
//     ever checked for that. Submitting Step 5 as a signed-out
//     visitor read user.id off a null user and crashed with "Cannot
//     read properties of null (reading 'id')". Step 1's "Next" now
//     gates on being logged in first (sends to /login with a
//     postLoginRedirect back to this page — the mechanism
//     lib/postLoginRedirect.js already documents this route as using,
//     it just was never actually wired up here), with a matching
//     guard in handleSubmit as a backstop.
//  2. Resume-check effect (redirect straight to /rider if a riders
//     row already exists) now waits for auth's own isLoading instead
//     of treating "session still restoring" the same as "genuinely
//     no user" — same fix already applied to vendor onboarding.
//  3. riders.name was always saved as '' — the comment said it would
//     be "filled from profile.name after reloadProfile" but nothing
//     ever did that. Now saved from the real profile name up front.
//  4. Aadhaar "Send OTP" button had no handler at all. Wired to the
//     same real kycService.verifyAadhaar(...) vendor onboarding
//     already uses (SurePass-backed edge function), with the same
//     honest "temporarily unavailable" note vendor onboarding shows
//     — this depends on a SUREPASS_API_KEY Vault secret being
//     configured, which this fix can't set up by itself.
//  5. Driving licence number is now actually saved (riders.license_number
//     — migration 085; it was collected in Step 1 and silently
//     dropped at submit before this).
//  6. DL photo and vehicle photo upload boxes had no file input or
//     handler at all — wired to the same kyc.uploadDoc() storage
//     upload vendor onboarding's document uploads use.
//  7. Step 4's training videos had hardcoded done:true/false values
//     baked into the array with no connection to anything the rider
//     actually did, and "Watch" had no handler — you could always
//     hit Next regardless. Watched state is now real (tracked as the
//     rider taps through), and Next is disabled until all five are
//     marked watched, matching what the screen already claims
//     ("Watch these short videos before your first delivery").
//
// Not fixed in this pass (flagging rather than guessing at scope):
//  - Selfie "tap to open camera" and the Village-Anchor-vouching card
//    (Step 1) are static placeholders with no backing feature to wire
//    them to — same as vendor onboarding's own equivalent elements,
//    not a rider-specific regression.
//  - Step 3's zone list (rider counts / avg orders / earnings per
//    zone) is static example data. Making it real needs a live
//    aggregation query grouped by riders.zone — riders.zone is a
//    free-text field with no dedicated zones table behind it — which
//    is a bigger, separate change from an onboarding-flow audit.
// ═══════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle, Camera, Bike, ChevronRight,
  AlertCircle, Loader2, PlayCircle,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';
import { getRiderByUserId } from '@/lib/api';
import { kyc as kycService } from '@/lib/kyc';
import { setPostLoginRedirect } from '@/lib/postLoginRedirect';

const STEPS = [
  { id: 1, label: 'Identity' },
  { id: 2, label: 'Vehicle' },
  { id: 3, label: 'Zone' },
  { id: 4, label: 'Training' },
  { id: 5, label: 'Go Live' },
];

const VEHICLE_OPTIONS = [
  { type: 'Bicycle',       icon: '🚲', note: 'Best for 0–3 km' },
  { type: 'E-Bike',        icon: '⚡', note: 'Best for 0–5 km' },
  { type: 'Motorcycle',    icon: '🏍️', note: 'Best for 0–10 km' },
  { type: 'Cycle Rickshaw',icon: '🛺', note: 'For heavy items' },
];

const ZONES = [
  { name: 'Madhepur Central', riders: 3, avgOrders: 12, earn: '₹720/day avg', load: 'High' },
  { name: 'Laxmipur East',    riders: 2, avgOrders: 8,  earn: '₹480/day avg', load: 'Medium' },
  { name: 'Parsad South',     riders: 1, avgOrders: 5,  earn: '₹300/day avg', load: 'Low' },
];

const EARNINGS_INFO = [
  { label: 'Per Delivery (0–2 km)',   amount: '₹30' },
  { label: 'Per Delivery (2–5 km)',   amount: '₹50' },
  { label: 'Per Delivery (5+ km)',    amount: '₹70' },
  { label: 'Surge (festival days)',   amount: '+50%' },
  { label: 'Weekly bonus (50+ orders)', amount: '₹500' },
];

// Kept as component-level state rather than baked into a data array —
// see file header, point 7. Loaded once; "watched" is the only field
// that changes as the rider taps through.
const TRAINING_VIDEOS = [
  { title: 'How to use the SETU Rider App',          duration: '4 min' },
  { title: 'COD Cash Handling Rules',                 duration: '3 min' },
  { title: 'Safe Delivery Protocols',                 duration: '3 min' },
  { title: 'Escalation & SOS Procedures',             duration: '2 min' },
  { title: 'Code of Conduct & SETU Constitution',     duration: '3 min' },
];

function StepIndicator({ current }) {
  return (
    <div className="flex items-center px-4 py-3 gap-1">
      {STEPS.map((step, i) => (
        <React.Fragment key={step.id}>
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
            step.id < current  ? 'bg-accent text-white' :
            step.id === current ? 'bg-primary text-white' :
                                  'bg-muted text-muted-foreground'
          }`}>
            {step.id < current ? '✓' : step.id}
          </div>
          {i < STEPS.length - 1 && (
            <div className={`flex-1 h-0.5 ${step.id < current ? 'bg-accent' : 'bg-border'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

export default function RiderOnboarding() {
  const navigate = useNavigate();
  const { user, profile, isLoading: authLoading, reloadProfile } = useAuth();

  const [step,         setStep]         = useState(1);
  const [vehicle,      setVehicle]      = useState('');
  const [vehicleNo,    setVehicleNo]    = useState('');
  const [zone,         setZone]         = useState('');
  const [aadhaar,      setAadhaar]      = useState('');
  const [licenseNo,    setLicenseNo]    = useState('');
  const [submitting,   setSubmitting]   = useState(false);
  const [submitError,  setSubmitError]  = useState('');

  // ── Aadhaar OTP verification ───────────────────────────────
  const [aadhaarVerifying, setAadhaarVerifying] = useState(false);
  const [aadhaarOtpSent,   setAadhaarOtpSent]   = useState(false);
  const [aadhaarError,     setAadhaarError]     = useState('');

  // ── Document uploads (DL photo, vehicle photo) ─────────────
  const [dlPhotoUrl,       setDlPhotoUrl]       = useState('');
  const [dlUploading,      setDlUploading]      = useState(false);
  const [dlUploadError,    setDlUploadError]    = useState('');
  const [vehiclePhotoUrl,  setVehiclePhotoUrl]  = useState('');
  const [vehicleUploading, setVehicleUploading] = useState(false);
  const [vehicleUploadError, setVehicleUploadError] = useState('');

  // ── Training videos — real watched-state (see file header #7) ──
  const [watched, setWatched] = useState(() => new Set());
  const allWatched = watched.size === TRAINING_VIDEOS.length;

  // If user already has a rider row, go straight to /rider. Waits for
  // authLoading to settle first — without this, a signed-in user whose
  // session is still being restored briefly looks identical to a
  // signed-out visitor (user === null either way), and this effect's
  // own !user guard would let Step 1 render before quietly redirecting
  // a moment later — the same flash-of-wrong-state vendor onboarding
  // had before its equivalent fix.
  useEffect(() => {
    if (authLoading || !user) return;
    getRiderByUserId(user.id).then(({ data }) => {
      if (data) navigate('/rider', { replace: true });
    });
  }, [user, authLoading, navigate]);

  const next = () => setStep(s => Math.min(s + 1, 5));
  const back = () => setStep(s => Math.max(s - 1, 1));

  // ── Step 1: "Next" gates on being logged in ────────────────
  // This route is intentionally reachable pre-login (RoleSelect links
  // straight here), same as vendor/seva onboarding — but nothing
  // downstream can actually save anything without a real user. Catch
  // it here, at the first natural point someone would hit it, instead
  // of letting a signed-out visitor fill out all 5 steps only to crash
  // on Submit.
  const handleStep1Next = () => {
    if (!user) {
      setPostLoginRedirect('/onboarding/rider');
      navigate('/login');
      return;
    }
    next();
  };

  // ── Aadhaar OTP ─────────────────────────────────────────────
  const handleSendOtp = async () => {
    if (aadhaar.length !== 12) { setAadhaarError('Enter a 12-digit Aadhaar number.'); return; }
    if (!user) { setPostLoginRedirect('/onboarding/rider'); navigate('/login'); return; }
    setAadhaarVerifying(true);
    setAadhaarError('');
    try {
      const { error } = await kycService.verifyAadhaar(user.id, aadhaar);
      if (error) throw error;
      setAadhaarOtpSent(true);
    } catch (err) {
      setAadhaarError(err?.message || 'Aadhaar verification failed. Please try again.');
    } finally {
      setAadhaarVerifying(false);
    }
  };

  // ── Document uploads ────────────────────────────────────────
  const handleDlPhotoSelect = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file || !user) return;
    setDlUploading(true);
    setDlUploadError('');
    try {
      const { data, error } = await supabase.storage
        .from('kyc-documents')
        .upload(`kyc/${user.id}/driving_license_${Date.now()}`, file);
      if (error) throw error;
      await supabase.from('kyc_records').insert({
        user_id: user.id, type: 'driving_license', doc_url: data.path, status: 'submitted',
      });
      setDlPhotoUrl(data.path);
    } catch (err) {
      setDlUploadError(err?.message || 'Upload failed. Please try again.');
    } finally {
      setDlUploading(false);
    }
  };

  const handleVehiclePhotoSelect = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !user) return;
    setVehicleUploading(true);
    setVehicleUploadError('');
    try {
      const { data, error } = await supabase.storage
        .from('kyc-documents')
        .upload(`kyc/${user.id}/vehicle_rc_${Date.now()}`, file);
      if (error) throw error;
      await supabase.from('kyc_records').insert({
        user_id: user.id, type: 'vehicle_rc', doc_url: data.path, status: 'submitted',
      });
      setVehiclePhotoUrl(data.path);
    } catch (err) {
      setVehicleUploadError(err?.message || 'Upload failed. Please try again.');
    } finally {
      setVehicleUploading(false);
    }
  };

  const toggleWatched = (i) => {
    setWatched(prev => {
      const next = new Set(prev);
      next.add(i);
      return next;
    });
  };

  // ── Step 5: Create riders row + update profile ────────────
  const handleSubmit = async () => {
    // Backstop — handleStep1Next already sends a signed-out visitor to
    // /login before they can get this far, but this is what actually
    // crashed before (user.id read off null). Never trust that an
    // earlier guard alone is enough for the one call that writes to
    // the database.
    if (!user) {
      setPostLoginRedirect('/onboarding/rider');
      navigate('/login');
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    try {
      // 1. Insert rider row — name from the real profile, not '' (see
      // file header #3), plus the licence number and any uploaded
      // document paths that were previously collected and discarded.
      const { error: riderErr } = await supabase
        .from('riders')
        .insert({
          user_id:        user.id,
          name:           profile?.name || 'Rider',
          phone:          profile?.phone || null,
          license_number: licenseNo || null,
          vehicle_type:   vehicle   || 'Bicycle',
          vehicle_number: vehicleNo || null,
          zone:           zone      || null,
          kyc_status:     'submitted',
          training_completed: true,
          is_online:      false,
          is_active:      true,
          is_verified:    false,
        });

      if (riderErr) {
        // If duplicate key (already has a row), just update profile role and continue
        if (riderErr.code !== '23505') throw riderErr;
      }

      // 2. Update profile role to 'rider'
      const { error: profileErr } = await supabase
        .from('profiles')
        .update({ role: 'rider' })
        .eq('id', user.id);

      if (profileErr) console.warn('[SETU RiderOnboarding] profile role update error:', profileErr);

      // 3. Reload profile so AuthContext sees role='rider' before navigate
      await reloadProfile();

      navigate('/rider', { replace: true });
    } catch (e) {
      console.error('[SETU RiderOnboarding] submit error:', e);
      setSubmitError(e?.message || 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background max-w-md mx-auto">
      {/* Header */}
      <div className="sticky top-0 bg-card z-10 border-b border-border">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
              <Bike className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h1 className="font-bold text-sm">Rider Registration</h1>
              <p className="text-[10px] text-muted-foreground">Step {step} of {STEPS.length}</p>
            </div>
          </div>
          <Progress value={(step / STEPS.length) * 100} className="w-16 h-1.5" />
        </div>
        <StepIndicator current={step} />
      </div>

      <div className="px-4 py-5">

        {/* Step 1: Identity */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold mb-1">Verify Your Identity</h2>
              <p className="text-sm text-muted-foreground">You must be 18+ and have a valid driving licence.</p>
            </div>
            <Card className="p-4 border-border space-y-2">
              <h3 className="font-semibold text-sm">Aadhaar Verification</h3>
              <Input
                placeholder="Aadhaar Number (12 digits)"
                className="font-mono"
                inputMode="numeric"
                maxLength={12}
                value={aadhaar}
                onChange={e => { setAadhaar(e.target.value.replace(/\D/g,'')); setAadhaarError(''); }}
                disabled={aadhaarOtpSent}
              />
              {aadhaarOtpSent && <Input placeholder="Registered Mobile OTP" className="mb-1" />}
              {aadhaarError && (
                <div className="flex items-start gap-2 text-destructive text-xs">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {aadhaarError}
                </div>
              )}
              <Button
                variant="outline" size="sm" className="w-full text-xs"
                onClick={aadhaarOtpSent ? undefined : handleSendOtp}
                disabled={aadhaarVerifying || aadhaar.length !== 12}
              >
                {aadhaarVerifying && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {aadhaarOtpSent ? 'OTP sent ✓' : 'Send OTP to Aadhaar-registered mobile'}
              </Button>
              <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-[10px] text-amber-700 font-medium">
                  KYC verification temporarily unavailable — contact support.
                </p>
              </div>
            </Card>
            <Card className="p-4 border-border space-y-2">
              <h3 className="font-semibold text-sm">Driving Licence</h3>
              <Input
                placeholder="Licence Number (e.g. BR1420XX000001)"
                className="font-mono uppercase"
                value={licenseNo}
                onChange={e => setLicenseNo(e.target.value.toUpperCase())}
              />
              <label className="h-28 bg-muted rounded-xl flex items-center justify-center border-2 border-dashed border-border cursor-pointer hover:border-primary transition-colors overflow-hidden">
                <input type="file" accept="image/*" className="hidden" onChange={handleDlPhotoSelect} disabled={dlUploading} />
                {dlUploading ? (
                  <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
                ) : dlPhotoUrl ? (
                  <div className="text-center">
                    <CheckCircle className="w-6 h-6 text-accent mx-auto mb-1" />
                    <p className="text-xs text-accent font-medium">DL photo uploaded ✓</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <Camera className="w-6 h-6 text-muted-foreground mx-auto mb-1" />
                    <p className="text-xs text-muted-foreground">Upload DL photo (front)</p>
                  </div>
                )}
              </label>
              {dlUploadError && (
                <div className="flex items-start gap-2 text-destructive text-xs">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {dlUploadError}
                </div>
              )}
            </Card>
            <Card className="p-4 border-border space-y-2">
              <h3 className="font-semibold text-sm">Police Verification</h3>
              <p className="text-xs text-muted-foreground">Required by SETU Constitution. Takes 3–5 working days.</p>
              <div className="h-20 bg-muted rounded-xl flex items-center justify-center border-2 border-dashed border-border">
                <p className="text-xs text-muted-foreground">Handled by the Admin during review</p>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Don't have it yet? The Admin will guide you through the process.
              </p>
            </Card>
            {!user && (
              <p className="text-xs text-muted-foreground text-center">
                You'll be asked to log in before continuing.
              </p>
            )}
            <Button className="w-full" onClick={handleStep1Next}>
              {user ? <>Next: Vehicle Details <ChevronRight className="w-4 h-4 ml-1" /></> : 'Login to Continue'}
            </Button>
          </div>
        )}

        {/* Step 2: Vehicle */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold mb-1">Your Vehicle</h2>
            <div className="grid grid-cols-2 gap-3">
              {VEHICLE_OPTIONS.map(v => (
                <Card
                  key={v.type}
                  onClick={() => setVehicle(v.type)}
                  className={`p-4 cursor-pointer text-center border-2 transition-all ${
                    vehicle === v.type ? 'border-primary bg-primary/5' : 'border-border'
                  }`}
                >
                  <span className="text-3xl mb-2 block">{v.icon}</span>
                  <p className="text-sm font-semibold">{v.type}</p>
                  <p className="text-[10px] text-muted-foreground">{v.note}</p>
                </Card>
              ))}
            </div>
            {vehicle && (
              <Card className="p-4 border-border space-y-2">
                <h3 className="font-semibold text-sm">Vehicle Details</h3>
                <Input
                  placeholder="Vehicle Number (if applicable)"
                  className="font-mono uppercase"
                  value={vehicleNo}
                  onChange={e => setVehicleNo(e.target.value.toUpperCase())}
                />
                <label className="h-24 bg-muted rounded-xl flex items-center justify-center border-2 border-dashed border-border cursor-pointer hover:border-primary transition-colors overflow-hidden">
                  <input type="file" accept="image/*" className="hidden" onChange={handleVehiclePhotoSelect} disabled={vehicleUploading} />
                  {vehicleUploading ? (
                    <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
                  ) : vehiclePhotoUrl ? (
                    <div className="flex items-center gap-2 text-accent">
                      <CheckCircle className="w-4 h-4" />
                      <p className="text-xs font-medium">Vehicle photo uploaded ✓</p>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Upload vehicle photo</p>
                  )}
                </label>
                {vehicleUploadError && (
                  <div className="flex items-start gap-2 text-destructive text-xs">
                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {vehicleUploadError}
                  </div>
                )}
              </Card>
            )}
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={back}>Back</Button>
              <Button className="flex-1" onClick={next} disabled={!vehicle}>
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Zone */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold mb-1">Select Your Zone</h2>
            <p className="text-sm text-muted-foreground">
              You'll receive orders only from your selected zone.
            </p>
            {ZONES.map(z => (
              <Card
                key={z.name}
                onClick={() => setZone(z.name)}
                className={`p-4 cursor-pointer border-2 transition-all ${
                  zone === z.name ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-semibold text-sm">{z.name}</h4>
                  <Badge
                    variant="outline"
                    className={`text-[9px] ${
                      z.load === 'High'   ? 'bg-red-100 text-red-800' :
                      z.load === 'Medium' ? 'bg-amber-100 text-amber-800' :
                                            'bg-green-100 text-green-800'
                    }`}
                  >
                    {z.load} demand
                  </Badge>
                </div>
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Bike className="w-3 h-3" /> {z.riders} riders
                  </span>
                  <span>{z.avgOrders} avg orders/day</span>
                  <span className="font-medium text-accent">{z.earn}</span>
                </div>
              </Card>
            ))}
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={back}>Back</Button>
              <Button className="flex-1" onClick={next} disabled={!zone}>
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Training */}
        {step === 4 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold mb-1">Rider Training</h2>
            <p className="text-sm text-muted-foreground">
              Watch these short videos before your first delivery. Takes ~15 minutes.
            </p>
            {TRAINING_VIDEOS.map((v, i) => {
              const done = watched.has(i);
              return (
                <Card
                  key={i}
                  onClick={() => !done && toggleWatched(i)}
                  className={`p-3 border flex items-center gap-3 ${
                    done ? 'bg-green-50 border-green-200' : 'border-border cursor-pointer hover:border-primary'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    done ? 'bg-accent text-white' : 'bg-muted'
                  }`}>
                    {done ? <CheckCircle className="w-4 h-4" /> : <span className="text-xs font-bold">{i + 1}</span>}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{v.title}</p>
                    <p className="text-xs text-muted-foreground">{v.duration}</p>
                  </div>
                  {!done && (
                    <Button size="sm" variant="outline" className="text-xs h-7 gap-1" onClick={(e) => { e.stopPropagation(); toggleWatched(i); }}>
                      <PlayCircle className="w-3.5 h-3.5" /> Watch
                    </Button>
                  )}
                </Card>
              );
            })}
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={back}>Back</Button>
              <Button className="flex-1" onClick={next} disabled={!allWatched}>
                {allWatched ? <>Next <ChevronRight className="w-4 h-4 ml-1" /></> : `Watch all ${TRAINING_VIDEOS.length} videos to continue`}
              </Button>
            </div>
          </div>
        )}

        {/* Step 5: Go Live */}
        {step === 5 && (
          <div className="space-y-4">
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-accent/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle className="w-8 h-8 text-accent" />
              </div>
              <h2 className="text-xl font-bold mb-1">Almost Ready!</h2>
              <p className="text-sm text-muted-foreground">
                Your application is under review. Expect approval within 24 hours.
              </p>
            </div>

            {/* Summary */}
            <div className="space-y-2 text-sm">
              {[
                { label: 'Vehicle',  value: vehicle || '—' },
                { label: 'Zone',     value: zone    || '—' },
              ].map(row => (
                <div key={row.label} className="flex justify-between py-1.5 border-b border-border">
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className="font-medium">{row.value}</span>
                </div>
              ))}
            </div>

            <Card className="p-4 border-border">
              <h3 className="font-semibold text-sm mb-3">Your Earnings Structure</h3>
              {EARNINGS_INFO.map((e, i) => (
                <div key={i} className="flex justify-between py-2 border-b border-border last:border-0 text-sm">
                  <span className="text-muted-foreground">{e.label}</span>
                  <span className="font-bold">{e.amount}</span>
                </div>
              ))}
            </Card>

            <Card className="p-3 bg-muted/50 border-border">
              <p className="text-xs text-muted-foreground">
                <strong>COD Rule:</strong> All cash collected must be deposited at the
                SETU collection point by 8pm daily. Balance exceeding ₹2,000 triggers
                a mandatory deposit.
              </p>
            </Card>

            {!user && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                You'll need to log in to submit your application — tap below and we'll bring you right back here.
              </div>
            )}
            {submitError && (
              <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-xs text-destructive">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {submitError}
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={back} disabled={submitting}>
                Back
              </Button>
              <Button className="flex-1 gap-2" onClick={handleSubmit} disabled={submitting}>
                {submitting
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</>
                  : user ? 'Submit Application 🚀' : 'Login to Submit'
                }
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
