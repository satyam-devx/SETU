// ═══════════════════════════════════════════════════════════
// SETU — useMediaQuery
// Minimal, dependency-free reactive media-query hook.
// Used to branch rendering between the desktop static/rail
// sidebar and the mobile modal drawer — this decision has to
// happen in JS (not just CSS) because the mobile drawer needs
// to fully unmount its focus-trap / scroll-lock machinery when
// we're on desktop, not just be visually hidden.
// ═══════════════════════════════════════════════════════════
import { useEffect, useState } from 'react';

export function useMediaQuery(query) {
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    // Sync in case it changed between initial render and mount
    // (e.g. devtools responsive mode, orientation change mid-navigation).
    setMatches(mql.matches);

    const handleChange = (e) => setMatches(e.matches);

    // Safari < 14 only supports the deprecated addListener API.
    if (mql.addEventListener) {
      mql.addEventListener('change', handleChange);
      return () => mql.removeEventListener('change', handleChange);
    }
    mql.addListener(handleChange);
    return () => mql.removeListener(handleChange);
  }, [query]);

  return matches;
}

// Matches Tailwind's `lg` breakpoint — the point at which the shell
// switches from a mobile modal drawer to a static/rail desktop sidebar.
export function useIsDesktop() {
  return useMediaQuery('(min-width: 1024px)');
}
