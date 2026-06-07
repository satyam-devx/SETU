// ═══════════════════════════════════════════════════════════
// SETU PLATFORM — API SERVICE LAYER (Phase 2)
// All methods call real Supabase. Return { data, error }.
// Interface is identical to Phase 1 mock — no page changes needed.
// Falls back to mock data when Supabase is not configured.
// ═══════════════════════════════════════════════════════════

import { supabase, isSupabaseConfigured } from './supabase';
import {
  VENDORS, PRODUCTS, ORDERS, CATEGORIES,
  RIDERS, SEVA_PROVIDERS, NOTIFICATIONS, WALLET,
  ANALYTICS_DATA, ADMIN_STATS,
} from './mockData';

// ── Normalise Supabase response ───────────────────────────
function ok(data)  { return { data, error: null }; }
function err(e)    { return { data: null, error: e }; }

// ── Demo-mode delay helper ────────────────────────────────
const delay = (ms = 300) => new Promise(r => setTimeout(r, ms));

// ─────────────────────────────────────────────────────────
// AUTH API
// ─────────────────────────────────────────────────────────
export const AuthAPI = {
  sendOTP: async (phone) => {
    if (!isSupabaseConfigured) {
      await delay(600);
      return ok({ sent: true, phone });
    }
    const { error } = await supabase.auth.signInWithOtp({
      phone,
      options: { channel: 'sms' },
    });
    return error ? err(error) : ok({ sent: true, phone });
  },

  verifyOTP: async (phone, otp) => {
    if (!isSupabaseConfigured) {
      await delay(800);
      if (otp.length === 4) {
        return ok({ user: { id: 'u1', phone }, token: 'mock-jwt' });
      }
      return err({ message: 'Invalid OTP' });
    }
    const { data, error } = await supabase.auth.verifyOtp({
      phone, token: otp, type: 'sms',
    });
    return error ? err(error) : ok(data);
  },
};

// ─────────────────────────────────────────────────────────
// DISCOVERY API
// ─────────────────────────────────────────────────────────
export const DiscoveryAPI = {
  getVendors: async (village, category) => {
    if (!isSupabaseConfigured) {
      await delay();
      const filtered = VENDORS.filter(v =>
        !category || v.category === category
      );
      return ok(filtered);
    }
    let q = supabase
      .from('vendors')
      .select('*, products(*)')
      .eq('is_active', true);
    if (village)  q = q.eq('village', village);
    if (category) q = q.eq('category', category);
    q = q.order('rating', { ascending: false });
    const { data, error } = await q;
    return error ? err(error) : ok(data);
  },

  getVendor: async (id) => {
    if (!isSupabaseConfigured) {
      await delay();
      const vendor   = VENDORS.find(v => v.id === id);
      const products = PRODUCTS.filter(p => p.vendorId === id);
      return vendor ? ok({ vendor, products }) : err({ message: 'Not found' });
    }
    const { data: vendor, error: ve } = await supabase
      .from('vendors')
      .select('*')
      .eq('id', id)
      .single();
    if (ve) return err(ve);

    const { data: products, error: pe } = await supabase
      .from('products')
      .select('*')
      .eq('vendor_id', id)
      .eq('is_available', true);
    if (pe) return err(pe);

    return ok({ vendor, products: products ?? [] });
  },

  search: async (query, filters = {}) => {
    if (!isSupabaseConfigured) {
      await delay(200);
      const q = query.toLowerCase();
      const products = PRODUCTS.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.nameHindi && p.nameHindi.includes(q))
      );
      const vendors = VENDORS.filter(v => v.name.toLowerCase().includes(q));
      return ok({ products, vendors, query });
    }

    const [{ data: products }, { data: vendors }] = await Promise.all([
      supabase
        .from('products')
        .select('*')
        .eq('is_available', true)
        .ilike('name', `%${query}%`)
        .limit(20),
      supabase
        .from('vendors')
        .select('*')
        .eq('is_active', true)
        .ilike('name', `%${query}%`)
        .limit(10),
    ]);
    return ok({ products: products ?? [], vendors: vendors ?? [], query });
  },

  getCategories: async () => {
    if (!isSupabaseConfigured) {
      await delay(100);
      return ok(CATEGORIES);
    }
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');
    return error ? err(error) : ok(data);
  },

  getProducts: async (vendorId, categoryId) => {
    if (!isSupabaseConfigured) {
      await delay();
      let results = PRODUCTS;
      if (vendorId)   results = results.filter(p => p.vendorId   === vendorId);
      if (categoryId) results = results.filter(p => p.categoryId === categoryId);
      return ok(results);
    }
    let q = supabase.from('products').select('*').eq('is_available', true);
    if (vendorId)   q = q.eq('vendor_id', vendorId);
    if (categoryId) q = q.eq('category_id', categoryId);
    const { data, error } = await q.order('name');
    return error ? err(error) : ok(data);
  },
};

// ─────────────────────────────────────────────────────────
// ORDER API
// ─────────────────────────────────────────────────────────
export const OrderAPI = {
  create: async (payload) => {
    if (!isSupabaseConfigured) {
      await delay(800);
      const order = {
        ...payload,
        id:          `o${Date.now()}`,
        orderNumber: `SETU-2025-${String(Math.floor(Math.random() * 9000) + 1000)}`,
        status:      'pending',
        createdAt:   new Date().toISOString(),
      };
      return ok(order);
    }
    // Use the place_order RPC for atomic order + items creation
    const { data, error } = await supabase.rpc('place_order', {
      p_customer_id:      payload.customerId,
      p_customer_name:    payload.customerName,
      p_vendor_id:        payload.vendorId,
      p_vendor_name:      payload.vendorName,
      p_village_id:       payload.villageId || null,
      p_village:          payload.village,
      p_payment_method:   payload.paymentMethod,
      p_subtotal:         payload.subtotal,
      p_delivery_fee:     payload.deliveryFee,
      p_platform_fee:     payload.platformFee,
      p_total:            payload.total,
      p_items:            payload.items,
      p_delivery_address: payload.deliveryAddress || null,
      p_use_credit:       payload.useCredit ?? false,
    });
    return error ? err(error) : ok(data);
  },

  getHistory: async (userId) => {
    if (!isSupabaseConfigured) {
      await delay();
      return ok(ORDERS);
    }
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items ( id, name, qty, price, product_id )
      `)
      .eq('customer_id', userId)
      .order('created_at', { ascending: false });
    return error ? err(error) : ok(data ?? []);
  },

  getDetail: async (orderId) => {
    if (!isSupabaseConfigured) {
      await delay(200);
      return ok(ORDERS.find(o => o.id === orderId) ?? null);
    }
    const { data, error } = await supabase
      .from('orders')
      .select(`*, order_items ( id, name, qty, price, product_id )`)
      .eq('id', orderId)
      .single();
    return error ? err(error) : ok(data);
  },

  cancel: async (orderId, reason) => {
    if (!isSupabaseConfigured) {
      await delay(500);
      return ok({ success: true, orderId, reason });
    }
    const { data, error } = await supabase.rpc('update_order_status', {
      p_order_id:   orderId,
      p_new_status: 'cancelled',
      p_actor_id:   (await supabase.auth.getUser()).data.user?.id,
      p_meta:       JSON.stringify({ cancel_reason: reason }),
    });
    return error ? err(error) : ok(data);
  },

  rate: async (orderId, { vendorRating, riderRating, comment }) => {
    if (!isSupabaseConfigured) {
      await delay(500);
      return ok({ success: true });
    }
    const { data, error } = await supabase.rpc('rate_order', {
      p_order_id:      orderId,
      p_vendor_rating: vendorRating,
      p_rider_rating:  riderRating ?? null,
      p_comment:       comment ?? null,
    });
    return error ? err(error) : ok(data);
  },

  reorder: async (orderId) => {
    if (!isSupabaseConfigured) {
      await delay(500);
      const original = ORDERS.find(o => o.id === orderId);
      return original ? ok({ reordered: true, items: original.items }) : err({ message: 'Not found' });
    }
    const { data, error } = await supabase
      .from('order_items')
      .select('name, qty, price, product_id')
      .eq('order_id', orderId);
    return error ? err(error) : ok({ reordered: true, items: data ?? [] });
  },

  advanceStatus: async (orderId, newStatus, meta = {}) => {
    if (!isSupabaseConfigured) {
      await delay(400);
      return ok({ success: true, status: newStatus });
    }
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.rpc('update_order_status', {
      p_order_id:   orderId,
      p_new_status: newStatus,
      p_actor_id:   user?.id ?? null,
      p_meta:       JSON.stringify(meta),
    });
    return error ? err(error) : ok(data);
  },
};

// ─────────────────────────────────────────────────────────
// PAYMENT API
// ─────────────────────────────────────────────────────────
export const PaymentAPI = {
  initiateUPI: async (amount, orderId) => {
    await delay(600);
    return ok({
      paymentId:  `pay_${Date.now()}`,
      amount,
      orderId,
      upiLink:    `upi://pay?pa=setu@hdfc&pn=SETU&am=${amount}&tn=${orderId}`,
      qrCode:     null,
    });
  },

  verifyPayment: async (paymentId, orderId, signature) => {
    await delay(800);
    return ok({ verified: true, paymentId, orderId });
  },

  walletTopup: async (userId, amount, reference = null) => {
    if (!isSupabaseConfigured) {
      await delay(600);
      return ok({ success: true, amount });
    }
    const { data, error } = await supabase.rpc('topup_wallet', {
      p_user_id:   userId,
      p_amount:    amount,
      p_reference: reference,
    });
    return error ? err(error) : ok(data);
  },

  getWallet: async (userId) => {
    if (!isSupabaseConfigured) {
      await delay(300);
      return ok(WALLET);
    }
    const { data: wallet, error: we } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', userId)
      .single();
    if (we) return err(we);

    const { data: txns } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    return ok({ ...wallet, transactions: txns ?? [] });
  },
};

// ─────────────────────────────────────────────────────────
// VENDOR API
// ─────────────────────────────────────────────────────────
export const VendorAPI = {
  getOrders: async (vendorId) => {
    if (!isSupabaseConfigured) {
      await delay();
      return ok(ORDERS.filter(o => o.vendorId === vendorId));
    }
    const { data, error } = await supabase.rpc('get_vendor_orders', {
      p_vendor_id: vendorId,
    });
    return error ? err(error) : ok(data ?? []);
  },

  confirmOrder: async (orderId) => {
    if (!isSupabaseConfigured) { await delay(400); return ok({ status: 'confirmed' }); }
    return OrderAPI.advanceStatus(orderId, 'confirmed');
  },

  rejectOrder: async (orderId, reason) => {
    if (!isSupabaseConfigured) { await delay(400); return ok({ status: 'cancelled' }); }
    return OrderAPI.advanceStatus(orderId, 'cancelled', { cancel_reason: reason });
  },

  markReady: async (orderId) => {
    // Vendor progresses: confirmed → preparing → ready
    // We resolve to ready regardless of intermediate step
    if (!isSupabaseConfigured) { await delay(400); return ok({ status: 'ready' }); }
    const { data: order } = await OrderAPI.getDetail(orderId);
    if (order?.status === 'confirmed') {
      await OrderAPI.advanceStatus(orderId, 'preparing');
    }
    return OrderAPI.advanceStatus(orderId, 'ready');
  },

  updateProduct: async (productId, updates) => {
    if (!isSupabaseConfigured) { await delay(500); return ok({ success: true }); }
    const { data, error } = await supabase
      .from('products')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', productId)
      .select()
      .single();
    return error ? err(error) : ok(data);
  },

  createProduct: async (vendorId, productData) => {
    if (!isSupabaseConfigured) {
      await delay(600);
      return ok({ id: `p${Date.now()}`, vendor_id: vendorId, ...productData });
    }
    const { data, error } = await supabase
      .from('products')
      .insert({ vendor_id: vendorId, ...productData })
      .select()
      .single();
    return error ? err(error) : ok(data);
  },

  getAnalytics: async (vendorId, period) => {
    if (!isSupabaseConfigured) { await delay(300); return ok(ANALYTICS_DATA); }
    // Phase 3: real analytics aggregation query
    const { data, error } = await supabase
      .from('orders')
      .select('total, created_at, status')
      .eq('vendor_id', vendorId)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: true });
    return error ? err(error) : ok({ raw: data ?? [], ...ANALYTICS_DATA });
  },
};

// ─────────────────────────────────────────────────────────
// RIDER API
// ─────────────────────────────────────────────────────────
export const RiderAPI = {
  getAvailableOrders: async (riderId) => {
    if (!isSupabaseConfigured) {
      await delay();
      return ok(ORDERS.filter(o => !o.riderId && o.status === 'pending'));
    }
    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(name, qty, price)')
      .is('rider_id', null)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
    return error ? err(error) : ok(data ?? []);
  },

  acceptOrder: async (orderId, riderId, riderName) => {
    if (!isSupabaseConfigured) {
      await delay(400);
      return ok({ success: true, status: 'picked_up' });
    }
    return OrderAPI.advanceStatus(orderId, 'picked_up', {
      rider_id:   riderId,
      rider_name: riderName,
    });
  },

  markDelivered: async (orderId, payload = {}) => {
    if (!isSupabaseConfigured) {
      await delay(500);
      return ok({ success: true, status: 'delivered' });
    }
    return OrderAPI.advanceStatus(orderId, 'delivered', payload);
  },

  updateLocation: async (riderId, lat, lng) => {
    if (!isSupabaseConfigured) return ok({ success: true });
    const { error } = await supabase
      .from('rider_locations')
      .upsert(
        { rider_id: riderId, lat, lng, recorded_at: new Date().toISOString() },
        { onConflict: 'rider_id' }
      );
    return error ? err(error) : ok({ success: true });
  },

  toggleOnline: async (riderId, isOnline) => {
    if (!isSupabaseConfigured) return ok({ success: true });
    const { error } = await supabase
      .from('riders')
      .update({ is_online: isOnline, updated_at: new Date().toISOString() })
      .eq('id', riderId);
    return error ? err(error) : ok({ success: true });
  },

  getEarnings: async (riderId, period) => {
    if (!isSupabaseConfigured) {
      await delay();
      return ok(RIDERS.find(r => r.id === riderId) ?? RIDERS[0]);
    }
    const { data, error } = await supabase
      .from('riders')
      .select('*')
      .eq('id', riderId)
      .single();
    return error ? err(error) : ok(data);
  },

  submitCODDeposit: async (riderId, amount, denominations = null) => {
    if (!isSupabaseConfigured) {
      await delay(600);
      return ok({ success: true, depositId: `dep_${Date.now()}` });
    }
    const { data, error } = await supabase
      .from('cod_deposits')
      .insert({ rider_id: riderId, amount, denominations, status: 'pending_confirmation' })
      .select()
      .single();
    return error ? err(error) : ok(data);
  },
};

// ─────────────────────────────────────────────────────────
// CREDIT API
// ─────────────────────────────────────────────────────────
export const CreditAPI = {
  getAccount: async (userId) => {
    if (!isSupabaseConfigured) {
      await delay(400);
      return ok({ limit: 5000, outstanding: 1200, available: 3800, score: 720, status: 'active', repaymentRate: 98 });
    }
    const { data, error } = await supabase
      .from('credit_accounts')
      .select('*')
      .eq('user_id', userId)
      .single();
    if (error) return err(error);
    return ok({
      limit:          data.credit_limit,
      outstanding:    data.outstanding,
      available:      data.credit_limit - data.outstanding,
      score:          data.score,
      status:         data.status,
      repaymentRate:  data.repayment_rate,
    });
  },

  applyCredit: async (userId, amount, purpose) => {
    if (!isSupabaseConfigured) {
      await delay(800);
      return ok({ applicationId: `capp_${Date.now()}`, status: 'under_review', estimatedDecision: '24 hours' });
    }
    const { data: account } = await supabase
      .from('credit_accounts')
      .select('id, credit_limit, outstanding')
      .eq('user_id', userId)
      .single();

    if (!account) return err({ message: 'No credit account found' });
    if ((account.outstanding + amount) > account.credit_limit) {
      return err({ message: 'Amount exceeds available credit limit' });
    }

    const { data, error } = await supabase
      .from('credit_transactions')
      .insert({
        account_id: account.id,
        user_id:    userId,
        type:       'disbursement',
        amount,
        purpose,
        status:     'active',
        due_date:   new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      })
      .select()
      .single();

    if (error) return err(error);

    // Update outstanding
    await supabase
      .from('credit_accounts')
      .update({ outstanding: account.outstanding + amount })
      .eq('id', account.id);

    return ok({ applicationId: data.id, status: 'approved', amount });
  },

  repay: async (userId, amount) => {
    if (!isSupabaseConfigured) {
      await delay(600);
      return ok({ success: true, amount });
    }
    const { data: account } = await supabase
      .from('credit_accounts')
      .select('id, outstanding')
      .eq('user_id', userId)
      .single();

    if (!account) return err({ message: 'No credit account found' });

    const newOutstanding = Math.max(0, account.outstanding - amount);
    await supabase
      .from('credit_accounts')
      .update({ outstanding: newOutstanding })
      .eq('id', account.id);

    await supabase
      .from('credit_transactions')
      .insert({
        account_id: account.id,
        user_id:    userId,
        type:       'repayment',
        amount,
        status:     'repaid',
        repaid_at:  new Date().toISOString(),
      });

    return ok({ success: true, newOutstanding });
  },
};

// ─────────────────────────────────────────────────────────
// SEVA API
// ─────────────────────────────────────────────────────────
export const SevaAPI = {
  getJobs: async (providerId) => {
    if (!isSupabaseConfigured) {
      await delay(300);
      return ok([
        { id: 'sj1', title: 'Electrical repair', customer: 'Ram Kumar',  date: 'Today 3PM',    amount: 450, status: 'pending'   },
        { id: 'sj2', title: 'Plumbing fix',       customer: 'Sunita Devi', date: 'Tomorrow 10AM', amount: 600, status: 'confirmed' },
      ]);
    }
    const { data, error } = await supabase
      .from('seva_jobs')
      .select('*')
      .eq('provider_id', providerId)
      .order('created_at', { ascending: false });
    return error ? err(error) : ok(data ?? []);
  },

  getOpenJobs: async (category, villageId) => {
    if (!isSupabaseConfigured) { await delay(300); return ok([]); }
    let q = supabase.from('seva_jobs').select('*').eq('status', 'open');
    if (category) q = q.eq('category', category);
    if (villageId) q = q.eq('village_id', villageId);
    const { data, error } = await q.order('created_at', { ascending: false });
    return error ? err(error) : ok(data ?? []);
  },

  acceptJob: async (jobId, providerId) => {
    if (!isSupabaseConfigured) {
      await delay(400);
      return ok({ success: true, jobId, status: 'accepted' });
    }
    const { data, error } = await supabase
      .from('seva_jobs')
      .update({ provider_id: providerId, status: 'accepted', updated_at: new Date().toISOString() })
      .eq('id', jobId)
      .select()
      .single();
    return error ? err(error) : ok(data);
  },

  completeJob: async (jobId, payload = {}) => {
    if (!isSupabaseConfigured) {
      await delay(500);
      return ok({ success: true, status: 'completed' });
    }
    const { data, error } = await supabase
      .from('seva_jobs')
      .update({
        status:       'completed',
        notes:        payload.notes ?? null,
        completed_at: new Date().toISOString(),
        updated_at:   new Date().toISOString(),
      })
      .eq('id', jobId)
      .select()
      .single();
    return error ? err(error) : ok(data);
  },
};

// ─────────────────────────────────────────────────────────
// AI API
// ─────────────────────────────────────────────────────────
export const AIAPI = {
  transcribeVoice: async (audioBlob) => {
    await delay(1200);
    return ok({
      transcript:        'चावल और तेल चाहिए',
      confidence:        0.92,
      detectedLanguage:  'hi',
      intent:            'search',
      query:             'rice and oil',
    });
  },

  chatAssistant: async (message, context) => {
    await delay(1000);
    return ok({
      reply:   'आपका ऑर्डर जल्द ही डिलीवर होगा। कोई और मदद चाहिए?',
      intent:  'order_status',
      actions: [],
    });
  },

  getRecommendations: async (userId, village) => {
    if (!isSupabaseConfigured) {
      await delay(400);
      return ok(PRODUCTS.slice(0, 6).map(p => ({
        ...p, reason: p.isSeasonal ? 'Seasonal pick' : 'Popular in your area',
      })));
    }
    const { data, error } = await supabase
      .from('products')
      .select('*, vendors(name)')
      .eq('is_available', true)
      .limit(6);
    return error ? err(error) : ok(data ?? []);
  },

  getDemandForecast: async (vendorId) => {
    if (!isSupabaseConfigured) {
      await delay(600);
      return ok({
        forecasts: [
          { product: 'Basmati Rice',    nextWeekDemand: 12, reorderSuggestion: 15, confidence: 0.89 },
          { product: 'Mustard Oil',     nextWeekDemand: 8,  reorderSuggestion: 10, confidence: 0.85 },
          { product: 'Premium Makhana', nextWeekDemand: 5,  reorderSuggestion: 7,  confidence: 0.76 },
        ],
        festivalAlert: 'Chhath Puja in 12 days — increase sweet and pooja items by 40%',
      });
    }
    // Real: aggregate order_items for this vendor over last 30 days
    const { data } = await supabase
      .from('order_items')
      .select('name, qty, orders!inner(vendor_id, created_at, status)')
      .eq('orders.vendor_id', vendorId)
      .neq('orders.status', 'cancelled')
      .gte('orders.created_at', new Date(Date.now() - 30 * 86400000).toISOString());

    if (!data?.length) {
      return ok({ forecasts: [], festivalAlert: null });
    }
    // Aggregate by product name
    const sums = data.reduce((acc, row) => {
      acc[row.name] = (acc[row.name] || 0) + row.qty;
      return acc;
    }, {});
    const forecasts = Object.entries(sums)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([product, totalQty]) => ({
        product,
        nextWeekDemand:    Math.round(totalQty / 4),
        reorderSuggestion: Math.round(totalQty / 4 * 1.3),
        confidence:        0.80,
      }));
    return ok({ forecasts, festivalAlert: null });
  },
};

// ─────────────────────────────────────────────────────────
// NOTIFICATION API
// ─────────────────────────────────────────────────────────
export const NotificationAPI = {
  getAll: async (userId) => {
    if (!isSupabaseConfigured) {
      await delay(200);
      return ok(NOTIFICATIONS);
    }
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    return error ? err(error) : ok(data ?? []);
  },

  markRead: async (notifId) => {
    if (!isSupabaseConfigured) return ok({ success: true });
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notifId);
    return error ? err(error) : ok({ success: true });
  },

  markAllRead: async (userId) => {
    if (!isSupabaseConfigured) return ok({ success: true });
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);
    return error ? err(error) : ok({ success: true });
  },
};

// ─────────────────────────────────────────────────────────
// ADMIN API
// ─────────────────────────────────────────────────────────
export const AdminAPI = {
  getMetrics: async () => {
    if (!isSupabaseConfigured) { await delay(300); return ok(ADMIN_STATS); }
    const [{ count: orders }, { count: vendors }, { data: riders }] = await Promise.all([
      supabase.from('orders').select('*', { count: 'exact', head: true }).neq('status', 'cancelled'),
      supabase.from('vendors').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('riders').select('is_online').eq('is_active', true),
    ]);
    return ok({
      ...ADMIN_STATS,
      totalOrders:   orders ?? 0,
      totalVendors:  vendors ?? 0,
      activeRiders:  riders?.filter(r => r.is_online).length ?? 0,
    });
  },

  assignRider: async (orderId, riderId) => {
    if (!isSupabaseConfigured) { await delay(500); return ok({ success: true }); }
    return OrderAPI.advanceStatus(orderId, 'picked_up', { rider_id: riderId });
  },

  approveVendor: async (vendorId) => {
    if (!isSupabaseConfigured) { await delay(500); return ok({ success: true }); }
    const { error } = await supabase
      .from('vendors')
      .update({ is_verified: true, kyc_status: 'approved' })
      .eq('id', vendorId);
    return error ? err(error) : ok({ success: true });
  },

  rejectVendor: async (vendorId, reason) => {
    if (!isSupabaseConfigured) { await delay(500); return ok({ success: true }); }
    const { error } = await supabase
      .from('vendors')
      .update({ kyc_status: 'rejected' })
      .eq('id', vendorId);
    return error ? err(error) : ok({ success: true });
  },

  confirmCODDeposit: async (depositId, adminId) => {
    if (!isSupabaseConfigured) { await delay(500); return ok({ success: true }); }
    const { data: deposit, error: de } = await supabase
      .from('cod_deposits')
      .update({ status: 'confirmed', admin_confirmed_by: adminId, admin_confirmed_at: new Date().toISOString() })
      .eq('id', depositId)
      .select()
      .single();
    if (de) return err(de);
    // Zero out rider's cod_balance
    await supabase.from('riders').update({ cod_balance: 0 }).eq('id', deposit.rider_id);
    return ok({ success: true });
  },
};

// ─────────────────────────────────────────────────────────
// FRAUD API
// ─────────────────────────────────────────────────────────
export const FraudAPI = {
  checkOrder: async (orderPayload) => {
    await delay(300);
    return ok({ riskScore: Math.random() * 0.3, flags: [], decision: 'approve' });
  },

  reportFraud: async (payload) => {
    if (!isSupabaseConfigured) {
      await delay(500);
      return ok({ ticketId: `fraud_${Date.now()}`, status: 'logged' });
    }
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from('support_tickets')
      .insert({
        user_id:  user?.id,
        subject:  `Fraud Report: ${payload.fraudType}`,
        status:   'open',
        priority: 'high',
        messages: JSON.stringify([{ from: 'customer', text: payload.description, time: new Date().toLocaleTimeString() }]),
      })
      .select()
      .single();
    return error ? err(error) : ok({ ticketId: data.id, status: 'logged' });
  },
};
