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

import { createContext, useContext, useReducer, useMemo } from 'react';
import React from 'react';
import { RIDERS, NOTIFICATIONS, WALLET } from './mockData';
import { isSupabaseConfigured } from './supabase';

// Mock seed data must ONLY appear in demo mode (no Supabase configured).
// In production it would otherwise flash fake riders/notifications and a
// fake ₹1250 wallet balance before DB hydration. Gate it explicitly.
const DEMO = !isSupabaseConfigured;

// ── FALLBACK USER ─────────────────────────────────────────
const FALLBACK_USER = null;

// ── INITIAL STATE ─────────────────────────────────────────
const initialState = {
  // Start with empty orders — hydrated from DB after auth.
  // Mock seed data only shown in demo mode (no Supabase configured).
  riders:          DEMO ? RIDERS : [],
  notifications:   DEMO ? NOTIFICATIONS : [],
  notificationsError: null,
  wallet:          DEMO ? WALLET : { balance: 0, setuCredits: 0 },
  currentUser:     null,
  riderOnline:     true,
  vendorOnline:    true,
  unreadCount:     0,
  isHydrated:      false,   // true once Supabase data has loaded
};

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

    case 'CLEAR_CURRENT_USER':
      return { ...state, currentUser: null };

    // ── Phase 2: DB hydration ──────────────────────────────

    case 'HYDRATE_FROM_DB': {
      const { notifications, wallet, riders } = action.payload;
      const normNotifs = (notifications ?? []).map(normaliseNotification).filter(Boolean);
      return {
        ...state,
        notifications: normNotifs.length  ? normNotifs  : state.notifications,
        wallet:        wallet             ?? state.wallet,
        riders:        riders             ?? state.riders,
        unreadCount:   normNotifs.filter(n => !n.isRead).length || state.unreadCount,
        isHydrated:    true,
      };
    }

    case 'HYDRATE_NOTIFICATIONS': {
      const { notifications } = action.payload;
      const normNotifs = (notifications ?? []).map(normaliseNotification).filter(Boolean);
      if (!normNotifs.length) return { ...state, notificationsError: null };
      return {
        ...state,
        notifications: normNotifs,
        unreadCount:   normNotifs.filter(n => !n.isRead).length,
        notificationsError: null,
      };
    }

    // A failed initial-history fetch used to be swallowed silently (see
    // useRealtimeNotifications in useRealtimeOrders.js) — the customer
    // just saw an empty "No notifications" screen indistinguishable
    // from actually having none, with no way to tell something had gone
    // wrong or to retry.
    case 'NOTIFICATIONS_LOAD_ERROR': {
      return { ...state, notificationsError: action.payload?.message || 'Could not load notifications.' };
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

    // Set the wallet balance to an absolute value (e.g. after a
    // server-confirmed wallet payment returns the new balance).
    // Was previously dispatched by CustomerCheckout but had no
    // matching case — a no-op that left the UI balance stale.
    case 'UPDATE_WALLET_BALANCE': {
      const { balance } = action.payload;
      if (typeof balance !== 'number') return state;
      return { ...state, wallet: { ...state.wallet, balance } };
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
  const contextValue = useMemo(() => ({ state, dispatch }), [state]);
  return (
    <SetuStoreContext.Provider value={contextValue}>
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
