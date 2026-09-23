import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20240101000096_analytics_observability_phase7.sql'), 'utf8');
const api = fs.readFileSync(path.join(root, 'src/lib/api.js'), 'utf8');
const admin = fs.readFileSync(path.join(root, 'src/pages/admin/AdminAnalytics.jsx'), 'utf8');

describe('Phase 7 analytics and observability contracts', () => {
  test('has immutable order, payment, delivery and financial event streams', () => {
    for (const name of ['immutable_order_events','immutable_payment_events','immutable_delivery_events','immutable_financial_events']) expect(migration).toContain(`create table if not exists ${name}`);
  });
  test('event streams cannot be updated or deleted', () => {
    expect(migration).toContain('prevent_mutation()');
    expect(migration).toContain('before update or delete on immutable_order_events');
    expect(migration).toContain('before update or delete on immutable_payment_events');
  });
  test('order and payment facts are emitted from canonical ledgers', () => {
    expect(migration).toContain("create trigger trg_orders_observability after insert or update of status,payment_status,rider_id on orders");
    expect(migration).toContain('create trigger trg_payment_events_observability after insert on payment_events');
  });
  test('derived analytics and reconciliation dashboard exist', () => {
    for (const name of ['analytics_daily_order_metrics','analytics_daily_payment_metrics','analytics_daily_delivery_metrics','analytics_daily_financial_metrics','reconciliation_dashboard']) expect(migration).toContain(`create or replace view ${name}`);
    expect(migration).toContain('get_observability_dashboard');
  });
  test('admin client consumes the observability dashboard', () => {
    expect(api).toContain('getObservabilityDashboard');
    expect(admin).toContain('AdminAPI.getObservabilityDashboard()');
    expect(admin).toContain('Reconciliation & Observability');
  });
});
