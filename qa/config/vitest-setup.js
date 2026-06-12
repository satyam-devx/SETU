// config/vitest-setup.js — Global test setup for SETU unit/integration suite

import '@testing-library/jest-dom';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';

// ── MSW: intercept Supabase + Razorpay in tests ──────────────
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

export const MOCK_PROFILE = {
  id:         'test-user-uuid-0001',
  phone:      '+919876543210',
  name:       'Test Customer',
  role:       'customer',
  village_id: 'v1',
  is_verified: true,
  setu_score: 720,
};

export const MOCK_VENDOR = {
  id:          'test-vendor-uuid-0001',
  name:        'Sharma Kirana',
  name_hindi:  'शर्मा किराना',
  category:    'grocery',
  village_id:  'v1',
  rating:      4.5,
  review_count: 23,
  is_open:     true,
  is_approved: true,
};

export const MOCK_PRODUCT = {
  id:          'test-product-uuid-0001',
  name:        'Tata Salt',
  price:       25,
  stock:       50,
  vendor_id:   'test-vendor-uuid-0001',
  is_active:   true,
  category:    'grocery',
};

export const MOCK_ORDER = {
  id:              'test-order-uuid-0001',
  order_number:    'SETU-20240001',
  customer_id:     'test-user-uuid-0001',
  vendor_id:       'test-vendor-uuid-0001',
  status:          'pending',
  payment_status:  'pending',
  total_amount:    125,
  created_at:      '2024-01-01T10:00:00Z',
};

// ── Supabase REST API mock handlers ──────────────────────────
const SUPA_BASE = 'https://placeholder.supabase.co/rest/v1';
const SUPA_AUTH = 'https://placeholder.supabase.co/auth/v1';
const SUPA_FN   = 'https://placeholder.supabase.co/functions/v1';

const handlers = [
  // Auth — getUser
  http.get(`${SUPA_AUTH}/user`, () =>
    HttpResponse.json({ id: MOCK_PROFILE.id, phone: MOCK_PROFILE.phone })
  ),

  // Auth — getSession
  http.get(`${SUPA_AUTH}/session`, () =>
    HttpResponse.json({ access_token: 'mock-access-token', token_type: 'bearer' })
  ),

  // OTP send
  http.post(`${SUPA_AUTH}/otp`, () => HttpResponse.json({ message_id: 'mock-sms-001' })),

  // OTP verify
  http.post(`${SUPA_AUTH}/verify`, () =>
    HttpResponse.json({
      access_token: 'mock-token',
      user: { id: MOCK_PROFILE.id, phone: MOCK_PROFILE.phone },
    })
  ),

  // Profiles — own read
  http.get(`${SUPA_BASE}/profiles`, ({ request }) => {
    const url = new URL(request.url);
    if (url.searchParams.get('id') === `eq.${MOCK_PROFILE.id}`) {
      return HttpResponse.json([MOCK_PROFILE]);
    }
    return HttpResponse.json([]);
  }),

  // Profiles — update
  http.patch(`${SUPA_BASE}/profiles`, () => HttpResponse.json([MOCK_PROFILE])),

  // Villages
  http.get(`${SUPA_BASE}/villages`, () =>
    HttpResponse.json([{ id: 'v1', name: 'Madhepur', block: 'Madhepur', district: 'Madhubani', is_active: true }])
  ),

  // Vendors list
  http.get(`${SUPA_BASE}/vendors`, () => HttpResponse.json([MOCK_VENDOR])),

  // Products
  http.get(`${SUPA_BASE}/products`, () => HttpResponse.json([MOCK_PRODUCT])),

  // Orders — customer
  http.get(`${SUPA_BASE}/orders`, () => HttpResponse.json([MOCK_ORDER])),

  // Orders — place
  http.post(`${SUPA_BASE}/orders`, () => HttpResponse.json([{ ...MOCK_ORDER, id: 'new-order-uuid' }])),

  // Categories
  http.get(`${SUPA_BASE}/categories`, () =>
    HttpResponse.json([{ id: 'c1', name: 'Grocery', name_hindi: 'किराना', icon: '🛒', sort_order: 1 }])
  ),

  // Edge functions
  http.post(`${SUPA_FN}/ai-assistant`, () =>
    HttpResponse.json({ reply: 'Test reply', intent: 'chat', suggestedActions: ['Check orders'] })
  ),

  http.post(`${SUPA_FN}/create-razorpay-order`, () =>
    HttpResponse.json({ id: 'order_test123', amount: 12500, currency: 'INR' })
  ),

  // Wallet
  http.get(`${SUPA_BASE}/wallets`, () =>
    HttpResponse.json([{ id: 'w1', customer_id: MOCK_PROFILE.id, balance: 250 }])
  ),

  // Notifications
  http.get(`${SUPA_BASE}/notifications`, () => HttpResponse.json([])),
];

export const mswServer = setupServer(...handlers);

// ── Lifecycle ─────────────────────────────────────────────────
beforeAll(() => mswServer.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => mswServer.resetHandlers());
afterAll(() => mswServer.close());

// ── Global browser mocks ──────────────────────────────────────
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: vi.fn(key => store[key] ?? null),
    setItem: vi.fn((key, val) => { store[key] = String(val); }),
    removeItem: vi.fn(key => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
    get length() { return Object.keys(store).length; },
    key: vi.fn(i => Object.keys(store)[i] ?? null),
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// navigator.geolocation
global.navigator.geolocation = {
  getCurrentPosition: vi.fn((success) =>
    success({ coords: { latitude: 26.366, longitude: 86.083 } })
  ),
  watchPosition: vi.fn(() => 1),
  clearWatch: vi.fn(),
};

// IntersectionObserver (needed by some Radix components)
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// scrollTo
global.scrollTo = vi.fn();
window.scrollTo = vi.fn();

// Silence React act() warnings in tests
global.IS_REACT_ACT_ENVIRONMENT = true;
