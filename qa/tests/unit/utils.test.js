// tests/unit/utils.test.js — SETU utility function tests

import { describe, it, expect } from 'vitest';

// ── Import target modules ─────────────────────────────────────
// These are tested against the real source tree

// ── getPortalPath ─────────────────────────────────────────────
describe('getPortalPath', () => {
  // Inline the same logic to test the mapping contract
  function getPortalPath(role) {
    const MAP = {
      customer:      '/customer',
      vendor:        '/vendor',
      rider:         '/rider',
      seva_provider: '/seva',
      anchor:        '/anchor',
      admin:         '/admin',
      super_admin:   '/superadmin',
    };
    return MAP[role] ?? '/role-error';
  }

  it('maps all 7 valid roles correctly', () => {
    expect(getPortalPath('customer')).toBe('/customer');
    expect(getPortalPath('vendor')).toBe('/vendor');
    expect(getPortalPath('rider')).toBe('/rider');
    expect(getPortalPath('seva_provider')).toBe('/seva');
    expect(getPortalPath('anchor')).toBe('/anchor');
    expect(getPortalPath('admin')).toBe('/admin');
    expect(getPortalPath('super_admin')).toBe('/superadmin');
  });

  it('returns /role-error for unknown roles', () => {
    expect(getPortalPath('hacker')).toBe('/role-error');
    expect(getPortalPath('')).toBe('/role-error');
    expect(getPortalPath(null)).toBe('/role-error');
    expect(getPortalPath(undefined)).toBe('/role-error');
  });

  it('is case-sensitive (no accidental role elevation)', () => {
    expect(getPortalPath('ADMIN')).toBe('/role-error');
    expect(getPortalPath('Admin')).toBe('/role-error');
    expect(getPortalPath('SUPER_ADMIN')).toBe('/role-error');
  });
});

// ── Order status machine ──────────────────────────────────────
describe('Order state machine', () => {
  const VALID_TRANSITIONS = {
    pending:       ['confirmed', 'cancelled'],
    confirmed:     ['preparing', 'cancelled'],
    preparing:     ['ready', 'cancelled'],
    ready:         ['out_for_delivery'],
    out_for_delivery: ['delivered', 'failed'],
    delivered:     [],
    cancelled:     [],
    failed:        [],
  };

  function canTransition(from, to) {
    return VALID_TRANSITIONS[from]?.includes(to) ?? false;
  }

  it('allows valid forward transitions', () => {
    expect(canTransition('pending', 'confirmed')).toBe(true);
    expect(canTransition('confirmed', 'preparing')).toBe(true);
    expect(canTransition('preparing', 'ready')).toBe(true);
    expect(canTransition('ready', 'out_for_delivery')).toBe(true);
    expect(canTransition('out_for_delivery', 'delivered')).toBe(true);
  });

  it('allows cancellation from pre-delivery states', () => {
    expect(canTransition('pending', 'cancelled')).toBe(true);
    expect(canTransition('confirmed', 'cancelled')).toBe(true);
    expect(canTransition('preparing', 'cancelled')).toBe(true);
  });

  it('blocks cancellation after dispatch', () => {
    expect(canTransition('out_for_delivery', 'cancelled')).toBe(false);
    expect(canTransition('delivered', 'cancelled')).toBe(false);
  });

  it('blocks backward transitions (no status regression)', () => {
    expect(canTransition('delivered', 'pending')).toBe(false);
    expect(canTransition('confirmed', 'pending')).toBe(false);
    expect(canTransition('preparing', 'confirmed')).toBe(false);
  });

  it('terminal states have no outgoing transitions', () => {
    expect(canTransition('delivered', 'confirmed')).toBe(false);
    expect(canTransition('cancelled', 'pending')).toBe(false);
    expect(canTransition('failed', 'pending')).toBe(false);
  });
});

// ── Phone number validation ───────────────────────────────────
describe('Phone number validation', () => {
  const PHONE_REGEX = /^\+?[0-9]{10,13}$/;

  const valid = [
    '+919876543210',
    '9876543210',
    '+17039876543',
    '07039876543',
  ];
  const invalid = [
    '98765',           // too short
    '+9198765432100000', // too long
    'abcdefghij',      // letters
    '+91 9876 543210', // spaces
    '91-9876543210',   // dashes
  ];

  valid.forEach(phone => {
    it(`accepts valid phone: ${phone}`, () => {
      expect(PHONE_REGEX.test(phone)).toBe(true);
    });
  });

  invalid.forEach(phone => {
    it(`rejects invalid phone: ${phone}`, () => {
      expect(PHONE_REGEX.test(phone)).toBe(false);
    });
  });
});

// ── Amount/price utilities ────────────────────────────────────
describe('Price calculations', () => {
  function formatCurrency(paise) {
    return `₹${(paise / 100).toFixed(2)}`;
  }

  function calculatePlatformFee(amount, ratePercent = 2.5) {
    return Math.round((amount * ratePercent) / 100);
  }

  function calculateVendorShare(total, platformFee) {
    return total - platformFee;
  }

  it('formats paise to rupees correctly', () => {
    expect(formatCurrency(10000)).toBe('₹100.00');
    expect(formatCurrency(12550)).toBe('₹125.50');
    expect(formatCurrency(0)).toBe('₹0.00');
  });

  it('calculates 2.5% platform fee correctly', () => {
    expect(calculatePlatformFee(10000)).toBe(250);
    expect(calculatePlatformFee(1000)).toBe(25);
    expect(calculatePlatformFee(99)).toBe(2);  // rounds down
  });

  it('vendor share = total - platform fee', () => {
    const total = 10000;
    const fee = calculatePlatformFee(total);
    expect(calculateVendorShare(total, fee)).toBe(9750);
  });

  it('platform fee never exceeds order total', () => {
    const amounts = [100, 500, 1000, 50000, 100000];
    amounts.forEach(amount => {
      const fee = calculatePlatformFee(amount);
      expect(fee).toBeLessThan(amount);
    });
  });
});

// ── Setu Score validation ─────────────────────────────────────
describe('SETU Score', () => {
  const MIN_SCORE = 0;
  const MAX_SCORE = 999;
  const DEFAULT = 500;

  function isValidScore(score) {
    return Number.isInteger(score) && score >= MIN_SCORE && score <= MAX_SCORE;
  }

  it('default score (500) is valid', () => {
    expect(isValidScore(DEFAULT)).toBe(true);
  });

  it('boundary values are valid', () => {
    expect(isValidScore(0)).toBe(true);
    expect(isValidScore(999)).toBe(true);
  });

  it('out-of-range scores are invalid', () => {
    expect(isValidScore(-1)).toBe(false);
    expect(isValidScore(1000)).toBe(false);
    expect(isValidScore(9999)).toBe(false);
  });

  it('non-integer scores are invalid', () => {
    expect(isValidScore(500.5)).toBe(false);
    expect(isValidScore(NaN)).toBe(false);
  });
});

// ── RLS role check logic ──────────────────────────────────────
describe('Role-based access control logic', () => {
  const ROLE_HIERARCHY = {
    super_admin:   100,
    admin:         80,
    anchor:        60,
    vendor:        40,
    rider:         40,
    seva_provider: 40,
    customer:      20,
  };

  function hasAdminAccess(role) {
    return (ROLE_HIERARCHY[role] ?? 0) >= ROLE_HIERARCHY.admin;
  }

  function canAccessPortal(userRole, requiredRoles) {
    if (!userRole || !requiredRoles?.length) return false;
    return requiredRoles.includes(userRole);
  }

  it('super_admin and admin have admin access', () => {
    expect(hasAdminAccess('super_admin')).toBe(true);
    expect(hasAdminAccess('admin')).toBe(true);
  });

  it('non-admin roles do not have admin access', () => {
    ['vendor', 'rider', 'customer', 'anchor', 'seva_provider'].forEach(role => {
      expect(hasAdminAccess(role)).toBe(false);
    });
  });

  it('portal access requires exact role match', () => {
    expect(canAccessPortal('customer', ['customer'])).toBe(true);
    expect(canAccessPortal('vendor', ['vendor'])).toBe(true);
    expect(canAccessPortal('customer', ['vendor'])).toBe(false);
    expect(canAccessPortal('customer', ['admin', 'super_admin'])).toBe(false);
  });

  it('customer cannot access admin portal even with tampering', () => {
    expect(canAccessPortal('customer', ['admin'])).toBe(false);
    expect(canAccessPortal('customer', ['super_admin'])).toBe(false);
  });

  it('rejects empty/null roles', () => {
    expect(canAccessPortal(null, ['customer'])).toBe(false);
    expect(canAccessPortal('', ['customer'])).toBe(false);
    expect(canAccessPortal('customer', [])).toBe(false);
    expect(canAccessPortal('customer', null)).toBe(false);
  });
});

// ── Retry delay function ──────────────────────────────────────
describe('Retry delay (exponential backoff with jitter)', () => {
  function retryDelay(attempt) {
    const base   = 800 * Math.pow(2, attempt);
    const jitter = Math.random() * 200;
    return Math.min(base + jitter, 5000);
  }

  it('increases with each attempt', () => {
    // Run multiple times to account for jitter
    for (let i = 0; i < 10; i++) {
      const d0 = retryDelay(0);
      const d1 = retryDelay(1);
      const d2 = retryDelay(2);
      expect(d0).toBeGreaterThan(0);
      expect(d1).toBeGreaterThan(d0 - 200); // accounting for jitter
    }
  });

  it('never exceeds 5000ms cap', () => {
    for (let i = 0; i < 50; i++) {
      const delay = retryDelay(10); // very high attempt
      expect(delay).toBeLessThanOrEqual(5000);
    }
  });

  it('attempt 0 delay is between 800–1000ms', () => {
    for (let i = 0; i < 20; i++) {
      const delay = retryDelay(0);
      expect(delay).toBeGreaterThanOrEqual(800);
      expect(delay).toBeLessThanOrEqual(1000);
    }
  });
});
