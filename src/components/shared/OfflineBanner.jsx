// ═══════════════════════════════════════════════════════════
// SETU — OfflineBanner
// Constitution requirement: "Offline is a design requirement, not an exception"
// Detects network status and shows a persistent banner.
// Does NOT block the UI — allows browsing cached data.
// ═══════════════════════════════════════════════════════════
import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi } from 'lucide-react';

export default function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showRestored, setShowRestored] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowRestored(true);
      setTimeout(() => setShowRestored(false), 3000);
    };
    const handleOffline = () => {
      setIsOnline(false);
      setShowRestored(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline && !showRestored) return null;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 py-2 text-xs font-medium transition-all
        ${isOnline
          ? 'bg-accent text-accent-foreground'
          : 'bg-destructive text-destructive-foreground'
        }`}
    >
      {isOnline
        ? <><Wifi className="w-3.5 h-3.5" /> Back online — syncing data...</>
        : <><WifiOff className="w-3.5 h-3.5" /> No internet — showing saved data</>
      }
    </div>
  );
}
