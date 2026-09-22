// ═══════════════════════════════════════════════════════════
// SETU PLATFORM — ROLE SELECT / LANDING PAGE  (production-hardened)
//
// KEY FIXES APPLIED:
//
//  1. Auth-state redirect now waits for BOTH isAuthenticated AND
//     isProfileLoaded before navigating. Previously it used only
//     isAuthenticated, so a user with a session but a loading/failed
//     profile would be redirected to portalPath = '/' (because
//     profile?.role is undefined), causing an infinite loop on this
//     same page.
//
//  2. Redirect useEffect now guards against navigating to '/' (which
//     is this page itself), breaking the infinite loop caused by
//     unknown roles returning '/' from getPortalPath.
//
//  3. Loading screen is shown while isLoading is true, regardless of
//     isAuthenticated, so a returning user never briefly sees the
//     unauthenticated welcome screen before being redirected.
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Loader2, Store, Bike, Wrench, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import SplashScreen from '@/pages/SplashScreen';
import RotatingText from '@/components/shared/RotatingText';

const SPLASH_SESSION_KEY = 'setu-splash-seen';

const HEADLINE_PHRASES = [
  'Rural Commerce Operating System',
  'Superfast Delivery, Har Gaon Mein',
  'Welcome to SETU',
  'Ghar Baithe Order Karo',
];

// The three self-registration paths below the main login card. Each
// one's own onboarding page (Vendor/Rider/SevaVerification) already
// redirects a logged-out visitor through /login and back to itself
// via setPostLoginRedirect — so a plain <Link> here is all that's
// needed; the destination owns getting the person back to the right
// place after they log in, rather than duplicating that logic here.
const JOIN_PATHS = [
  {
    path:  '/onboarding/vendor',
    title: 'Vendor',
    blurb: 'Sell from your shop',
    Icon:  Store,
    bg:    'bg-accent/10',
    fg:    'text-accent',
  },
  {
    path:  '/onboarding/rider',
    title: 'Rider',
    blurb: 'Deliver & earn',
    Icon:  Bike,
    bg:    'bg-setu-earth/10',
    fg:    'text-setu-earth',
  },
  {
    path:  '/onboarding/seva',
    title: 'Seva Provider',
    blurb: 'Offer your skill',
    Icon:  Wrench,
    bg:    'bg-secondary/10',
    fg:    'text-secondary',
  },
];

export default function RoleSelect() {
  const navigate = useNavigate();
  const { isAuthenticated, isProfileLoaded, isLoading, portalPath } = useAuth();
  const [showSplash, setShowSplash] = useState(
    () => typeof window !== 'undefined' && sessionStorage.getItem(SPLASH_SESSION_KEY) !== '1'
  );

  // FIX (Issue 1 / RoleSelect): Wait for BOTH authentication AND profile load
  // before redirecting. This prevents:
  //   a) Redirecting to '/' when profile is still loading (portalPath defaults to '/')
  //   b) Infinite loop when portalPath is '/' due to unknown/null role
  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) return;
    if (!isProfileLoaded) return;

    // Guard: never redirect to '/' — that's this page, causing an infinite loop.
    // This happens when getPortalPath returns '/' for an unknown role.
    if (portalPath && portalPath !== '/') {
      navigate(portalPath, { replace: true });
    }
  }, [isAuthenticated, isProfileLoaded, isLoading, portalPath, navigate]);

  // First paint of a fresh browser session — show the splash beat once,
  // then fall straight into the normal loading/redirect/welcome logic
  // below (sessionStorage means an in-app nav back to "/" won't replay it).
  if (showSplash) {
    return (
      <SplashScreen
        onFinish={() => {
          sessionStorage.setItem(SPLASH_SESSION_KEY, '1');
          setShowSplash(false);
        }}
      />
    );
  }

  // Show spinner while auth state is being resolved (e.g. page refresh with
  // existing session). This prevents returning users from seeing the
  // unauthenticated welcome screen before being redirected to their portal.
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-transparent">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
          <span className="font-heading text-primary font-bold text-lg">S</span>
        </div>
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground">Loading SETU...</p>
      </div>
    );
  }

  // Not authenticated — show welcome screen
  return (
    <div className="min-h-screen bg-transparent flex flex-col items-center justify-center p-6">

      {/* Logo */}
      <div className="text-center mb-10 animate-fade-slide-down">
        <h1 className="font-heading text-6xl md:text-7xl font-bold text-foreground tracking-tight">
          SETU
        </h1>
        <p className="text-muted-foreground mt-2 text-base font-light h-6">
          <RotatingText phrases={HEADLINE_PHRASES} />
        </p>
        <p className="text-muted-foreground/60 text-sm mt-1">
          Madhepur · Madhubani · Bihar · मिथिला
        </p>
      </div>

      {/* Welcome card */}
      <div
        className="w-full max-w-sm animate-fade-slide-up-lg"
        style={{ animationDelay: '150ms' }}
      >
        <div className="bg-card border border-border rounded-3xl p-8 shadow-xl text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <span className="text-3xl">🏘️</span>
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">
            गाँव की दुकान, अब डिजिटल
          </h2>
          <p className="text-sm text-muted-foreground mb-1">
            Your village. Your commerce. Your platform.
          </p>
          <p className="text-xs text-muted-foreground/60 mb-7">
            Shop, sell, deliver and grow — all in one place.
          </p>

          {/* Primary CTA */}
          <Link to="/login">
            <Button className="w-full h-12 text-base font-semibold gap-2 rounded-2xl">
              Login / Register
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>

          <p className="text-xs text-muted-foreground mt-4">
            We'll send a one-time password to your mobile number.
            No passwords to remember.
          </p>
        </div>
      </div>

      {/* Other ways to join — four partner paths get equal visual
          weight here instead of being an afterthought text row, so the
          choice is obvious before anyone taps into a login flow. */}
      <div
        className="mt-10 w-full max-w-sm sm:max-w-md animate-fade-in-delayed"
        style={{ animationDelay: '350ms' }}
      >
        <p className="text-center text-[0.65rem] font-semibold tracking-[0.25em] text-muted-foreground/70 mb-4">
          OTHER WAYS TO JOIN
        </p>

        <div className="grid grid-cols-2 gap-3">
          {JOIN_PATHS.map((p, i) => (
            <Link
              key={p.path}
              to={p.path}
              className="animate-fade-slide-up-lg group flex flex-col gap-2 rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition-transform active:scale-95"
              style={{ animationDelay: `${450 + i * 80}ms` }}
            >
              <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${p.bg}`}>
                <p.Icon className={`h-4 w-4 ${p.fg}`} />
              </span>
              <span className="text-sm font-semibold text-foreground">{p.title}</span>
              <span className="text-[0.7rem] leading-snug text-muted-foreground">{p.blurb}</span>
            </Link>
          ))}

          {/* Village Anchor is deliberately not a link like the three
              above: it's a role SETU appoints directly (a trusted
              village coordinator), with no self-registration flow
              anywhere in the app — so this card describes how to
              become one instead of pretending to be a working button.
              The dashed border is the visual cue for that difference. */}
          <div
            className="animate-fade-slide-up-lg flex flex-col gap-2 rounded-2xl border border-dashed border-border p-4 text-left"
            style={{ animationDelay: `${450 + JOIN_PATHS.length * 80}ms` }}
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
              <Users className="h-4 w-4 text-primary" />
            </span>
            <span className="text-sm font-semibold text-foreground">Village Anchor</span>
            <span className="text-[0.7rem] leading-snug text-muted-foreground">
              SETU appoints trusted coordinators directly.
            </span>
          </div>
        </div>
      </div>

      {/* Demo mode notice */}
      {!import.meta.env.VITE_SUPABASE_URL && (
        <div
          className="mt-6 w-full max-w-sm animate-fade-in-delayed"
          style={{ animationDelay: '750ms' }}
        >
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-center">
            <p className="text-xs text-amber-800 font-medium mb-0.5">Demo Mode Active</p>
            <p className="text-xs text-amber-700">
              Use any 10-digit number and OTP <strong>1234</strong> to explore.
            </p>
          </div>
        </div>
      )}

      <p className="text-muted-foreground/40 text-xs mt-8">
        SETU Technical Constitution · v1.0 · बिहार में बना
      </p>
    </div>
  );
}
