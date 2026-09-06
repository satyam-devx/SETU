// ═══════════════════════════════════════════════════════════
// SETU — SplashScreen
//
// Matches the approved reference design: a mostly-static
// illustrated background (food corners, skyline, decorative
// curves — see the two image assets required below) with a
// staged hero animation, real milestone-based progress, and two
// subtle infinite micro-animations (pin pulse, road sweep).
//
// ── Required image assets (place in /public) ──────────────
//   /splash-bg.jpg     Full background artwork — cream backdrop,
//                       corner food photos, skyline, decorative
//                       curves and the road — WITHOUT the scooter
//                       logo, headline/tagline text, loading bar,
//                       or the location pin (those are separate,
//                       independently-animated layers below so
//                       they can move without needing a second
//                       copy baked into the background).
//   /splash-logo.png    The SETU scooter + wordmark mark, ideally
//                       on a transparent background so it composites
//                       cleanly over /splash-bg.jpg (the version
//                       used for the Android app *icon*, assets/
//                       logo.png, has its own cream square behind
//                       it and isn't the right export for this).
// Until those exist, this degrades gracefully (gradient background,
// text wordmark) rather than rendering broken image icons.
//
// ── Animation philosophy (per the approved spec) ───────────
// Background stays ~90% static — only these move:
//   1. Speed lines → hero scooter slide-in-and-settle (the one
//      "hero" animation, everything else is calmer than this)
//   2. Headline: two-line staggered reveal + underline draw
//   3. Tagline: soft fade-up once the hero has settled
//   4. Loading bar: REAL milestone-based progress (fonts ready +
//      the entrance choreography finishing + auth state resolved)
//      — never a fake fixed-duration timer. Whatever finishes
//      first still has to wait for the others; whatever's slowest
//      determines how long the splash actually shows.
//   5. Pin: gentle pulse ring. Road: a single soft light sweep,
//      looping — both are micro-animations, not attention-grabbing.
//
// ── Responsiveness ──────────────────────────────────────────
// No fixed-pixel positioning anywhere — flex layout with flexible
// spacers, dvh + safe-area-inset padding, clamp()'d type sizes, and
// object-fit: cover/contain on both images so nothing stretches or
// crops the logo/text regardless of aspect ratio. Orientation lock
// is handled once, app-wide, in App.jsx (not here).
// ═══════════════════════════════════════════════════════════
import React, { useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/lib/AuthContext';

const HEADLINE_TOP    = 'GOOD FOOD';
const HEADLINE_ACCENT = 'CLOSER TO YOU';
const TAGLINE_LINE_1  = 'LOCAL FLAVOURS';
const TAGLINE_LINE_2  = 'GREATER CONNECTIONS';
const LOADING_LABEL   = 'LOADING A BETTER FOOD EXPERIENCE...';
const FOOTER_LABEL    = 'SERVING HAPPIER TOMORROWS';

// Not "fake loading" — this is the floor for the entrance choreography
// (speed lines → hero settle → underline draw, ~1.4s of keyframes) to
// finish at least once, so a very fast device doesn't cut the motion
// design off mid-way. If the app is genuinely ready before this,
// progress still waits on this milestone like any other.
const MIN_ENTRANCE_MS = 1500;
// Brief pause at 100% so the bar's completion is actually visible
// before handoff, instead of hitting 100 and instantly vanishing.
const SETTLE_MS = 350;

export default function SplashScreen({ onFinish }) {
  const { isLoading: authLoading } = useAuth();
  const [fontsReady, setFontsReady] = useState(false);
  const [entranceDone, setEntranceDone] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [bgFailed, setBgFailed] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const finishedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const fontsPromise = document.fonts?.ready ?? Promise.resolve();
    fontsPromise.then(() => { if (!cancelled) setFontsReady(true); });
    const entranceTimer = setTimeout(() => { if (!cancelled) setEntranceDone(true); }, MIN_ENTRANCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(entranceTimer);
    };
  }, []);

  // Real, milestone-based progress. Every entry here is something that
  // actually has to be true before the app is genuinely ready to show —
  // never a timer standing in for "looks about right".
  const milestones = [true /* mounted */, fontsReady, entranceDone, !authLoading];
  const doneCount = milestones.filter(Boolean).length;
  const progress = Math.round((doneCount / milestones.length) * 100);
  const allDone = doneCount === milestones.length;

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
          onError={() => setBgFailed(true)}
        />
      )}

      {/* ── Headline ─────────────────────────────────────── */}
      <div className="mt-2 text-center">
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

      <div className="min-h-4 flex-1" />

      {/* ── Hero: speed lines + SETU scooter ─────────────── */}
      <div className="relative flex w-full max-w-xs items-center justify-center">
        <div aria-hidden="true" className="absolute left-[8%] top-1/2 -translate-y-1/2 space-y-1.5">
          <span className="block h-1 w-10 origin-left animate-speed-line rounded-full bg-primary/70" />
          <span className="block h-1 w-6 origin-left animate-speed-line rounded-full bg-primary/50" style={{ animationDelay: '90ms' }} />
          <span className="block h-1 w-3 origin-left animate-speed-line rounded-full bg-primary/30" style={{ animationDelay: '180ms' }} />
        </div>

        {logoFailed ? (
          <p
            className="animate-hero-enter font-heading text-[clamp(2rem,10vw,3rem)] font-bold tracking-tight text-foreground"
            style={{ animationDelay: '250ms' }}
          >
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

      <div className="min-h-4 flex-1" />

      {/* ── Tagline ──────────────────────────────────────── */}
      <div className="animate-fade-slide-up-lg text-center" style={{ animationDelay: '1100ms' }}>
        <p className="text-[clamp(0.55rem,2.5vw,0.7rem)] font-semibold tracking-[0.3em] text-foreground/60">{TAGLINE_LINE_1}</p>
        <p className="text-[clamp(0.55rem,2.5vw,0.7rem)] font-semibold tracking-[0.3em] text-foreground/60">{TAGLINE_LINE_2}</p>
      </div>

      <div className="min-h-3 flex-1" />

      {/* ── Loading bar — real progress, not a fake timer ──── */}
      <div className="animate-fade-in-delayed w-full max-w-[220px]" style={{ animationDelay: '1300ms' }}>
        <Progress value={progress} className="h-1.5" aria-label="Loading SETU" />
        <p className="mt-2 animate-pulse text-center text-[clamp(0.5rem,2.2vw,0.6rem)] tracking-[0.2em] text-foreground/40">
          {LOADING_LABEL}
        </p>
      </div>

      <div className="min-h-3 flex-1" />

      {/* ── Pin + road micro-animation ───────────────────── */}
      <div className="w-full max-w-[160px]">
        <div className="relative mx-auto h-5 w-5">
          <span aria-hidden="true" className="animate-pin-pulse-ring absolute inset-0 rounded-full bg-primary/50" />
          <MapPin className="relative h-5 w-5 text-primary" fill="currentColor" />
        </div>
        <div aria-hidden="true" className="relative mt-2 h-1 w-full overflow-hidden rounded-full bg-primary/10">
          <span className="animate-road-sweep absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
        </div>
      </div>

      <p className="mt-5 text-center text-[clamp(0.5rem,2.2vw,0.6rem)] tracking-[0.25em] text-foreground/40">{FOOTER_LABEL}</p>
    </div>
  );
}
