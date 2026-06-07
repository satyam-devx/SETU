// ═══════════════════════════════════════════════════════════
// SETU — useRealtimeNotifications
// Subscribes to Supabase Realtime on the notifications table
// for the current authenticated user.
// Falls back to store state when Supabase is not configured.
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useStore } from '@/lib/store';
import { NotificationAPI } from '@/lib/api';

/**
 * @param {string} userId  - authenticated user's UUID
 */
export function useRealtimeNotifications(userId) {
  const { state, dispatch } = useStore();
  const channelRef = useRef(null);

  const [notifications, setNotifications] = useState(state.notifications);
  const [unreadCount,   setUnreadCount]   = useState(state.unreadCount);
  const [isLoading,     setIsLoading]     = useState(true);
  const [error,         setError]         = useState(null);

  // ── Derive unread count from notification list ──
  const syncUnread = useCallback((list) => {
    setUnreadCount(list.filter(n => !n.isRead && !n.is_read).length);
  }, []);

  // ── Initial fetch ──
  const fetchNotifications = useCallback(async () => {
    setIsLoading(true);
    if (!isSupabaseConfigured || !userId) {
      setNotifications(state.notifications);
      syncUnread(state.notifications);
      setIsLoading(false);
      return;
    }

    const { data, error: e } = await NotificationAPI.getAll(userId);
    if (e) {
      setError(e);
      setNotifications(state.notifications);
      syncUnread(state.notifications);
    } else {
      const list = data ?? [];
      setNotifications(list);
      syncUnread(list);
      // Hydrate store
      dispatch({ type: 'HYDRATE_NOTIFICATIONS', payload: { notifications: list } });
    }
    setIsLoading(false);
  }, [userId, state.notifications, syncUnread, dispatch]);

  // ── Realtime subscription ──
  useEffect(() => {
    fetchNotifications();

    if (!isSupabaseConfigured || !userId) return;

    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newNotif = payload.new;
          setNotifications(prev => {
            if (prev.find(n => n.id === newNotif.id)) return prev;
            const updated = [newNotif, ...prev];
            syncUnread(updated);
            return updated;
          });
          setUnreadCount(c => c + 1);

          // Update store
          dispatch({
            type:    'NOTIFICATION_RECEIVED',
            payload: { notification: newNotif },
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event:  'UPDATE',
          schema: 'public',
          table:  'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const updated = payload.new;
          setNotifications(prev => {
            const list = prev.map(n => n.id === updated.id ? updated : n);
            syncUnread(list);
            return list;
          });
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // ── Keep in sync with store in demo mode ──
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setNotifications(state.notifications);
      syncUnread(state.notifications);
    }
  }, [state.notifications, state.unreadCount, syncUnread]);

  // ── Mark single notification read ──
  const markRead = useCallback(async (id) => {
    // Optimistic update
    setNotifications(prev => {
      const list = prev.map(n => n.id === id ? { ...n, is_read: true, isRead: true } : n);
      syncUnread(list);
      return list;
    });
    setUnreadCount(c => Math.max(0, c - 1));
    dispatch({ type: 'NOTIFICATION_READ', payload: { id } });

    if (isSupabaseConfigured) {
      await NotificationAPI.markRead(id);
    }
  }, [dispatch, syncUnread]);

  // ── Mark all read ──
  const markAllRead = useCallback(async () => {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true, isRead: true })));
    setUnreadCount(0);
    dispatch({ type: 'NOTIFICATIONS_READ_ALL' });

    if (isSupabaseConfigured && userId) {
      await NotificationAPI.markAllRead(userId);
    }
  }, [userId, dispatch]);

  const refetch = useCallback(() => fetchNotifications(), [fetchNotifications]);

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    markRead,
    markAllRead,
    refetch,
  };
}
