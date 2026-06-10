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
  // Route through the security-definer RPC.
  // • Enforces valid state-machine transitions (pending→confirmed→... etc.)
  // • Internally sets setu.internal_payment_update so the
  //   guard_payment_status_change trigger allows the write.
  // • Logs every transition to audit_log.
  return safeQuery(
    () =>
      supabase.rpc('update_order_status', {
        p_order_id:   orderId,
        p_new_status: status,
        p_actor_id:   null,   // auth.uid() resolved inside the function
        p_meta:       extra,
      }),
    null,
    'updateOrderStatus'
  );
}

// ── cancelOrderWithRefund ─────────────────────────────────
// Atomic cancel + auto-refund in one DB transaction.
// Replaces the pattern: updateOrderStatus(id,'cancelled') + manual wallet credit.
export async function cancelOrderWithRefund(orderId, actorId, actorRole = 'customer', reason = null) {
  if (!isSupabaseConfigured) return ok({ refund_amount: 0 });
  try {
    const { data, error } = await supabase.rpc('cancel_order_with_refund', {
      p_order_id:   orderId,
      p_actor_id:   actorId,
      p_actor_role: actorRole,
      p_reason:     reason ?? null,
    });
    if (error) return err(error, 'cancelOrderWithRefund');
    if (!data?.success) return err({ message: data?.error ?? 'Cancel failed' }, 'cancelOrderWithRefund');
    return ok(data);
  } catch (e) {
    return err(e, 'cancelOrderWithRefund');
  }
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
  cancel:        cancelOrderWithRefund,  // atomic cancel + auto-refund
};

export const PaymentAPI = {
  /**
   * Deduct from wallet via pay_from_wallet() security-definer RPC.
   * This is the ONLY permitted way to debit a wallet from the frontend.
   * Atomic single UPDATE WHERE balance >= amount; writes wallet_transactions
   * audit row inside the same transaction.
   */
  walletPay: async (userId, amount, orderId) => {
    if (!isSupabaseConfigured) return ok({ balance: 0 });
    try {
      const { data, error } = await supabase.rpc('pay_from_wallet', {
        p_user_id:  userId,
        p_amount:   amount,
        p_order_id: orderId ?? null,
      });

      if (error) return err(error, 'PaymentAPI.walletPay');

      if (!data?.success) {
        if (data?.insufficient_funds) {
          return err(
            {
              message:            `Insufficient wallet balance. Available: ₹${(data.balance ?? 0).toFixed(2)}`,
              insufficient_funds: true,
              balance:            data.balance,
            },
            'PaymentAPI.walletPay'
          );
        }
        return err({ message: data?.error ?? 'Wallet payment failed' }, 'PaymentAPI.walletPay');
      }

      return ok({ balance: data.new_balance });
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

// ── Rider COD Deposit ─────────────────────────────────────
/**
 * Insert a pending COD deposit row.
 * riderId here is riders.id (PK), not auth user.id.
 */
export async function submitCODDeposit(riderId, amount, denominationBreakdown = null) {
  return safeQuery(
    () =>
      supabase
        .from('cod_deposits')
        .insert({
          rider_id:               riderId,
          amount,
          status:                 'pending_confirmation',
          denomination_breakdown: denominationBreakdown,
          created_at:             new Date().toISOString(),
        })
        .select()
        .single(),
    null,
    'submitCODDeposit'
  );
}

// ── Rider Earnings ────────────────────────────────────────
/**
 * Fetch wallet_transactions for a rider's auth user_id, grouped into
 * a simple earnings summary.  period: 'week' | 'month' | 'all'
 */
export async function getRiderEarnings(userId, { period = 'month' } = {}) {
  const cutoff = new Date();
  if (period === 'week')  cutoff.setDate(cutoff.getDate() - 7);
  if (period === 'month') cutoff.setMonth(cutoff.getMonth() - 1);

  return safeQuery(
    () =>
      supabase
        .from('wallet_transactions')
        .select('id, amount, type, description, created_at')
        .eq('user_id', userId)
        .gte('created_at', period === 'all' ? '1970-01-01' : cutoff.toISOString())
        .order('created_at', { ascending: false }),
    [],
    'getRiderEarnings'
  );
}

export const RiderAPI = {
  getProfile:         (userId)                        => getRiderByUserId(userId),
  updateStatus:       (riderId, online)               => updateRiderStatus(riderId, online),
  getAvailableOrders: (villageId)                     => getAvailableOrders(villageId),
  acceptOrder:        (orderId, riderId, riderName)   => assignRider(orderId, riderId, riderName),
  updateOrder:        (orderId, status, extra)        => updateOrderStatus(orderId, status, extra),
  getOrders:          (riderId, opts)                 => getOrdersByRider(riderId, opts),
  submitCODDeposit:   (riderId, amount, denomMap)     => submitCODDeposit(riderId, amount, denomMap),
  getEarnings:        (userId, opts)                  => getRiderEarnings(userId, opts),
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

// ─────────────────────────────────────────────────────────
// ADMIN API — extended functions
// ─────────────────────────────────────────────────────────

/** Richer dashboard aggregate: orders, vendors, riders, KYC counts, COD totals. */
export async function getAdminDashboardStats() {
  if (!isSupabaseConfigured) return ok(null);
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      ordersRes,
      todayOrdersRes,
      vendorsRes,
      ridersRes,
      supportRes,
      depositsRes,
    ] = await Promise.all([
      supabase.from('orders').select('id, status, total, rider_id, payment_method'),
      supabase.from('orders').select('id, status, total').gte('created_at', today.toISOString()),
      supabase.from('vendors').select('id, is_open, is_verified, kyc_status'),
      supabase.from('riders').select('id, is_online, is_active, cod_balance'),
      supabase.from('support_tickets').select('id, status'),
      supabase.from('cod_deposits').select('id, amount, status'),
    ]);

    const orders      = ordersRes.data      ?? [];
    const todayOrders = todayOrdersRes.data ?? [];
    const vendors     = vendorsRes.data     ?? [];
    const ridersList  = ridersRes.data      ?? [];
    const tickets     = supportRes.data     ?? [];
    const deposits    = depositsRes.data    ?? [];

    return ok({
      totalOrders:     orders.length,
      activeOrders:    orders.filter(o => !['delivered','cancelled'].includes(o.status)).length,
      pendingAssign:   orders.filter(o => !o.rider_id && !['delivered','cancelled'].includes(o.status)).length,
      todayOrders:     todayOrders.length,
      todayRevenue:    todayOrders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + (Number(o.total) || 0), 0),
      totalRevenue:    orders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + (Number(o.total) || 0), 0),
      activeVendors:   vendors.filter(v => v.is_open).length,
      totalVendors:    vendors.length,
      pendingVendors:  vendors.filter(v => !v.is_verified && v.kyc_status !== 'rejected').length,
      onlineRiders:    ridersList.filter(r => r.is_online).length,
      totalRiders:     ridersList.length,
      openTickets:     tickets.filter(t => t.status === 'open').length,
      totalCOD:        orders.filter(o => o.payment_method === 'COD' && o.status === 'delivered').reduce((s, o) => s + (Number(o.total) || 0), 0),
      pendingDeposits: deposits.filter(d => d.status === 'pending_confirmation').reduce((s, d) => s + (Number(d.amount) || 0), 0),
      riderCODBalance: ridersList.reduce((s, r) => s + (Number(r.cod_balance) || 0), 0),
    });
  } catch (e) {
    return err(e, 'getAdminDashboardStats');
  }
}

/** Hourly order distribution for today (for the bar chart). */
export async function getTodayHourlyOrders() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const { data } = await supabase
    .from('orders')
    .select('created_at')
    .gte('created_at', today.toISOString());

  const buckets = Array.from({ length: 24 }, (_, i) => ({
    hr: `${i === 0 ? 12 : i > 12 ? i - 12 : i}${i < 12 ? 'AM' : 'PM'}`,
    orders: 0,
  }));
  (data ?? []).forEach(o => {
    const h = new Date(o.created_at).getHours();
    buckets[h].orders++;
  });
  // Return only 6AM–10PM for display
  return { data: buckets.filter((_, i) => i >= 6 && i <= 22), error: null };
}

/** Admin: get ALL support tickets with reporter profile joined. */
export async function getAdminSupportTickets({ status } = {}) {
  let q = supabase
    .from('support_tickets')
    .select('*, profiles!support_tickets_user_id_fkey(id, name, role, phone)')
    .order('created_at', { ascending: false });
  if (status) q = q.eq('status', status);
  return safeQuery(() => q, [], 'getAdminSupportTickets');
}

/** Admin: append a reply message to a ticket's messages jsonb array. */
export async function replyToTicket(ticketId, adminName, text) {
  const { data: ticket } = await supabase
    .from('support_tickets')
    .select('messages')
    .eq('id', ticketId)
    .single();

  const current = Array.isArray(ticket?.messages) ? ticket.messages : [];
  const newMsg  = {
    from: 'admin',
    name: adminName,
    text,
    time: new Date().toLocaleTimeString('en-IN', { timeStyle: 'short' }),
  };
  return safeQuery(
    () => supabase
      .from('support_tickets')
      .update({ messages: [...current, newMsg] })
      .eq('id', ticketId)
      .select()
      .single(),
    null,
    'replyToTicket'
  );
}

/** Admin: resolve a support ticket. */
export async function resolveTicket(ticketId) {
  return safeQuery(
    () => supabase
      .from('support_tickets')
      .update({ status: 'resolved', resolved_at: new Date().toISOString() })
      .eq('id', ticketId)
      .select()
      .single(),
    null,
    'resolveTicket'
  );
}

/** Admin: get all riders with live order counts joined. */
export async function getAdminRiders() {
  return safeQuery(
    () => supabase
      .from('riders')
      .select('id, name, phone, zone, vehicle_type, vehicle_number, is_online, is_active, is_verified, rating, total_deliveries, today_deliveries, today_earnings, cod_balance, kyc_status, village_id, created_at')
      .order('is_online', { ascending: false })
      .order('name'),
    [],
    'getAdminRiders'
  );
}

/** Admin: toggle rider active status. */
export async function setRiderActive(riderId, isActive) {
  return safeQuery(
    () => supabase.from('riders').update({ is_active: isActive }).eq('id', riderId).select().single(),
    null,
    'setRiderActive'
  );
}

/** Admin: get all vendors. */
export async function getAdminVendors() {
  return safeQuery(
    () => supabase
      .from('vendors')
      .select('id, name, category, village, village_id, phone, image_url, rating, review_count, is_open, is_verified, is_active, kyc_status, subscription_tier, created_at')
      .order('created_at', { ascending: false }),
    [],
    'getAdminVendors'
  );
}

/** Admin: toggle vendor is_open. */
export async function setVendorOpen(vendorId, isOpen) {
  return safeQuery(
    () => supabase.from('vendors').update({ is_open: isOpen }).eq('id', vendorId).select().single(),
    null,
    'setVendorOpen'
  );
}

/** Admin: get all seva providers. */
export async function getAdminSevaProviders() {
  return safeQuery(
    () => supabase
      .from('seva_providers')
      .select('id, name, category, village, village_id, phone, image_url, rating, review_count, is_available, is_verified, hourly_rate, experience, jobs_completed, kyc_status, created_at')
      .order('created_at', { ascending: false }),
    [],
    'getAdminSevaProviders'
  );
}

/** Admin: toggle seva provider availability. */
export async function setSevaAvailable(providerId, isAvailable) {
  return safeQuery(
    () => supabase.from('seva_providers').update({ is_available: isAvailable }).eq('id', providerId).select().single(),
    null,
    'setSevaAvailable'
  );
}

/** Admin: get all villages with per-village order/vendor aggregates. */
export async function getAdminVillages() {
  const [villagesRes, ordersRes, vendorsRes] = await Promise.all([
    supabase.from('villages').select('*').order('name'),
    supabase.from('orders').select('id, village_id, status'),
    supabase.from('vendors').select('id, village_id, is_open, is_verified'),
  ]);

  const orders  = ordersRes.data  ?? [];
  const vendors = vendorsRes.data ?? [];

  const villages = (villagesRes.data ?? []).map(v => {
    const vOrders  = orders.filter(o => o.village_id === v.id);
    const vVendors = vendors.filter(vn => vn.village_id === v.id);
    const health   = v.is_active
      ? Math.min(100, 30 + vVendors.filter(vn => vn.is_open).length * 10 + Math.min(vOrders.length, 20) * 2)
      : 0;
    return {
      ...v,
      totalOrders:   vOrders.length,
      activeVendors: vVendors.filter(vn => vn.is_open).length,
      totalVendors:  vVendors.length,
      health,
    };
  });

  return { data: villages, error: villagesRes.error };
}

/** Admin: get all orders with rider info. */
export async function getAdminOrders({ limit = 100 } = {}) {
  return safeQuery(
    () => supabase
      .from('orders')
      .select('id, order_number, status, total, payment_method, payment_status, village, village_id, created_at, rider_id, rider_name, customer_name, vendor_name')
      .order('created_at', { ascending: false })
      .limit(limit),
    [],
    'getAdminOrders'
  );
}

/** Admin: assign a rider to an order. */
export async function adminAssignRider(orderId, riderId, riderName) {
  return safeQuery(
    () => supabase
      .from('orders')
      .update({ rider_id: riderId, rider_name: riderName, status: 'confirmed' })
      .eq('id', orderId)
      .select()
      .single(),
    null,
    'adminAssignRider'
  );
}

/** Admin: confirm a COD deposit from a rider. */
export async function confirmCODDeposit(depositId, adminUserId) {
  return safeQuery(
    () => supabase
      .from('cod_deposits')
      .update({
        status:             'confirmed',
        admin_confirmed_by:  adminUserId,
        admin_confirmed_at:  new Date().toISOString(),
      })
      .eq('id', depositId)
      .select()
      .single(),
    null,
    'confirmCODDeposit'
  );
}

/** Admin: dispute a COD deposit. */
export async function disputeCODDeposit(depositId) {
  return safeQuery(
    () => supabase.from('cod_deposits').update({ status: 'disputed' }).eq('id', depositId).select().single(),
    null,
    'disputeCODDeposit'
  );
}

/** Admin: fetch all COD deposits with rider names. */
export async function getCODDeposits() {
  return safeQuery(
    () => supabase
      .from('cod_deposits')
      .select('*, riders(id, name, zone, cod_balance, phone)')
      .order('created_at', { ascending: false }),
    [],
    'getCODDeposits'
  );
}

export const AdminAPI = {
  // Stats
  getStats:          ()                       => getAdminDashboardStats(),
  getHourlyOrders:   ()                       => getTodayHourlyOrders(),
  // Orders
  getOrders:         (opts)                   => getAdminOrders(opts),
  assignRider:       (orderId, riderId, name) => adminAssignRider(orderId, riderId, name),
  // Vendors
  getVendors:        ()                       => getAdminVendors(),
  setVendorOpen:     (id, open)               => setVendorOpen(id, open),
  approveVendor:     (vendorId)               => safeQuery(
    () => supabase.from('vendors').update({ is_verified: true, kyc_status: 'approved' }).eq('id', vendorId).select().single(),
    null, 'AdminAPI.approveVendor'
  ),
  rejectVendor:      (vendorId)               => safeQuery(
    () => supabase.from('vendors').update({ kyc_status: 'rejected' }).eq('id', vendorId).select().single(),
    null, 'AdminAPI.rejectVendor'
  ),
  // Riders
  getRiders:         ()                       => getAdminRiders(),
  setRiderActive:    (id, active)             => setRiderActive(id, active),
  updateCashBalance: (riderId, amount)        => safeQuery(
    () => supabase.from('riders').update({ cod_balance: amount }).eq('id', riderId).select().single(),
    null, 'AdminAPI.updateCashBalance'
  ),
  // Seva Providers
  getSevaProviders:  ()                       => getAdminSevaProviders(),
  setSevaAvailable:  (id, avail)              => setSevaAvailable(id, avail),
  // Villages
  getVillages:       ()                       => getAdminVillages(),
  // Support
  getSupportTickets: (opts)                   => getAdminSupportTickets(opts),
  replyToTicket:     (id, name, text)         => replyToTicket(id, name, text),
  resolveTicket:     (id)                     => resolveTicket(id),
  // COD / Cash
  getCODDeposits:    ()                       => getCODDeposits(),
  confirmCODDeposit: (depositId, adminUserId) => confirmCODDeposit(depositId, adminUserId),
  disputeCODDeposit: (depositId)              => disputeCODDeposit(depositId),
  // Legacy
  getUsers:          ()                       => safeQuery(
    () => supabase.from('profiles').select('*').order('created_at', { ascending: false }),
    [], 'AdminAPI.getUsers'
  ),
};
