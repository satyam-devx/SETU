// ═══════════════════════════════════════════════════════════
// SETU PLATFORM — PROTECTED ROUTE  (production-hardened)
//
// KEY FIXES APPLIED:
//  1. Role check no longer passes through when userRole is null/undefined.
//     Previously `&& userRole &&` meant any null-role user could access
//     any portal. Now null role shows a loading/error state.
//  2. Added profile-loading intermediate state for authenticated users
//     whose profile hasn't loaded yet.
// ═══════════════════════════════════════════════════════════

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { getPortalPath } from '@/lib/supabase';

export default function ProtectedRoute({ children, allowedRoles = [], redirectTo = '/login' }) {
  const { isAuthenticated, isProfileLoaded, isLoading, userRole, authError } = useAuth();
  const location = useLocation();

  // Still determining auth state — show spinner
  if (isLoading) {
    return <LoadingScreen />;
  }

  // Not logged in — redirect to login, preserving intended destination
  if (!isAuthenticated) {
    return <Navigate to={redirectTo} state={{ from: location.pathname }} replace />;
  }

  // Authenticated but profile not yet loaded — wait before making role decisions.
  // This prevents the brief window after login where profile is null from
  // incorrectly redirecting users away from their portal.
  if (!isProfileLoaded) {
    if (authError) {
      // Profile load failed after all retries — show actionable error
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background p-6">
          <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
            <span className="text-destructive text-xl">⚠</span>
          </div>
          <p className="text-sm text-muted-foreground text-center max-w-xs">
            {authError}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="text-xs text-primary underline"
          >
            Retry
          </button>
        </div>
      );
    }
    // Still loading profile
    return <LoadingScreen />;
  }

  // FIX (Issue 10): Removed `&& userRole &&` guard that allowed null-role users
  // to pass through unchecked. Now we enforce role strictly when allowedRoles
  // is specified.
  if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
    const correctPortal = getPortalPath(userRole);
    return <Navigate to={correctPortal} replace />;
  }

  return children;
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background">
      <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
        <span className="font-heading text-primary font-bold text-lg">S</span>
      </div>
      <Loader2 className="w-5 h-5 animate-spin text-primary" />
      <p className="text-xs text-muted-foreground">Loading SETU...</p>
    </div>
  );
}
