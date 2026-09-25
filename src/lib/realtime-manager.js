// SETU F7 — Realtime channel ownership + recovery manager.
// One active owner per logical realtime channel. It centralizes:
// - subscription creation/removal
// - reconnect/backoff
// - network-aware recovery
// - missed-event recovery after reconnect
// - subscription state for diagnostics
//
// The manager deliberately does NOT mutate application caches itself. Each
// domain owner decides whether an event patches, invalidates, or refetches.
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { isNetworkOnline, subscribeNetwork } from '@/lib/network-state';

const MAX_BACKOFF_MS = 15_000;
const states = new Map();
let networkCleanup = null;

function ensureNetworkListener() {
  if (networkCleanup || typeof window === 'undefined') return;
  networkCleanup = subscribeNetwork(online => {
    if (!online) return;
    for (const state of states.values()) {
      if (state.active && state.status !== 'SUBSCRIBED') scheduleReconnect(state, 0);
    }
  });
}

function scheduleReconnect(state, delay = null) {
  if (!state.active || state.timer) return;
  const wait = delay == null
    ? Math.min(1_000 * 2 ** state.attempt, MAX_BACKOFF_MS)
    : delay;
  state.timer = setTimeout(() => {
    state.timer = null;
    if (!state.active || !isNetworkOnline()) return;
    connect(state, true);
  }, wait);
  state.attempt += 1;
}

function disconnectChannel(state) {
  if (state.channel) {
    try { supabase.removeChannel(state.channel); } catch (_) { /* best effort */ }
    state.channel = null;
  }
}

function connect(state, reconnect = false) {
  if (!state.active || !isSupabaseConfigured || !isNetworkOnline()) return;
  disconnectChannel(state);
  state.status = reconnect ? 'RECONNECTING' : 'CONNECTING';

  const channel = supabase.channel(state.key);
  state.channel = channel;
  state.generation += 1;
  const generation = state.generation;

  try {
    state.build(channel, payload => {
      if (state.active && generation === state.generation) for (const listener of state.listeners) listener(payload);
    });
  } catch (error) {
    state.status = 'CHANNEL_ERROR';
    for (const listener of state.errorListeners) listener(error);
    scheduleReconnect(state);
    return;
  }

  channel.subscribe(status => {
    if (!state.active || generation !== state.generation) return;
    state.status = status;
    if (status === 'SUBSCRIBED') {
      const wasReconnect = reconnect || state.hasSubscribed;
      state.hasSubscribed = true;
      state.attempt = 0;
      for (const listener of state.statusListeners) listener(status);
      if (wasReconnect) for (const recover of state.recoverers) recover();
      return;
    }
    for (const listener of state.statusListeners) listener(status);
    if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) scheduleReconnect(state);
  });
}

export function subscribeRealtimeChannel({
  key,
  build,
  onEvent,
  onRecover,
  onStatus,
  onError,
}) {
  if (!key || typeof build !== 'function') return () => {};
  ensureNetworkListener();

  let state = states.get(key);
  if (state) {
    // One Supabase channel can safely fan out events to multiple React
    // consumers. Never call .on() after subscribe(); only the manager's
    // in-memory listener set changes here.
    state.refs += 1;
    state.listeners.add(onEvent || (() => {}));
    if (onRecover) state.recoverers.add(onRecover);
    if (onStatus) state.statusListeners.add(onStatus);
    if (onError) state.errorListeners.add(onError);
    return () => release(key, state, { onEvent, onRecover, onStatus, onError });
  }

  state = {
    key,
    build,
    listeners: new Set(),
    recoverers: new Set(),
    statusListeners: new Set(),
    errorListeners: new Set(),
    refs: 1,
    active: true,
    status: 'IDLE',
    attempt: 0,
    timer: null,
    channel: null,
    generation: 0,
    hasSubscribed: false,
  };
  state.listeners.add(onEvent || (() => {}));
  if (onRecover) state.recoverers.add(onRecover);
  if (onStatus) state.statusListeners.add(onStatus);
  if (onError) state.errorListeners.add(onError);
  states.set(key, state);
  connect(state);
  return () => release(key, state, { onEvent, onRecover, onStatus, onError });
}

function release(key, state, listenerSet = {}) {
  if (!state || states.get(key) !== state) return;
  state.refs -= 1;
  if (listenerSet.onEvent) state.listeners.delete(listenerSet.onEvent);
  if (listenerSet.onRecover) state.recoverers.delete(listenerSet.onRecover);
  if (listenerSet.onStatus) state.statusListeners.delete(listenerSet.onStatus);
  if (listenerSet.onError) state.errorListeners.delete(listenerSet.onError);
  if (state.refs > 0) return;
  state.active = false;
  if (state.timer) clearTimeout(state.timer);
  state.timer = null;
  disconnectChannel(state);
  states.delete(key);
}

export function getRealtimeState(key) {
  const state = states.get(key);
  if (!state) return null;
  return {
    key: state.key,
    refs: state.refs,
    status: state.status,
    reconnectAttempts: state.attempt,
    generation: state.generation,
  };
}

export function getRealtimeStates() {
  return Array.from(states.values()).map(state => getRealtimeState(state.key));
}

export function resetRealtimeManagerForTests() {
  for (const state of states.values()) {
    state.active = false;
    if (state.timer) clearTimeout(state.timer);
    disconnectChannel(state);
  }
  states.clear();
}
