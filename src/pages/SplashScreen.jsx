// ═══════════════════════════════════════════════════════════
// SETU — SplashScreen
//
// The very first thing a cold-launch sees: a clean, premium
// logo reveal in the spirit of Blinkit / Swiggy / Zomato — a soft
// background, a single gentle ring pulse behind the mark, the
// wordmark rising in, then the location pill. Purely a branding
// beat — RoleSelect decides when to show this (once per browser
// session) and calls `onFinish` when it's done so the real
// welcome/login flow can take over.
//
// Easy to re-word later — TAGLINE and SERVING_AREA are the only
// strings that need to change.
// ═══════════════════════════════════════════════════════════
import React, { useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';

const TAGLINE = 'Gaon Ka Setu';
const SERVING_AREA = 'Madhubani';

// Staggered reveal timeline (ms). Keep it fast — under ~2s total.
const T_LOGO   = 100;
const T_WORD   = 520;
const T_TAG    = 760;
const T_PILL   = 980;
const T_EXIT   = 1700;
const EXIT_DUR = 350;

export default function SplashScreen({ onFinish }) {
  const [exiting, setExiting] = useState(false);
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  useEffect(() => {
    const timers = [
      setTimeout(() => setExiting(true), T_EXIT),
      setTimeout(() => onFinishRef.current?.(), T_EXIT + EXIT_DUR),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div
      className={`relative flex min-h-screen flex-col items-center justify-center bg-transparent px-6 transition-opacity duration-300 ${
        exiting ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* Logo mark + soft expanding ring */}
      <div className="relative flex h-24 w-24 items-center justify-center">
        {/* Single gentle ring pulse */}
        <span
          className="animate-splash-ring absolute inset-0 rounded-[1.75rem] bg-primary/15"
          style={{ animationDelay: `${T_LOGO}ms` }}
        />
        {/* Rounded app-icon badge */}
        <div
          className="animate-splash-pop relative flex h-20 w-20 items-center justify-center rounded-[1.5rem] bg-primary shadow-lg shadow-primary/25"
          style={{ animationDelay: `${T_LOGO}ms` }}
        >
          <span className="font-heading text-4xl font-bold tracking-tight text-primary-foreground">S</span>
        </div>
      </div>

      {/* Wordmark */}
      <h1
        className="animate-splash-rise mt-7 font-heading text-[2.75rem] font-bold leading-none tracking-tight text-foreground"
        style={{ animationDelay: `${T_WORD}ms` }}
      >
        SETU
      </h1>

      {/* Tagline */}
      <p
        className="animate-splash-rise mt-3 text-sm font-medium text-muted-foreground"
        style={{ animationDelay: `${T_TAG}ms` }}
      >
        {TAGLINE}
      </p>

      {/* Serving <area> pill */}
      <div
        className="animate-splash-rise mt-8 flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3.5 py-1.5"
        style={{ animationDelay: `${T_PILL}ms` }}
      >
        <MapPin className="h-3 w-3 text-primary" />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-primary">
          Serving {SERVING_AREA}
        </span>
      </div>
    </div>
  );
}
