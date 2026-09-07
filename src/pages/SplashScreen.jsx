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
// ── Responsive vertical composition ─────────────────────────
// Five fixed content groups (top heading / hero logo / serving-area
// pill / loading bar / bottom signature) are separated by flex-grow
// spacers instead of one shared fixed gap. Extra viewport height is
// distributed proportionally across those spacers, so the RELATIVE
// spacing between groups holds on both short and tall screens instead
// of all slack piling up in one place:
//   - gap "a" (top → hero) and gap "b" (hero → pill) carry equal
//     weight (flex-1 each), so the hero logo settles roughly centered
//     between the heading above and the pill below on any screen
//     height — not nudged by a few fixed pixels.
//   - the pill → loader gap stays a small, fixed, non-flexible margin,
//     since those two read as one cluster, not two separate groups.
//   - the final gap (flex-[2]) absorbs most of any leftover tall-screen
//     space, since that's the one place the design wants a big
//     flexible run before the bottom-anchored signature block.
// Each spacer keeps a small min-height so nothing can collapse to a
// literal zero-gap overlap on very short screens. dvh + safe-area
// insets + clamp()'d type sizes handle the rest. Orientation lock is
// handled once, app-wide, in App.jsx.
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
const MIN_ENTRANCE_MS = 2200;
// A short, deliberate breath between the progress bar's last segment
// actually reaching 100% and the exit fade starting — without this,
// the final milestone flipping true and the opacity fade both fired in
// the same tick, so the bar's last fill visually got cut off mid-
// transition instead of ever being seen at rest. Kept small on purpose:
// this should read as "smoother", never as an added wait.
const PRE_EXIT_DELAY_MS = 150;
// Brief pause at 100% so the bar's completion is actually seen before
// handoff, instead of hitting 100 and instantly vanishing.
const SETTLE_MS = 500;
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
    // Let the bar's final fill actually be seen at rest for a beat
    // before the fade-out starts — see PRE_EXIT_DELAY_MS above.
    let settleTimer;
    const preExitTimer = setTimeout(() => {
      setExiting(true);
      settleTimer = setTimeout(() => onFinish?.(), SETTLE_MS);
    }, PRE_EXIT_DELAY_MS);
    return () => {
      clearTimeout(preExitTimer);
      clearTimeout(settleTimer);
    };
  }, [allDone, onFinish]);

  return (
    <div
      className={`relative flex min-h-[100dvh] flex-col items-center overflow-hidden bg-gradient-to-b from-background via-background to-secondary/10 px-6 transition-opacity duration-[350ms] ${
        exiting ? 'opacity-0' : 'opacity-100'
      }`}
      style={{
        paddingTop: 'max(2.75rem, env(safe-area-inset-top))',
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

        {/* TOP — headline */}
        <div className="mt-2 shrink-0 text-center">
          <p className="animate-fade-slide-down text-[clamp(0.6rem,2.8vw,0.75rem)] font-semibold tracking-[0.35em] text-foreground/70">
            {HEADLINE_TOP}
          </p>
          <p
            className="animate-fade-slide-down mt-1 text-[clamp(1rem,5vw,1.4rem)] font-extrabold tracking-[0.2em] text-primary"
            style={{ animationDelay: '150ms' }}
          >
            {HEADLINE_ACCENT}
          </p>
          {/* Smile-shaped curve (not a straight underline) — bows gently
              downward at the center, mirroring the brand mark's curve. */}
          <svg
            aria-hidden="true"
            viewBox="0 0 200 24"
            className="animate-curve-draw mx-auto mt-2 h-4 w-24 text-primary"
            style={{ animationDelay: '450ms' }}
          >
            <path
              d="M6 6 Q100 30 194 6"
              fill="none"
              stroke="currentColor"
              strokeWidth="7"
              strokeLinecap="round"
            />
          </svg>
        </div>

        {/* gap a — top → hero (flexible, balanced with gap b) */}
        <div className="min-h-[0.75rem] flex-1" aria-hidden="true" />

        {/* CENTER HERO — logo + speed lines */}
        <div className="relative flex w-full max-w-xs shrink-0 items-center justify-center">
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

        {/* gap b — hero → serving-area pill (flexible, balanced with gap a) */}
        <div className="min-h-[0.75rem] flex-1" aria-hidden="true" />

        {/* MIDDLE-LOWER — "Serving Madhubani" pill. Subtle rounded pill,
            saffron pin with a gentle continuous pulse (alive, not
            attention-grabbing). */}
        <div
          className="animate-fade-slide-up-lg flex shrink-0 items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5"
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

        {/* pill → loader: small, fixed, non-flexible — these two read as
            one cluster rather than separate groups, so this stays a
            plain margin instead of a flex-grow spacer. */}

        {/* LOADING SECTION — real progress, not a fake timer. */}
        <div className="animate-fade-in-delayed mt-4 w-full max-w-[220px] shrink-0" style={{ animationDelay: '1300ms' }}>
          <Progress value={progress} className="h-1.5" aria-label="Loading SETU" />
          <p className="mt-2 animate-pulse text-center text-[clamp(0.5rem,2.2vw,0.6rem)] tracking-[0.2em] text-foreground/40">
            {LOADING_LABEL}
          </p>
        </div>

        {/* gap c — loader → bottom signature. The one big flexible run:
            absorbs most of any extra tall-screen space, so everything
            above stays grouped while the bottom block still anchors low. */}
        <div className="min-h-[1rem] flex-[2]" aria-hidden="true" />

        {/* BOTTOM — designed/developed credit + signature, anchored at
            the very bottom (bounded only by the container's safe-area
            padding below). */}
        <div className="flex shrink-0 flex-col items-center gap-2 text-center">
          <p className="text-[clamp(0.55rem,2.4vw,0.7rem)] tracking-[0.25em] text-foreground/40">{SIGNATURE_LABEL}</p>
          {!signatureFailed && (
            <img
              src="/satyam-signature.png"
              alt=""
              className="h-[clamp(3.5rem,11vh,5.5rem)] w-auto object-contain opacity-90"
              onError={() => setSignatureFailed(true)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
