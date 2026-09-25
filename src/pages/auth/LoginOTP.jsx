import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { getAuthRoleIntent } from '@/lib/authIntent';

// Compatibility entry point. Authentication now lives in the premium
// bottom-sheet on RoleSelect; keeping /login preserves deep links and
// onboarding redirects without maintaining a second auth UI.
export default function LoginOTP() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isProfileLoaded, isLoading, portalPath } = useAuth();

  useEffect(() => {
    if (!isLoading && isAuthenticated && isProfileLoaded && portalPath && portalPath !== '/') {
      navigate(portalPath, { replace: true });
      return;
    }

    if (!isLoading && (!isAuthenticated || !isProfileLoaded)) {
      navigate('/', {
        replace: true,
        state: {
          openAuth: true,
          role: getAuthRoleIntent() || 'customer',
        },
      });
    }
  }, [isLoading, isAuthenticated, isProfileLoaded, portalPath, navigate, location.key]);

  return (
    <div className="min-h-screen bg-background" aria-busy="true">
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    </div>
  );
}
