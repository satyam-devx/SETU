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

import { supabase, supabaseRead, isSupabaseConfigured } from './supabase';
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
    () => supabaseRead
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
    () => supabaseRead.from('categories').select('*').eq('is_active', true).order('sort_order'),
    CATEGORIES,
    'getCategories'
  );
}

// ── Vendors ───────────────────────────────────────────────

export async function getVendors({ villageId, category, page = 0, limit = 20 } = {}) {
  return safeQuery(() => {
    let q = supabaseRead
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
    let q = supabaseRead
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
  // orderPayload: { vendor_id, village_id, items:[{product_id, qty}],
  //                 payment_method, delivery_address, delivery_notes, use_credit }
  //
  // SECURITY (audit CRITICAL-A): order creation is now a single
  // server-authoritative RPC. The client no longer sends prices or
  // totals — create_order() recomputes subtotal/fees/total from the
  // products table, decrements stock atomically, and (CRITICAL-C)
  // only grants the SETU Credit discount against a real, sufficient
  // credit account. The customer is always auth.uid() server-side.
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

  try {
    const { data, error } = await supabase.rpc('create_order', {
      p_vendor_id:        orderPayload.vendor_id,
      p_items:            (orderPayload.items || []).map(i => ({
        product_id: i.product_id,
        qty:        i.qty,
      })),
      p_payment_method:   orderPayload.payment_method,
      p_delivery_address: orderPayload.delivery_address ?? null,
      p_village_id:       orderPayload.village_id ?? null,
      p_delivery_notes:   orderPayload.delivery_notes ?? null,
      p_use_credit:       !!orderPayload.use_credit,
      p_coupon_code:      orderPayload.coupon_code ?? null,
    });

    if (error) return err(error, 'placeOrder/create_order');
    if (!data?.success) return err({ message: data?.error ?? 'Could not place order' }, 'placeOrder');

    // Normalise to the shape callers expect (order row with id/total/...).
    return ok(data);
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
  // Routed through the rate_order RPC (security definer, self-guarded to
  // customer_id = auth.uid()). Direct client UPDATE on orders is locked
  // down — see migration 050.
  return safeQuery(
    () => supabase.rpc('rate_order', {
      p_order_id:      orderId,
      p_vendor_rating: vendorRating,
      p_rider_rating:  riderRating,
      p_comment:       comment,
    }),
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

export async function assignRider(orderId, _riderId, _riderName) {
  // Rider self-claim of an unassigned 'ready' order. Routed through the
  // claim_order RPC (security definer): the rider is derived server-side
  // from auth.uid() and the order is row-locked, so a client can neither
  // claim on another rider's behalf nor double-claim. The riderId/riderName
  // args are ignored (kept for call-site compatibility). See migration 050.
  return safeQuery(
    () => supabase.rpc('claim_order', { p_order_id: orderId }),
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

// ── Customer Addresses ──────────────────────────────────────

export async function getAddresses(userId) {
  return safeQuery(
    () => supabase
      .from('customer_addresses')
      .select('*')
      .eq('user_id', userId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true }),
    [],
    'getAddresses'
  );
}

export async function createAddress(userId, address) {
  return safeQuery(
    () => supabase
      .from('customer_addresses')
      .insert({
        user_id:    userId,
        label:      address.label,
        address:    address.address,
        landmark:   address.landmark || null,
        is_default: !!address.isDefault,
      })
      .select()
      .single(),
    null,
    'createAddress'
  );
}

export async function updateAddress(addressId, updates) {
  const payload = {};
  if (updates.label      !== undefined) payload.label      = updates.label;
  if (updates.address    !== undefined) payload.address    = updates.address;
  if (updates.landmark   !== undefined) payload.landmark   = updates.landmark || null;
  if (updates.isDefault  !== undefined) payload.is_default = updates.isDefault;

  return safeQuery(
    () => supabase
      .from('customer_addresses')
      .update(payload)
      .eq('id', addressId)
      .select()
      .single(),
    null,
    'updateAddress'
  );
}

export async function setDefaultAddress(addressId) {
  return safeQuery(
    () => supabase
      .from('customer_addresses')
      .update({ is_default: true })
      .eq('id', addressId)
      .select()
      .single(),
    null,
    'setDefaultAddress'
  );
}

export async function deleteAddress(addressId) {
  return safeQuery(
    () => supabase
      .from('customer_addresses')
      .delete()
      .eq('id', addressId),
    null,
    'deleteAddress'
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
    let q = supabaseRead.from('schemes').select('*').eq('is_active', true).order('name');
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
  // Reads the cached admin_dashboard_stats materialized view via the
  // admin-gated get_admin_stats() RPC — no full COUNT(*) scans on the
  // request path (audit Phase-3 perf fix). MV refreshes every 5 min.
  if (!isSupabaseConfigured) return ok(null);
  try {
    const { data, error } = await supabase.rpc('get_admin_stats');
    if (error) return err(error, 'getAdminStats');
    return ok({
      totalUsers:    data?.total_users    ?? 0,
      totalOrders:   data?.total_orders   ?? 0,
      activeVendors: data?.active_vendors  ?? 0,
      activeRiders:  data?.active_riders   ?? 0,
      gmv:           data?.gmv             ?? 0,
      orders24h:     data?.orders_24h      ?? 0,
      refreshedAt:   data?.refreshed_at    ?? null,
    });
  } catch (e) {
    return err(e, 'getAdminStats');
  }
}

// ── Fee config (single source of truth) ───────────────────
// Mirrors the server-side get_fee_config() the order RPCs use, so the
// checkout estimate matches the authoritative total.
export async function getFeeConfig() {
  return safeQuery(
    () => supabase.rpc('get_fee_config'),
    { commission_pct: 1, delivery_flat: 20, free_threshold: 200, rider_fee: 80, credit_discount_pct: 10, credit_discount_max: 500 },
    'getFeeConfig'
  );
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

  /**
   * Pay for an order from wallet via pay_order_from_wallet() RPC.
   * Charges the order's AUTHORITATIVE server-side total (not a
   * client-supplied amount — audit fix #4), confirms the order, and
   * credits vendor escrow atomically. Preferred over walletPay for
   * the checkout flow.
   */
  payOrderFromWallet: async (orderId) => {
    if (!isSupabaseConfigured) return ok({ new_balance: 0 });
    try {
      const { data, error } = await supabase.rpc('pay_order_from_wallet', {
        p_order_id: orderId,
      });
      if (error) return err(error, 'PaymentAPI.payOrderFromWallet');
      if (!data?.success) {
        if (data?.insufficient_funds) {
          return err(
            {
              message:            `Insufficient wallet balance. Available: ₹${(data.balance ?? 0).toFixed(2)}, Required: ₹${(data.required ?? 0).toFixed(2)}`,
              insufficient_funds: true,
              balance:            data.balance,
            },
            'PaymentAPI.payOrderFromWallet'
          );
        }
        return err({ message: data?.error ?? 'Wallet payment failed' }, 'PaymentAPI.payOrderFromWallet');
      }
      return ok({ new_balance: data.new_balance, total: data.total });
    } catch (e) {
      return err(e, 'PaymentAPI.payOrderFromWallet');
    }
  },
};

export const AIAPI = {
  // Calls the real, authenticated ai-assistant Edge Function (Anthropic-
  // backed, rate-limited + daily-capped server-side). Returns the
  // assistant reply + any suggested actions. The user's JWT is attached
  // automatically by supabase.functions.invoke.
  voiceQuery: async (text, context = null) => {
    if (!isSupabaseConfigured) {
      return ok({ response: `Searching for: ${text}`, reply: `Searching for: ${text}`, suggestedActions: [] });
    }
    try {
      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: { message: text, context },
      });
      if (error) return err(error, 'AIAPI.voiceQuery');
      return ok({ ...data, response: data?.reply ?? '' });
    } catch (e) {
      return err(e, 'AIAPI.voiceQuery');
    }
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
    // SERVER-SIDE only: routes through the request_credit() RPC which
    // validates the limit and records a PENDING credit_disbursements
    // application (audited). The old client-side check + direct
    // outstanding UPDATE was a privilege-escalation hole.
    if (!isSupabaseConfigured) return ok({ success: false, message: 'Demo mode' });
    const { data, error: e } = await supabase.rpc('request_credit', {
      p_amount:  amount,
      p_purpose: purpose ?? null,
    });
    if (e) return err(e, 'CreditAPI.applyCredit');
    return ok(data);
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

// ── Rider live location ───────────────────────────────────
/**
 * Insert a GPS ping for a rider. riderId is riders.id (PK), not auth uid.
 * rider_locations.rider_id → riders.id (FK), so passing the auth uid here
 * would violate the FK — callers must resolve riders.id first.
 */
export async function updateRiderLocation(riderId, lat, lng, isOnDelivery = false) {
  return safeQuery(
    () => supabase.from('rider_locations').insert({
      rider_id:       riderId,
      lat,
      lng,
      is_on_delivery: isOnDelivery,
    }),
    null,
    'updateRiderLocation'
  );
}

export const RiderAPI = {
  getProfile:         (userId)                        => getRiderByUserId(userId),
  updateStatus:       (riderId, online)               => updateRiderStatus(riderId, online),
  toggleOnline:       (riderId, online)               => updateRiderStatus(riderId, online),
  getAvailableOrders: (villageId)                     => getAvailableOrders(villageId),
  acceptOrder:        (orderId, riderId, riderName)   => assignRider(orderId, riderId, riderName),
  updateOrder:        (orderId, status, extra)        => updateOrderStatus(orderId, status, extra),
  markDelivered:      (orderId, meta)                 => updateOrderStatus(orderId, 'delivered', meta),
  updateLocation:     (riderId, lat, lng)             => updateRiderLocation(riderId, lat, lng),
  getOrders:          (riderId, opts)                 => getOrdersByRider(riderId, opts),
  submitCODDeposit:   (riderId, amount, denomMap)     => submitCODDeposit(riderId, amount, denomMap),
  getEarnings:        (userId, opts)                  => getRiderEarnings(userId, opts),
};

export const SevaAPI = {
  getProviders:    (opts)           => getSevaProviders(opts),

  // Resolve the seva_providers row for the logged-in user (own-read RLS).
  getMyProvider:   async (userId)   => safeQuery(
    () => supabase.from('seva_providers').select('*').eq('user_id', userId).maybeSingle(),
    null,
    'SevaAPI.getMyProvider'
  ),

  // Open jobs available to claim (RLS: status='open' visible to seva_providers).
  getOpenJobs:     async ({ category } = {}) => safeQuery(
    () => {
      let q = supabase.from('seva_jobs').select('*').eq('status', 'open');
      if (category && category !== 'All') q = q.eq('category', category);
      return q.order('created_at', { ascending: false });
    },
    [],
    'SevaAPI.getOpenJobs'
  ),

  // Claim an open job (SECURITY DEFINER RPC — direct update is RLS-blocked).
  acceptJob:       async (jobId)    => {
    if (!isSupabaseConfigured) return ok({ success: true });
    const { data, error } = await supabase.rpc('accept_seva_job', { p_job_id: jobId });
    if (error) return err(error, 'SevaAPI.acceptJob');
    return ok(data);
  },

  // Mark an accepted job complete (credits provider stats).
  completeJob:     async (jobId, { notes } = {}) => {
    if (!isSupabaseConfigured) return ok({ success: true });
    const { data, error } = await supabase.rpc('complete_seva_job', { p_job_id: jobId, p_notes: notes ?? null });
    if (error) return err(error, 'SevaAPI.completeJob');
    return ok(data);
  },

  // A single job by id (for the detail screen).
  getJobById:      async (jobId)    => safeQuery(
    () => supabase.from('seva_jobs').select('*').eq('id', jobId).single(),
    null,
    'SevaAPI.getJobById'
  ),

  // Provider toggles their own availability (own_update RLS).
  setAvailable:    async (providerId, isAvailable) => safeQuery(
    () => supabase.from('seva_providers')
      .update({ is_available: isAvailable, updated_at: new Date().toISOString() })
      .eq('id', providerId).select().single(),
    null,
    'SevaAPI.setAvailable'
  ),

  // Provider marks an accepted job as started (own-job update RLS).
  startJob:        async (jobId)    => safeQuery(
    () => supabase.from('seva_jobs')
      .update({ status: 'in_progress', updated_at: new Date().toISOString() })
      .eq('id', jobId).select().single(),
    null,
    'SevaAPI.startJob'
  ),

  // Create or update the caller's seva_providers row (own_insert/own_update RLS).
  // New providers start unverified + offline with kyc_status='pending' — an
  // admin verifies and assigns the seva_provider role before they go live.
  saveProvider:    async (userId, data) => {
    if (!isSupabaseConfigured) return ok({ id: 'demo', ...data });
    const { data: existing } = await supabase
      .from('seva_providers').select('id').eq('user_id', userId).maybeSingle();
    if (existing) {
      return safeQuery(
        () => supabase.from('seva_providers')
          .update({ ...data, updated_at: new Date().toISOString() })
          .eq('id', existing.id).select().single(),
        null, 'SevaAPI.saveProvider',
      );
    }
    return safeQuery(
      () => supabase.from('seva_providers')
        .insert({ user_id: userId, is_available: false, is_verified: false, kyc_status: 'pending', ...data })
        .select().single(),
      null, 'SevaAPI.saveProvider',
    );
  },

  // Earnings summary for the provider: live totals + completed-job history.
  getEarnings:     async (userId)   => {
    if (!isSupabaseConfigured) return ok({ provider: null, completed: [] });
    const { data: provider } = await supabase
      .from('seva_providers').select('*').eq('user_id', userId).maybeSingle();
    if (!provider) return ok({ provider: null, completed: [] });
    const { data: completed } = await supabase
      .from('seva_jobs').select('*')
      .eq('provider_id', provider.id).eq('status', 'completed')
      .order('completed_at', { ascending: false });
    return ok({ provider, completed: completed ?? [] });
  },

  getJobs:         async (userId)   => {
    // seva_jobs.provider_id references seva_providers.id (not auth.uid directly).
    // Step 1: resolve the seva_providers row for this user.
    const { data: provider, error: providerErr } = await supabase
      .from('seva_providers')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (providerErr) {
      console.error('[SevaAPI.getJobs] provider lookup failed:', providerErr.message);
      return { data: [], error: providerErr };
    }
    if (!provider) {
      // User has no seva_providers row yet — not onboarded, return empty gracefully.
      return { data: [], error: null };
    }

    // Step 2: query seva_jobs using the resolved provider UUID.
    return safeQuery(
      () => supabase
        .from('seva_jobs')
        .select('*')
        .eq('provider_id', provider.id)
        .order('created_at', { ascending: false }),
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

/** Aggregate stats for the anchor's village dashboard.
 *  Uses the get_village_dashboard_stats() RPC — server-side indexed
 *  COUNT/SUM (also fixes the old broken kyc cross-table filter that
 *  returned wrong counts). */
export async function getVillageStats(villageId) {
  const EMPTY = {
    totalOrders: 0, activeOrders: 0, totalGMV: 0, totalVendors: 0,
    activeVendors: 0, totalRiders: 0, onlineRiders: 0, pendingKYC: 0,
  };
  if (!isSupabaseConfigured) return { data: EMPTY, error: null };

  const { data, error } = await supabase.rpc('get_village_dashboard_stats', {
    p_village_id: villageId,
  });
  return { data: data ?? EMPTY, error };
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
    // Safely execute the kyc query builder chain only if it's properly mocked/available
    let kycQuery;
    try {
      const fromObj = supabase.from?.('kyc_records');
      const selectObj = fromObj?.select?.('id', { count: 'exact', head: true });
      // Fall back to undefined instead of 0 in unmocked environments
      kycQuery = selectObj?.eq?.('status', 'submitted') || Promise.resolve({ count: undefined });
    } catch {
      kycQuery = Promise.resolve({ count: undefined });
    }

    const [rpcRes, kycRes] = await Promise.all([
      supabase.rpc('get_admin_dashboard_live'),
      Promise.resolve(kycQuery).catch(() => ({ count: undefined }))
    ]);

    if (rpcRes.error) return err(rpcRes.error, 'getAdminDashboardStats');

    if (!rpcRes.data) {
      return ok({});
    }

    // Build the response data dynamically
    const result = { ...rpcRes.data };

    // Only inject kycPending if it was actually retrieved from a configured/mocked query
    if (kycRes && kycRes.count !== undefined && kycRes.count !== null) {
      result.kycPending = kycRes.count;
    }

    return ok(result);
  } catch (e) {
    return err(e, 'getAdminDashboardStats');
  }
}

/** Hourly order distribution for today (for the bar chart). */
export async function getTodayHourlyOrders() {
  if (!isSupabaseConfigured) return ok([]);
  // Server-side per-hour counts (one RPC) instead of downloading every
  // order placed today and bucketing in the browser. See migration 048.
  const { data, error } = await supabase.rpc('get_today_hourly_orders');
  if (error) return err(error, 'getTodayHourlyOrders');

  const counts = {};
  (data ?? []).forEach(r => { counts[r.hour] = Number(r.orders ?? 0); });

  const buckets = Array.from({ length: 24 }, (_, i) => ({
    hr: `${i === 0 ? 12 : i > 12 ? i - 12 : i}${i < 12 ? 'AM' : 'PM'}`,
    orders: counts[i] ?? 0,
  }));
  // Return only 6AM–10PM for display
  return ok(buckets.filter((_, i) => i >= 6 && i <= 22));
}

/** Admin: get support tickets with reporter profile joined (most recent first). */
export async function getAdminSupportTickets({ status, limit = 300 } = {}) {
  let q = supabase
    .from('support_tickets')
    .select('*, profiles!support_tickets_user_id_fkey(id, name, role, phone)')
    .order('created_at', { ascending: false })
    .limit(limit);
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
  // Unlike most functions here, this doesn't go through safeQuery() because
  // of the post-processing map() below — but it needs the same demo-mode
  // guard safeQuery applies, which it was missing (see CHANGELOG.md).
  if (!isSupabaseConfigured) return { data: [], error: null };

  // Server-side aggregation (one RPC) instead of downloading all orders +
  // vendors and joining in the browser. See migration 044.
  const { data, error } = await supabase.rpc('get_admin_village_stats');
  if (error) {
    console.error('[getAdminVillages] rpc failed:', error.message);
    return { data: [], error };
  }

  const villages = (data ?? []).map(v => {
    const totalOrders   = Number(v.total_orders);
    const totalVendors  = Number(v.total_vendors);
    const activeVendors = Number(v.active_vendors);
    const health = v.is_active
      ? Math.min(100, 30 + activeVendors * 10 + Math.min(totalOrders, 20) * 2)
      : 0;
    return { ...v, totalOrders, totalVendors, activeVendors, health };
  });

  return { data: villages, error: null };
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
export async function adminAssignRider(orderId, riderId, _riderName) {
  // Routed through admin_assign_rider RPC (security definer, is_admin
  // gated). Direct client UPDATE on orders is locked down — see migration 050.
  return safeQuery(
    () => supabase.rpc('admin_assign_rider', {
      p_order_id: orderId,
      p_rider_id: riderId,
    }),
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

// ── Categories CRUD (admin) ───────────────────────────────

export async function getAllCategories() {
  return safeQuery(
    () => supabase.from('categories').select('*').order('sort_order'),
    CATEGORIES,
    'getAllCategories'
  );
}

export async function upsertCategory(catData) {
  return safeQuery(
    () => supabase.from('categories').upsert(catData).select().single(),
    null,
    'upsertCategory'
  );
}

export async function deleteCategory(id) {
  return safeQuery(
    () => supabase.from('categories').delete().eq('id', id),
    null,
    'deleteCategory'
  );
}

export async function reorderCategories(orderedIds) {
  // orderedIds: string[] — categories in new sort order
  if (!isSupabaseConfigured) return ok(null);
  try {
    const updates = orderedIds.map((id, index) =>
      supabase.from('categories').update({ sort_order: index + 1 }).eq('id', id)
    );
    await Promise.all(updates);
    return ok(true);
  } catch (e) {
    return err(e, 'reorderCategories');
  }
}

// ── Products admin ────────────────────────────────────────

export async function getAdminProducts({ vendorId, categoryId, search, page = 0, limit = 50 } = {}) {
  return safeQuery(() => {
    let q = supabase
      .from('admin_products_view')
      .select('*')
      .range(page * limit, (page + 1) * limit - 1);

    if (vendorId)    q = q.eq('vendor_id', vendorId);
    if (categoryId)  q = q.eq('category_id', categoryId);
    if (search)      q = q.ilike('name', `%${search}%`);
    return q;
  }, [], 'getAdminProducts');
}

export async function adminUpdateProduct(id, updates) {
  return safeQuery(
    () => supabase.from('products').update(updates).eq('id', id).select().single(),
    null,
    'adminUpdateProduct'
  );
}

export async function adminDeleteProduct(id) {
  return safeQuery(
    () => supabase.from('products').delete().eq('id', id),
    null,
    'adminDeleteProduct'
  );
}

// ── Platform Config ───────────────────────────────────────

export async function getPlatformConfig() {
  return safeQuery(
    () => supabase.from('platform_config').select('*').order('key'),
    [],
    'getPlatformConfig'
  );
}

export async function savePlatformConfig(entries) {
  // entries: Array<{ key: string, value: string }>
  return safeQuery(
    () => supabase.rpc('upsert_platform_config_bulk', { p_entries: entries }),
    null,
    'savePlatformConfig'
  );
}

// ── Banners CRUD ──────────────────────────────────────────

export async function getBanners({ adminView = false } = {}) {
  return safeQuery(() => {
    let q = supabase.from('banners').select('*').order('sort_order');
    if (!adminView) q = q.eq('is_active', true);
    return q;
  }, [], 'getBanners');
}

export async function upsertBanner(bannerData) {
  return safeQuery(
    () => supabase.from('banners').upsert(bannerData).select().single(),
    null,
    'upsertBanner'
  );
}

export async function deleteBanner(id) {
  return safeQuery(
    () => supabase.from('banners').delete().eq('id', id),
    null,
    'deleteBanner'
  );
}

export async function toggleBannerActive(id, isActive) {
  return safeQuery(
    () => supabase.from('banners').update({ is_active: isActive }).eq('id', id).select().single(),
    null,
    'toggleBannerActive'
  );
}

// ── Notifications broadcast ───────────────────────────────

export async function broadcastNotification({ title, body, type = 'system', targetRole = null, villageId = null, data = null }) {
  // Inserts a notification for every matching user
  if (!isSupabaseConfigured) return ok(null);
  try {
    // Fetch target user IDs
    let q = supabase.from('profiles').select('id');
    if (targetRole)  q = q.eq('role', targetRole);
    if (villageId)   q = q.eq('village_id', villageId);
    const { data: users, error: usersErr } = await q;
    if (usersErr) return err(usersErr, 'broadcastNotification/fetch');

    if (!users || users.length === 0) return ok({ sent: 0 });

    const rows = users.map(u => ({
      user_id: u.id,
      type,
      title,
      body,
      data: data ?? {},
    }));

    // Insert in batches of 200
    for (let i = 0; i < rows.length; i += 200) {
      const { error: insErr } = await supabase.from('notifications').insert(rows.slice(i, i + 200));
      if (insErr) return err(insErr, 'broadcastNotification/insert');
    }
    return ok({ sent: rows.length });
  } catch (e) {
    return err(e, 'broadcastNotification');
  }
}

// ── Image moderation ──────────────────────────────────────

export async function getImageModerationQueue({ status = 'pending' } = {}) {
  return safeQuery(() => {
    let q = supabase
      .from('image_moderation')
      .select(`*, profiles!uploaded_by(name, phone)`)
      .order('created_at', { ascending: false });
    if (status !== 'all') q = q.eq('status', status);
    return q;
  }, [], 'getImageModerationQueue');
}

export async function reviewImage(imageId, status, reason = null) {
  return safeQuery(
    () => supabase.rpc('review_image', {
      p_image_id: imageId,
      p_status:   status,
      p_reason:   reason,
    }),
    null,
    'reviewImage'
  );
}

// ── Live analytics ────────────────────────────────────────

export async function getLiveAnalytics() {
  // First try the RPC (migration 011) for rich aggregated data
  try {
    const { data, error } = await supabase.rpc('get_live_admin_analytics');
    if (!error && data) return ok(data);
  } catch (_) {}
  // Fallback: view-based query (older schema)
  return safeQuery(
    () => supabase.from('admin_analytics').select('*').single(),
    null,
    'getLiveAnalytics'
  );
}

export async function getDailyOrderTrend() {
  return safeQuery(
    () => supabase.from('daily_order_trend').select('*').limit(30),
    [],
    'getDailyOrderTrend'
  );
}

export async function getHourlyOrderTrend() {
  return safeQuery(
    () => supabase.from('hourly_order_trend').select('*'),
    [],
    'getHourlyOrderTrend'
  );
}

// ── User management ───────────────────────────────────────

export async function getAllUsers({ role, search, page = 0, limit = 50 } = {}) {
  return safeQuery(() => {
    let q = supabase
      .from('profiles')
      .select('*, villages(name)')
      .range(page * limit, (page + 1) * limit - 1)
      .order('created_at', { ascending: false });
    if (role)   q = q.eq('role', role);
    if (search) q = q.ilike('name', `%${search}%`);
    return q;
  }, [], 'getAllUsers');
}

export async function banUser(userId, reason = null) {
  return safeQuery(
    () => supabase.rpc('ban_user', { p_user_id: userId, p_reason: reason }),
    null,
    'banUser'
  );
}

export async function unbanUser(userId) {
  return safeQuery(
    () => supabase.rpc('unban_user', { p_user_id: userId }),
    null,
    'unbanUser'
  );
}

export async function assignRole(userId, role) {
  return safeQuery(
    () => supabase.rpc('assign_role', { p_user_id: userId, p_role: role }),
    null,
    'assignRole'
  );
}

// ── KYC review ────────────────────────────────────────────

export async function getKYCQueue({ status = 'submitted' } = {}) {
  return safeQuery(() => {
    let q = supabase
      .from('kyc_records')
      .select(`*, profiles!user_id(name, phone, role, village_id, villages(name))`)
      .order('created_at', { ascending: false });
    if (status !== 'all') q = q.eq('status', status);
    return q;
  }, [], 'getKYCQueue');
}

export async function reviewKYC(kycId, status, reason = null) {
  const updates = {
    status,
    failure_reason: reason,
    verified_at:    status === 'verified' ? new Date().toISOString() : null,
  };
  try {
    const { data, error } = await supabase
      .from('kyc_records')
      .update(updates)
      .eq('id', kycId)
      .select()
      .single();
    if (error) return err(error, 'reviewKYC');
    // Audit log
    const actorId = (await supabase.auth.getUser()).data.user?.id;
    await supabase.from('audit_log').insert({
      actor_id:    actorId,
      actor:       'admin',
      action:      'review_kyc',
      target:      kycId,
      target_type: 'kyc',
      detail:      status === 'rejected' ? reason : `Approved KYC — ${status}`,
    });
    return ok(data);
  } catch (e) {
    return err(e, 'reviewKYC');
  }
}

// ── Vendor approval (wired to real DB) ───────────────────

export async function getPendingVendors() {
  return safeQuery(
    () => supabase
      .from('vendors')
      .select(`
        id, name, category, village, village_id, phone,
        image_url, kyc_status, created_at, subscription_tier,
        kyc_records(type, status, doc_url, aadhaar_last4)
      `)
      .eq('kyc_status', 'pending')
      .order('created_at', { ascending: true }),
    [],
    'getPendingVendors'
  );
}

export const AdminAPI = {
  // ── Dashboard ─────────────────────────────────────────
  getStats:             ()                         => getAdminDashboardStats(),
  getHourlyOrders:      ()                         => getTodayHourlyOrders(),
  getLiveAnalytics:     ()                         => getLiveAnalytics(),
  getDailyTrend:        ()                         => getDailyOrderTrend(),
  getHourlyTrend:       ()                         => getHourlyOrderTrend(),

  // ── Orders ────────────────────────────────────────────
  getOrders:            (opts)                     => getAdminOrders(opts),
  assignRider:          (orderId, riderId, name)   => adminAssignRider(orderId, riderId, name),

  // ── Vendors ───────────────────────────────────────────
  getVendors:           ()                         => getAdminVendors(),
  getPendingVendors:    ()                         => getPendingVendors(),
  setVendorOpen:        (id, open)                 => setVendorOpen(id, open),
  approveVendor:        (vendorId)                 => safeQuery(
    () => supabase.from('vendors').update({ is_verified: true, kyc_status: 'approved' }).eq('id', vendorId).select().single(),
    null, 'AdminAPI.approveVendor'
  ),
  rejectVendor:         (vendorId, reason)         => safeQuery(
    () => supabase.from('vendors').update({ kyc_status: 'rejected' }).eq('id', vendorId).select().single(),
    null, 'AdminAPI.rejectVendor'
  ),

  // ── Riders ────────────────────────────────────────────
  getRiders:            ()                         => getAdminRiders(),
  setRiderActive:       (id, active)               => setRiderActive(id, active),
  updateCashBalance:    (riderId, amount)           => safeQuery(
    () => supabase.from('riders').update({ cod_balance: amount }).eq('id', riderId).select().single(),
    null, 'AdminAPI.updateCashBalance'
  ),

  // ── Seva Providers ────────────────────────────────────
  getSevaProviders:     ()                         => getAdminSevaProviders(),
  setSevaAvailable:     (id, avail)                => setSevaAvailable(id, avail),

  // ── Villages ──────────────────────────────────────────
  getVillages:          ()                         => getAdminVillages(),

  // ── Support ───────────────────────────────────────────
  getSupportTickets:    (opts)                     => getAdminSupportTickets(opts),
  replyToTicket:        (id, name, text)           => replyToTicket(id, name, text),
  resolveTicket:        (id)                       => resolveTicket(id),

  // ── COD / Cash ────────────────────────────────────────
  getCODDeposits:       ()                         => getCODDeposits(),
  confirmCODDeposit:    (depositId, adminUserId)   => confirmCODDeposit(depositId, adminUserId),
  disputeCODDeposit:    (depositId)                => disputeCODDeposit(depositId),

  // ── Categories ────────────────────────────────────────
  getCategories:        ()                         => getCategories(),
  getAllCategories:     ()                         => getAllCategories(),
  upsertCategory:      (data)                     => upsertCategory(data),
  deleteCategory:      (id)                       => deleteCategory(id),
  reorderCategories:   (ids)                      => reorderCategories(ids),

  // ── Products ──────────────────────────────────────────
  getProducts:         (opts)                     => getAdminProducts(opts),
  updateProduct:       (id, updates)              => adminUpdateProduct(id, updates),
  deleteProduct:       (id)                       => adminDeleteProduct(id),

  // ── Platform Config ───────────────────────────────────
  getConfig:           ()                         => getPlatformConfig(),
  saveConfig:          (entries)                  => savePlatformConfig(entries),

  // ── Banners ───────────────────────────────────────────
  getBanners:          (opts)                     => getBanners({ ...opts, adminView: true }),
  upsertBanner:        (data)                     => upsertBanner(data),
  deleteBanner:        (id)                       => deleteBanner(id),
  toggleBanner:        (id, active)               => toggleBannerActive(id, active),

  // ── Notifications ─────────────────────────────────────
  broadcastNotification: (payload)                => broadcastNotification(payload),

  // ── Image Moderation ──────────────────────────────────
  getImageQueue:       (opts)                     => getImageModerationQueue(opts),
  reviewImage:         (id, status, reason)       => reviewImage(id, status, reason),

  // ── Users ─────────────────────────────────────────────
  getUsers:            (opts)                     => getAllUsers(opts),
  banUser:             (userId, reason)           => banUser(userId, reason),
  unbanUser:           (userId)                   => unbanUser(userId),
  assignRole:          (userId, role)             => assignRole(userId, role),

  // ── KYC ───────────────────────────────────────────────
  getKYCQueue:         (opts)                     => getKYCQueue(opts),
  reviewKYC:           (id, status, reason)       => reviewKYC(id, status, reason),

  // ── Order management (extended) ───────────────────────
  updateOrderStatus:   (orderId, status, note)    => adminUpdateOrderStatus(orderId, status, note),
  cancelOrder:         (orderId, reason)          => adminCancelOrder(orderId, reason),
  getOrderDetail:      (orderId)                  => getOrderDetail(orderId),

  // ── Vendor management (extended) ──────────────────────
  getVendorDetail:     (vendorId)                 => getVendorDetail(vendorId),
  suspendVendor:       (vendorId, reason)         => suspendVendor(vendorId, reason),
  unsuspendVendor:     (vendorId)                 => unsuspendVendor(vendorId),
  getVendorAnalytics:  (vendorId)                 => getVendorAnalytics(vendorId),

  // ── User management (extended) ────────────────────────
  getUserDetail:       (userId)                   => getUserDetail(userId),
  getUserOrders:       (userId, opts)             => getUserOrders(userId, opts),

  // ── Audit log ─────────────────────────────────────────
  getAuditLog:         (opts)                     => getAuditLog(opts),

  // ── Analytics ─────────────────────────────────────────
  getRevenueAnalytics: (opts)                     => getRevenueAnalytics(opts),

  // ── Disputes ──────────────────────────────────────────
  getDisputes:         (opts)                     => getAdminDisputes(opts),
  resolveDispute:      (id, resolution)           => resolveDispute(id, resolution),

  // ── Product creation ──────────────────────────────────
  createProduct:       (data)                     => adminCreateProduct(data),

  // ── Rider management (extended) ───────────────────────
  getRiderDetail:      (riderId)                  => getRiderDetail(riderId),
  verifyRider:         (riderId)                  => adminVerifyRider(riderId),
};

// ═══════════════════════════════════════════════════════════
// ADMIN API EXTENSIONS  (production-grade additions)
// ═══════════════════════════════════════════════════════════

// ── Order management (admin) ──────────────────────────────

export async function adminUpdateOrderStatus(orderId, status, note = null) {
  return safeQuery(
    () => supabase.rpc('update_order_status', {
      p_order_id:   orderId,
      p_new_status: status,
      p_note:       note,
    }),
    null,
    'adminUpdateOrderStatus'
  );
}

export async function adminCancelOrder(orderId, reason) {
  return safeQuery(
    () => supabase.rpc('update_order_status', {
      p_order_id:   orderId,
      p_new_status: 'cancelled',
      p_note:       reason ?? 'Cancelled by admin',
    }),
    null,
    'adminCancelOrder'
  );
}

export async function getOrderDetail(orderId) {
  return safeQuery(
    () => supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', orderId)
      .single(),
    null,
    'getOrderDetail'
  );
}

// ── Vendor detail & suspension ────────────────────────────

export async function getVendorDetail(vendorId) {
  return safeQuery(
    () => supabase
      .from('vendors')
      .select(`
        *, 
        kyc_records(id, type, status, doc_url, aadhaar_last4, created_at, verified_at, failure_reason),
        products(id, name, price, stock, is_available)
      `)
      .eq('id', vendorId)
      .single(),
    null,
    'getVendorDetail'
  );
}

export async function suspendVendor(vendorId, reason) {
  try {
    const { error: vendorErr } = await supabase
      .from('vendors')
      .update({ is_active: false, is_open: false })
      .eq('id', vendorId);
    if (vendorErr) return err(vendorErr, 'suspendVendor/vendor');

    await supabase.from('audit_log').insert({
      actor_id: (await supabase.auth.getUser()).data.user?.id,
      actor:    'admin',
      action:   'suspend_vendor',
      target:   vendorId,
      detail:   reason ?? null,
    });
    return ok(true);
  } catch (e) {
    return err(e, 'suspendVendor');
  }
}

export async function unsuspendVendor(vendorId) {
  try {
    const { error: vendorErr } = await supabase
      .from('vendors')
      .update({ is_active: true })
      .eq('id', vendorId);
    if (vendorErr) return err(vendorErr, 'unsuspendVendor');

    await supabase.from('audit_log').insert({
      actor_id: (await supabase.auth.getUser()).data.user?.id,
      actor:    'admin',
      action:   'unsuspend_vendor',
      target:   vendorId,
      detail:   null,
    });
    return ok(true);
  } catch (e) {
    return err(e, 'unsuspendVendor');
  }
}

// ── User detail & activity ────────────────────────────────

export async function getUserDetail(userId) {
  return safeQuery(
    () => supabase
      .from('profiles')
      .select('*, villages(name)')
      .eq('id', userId)
      .single(),
    null,
    'getUserDetail'
  );
}

export async function getUserOrders(userId, { limit = 20 } = {}) {
  return safeQuery(
    () => supabase
      .from('orders')
      .select('id, order_number, status, total, payment_method, created_at, vendor_name')
      .eq('customer_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit),
    [],
    'getUserOrders'
  );
}

// ── Audit log viewer ──────────────────────────────────────

export async function getAuditLog({ page = 0, limit = 50, action, actorId } = {}) {
  return safeQuery(() => {
    let q = supabase
      .from('audit_log')
      .select('*, profiles!actor_id(name, role)')
      .order('created_at', { ascending: false })
      .range(page * limit, (page + 1) * limit - 1);
    if (action)  q = q.eq('action', action);
    if (actorId) q = q.eq('actor_id', actorId);
    return q;
  }, [], 'getAuditLog');
}

// ── Analytics (revenue trend, per-vendor) ────────────────

export async function getRevenueAnalytics({ days = 30 } = {}) {
  if (!isSupabaseConfigured) {
    return ok({ total_revenue: 0, total_orders: 0, daily: [], payment_mix: [], top_vendors: [], villages: [] });
  }
  // Server-side aggregation (one RPC) instead of downloading every
  // non-cancelled order for the window and aggregating in the browser.
  // See migration 047.
  const { data, error } = await supabase.rpc('get_revenue_analytics', { p_days: days });
  if (error) return err(error, 'getRevenueAnalytics');
  return ok(data ?? { total_revenue: 0, total_orders: 0, daily: [], payment_mix: [], top_vendors: [], villages: [] });
}

export async function getVendorAnalytics(vendorId) {
  const [ordersRes, productsRes] = await Promise.all([
    supabase
      .from('orders')
      .select('id, status, total, created_at, payment_method')
      .eq('vendor_id', vendorId)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('products')
      .select('id, name, stock, is_available, price')
      .eq('vendor_id', vendorId),
  ]);
  return ok({
    orders:   ordersRes.data  ?? [],
    products: productsRes.data ?? [],
  });
}

// ── Disputes / escalations ────────────────────────────────

export async function getAdminDisputes({ status, page = 0, limit = 50 } = {}) {
  return safeQuery(() => {
    let q = supabase
      .from('disputes')
      .select(`
        *,
        profiles!disputes_reporter_id_fkey(name, phone, role),
        orders(order_number, total, vendor_name)
      `)
      .order('created_at', { ascending: false })
      .range(page * limit, (page + 1) * limit - 1);
    if (status) q = q.eq('status', status);
    return q;
  }, [], 'getAdminDisputes');
}

// ── Product creation ──────────────────────────────────────

export async function adminCreateProduct(productData) {
  return safeQuery(
    () => supabase.from('products').insert(productData).select().single(),
    null,
    'adminCreateProduct'
  );
}

// ── Notification broadcast log (persistent) ──────────────

export async function getNotificationBroadcasts({ page = 0, limit = 30 } = {}) {
  return safeQuery(
    () => supabase
      .from('notifications')
      .select('type, title, body, created_at')
      .is('user_id', null)  // broadcast rows have no specific user_id
      .order('created_at', { ascending: false })
      .range(page * limit, (page + 1) * limit - 1),
    [],
    'getNotificationBroadcasts'
  );
}

// ── Rider detail ──────────────────────────────────────────

export async function getRiderDetail(riderId) {
  return safeQuery(
    () => supabase
      .from('riders')
      .select('*, kyc_records!user_id(id, type, status, doc_url, aadhaar_last4, failure_reason)')
      .eq('id', riderId)
      .single(),
    null,
    'getRiderDetail'
  );
}

export async function adminVerifyRider(riderId) {
  try {
    const { error: rErr } = await supabase
      .from('riders')
      .update({ is_verified: true, kyc_status: 'approved' })
      .eq('id', riderId);
    if (rErr) return err(rErr, 'adminVerifyRider');
    await supabase.from('audit_log').insert({
      actor_id: (await supabase.auth.getUser()).data.user?.id,
      actor: 'admin', action: 'verify_rider', target: riderId,
    });
    return ok(true);
  } catch(e) { return err(e, 'adminVerifyRider'); }
}

// Extend AdminAPI with all new functions


// ═══════════════════════════════════════════════════════════
// RBAC API — dynamic permissions (migration 021)
// Reads the permission/role catalog; writes go through the
// super-admin-only, audited security-definer RPCs.
// ═══════════════════════════════════════════════════════════
export const RBACAPI = {
  getPermissions: () => safeQuery(
    () => supabase.from('permissions').select('*').order('module').order('action'),
    [], 'RBACAPI.getPermissions'
  ),
  getRoles: () => safeQuery(
    () => supabase.from('roles').select('*').order('key'),
    [], 'RBACAPI.getRoles'
  ),
  getRolePermissions: () => safeQuery(
    () => supabase.from('role_permissions').select('role_key, permission_key'),
    [], 'RBACAPI.getRolePermissions'
  ),
  setRolePermission: (roleKey, permissionKey, granted) => safeQuery(
    () => supabase.rpc('set_role_permission', {
      p_role_key: roleKey, p_permission_key: permissionKey, p_granted: granted,
    }),
    null, 'RBACAPI.setRolePermission'
  ),
  createRole: (key, name, description) => safeQuery(
    () => supabase.rpc('create_role', { p_key: key, p_name: name, p_description: description ?? null }),
    null, 'RBACAPI.createRole'
  ),
  createPermission: (module, action, description) => safeQuery(
    () => supabase.rpc('create_permission', { p_module: module, p_action: action, p_description: description ?? null }),
    null, 'RBACAPI.createPermission'
  ),
};


// ═══════════════════════════════════════════════════════════
// Feature Flags API (migration 022)
// my()  → caller's evaluated flag set (public, server-evaluated)
// list/set/upsert → admin management (feature_flags.manage)
// ═══════════════════════════════════════════════════════════
export const FeatureFlagsAPI = {
  // Evaluated [{key, enabled}] for the current user — used by the provider.
  my: () => safeQuery(() => supabase.rpc('my_feature_flags'), [], 'FeatureFlagsAPI.my'),
  // Full rows for the admin screen (RLS: admins only).
  list: () => safeQuery(
    () => supabase.from('feature_flags').select('*').order('name'),
    [], 'FeatureFlagsAPI.list'
  ),
  set: (key, enabled) => safeQuery(
    () => supabase.rpc('set_feature_flag', { p_key: key, p_enabled: enabled }),
    null, 'FeatureFlagsAPI.set'
  ),
  upsert: ({ key, name, description, enabled = true, rollout = 100, audience = null }) => safeQuery(
    () => supabase.rpc('upsert_feature_flag', {
      p_key: key, p_name: name, p_description: description ?? null,
      p_enabled: enabled, p_rollout: rollout, p_audience: audience,
    }),
    null, 'FeatureFlagsAPI.upsert'
  ),
};


// ═══════════════════════════════════════════════════════════
// Settings API (migration 023)
// getAll  → typed/grouped settings rows (admin, RLS-gated)
// set     → audited + validated single write (settings.update)
// getPublic → non-sensitive settings for the app (branding, maintenance)
// ═══════════════════════════════════════════════════════════
export const SettingsAPI = {
  getAll: () => safeQuery(
    () => supabase.from('platform_config').select('*').order('group_name').order('sort_order').order('key'),
    [], 'SettingsAPI.getAll'
  ),
  set: (key, value) => safeQuery(
    () => supabase.rpc('set_setting', { p_key: key, p_value: String(value) }),
    null, 'SettingsAPI.set'
  ),
  getPublic: () => safeQuery(() => supabase.rpc('get_public_settings'), {}, 'SettingsAPI.getPublic'),
};


// ═══════════════════════════════════════════════════════════
// Notification Center API (migration 024)
// Compose/target/schedule/send campaigns. Push delivery for a sent
// campaign is completed by invoking send-fcm-notification with the
// server-resolved recipients (skip_inapp — the RPC already wrote the
// in-app rows).
// ═══════════════════════════════════════════════════════════
export const NotificationCenterAPI = {
  listCampaigns: ({ limit = 50 } = {}) => safeQuery(
    () => supabase.from('notification_campaigns').select('*').order('created_at', { ascending: false }).limit(limit),
    [], 'NotificationCenterAPI.listCampaigns'
  ),
  audienceCount: (audience) => safeQuery(
    () => supabase.rpc('campaign_audience_count', { p_audience: audience ?? {} }),
    0, 'NotificationCenterAPI.audienceCount'
  ),
  create: ({ name, channel, title, body, notifType = 'system', audience = {}, scheduledAt = null }) => safeQuery(
    () => supabase.rpc('create_campaign', {
      p_name: name, p_channel: channel, p_title: title, p_body: body,
      p_notif_type: notifType, p_audience: audience, p_scheduled_at: scheduledAt,
    }),
    null, 'NotificationCenterAPI.create'
  ),
  cancel: (id) => safeQuery(
    () => supabase.rpc('cancel_campaign', { p_id: id }),
    null, 'NotificationCenterAPI.cancel'
  ),

  // Multi-channel delivery (migration 034): queue stats + recent deliveries.
  deliveryStats: () => safeQuery(() => supabase.rpc('get_delivery_stats'), null, 'NotificationCenterAPI.deliveryStats'),
  deliveries: ({ limit = 100 } = {}) => safeQuery(
    () => supabase.from('notification_deliveries').select('*').order('created_at', { ascending: false }).limit(limit),
    [], 'NotificationCenterAPI.deliveries'
  ),

  /**
   * Send a campaign now. Dispatches in-app rows server-side; for push
   * channel, also fires FCM to the server-resolved recipients.
   * Returns { data, error }.
   */
  dispatch: async (id) => {
    if (!isSupabaseConfigured) return ok({ success: true, targeted: 0 });
    try {
      const { data, error } = await supabase.rpc('dispatch_campaign', { p_id: id });
      if (error) return err(error, 'NotificationCenterAPI.dispatch');
      if (!data?.success) return err({ message: data?.error ?? 'Dispatch failed' }, 'NotificationCenterAPI.dispatch');

      // Push: complete delivery via the FCM Edge Function (in-app already done).
      if (data.channel === 'push' && Array.isArray(data.recipients) && data.recipients.length) {
        const { error: fcmErr } = await supabase.functions.invoke('send-fcm-notification', {
          body: {
            user_ids:  data.recipients,
            title:     data.title,
            body:      data.body,
            type:      data.type,
            skip_inapp: true,
          },
        });
        if (fcmErr) {
          // In-app delivered; push failed — surface a soft warning, not a hard error.
          return ok({ ...data, pushWarning: fcmErr.message ?? 'Push delivery failed' });
        }
      }
      return ok(data);
    } catch (e) {
      return err(e, 'NotificationCenterAPI.dispatch');
    }
  },
};


// ═══════════════════════════════════════════════════════════
// Security Center API (migration 025)
// ═══════════════════════════════════════════════════════════
export const SecurityAPI = {
  overview:     ()                 => safeQuery(() => supabase.rpc('get_security_overview'), null, 'SecurityAPI.overview'),
  blockedUsers: ()                 => safeQuery(() => supabase.rpc('list_blocked_users'), [], 'SecurityAPI.blockedUsers'),
  events:       (limit = 50)       => safeQuery(() => supabase.rpc('get_security_events', { p_limit: limit }), [], 'SecurityAPI.events'),
  ban:          (userId, reason)   => banUser(userId, reason),
  unban:        (userId)           => unbanUser(userId),

  // ── Deep security ops (migration 030) ──────────────────
  opsOverview:  ()                 => safeQuery(() => supabase.rpc('get_security_ops_overview'), null, 'SecurityAPI.opsOverview'),
  blockedIps:   ()                 => safeQuery(() => supabase.rpc('list_blocked_ips'), [], 'SecurityAPI.blockedIps'),
  blockIp:      (ip, reason)       => safeQuery(() => supabase.rpc('block_ip', { p_ip: ip, p_reason: reason ?? null }), null, 'SecurityAPI.blockIp'),
  unblockIp:    (ip)               => safeQuery(() => supabase.rpc('unblock_ip', { p_ip: ip }), null, 'SecurityAPI.unblockIp'),
  loginHistory: (userId = null, limit = 50) => safeQuery(() => supabase.rpc('get_login_history', { p_user_id: userId, p_limit: limit }), [], 'SecurityAPI.loginHistory'),
  sessions:     (userId)           => safeQuery(() => supabase.rpc('get_user_sessions', { p_user_id: userId }), [], 'SecurityAPI.sessions'),
  forceLogout:  (userId)           => safeQuery(() => supabase.rpc('force_logout', { p_user_id: userId }), null, 'SecurityAPI.forceLogout'),
  mergeAccounts:(keep, remove)     => safeQuery(() => supabase.rpc('merge_user_accounts', { p_keep: keep, p_remove: remove }), null, 'SecurityAPI.mergeAccounts'),
  impersonate:  (targetId, reason) => safeQuery(() => supabase.rpc('begin_impersonation', { p_target: targetId, p_reason: reason }), null, 'SecurityAPI.impersonate'),
};


// ═══════════════════════════════════════════════════════════
// Finance Center API (migration 026)
// ═══════════════════════════════════════════════════════════
export const FinanceAPI = {
  overview:    () => safeQuery(() => supabase.rpc('get_finance_overview'), null, 'FinanceAPI.overview'),
  escrow:      () => safeQuery(
    () => supabase.from('vendor_escrow').select('*, vendors(name)').order('balance', { ascending: false }).limit(100),
    [], 'FinanceAPI.escrow'
  ),
  payouts:     () => safeQuery(
    () => supabase.from('vendor_payouts').select('*').order('created_at', { ascending: false }).limit(50),
    [], 'FinanceAPI.payouts'
  ),
  refunds:     () => safeQuery(
    () => supabase.from('order_refunds').select('*').order('created_at', { ascending: false }).limit(50),
    [], 'FinanceAPI.refunds'
  ),
  adjustments: () => safeQuery(
    () => supabase.from('financial_adjustments').select('*').order('created_at', { ascending: false }).limit(50),
    [], 'FinanceAPI.adjustments'
  ),
  recordAdjustment: ({ type, targetKind, targetId, amount, reason }) => safeQuery(
    () => supabase.rpc('record_financial_adjustment', {
      p_adj_type: type, p_target_kind: targetKind, p_target_id: targetId,
      p_amount: Number(amount), p_reason: reason,
    }),
    null, 'FinanceAPI.recordAdjustment'
  ),

  // ── Finance depth (migration 031): GST invoices, settlements, chargebacks ──
  depthOverview:    () => safeQuery(() => supabase.rpc('get_finance_depth_overview'), null, 'FinanceAPI.depthOverview'),
  invoices:         () => safeQuery(
    () => supabase.from('invoices').select('*').order('created_at', { ascending: false }).limit(100),
    [], 'FinanceAPI.invoices'
  ),
  generateInvoice:  (orderId) => safeQuery(() => supabase.rpc('generate_invoice', { p_order_id: orderId }), null, 'FinanceAPI.generateInvoice'),
  settlements:      () => safeQuery(
    () => supabase.from('settlements').select('*, vendors(name)').order('created_at', { ascending: false }).limit(100),
    [], 'FinanceAPI.settlements'
  ),
  createSettlement: (vendorId, notes) => safeQuery(() => supabase.rpc('create_settlement', { p_vendor_id: vendorId, p_notes: notes ?? null }), null, 'FinanceAPI.createSettlement'),
  chargebacks:      () => safeQuery(
    () => supabase.from('chargebacks').select('*').order('created_at', { ascending: false }).limit(100),
    [], 'FinanceAPI.chargebacks'
  ),
  recordChargeback: ({ orderId, amount, reason, providerRef }) => safeQuery(
    () => supabase.rpc('record_chargeback', { p_order_id: orderId ?? null, p_amount: Number(amount), p_reason: reason, p_provider_ref: providerRef ?? null }),
    null, 'FinanceAPI.recordChargeback'
  ),
  resolveChargeback:(id, status) => safeQuery(() => supabase.rpc('resolve_chargeback', { p_id: id, p_status: status }), null, 'FinanceAPI.resolveChargeback'),
};


// ═══════════════════════════════════════════════════════════
// Developer Center API (migration 027) — read-only ops observability
// ═══════════════════════════════════════════════════════════
export const DeveloperAPI = {
  overview:    () => safeQuery(() => supabase.rpc('get_developer_overview'), null, 'DeveloperAPI.overview'),
  dbHealth:    () => safeQuery(() => supabase.rpc('get_database_health'), null, 'DeveloperAPI.dbHealth'),
  cronJobs:    () => safeQuery(() => supabase.rpc('get_cron_jobs'), [], 'DeveloperAPI.cronJobs'),
  migrations:  () => safeQuery(() => supabase.rpc('get_migration_status'), null, 'DeveloperAPI.migrations'),
  errors:      (limit = 50) => safeQuery(() => supabase.rpc('get_recent_errors', { p_limit: limit }), [], 'DeveloperAPI.errors'),
  queueHealth: () => safeQuery(() => supabase.rpc('get_payment_queue_health'), null, 'DeveloperAPI.queueHealth'),

  // ── Ops status (migration 032): storage / backups / deploys ──
  storageHealth: () => safeQuery(() => supabase.rpc('get_storage_health'), null, 'DeveloperAPI.storageHealth'),
  systemStatus:  () => safeQuery(() => supabase.rpc('get_system_status'), null, 'DeveloperAPI.systemStatus'),
};


// ═══════════════════════════════════════════════════════════
// Coupons API (migration 028)
// validate → customer preview; list/upsert/setActive → admin CRUD.
// ═══════════════════════════════════════════════════════════
export const CouponAPI = {
  validate: (code, subtotal, vendorId = null) => safeQuery(
    () => supabase.rpc('validate_coupon', { p_code: code, p_subtotal: subtotal, p_vendor_id: vendorId }),
    { valid: false }, 'CouponAPI.validate'
  ),
  list: () => safeQuery(
    () => supabase.from('coupons').select('*').order('created_at', { ascending: false }).limit(100),
    [], 'CouponAPI.list'
  ),
  upsert: (c) => safeQuery(
    () => supabase.rpc('upsert_coupon', {
      p_id: c.id ?? null, p_code: c.code, p_description: c.description ?? null,
      p_discount_type: c.discountType, p_discount_value: Number(c.discountValue),
      p_max_discount: c.maxDiscount ? Number(c.maxDiscount) : null,
      p_min_order: c.minOrder ? Number(c.minOrder) : 0,
      p_applies_to: c.appliesTo ?? 'all', p_vendor_id: c.vendorId ?? null,
      p_usage_limit: c.usageLimit ? Number(c.usageLimit) : null,
      p_per_user_limit: c.perUserLimit ? Number(c.perUserLimit) : 1,
      p_valid_from: c.validFrom ?? null, p_valid_to: c.validTo ?? null,
      p_is_active: c.isActive ?? true,
    }),
    null, 'CouponAPI.upsert'
  ),
  setActive: (id, active) => safeQuery(
    () => supabase.rpc('set_coupon_active', { p_id: id, p_active: active }),
    null, 'CouponAPI.setActive'
  ),
};

// ═══════════════════════════════════════════════════════════
// Global Search API (migration 029) — powers the command palette.
// admin_global_search() is security-definer + is_admin()-gated and
// returns a unified [{kind, id, label, sublabel, path}] result set.
// ═══════════════════════════════════════════════════════════
export const SearchAPI = {
  global: (q) => safeQuery(
    () => supabase.rpc('admin_global_search', { p_query: q }),
    [], 'SearchAPI.global'
  ),
};
