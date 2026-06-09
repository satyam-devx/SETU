// ═══════════════════════════════════════════════════════════
// SETU — utils.js
// Shared utilities. Pure functions only — no side effects.
// ═══════════════════════════════════════════════════════════
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// ── Tailwind class merge ──────────────────────────────────
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// ── Currency ──────────────────────────────────────────────
/**
 * Format a number as Indian Rupees.
 * e.g. 12500 → "₹12,500"
 */
export function formatCurrency(amount, { digits = 0, prefix = '₹' } = {}) {
  if (amount == null || isNaN(amount)) return `${prefix}0`;
  return `${prefix}${Number(amount).toLocaleString('en-IN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

// ── Date / Time ───────────────────────────────────────────
const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

export function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000; // seconds
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return rtf.format(-Math.floor(diff / 60), 'minute');
  if (diff < 86400) return rtf.format(-Math.floor(diff / 3600), 'hour');
  return rtf.format(-Math.floor(diff / 86400), 'day');
}

export function formatDate(dateStr, opts = {}) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    ...opts,
  });
}

export function formatTime(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

export function formatDateTime(dateStr) {
  if (!dateStr) return '';
  return `${formatDate(dateStr)}, ${formatTime(dateStr)}`;
}

// ── String ────────────────────────────────────────────────
export function truncate(str, len = 40) {
  if (!str) return '';
  return str.length > len ? `${str.slice(0, len)}…` : str;
}

export function initials(name = '') {
  return name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() || '')
    .join('');
}

export function slugify(str = '') {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ── Numbers ───────────────────────────────────────────────
export function clamp(n, min, max) {
  return Math.min(Math.max(n, min), max);
}

export function roundTo(n, places = 2) {
  return Math.round(n * 10 ** places) / 10 ** places;
}

// ── Order number generation ───────────────────────────────
export function generateOrderNumber() {
  return `SETU-${Date.now().toString(36).toUpperCase()}`;
}

// ── Phone formatting ─────────────────────────────────────
export function formatPhone(phone = '') {
  const digits = phone.replace(/\D/g, '').replace(/^91/, '');
  if (digits.length === 10) {
    return `+91 ${digits.slice(0,5)} ${digits.slice(5)}`;
  }
  return phone;
}

// ── Status helpers ────────────────────────────────────────
export const STATUS_LABELS = {
  pending:    'Pending',
  confirmed:  'Confirmed',
  preparing:  'Preparing',
  ready:      'Ready',
  picked_up:  'Picked Up',
  on_the_way: 'On The Way',
  delivered:  'Delivered',
  cancelled:  'Cancelled',
};

export const STATUS_COLORS = {
  pending:    'bg-yellow-100 text-yellow-700',
  confirmed:  'bg-blue-100 text-blue-700',
  preparing:  'bg-orange-100 text-orange-700',
  ready:      'bg-purple-100 text-purple-700',
  picked_up:  'bg-indigo-100 text-indigo-700',
  on_the_way: 'bg-cyan-100 text-cyan-700',
  delivered:  'bg-green-100 text-green-700',
  cancelled:  'bg-red-100 text-red-700',
};

export function getStatusLabel(status) {
  return STATUS_LABELS[status] || status;
}

export function getStatusColor(status) {
  return STATUS_COLORS[status] || 'bg-muted text-muted-foreground';
}

// ── Rating ────────────────────────────────────────────────
export function renderStars(rating = 0) {
  return Array.from({ length: 5 }, (_, i) => i < Math.round(rating) ? '★' : '☆').join('');
}

// ── Delivery fee calc (mirrors backend logic) ─────────────
export function calcOrderTotals(items = [], deliveryFeeBase = 20) {
  const subtotal    = items.reduce((s, i) => s + (i.price * i.qty), 0);
  const deliveryFee = subtotal >= 200 ? 0 : deliveryFeeBase;
  const platformFee = Math.round(subtotal * 0.01);
  const total       = subtotal + deliveryFee + platformFee;
  return { subtotal, deliveryFee, platformFee, total };
}

// ── LocalStorage with fallback ────────────────────────────
export const storage = {
  get(key, fallback = null) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  },
  remove(key) {
    try { localStorage.removeItem(key); } catch {}
  },
};
