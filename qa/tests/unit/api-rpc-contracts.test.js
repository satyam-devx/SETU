// tests/unit/api-rpc-contracts.test.js
// ─────────────────────────────────────────────────────────────
// Exercises the REAL src/lib/api.js functions (not re-implemented
// logic) to lock the frontend↔RPC contract for the de-mocked Seva
// portal, credit application, admin aggregates, and the order
// write-path lockdown (migrations 041–050).
//
// The supabase client is mocked so we assert the exact RPC name +
// params each function sends, and that { data, error } is unwrapped
// correctly. This catches a renamed RPC, a wrong param key, or a
// dropped error path — the regressions most likely after the
// migration 046/047/048/050 repointing work.
// ─────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the supabase module BEFORE importing the API layer.
vi.mock('@/lib/supabase', () => {
  const rpc = vi.fn();
  const from = vi.fn();
  return {
    supabase:            { rpc, from },
    supabaseRead:        { from },
    isSupabaseConfigured: true,
  };
});

import { supabase } from '@/lib/supabase';
import {
  assignRider,
  adminAssignRider,
  rateOrder,
  getRevenueAnalytics,
  getAdminDashboardStats,
  getTodayHourlyOrders,
  SevaAPI,
  CreditAPI,
} from '@/lib/api';

const okRpc  = (data) => ({ data, error: null });
const errRpc = (message, code) => ({ data: null, error: { message, code } });

beforeEach(() => {
  vi.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════════
// Order write-path lockdown (migration 050)
// ═══════════════════════════════════════════════════════════════
describe('order write-path RPCs (migration 050)', () => {
  it('assignRider routes a rider self-claim through claim_order (no client-supplied rider)', async () => {
    supabase.rpc.mockResolvedValue(okRpc({ success: true, status: 'picked_up' }));

    const res = await assignRider('order-1', 'ignored-rider', 'Ignored Name');

    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(supabase.rpc).toHaveBeenCalledWith('claim_order', { p_order_id: 'order-1' });
    expect(res.error).toBeNull();
    expect(res.data.status).toBe('picked_up');
  });

  it('assignRider surfaces an "already assigned" RPC error', async () => {
    supabase.rpc.mockResolvedValue(errRpc('Order already assigned'));

    const res = await assignRider('order-1');

    expect(res.data).toBeNull();
    expect(res.error.message).toMatch(/already assigned/i);
  });

  it('adminAssignRider routes through admin_assign_rider with order + rider ids', async () => {
    supabase.rpc.mockResolvedValue(okRpc({ success: true }));

    await adminAssignRider('order-9', 'rider-7', 'Name Ignored');

    expect(supabase.rpc).toHaveBeenCalledWith('admin_assign_rider', {
      p_order_id: 'order-9',
      p_rider_id: 'rider-7',
    });
  });

  it('rateOrder routes through the rate_order RPC with mapped params', async () => {
    supabase.rpc.mockResolvedValue(okRpc({ success: true }));

    await rateOrder({ orderId: 'order-3', vendorRating: 5, riderRating: 4, comment: 'great' });

    expect(supabase.rpc).toHaveBeenCalledWith('rate_order', {
      p_order_id:      'order-3',
      p_vendor_rating: 5,
      p_rider_rating:  4,
      p_comment:       'great',
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// Admin aggregates (migrations 046, 047, 048)
// ═══════════════════════════════════════════════════════════════
describe('admin aggregate RPCs', () => {
  it('getAdminDashboardStats calls get_admin_dashboard_live and returns the object', async () => {
    const payload = { totalOrders: 12, totalRiders: 3, todayRevenue: 999 };
    supabase.rpc.mockResolvedValue(okRpc(payload));

    const res = await getAdminDashboardStats();

    expect(supabase.rpc).toHaveBeenCalledWith('get_admin_dashboard_live');
    expect(res.data).toEqual(payload);
  });

  it('getAdminDashboardStats returns {} (not null) when RPC yields no data', async () => {
    supabase.rpc.mockResolvedValue(okRpc(null));
    const res = await getAdminDashboardStats();
    expect(res.error).toBeNull();
    expect(res.data).toEqual({});
  });

  it('getRevenueAnalytics passes p_days and returns the aggregate', async () => {
    const agg = { total_revenue: 5000, total_orders: 40, daily: [], payment_mix: [], top_vendors: [], villages: [] };
    supabase.rpc.mockResolvedValue(okRpc(agg));

    const res = await getRevenueAnalytics({ days: 7 });

    expect(supabase.rpc).toHaveBeenCalledWith('get_revenue_analytics', { p_days: 7 });
    expect(res.data.total_revenue).toBe(5000);
  });

  it('getRevenueAnalytics surfaces RPC errors', async () => {
    supabase.rpc.mockResolvedValue(errRpc('Unauthorized: admin required'));
    const res = await getRevenueAnalytics({ days: 30 });
    expect(res.data).toBeNull();
    expect(res.error.message).toMatch(/admin required/i);
  });

  it('getTodayHourlyOrders buckets per-hour counts into 6AM–10PM labels', async () => {
    // RPC returns sparse per-hour counts; the API fills the rest with 0.
    supabase.rpc.mockResolvedValue(okRpc([
      { hour: 9,  orders: 3 },
      { hour: 14, orders: 5 },
      { hour: 2,  orders: 9 }, // before 6AM — must be filtered out
    ]));

    const res = await getTodayHourlyOrders();

    expect(supabase.rpc).toHaveBeenCalledWith('get_today_hourly_orders');
    // 6..22 inclusive = 17 buckets
    expect(res.data).toHaveLength(17);

    const at = (hr) => res.data.find(b => b.hr === hr);
    expect(at('9AM').orders).toBe(3);
    expect(at('2PM').orders).toBe(5);
    expect(at('10AM').orders).toBe(0);   // unreported hour → 0
    expect(res.data.some(b => b.hr === '2AM')).toBe(false); // filtered out
  });
});

// ═══════════════════════════════════════════════════════════════
// Seva portal (migration 041)
// ═══════════════════════════════════════════════════════════════
describe('SevaAPI job lifecycle RPCs', () => {
  it('acceptJob calls accept_seva_job with the job id', async () => {
    supabase.rpc.mockResolvedValue(okRpc({ success: true }));

    const res = await SevaAPI.acceptJob('job-1');

    expect(supabase.rpc).toHaveBeenCalledWith('accept_seva_job', { p_job_id: 'job-1' });
    expect(res.data.success).toBe(true);
  });

  it('completeJob passes the job id and notes', async () => {
    supabase.rpc.mockResolvedValue(okRpc({ success: true }));

    await SevaAPI.completeJob('job-2', { notes: 'fixed it' });

    expect(supabase.rpc).toHaveBeenCalledWith('complete_seva_job', {
      p_job_id: 'job-2',
      p_notes:  'fixed it',
    });
  });

  it('completeJob defaults notes to null when omitted', async () => {
    supabase.rpc.mockResolvedValue(okRpc({ success: true }));

    await SevaAPI.completeJob('job-3');

    expect(supabase.rpc).toHaveBeenCalledWith('complete_seva_job', {
      p_job_id: 'job-3',
      p_notes:  null,
    });
  });

  it('acceptJob surfaces the "no longer available" RPC error', async () => {
    supabase.rpc.mockResolvedValue(errRpc('This job is no longer available'));

    const res = await SevaAPI.acceptJob('job-taken');

    expect(res.data).toBeNull();
    expect(res.error.message).toMatch(/no longer available/i);
  });
});

// ═══════════════════════════════════════════════════════════════
// Credit application (migration 042)
// ═══════════════════════════════════════════════════════════════
describe('CreditAPI.applyCredit (request_credit RPC)', () => {
  it('routes a credit application through request_credit with amount + purpose', async () => {
    supabase.rpc.mockResolvedValue(okRpc({ status: 'pending' }));

    const res = await CreditAPI.applyCredit('user-1', 500, 'inventory');

    expect(supabase.rpc).toHaveBeenCalledWith('request_credit', {
      p_amount:  500,
      p_purpose: 'inventory',
    });
    expect(res.data.status).toBe('pending');
  });

  it('defaults purpose to null', async () => {
    supabase.rpc.mockResolvedValue(okRpc({ status: 'pending' }));

    await CreditAPI.applyCredit('user-1', 200);

    expect(supabase.rpc).toHaveBeenCalledWith('request_credit', {
      p_amount:  200,
      p_purpose: null,
    });
  });

  it('surfaces the over-limit RPC error', async () => {
    supabase.rpc.mockResolvedValue(errRpc('Amount exceeds available credit'));

    const res = await CreditAPI.applyCredit('user-1', 999999, 'too much');

    expect(res.data).toBeNull();
    expect(res.error.message).toMatch(/exceeds available credit/i);
  });
});
