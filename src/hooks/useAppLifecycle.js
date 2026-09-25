import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';

function currentVisibility() {
  if (typeof document === 'undefined') return true;
  return !document.hidden;
}

export function useAppLifecycle() {
  const [isActive, setIsActive] = useState(currentVisibility);

  useEffect(() => {
    let cancelled = false;
    let removeAppState = null;
    const setActive = (active) => {
      if (!cancelled) setIsActive(Boolean(active));
    };
    const onVisibility = () => setActive(currentVisibility());
    const onPageShow = () => setActive(true);
    const onPageHide = () => setActive(false);

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('pagehide', onPageHide);

    if (Capacitor.isNativePlatform()) {
      import('@capacitor/app')
        .then(({ App }) => App.addListener('appStateChange', state => setActive(state.isActive)))
        .then(handle => { removeAppState = handle; })
        .catch(() => {});
    }

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('pagehide', onPageHide);
      removeAppState?.remove?.();
    };
  }, []);

  return isActive;
}
