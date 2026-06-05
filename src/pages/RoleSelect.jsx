import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';

export default function RoleSelect() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, portalPath } = useAuth();

  // If already authenticated, redirect to their portal immediately
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate(portalPath, { replace: true });
    }
  }, [isAuthenticated, isLoading, portalPath, navigate]);

  // Show spinner while auth state resolves on page refresh
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

  // Not authenticated — show welcome screen
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/30 flex flex-col items-center justify-center p-6">

      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: -24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-10"
      >
        <h1 className="font-heading text-6xl md:text-7xl font-bold text-foreground tracking-tight">
          SETU
        </h1>
        <p className="text-muted-foreground mt-2 text-base font-light">
          Rural Commerce Operating System
        </p>
        <p className="text-muted-foreground/60 text-sm mt-1">
          Madhepur · Madhubani · Bihar · मिथिला
        </p>
      </motion.div>

      {/* Welcome card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.45 }}
        className="w-full max-w-sm"
      >
        <div className="bg-card border border-border rounded-3xl p-8 shadow-xl text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <span className="text-3xl">🏘️</span>
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">
            गाँव की दुकान, अब डिजिटल
          </h2>
          <p className="text-sm text-muted-foreground mb-1">
            Your village. Your commerce. Your platform.
          </p>
          <p className="text-xs text-muted-foreground/60 mb-7">
            Shop, sell, deliver and grow — all in one place.
          </p>

          {/* Primary CTA */}
          <Link to="/login">
            <Button className="w-full h-12 text-base font-semibold gap-2 rounded-2xl">
              Login / Register
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>

          <p className="text-xs text-muted-foreground mt-4">
            We'll send a one-time password to your mobile number.
            No passwords to remember.
          </p>
        </div>
      </motion.div>

      {/* Onboarding links */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="mt-8 flex flex-wrap justify-center gap-5"
      >
        {[
          { label: 'Become a Vendor →',         path: '/onboarding/vendor', color: 'text-accent'   },
          { label: 'Become a Rider →',           path: '/onboarding/rider',  color: 'text-chart-3'  },
          { label: 'Register as Seva Provider →', path: '/onboarding/seva',   color: 'text-chart-4'  },
        ].map(link => (
          <Link
            key={link.path}
            to={link.path}
            className={`text-xs font-medium ${link.color} hover:underline`}
          >
            {link.label}
          </Link>
        ))}
      </motion.div>

      {/* Demo mode notice */}
      {!import.meta.env.VITE_SUPABASE_URL && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-6 w-full max-w-sm"
        >
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-center">
            <p className="text-xs text-amber-800 font-medium mb-0.5">Demo Mode Active</p>
            <p className="text-xs text-amber-700">
              Use any 10-digit number and OTP <strong>1234</strong> to explore.
            </p>
          </div>
        </motion.div>
      )}

      <p className="text-muted-foreground/40 text-xs mt-8">
        SETU Technical Constitution · v1.0 · बिहार में बना
      </p>
    </div>
  );
}
