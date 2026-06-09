// ═══════════════════════════════════════════════════════════
// SETU — ProtectedRoute (v2)
// Improvements:
//  - Shows authError from context (not just generic message)
//  - Retry button triggers reloadProfile (not full page reload)
//  - Loading screen has accessible role="status" aria-live
//  - Timeout reduced: 8s → 5s (retries complete in ~4s)
//  - Added SETU brand mark to loading screen
// ═══════════════════════════════════════════════════════════
import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2, RefreshCw } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { getPortalPath } from '@/lib/supabase';

export default function ProtectedRoute({ children, allowedRoles = [], redirectTo = '/login' }) {
  const {
    isAuthenticated, isProfileLoaded, isLoading,
    userRole, user, reloadProfile, authError,
  } = useAuth();
  const location  = useLocation();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    setTimedOut(false);
    if (!isLoading && isAuthenticated && !isProfileLoaded) {
      const t = setTimeout(() => setTimedOut(true), 5000);
      return () => clearTimeout(t);
    }
  }, [isLoading, isAuthenticated, isProfileLoaded]);

  // ── Loading ───────────────────────────────────────────
  if (isLoading) return <LoadingScreen />;

  // ── Not authenticated → redirect ──────────────────────
  if (!isAuthenticated) {
    return <Navigate to={redirectTo} state={{ from: location.pathname }} replace />;
  }

  // ── Authenticated but profile not loaded ──────────────
  if (!isProfileLoaded) {
    if (timedOut || authError) {
      return (
        <div
          className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background p-6"
          role="alert"
          aria-live="assertive"
        >
          <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
            <span className="text-destructive text-xl" aria-hidden="true">⚠</span>
          </div>
          <p className="text-sm text-muted-foreground text-center max-w-xs">
            {authError || 'Could not load your profile. Please check your connection.'}
          </p>
          <button
            onClick={reloadProfile}
            className="flex items-center gap-2 text-sm text-primary font-medium"
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            Retry
          </button>
        </div>
      );
    }
    return <LoadingScreen />;
  }

  // ── Wrong role → redirect to correct portal ───────────
  if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
    return <Navigate to={getPortalPath(userRole)} replace />;
  }

  return children;
}

export function LoadingScreen({ message = 'Loading SETU...' }) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background"
      role="status"
      aria-live="polite"
      aria-label={message}
    >
      <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
        <span className="font-bold text-primary text-2xl tracking-tight">S</span>
      </div>
      <Loader2 className="w-5 h-5 animate-spin text-primary" aria-hidden="true" />
      <p className="text-xs text-muted-foreground">{message}</p>
    </div>
  );
}
