// ═══════════════════════════════════════════════════════════
// SETU — SplashScreen
//
// ── Required image assets (place in /public) ──────────────
//   /splash-bg.jpg     Full background artwork — cream backdrop,
//                       corner food photos, skyline, decorative
//                       curves and the road — WITHOUT the scooter
//                       logo, headline/tagline text, or loading bar
//                       (those are separate, independently-animated
//                       layers below).
//   /splash-logo.png    The SETU scooter + wordmark mark, ideally
//                       transparent background (the app-icon export,
//                       assets/logo.png, has its own cream square
//                       behind it and isn't the right one for this).
// Optional:
//   /satyam-signature.png   Designer/developer signature — reserved
//                       space renders even if this 404s, just empty.
// Until these exist, this degrades gracefully (gradient background,
// text wordmark) rather than showing broken image icons.
//
// ── Why the background is gated behind bgLoaded ────────────
// The white-flash / "elements pop in late" bug was this component
// painting its text/logo immediately while /splash-bg.jpg was still
// being fetched+decoded — for a few frames the background was blank
// white with everything else already on screen. Now NOTHING renders
// visibly until the background image has actually loaded (or failed,
// or a bounded timeout elapses) — the whole splash appears as one
// already-composed frame, never assembling itself in front of the user.
// The native Capacitor splash (see capacitor.config.json's
// `launchAutoHide: false`) is hidden at that exact same moment, so the
// system splash → this splash handoff has no gap either: the native
// layer only disappears once this one is already fully painted underneath.
//
// ── Animation philosophy ────────────────────────────────────
// Background stays ~90% static. The only things that move:
//   1. Speed lines → hero scooter slide-in-and-settle (the one "hero"
//      animation — everything else is calmer than this)
//   2. Headline: two-line staggered reveal + underline draw
//   3. "Serving Madhubani" badge: fades up once the hero has settled;
//      its pin icon has a continuous gentle pulse (alive, not attention-
//      grabbing)
//   4. Loading bar: REAL milestone-based progress — fonts ready + the
//      entrance choreography finishing + auth state resolved. Never a
//      fake fixed-duration timer; whichever milestone is slowest is
//      what actually determines how long the splash shows.
//
// ── Responsiveness ──────────────────────────────────────────
// No fixed-pixel positioning — flex layout with a single shared `gap`
// (so headline↔logo and logo↔badge are always equal), dvh + safe-area
// insets, clamp()'d type sizes, object-fit: cover/contain on both
// images. Orientation lock is handled once, app-wide, in App.jsx.
// ═══════════════════════════════════════════════════════════
import React, { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { MapPin } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/lib/AuthContext';

const HEADLINE_TOP    = 'GOOD FOOD';
const HEADLINE_ACCENT = 'CLOSER TO YOU';
const SERVING_AREA    = 'SERVING MADHUBANI';
const LOADING_LABEL   = 'LOADING A BETTER FOOD EXPERIENCE...';
const SIGNATURE_LABEL = 'DESIGNED & DEVELOPED BY';

// Not "fake loading" — the floor for the entrance choreography (speed
// lines → hero settle → underline draw, ~1.4s of keyframes) to finish
// at least once, so a very fast device doesn't cut the motion design
// off mid-way. Starts counting only once the background is visible.
const MIN_ENTRANCE_MS = 1500;
// Brief pause at 100% so the bar's completion is actually seen before
// handoff, instead of hitting 100 and instantly vanishing.
const SETTLE_MS = 350;
// If the background image genuinely never resolves (very slow/broken
// connection), don't hold the native splash hostage forever — show
// the gradient fallback and proceed.
const BG_LOAD_TIMEOUT_MS = 3000;

export default function SplashScreen({ onFinish }) {
  const { isLoading: authLoading } = useAuth();
  const [bgLoaded, setBgLoaded] = useState(false);
  const [bgFailed, setBgFailed] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const [signatureFailed, setSignatureFailed] = useState(false);
  const [fontsReady, setFontsReady] = useState(false);
  const [entranceDone, setEntranceDone] = useState(false);
  const [exiting, setExiting] = useState(false);
  const finishedRef = useRef(false);
  const nativeHiddenRef = useRef(false);

  const contentVisible = bgLoaded || bgFailed;

  // Bounded fallback so a background image that never loads or errors
  // (rather than cleanly failing) can't leave the splash stuck forever.
  useEffect(() => {
    const t = setTimeout(() => setBgFailed((f) => f || !bgLoaded), BG_LOAD_TIMEOUT_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hide the native (system) splash the instant our own content is
  // ready to paint — not before (would reveal blank white) and not
  // later than necessary (would reintroduce the gap this all exists
  // to remove).
  useEffect(() => {
    if (!contentVisible || nativeHiddenRef.current || !Capacitor.isNativePlatform()) return;
    nativeHiddenRef.current = true;
    import('@capacitor/splash-screen')
      .then(({ SplashScreen: NativeSplashScreen }) => NativeSplashScreen.hide())
      .catch((err) => console.warn('[SplashScreen] native hide failed:', err?.message));
  }, [contentVisible]);

  // Real readiness signals — start counting only once the background
  // is actually visible, so "fonts ready" etc. reflect what the user
  // is looking at, not a hidden pre-paint window.
  useEffect(() => {
    if (!contentVisible) return;
    let cancelled = false;
    const fontsPromise = document.fonts?.ready ?? Promise.resolve();
    fontsPromise.then(() => { if (!cancelled) setFontsReady(true); });
    const entranceTimer = setTimeout(() => { if (!cancelled) setEntranceDone(true); }, MIN_ENTRANCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(entranceTimer);
    };
  }, [contentVisible]);

  // Real, milestone-based progress. Every entry is something that
  // actually has to be true before the app is genuinely ready — never
  // a timer standing in for "looks about right".
  const milestones = [contentVisible, fontsReady, entranceDone, !authLoading];
  const doneCount = milestones.filter(Boolean).length;
  const progress = Math.round((doneCount / milestones.length) * 100);
  const allDone = contentVisible && doneCount === milestones.length;

  useEffect(() => {
    if (!allDone || finishedRef.current) return;
    finishedRef.current = true;
    setExiting(true);
    const t = setTimeout(() => onFinish?.(), SETTLE_MS);
    return () => clearTimeout(t);
  }, [allDone, onFinish]);

  return (
    <div
      className={`relative flex min-h-[100dvh] flex-col items-center overflow-hidden bg-gradient-to-b from-background via-background to-secondary/10 px-6 transition-opacity duration-300 ${
        exiting ? 'opacity-0' : 'opacity-100'
      }`}
      style={{
        paddingTop: 'max(2rem, env(safe-area-inset-top))',
        paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))',
      }}
    >
      {/* Static background artwork — see file header for what to export. */}
      {!bgFailed && (
        <img
          src="/splash-bg.jpg"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 -z-10 h-full w-full object-cover"
          onLoad={() => setBgLoaded(true)}
          onError={() => setBgFailed(true)}
        />
      )}

      {/* Nothing below paints until the background is ready — this is
          what stops the "white background, elements pop in later" bug. */}
      <div className={`flex w-full flex-1 flex-col items-center transition-opacity duration-200 ${contentVisible ? 'opacity-100' : 'opacity-0'}`}>

        {/* Headline → Logo → "Serving Madhubani" badge share one equal,
            responsive gap so all three read as evenly, deliberately spaced. */}
        <div className="flex w-full flex-col items-center gap-[clamp(1.5rem,4.5vh,2.75rem)]">
          <div className="text-center">
            <p className="animate-fade-slide-down text-[clamp(0.6rem,2.8vw,0.75rem)] font-semibold tracking-[0.35em] text-foreground/70">
              {HEADLINE_TOP}
            </p>
            <p
              className="animate-fade-slide-down mt-1 text-[clamp(1rem,5vw,1.4rem)] font-extrabold tracking-[0.2em] text-primary"
              style={{ animationDelay: '150ms' }}
            >
              {HEADLINE_ACCENT}
            </p>
            <span
              aria-hidden="true"
              className="animate-underline-draw mx-auto mt-2 block h-[3px] w-20 rounded-full bg-primary"
              style={{ animationDelay: '450ms' }}
            />
          </div>

          <div className="relative flex w-full max-w-xs items-center justify-center">
            <div aria-hidden="true" className="absolute left-[8%] top-1/2 -translate-y-1/2 space-y-1.5">
              <span className="block h-1 w-10 origin-left animate-speed-line rounded-full bg-primary/70" />
              <span className="block h-1 w-6 origin-left animate-speed-line rounded-full bg-primary/50" style={{ animationDelay: '90ms' }} />
              <span className="block h-1 w-3 origin-left animate-speed-line rounded-full bg-primary/30" style={{ animationDelay: '180ms' }} />
            </div>

            {logoFailed ? (
              <p className="animate-hero-enter font-heading text-[clamp(2rem,10vw,3rem)] font-bold tracking-tight text-foreground" style={{ animationDelay: '250ms' }}>
                <span className="text-primary">SETU</span>
              </p>
            ) : (
              <img
                src="/splash-logo.png"
                alt="SETU"
                className="animate-hero-enter w-[min(68vw,300px)]"
                style={{ animationDelay: '250ms' }}
                onError={() => setLogoFailed(true)}
              />
            )}
          </div>

          {/* "Serving Madhubani" badge — subtle rounded pill, saffron pin
              with a gentle continuous pulse (alive, not attention-grabbing). */}
          <div
            className="animate-fade-slide-up-lg flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5"
            style={{ animationDelay: '1100ms' }}
          >
            <span className="relative flex h-3 w-3 shrink-0 items-center justify-center">
              <span aria-hidden="true" className="animate-pin-pulse-ring absolute inset-0 rounded-full bg-primary/50" />
              <MapPin className="relative h-3 w-3 text-primary" fill="currentColor" />
            </span>
            <span className="text-[clamp(0.55rem,2.5vw,0.7rem)] font-semibold tracking-[0.25em] text-primary">
              {SERVING_AREA}
            </span>
          </div>
        </div>

        {/* Loading bar — real progress, not a fake timer. Subtler gap
            than the group above, since it reads as the group's caption. */}
        <div className="animate-fade-in-delayed mt-6 w-full max-w-[220px]" style={{ animationDelay: '1300ms' }}>
          <Progress value={progress} className="h-1.5" aria-label="Loading SETU" />
          <p className="mt-2 animate-pulse text-center text-[clamp(0.5rem,2.2vw,0.6rem)] tracking-[0.2em] text-foreground/40">
            {LOADING_LABEL}
          </p>
        </div>

        {/* Pushes the signature block toward the lower-middle area — a
            heavier flex-grow above than below so it settles below center
            without being glued to the very bottom edge. */}
        <div className="flex-[2]" />

        <div className="flex flex-col items-center gap-3 text-center">
          <p className="text-[clamp(0.5rem,2.2vw,0.6rem)] tracking-[0.25em] text-foreground/40">{SIGNATURE_LABEL}</p>
          {!signatureFailed && (
            <img
              src="/satyam-signature.png"
              alt=""
              className="h-[clamp(2.5rem,8vh,3.75rem)] w-auto object-contain opacity-80"
              onError={() => setSignatureFailed(true)}
            />
          )}
        </div>

        <div className="flex-1" />
      </div>
    </div>
  );
}
