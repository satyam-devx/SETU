import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowUpRight,
  Bike,
  Heart,
  MapPin,
  ShieldCheck,
  Store,
  Wrench,
} from 'lucide-react';
import { assetUrl } from '@/lib/media';
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
          <div className="relative inline-flex items-center gap-2.5 overflow-hidden rounded-full border border-primary/20 bg-card/75 px-3.5 py-2 shadow-[0_8px_28px_hsl(var(--foreground)/0.06)] backdrop-blur-xl">
            <span className="absolute inset-y-0 -left-1/2 w-1/3 -skew-x-12 bg-white/35 setu-shimmer" />
            <MapPin className="relative h-4 w-4 shrink-0 text-primary" strokeWidth={2.5} />
            <span className="relative text-[11px] font-extrabold uppercase tracking-[0.16em] text-foreground/85">
              Serving Madhubani
            </span>
          </div>
        </header>

        <section className="flex flex-1 items-center justify-center py-8 sm:py-12">
          <div className="setu-reveal setu-delay-1 w-full max-w-md">
            <div className="mb-7 text-center">
              <div className="setu-float relative mx-auto mb-5 grid h-16 w-16 place-items-center overflow-hidden rounded-[21px] border border-primary/15 bg-card/80 shadow-[0_14px_34px_hsl(var(--foreground)/0.08)] backdrop-blur-xl">
                <span className="absolute inset-0 rounded-[21px] bg-primary/[0.06] setu-pulse" />
                <img
                  src={assetUrl('/setu-icon.png')}
                  alt="SETU"
                  className="relative block h-full w-full object-contain"
                />
              </div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
                Welcome to SETU
              </p>
              <h1 className="mt-2 font-heading text-[2.35rem] font-black leading-none tracking-[-0.065em] sm:text-4xl">
                How would you like
                <span className="block text-primary">to continue?</span>
              </h1>
              <div className="mt-4 flex min-h-5 justify-center text-xs font-medium text-muted-foreground">
                <RotatingText phrases={HEADLINE_PHRASES} />
              </div>
            </div>

            <div className="rounded-[30px] border border-border/70 bg-card/55 p-2 shadow-[0_24px_80px_hsl(var(--foreground)/0.08)] backdrop-blur-2xl sm:p-3">
              <div className="rounded-[24px] border border-border/50 bg-background/55 p-4 sm:p-5">
                <Link to="/login" className="group block">
                  <Button className="relative h-[68px] w-full overflow-hidden rounded-[20px] px-5 text-left shadow-lg shadow-primary/15 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/20 active:scale-[.985]">
                    <span className="absolute inset-y-0 -left-1/2 w-1/3 -skew-x-12 bg-white/15 setu-shimmer" />
                    <span className="flex flex-1 flex-col items-start">
                      <span className="text-[9px] font-bold uppercase tracking-[0.2em] opacity-75">
                        Existing or new account
                      </span>
                      <span className="mt-1 text-base font-bold tracking-tight">
                        Login / Register
                      </span>
                    </span>
                    <span className="grid h-10 w-10 place-items-center rounded-[13px] bg-white/15 transition-transform duration-300 group-hover:translate-x-0.5">
                      <ArrowUpRight className="h-[18px] w-[18px]" />
                    </span>
                  </Button>
                </Link>

                <div className="my-5 flex items-center gap-3">
                  <span className="h-px flex-1 bg-border/70" />
                  <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground/55">
                    join SETU
                  </span>
                  <span className="h-px flex-1 bg-border/70" />
                </div>

                <div className="space-y-2.5">
                  {JOIN_PATHS.map((role, i) => (
                    <Link
                      key={role.path}
                      to={role.path}
                      className={`setu-reveal-right setu-delay-${i + 2} group relative flex min-h-[78px] items-center gap-4 overflow-hidden rounded-[20px] border border-border/70 bg-gradient-to-r ${roleColors[i]} px-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-lg active:scale-[.985]`}
                    >
                      <span className="absolute inset-y-0 left-0 w-0.5 bg-primary/0 transition-all duration-300 group-hover:bg-primary/70" />
                      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[16px] border border-border/60 bg-background/70 shadow-sm backdrop-blur-xl transition-transform duration-300 group-hover:scale-105 group-hover:-rotate-2">
                        <role.Icon className="h-[19px] w-[19px] text-foreground/80" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                          {role.eyebrow}
                        </span>
                        <span className="mt-1 block text-[15px] font-bold tracking-[-0.015em]">
                          {role.title}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-muted-foreground">
                          {role.blurb}
                        </span>
                      </span>
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[13px] border border-border/60 bg-background/45 text-muted-foreground transition-all duration-300 group-hover:border-primary/20 group-hover:bg-primary/10 group-hover:text-primary">
                        <ArrowUpRight className="h-4 w-4" />
                      </span>
                    </Link>
                  ))}
                </div>

                <div className="mt-5 flex items-center justify-center gap-2 px-2">
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-primary" />
                  <p className="text-center text-[9px] leading-4 text-muted-foreground">
                    Secure OTP sign-in · No password required
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
        <footer className="setu-reveal setu-delay-5 flex items-center justify-center gap-2 pb-1 pt-4 text-[10px] font-medium tracking-[0.01em] text-muted-foreground/65">
          <span>Built for Madhubani, with</span>
          <Heart className="h-3.5 w-3.5 fill-primary text-primary" aria-hidden="true" />
        </footer>
      </main>
    </div>
  );
}

function AmbientBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* Premium ambient lighting */}
      <div className="absolute -left-32 -top-28 h-[520px] w-[520px] rounded-full bg-primary/[0.11] blur-[115px] setu-pulse" />
      <div className="absolute -right-36 top-[8%] h-[430px] w-[430px] rounded-full bg-setu-earth/[0.085] blur-[115px] setu-pulse" />
      <div className="absolute -bottom-44 left-[18%] h-[520px] w-[520px] rounded-full bg-secondary/[0.055] blur-[125px]" />

      {/* Soft light bloom behind the main interaction */}
      <div
        className="absolute left-1/2 top-[43%] h-[430px] w-[430px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-70 blur-[95px]"
        style={{
          background:
            'radial-gradient(circle, hsl(var(--primary) / 0.075) 0%, hsl(var(--primary) / 0.025) 42%, transparent 72%)',
        }}
      />

      {/* Subtle premium grid */}
      <div
        className="absolute inset-0 opacity-[0.028]"
        style={{
          backgroundImage:
            'linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
          maskImage:
            'radial-gradient(ellipse at center, black 0%, transparent 76%)',
          WebkitMaskImage:
            'radial-gradient(ellipse at center, black 0%, transparent 76%)',
        }}
      />

      {/* Fine vignette/depth layer */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 28%, hsl(var(--background) / 0.10) 68%, hsl(var(--background) / 0.42) 100%)',
        }}
      />

      {/* Almost-imperceptible grain */}
      <div
        className="absolute inset-0 opacity-[0.035] mix-blend-multiply dark:mix-blend-screen"
        style={{
          backgroundImage:
            'url("data:image/svg+xml,%3Csvg viewBox=%220 0 180 180%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.85%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22 opacity=%22.32%22/%3E%3C/svg%3E")',
        }}
      />
    </div>
  );
}
