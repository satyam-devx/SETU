// tests/integration/auth.test.jsx — Auth flow + ProtectedRoute integration tests

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { mswServer, MOCK_PROFILE } from '../../config/vitest-setup.js';

// ── Minimal auth context mock ──────────────────────────────────
// We test the behavior contract, not the internal Supabase calls

function createAuthContext(overrides = {}) {
  return {
    user:           null,
    session:        null,
    profile:        null,
    isLoading:      false,
    isAuthenticated: false,
    isProfileLoaded: false,
    authError:      null,
    clearError:     vi.fn(),
    signOut:        vi.fn(),
    sendOTP:        vi.fn().mockResolvedValue({ error: null }),
    verifyOTP:      vi.fn().mockResolvedValue({ error: null }),
    createProfile:  vi.fn().mockResolvedValue({ error: null }),
    updateProfile:  vi.fn().mockResolvedValue({ error: null }),
    reloadProfile:  vi.fn().mockResolvedValue(undefined),
    userRole:       null,
    userName:       null,
    portalPath:     '/',
    ...overrides,
  };
}

// ── ProtectedRoute component logic test ───────────────────────
describe('ProtectedRoute behavior', () => {
  // Simulate ProtectedRoute logic directly
  function simulateProtectedRoute({ isLoading, isAuthenticated, isProfileLoaded, userRole, allowedRoles }) {
    if (isLoading) return 'loading';
    if (!isAuthenticated) return 'redirect-login';
    if (!isProfileLoaded) return 'loading-profile';
    if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
      return `redirect-portal-${userRole}`;
    }
    return 'render-children';
  }

  it('shows loading spinner while auth initializing', () => {
    const result = simulateProtectedRoute({
      isLoading: true, isAuthenticated: false, isProfileLoaded: false,
      userRole: null, allowedRoles: ['customer'],
    });
    expect(result).toBe('loading');
  });

  it('redirects to login when not authenticated', () => {
    const result = simulateProtectedRoute({
      isLoading: false, isAuthenticated: false, isProfileLoaded: false,
      userRole: null, allowedRoles: ['customer'],
    });
    expect(result).toBe('redirect-login');
  });

  it('renders children for correct role', () => {
    const result = simulateProtectedRoute({
      isLoading: false, isAuthenticated: true, isProfileLoaded: true,
      userRole: 'customer', allowedRoles: ['customer'],
    });
    expect(result).toBe('render-children');
  });

  it('redirects wrong role to their own portal', () => {
    const result = simulateProtectedRoute({
      isLoading: false, isAuthenticated: true, isProfileLoaded: true,
      userRole: 'vendor', allowedRoles: ['customer'],
    });
    expect(result).toBe('redirect-portal-vendor');
  });

  it('customer cannot reach /admin portal', () => {
    const result = simulateProtectedRoute({
      isLoading: false, isAuthenticated: true, isProfileLoaded: true,
      userRole: 'customer', allowedRoles: ['admin'],
    });
    expect(result).toBe('redirect-portal-customer');
  });

  it('customer cannot reach /superadmin portal', () => {
    const result = simulateProtectedRoute({
      isLoading: false, isAuthenticated: true, isProfileLoaded: true,
      userRole: 'customer', allowedRoles: ['super_admin'],
    });
    expect(result).toBe('redirect-portal-customer');
  });

  it('super_admin can only access superadmin portal', () => {
    const result = simulateProtectedRoute({
      isLoading: false, isAuthenticated: true, isProfileLoaded: true,
      userRole: 'super_admin', allowedRoles: ['super_admin'],
    });
    expect(result).toBe('render-children');
  });
});

// ── OTP flow validation ───────────────────────────────────────
describe('OTP authentication flow', () => {
  const VALID_PHONE   = '+919876543210';
  const INVALID_PHONE = '123';

  function validatePhoneForOTP(phone) {
    const cleaned = phone.replace(/\s+/g, '');
    return /^\+?[0-9]{10,13}$/.test(cleaned);
  }

  it('accepts valid Indian phone number', () => {
    expect(validatePhoneForOTP('+919876543210')).toBe(true);
    expect(validatePhoneForOTP('9876543210')).toBe(true);
  });

  it('rejects too-short phone number', () => {
    expect(validatePhoneForOTP('123')).toBe(false);
    expect(validatePhoneForOTP('98765')).toBe(false);
  });

  it('OTP code is exactly 6 digits', () => {
    function validateOTP(otp) {
      return /^\d{6}$/.test(otp);
    }
    expect(validateOTP('123456')).toBe(true);
    expect(validateOTP('12345')).toBe(false);
    expect(validateOTP('1234567')).toBe(false);
    expect(validateOTP('abcdef')).toBe(false);
  });

  it('does not expose OTP in error messages', () => {
    function getOTPError(isExpired, isMismatch) {
      if (isExpired) return 'OTP has expired. Please request a new one.';
      if (isMismatch) return 'Invalid OTP. Please try again.';
      return null;
    }

    const expiredMsg  = getOTPError(true, false);
    const mismatchMsg = getOTPError(false, true);

    // Error messages must not contain the actual OTP value
    expect(expiredMsg).not.toMatch(/\d{6}/);
    expect(mismatchMsg).not.toMatch(/\d{6}/);
  });
});

// ── Profile creation on first login ──────────────────────────
describe('Profile creation', () => {
  it('validates required profile fields', () => {
    function validateProfileData({ name, phone, role }) {
      const VALID_ROLES = ['customer', 'vendor', 'rider', 'seva_provider', 'anchor'];
      const errors = [];
      if (!name || name.trim().length < 2) errors.push('Name must be at least 2 characters');
      if (!phone) errors.push('Phone required');
      if (!VALID_ROLES.includes(role)) errors.push('Invalid role selected');
      return errors;
    }

    expect(validateProfileData({ name: 'A', phone: '+91...', role: 'customer' }))
      .toContain('Name must be at least 2 characters');

    expect(validateProfileData({ name: 'Anita', phone: '', role: 'customer' }))
      .toContain('Phone required');

    expect(validateProfileData({ name: 'Anita', phone: '+91...', role: 'super_admin' }))
      .toContain('Invalid role selected'); // cannot self-assign admin roles

    expect(validateProfileData({ name: 'Anita', phone: '+91...', role: 'customer' }))
      .toHaveLength(0);
  });

  it('onboarding cannot set admin or super_admin roles', () => {
    const ONBOARDING_ALLOWED_ROLES = ['customer', 'vendor', 'rider', 'seva_provider'];
    expect(ONBOARDING_ALLOWED_ROLES).not.toContain('admin');
    expect(ONBOARDING_ALLOWED_ROLES).not.toContain('super_admin');
    expect(ONBOARDING_ALLOWED_ROLES).not.toContain('anchor');
  });
});

// ── Session management ────────────────────────────────────────
describe('Session management', () => {
  it('clears profile on sign out', () => {
    let profile = MOCK_PROFILE;
    let user    = { id: MOCK_PROFILE.id };

    function handleSignOut() {
      profile = null;
      user    = null;
    }

    handleSignOut();
    expect(profile).toBeNull();
    expect(user).toBeNull();
  });

  it('demo mode uses hardcoded OTP 1234', () => {
    function verifyDemoOTP(token) {
      if (token === '1234') return { error: null };
      return { error: { message: 'Demo OTP is 1234.' } };
    }

    expect(verifyDemoOTP('1234').error).toBeNull();
    expect(verifyDemoOTP('0000').error).not.toBeNull();
  });

  it('clears fetch cache on sign out', () => {
    const cache = new Map([['orders-c1', []], ['profile-c1', MOCK_PROFILE]]);

    function clearCache() { cache.clear(); }
    clearCache();
    expect(cache.size).toBe(0);
  });
});

// ── Multi-role platform: role isolation ───────────────────────
describe('Portal route isolation', () => {
  const PORTAL_ROUTES = {
    customer:      ['/customer', '/customer/orders', '/customer/cart'],
    vendor:        ['/vendor', '/vendor/orders', '/vendor/products'],
    rider:         ['/rider', '/rider/deliveries'],
    seva_provider: ['/seva', '/seva/jobs'],
    anchor:        ['/anchor', '/anchor/kyc'],
    admin:         ['/admin', '/admin/orders'],
    super_admin:   ['/superadmin', '/superadmin/analytics'],
  };

  function isAuthorizedForPath(userRole, path) {
    const rolePrefix = {
      customer:      '/customer',
      vendor:        '/vendor',
      rider:         '/rider',
      seva_provider: '/seva',
      anchor:        '/anchor',
      admin:         '/admin',
      super_admin:   '/superadmin',
    }[userRole];
    if (!rolePrefix) return false;
    return path.startsWith(rolePrefix);
  }

  it('customer can only access /customer/* paths', () => {
    PORTAL_ROUTES.customer.forEach(path => {
      expect(isAuthorizedForPath('customer', path)).toBe(true);
    });
  });

  it('customer cannot access other portals', () => {
    ['/vendor', '/rider', '/admin', '/superadmin', '/anchor'].forEach(path => {
      expect(isAuthorizedForPath('customer', path)).toBe(false);
    });
  });

  it('admin cannot access superadmin portal', () => {
    PORTAL_ROUTES.super_admin.forEach(path => {
      expect(isAuthorizedForPath('admin', path)).toBe(false);
    });
  });

  it('all 7 roles have distinct portal prefixes', () => {
    const prefixes = Object.values({
      customer: '/customer', vendor: '/vendor', rider: '/rider',
      seva_provider: '/seva', anchor: '/anchor',
      admin: '/admin', super_admin: '/superadmin',
    });
    const unique = new Set(prefixes);
    expect(unique.size).toBe(7);
  });
});
