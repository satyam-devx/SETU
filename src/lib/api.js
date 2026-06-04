// ═══════════════════════════════════════════════════════════
// SETU API SERVICE LAYER
// Phase 1: Mock API with realistic async delay + error simulation
// Phase 2: Replace with Supabase calls (same interface contract)
// All functions return Promise<{ data, error }>
// ═══════════════════════════════════════════════════════════

const SIMULATED_DELAY_MS = 400;
const ERROR_RATE = 0; // 0 = no random errors in prototype

function apiResponse(data, delay = SIMULATED_DELAY_MS) {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (Math.random() < ERROR_RATE) {
        resolve({ data: null, error: { message: 'Network error. Please try again.' } });
      } else {
        resolve({ data, error: null });
      }
    }, delay);
  });
}

// ── AUTH ──────────────────────────────────────────────────
export const AuthAPI = {
  sendOTP: (phone) => apiResponse({ sent: true, phone }, 600),
  verifyOTP: (phone, otp) => {
    // In prototype, accept any 4-digit OTP
    if (otp.length === 4) {
      return apiResponse({
        user: { id: 'u1', phone, name: 'SETU User', role: 'customer' },
        token: 'mock-jwt-token',
      }, 800);
    }
    return Promise.resolve({ data: null, error: { message: 'Invalid OTP' } });
  },
};

// ── DISCOVERY ─────────────────────────────────────────────
export const DiscoveryAPI = {
  getVendors: (village, category) => {
    const { VENDORS } = require('./mockData');
    const filtered = VENDORS.filter(v =>
      (!category || v.category === category)
    );
    return apiResponse(filtered);
  },
  getVendor: (id) => {
    const { VENDORS, PRODUCTS } = require('./mockData');
    const vendor = VENDORS.find(v => v.id === id);
    if (!vendor) return Promise.resolve({ data: null, error: { message: 'Vendor not found' } });
    const products = PRODUCTS.filter(p => p.vendorId === id);
    return apiResponse({ vendor, products });
  },
  search: (query, filters) => {
    const { PRODUCTS, VENDORS } = require('./mockData');
    const q = query.toLowerCase();
    const products = PRODUCTS.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.nameHindi && p.nameHindi.includes(q))
    );
    const vendors = VENDORS.filter(v => v.name.toLowerCase().includes(q));
    return apiResponse({ products, vendors, query });
  },
};

// ── ORDERS ────────────────────────────────────────────────
export const OrderAPI = {
  create: (payload) => {
    const orderNumber = `SETU-2025-${String(Math.floor(Math.random() * 9000) + 1000)}`;
    return apiResponse({
      ...payload,
      id: `o${Date.now()}`,
      orderNumber,
      status: 'pending',
      createdAt: new Date().toISOString(),
    }, 800);
  },
  getHistory: (userId) => {
    const { ORDERS } = require('./mockData');
    return apiResponse(ORDERS);
  },
  getDetail: (orderId) => {
    const { ORDERS } = require('./mockData');
    const order = ORDERS.find(o => o.id === orderId);
    return apiResponse(order);
  },
  cancel: (orderId, reason) => apiResponse({ success: true, orderId, reason }, 500),
  rate: (orderId, rating) => apiResponse({ success: true, orderId, ...rating }, 500),
  reorder: (orderId) => {
    const { ORDERS } = require('./mockData');
    const original = ORDERS.find(o => o.id === orderId);
    if (!original) return Promise.resolve({ data: null, error: { message: 'Order not found' } });
    return apiResponse({ reordered: true, items: original.items }, 500);
  },
};

// ── PAYMENTS ──────────────────────────────────────────────
export const PaymentAPI = {
  initiateUPI: (amount, orderId) => apiResponse({
    paymentId: `pay_${Date.now()}`,
    amount,
    orderId,
    upiLink: `upi://pay?pa=setu@hdfc&pn=SETU&am=${amount}&tn=${orderId}`,
    qrCode: null,
  }, 600),
  verifyPayment: (paymentId, orderId, signature) => apiResponse({
    verified: true,
    paymentId,
    orderId,
  }, 800),
  walletTopup: (amount) => apiResponse({ success: true, amount, newBalance: 1250 + amount }, 600),
};

// ── VENDOR ────────────────────────────────────────────────
export const VendorAPI = {
  getOrders: (vendorId) => {
    const { ORDERS } = require('./mockData');
    return apiResponse(ORDERS.filter(o => o.vendorId === vendorId));
  },
  confirmOrder: (orderId) => apiResponse({ success: true, status: 'confirmed' }, 400),
  rejectOrder: (orderId, reason) => apiResponse({ success: true, status: 'cancelled', reason }, 400),
  markReady: (orderId) => apiResponse({ success: true, status: 'ready' }, 400),
  updateProduct: (productId, updates) => apiResponse({ success: true, productId, ...updates }, 500),
  createProduct: (data) => apiResponse({ id: `p${Date.now()}`, ...data }, 600),
  getAnalytics: (vendorId, period) => {
    const { ANALYTICS_DATA } = require('./mockData');
    return apiResponse(ANALYTICS_DATA);
  },
};

// ── RIDER ─────────────────────────────────────────────────
export const RiderAPI = {
  getAvailableOrders: (riderId) => {
    const { ORDERS } = require('./mockData');
    return apiResponse(ORDERS.filter(o => !o.riderId && o.status === 'pending'));
  },
  acceptOrder: (orderId, riderId) => apiResponse({
    success: true,
    orderId,
    riderId,
    status: 'picked_up',
    acceptedAt: new Date().toISOString(),
  }, 400),
  markDelivered: (orderId, payload) => apiResponse({
    success: true,
    orderId,
    status: 'delivered',
    deliveredAt: new Date().toISOString(),
    ...payload,
  }, 500),
  updateLocation: (riderId, lat, lng) => apiResponse({ success: true }, 200),
  getEarnings: (riderId, period) => {
    const { RIDERS } = require('./mockData');
    const rider = RIDERS.find(r => r.id === riderId);
    return apiResponse(rider || {});
  },
};

// ── CREDIT ────────────────────────────────────────────────
export const CreditAPI = {
  getAccount: (userId) => apiResponse({
    limit: 5000,
    outstanding: 1200,
    available: 3800,
    score: 720,
    status: 'active',
    repaymentRate: 98,
  }, 400),
  applyCredit: (userId, amount, purpose) => apiResponse({
    applicationId: `capp_${Date.now()}`,
    amount,
    status: 'under_review',
    estimatedDecision: '24 hours',
  }, 800),
  repay: (userId, amount) => apiResponse({ success: true, amount, newOutstanding: 1200 - amount }, 600),
};

// ── SEVA ──────────────────────────────────────────────────
export const SevaAPI = {
  getJobs: (providerId) => {
    const { SEVA_PROVIDERS } = require('./mockData');
    return apiResponse([
      { id: 'sj1', title: 'Electrical repair', customer: 'Ram Kumar', date: 'Today 3PM', amount: 450, status: 'pending' },
      { id: 'sj2', title: 'Plumbing fix', customer: 'Sunita Devi', date: 'Tomorrow 10AM', amount: 600, status: 'confirmed' },
    ]);
  },
  acceptJob: (jobId) => apiResponse({ success: true, jobId, status: 'confirmed' }, 400),
  completeJob: (jobId, payload) => apiResponse({ success: true, jobId, status: 'completed', ...payload }, 500),
};

// ── AI / VOICE ────────────────────────────────────────────
export const AIAPI = {
  // Stub: calls would go to Whisper in production
  transcribeVoice: (audioBlob) => apiResponse({
    transcript: 'चावल और तेल चाहिए',
    confidence: 0.92,
    detectedLanguage: 'hi',
    intent: 'search',
    query: 'rice and oil',
  }, 1200),
  
  // Stub: calls would go to Claude Haiku in production
  chatAssistant: (message, context) => apiResponse({
    reply: 'आपका ऑर्डर जल्द ही डिलीवर होगा। कोई और मदद चाहिए?',
    intent: 'order_status',
    actions: [],
  }, 1000),

  getRecommendations: (userId, village) => {
    const { PRODUCTS } = require('./mockData');
    // Simple rule-based: return seasonal + popular items
    return apiResponse(PRODUCTS.slice(0, 6).map(p => ({
      ...p,
      reason: p.isSeasonal ? 'Seasonal pick' : 'Popular in your area',
    })));
  },

  getDemandForecast: (vendorId) => apiResponse({
    forecasts: [
      { product: 'Basmati Rice', nextWeekDemand: 12, reorderSuggestion: 15, confidence: 0.89 },
      { product: 'Mustard Oil', nextWeekDemand: 8, reorderSuggestion: 10, confidence: 0.85 },
      { product: 'Premium Makhana', nextWeekDemand: 5, reorderSuggestion: 7, confidence: 0.76 },
    ],
    festivalAlert: 'Chhath Puja in 12 days — increase sweet and pooja items by 40%',
  }, 600),
};

// ── NOTIFICATIONS ─────────────────────────────────────────
export const NotificationAPI = {
  getAll: (userId) => {
    const { NOTIFICATIONS } = require('./mockData');
    return apiResponse(NOTIFICATIONS);
  },
  markRead: (notifId) => apiResponse({ success: true }, 200),
  markAllRead: (userId) => apiResponse({ success: true }, 200),
};

// ── ADMIN ─────────────────────────────────────────────────
export const AdminAPI = {
  getMetrics: () => {
    const { ADMIN_STATS } = require('./mockData');
    return apiResponse(ADMIN_STATS);
  },
  assignRider: (orderId, riderId) => apiResponse({ success: true, orderId, riderId }, 500),
  approveVendor: (vendorId) => apiResponse({ success: true, vendorId, status: 'verified' }, 500),
  rejectVendor: (vendorId, reason) => apiResponse({ success: true, vendorId, reason }, 500),
};

// ── FRAUD ─────────────────────────────────────────────────
export const FraudAPI = {
  checkOrder: (orderPayload) => apiResponse({
    riskScore: Math.random() * 0.3, // Low risk in prototype
    flags: [],
    decision: 'approve',
  }, 300),
  reportFraud: (payload) => apiResponse({ ticketId: `fraud_${Date.now()}`, status: 'logged' }, 500),
};
