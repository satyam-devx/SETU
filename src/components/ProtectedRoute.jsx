import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { getPortalPath } from '@/lib/supabase';

/**
 * ProtectedRoute — guards portals by auth state and role.
 *
 * Props:
 *   children      — the route content
 *   allowedRoles  — array of role strings that may access this route
 *                   e.g. ['customer'], ['admin','super_admin']
 *   redirectTo    — override redirect path (default: /login)
 */
export default function ProtectedRoute({ children, allowedRoles = [], redirectTo = '/login' }) {
  const { isAuthenticated, isLoading, userRole } = useAuth();
  const location = useLocation();

  // Still determining auth state — show spinner
  if (isLoading) {
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

  // Not logged in — redirect to login, preserving intended destination
  if (!isAuthenticated) {
    return <Navigate to={redirectTo} state={{ from: location.pathname }} replace />;
  }

  // Logged in but wrong role — redirect to their correct portal
  if (allowedRoles.length > 0 && userRole && !allowedRoles.includes(userRole)) {
    const correctPortal = getPortalPath(userRole);
    return <Navigate to={correctPortal} replace />;
  }

  return children;
}
