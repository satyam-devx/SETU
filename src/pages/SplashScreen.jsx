// ═══════════════════════════════════════════════════════════
// SETU — SplashScreen
//
// The very first thing a cold-launch sees: logo, a two-tone
// slogan that types itself out, then a "Serving <district>"
// pill fades in. Purely a branding beat — RoleSelect decides
// when to show this (once per browser session) and calls
// `onFinish` when it's done so the real welcome/login flow can
// take over.
//
// Easy to re-word later — SLOGAN_PLAIN / SLOGAN_ACCENT and
// SERVING_AREA are the only strings that need to change.
// ═══════════════════════════════════════════════════════════
import React, { useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';

const SLOGAN_PLAIN = 'Gaon Ka ';
const SLOGAN_ACCENT = 'Setu';
const SLOGAN_FULL = SLOGAN_PLAIN + SLOGAN_ACCENT;
const SERVING_AREA = 'Madhubani';

const TYPE_SPEED_MS = 65;
const PAUSE_AFTER_TYPE_MS = 350;
const HOLD_BEFORE_FINISH_MS = 900;

export default function SplashScreen({ onFinish }) {
  const [typedCount, setTypedCount] = useState(0);
  const [showPill, setShowPill] = useState(false);
  const [exiting, setExiting] = useState(false);
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  useEffect(() => {
    const timers = [];

    // Type the slogan out one character at a time.
    for (let i = 1; i <= SLOGAN_FULL.length; i++) {
      timers.push(setTimeout(() => setTypedCount(i), i * TYPE_SPEED_MS));
    }

    const typingDone = SLOGAN_FULL.length * TYPE_SPEED_MS;

    // Reveal the "Serving <area>" pill shortly after typing finishes.
    timers.push(setTimeout(() => setShowPill(true), typingDone + PAUSE_AFTER_TYPE_MS));

    // Start the exit fade, then hand off to the caller.
    const exitAt = typingDone + PAUSE_AFTER_TYPE_MS + HOLD_BEFORE_FINISH_MS;
    timers.push(setTimeout(() => setExiting(true), exitAt));
    timers.push(setTimeout(() => onFinishRef.current?.(), exitAt + 300));

    return () => timers.forEach(clearTimeout);
  }, []);

  const typed = SLOGAN_FULL.slice(0, typedCount);
  const typedPlain = typed.slice(0, SLOGAN_PLAIN.length);
  const typedAccent = typed.slice(SLOGAN_PLAIN.length);
  const stillTyping = typedCount < SLOGAN_FULL.length;

  return (
    <div
      className={`flex min-h-screen flex-col items-center justify-center bg-transparent px-6 transition-opacity duration-300 ${
        exiting ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* Logo badge */}
      <div className="mb-8 flex h-28 w-28 items-center justify-center rounded-full bg-card shadow-xl ring-1 ring-border animate-fade-slide-down">
        <span className="font-heading text-4xl font-bold tracking-tight text-primary">S</span>
      </div>

      {/* Typewriter slogan */}
      <h1 className="font-heading text-4xl font-bold tracking-tight text-foreground sm:text-5xl" aria-live="polite">
        {typedPlain}
        <span className="text-primary">{typedAccent}</span>
        <span className={`ml-0.5 inline-block w-[2px] bg-foreground/70 align-middle ${stillTyping ? 'animate-pulse' : 'opacity-0'}`} style={{ height: '0.85em' }} />
      </h1>

      {/* Serving <area> pill */}
      <div
        className={`mt-6 flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-2 transition-all duration-300 ${
          showPill ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0'
        }`}
      >
        <MapPin className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-bold uppercase tracking-wide text-primary">Serving {SERVING_AREA}</span>
      </div>
    </div>
  );
}
