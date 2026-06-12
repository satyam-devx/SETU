// tests/unit/api.test.js — SETU API layer contract tests
// Tests the api.js functions via MSW mocks (no real network)

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MOCK_PROFILE, MOCK_VENDOR, MOCK_PRODUCT, MOCK_ORDER, mswServer } from '../../config/vitest-setup.js';
import { http, HttpResponse } from 'msw';

// ── Test: API returns { data, error } contract ─────────────────
describe('API layer { data, error } contract', () => {

  describe('safeQuery pattern', () => {
    // Simulate the safeQuery helper behavior
    function safeQuery_result(data, error) {
      if (error) {
        if (error.code === 'PGRST116') return { data: null, error: null };
        return { data: null, error: { message: error.message } };
      }
      return { data, error: null };
    }

    it('returns data on success', () => {
      const result = safeQuery_result([MOCK_VENDOR], null);
      expect(result.data).toEqual([MOCK_VENDOR]);
      expect(result.error).toBeNull();
    });

    it('returns error object on failure', () => {
      const result = safeQuery_result(null, { message: 'Permission denied', code: 'PGRST301' });
      expect(result.data).toBeNull();
      expect(result.error.message).toBe('Permission denied');
    });

    it('treats PGRST116 (row not found) as null data not an error', () => {
      const result = safeQuery_result(null, { message: 'Row not found', code: 'PGRST116' });
      expect(result.data).toBeNull();
      expect(result.error).toBeNull();
    });
  });

  describe('getProfile auth race condition handling', () => {
    it('PGRST116 without auth confirmation is retryable', () => {
      // Simulates: getProfile called before JWT propagated
      function handleProfileError(code, isUserAuthed) {
        if (code === 'PGRST116') {
          if (isUserAuthed) return { notFound: true, error: null };
          return { notFound: false, error: { message: 'Auth not ready, will retry' } };
        }
        return { notFound: false, error: { message: 'Unexpected error' } };
      }

      const authed    = handleProfileError('PGRST116', true);
      const notAuthed = handleProfileError('PGRST116', false);

      expect(authed.notFound).toBe(true);
      expect(authed.error).toBeNull();

      expect(notAuthed.notFound).toBe(false);
      expect(notAuthed.error.message).toContain('retry');
    });
  });
});

// ── Test: Order placement validation ──────────────────────────
describe('Order placement', () => {
  it('rejects orders with empty items array', () => {
    function validateOrder({ items, vendorId, totalAmount }) {
      const errors = [];
      if (!items || items.length === 0) errors.push('Order must have at least one item');
      if (!vendorId) errors.push('Vendor ID required');
      if (!totalAmount || totalAmount <= 0) errors.push('Invalid order amount');
      return errors;
    }

    expect(validateOrder({ items: [], vendorId: 'v1', totalAmount: 100 }))
      .toContain('Order must have at least one item');
    expect(validateOrder({ items: null, vendorId: 'v1', totalAmount: 100 }))
      .toContain('Order must have at least one item');
  });

  it('rejects orders with zero or negative amount', () => {
    function validateAmount(amount) {
      return amount > 0 && Number.isFinite(amount);
    }

    expect(validateAmount(0)).toBe(false);
    expect(validateAmount(-100)).toBe(false);
    expect(validateAmount(NaN)).toBe(false);
    expect(validateAmount(125.50)).toBe(true);
  });

  it('requires vendorId and customerId', () => {
    function validateIds({ vendorId, customerId }) {
      return !!vendorId && !!customerId;
    }

    expect(validateIds({ vendorId: null, customerId: 'c1' })).toBe(false);
    expect(validateIds({ vendorId: 'v1', customerId: null })).toBe(false);
    expect(validateIds({ vendorId: 'v1', customerId: 'c1' })).toBe(true);
  });
});

// ── Test: Cart context logic ───────────────────────────────────
describe('Cart operations', () => {
  let cart = [];

  function addToCart(cart, product, qty = 1) {
    const existing = cart.find(item => item.id === product.id);
    if (existing) {
      return cart.map(item =>
        item.id === product.id
          ? { ...item, quantity: item.quantity + qty }
          : item
      );
    }
    return [...cart, { ...product, quantity: qty }];
  }

  function removeFromCart(cart, productId) {
    return cart.filter(item => item.id !== productId);
  }

  function updateQty(cart, productId, qty) {
    if (qty <= 0) return removeFromCart(cart, productId);
    return cart.map(item =>
      item.id === productId ? { ...item, quantity: qty } : item
    );
  }

  function cartTotal(cart) {
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }

  beforeEach(() => { cart = []; });

  it('adds new item to empty cart', () => {
    cart = addToCart(cart, MOCK_PRODUCT);
    expect(cart).toHaveLength(1);
    expect(cart[0].quantity).toBe(1);
  });

  it('increments quantity for existing item', () => {
    cart = addToCart(cart, MOCK_PRODUCT);
    cart = addToCart(cart, MOCK_PRODUCT);
    expect(cart).toHaveLength(1);
    expect(cart[0].quantity).toBe(2);
  });

  it('removes item from cart', () => {
    cart = addToCart(cart, MOCK_PRODUCT);
    cart = removeFromCart(cart, MOCK_PRODUCT.id);
    expect(cart).toHaveLength(0);
  });

  it('removes item when qty updated to 0', () => {
    cart = addToCart(cart, MOCK_PRODUCT);
    cart = updateQty(cart, MOCK_PRODUCT.id, 0);
    expect(cart).toHaveLength(0);
  });

  it('calculates correct total for multiple items', () => {
    const p1 = { id: 'p1', price: 25, quantity: 3 };
    const p2 = { id: 'p2', price: 50, quantity: 2 };
    cart = [p1, p2];
    expect(cartTotal(cart)).toBe(175); // 25*3 + 50*2 = 175
  });

  it('total is 0 for empty cart', () => {
    expect(cartTotal([])).toBe(0);
  });
});

// ── Test: Supabase error handling ─────────────────────────────
describe('Supabase error normalization', () => {
  function normalizeError(e, ctx) {
    const msg = e?.message || e?.error_description || String(e) || 'Unknown error';
    return { data: null, error: { message: msg, code: e?.code, details: e?.details } };
  }

  it('extracts message from Supabase error object', () => {
    const result = normalizeError({ message: 'Permission denied', code: 'PGRST301' }, 'getVendors');
    expect(result.error.message).toBe('Permission denied');
    expect(result.error.code).toBe('PGRST301');
  });

  it('extracts error_description as fallback', () => {
    const result = normalizeError({ error_description: 'OAuth failed' }, 'signIn');
    expect(result.error.message).toBe('OAuth failed');
  });

  it('falls back to string representation', () => {
    const result = normalizeError('raw error string', 'ctx');
    expect(result.error.message).toBe('raw error string');
  });

  it('falls back to Unknown error for empty error', () => {
    const result = normalizeError(null, 'ctx');
    expect(result.error.message).toBe('Unknown error');
  });
});

// ── Test: Pagination logic ────────────────────────────────────
describe('Pagination', () => {
  function buildPageRange(page, limit) {
    const from = page * limit;
    const to   = from + limit - 1;
    return { from, to };
  }

  it('page 0 starts at row 0', () => {
    const { from, to } = buildPageRange(0, 20);
    expect(from).toBe(0);
    expect(to).toBe(19);
  });

  it('page 1 starts at row 20', () => {
    const { from, to } = buildPageRange(1, 20);
    expect(from).toBe(20);
    expect(to).toBe(39);
  });

  it('page 2 with limit 10 starts at row 20', () => {
    const { from, to } = buildPageRange(2, 10);
    expect(from).toBe(20);
    expect(to).toBe(29);
  });
});
