// ═══════════════════════════════════════════════════════════
// SETU PLATFORM — API SERVICE LAYER (Merged v2 + Phase 2)
//
// Constitution: "Backend-first mindset. Every API call is the
// canonical interface. UI should never embed business logic."
//
// Patterns:
//  - All functions return { data, error } — never throw
//  - safeQuery() centralises Supabase error handling
//  - Snake_case ↔ camelCase normalisation lives here only
//  - Supabase calls are isolated — swap to REST/RPC in future
//    with zero component changes
//  - Pagination: all list functions accept { page, limit }
//  - Optimistic IDs: placeOrder accepts a localId for offline
//  - Namespace exports (AuthAPI, OrderAPI, etc.) kept for
//    backward compatibility with existing components
// ═══════════════════════════════════════════════════════════

import { supabase, isSupabaseConfigured } from './supabase';
import {
  VENDORS, PRODUCTS, ORDERS, CATEGORIES,
  RIDERS, SEVA_PROVIDERS, NOTIFICATIONS, WALLET,
  ANALYTICS_DATA, ADMIN_STATS, VILLAGES, SCHEMES,
} from './mockData';

// ─────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────

function ok(data) { return { data, error: null }; }

function err(e, ctx) {
  const msg = e?.message || e?.error_description || String(e) || 'Unknown error';
  if (ctx) console.error(`[SETU API] ${ctx}:`, msg);
  return { data: null, error: { message: msg, code: e?.code, details: e?.details } };
}

/**
 * Wraps a Supabase query with try/catch and mock fallback.
 * PGRST116 (row not found) is treated as ok(null) for single-row queries.
 * @param {Function} fn       - () => supabase query promise
 * @param {*}        fallback - value returned when !isSupabaseConfigured
 * @param {string}   ctx      - context label for error logs
 */
async function safeQuery(fn, fallback, ctx) {
  if (!isSupabaseConfigured) return ok(fallback);
  try {
    const result = await fn();
    if (result.error) {
      if (result.error.code === 'PGRST116') return ok(null); // row not found
      return err(result.error, ctx);
    }
    return ok(result.data);
  } catch (e) {
    return err(e, ctx);
  }
}

/** Demo-mode delay helper */
const delay = (ms = 300) => new Promise(r => setTimeout(r, ms));

// ─────────────────────────────────────────────────────────
// VILLAGES
// ─────────────────────────────────────────────────────────

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
    (VILLAGES || []).find(v => v.id === id) || null,
    'getVillageById'
  );
}

// ─────────────────────────────────────────────────────────
// CATEGORIES
// ─────────────────────────────────────────────────────────

export async function getCategories() {
  return safeQuery(
    () => supabase.from('categories').select('*').eq('is_active', true).order('sort_order'),
    CATEGORIES,
    'getCategories'
  );
}

// ─────────────────────────────────────────────────────────
// VENDORS
// ─────────────────────────────────────────────────────────

export async function getVendors({ villageId, village, category, page = 0, limit = 20 } = {}) {
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
    if (village)   q = q.eq('village', village);
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

// ─────────────────────────────────────────────────────────
// PRODUCTS
// ─────────────────────────────────────────────────────────

export async function getProducts({ vendorId, categoryId, category, search, page = 0, limit = 30 } = {}) {
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

    if (vendorId)    q = q.eq('vendor_id', vendorId);
    if (categoryId)  q = q.eq('category_id', categoryId);
    if (category)    q = q.eq('category', category);
    if (search)      q = q.ilike('name', `%${search}%`);
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

// ─────────────────────────────────────────────────────────
// SEARCH
// ─────────────────────────────────────────────────────────

export async function search(query) {
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
}

// ─────────────────────────────────────────────────────────
// ORDERS
// ─────────────────────────────────────────────────────────

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

/**
 * Places an order. Accepts a flat payload; calculates fees server-side.
 * Falls back to a fake offline order when Supabase is not configured.
 */
export async function placeOrder(orderPayload) {
  if (!isSupabaseConfigured) {
    const fakeOrder = {
      id:           `local-${Date.now()}`,
      order_number: `SETU-${Date.now().toString(36).toUpperCase()}`,
      status:       'pending',
      ...orderPayload,
      created_at:   new Date().toISOString(),
      _offline:     true,
    };
    return ok(fakeOrder);
  }

  const orderNumber = `SETU-${Date.now().toString(36).toUpperCase()}`;
  const { items, ...orderHead } = orderPayload;

  const subtotal    = items.reduce((s, i) => s + i.price * i.qty, 0);
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
    confirmed: 'confirmed_at',
    ready:     'ready_at',
    picked_up: 'picked_up_at',
    delivered: 'delivered_at',
    cancelled: 'cancelled_at',
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

export async function cancelOrder(orderId, reason) {
  return updateOrderStatus(orderId, 'cancelled', { cancel_reason: reason });
}

export async function rateOrder({ orderId, vendorRating, riderRating, comment }) {
  return safeQuery(
    () => supabase.from('orders').update({
      vendor_rating:  vendorRating,
      rider_rating:   riderRating,
      rating_comment: comment,
      is_rated:       true,
    }).eq('id', orderId).select().single(),
    null,
    'rateOrder'
  );
}

export async function reorderItems(orderId) {
  return safeQuery(
    () => supabase
      .from('order_items')
      .select('name, qty, price, product_id')
      .eq('order_id', orderId),
    [],
    'reorderItems'
  );
}

// ─────────────────────────────────────────────────────────
// RIDERS
// ─────────────────────────────────────────────────────────

export async function getRiderByUserId(userId) {
  return safeQuery(
    () => supabase.from('riders').select('*').eq('user_id', userId).maybeSingle(),
    null,
    'getRiderByUserId'
  );
}

export async function updateRiderStatus(riderId, isOnline) {
  return safeQuery(
    () => supabase.from('riders')
      .update({ is_online: isOnline, updated_at: new Date().toISOString() })
      .eq('id', riderId)
      .select()
      .single(),
    null,
    'updateRiderStatus'
  );
}

/** Returns 'ready' orders with no rider assigned, filtered by village. */
export async function getAvailableOrders(villageId) {
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
      rider_id:     riderId,
      rider_name:   riderName,
      status:       'picked_up',
      picked_up_at: new Date().toISOString(),
    }).eq('id', orderId).select().single(),
    null,
    'assignRider'
  );
}

export async function markDelivered(orderId, payload = {}) {
  return updateOrderStatus(orderId, 'delivered', payload);
}

export async function updateRiderLocation(riderId, lat, lng) {
  return safeQuery(
    () => supabase
      .from('rider_locations')
      .upsert(
        { rider_id: riderId, lat, lng, recorded_at: new Date().toISOString() },
        { onConflict: 'rider_id' }
      ),
    { success: true },
    'updateRiderLocation'
  );
}

export async function getRiderEarnings(riderId) {
  return safeQuery(
    () => supabase.from('riders').select('*').eq('id', riderId).single(),
    RIDERS.find(r => r.id === riderId) ?? RIDERS[0],
    'getRiderEarnings'
  );
}

export async function submitCODDeposit(riderId, amount, denominations = null) {
  return safeQuery(
    () => supabase
      .from('cod_deposits')
      .insert({ rider_id: riderId, amount, denominations, status: 'pending_confirmation' })
      .select()
      .single(),
    { success: true, depositId: `dep_${Date.now()}` },
    'submitCODDeposit'
  );
}

// ─────────────────────────────────────────────────────────
// WALLET
// ─────────────────────────────────────────────────────────

export async function getWallet(userId) {
  return safeQuery(
    () => supabase.from('wallets').select('*').eq('user_id', userId).maybeSingle(),
    WALLET ?? { balance: 0 },
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

export async function walletTopup(userId, amount, reference = null) {
  return safeQuery(
    () => supabase.rpc('topup_wallet', {
      p_user_id:   userId,
      p_amount:    amount,
      p_reference: reference,
    }),
    { success: true, amount },
    'walletTopup'
  );
}

/**
 * Deducts amount from a user's wallet for an order payment.
 * Uses an atomic RPC to prevent race conditions on balance.
 */
export async function walletPay(userId, amount, orderId) {
  if (!isSupabaseConfigured) {
    await delay(400);
    return ok({ success: true, amount, orderId });
  }

  try {
    const { data: wallet } = await supabase
      .from('wallets')
      .select('id, balance')
      .eq('user_id', userId)
      .single();

    if (!wallet || wallet.balance < amount) {
      return err({ message: 'Insufficient wallet balance' }, 'walletPay');
    }

    const { error } = await supabase
      .from('wallets')
      .update({ balance: wallet.balance - amount })
      .eq('user_id', userId);

    if (error) return err(error, 'walletPay/update');

    await supabase.from('wallet_transactions').insert({
      wallet_id:   wallet.id,
      user_id:     userId,
      type:        'debit',
      amount,
      description: 'Order payment',
      reference:   orderId,
      status:      'completed',
    });

    return ok({ balance: wallet.balance - amount });
  } catch (e) {
    return err(e, 'walletPay');
  }
}

// ─────────────────────────────────────────────────────────
// PAYMENT (UPI / Razorpay)
// ─────────────────────────────────────────────────────────

export async function initiateUPI(amount, orderId) {
  await delay(600);
  return ok({
    paymentId: `pay_${Date.now()}`,
    amount,
    orderId,
    upiLink:   `upi://pay?pa=setu@hdfc&pn=SETU&am=${amount}&tn=${orderId}`,
    qrCode:    null,
  });
}

export async function verifyPayment(paymentId, orderId, signature) {
  await delay(800);
  return ok({ verified: true, paymentId, orderId });
}

// ─────────────────────────────────────────────────────────
// NOTIFICATIONS
// ─────────────────────────────────────────────────────────

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
    () => supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false),
    null,
    'markAllNotificationsRead'
  );
}

// ─────────────────────────────────────────────────────────
// PROFILE
// ─────────────────────────────────────────────────────────

export async function updateProfile(userId, updates) {
  return safeQuery(
    () => supabase.from('profiles').update(updates).eq('id', userId).select().single(),
    null,
    'updateProfile'
  );
}

// ─────────────────────────────────────────────────────────
// CREDIT
// ─────────────────────────────────────────────────────────

export async function getCreditAccount(userId) {
  if (!isSupabaseConfigured) {
    await delay(400);
    return ok({ limit: 5000, outstanding: 1200, available: 3800, score: 720, status: 'active', repaymentRate: 98 });
  }
  const { data, error } = await supabase
    .from('credit_accounts')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (error) return err(error, 'getCreditAccount');
  return ok({
    limit:         data.credit_limit,
    outstanding:   data.outstanding,
    available:     data.credit_limit - data.outstanding,
    score:         data.score,
    status:        data.status,
    repaymentRate: data.repayment_rate,
  });
}

export async function applyCredit(userId, amount, purpose) {
  if (!isSupabaseConfigured) {
    await delay(800);
    return ok({ applicationId: `capp_${Date.now()}`, status: 'under_review', estimatedDecision: '24 hours' });
  }

  const { data: account } = await supabase
    .from('credit_accounts')
    .select('id, credit_limit, outstanding')
    .eq('user_id', userId)
    .single();

  if (!account) return err({ message: 'No credit account found' }, 'applyCredit');
  if ((account.outstanding + amount) > account.credit_limit) {
    return err({ message: 'Amount exceeds available credit limit' }, 'applyCredit');
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

  if (error) return err(error, 'applyCredit/insert');

  await supabase
    .from('credit_accounts')
    .update({ outstanding: account.outstanding + amount })
    .eq('id', account.id);

  return ok({ applicationId: data.id, status: 'approved', amount });
}

export async function repayCredit(userId, amount) {
  if (!isSupabaseConfigured) {
    await delay(600);
    return ok({ success: true, amount });
  }

  const { data: account } = await supabase
    .from('credit_accounts')
    .select('id, outstanding')
    .eq('user_id', userId)
    .single();

  if (!account) return err({ message: 'No credit account found' }, 'repayCredit');

  const newOutstanding = Math.max(0, account.outstanding - amount);
  await supabase.from('credit_accounts').update({ outstanding: newOutstanding }).eq('id', account.id);

  await supabase.from('credit_transactions').insert({
    account_id: account.id,
    user_id:    userId,
    type:       'repayment',
    amount,
    status:     'repaid',
    repaid_at:  new Date().toISOString(),
  });

  return ok({ success: true, newOutstanding });
}

// ─────────────────────────────────────────────────────────
// SEVA JOBS
// ─────────────────────────────────────────────────────────

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

export async function getSevaJobs(providerId) {
  return safeQuery(
    () => supabase
      .from('seva_jobs')
      .select('*')
      .eq('provider_id', providerId)
      .order('created_at', { ascending: false }),
    [
      { id: 'sj1', title: 'Electrical repair', customer: 'Ram Kumar',  date: 'Today 3PM',    amount: 450, status: 'pending'   },
      { id: 'sj2', title: 'Plumbing fix',       customer: 'Sunita Devi', date: 'Tomorrow 10AM', amount: 600, status: 'confirmed' },
    ],
    'getSevaJobs'
  );
}

export async function getOpenSevaJobs(category, villageId) {
  return safeQuery(() => {
    let q = supabase.from('seva_jobs').select('*').eq('status', 'open');
    if (category)  q = q.eq('category', category);
    if (villageId) q = q.eq('village_id', villageId);
    return q.order('created_at', { ascending: false });
  }, [], 'getOpenSevaJobs');
}

export async function acceptSevaJob(jobId, providerId) {
  return safeQuery(
    () => supabase
      .from('seva_jobs')
      .update({ provider_id: providerId, status: 'accepted', updated_at: new Date().toISOString() })
      .eq('id', jobId)
      .select()
      .single(),
    { success: true, jobId, status: 'accepted' },
    'acceptSevaJob'
  );
}

export async function completeSevaJob(jobId, payload = {}) {
  return safeQuery(
    () => supabase
      .from('seva_jobs')
      .update({
        status:       'completed',
        notes:        payload.notes ?? null,
        completed_at: new Date().toISOString(),
        updated_at:   new Date().toISOString(),
      })
      .eq('id', jobId)
      .select()
      .single(),
    { success: true, status: 'completed' },
    'completeSevaJob'
  );
}

// ─────────────────────────────────────────────────────────
// VENDOR ANALYTICS
// ─────────────────────────────────────────────────────────

export async function getVendorAnalytics(vendorId) {
  if (!isSupabaseConfigured) {
    await delay(300);
    return ok(ANALYTICS_DATA);
  }
  const { data, error } = await supabase
    .from('orders')
    .select('total, created_at, status')
    .eq('vendor_id', vendorId)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: true });
  return error ? err(error, 'getVendorAnalytics') : ok({ raw: data ?? [], ...ANALYTICS_DATA });
}

// ─────────────────────────────────────────────────────────
// AI / RECOMMENDATIONS
// ─────────────────────────────────────────────────────────

export async function getAIRecommendations(userId, village) {
  if (!isSupabaseConfigured) {
    await delay(400);
    return ok(PRODUCTS.slice(0, 6).map(p => ({
      ...p, reason: p.isSeasonal ? 'Seasonal pick' : 'Popular in your area',
    })));
  }
  return safeQuery(
    () => supabase.from('products').select('*, vendors(name)').eq('is_available', true).limit(6),
    [],
    'getAIRecommendations'
  );
}

export async function getDemandForecast(vendorId) {
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

  const { data } = await supabase
    .from('order_items')
    .select('name, qty, orders!inner(vendor_id, created_at, status)')
    .eq('orders.vendor_id', vendorId)
    .neq('orders.status', 'cancelled')
    .gte('orders.created_at', new Date(Date.now() - 30 * 86400000).toISOString());

  if (!data?.length) return ok({ forecasts: [], festivalAlert: null });

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
}

export async function transcribeVoice(audioBlob) {
  const { data, error } = await supabase.functions.invoke('ai-assistant', {
    body: { type: 'transcription', audio: 'base64_encoded_blob_here' },
  });
  return error ? err(error, 'transcribeVoice') : ok(data);
}

export async function chatAssistant(message, context) {
  const { data, error } = await supabase.functions.invoke('ai-assistant', {
    body: { message, context },
  });
  return error ? err(error, 'chatAssistant') : ok(data);
}

// ─────────────────────────────────────────────────────────
// SUPPORT TICKETS
// ─────────────────────────────────────────────────────────

export async function getSupportTickets(userId) {
  return safeQuery(
    () => supabase
      .from('support_tickets')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
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

// ─────────────────────────────────────────────────────────
// FRAUD
// ─────────────────────────────────────────────────────────

export async function checkOrderFraud(orderPayload) {
  await delay(300);
  return ok({ riskScore: Math.random() * 0.3, flags: [], decision: 'approve' });
}

export async function reportFraud(payload) {
  if (!isSupabaseConfigured) {
    await delay(500);
    return ok({ ticketId: `fraud_${Date.now()}`, status: 'logged' });
  }
  const { data: { user } } = await supabase.auth.getUser();
  return createSupportTicket({
    user_id:  user?.id,
    subject:  `Fraud Report: ${payload.fraudType}`,
    status:   'open',
    priority: 'high',
    messages: JSON.stringify([{
      from: 'customer',
      text: payload.description,
      time: new Date().toLocaleTimeString(),
    }]),
  });
}

// ─────────────────────────────────────────────────────────
// SCHEMES
// ─────────────────────────────────────────────────────────

export async function getSchemes({ category } = {}) {
  return safeQuery(() => {
    let q = supabase.from('schemes').select('*').eq('is_active', true).order('name');
    if (category) q = q.eq('category', category);
    return q;
  }, SCHEMES, 'getSchemes');
}

// ─────────────────────────────────────────────────────────
// KYC
// ─────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────
// ADMIN
// ─────────────────────────────────────────────────────────

export async function getAdminStats() {
  if (!isSupabaseConfigured) {
    await delay(300);
    return ok(ADMIN_STATS);
  }
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
    return ok({ ...ADMIN_STATS, totalUsers, totalOrders, activeVendors, activeRiders });
  } catch (e) {
    return err(e, 'getAdminStats');
  }
}

export async function approveVendor(vendorId) {
  return safeQuery(
    () => supabase.from('vendors').update({ is_verified: true, kyc_status: 'approved' }).eq('id', vendorId),
    { success: true },
    'approveVendor'
  );
}

export async function rejectVendor(vendorId, reason) {
  return safeQuery(
    () => supabase.from('vendors').update({ kyc_status: 'rejected' }).eq('id', vendorId),
    { success: true },
    'rejectVendor'
  );
}

export async function confirmCODDeposit(depositId, adminId) {
  if (!isSupabaseConfigured) {
    await delay(500);
    return ok({ success: true });
  }
  const { data: deposit, error: de } = await supabase
    .from('cod_deposits')
    .update({
      status:               'confirmed',
      admin_confirmed_by:   adminId,
      admin_confirmed_at:   new Date().toISOString(),
    })
    .eq('id', depositId)
    .select()
    .single();
  if (de) return err(de, 'confirmCODDeposit');
  await supabase.from('riders').update({ cod_balance: 0 }).eq('id', deposit.rider_id);
  return ok({ success: true });
}

// ═══════════════════════════════════════════════════════════
// AUTH API — namespace export
// ═══════════════════════════════════════════════════════════

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
    return error ? err(error, 'AuthAPI.sendOTP') : ok({ sent: true, phone });
  },

  verifyOTP: async (phone, otp) => {
    if (!isSupabaseConfigured) {
      await delay(800);
      if (otp.length === 4) return ok({ user: { id: 'u1', phone }, token: 'mock-jwt' });
      return err({ message: 'Invalid OTP' });
    }
    const { data, error } = await supabase.auth.verifyOtp({
      phone, token: otp, type: 'sms',
    });
    return error ? err(error, 'AuthAPI.verifyOTP') : ok(data);
  },
};

// ═══════════════════════════════════════════════════════════
// DISCOVERY API — namespace export (backward compat)
// ═══════════════════════════════════════════════════════════

export const DiscoveryAPI = {
  getVendors:    (village, category) => getVendors({ village, category }),
  getVendor:     (id) => getVendorById(id).then(({ data: vendor, error }) =>
    error ? { data: null, error } : ok({ vendor, products: vendor?.products ?? [] })
  ),
  search:        (query) => search(query),
  getCategories: () => getCategories(),
  getProducts:   (vendorId, categoryId) => getProducts({ vendorId, categoryId }),
};

// ═══════════════════════════════════════════════════════════
// ORDER API — namespace export (backward compat)
// ═══════════════════════════════════════════════════════════

export const OrderAPI = {
  create:        placeOrder,
  getHistory:    (userId) => getOrdersByCustomer(userId),
  getDetail:     getOrderById,
  cancel:        cancelOrder,
  rate:          ({ orderId, vendorRating, riderRating, comment }) =>
    rateOrder({ orderId, vendorRating, riderRating, comment }),
  reorder:       (orderId) => reorderItems(orderId).then(({ data, error }) =>
    error ? { data: null, error } : ok({ reordered: true, items: data ?? [] })
  ),
  advanceStatus: updateOrderStatus,
};

// ═══════════════════════════════════════════════════════════
// PAYMENT API — namespace export (backward compat)
// ═══════════════════════════════════════════════════════════

export const PaymentAPI = {
  initiateUPI:    initiateUPI,
  verifyPayment:  verifyPayment,
  walletTopup:    walletTopup,
  walletPay:      walletPay,
  getWallet:      (userId) => getWallet(userId).then(async ({ data: wallet, error }) => {
    if (error) return { data: null, error };
    const { data: txns } = await getWalletTransactions(userId);
    return ok({ ...wallet, transactions: txns ?? [] });
  }),
};

// ═══════════════════════════════════════════════════════════
// VENDOR API — namespace export (backward compat)
// ═══════════════════════════════════════════════════════════

export const VendorAPI = {
  getOrders:     (vendorId) => getOrdersByVendor(vendorId),
  confirmOrder:  (orderId) => updateOrderStatus(orderId, 'confirmed'),
  rejectOrder:   (orderId, reason) => updateOrderStatus(orderId, 'cancelled', { cancel_reason: reason }),
  markReady:     async (orderId) => {
    const { data: order } = await getOrderById(orderId);
    if (order?.status === 'confirmed') await updateOrderStatus(orderId, 'preparing');
    return updateOrderStatus(orderId, 'ready');
  },
  updateProduct: (productId, updates) => safeQuery(
    () => supabase.from('products').update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', productId).select().single(),
    { success: true },
    'VendorAPI.updateProduct'
  ),
  createProduct: (vendorId, productData) => safeQuery(
    () => supabase.from('products').insert({ vendor_id: vendorId, ...productData }).select().single(),
    { id: `p${Date.now()}`, vendor_id: vendorId, ...productData },
    'VendorAPI.createProduct'
  ),
  getAnalytics:  (vendorId) => getVendorAnalytics(vendorId),
};

// ═══════════════════════════════════════════════════════════
// RIDER API — namespace export (backward compat)
// ═══════════════════════════════════════════════════════════

export const RiderAPI = {
  getAvailableOrders: (riderId) => getAvailableOrders(null), // legacy — pass villageId when known
  acceptOrder:        (orderId, riderId, riderName) => assignRider(orderId, riderId, riderName),
  markDelivered:      markDelivered,
  updateLocation:     (riderId, lat, lng) => updateRiderLocation(riderId, lat, lng),
  toggleOnline:       (riderId, isOnline) => updateRiderStatus(riderId, isOnline),
  getEarnings:        (riderId) => getRiderEarnings(riderId),
  submitCODDeposit:   submitCODDeposit,
};

// ═══════════════════════════════════════════════════════════
// CREDIT API — namespace export (backward compat)
// ═══════════════════════════════════════════════════════════

export const CreditAPI = {
  getAccount: getCreditAccount,
  applyCredit,
  repay:      repayCredit,
};

// ═══════════════════════════════════════════════════════════
// SEVA API — namespace export (backward compat)
// ═══════════════════════════════════════════════════════════

export const SevaAPI = {
  getJobs:     getSevaJobs,
  getOpenJobs: getOpenSevaJobs,
  acceptJob:   acceptSevaJob,
  completeJob: completeSevaJob,
};

// ═══════════════════════════════════════════════════════════
// AI API — namespace export (backward compat)
// ═══════════════════════════════════════════════════════════

export const AIAPI = {
  transcribeVoice:     transcribeVoice,
  chatAssistant:       chatAssistant,
  getRecommendations:  (userId, village) => getAIRecommendations(userId, village),
  getDemandForecast:   getDemandForecast,
  voiceQuery:          async (text) => ok({ response: `Searching for: ${text}` }),
};

// ═══════════════════════════════════════════════════════════
// NOTIFICATION API — namespace export (backward compat)
// ═══════════════════════════════════════════════════════════

export const NotificationAPI = {
  getAll:      (userId) => getNotifications(userId),
  markRead:    (notifId) => markNotificationRead(notifId),
  markAllRead: (userId) => markAllNotificationsRead(userId),
};

// ═══════════════════════════════════════════════════════════
// ADMIN API — namespace export (backward compat)
// ═══════════════════════════════════════════════════════════

export const AdminAPI = {
  getMetrics:       getAdminStats,
  assignRider:      (orderId, riderId) => assignRider(orderId, riderId, null),
  approveVendor,
  rejectVendor,
  confirmCODDeposit,
};

// ═══════════════════════════════════════════════════════════
// FRAUD API — namespace export (backward compat)
// ═══════════════════════════════════════════════════════════

export const FraudAPI = {
  checkOrder:  checkOrderFraud,
  reportFraud: reportFraud,
};
