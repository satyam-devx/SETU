// ═══════════════════════════════════════════════════════════
// SETU — API Layer  (v2)
// Constitution: "Backend-first mindset. Every API call is the
// canonical interface. UI should never embed business logic."
//
// Patterns:
//  - All functions return { data, error } — never throw
//  - Snake_case ↔ camelCase normalisation lives here only
//  - Supabase calls are isolated — swap to REST/RPC in future
//    with zero component changes
//  - Pagination: all list functions accept { page, limit }
//  - Optimistic IDs: placeOrder accepts a localId for offline
// ═══════════════════════════════════════════════════════════

import { supabase, isSupabaseConfigured } from './supabase';
import { PRODUCTS, VENDORS, ORDERS, NOTIFICATIONS, VILLAGES, CATEGORIES, SEVA_PROVIDERS, SCHEMES } from './mockData';

// ── Helpers ───────────────────────────────────────────────

function ok(data)    { return { data, error: null }; }
function err(e, ctx) {
  const msg = e?.message || e?.error_description || String(e) || 'Unknown error';
  console.error(`[SETU API] ${ctx}:`, msg);
  return { data: null, error: { message: msg, code: e?.code, details: e?.details } };
}

async function safeQuery(fn, fallback, ctx) {
  if (!isSupabaseConfigured) return ok(fallback);
  try {
    const result = await fn();
    if (result.error) {
      // PGRST116 = row not found — not a real error for single row queries
      if (result.error.code === 'PGRST116') return ok(null);
      return err(result.error, ctx);
    }
    return ok(result.data);
  } catch (e) {
    return err(e, ctx);
  }
}

// ── Villages ──────────────────────────────────────────────

export async function getVillages({ activeOnly = true } = {}) {
  return safeQuery(
    () => supabase
      .from('villages')
      .select('*')
      .eq('is_active', activeOnly)
      .order('name'),
    VILLAGES,
    'getVillages'
  );
}

export async function getVillageById(id) {
  return safeQuery(
    () => supabase.from('villages').select('*').eq('id', id).single(),
    VILLAGES.find(v => v.id === id) || null,
    'getVillageById'
  );
}

// ── Categories ────────────────────────────────────────────

export async function getCategories() {
  return safeQuery(
    () => supabase.from('categories').select('*').eq('is_active', true).order('sort_order'),
    CATEGORIES,
    'getCategories'
  );
}

// ── Vendors ───────────────────────────────────────────────

export async function getVendors({ villageId, category, page = 0, limit = 20 } = {}) {
  return safeQuery(() => {
    let q = supabase
      .from('vendors')
      .select(`
        id, name, category, village_id, village, image_url, rating,
        review_count, is_open, delivery_radius, trust_score,
        subscription_tier, lat, lng
      `)
      .eq('is_active', true)
      .range(page * limit, (page + 1) * limit - 1)
      .order('rating', { ascending: false });

    if (villageId) q = q.eq('village_id', villageId);
    if (category)  q = q.eq('category', category);
    return q;
  }, VENDORS, 'getVendors');
}

export async function getVendorById(id) {
  return safeQuery(
    () => supabase.from('vendors').select('*, products(*)').eq('id', id).single(),
    VENDORS.find(v => v.id === id) || null,
    'getVendorById'
  );
}

export async function getVendorByOwnerId(ownerId) {
  return safeQuery(
    () => supabase.from('vendors').select('*').eq('owner_id', ownerId).maybeSingle(),
    null,
    'getVendorByOwnerId'
  );
}

export async function upsertVendorProfile(vendorData) {
  return safeQuery(
    () => supabase.from('vendors').upsert(vendorData, { onConflict: 'owner_id' }).select().single(),
    null,
    'upsertVendorProfile'
  );
}

// ── Products ──────────────────────────────────────────────

export async function getProducts({ vendorId, category, search, page = 0, limit = 30 } = {}) {
  return safeQuery(() => {
    let q = supabase
      .from('products')
      .select(`
        id, vendor_id, name, name_hindi, description, price, mrp,
        unit, stock, image_url, is_available, category, category_id
      `)
      .eq('is_available', true)
      .range(page * limit, (page + 1) * limit - 1)
      .order('name');

    if (vendorId)  q = q.eq('vendor_id', vendorId);
    if (category)  q = q.eq('category', category);
    if (search)    q = q.ilike('name', `%${search}%`);
    return q;
  }, PRODUCTS, 'getProducts');
}

export async function getProductById(id) {
  return safeQuery(
    () => supabase.from('products').select('*, vendors(name, rating, village)').eq('id', id).single(),
    PRODUCTS.find(p => p.id === id) || null,
    'getProductById'
  );
}

export async function upsertProduct(productData) {
  return safeQuery(
    () => supabase.from('products').upsert(productData).select().single(),
    null,
    'upsertProduct'
  );
}

export async function deleteProduct(id) {
  return safeQuery(
    () => supabase.from('products').delete().eq('id', id),
    null,
    'deleteProduct'
  );
}

// ── Orders ────────────────────────────────────────────────

export async function getOrdersByCustomer(customerId, { page = 0, limit = 20, status } = {}) {
  return safeQuery(() => {
    let q = supabase
      .from('orders')
      .select(`
        id, order_number, status, total, payment_method, payment_status,
        vendor_name, created_at, delivered_at, is_rated,
        order_items(id, name, qty, price)
      `)
      .eq('customer_id', customerId)
      .range(page * limit, (page + 1) * limit - 1)
      .order('created_at', { ascending: false });

    if (status) q = q.eq('status', status);
    return q;
  }, ORDERS.filter(o => o.customerId === customerId), 'getOrdersByCustomer');
}

export async function getOrdersByVendor(vendorId, { page = 0, limit = 20, status } = {}) {
  return safeQuery(() => {
    let q = supabase
      .from('orders')
      .select(`
        id, order_number, status, total, payment_method, payment_status,
        customer_name, created_at, delivery_address, is_cod,
        order_items(id, name, qty, price)
      `)
      .eq('vendor_id', vendorId)
      .range(page * limit, (page + 1) * limit - 1)
      .order('created_at', { ascending: false });

    if (status) q = q.eq('status', status);
    return q;
  }, ORDERS.filter(o => o.vendorId === vendorId), 'getOrdersByVendor');
}

export async function getOrdersByRider(riderId, { page = 0, limit = 20, status } = {}) {
  return safeQuery(() => {
    let q = supabase
      .from('orders')
      .select(`
        id, order_number, status, total, payment_method, is_cod,
        customer_name, delivery_address, vendor_name, created_at,
        order_items(id, name, qty)
      `)
      .eq('rider_id', riderId)
      .range(page * limit, (page + 1) * limit - 1)
      .order('created_at', { ascending: false });

    if (status) q = q.eq('status', status);
    return q;
  }, ORDERS.filter(o => o.riderId === riderId), 'getOrdersByRider');
}

export async function getOrderById(id) {
  return safeQuery(
    () => supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', id)
      .single(),
    ORDERS.find(o => o.id === id) || null,
    'getOrderById'
  );
}

export async function placeOrder(orderPayload) {
  // orderPayload: { customer_id, vendor_id, village_id, items, payment_method, delivery_address }
  if (!isSupabaseConfigured) {
    // Offline / mock: return a fake order
    const fakeOrder = {
      id: `local-${Date.now()}`,
      order_number: `SETU-${Date.now().toString(36).toUpperCase()}`,
      status: 'pending',
      ...orderPayload,
      created_at: new Date().toISOString(),
      _offline: true,
    };
    return ok(fakeOrder);
  }

  const orderNumber = `SETU-${Date.now().toString(36).toUpperCase()}`;
  const { items, ...orderHead } = orderPayload;

  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const deliveryFee = subtotal >= 200 ? 0 : 20;
  const platformFee = Math.round(subtotal * 0.01);
  const total       = subtotal + deliveryFee + platformFee;

  try {
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .insert({
        ...orderHead,
        order_number:   orderNumber,
        subtotal,
        delivery_fee:   deliveryFee,
        platform_fee:   platformFee,
        total,
        is_cod:         orderPayload.payment_method === 'COD',
        status:         'pending',
        payment_status: 'pending',
      })
      .select()
      .single();

    if (orderErr) return err(orderErr, 'placeOrder/insert');

    const orderItems = items.map(i => ({
      order_id:   order.id,
      product_id: i.product_id,
      name:       i.name,
      qty:        i.qty,
      price:      i.price,
    }));

    const { error: itemsErr } = await supabase.from('order_items').insert(orderItems);
    if (itemsErr) console.warn('[SETU API] placeOrder: items insert error', itemsErr);

    return ok(order);
  } catch (e) {
    return err(e, 'placeOrder');
  }
}

export async function updateOrderStatus(orderId, status, extra = {}) {
  const timestamps = {
    confirmed:   'confirmed_at',
    ready:       'ready_at',
    picked_up:   'picked_up_at',
    delivered:   'delivered_at',
    cancelled:   'cancelled_at',
  };
  const updates = {
    status,
    ...extra,
    ...(timestamps[status] ? { [timestamps[status]]: new Date().toISOString() } : {}),
  };
  return safeQuery(
    () => supabase.from('orders').update(updates).eq('id', orderId).select().single(),
    null,
    'updateOrderStatus'
  );
}

export async function rateOrder({ orderId, vendorRating, riderRating, comment }) {
  return safeQuery(
    () => supabase.from('orders').update({
      vendor_rating:   vendorRating,
      rider_rating:    riderRating,
      rating_comment:  comment,
      is_rated:        true,
    }).eq('id', orderId).select().single(),
    null,
    'rateOrder'
  );
}

// ── Riders ────────────────────────────────────────────────

export async function getRiderByUserId(userId) {
  return safeQuery(
    () => supabase.from('riders').select('*').eq('user_id', userId).maybeSingle(),
    null,
    'getRiderByUserId'
  );
}

export async function updateRiderStatus(riderId, isOnline) {
  return safeQuery(
    () => supabase.from('riders').update({ is_online: isOnline }).eq('id', riderId).select().single(),
    null,
    'updateRiderStatus'
  );
}

export async function getAvailableOrders(villageId) {
  // Orders that are 'ready' and have no rider assigned
  return safeQuery(
    () => supabase
      .from('orders')
      .select('*, order_items(name, qty)')
      .eq('status', 'ready')
      .is('rider_id', null)
      .eq('village_id', villageId)
      .order('created_at'),
    [],
    'getAvailableOrders'
  );
}

export async function assignRider(orderId, riderId, riderName) {
  return safeQuery(
    () => supabase.from('orders').update({
      rider_id:   riderId,
      rider_name: riderName,
      status:     'picked_up',
      picked_up_at: new Date().toISOString(),
    }).eq('id', orderId).select().single(),
    null,
    'assignRider'
  );
}

// ── Wallet ────────────────────────────────────────────────

export async function getWallet(userId) {
  return safeQuery(
    () => supabase.from('wallets').select('*').eq('user_id', userId).maybeSingle(),
    { balance: 0 },
    'getWallet'
  );
}

export async function getWalletTransactions(userId, { page = 0, limit = 20 } = {}) {
  return safeQuery(
    () => supabase
      .from('wallet_transactions')
      .select('*')
      .eq('user_id', userId)
      .range(page * limit, (page + 1) * limit - 1)
      .order('created_at', { ascending: false }),
    [],
    'getWalletTransactions'
  );
}

// ── Notifications ─────────────────────────────────────────

export async function getNotifications(userId, { limit = 30 } = {}) {
  return safeQuery(
    () => supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .limit(limit)
      .order('created_at', { ascending: false }),
    NOTIFICATIONS,
    'getNotifications'
  );
}

export async function markNotificationRead(id) {
  return safeQuery(
    () => supabase.from('notifications').update({ is_read: true }).eq('id', id),
    null,
    'markNotificationRead'
  );
}

export async function markAllNotificationsRead(userId) {
  return safeQuery(
    () => supabase.from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false),
    null,
    'markAllNotificationsRead'
  );
}

// ── Profile ───────────────────────────────────────────────

export async function updateProfile(userId, updates) {
  return safeQuery(
    () => supabase.from('profiles').update(updates).eq('id', userId).select().single(),
    null,
    'updateProfile'
  );
}

// ── Support ───────────────────────────────────────────────

export async function getSupportTickets(userId) {
  return safeQuery(
    () => supabase.from('support_tickets').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    [],
    'getSupportTickets'
  );
}

export async function createSupportTicket(payload) {
  return safeQuery(
    () => supabase.from('support_tickets').insert(payload).select().single(),
    null,
    'createSupportTicket'
  );
}

// ── Schemes ───────────────────────────────────────────────

export async function getSchemes({ category } = {}) {
  return safeQuery(() => {
    let q = supabase.from('schemes').select('*').eq('is_active', true).order('name');
    if (category) q = q.eq('category', category);
    return q;
  }, SCHEMES, 'getSchemes');
}

// ── Seva Providers ────────────────────────────────────────

export async function getSevaProviders({ villageId, category, page = 0, limit = 20 } = {}) {
  return safeQuery(() => {
    let q = supabase
      .from('seva_providers')
      .select('*')
      .eq('is_active', true)
      .eq('is_available', true)
      .range(page * limit, (page + 1) * limit - 1)
      .order('rating', { ascending: false });

    if (villageId) q = q.eq('village_id', villageId);
    if (category)  q = q.eq('category', category);
    return q;
  }, SEVA_PROVIDERS, 'getSevaProviders');
}

// ── Admin / Analytics ─────────────────────────────────────

export async function getAdminStats() {
  // Aggregate stats for admin dashboard
  if (!isSupabaseConfigured) return ok(null);
  try {
    const [
      { count: totalUsers },
      { count: totalOrders },
      { count: activeVendors },
      { count: activeRiders },
    ] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('orders').select('*', { count: 'exact', head: true }),
      supabase.from('vendors').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('riders').select('*', { count: 'exact', head: true }).eq('is_active', true),
    ]);
    return ok({ totalUsers, totalOrders, activeVendors, activeRiders });
  } catch (e) {
    return err(e, 'getAdminStats');
  }
}

// ── KYC ───────────────────────────────────────────────────

export async function getKycRecords(userId) {
  return safeQuery(
    () => supabase.from('kyc_records').select('*').eq('user_id', userId),
    [],
    'getKycRecords'
  );
}

export async function upsertKycRecord(record) {
  return safeQuery(
    () => supabase.from('kyc_records').upsert(record, { onConflict: 'user_id,type' }).select().single(),
    null,
    'upsertKycRecord'
  );
}

// ═══════════════════════════════════════════════════════════
// Legacy namespace wrappers for backward compatibility
// Components using OrderAPI.create(), etc. continue to work
// during the migration to flat function calls.
// ═══════════════════════════════════════════════════════════

export const OrderAPI = {
  create:        placeOrder,
  getDetail:     getOrderById,
  advanceStatus: updateOrderStatus,
  rate:          rateOrder,
};

export const PaymentAPI = {
  walletPay: async (userId, amount, orderId) => {
    // Stub — integrate Razorpay/UPI in Phase 2
    // For now: deduct from wallet table directly
    if (!isSupabaseConfigured) return ok({ balance: 0 });
    try {
      const { data: wallet } = await supabase
        .from('wallets')
        .select('balance')
        .eq('user_id', userId)
        .single();

      if (!wallet || wallet.balance < amount) {
        return err({ message: 'Insufficient balance' }, 'PaymentAPI.walletPay');
      }

      const { error } = await supabase.from('wallets')
        .update({ balance: wallet.balance - amount })
        .eq('user_id', userId);

      if (error) return err(error, 'PaymentAPI.walletPay');

      await supabase.from('wallet_transactions').insert({
        wallet_id:   wallet.id,
        user_id:     userId,
        type:        'debit',
        amount,
        description: `Order payment`,
        reference:   orderId,
        status:      'completed',
      });

      return ok({ balance: wallet.balance - amount });
    } catch (e) {
      return err(e, 'PaymentAPI.walletPay');
    }
  },
};

export const AIAPI = {
  voiceQuery: async (text) => {
    // Stub — integrate AI backend in Phase 2
    return ok({ response: `Searching for: ${text}` });
  },
};

// ═══════════════════════════════════════════════════════════
// Missing namespace API exports — fixes blank screen caused
// by broken named imports across the codebase
// ═══════════════════════════════════════════════════════════

export const NotificationAPI = {
  getAll:      (userId)      => getNotifications(userId),
  markRead:    (id)          => markNotificationRead(id),
  markAllRead: (userId)      => markAllNotificationsRead(userId),
};

export const CreditAPI = {
  getAccount:  (userId)      => safeQuery(
    () => supabase.from('credit_accounts').select('*').eq('user_id', userId).maybeSingle(),
    { credit_limit: 0, outstanding: 0, status: 'active', score: 500 },
    'CreditAPI.getAccount'
  ),
  getTransactions: (userId)  => getWalletTransactions(userId),
  applyCredit: async (userId, amount, purpose) => {
    // Stub — credit approval logic is server-side in Phase 2
    // For now: check limit, update outstanding
    if (!isSupabaseConfigured) return ok({ approved: false, message: 'Demo mode' });
    const { data: acct } = await CreditAPI.getAccount(userId);
    if (!acct) return err({ message: 'No credit account found' }, 'CreditAPI.applyCredit');
    const available = (acct.credit_limit || 0) - (acct.outstanding || 0);
    if (amount > available) {
      return err({ message: `Insufficient credit. Available: ₹${available}` }, 'CreditAPI.applyCredit');
    }
    return safeQuery(
      () => supabase.from('credit_accounts')
        .update({ outstanding: (acct.outstanding || 0) + amount })
        .eq('user_id', userId)
        .select().single(),
      null,
      'CreditAPI.applyCredit'
    );
  },
};

export const FraudAPI = {
  report: async (payload) => safeQuery(
    () => supabase.from('support_tickets').insert({
      ...payload,
      subject: `Fraud Report: ${payload.type || 'unknown'}`,
      priority: 'high',
    }).select().single(),
    null,
    'FraudAPI.report'
  ),
};

export const VendorAPI = {
  getOrders:       (vendorId, opts) => getOrdersByVendor(vendorId, opts),
  updateOrder:     (orderId, status, extra) => updateOrderStatus(orderId, status, extra),
  getProducts:     (vendorId)       => getProducts({ vendorId }),
  upsertProduct:   (data)           => upsertProduct(data),
  deleteProduct:   (id)             => deleteProduct(id),
  getProfile:      (ownerId)        => getVendorByOwnerId(ownerId),
  updateProfile:   (data)           => upsertVendorProfile(data),
};

export const RiderAPI = {
  getProfile:      (userId)         => getRiderByUserId(userId),
  updateStatus:    (riderId, online) => updateRiderStatus(riderId, online),
  getAvailableOrders: (villageId)   => getAvailableOrders(villageId),
  acceptOrder:     (orderId, riderId, riderName) => assignRider(orderId, riderId, riderName),
  updateOrder:     (orderId, status, extra) => updateOrderStatus(orderId, status, extra),
  getOrders:       (riderId, opts)  => getOrdersByRider(riderId, opts),
};

export const SevaAPI = {
  getProviders:    (opts)           => getSevaProviders(opts),
  getJobs:         async (userId)   => {
    // Seva jobs = orders assigned to this seva provider
    return safeQuery(
      () => supabase.from('orders').select('*').eq('customer_id', userId).order('created_at', { ascending: false }),
      [],
      'SevaAPI.getJobs'
    );
  },
};

// ─────────────────────────────────────────────────────────
// ANCHOR API
// All functions scoped to the anchor's village_id.
// ─────────────────────────────────────────────────────────

// ── KYC helpers ──────────────────────────────────────────

/** Fetch all kyc_records for users in the anchor's village.
 *  Joins profiles so we get name + role alongside each record. */
export async function getVillageKycRecords(villageId) {
  return safeQuery(
    () =>
      supabase
        .from('kyc_records')
        .select(`
          id, type, status, doc_url, failure_reason, created_at, updated_at,
          profiles!kyc_records_user_id_fkey(id, name, role, village_id)
        `)
        .eq('profiles.village_id', villageId)
        .order('created_at', { ascending: false }),
    [],
    'getVillageKycRecords'
  );
}

/** Anchor approves a KYC record (sets status → verified). */
export async function approveKycRecord(kycId) {
  return safeQuery(
    () =>
      supabase
        .from('kyc_records')
        .update({ status: 'verified', verified_at: new Date().toISOString() })
        .eq('id', kycId)
        .select()
        .single(),
    null,
    'approveKycRecord'
  );
}

/** Anchor rejects a KYC record (sets status → rejected + reason). */
export async function rejectKycRecord(kycId, reason = 'Rejected by anchor') {
  return safeQuery(
    () =>
      supabase
        .from('kyc_records')
        .update({ status: 'rejected', failure_reason: reason })
        .eq('id', kycId)
        .select()
        .single(),
    null,
    'rejectKycRecord'
  );
}

// ── Village stats ─────────────────────────────────────────

/** Aggregate stats for the anchor's village dashboard. */
export async function getVillageStats(villageId) {
  const [ordersRes, vendorsRes, ridersRes, kycRes] = await Promise.all([
    supabase
      .from('orders')
      .select('id, status, total', { count: 'exact' })
      .eq('village_id', villageId),
    supabase
      .from('vendors')
      .select('id, is_open', { count: 'exact' })
      .eq('village_id', villageId),
    supabase
      .from('riders')
      .select('id, is_online', { count: 'exact' })
      .eq('village_id', villageId),
    supabase
      .from('kyc_records')
      .select('id, status', { count: 'exact' })
      .eq('profiles.village_id', villageId),
  ]);

  const orders  = ordersRes.data  ?? [];
  const vendors = vendorsRes.data ?? [];
  const riders  = ridersRes.data  ?? [];
  const kyc     = kycRes.data     ?? [];

  return {
    data: {
      totalOrders:    orders.length,
      activeOrders:   orders.filter(o => !['delivered','cancelled'].includes(o.status)).length,
      totalGMV:       orders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + (o.total || 0), 0),
      totalVendors:   vendors.length,
      activeVendors:  vendors.filter(v => v.is_open).length,
      totalRiders:    riders.length,
      onlineRiders:   riders.filter(r => r.is_online).length,
      pendingKYC:     kyc.filter(k => k.status === 'pending' || k.status === 'submitted').length,
    },
    error: ordersRes.error || vendorsRes.error || ridersRes.error,
  };
}

// ── Noticeboard ──────────────────────────────────────────

export async function getNotices(villageId) {
  return safeQuery(
    () =>
      supabase
        .from('noticeboard')
        .select('id, title, body, type, is_pinned, created_at, profiles!noticeboard_created_by_fkey(name)')
        .eq('village_id', villageId)
        .order('is_pinned', { ascending: false })
        .order('created_at',  { ascending: false }),
    [],
    'getNotices'
  );
}

export async function createNotice({ villageId, title, body, type = 'general', isPinned = false, createdBy }) {
  return safeQuery(
    () =>
      supabase
        .from('noticeboard')
        .insert({ village_id: villageId, title, body, type, is_pinned: isPinned, created_by: createdBy })
        .select()
        .single(),
    null,
    'createNotice'
  );
}

export async function deleteNotice(noticeId) {
  return safeQuery(
    () => supabase.from('noticeboard').delete().eq('id', noticeId),
    null,
    'deleteNotice'
  );
}

// ── Disputes ─────────────────────────────────────────────

export async function getDisputes(villageId) {
  return safeQuery(
    () =>
      supabase
        .from('disputes')
        .select(`
          id, title, description, status, amount, resolution, created_at,
          order_id,
          reporter:profiles!disputes_reporter_id_fkey(id, name, role),
          resolver:profiles!disputes_resolved_by_fkey(id, name),
          dispute_parties(user_id, role, statement, profiles!dispute_parties_user_id_fkey(name, role))
        `)
        .eq('village_id', villageId)
        .order('created_at', { ascending: false }),
    [],
    'getDisputes'
  );
}

export async function resolveDispute(disputeId, resolution, resolvedBy) {
  return safeQuery(
    () =>
      supabase
        .from('disputes')
        .update({
          status:      'resolved',
          resolution,
          resolved_by: resolvedBy,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', disputeId)
        .select()
        .single(),
    null,
    'resolveDispute'
  );
}

export async function escalateDispute(disputeId) {
  return safeQuery(
    () =>
      supabase
        .from('disputes')
        .update({ status: 'escalated' })
        .eq('id', disputeId)
        .select()
        .single(),
    null,
    'escalateDispute'
  );
}

// ── Escalations ──────────────────────────────────────────

export async function getEscalations(villageId) {
  return safeQuery(
    () =>
      supabase
        .from('escalations')
        .select(`
          id, title, description, status, priority, notes, created_at, resolved_at,
          dispute_id,
          raiser:profiles!escalations_escalated_by_fkey(id, name, role),
          assignee:profiles!escalations_escalated_to_fkey(id, name)
        `)
        .eq('village_id', villageId)
        .order('created_at', { ascending: false }),
    [],
    'getEscalations'
  );
}

export async function createEscalation({ disputeId, escalatedBy, villageId, title, description, priority = 'medium' }) {
  return safeQuery(
    () =>
      supabase
        .from('escalations')
        .insert({
          dispute_id:   disputeId,
          escalated_by: escalatedBy,
          village_id:   villageId,
          title,
          description,
          priority,
        })
        .select()
        .single(),
    null,
    'createEscalation'
  );
}

export async function resolveEscalation(escalationId, notes) {
  return safeQuery(
    () =>
      supabase
        .from('escalations')
        .update({ status: 'resolved', notes, resolved_at: new Date().toISOString() })
        .eq('id', escalationId)
        .select()
        .single(),
    null,
    'resolveEscalation'
  );
}

export const AnchorAPI = {
  // KYC
  getVillageKycRecords,
  approveKycRecord,
  rejectKycRecord,
  // Village
  getVillageStats,
  getVillages,
  getVillageById,
  getVendors,
  getSevaProviders,
  // Noticeboard
  getNotices,
  createNotice,
  deleteNotice,
  // Disputes
  getDisputes,
  resolveDispute,
  escalateDispute,
  // Escalations
  getEscalations,
  createEscalation,
  resolveEscalation,
};

export const AdminAPI = {
  getStats:        ()               => getAdminStats(),
  getOrders:       (opts)           => safeQuery(
    () => supabase.from('orders').select('*, order_items(*)').order('created_at', { ascending: false }).limit(100),
    [],
    'AdminAPI.getOrders'
  ),
  getVendors:      ()               => safeQuery(
    () => supabase.from('vendors').select('*').order('created_at', { ascending: false }),
    [],
    'AdminAPI.getVendors'
  ),
  getRiders:       ()               => safeQuery(
    () => supabase.from('riders').select('*').order('created_at', { ascending: false }),
    [],
    'AdminAPI.getRiders'
  ),
  getUsers:        ()               => safeQuery(
    () => supabase.from('profiles').select('*').order('created_at', { ascending: false }),
    [],
    'AdminAPI.getUsers'
  ),
  approveVendor:   (vendorId)       => safeQuery(
    () => supabase.from('vendors').update({ is_verified: true, kyc_status: 'approved' }).eq('id', vendorId).select().single(),
    null,
    'AdminAPI.approveVendor'
  ),
  rejectVendor:    (vendorId, reason) => safeQuery(
    () => supabase.from('vendors').update({ kyc_status: 'rejected' }).eq('id', vendorId).select().single(),
    null,
    'AdminAPI.rejectVendor'
  ),
  updateCashBalance: async (riderId, amount) => safeQuery(
    () => supabase.from('riders').update({ cod_balance: amount }).eq('id', riderId).select().single(),
    null,
    'AdminAPI.updateCashBalance'
  ),
};
