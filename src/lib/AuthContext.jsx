// AuthContext.jsx — Stub implementation
// Real implementation will use Supabase Auth when backend is integrated
import React, { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // Stub: no auth required in current prototype phase
  const [isLoadingAuth] = useState(false);
  const [isLoadingPublicSettings] = useState(false);
  const [authError] = useState(null);

  const navigateToLogin = () => {
    window.location.href = '/';
  };

  const signOut = () => {
    window.location.href = '/';
  };

  return (
    <AuthContext.Provider value={{
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      navigateToLogin,
      signOut,
      user: null,
      session: null,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
