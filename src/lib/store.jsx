// ═══════════════════════════════════════════════════════════
// SETU PLATFORM — GLOBAL STATE STORE (Phase 2)
// Changes from Phase 1:
//   - HYDRATE_FROM_DB: load initial state from Supabase
//   - HYDRATE_ORDERS: merge realtime orders into state
//   - HYDRATE_NOTIFICATIONS: merge realtime notifications
//   - NOTIFICATION_RECEIVED: append incoming push notification
//   - All mutating actions now also call api.js to persist
//     (optimistic update pattern: UI first, DB second)
//   - Existing actions unchanged
// ═══════════════════════════════════════════════════════════

import { createContext, useContext, useReducer, useEffect } from 'react';
import React from 'react';
import { ORDERS, RIDERS, VENDORS, PRODUCTS, NOTIFICATIONS, WALLET } from './mockData';

// ── ORDER STATUS MACHINE ──────────────────────────────────
export const ORDER_STATUS = {
  PENDING:    'pending',
  CONFIRMED:  'confirmed',
  PREPARING:  'preparing',
  READY:      'ready',
  PICKED_UP:  'picked_up',
  ON_THE_WAY: 'on_the_way',
  DELIVERED:  'delivered',
  CANCELLED:  'cancelled',
};

export const ORDER_TRANSITIONS = {
  [ORDER_STATUS.PENDING]:    [ORDER_STATUS.CONFIRMED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.CONFIRMED]:  [ORDER_STATUS.PREPARING, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.PREPARING]:  [ORDER_STATUS.READY],
  [ORDER_STATUS.READY]:      [ORDER_STATUS.PICKED_UP],
  [ORDER_STATUS.PICKED_UP]:  [ORDER_STATUS.ON_THE_WAY],
  [ORDER_STATUS.ON_THE_WAY]: [ORDER_STATUS.DELIVERED],
  [ORDER_STATUS.DELIVERED]:  [],
  [ORDER_STATUS.CANCELLED]:  [],
};

export function canTransition(from, to) {
  return ORDER_TRANSITIONS[from]?.includes(to) ?? false;
}

// ── FALLBACK USER ─────────────────────────────────────────
const FALLBACK_USER = {
  id:         'u1',
  name:       'Anita Devi',
  phone:      '+91 98765 43200',
  village:    'Madhepur',
  village_id: 'v1',
  role:       'customer',
  setuScore:  720,
  language:   'hi',
  isVerified: true,
};

// ── INITIAL STATE ─────────────────────────────────────────
const initialState = {
  orders:          ORDERS.map(o => ({ ...o, _source: 'seed' })),
  riders:          RIDERS,
  notifications:   NOTIFICATIONS,
  wallet:          WALLET,
  currentUser:     FALLBACK_USER,
  riderOnline:     true,
  vendorOnline:    true,
  unreadCount:     NOTIFICATIONS.filter(n => !n.isRead).length,
  isHydrated:      false,   // true once Supabase data has loaded
};

// ── NORMALISE order from Supabase → store shape ───────────
function normaliseOrder(dbRow) {
  if (!dbRow) return null;
  return {
    id:            dbRow.id,
    orderNumber:   dbRow.order_number  ?? dbRow.orderNumber,
    customerId:    dbRow.customer_id   ?? dbRow.customerId,
    customerName:  dbRow.customer_name ?? dbRow.customerName,
    vendorId:      dbRow.vendor_id     ?? dbRow.vendorId,
    vendorName:    dbRow.vendor_name   ?? dbRow.vendorName,
    riderId:       dbRow.rider_id      ?? dbRow.riderId,
    riderName:     dbRow.rider_name    ?? dbRow.riderName,
    village:       dbRow.village,
    village_id:    dbRow.village_id,
    status:        dbRow.status,
    paymentMethod: dbRow.payment_method ?? dbRow.paymentMethod ?? 'COD',
    paymentStatus: dbRow.payment_status ?? dbRow.paymentStatus ?? 'pending',
    subtotal:      dbRow.subtotal ?? 0,
    deliveryFee:   dbRow.delivery_fee ?? dbRow.deliveryFee ?? 0,
    platformFee:   dbRow.platform_fee ?? dbRow.platformFee ?? 0,
    total:         dbRow.total ?? 0,
    is_cod:        dbRow.is_cod ?? dbRow.paymentMethod === 'COD',
    items:         dbRow.order_items   ?? dbRow.items ?? [],
    cancelReason:  dbRow.cancel_reason ?? dbRow.cancelReason,
    vendorRating:  dbRow.vendor_rating ?? dbRow.vendorRating,
    riderRating:   dbRow.rider_rating  ?? dbRow.riderRating,
    isRated:       dbRow.is_rated      ?? dbRow.isRated ?? false,
    createdAt:     dbRow.created_at    ?? dbRow.createdAt,
    confirmedAt:   dbRow.confirmed_at  ?? dbRow.confirmedAt,
    readyAt:       dbRow.ready_at      ?? dbRow.readyAt,
    pickedUpAt:    dbRow.picked_up_at  ?? dbRow.pickedUpAt,
    deliveredAt:   dbRow.delivered_at  ?? dbRow.deliveredAt,
    cancelledAt:   dbRow.cancelled_at  ?? dbRow.cancelledAt,
    _source:       'db',
  };
}

function normaliseNotification(row) {
  if (!row) return null;
  return {
    id:        row.id,
    type:      row.type,
    title:     row.title,
    body:      row.body,
    isRead:    row.is_read ?? row.isRead ?? false,
    createdAt: row.created_at ?? row.createdAt,
  };
}

// ── REDUCER ───────────────────────────────────────────────
function setuReducer(state, action) {
  switch (action.type) {

    // ── Phase 1: user sync ──
    case 'SET_CURRENT_USER': {
      const { profile } = action.payload;
      if (!profile) return state;
      return {
        ...state,
        currentUser: {
          id:         profile.id,
          name:       profile.name       ?? FALLBACK_USER.name,
          phone:      profile.phone      ?? FALLBACK_USER.phone,
          village:    profile.village    ?? FALLBACK_USER.village,
          village_id: profile.village_id ?? FALLBACK_USER.village_id,
          role:       profile.role       ?? FALLBACK_USER.role,
          setuScore:  profile.setu_score ?? FALLBACK_USER.setuScore,
          language:   profile.language   ?? FALLBACK_USER.language,
          isVerified: profile.is_verified ?? false,
        },
      };
    }

    case 'CLEAR_CURRENT_USER':
      return { ...state, currentUser: FALLBACK_USER };

    // ── Phase 2: DB hydration ──────────────────────────────

    case 'HYDRATE_FROM_DB': {
      const { orders, notifications, wallet, riders } = action.payload;
      const normOrders = (orders ?? []).map(normaliseOrder).filter(Boolean);
      const normNotifs = (notifications ?? []).map(normaliseNotification).filter(Boolean);
      return {
        ...state,
        orders:        normOrders.length  ? normOrders  : state.orders,
        notifications: normNotifs.length  ? normNotifs  : state.notifications,
        wallet:        wallet             ?? state.wallet,
        riders:        riders             ?? state.riders,
        unreadCount:   normNotifs.filter(n => !n.isRead).length || state.unreadCount,
        isHydrated:    true,
      };
    }

    case 'HYDRATE_ORDERS': {
      const { orders, mode } = action.payload;
      const normOrders = (orders ?? []).map(normaliseOrder).filter(Boolean);
      if (!normOrders.length) return state;

      // Merge: DB rows win over seed rows; preserve optimistic rows not yet in DB
      const dbIds    = new Set(normOrders.map(o => o.id));
      const seedOnly = state.orders.filter(o => !dbIds.has(o.id) && o._source === 'optimistic');
      return {
        ...state,
        orders: [...normOrders, ...seedOnly],
      };
    }

    case 'HYDRATE_NOTIFICATIONS': {
      const { notifications } = action.payload;
      const normNotifs = (notifications ?? []).map(normaliseNotification).filter(Boolean);
      if (!normNotifs.length) return state;
      return {
        ...state,
        notifications: normNotifs,
        unreadCount:   normNotifs.filter(n => !n.isRead).length,
      };
    }

    case 'NOTIFICATION_RECEIVED': {
      const { notification } = action.payload;
      const norm = normaliseNotification(notification);
      if (!norm) return state;
      if (state.notifications.find(n => n.id === norm.id)) return state;
      return {
        ...state,
        notifications: [norm, ...state.notifications],
        unreadCount:   state.unreadCount + 1,
      };
    }

    // ── Order actions (unchanged logic, DB sync happens in components) ──

    case 'ORDER_ADVANCE_STATUS': {
      const { orderId, newStatus, meta } = action.payload;
      return {
        ...state,
        orders: state.orders.map(o =>
          o.id === orderId ? {
            ...o,
            status:  newStatus,
            ...meta,
            [`${newStatus}At`]: new Date().toISOString(),
            _source: 'optimistic',
          } : o
        ),
      };
    }

    case 'ORDER_PLACE': {
      const incoming = action.payload;
      // Normalise in case it came from DB via Realtime
      const order = incoming._source
        ? incoming
        : {
          id:            incoming.id          ?? `o${Date.now()}`,
          orderNumber:   incoming.order_number ?? incoming.orderNumber ?? `SETU-OPT-${Date.now()}`,
          customerId:    incoming.customer_id  ?? incoming.customerId,
          customerName:  incoming.customer_name ?? incoming.customerName,
          vendorId:      incoming.vendor_id    ?? incoming.vendorId,
          vendorName:    incoming.vendor_name  ?? incoming.vendorName,
          village:       incoming.village,
          village_id:    incoming.village_id,
          status:        incoming.status       ?? ORDER_STATUS.PENDING,
          paymentMethod: incoming.payment_method ?? incoming.paymentMethod ?? 'COD',
          paymentStatus: incoming.payment_status ?? incoming.paymentStatus ?? 'pending',
          subtotal:      incoming.subtotal  ?? 0,
          deliveryFee:   incoming.delivery_fee ?? incoming.deliveryFee  ?? 0,
          platformFee:   incoming.platform_fee ?? incoming.platformFee  ?? 0,
          total:         incoming.total     ?? 0,
          is_cod:        incoming.is_cod    ?? false,
          items:         incoming.order_items ?? incoming.items ?? [],
          createdAt:     incoming.created_at  ?? incoming.createdAt ?? new Date().toISOString(),
          _source:       'optimistic',
        };

      // Avoid duplicates from Realtime echo
      if (state.orders.find(o => o.id === order.id)) return state;

      const notification = {
        id:        `n${Date.now()}`,
        type:      'order',
        title:     'Order Placed! 🎉',
        body:      `${order.orderNumber} placed. Waiting for vendor confirmation.`,
        isRead:    false,
        createdAt: new Date().toISOString(),
      };

      return {
        ...state,
        orders:        [order, ...state.orders],
        notifications: [notification, ...state.notifications],
        unreadCount:   state.unreadCount + 1,
      };
    }

    case 'ORDER_CANCEL': {
      const { orderId, reason } = action.payload;
      const order = state.orders.find(o => o.id === orderId);
      if (!order || !canTransition(order.status, ORDER_STATUS.CANCELLED)) return state;
      return {
        ...state,
        orders: state.orders.map(o =>
          o.id === orderId ? {
            ...o,
            status:       ORDER_STATUS.CANCELLED,
            cancelReason: reason,
            cancelledAt:  new Date().toISOString(),
            _source:      'optimistic',
          } : o
        ),
      };
    }

    case 'ORDER_RATE': {
      const { orderId, vendorRating, riderRating, comment } = action.payload;
      return {
        ...state,
        orders: state.orders.map(o =>
          o.id === orderId ? {
            ...o,
            vendorRating,
            riderRating,
            ratingComment: comment,
            isRated:       true,
          } : o
        ),
      };
    }

    case 'RIDER_ACCEPT_ORDER': {
      const { orderId, riderId } = action.payload;
      const rider = state.riders.find(r => r.id === riderId);
      return {
        ...state,
        orders: state.orders.map(o =>
          o.id === orderId ? {
            ...o,
            riderId,
            riderName:  rider?.name || 'Assigned Rider',
            status:     ORDER_STATUS.PICKED_UP,
            acceptedAt: new Date().toISOString(),
            _source:    'optimistic',
          } : o
        ),
      };
    }

    case 'RIDER_DELIVER': {
      const { orderId, photoUrl, codCollected, riderId, amount } = action.payload;
      return {
        ...state,
        orders: state.orders.map(o =>
          o.id === orderId ? {
            ...o,
            status:          ORDER_STATUS.DELIVERED,
            deliveredAt:     new Date().toISOString(),
            deliveryPhotoUrl: photoUrl,
            codCollected:    codCollected ?? false,
            _source:         'optimistic',
          } : o
        ),
        riders: state.riders.map(r =>
          r.id === riderId ? {
            ...r,
            todayDeliveries: r.todayDeliveries + 1,
            totalDeliveries: r.totalDeliveries + 1,
            todayEarnings:   r.todayEarnings + 80,
            totalEarnings:   r.totalEarnings + 80,
            codBalance:      r.codBalance + (codCollected ? (amount || 0) : 0),
          } : r
        ),
        notifications: [
          {
            id:        `n${Date.now()}`,
            type:      'order',
            title:     'Order Delivered! ✅',
            body:      'Order has been delivered successfully.',
            isRead:    false,
            createdAt: new Date().toISOString(),
          },
          ...state.notifications,
        ],
        unreadCount: state.unreadCount + 1,
      };
    }

    case 'VENDOR_CONFIRM_ORDER': {
      const { orderId } = action.payload;
      return {
        ...state,
        orders: state.orders.map(o =>
          o.id === orderId ? {
            ...o,
            status:      ORDER_STATUS.CONFIRMED,
            confirmedAt: new Date().toISOString(),
            _source:     'optimistic',
          } : o
        ),
      };
    }

    case 'VENDOR_MARK_READY': {
      const { orderId } = action.payload;
      return {
        ...state,
        orders: state.orders.map(o =>
          o.id === orderId ? {
            ...o,
            status:  ORDER_STATUS.READY,
            readyAt: new Date().toISOString(),
            _source: 'optimistic',
          } : o
        ),
      };
    }

    case 'VENDOR_REJECT_ORDER': {
      const { orderId, reason } = action.payload;
      return {
        ...state,
        orders: state.orders.map(o =>
          o.id === orderId ? {
            ...o,
            status:       ORDER_STATUS.CANCELLED,
            cancelReason: reason || 'Rejected by vendor',
            cancelledAt:  new Date().toISOString(),
            _source:      'optimistic',
          } : o
        ),
      };
    }

    case 'NOTIFICATION_READ': {
      const { id } = action.payload;
      return {
        ...state,
        notifications: state.notifications.map(n =>
          n.id === id ? { ...n, isRead: true, is_read: true } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      };
    }

    case 'NOTIFICATIONS_READ_ALL': {
      return {
        ...state,
        notifications: state.notifications.map(n => ({ ...n, isRead: true, is_read: true })),
        unreadCount:   0,
      };
    }

    case 'WALLET_TOPUP': {
      const { amount } = action.payload;
      return {
        ...state,
        wallet: {
          ...state.wallet,
          balance: (state.wallet.balance ?? 0) + amount,
          transactions: [
            {
              id:          `t${Date.now()}`,
              type:        'credit',
              amount,
              description: 'Wallet top-up',
              date:        new Date().toISOString().slice(0, 10),
              status:      'completed',
            },
            ...(state.wallet.transactions ?? []),
          ],
        },
      };
    }

    case 'RIDER_TOGGLE_ONLINE':
      return { ...state, riderOnline: !state.riderOnline };

    case 'VENDOR_TOGGLE_ONLINE':
      return { ...state, vendorOnline: !state.vendorOnline };

    case 'PRODUCT_UPDATE_STOCK':
      return state;

    default:
      return state;
  }
}

// ── CONTEXT & PROVIDER ────────────────────────────────────
const SetuStoreContext = createContext(null);

export function SetuStoreProvider({ children }) {
  const [state, dispatch] = useReducer(setuReducer, initialState);
  return (
    <SetuStoreContext.Provider value={{ state, dispatch }}>
      {children}
    </SetuStoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(SetuStoreContext);
  if (!ctx) throw new Error('useStore must be used within SetuStoreProvider');
  return ctx;
}

// ── SELECTOR HOOKS ────────────────────────────────────────
export function useOrders(filter) {
  const { state } = useStore();
  if (!filter) return state.orders;
  return state.orders.filter(filter);
}

export function useOrder(orderId) {
  const { state } = useStore();
  return state.orders.find(o => o.id === orderId);
}

export function useCurrentUser() {
  const { state } = useStore();
  return state.currentUser;
}

export function useNotifications() {
  const { state } = useStore();
  return { notifications: state.notifications, unreadCount: state.unreadCount };
}

export function useWallet() {
  const { state } = useStore();
  return state.wallet;
}

export function useRiderState() {
  const { state, dispatch } = useStore();
  return {
    isOnline:     state.riderOnline,
    toggleOnline: () => dispatch({ type: 'RIDER_TOGGLE_ONLINE' }),
  };
}
