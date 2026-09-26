import fs from 'node:fs';
const file = 'qa/reports/business-flow/runtime.json';
if (!fs.existsSync(file)) process.exit(0);
const runtime = JSON.parse(fs.readFileSync(file, 'utf8'));
const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!url || !serviceKey) throw new Error('Cleanup requires VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
const base = url.replace(/\/$/, '');
async function api(pathname, options = {}) {
  const res = await fetch(base + pathname, { ...options, headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json', ...(options.headers || {}) } });
  if (!res.ok && res.status !== 404) throw new Error(`Cleanup ${options.method || 'GET'} ${pathname} -> ${res.status}: ${await res.text()}`);
  return res;
}
const orders = await api(`/rest/v1/orders?select=id&or=(customer_id.eq.${runtime.customer.id},vendor_id.eq.${runtime.vendor.vendorId},rider_id.eq.${runtime.rider.riderId})`).then(r=>r.json());
const orderIds = (orders || []).map(o=>o.id);
const orderTables = ['delivery_attempts','delivery_proofs','delivery_otps','delivery_financial_finalizations','dispatch_assignment_events','rider_offers','dispatch_events','order_status_history','order_items','order_payments','payments','payment_events','financial_ledger','ledger_entries','wallet_transactions','notifications','outbox_events','analytics_events','client_error_logs'];
for (const table of orderTables) for (const id of orderIds) await api(`/rest/v1/${table}?order_id=eq.${encodeURIComponent(id)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }).catch(()=>{});
for (const id of orderIds) {
  await api(`/rest/v1/notifications?data->>order_id=eq.${encodeURIComponent(id)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }).catch(()=>{});
}
if (orderIds.length) {
  const orderNumbers = await api(`/rest/v1/orders?id=in.(${orderIds.join(',')})&select=order_number`).then(r=>r.json()).catch(()=>[]);
  for (const row of orderNumbers || []) {
    if (row.order_number) await api(`/rest/v1/audit_log?target=eq.${encodeURIComponent(row.order_number)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }).catch(()=>{});
  }
}
for (const id of orderIds) await api(`/rest/v1/orders?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }).catch(()=>{});
await api(`/rest/v1/customer_addresses?id=eq.${encodeURIComponent(runtime.addressId)}`, { method: 'DELETE' }).catch(()=>{});
await api(`/rest/v1/products?id=eq.${encodeURIComponent(runtime.product.id)}`, { method: 'DELETE' }).catch(()=>{});
await api(`/rest/v1/riders?id=eq.${encodeURIComponent(runtime.rider.riderId)}`, { method: 'DELETE' }).catch(()=>{});
await api(`/rest/v1/vendors?id=eq.${encodeURIComponent(runtime.vendor.vendorId)}`, { method: 'DELETE' }).catch(()=>{});
for (const id of [runtime.customer.id, runtime.vendor.id, runtime.rider.id]) await api(`/auth/v1/admin/users/${id}`, { method: 'DELETE' }).catch(()=>{});
fs.rmSync(file, { force: true });
console.log('Business E2E cleanup complete.');
