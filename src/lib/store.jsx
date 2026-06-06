// ═══════════════════════════════════════════════════════════
// SETU PLATFORM — GLOBAL STATE STORE  (production-hardened)
//
// KEY FIXES APPLIED:
//
//  1. FALLBACK_USER is now null (not a fake profile) during the loading
//     window. This prevents stale Anita Devi data from leaking into UI
//     while the real session is being resolved. Components that rely on
//     currentUser should handle null gracefully.
//
//  2. SET_CURRENT_USER validates the payload before mutating state,
//     so a malformed dispatch cannot corrupt the user object.
//
//  3. CLEAR_CURRENT_USER resets currentUser to null (not FALLBACK_USER),
//     so post-logout state is clean and unambiguous.
//
//  4. useCurrentUser() now returns null instead of fake data when no
//     real profile is loaded. Callers should guard: `const user = useCurrentUser()`.
//
//  5. React import moved to top (was after named imports — cosmetic but
//     correct per convention).
//
//  6. PRODUCTS and VENDORS were imported from mockData but never used in
//     initialState — removed from import to eliminate dead references.
//     Add them back if/when they are used in state.
//
//  7. RIDER_DELIVER hardcoded +80 earnings — kept as-is (mock behaviour)
//     but marked with TODO for real earnings logic.
// ═══════════════════════════════════════════════════════════

import React, { createContext, useContext, useReducer } from 'react';
import { ORDERS, RIDERS, NOTIFICATIONS, WALLET } from './mockData';

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

// ── INITIAL STATE ─────────────────────────────────────────
// FIX (Issue 9 / store): currentUser starts as null.
// It is populated exclusively by SET_CURRENT_USER dispatched from
// AuthStoreBridge in App.jsx once AuthContext loads the real profile.
// Using null (not a fake FALLBACK_USER object) makes it unambiguous
// whether a real profile has been loaded yet.
const initialState = {
  orders:        ORDERS.map(o => ({ ...o, _source: 'seed' })),
  riders:        RIDERS,
  notifications: NOTIFICATIONS,
  wallet:        WALLET,
  currentUser:   null,       // null until AuthStoreBridge dispatches SET_CURRENT_USER
  riderOnline:   true,
  vendorOnline:  true,
  unreadCount:   NOTIFICATIONS.filter(n => !n.isRead).length,
};

// ── REDUCER ───────────────────────────────────────────────
function setuReducer(state, action) {
  switch (action.type) {

    // ── Sync real user from AuthContext (via AuthStoreBridge) ──
    case 'SET_CURRENT_USER': {
      const { profile } = action.payload;

      // FIX: validate payload before mutating — malformed dispatch returns current state
      if (!profile || typeof profile !== 'object' || !profile.id) {
        console.warn('[SETU Store] SET_CURRENT_USER: invalid profile payload', profile);
        return state;
      }

      return {
        ...state,
        currentUser: {
          id:         profile.id,
          name:       profile.name       ?? 'SETU User',
          phone:      profile.phone      ?? '',
          village:    profile.village    ?? null,
          village_id: profile.village_id ?? null,
          role:       profile.role       ?? 'customer',
          setuScore:  profile.setu_score ?? 500,
          language:   profile.language   ?? 'hi',
          isVerified: profile.is_verified ?? false,
        },
      };
    }

    // ── Clear on sign-out ──
    // FIX: resets to null, not a fake user, so post-logout state is clean
    case 'CLEAR_CURRENT_USER': {
      return { ...state, currentUser: null };
    }

    case 'ORDER_ADVANCE_STATUS': {
      const { orderId, newStatus, meta } = action.payload;
      return {
        ...state,
        orders: state.orders.map(o =>
          o.id === orderId
            ? { ...o, status: newStatus, ...meta, [`${newStatus}At`]: new Date().toISOString() }
            : o
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
          o.id === orderId
            ? { ...o, status: ORDER_STATUS.CANCELLED, cancelReason: reason, cancelledAt: new Date().toISOString() }
            : o
        ),
      };
    }

    case 'ORDER_RATE': {
      const { orderId, vendorRating, riderRating, comment } = action.payload;
      return {
        ...state,
        orders: state.orders.map(o =>
          o.id === orderId
            ? { ...o, vendorRating, riderRating, ratingComment: comment, isRated: true }
            : o
        ),
      };
    }

    case 'RIDER_ACCEPT_ORDER': {
      const { orderId, riderId } = action.payload;
      const rider = state.riders.find(r => r.id === riderId);
      return {
        ...state,
        orders: state.orders.map(o =>
          o.id === orderId
            ? { ...o, riderId, riderName: rider?.name || 'Assigned Rider', status: ORDER_STATUS.PICKED_UP, acceptedAt: new Date().toISOString() }
            : o
        ),
      };
    }

    case 'RIDER_DELIVER': {
      const { orderId, photoUrl, codCollected, riderId, amount } = action.payload;
      // TODO: replace hardcoded 80 with real per-delivery earnings from profile/config
      const DELIVERY_EARNING = 80;
      return {
        ...state,
        orders: state.orders.map(o =>
          o.id === orderId
            ? { ...o, status: ORDER_STATUS.DELIVERED, deliveredAt: new Date().toISOString(), deliveryPhotoUrl: photoUrl, codCollected: codCollected ?? o.is_cod }
            : o
        ),
        riders: state.riders.map(r =>
          r.id === riderId
            ? {
                ...r,
                todayDeliveries: r.todayDeliveries + 1,
                todayEarnings:   r.todayEarnings + DELIVERY_EARNING,
                totalEarnings:   r.totalEarnings + DELIVERY_EARNING,
                codBalance:      r.codBalance + (codCollected ? (amount || 0) : 0),
              }
            : r
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
          o.id === orderId
            ? { ...o, status: ORDER_STATUS.CONFIRMED, confirmedAt: new Date().toISOString() }
            : o
        ),
      };
    }

    case 'VENDOR_MARK_READY': {
      const { orderId } = action.payload;
      return {
        ...state,
        orders: state.orders.map(o =>
          o.id === orderId
            ? { ...o, status: ORDER_STATUS.READY, readyAt: new Date().toISOString() }
            : o
        ),
      };
    }

    case 'VENDOR_REJECT_ORDER': {
      const { orderId, reason } = action.payload;
      return {
        ...state,
        orders: state.orders.map(o =>
          o.id === orderId
            ? { ...o, status: ORDER_STATUS.CANCELLED, cancelReason: reason || 'Rejected by vendor', cancelledAt: new Date().toISOString() }
            : o
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
      // TODO: implement when product state is added to store
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

/**
 * Returns the current authenticated user from the store,
 * or null if the auth session has not yet loaded.
 *
 * FIX: Returns null instead of a fake FALLBACK_USER, so callers can
 * distinguish "loading" from "logged in". Guard usage:
 *
 *   const user = useCurrentUser();
 *   if (!user) return <LoadingSpinner />;
 */
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

export function useVendorState() {
  const { state, dispatch } = useStore();
  return {
    isOnline:     state.vendorOnline,
    toggleOnline: () => dispatch({ type: 'VENDOR_TOGGLE_ONLINE' }),
  };
}
