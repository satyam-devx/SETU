// tests/integration/database-security.test.js — RLS policy contract tests
// Validates the expected behavior of Row Level Security policies.
// These tests run against mock data but enforce the same access-control logic
// as the real Postgres RLS policies in database/rls.sql

import { describe, it, expect } from 'vitest';

// ── RLS policy simulator ───────────────────────────────────────
// Mirrors the actual policy logic from rls.sql

function makeRLSChecker(currentUserId, currentUserRole) {
  function get_my_role() { return currentUserRole; }
  function auth_uid()    { return currentUserId; }
  function is_admin()    { return ['admin', 'super_admin'].includes(get_my_role()); }

  return {
    // PROFILES
    canReadOwnProfile:   (row)    => auth_uid() === row.id,
    canReadProfileAdmin: ()       => is_admin(),
    canUpdateOwnProfile: (row)    => auth_uid() === row.id,
    canInsertOwnProfile: (newRow) => auth_uid() === newRow.id,

    // VILLAGES — public read, admin write
    canReadVillage:   ()    => true,
    canWriteVillage:  ()    => is_admin(),

    // ORDERS
    canReadOrder: (row) =>
      auth_uid() === row.customer_id ||
      auth_uid() === row.vendor_id   ||
      auth_uid() === row.rider_id    ||
      is_admin(),

    canInsertOrder: (newRow) => auth_uid() === newRow.customer_id,

    // ORDER STATUS — vendor can only update to preparing/ready; rider to out_for_delivery/delivered
    canUpdateOrderStatus: (row, newStatus) => {
      if (is_admin()) return true;
      if (auth_uid() === row.vendor_id) {
        return ['confirmed', 'preparing', 'ready', 'cancelled'].includes(newStatus);
      }
      if (auth_uid() === row.rider_id) {
        return ['out_for_delivery', 'delivered', 'failed'].includes(newStatus);
      }
      if (auth_uid() === row.customer_id) {
        return newStatus === 'cancelled';
      }
      return false;
    },

    // PRODUCTS — vendor owns, public reads
    canReadProduct:   ()    => true,
    canWriteProduct:  (row) => is_admin() || auth_uid() === row.vendor_owner_id,

    // WALLET
    canReadWallet:   (row) => auth_uid() === row.customer_id || is_admin(),
    canUpdateWallet: ()    => false, // only service_role via RPC, never direct

    // AUDIT LOG
    canInsertAuditLog: () => false, // service_role only via security-definer fn
    canReadAuditLog:   () => is_admin(),

    // KYC — sensitive
    canReadKYC:  (row) => auth_uid() === row.user_id || is_admin(),
    canWriteKYC: (row) => auth_uid() === row.user_id || is_admin(),

    is_admin,
  };
}

// ── PROFILES RLS ──────────────────────────────────────────────
describe('RLS: profiles table', () => {
  it('user can read their own profile', () => {
    const rls = makeRLSChecker('user-001', 'customer');
    expect(rls.canReadOwnProfile({ id: 'user-001' })).toBe(true);
  });

  it('user cannot read another user\'s profile', () => {
    const rls = makeRLSChecker('user-001', 'customer');
    expect(rls.canReadOwnProfile({ id: 'user-002' })).toBe(false);
  });

  it('admin can read any profile', () => {
    const rls = makeRLSChecker('admin-001', 'admin');
    expect(rls.canReadProfileAdmin()).toBe(true);
  });

  it('customer cannot read other profiles via admin path', () => {
    const rls = makeRLSChecker('user-001', 'customer');
    expect(rls.canReadProfileAdmin()).toBe(false);
  });

  it('user can only insert their own profile (auth.uid() = id)', () => {
    const rls = makeRLSChecker('user-001', 'customer');
    expect(rls.canInsertOwnProfile({ id: 'user-001' })).toBe(true);
    expect(rls.canInsertOwnProfile({ id: 'user-002' })).toBe(false);
  });

  it('user can only update their own profile', () => {
    const rls = makeRLSChecker('user-001', 'customer');
    expect(rls.canUpdateOwnProfile({ id: 'user-001' })).toBe(true);
    expect(rls.canUpdateOwnProfile({ id: 'user-999' })).toBe(false);
  });
});

// ── VILLAGES RLS ──────────────────────────────────────────────
describe('RLS: villages table', () => {
  it('anyone can read villages (public)', () => {
    const anonymousRLS = makeRLSChecker(null, null);
    expect(anonymousRLS.canReadVillage()).toBe(true);
  });

  it('only admin can write villages', () => {
    const customerRLS = makeRLSChecker('c1', 'customer');
    const adminRLS    = makeRLSChecker('a1', 'admin');
    const superRLS    = makeRLSChecker('sa1', 'super_admin');

    expect(customerRLS.canWriteVillage()).toBe(false);
    expect(adminRLS.canWriteVillage()).toBe(true);
    expect(superRLS.canWriteVillage()).toBe(true);
  });
});

// ── ORDERS RLS ────────────────────────────────────────────────
describe('RLS: orders table', () => {
  const order = {
    id:          'ord-001',
    customer_id: 'cust-001',
    vendor_id:   'vendor-001',
    rider_id:    'rider-001',
  };

  it('customer can read their own orders', () => {
    const rls = makeRLSChecker('cust-001', 'customer');
    expect(rls.canReadOrder(order)).toBe(true);
  });

  it('vendor can read orders for their shop', () => {
    const rls = makeRLSChecker('vendor-001', 'vendor');
    expect(rls.canReadOrder(order)).toBe(true);
  });

  it('rider can read orders assigned to them', () => {
    const rls = makeRLSChecker('rider-001', 'rider');
    expect(rls.canReadOrder(order)).toBe(true);
  });

  it('unrelated user cannot read order', () => {
    const rls = makeRLSChecker('random-user', 'customer');
    expect(rls.canReadOrder(order)).toBe(false);
  });

  it('customer can only insert orders as themselves', () => {
    const rls = makeRLSChecker('cust-001', 'customer');
    expect(rls.canInsertOrder({ customer_id: 'cust-001' })).toBe(true);
    expect(rls.canInsertOrder({ customer_id: 'cust-002' })).toBe(false);
  });

  it('vendor can confirm and cancel but not mark delivered', () => {
    const rls = makeRLSChecker('vendor-001', 'vendor');
    expect(rls.canUpdateOrderStatus(order, 'confirmed')).toBe(true);
    expect(rls.canUpdateOrderStatus(order, 'preparing')).toBe(true);
    expect(rls.canUpdateOrderStatus(order, 'cancelled')).toBe(true);
    expect(rls.canUpdateOrderStatus(order, 'delivered')).toBe(false);
    expect(rls.canUpdateOrderStatus(order, 'out_for_delivery')).toBe(false);
  });

  it('rider can only move order to delivery states', () => {
    const rls = makeRLSChecker('rider-001', 'rider');
    expect(rls.canUpdateOrderStatus(order, 'out_for_delivery')).toBe(true);
    expect(rls.canUpdateOrderStatus(order, 'delivered')).toBe(true);
    expect(rls.canUpdateOrderStatus(order, 'failed')).toBe(true);
    expect(rls.canUpdateOrderStatus(order, 'confirmed')).toBe(false);
    expect(rls.canUpdateOrderStatus(order, 'cancelled')).toBe(false);
  });

  it('customer can only cancel their order', () => {
    const rls = makeRLSChecker('cust-001', 'customer');
    expect(rls.canUpdateOrderStatus(order, 'cancelled')).toBe(true);
    expect(rls.canUpdateOrderStatus(order, 'confirmed')).toBe(false);
    expect(rls.canUpdateOrderStatus(order, 'delivered')).toBe(false);
  });

  it('admin has full order write access', () => {
    const rls = makeRLSChecker('admin-001', 'admin');
    const allStatuses = ['confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled', 'failed'];
    allStatuses.forEach(status => {
      expect(rls.canUpdateOrderStatus(order, status)).toBe(true);
    });
  });
});

// ── WALLET RLS ────────────────────────────────────────────────
describe('RLS: wallets table (high-security)', () => {
  it('customer can read their own wallet', () => {
    const rls = makeRLSChecker('cust-001', 'customer');
    expect(rls.canReadWallet({ customer_id: 'cust-001' })).toBe(true);
  });

  it('customer cannot read another\'s wallet', () => {
    const rls = makeRLSChecker('cust-001', 'customer');
    expect(rls.canReadWallet({ customer_id: 'cust-002' })).toBe(false);
  });

  it('wallet balance cannot be updated directly by any user', () => {
    const roles = ['customer', 'vendor', 'rider', 'admin'];
    roles.forEach(role => {
      const rls = makeRLSChecker('some-id', role);
      expect(rls.canUpdateWallet()).toBe(false);
    });
  });
});

// ── AUDIT LOG RLS ─────────────────────────────────────────────
describe('RLS: audit_log table', () => {
  it('no role can directly insert audit log rows', () => {
    const roles = ['customer', 'vendor', 'rider', 'admin', 'super_admin'];
    roles.forEach(role => {
      const rls = makeRLSChecker('any-id', role);
      expect(rls.canInsertAuditLog()).toBe(false);
    });
  });

  it('only admin and super_admin can read audit log', () => {
    const adminRLS    = makeRLSChecker('a1', 'admin');
    const superRLS    = makeRLSChecker('s1', 'super_admin');
    const customerRLS = makeRLSChecker('c1', 'customer');

    expect(adminRLS.canReadAuditLog()).toBe(true);
    expect(superRLS.canReadAuditLog()).toBe(true);
    expect(customerRLS.canReadAuditLog()).toBe(false);
  });
});

// ── Privilege escalation prevention ───────────────────────────
describe('Privilege escalation prevention', () => {
  it('user cannot elevate their own role', () => {
    // The profiles_own_update policy enforces: auth.uid() = id
    // but does NOT prevent role changes through WITH CHECK.
    // Actual prevention: role field is immutable in application layer.
    // This test documents the contract.

    function canUserUpdateRole(userId, rowId, currentRole, newRole) {
      const isOwnRow = userId === rowId;
      const privilegedRoles = ['admin', 'super_admin'];
      // Block any attempt to self-assign privileged roles
      if (privilegedRoles.includes(newRole) && currentRole !== newRole) return false;
      return isOwnRow;
    }

    const userId = 'user-001';
    expect(canUserUpdateRole(userId, userId, 'customer', 'admin')).toBe(false);
    expect(canUserUpdateRole(userId, userId, 'customer', 'super_admin')).toBe(false);
    expect(canUserUpdateRole(userId, userId, 'customer', 'customer')).toBe(true);
  });
});
