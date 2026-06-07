import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { getPortalPath } from '@/lib/supabase';

export default function ProtectedRoute({ children, allowedRoles = [], redirectTo = '/login' }) {
  const { isAuthenticated, isProfileLoaded, isLoading, userRole, user, loadProfileForUser } = useAuth();
  const location = useLocation();

  // Only show the error screen after waiting long enough for retries to complete.
  // This prevents a flash of error when profile is still loading.
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    setTimedOut(false);
    if (!isLoading && isAuthenticated && !isProfileLoaded) {
      // Give the retry logic 8 seconds before showing error
      const t = setTimeout(() => setTimedOut(true), 8000);
      return () => clearTimeout(t);
    }
  }, [isLoading, isAuthenticated, isProfileLoaded]);

  // Re-trigger profile load if stuck
  useEffect(() => {
    if (!isLoading && isAuthenticated && !isProfileLoaded && user && loadProfileForUser) {
      loadProfileForUser(user);
    }
  }, [isLoading, isAuthenticated, isProfileLoaded]);

  if (isLoading) return <LoadingScreen />;

  if (!isAuthenticated) {
    return <Navigate to={redirectTo} state={{ from: location.pathname }} replace />;
  }

  if (!isProfileLoaded) {
    if (timedOut) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background p-6">
          <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
            <span className="text-destructive text-xl">⚠</span>
          </div>
          <p className="text-sm text-muted-foreground text-center max-w-xs">
            Could not load your profile. Please check your connection and try again.
          </p>
          <button onClick={() => window.location.reload()} className="text-xs text-primary underline">
            Retry
          </button>
        </div>
      );
    }
    return <LoadingScreen />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
    return <Navigate to={getPortalPath(userRole)} replace />;
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
