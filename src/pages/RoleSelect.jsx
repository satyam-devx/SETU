// ═══════════════════════════════════════════════════════════
// SETU PLATFORM — ROLE SELECT / LANDING (redesigned)
//
// Experience: photo-led role threshold. User picks Shop / Sell /
// Ride / Serve; one primary CTA continues into the matching flow.
// Village Anchor is intentionally absent — not a self-registration path.
//
// Functional contracts preserved from the production-hardened source:
//  1. Redirect only after isAuthenticated AND isProfileLoaded
//  2. Never navigate to '/' (this page) — breaks infinite loops
//  3. Loading screen while isLoading, even for authenticated users
//  4. One-time splash via sessionStorage
//  5. Partner onboarding paths own post-login return via setPostLoginRedirect
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import SplashScreen from '@/pages/SplashScreen';
import RotatingText from '@/components/shared/RotatingText';

const SPLASH_SESSION_KEY = 'setu-splash-seen';

const HEADLINE_PHRASES = [
  'Rural commerce, for the village',
  'Superfast delivery, har gaon mein',
  'गाँव की दुकान, अब डिजिटल',
  'Ghar baithe order karo',
];

/**
 * Four self-registration roles. Customer is first-class (login → shop).
 * Vendor / Rider / Seva go through their onboarding routes, which already
 * send logged-out visitors through /login and back via setPostLoginRedirect.
 */
const ROLES = [
  {
    id: 'customer',
    short: 'Shop',
    hindi: 'ग्राहक',
    kicker: 'For your home',
    headline: 'Ghar baithe\norder karo',
    body: 'Kirana, sabzi and daily needs from shops in your village — brought to your door.',
    cta: 'Continue as customer',
    // Prefer real assets when present; gradient fallbacks keep the screen usable offline.
    photo: '/images/role-customer.jpg',
    photoAlt: 'A woman in a village courtyard with a bag of groceries',
    continue: { type: 'login', intendedRole: 'customer', redirect: '/shop' },
  },
  {
    id: 'vendor',
    short: 'Sell',
    hindi: 'दुकान',
    kicker: 'For shopkeepers',
    headline: 'Your shop,\nnow on SETU',
    body: 'List what you sell. Take orders from neighbours. No website, no middleman.',
    cta: 'Continue as vendor',
    photo: '/images/role-vendor.jpg',
    photoAlt: 'A kirana shopkeeper behind a wooden counter',
    continue: { type: 'path', path: '/onboarding/vendor', intendedRole: 'vendor' },
  },
  {
    id: 'rider',
    short: 'Ride',
    hindi: 'राइडर',
    kicker: 'For delivery',
    headline: 'Deliver, earn,\nbelong',
    body: 'Pick up from village shops and drop to homes nearby. Work the hours you have.',
    cta: 'Continue as rider',
    photo: '/images/role-rider.jpg',
    photoAlt: 'A delivery rider on a motorcycle on a village lane',
    continue: { type: 'path', path: '/onboarding/rider', intendedRole: 'rider' },
  },
  {
    id: 'seva',
    short: 'Serve',
    hindi: 'सेवा',
    kicker: 'For skilled hands',
    headline: 'Offer your\nskill',
    body: 'Tailoring, repair, tuition and more. Neighbours book you directly on SETU.',
    cta: 'Continue as seva provider',
    photo: '/images/role-seva.jpg',
    photoAlt: 'A village tailor at a sewing machine on a verandah',
    continue: { type: 'path', path: '/onboarding/seva', intendedRole: 'seva' },
  },
];

function BridgeMark({ className = 'w-8 h-8' }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect x="5" y="20" width="2.2" height="7" rx="0.4" fill="currentColor" />
      <rect x="24.8" y="20" width="2.2" height="7" rx="0.4" fill="currentColor" />
      <path
        d="M6 21c5.2-9 14.8-9 20 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M7.4 23.2c4.4-7.2 12.8-7.2 17.2 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        opacity="0.7"
      />
    </svg>
  );
}

function SetuWordmark({ tone = 'paper' }) {
  const color = tone === 'ink' ? 'text-foreground' : 'text-white';
  return (
    <div className={`flex items-center gap-2.5 ${color}`}>
      <BridgeMark className="w-8 h-8" />
      <span className="font-heading text-2xl font-medium tracking-tight">SETU</span>
    </div>
  );
}

function BootScreen() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-[#1C1916] text-[#F3EEE4]">
      <SetuWordmark />
      <Loader2 className="mt-6 w-5 h-5 animate-spin text-[#B5522A]" />
    </div>
  );
}

function RoleStory({ role }) {
  return (
    <div key={role.id} className="animate-in fade-in slide-in-from-bottom-2 duration-400">
      <p lang="hi" className="font-deva text-sm tracking-[0.28em] text-muted-foreground">
        {role.hindi}
      </p>
      <p className="mt-3 hidden md:block text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
        {role.kicker}
      </p>
      <h2 className="mt-2 whitespace-pre-line font-heading text-3xl md:text-5xl font-medium leading-[1.1] tracking-tight text-foreground">
        {role.headline}
      </h2>
      <p className="mt-3 max-w-sm text-sm md:text-base leading-relaxed text-muted-foreground">
        {role.body}
      </p>
    </div>
  );
}

export default function RoleSelect() {
  const navigate = useNavigate();
  const auth = useAuth();
  const {
    isAuthenticated,
    isProfileLoaded,
    isLoading,
    portalPath,
    setIntendedRole,
    setPostLoginRedirect,
  } = auth;

  const [booted, setBooted] = useState(false);
  const [showSplash, setShowSplash] = useState(false);
  const [selected, setSelected] = useState('customer');
  const [photoFailed, setPhotoFailed] = useState({});

  useEffect(() => {
    const seen = sessionStorage.getItem(SPLASH_SESSION_KEY) === '1';
    setShowSplash(!seen);
    setBooted(true);
  }, []);

  // Wait for BOTH authentication AND profile load before redirecting.
  // Never navigate to '/' — that is this page and causes a loop.
  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) return;
    if (!isProfileLoaded) return;
    if (portalPath && portalPath !== '/') {
      navigate(portalPath, { replace: true });
    }
  }, [isAuthenticated, isProfileLoaded, isLoading, portalPath, navigate]);

  const finishSplash = () => {
    sessionStorage.setItem(SPLASH_SESSION_KEY, '1');
    setShowSplash(false);
  };

  const current = ROLES.find((r) => r.id === selected) ?? ROLES[0];

  const continueAs = (roleId) => {
    const role = ROLES.find((r) => r.id === roleId) ?? ROLES[0];
    if (typeof setIntendedRole === 'function') {
      setIntendedRole(role.continue.intendedRole);
    }
    if (role.continue.type === 'path') {
      if (typeof setPostLoginRedirect === 'function') {
        setPostLoginRedirect(role.continue.path);
      }
      navigate(role.continue.path);
      return;
    }
    if (typeof setPostLoginRedirect === 'function') {
      setPostLoginRedirect(role.continue.redirect);
    }
    navigate('/login');
  };

  const signInReturning = () => {
    if (typeof setIntendedRole === 'function') setIntendedRole(null);
    if (typeof setPostLoginRedirect === 'function') setPostLoginRedirect(null);
    navigate('/login');
  };

  if (!booted) return <BootScreen />;
  if (showSplash) {
    return (
      <SplashScreen
        onFinish={finishSplash}
      />
    );
  }
  if (isLoading) return <BootScreen />;
  if (isAuthenticated && portalPath && portalPath !== '/') return <BootScreen />;

  return (
    <main className="min-h-dvh overflow-x-hidden bg-[#1C1916] text-[#F3EEE4] md:grid md:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)]">
      {/* Photo stage */}
      <section className="relative isolate flex h-[38vh] min-h-56 flex-col md:h-auto md:min-h-dvh">
        {ROLES.map((role) => {
          const failed = photoFailed[role.id];
          return failed ? (
            <div
              key={role.id}
              aria-hidden={selected !== role.id}
              className={`absolute inset-0 bg-gradient-to-br from-[#3A342E] via-[#1C1916] to-[#B5522A]/30 transition-opacity duration-500 ${
                selected === role.id ? 'opacity-100' : 'opacity-0'
              }`}
            />
          ) : (
            <img
              key={role.id}
              src={role.photo}
              alt={selected === role.id ? role.photoAlt : ''}
              onError={() => setPhotoFailed((prev) => ({ ...prev, [role.id]: true }))}
              className={`absolute inset-0 size-full object-cover transition-opacity duration-500 ease-out ${
                selected === role.id ? 'opacity-100' : 'opacity-0'
              }`}
            />
          );
        })}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/10 to-black/40 md:from-black/45 md:via-black/10 md:to-black/55" />

        <header className="relative z-10 px-5 pt-5 md:px-8 md:pt-8">
          <SetuWordmark />
          <p className="mt-2 min-h-5 text-xs text-white/75">
            <RotatingText phrases={HEADLINE_PHRASES} />
          </p>
          <p className="mt-1 text-xs text-white/60">Madhepur · Madhubani · बिहार</p>
        </header>
      </section>

      {/* Work surface */}
      <aside className="relative z-10 -mt-8 flex flex-col rounded-t-3xl bg-[#F3EEE4] px-5 pb-20 pt-5 text-[#1C1916] md:mt-0 md:rounded-none md:px-10 md:py-10 md:pb-10">
        <div className="mb-4 flex items-center gap-4 md:mb-8">
          <div
            className="min-w-0 flex-1"
            style={{
              height: 5,
              borderTop: '1px solid color-mix(in oklab, #B5522A 50%, transparent)',
              borderBottom: '1px solid color-mix(in oklab, #B5522A 50%, transparent)',
            }}
          />
          <button
            type="button"
            onClick={signInReturning}
            className="h-10 shrink-0 text-sm text-[#6F675E] transition-colors hover:text-[#1C1916]"
          >
            Sign in
          </button>
        </div>

        <p className="hidden md:block text-xs font-medium uppercase tracking-[0.22em] text-[#6F675E]">
          How will you use SETU?
        </p>
        <div className="md:mt-6">
          <RoleStory role={current} />
        </div>

        <div className="mt-6 flex flex-col gap-3 md:mt-auto md:gap-4 md:pt-10">
          <Button
            size="lg"
            className="w-full h-14 justify-between rounded-xl pl-5 pr-4 text-base font-semibold bg-[#B5522A] hover:bg-[#8E3E1F] text-[#FBF7F0]"
            onClick={() => continueAs(selected)}
          >
            {current.cta}
            <ArrowRight className="w-4 h-4" />
          </Button>

          <div
            role="radiogroup"
            aria-label="Choose how you’ll use SETU"
            className="grid grid-cols-4 rounded-xl bg-[#1C1916]/5 p-1"
          >
            {ROLES.map((role) => {
              const active = selected === role.id;
              return (
                <button
                  key={role.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setSelected(role.id)}
                  className={`flex h-12 items-center justify-center rounded-lg text-xs font-medium transition-colors duration-200 ${
                    active
                      ? 'bg-[#1C1916] text-[#F3EEE4]'
                      : 'text-[#6F675E] hover:text-[#1C1916]'
                  }`}
                >
                  {role.short}
                </button>
              );
            })}
          </div>
        </div>

        {!import.meta.env?.VITE_SUPABASE_URL && (
          <p className="mt-4 text-center text-xs text-[#6F675E]/80">
            Demo: any 10-digit number, OTP <span className="font-medium text-[#1C1916]">1234</span>
          </p>
        )}
      </aside>
    </main>
  );
}
