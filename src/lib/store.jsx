// ═══════════════════════════════════════════════════════════
// SETU PLATFORM — GLOBAL STATE STORE
// Phase 1 update:
//   - currentUser is no longer hardcoded in initialState
//   - SET_CURRENT_USER action hydrates user from AuthContext
//   - Backward compatible: falls back to demo user when not set
//   - All existing actions preserved unchanged
// ═══════════════════════════════════════════════════════════

import { createContext, useContext, useReducer } from 'react';
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

// ── DEMO / FALLBACK USER ──────────────────────────────────
// Used when AuthContext has not yet dispatched SET_CURRENT_USER
// (e.g. first render before session loads, or demo mode)
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
  orders:       ORDERS.map(o => ({ ...o, _source: 'seed' })),
  riders:       RIDERS,
  notifications: NOTIFICATIONS,
  wallet:       WALLET,
  // currentUser starts as fallback; replaced via SET_CURRENT_USER
  // when AuthContext loads the real profile from Supabase.
  currentUser:  FALLBACK_USER,
  riderOnline:  true,
  vendorOnline: true,
  unreadCount:  NOTIFICATIONS.filter(n => !n.isRead).length,
};

// ── REDUCER ───────────────────────────────────────────────
function setuReducer(state, action) {
  switch (action.type) {

    // ── NEW in Phase 1: sync user from AuthContext ──
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

    // ── CLEAR user on sign-out ──
    case 'CLEAR_CURRENT_USER': {
      return { ...state, currentUser: FALLBACK_USER };
    }

    case 'ORDER_ADVANCE_STATUS': {
      const { orderId, newStatus, meta } = action.payload;
      return {
        ...state,
        orders: state.orders.map(o =>
          o.id === orderId ? {
            ...o,
            status: newStatus,
            ...meta,
            [`${newStatus}At`]: new Date().toISOString(),
          } : o
        ),
      };
    }

    case 'ORDER_PLACE': {
      const order = {
        id:          `o${Date.now()}`,
        orderNumber: `SETU-2025-${String(state.orders.length + 1).padStart(4, '0')}`,
        ...action.payload,
        status:    ORDER_STATUS.PENDING,
        createdAt: new Date().toISOString(),
      };
      const notification = {
        id:        `n${Date.now()}`,
        type:      'order',
        title:     'Order Placed!',
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
            status:      ORDER_STATUS.CANCELLED,
            cancelReason: reason,
            cancelledAt: new Date().toISOString(),
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
          } : o
        ),
      };
    }

    case 'RIDER_DELIVER': {
      const { orderId, photoUrl, codCollected } = action.payload;
      return {
        ...state,
        orders: state.orders.map(o =>
          o.id === orderId ? {
            ...o,
            status:          ORDER_STATUS.DELIVERED,
            deliveredAt:     new Date().toISOString(),
            deliveryPhotoUrl: photoUrl,
            codCollected:    codCollected ?? o.is_cod,
          } : o
        ),
        riders: state.riders.map(r =>
          r.id === action.payload.riderId ? {
            ...r,
            todayDeliveries: r.todayDeliveries + 1,
            todayEarnings:   r.todayEarnings + 80,
            totalEarnings:   r.totalEarnings + 80,
            codBalance:      r.codBalance + (codCollected ? (action.payload.amount || 0) : 0),
          } : r
        ),
        notifications: [
          {
            id:        `n${Date.now()}`,
            type:      'order',
            title:     'Order Delivered! ✅',
            body:      'Order has been delivered. Thank you!',
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
            status:      ORDER_STATUS.CANCELLED,
            cancelReason: reason || 'Rejected by vendor',
            cancelledAt: new Date().toISOString(),
          } : o
        ),
      };
    }

    case 'NOTIFICATION_READ': {
      const { id } = action.payload;
      return {
        ...state,
        notifications: state.notifications.map(n =>
          n.id === id ? { ...n, isRead: true } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      };
    }

    case 'NOTIFICATIONS_READ_ALL': {
      return {
        ...state,
        notifications: state.notifications.map(n => ({ ...n, isRead: true })),
        unreadCount:   0,
      };
    }

    case 'WALLET_TOPUP': {
      const { amount } = action.payload;
      return {
        ...state,
        wallet: {
          ...state.wallet,
          balance: state.wallet.balance + amount,
          transactions: [
            {
              id:          `t${Date.now()}`,
              type:        'credit',
              amount,
              description: 'Wallet top-up',
              date:        new Date().toISOString().slice(0, 10),
              status:      'completed',
            },
            ...state.wallet.transactions,
          ],
        },
      };
    }

    case 'RIDER_TOGGLE_ONLINE': {
      return { ...state, riderOnline: !state.riderOnline };
    }

    case 'VENDOR_TOGGLE_ONLINE': {
      return { ...state, vendorOnline: !state.vendorOnline };
    }

    case 'PRODUCT_UPDATE_STOCK': {
      return state;
    }

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
