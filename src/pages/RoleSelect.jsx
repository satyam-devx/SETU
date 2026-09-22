import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowUpRight,
  Bike,
  Check,
  Loader2,
  MoveUpRight,
  ShieldCheck,
  Sparkles,
  Store,
  Wrench,
} from 'lucide-react';
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

// Keep these routes unchanged. Village Anchor is intentionally excluded:
// it is an appointed role and has no self-registration flow.
const JOIN_PATHS = [
  {
    path: '/onboarding/vendor',
    title: 'Vendor',
    blurb: 'Sell from your shop',
    Icon: Store,
    eyebrow: 'SELL',
  },
  {
    path: '/onboarding/rider',
    title: 'Rider',
    blurb: 'Deliver & earn',
    Icon: Bike,
    eyebrow: 'DELIVER',
  },
  {
    path: '/onboarding/seva',
    title: 'Seva Provider',
    blurb: 'Offer your skill',
    Icon: Wrench,
    eyebrow: 'SERVE',
  },
];

const roleColors = [
  'from-primary/18 via-primary/5 to-transparent',
  'from-setu-earth/20 via-setu-earth/5 to-transparent',
  'from-secondary/18 via-secondary/5 to-transparent',
];

export default function RoleSelect() {
  const navigate = useNavigate();
  const { isAuthenticated, isProfileLoaded, isLoading, portalPath } = useAuth();
  const [showSplash, setShowSplash] = useState(
    () =>
      typeof window !== 'undefined' &&
      sessionStorage.getItem(SPLASH_SESSION_KEY) !== '1'
  );

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) return;
    if (!isProfileLoaded) return;

    if (portalPath && portalPath !== '/') {
      navigate(portalPath, { replace: true });
    }
  }, [isAuthenticated, isProfileLoaded, isLoading, portalPath, navigate]);

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

  if (isLoading) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-background flex flex-col items-center justify-center">
        <AmbientBackground />
        <div className="relative z-10 flex flex-col items-center gap-4">
          <div className="relative grid h-16 w-16 place-items-center rounded-[22px] border border-border/60 bg-card/80 shadow-2xl backdrop-blur-xl">
            <span className="font-heading text-2xl font-black tracking-[-0.08em] text-primary">
              S
            </span>
            <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-primary shadow-[0_0_18px_hsl(var(--primary)/0.8)]" />
          </div>
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <p className="text-xs tracking-[0.22em] text-muted-foreground uppercase">
            Connecting to SETU
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground selection:bg-primary/20">
      <style>{`
        @keyframes setu-float {
          0%, 100% { transform: translate3d(0,0,0) scale(1); }
          50% { transform: translate3d(0,-12px,0) scale(1.015); }
        }
        @keyframes setu-pulse {
          0%, 100% { opacity: .35; transform: scale(.92); }
          50% { opacity: .75; transform: scale(1.05); }
        }
        @keyframes setu-reveal {
          from { opacity: 0; transform: translateY(24px) scale(.985); filter: blur(8px); }
          to { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
        }
        @keyframes setu-reveal-right {
          from { opacity: 0; transform: translateX(22px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes setu-shimmer {
          0% { transform: translateX(-120%); }
          100% { transform: translateX(220%); }
        }
        .setu-reveal { animation: setu-reveal .8s cubic-bezier(.22,1,.36,1) both; }
        .setu-reveal-right { animation: setu-reveal-right .7s cubic-bezier(.22,1,.36,1) both; }
        .setu-float { animation: setu-float 6s ease-in-out infinite; }
        .setu-pulse { animation: setu-pulse 4s ease-in-out infinite; }
        .setu-shimmer { animation: setu-shimmer 2.8s ease-in-out infinite; }
        .setu-delay-1 { animation-delay: 100ms; }
        .setu-delay-2 { animation-delay: 180ms; }
        .setu-delay-3 { animation-delay: 260ms; }
        .setu-delay-4 { animation-delay: 340ms; }
        .setu-delay-5 { animation-delay: 420ms; }
        @media (prefers-reduced-motion: reduce) {
          .setu-reveal, .setu-reveal-right, .setu-float, .setu-pulse, .setu-shimmer {
            animation: none !important;
          }
        }
      `}</style>

      <AmbientBackground />

      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 pb-10 pt-5 sm:px-8 lg:px-10">
        {/* Top brand rail */}
        <header className="setu-reveal flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative grid h-11 w-11 place-items-center rounded-2xl border border-border/70 bg-card/75 shadow-lg backdrop-blur-xl">
              <span className="font-heading text-xl font-black tracking-[-0.08em] text-primary">
                S
              </span>
              <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
            </div>
            <div>
              <div className="font-heading text-lg font-black tracking-[-0.04em]">
                SETU
              </div>
              <div className="text-[9px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                Madhubani · Bihar
              </div>
            </div>
          </div>

          <div className="hidden items-center gap-2 rounded-full border border-border/60 bg-card/55 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground shadow-sm backdrop-blur-xl sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_10px_hsl(var(--primary)/0.8)]" />
            Local. Connected. Moving.
          </div>
        </header>

        <section className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[1.05fr_.95fr] lg:gap-16 lg:py-14">
          {/* Brand story / visual side */}
          <div className="setu-reveal setu-delay-1 relative">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/[0.07] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              One platform. Many possibilities.
            </div>

            <h1 className="max-w-xl font-heading text-[3.35rem] font-black leading-[.94] tracking-[-0.075em] sm:text-6xl lg:text-[5.5rem]">
              <span className="block">Your village,</span>
              <span className="block text-primary">connected.</span>
            </h1>

            <div className="mt-6 flex min-h-6 items-center text-sm font-medium text-muted-foreground sm:text-base">
              <RotatingText phrases={HEADLINE_PHRASES} />
            </div>

            <p className="mt-5 max-w-md text-sm leading-6 text-muted-foreground/80 sm:text-[15px]">
              Shop local, grow your business, deliver across your community,
              or turn your skills into a service — all through one connected
              local network.
            </p>

            {/* Visual statement */}
            <div className="relative mt-9 hidden h-40 max-w-lg overflow-hidden rounded-[28px] border border-border/60 bg-card/40 shadow-2xl backdrop-blur-xl sm:block">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-setu-earth/10" />
              <div className="absolute -right-10 -top-20 h-44 w-44 rounded-full bg-primary/10 blur-3xl setu-pulse" />
              <div className="absolute -bottom-24 left-10 h-40 w-40 rounded-full bg-setu-earth/10 blur-3xl setu-pulse" />

              <div className="absolute inset-x-5 bottom-5 flex items-end justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
                    Built for here
                  </p>
                  <p className="mt-1 text-lg font-bold tracking-tight">
                    Local roots. Digital reach.
                  </p>
                </div>
                <div className="setu-float grid h-12 w-12 place-items-center rounded-2xl border border-border/70 bg-background/65 shadow-lg backdrop-blur-xl">
                  <ArrowUpRight className="h-5 w-5 text-primary" />
                </div>
              </div>

              <div className="absolute left-6 top-6 h-px w-20 overflow-hidden bg-border/70">
                <div className="setu-shimmer h-full w-10 bg-primary/70" />
              </div>
            </div>
          </div>

          {/* Role/action side */}
          <div className="setu-reveal setu-delay-2 w-full lg:justify-self-end">
            <div className="rounded-[32px] border border-border/70 bg-card/60 p-2 shadow-[0_24px_80px_hsl(var(--foreground)/0.08)] backdrop-blur-2xl sm:p-3">
              <div className="rounded-[26px] border border-border/50 bg-background/55 p-5 sm:p-6">
                <div className="mb-6 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
                      Get started
                    </p>
                    <h2 className="mt-2 text-2xl font-black tracking-[-0.045em]">
                      What brings you to SETU?
                    </h2>
                  </div>
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                    <MoveUpRight className="h-4 w-4" />
                  </div>
                </div>

                <Link to="/login" className="group block">
                  <Button className="relative h-[60px] w-full overflow-hidden rounded-2xl px-5 text-left shadow-lg shadow-primary/15 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/20">
                    <span className="absolute inset-y-0 -left-1/2 w-1/3 -skew-x-12 bg-white/15 setu-shimmer" />
                    <span className="flex flex-1 flex-col items-start">
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-75">
                        Returning or new
                      </span>
                      <span className="mt-0.5 text-[15px] font-bold">
                        Login / Register
                      </span>
                    </span>
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/15 transition-transform duration-300 group-hover:translate-x-0.5">
                      <ArrowUpRight className="h-4 w-4" />
                    </span>
                  </Button>
                </Link>

                <div className="my-6 flex items-center gap-3">
                  <span className="h-px flex-1 bg-border/70" />
                  <span className="text-[9px] font-bold uppercase tracking-[0.22em] text-muted-foreground/60">
                    or join as
                  </span>
                  <span className="h-px flex-1 bg-border/70" />
                </div>

                <div className="space-y-2.5">
                  {JOIN_PATHS.map((role, i) => (
                    <Link
                      key={role.path}
                      to={role.path}
                      className={`setu-reveal-right setu-delay-${i + 3} group relative flex min-h-[74px] items-center gap-4 overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-r ${roleColors[i]} px-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-lg active:scale-[.99]`}
                    >
                      <span className="absolute inset-y-0 left-0 w-0.5 bg-primary/0 transition-all duration-300 group-hover:bg-primary/70" />

                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[15px] border border-border/60 bg-background/65 shadow-sm backdrop-blur-xl transition-transform duration-300 group-hover:scale-105 group-hover:-rotate-2">
                        <role.Icon className="h-[18px] w-[18px] text-foreground/80" />
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                          {role.eyebrow}
                        </span>
                        <span className="mt-1 block truncate text-[15px] font-bold tracking-[-0.015em]">
                          {role.title}
                        </span>
                        <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                          {role.blurb}
                        </span>
                      </span>

                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-border/60 bg-background/45 text-muted-foreground transition-all duration-300 group-hover:border-primary/20 group-hover:bg-primary/10 group-hover:text-primary">
                        <ArrowUpRight className="h-4 w-4" />
                      </span>
                    </Link>
                  ))}
                </div>

                <div className="mt-5 flex items-center gap-2 rounded-2xl border border-border/50 bg-muted/30 px-3.5 py-3">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
                  <p className="text-[10px] leading-4 text-muted-foreground">
                    Secure sign-in with a one-time password. No password to remember.
                  </p>
                </div>
              </div>
            </div>

            {!import.meta.env.VITE_SUPABASE_URL && (
              <div className="mt-3 rounded-2xl border border-amber-200/70 bg-amber-50/80 px-4 py-3 text-center shadow-sm dark:border-amber-500/20 dark:bg-amber-500/10">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-amber-800 dark:text-amber-300">
                  Demo Mode Active
                </p>
                <p className="mt-0.5 text-[10px] text-amber-700/90 dark:text-amber-200/80">
                  Use any 10-digit number and OTP <strong>1234</strong> to explore.
                </p>
              </div>
            )}
          </div>
        </section>

        <footer className="setu-reveal setu-delay-5 flex flex-col gap-2 border-t border-border/50 pt-5 text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/45 sm:flex-row sm:items-center sm:justify-between">
          <span>SETU · बिहार में बना</span>
          <span>Local commerce, services & delivery</span>
        </footer>
      </main>
    </div>
  );
}

function AmbientBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute left-[-12%] top-[-10%] h-[420px] w-[420px] rounded-full bg-primary/[0.07] blur-[100px]" />
      <div className="absolute bottom-[-15%] right-[-10%] h-[420px] w-[420px] rounded-full bg-setu-earth/[0.07] blur-[110px]" />
      <div className="absolute left-[45%] top-[30%] h-56 w-56 rounded-full bg-secondary/[0.035] blur-[90px]" />
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            'linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage:
            'radial-gradient(circle at center, black 0%, transparent 75%)',
          WebkitMaskImage:
            'radial-gradient(circle at center, black 0%, transparent 75%)',
        }}
      />
    </div>
  );
}
