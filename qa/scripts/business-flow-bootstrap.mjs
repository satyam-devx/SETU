import fs from 'node:fs';

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!url || !anonKey || !serviceKey) {
  throw new Error('Business E2E requires VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY. Refusing to run against demo mode.');
}

const base = url.replace(/\/$/, '');
const runId = `E2E-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0,14)}-${Math.random().toString(36).slice(2,7).toUpperCase()}`;
const password = `E2e!${Math.random().toString(36).slice(2)}-SETU`;
const suffix = runId.toLowerCase().replace(/[^a-z0-9]/g, '').slice(-10);

async function api(pathname, options = {}) {
  const res = await fetch(base + pathname, {
    ...options,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${options.method || 'GET'} ${pathname} -> ${res.status}: ${JSON.stringify(body)}`);
  return body;
}

async function createUser(email, name, role) {
  return api('/auth/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { name, role } }),
  });
}

async function signIn(email) {
  const res = await fetch(`${base}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`Sign-in failed for ${email}: ${res.status} ${JSON.stringify(body)}`);
  return body;
}

const customer = await createUser(`customer+${suffix}@e2e.setu.local`, 'SETU E2E Customer', 'customer');
const vendorOwner = await createUser(`vendor+${suffix}@e2e.setu.local`, 'SETU E2E Vendor', 'vendor');
const rider = await createUser(`rider+${suffix}@e2e.setu.local`, 'SETU E2E Rider', 'rider');

const village = (await api('/rest/v1/villages?select=id&is_active=eq.true&limit=1')).at(0);
if (!village?.id) throw new Error('No active village exists. Business E2E needs one serviceable village.');

const vendorId = crypto.randomUUID();
const productId = crypto.randomUUID();
const riderId = crypto.randomUUID();
const addressId = crypto.randomUUID();

await api('/rest/v1/profiles?on_conflict=id', {
  method: 'POST',
  headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
  body: JSON.stringify([
    { id: customer.id, name: 'SETU E2E Customer', role: 'customer', village_id: village.id, is_verified: true, setu_score: 700 },
    { id: vendorOwner.id, name: 'SETU E2E Vendor', role: 'vendor', village_id: village.id, is_verified: true, setu_score: 700 },
    { id: rider.id, name: 'SETU E2E Rider', role: 'rider', village_id: village.id, is_verified: true, setu_score: 700 },
  ]),
});

await api('/rest/v1/vendors', {
  method: 'POST', headers: { Prefer: 'return=minimal' },
  body: JSON.stringify([{ id: vendorId, owner_id: vendorOwner.id, name: 'SETU E2E Vendor', category: 'grocery', village_id: village.id, village: 'E2E Village', phone: '9999999999', is_open: true, is_verified: true, is_active: true }]),
});

await api('/rest/v1/products', {
  method: 'POST', headers: { Prefer: 'return=minimal' },
  body: JSON.stringify([{ id: productId, vendor_id: vendorId, name: 'SETU E2E Test Product', name_hindi: 'E2E परीक्षण उत्पाद', price: 100, mrp: 120, unit: 'piece', stock: 100, is_available: true, category: 'grocery' }]),
});

await api('/rest/v1/riders', {
  method: 'POST', headers: { Prefer: 'return=minimal' },
  body: JSON.stringify([{ id: riderId, user_id: rider.id, name: 'SETU E2E Rider', phone: '9999999998', village_id: village.id, village: 'E2E Village', is_online: true, is_active: true, is_verified: true }]),
});

await api('/rest/v1/customer_addresses', {
  method: 'POST', headers: { Prefer: 'return=minimal' },
  body: JSON.stringify([{ id: addressId, user_id: customer.id, label: 'Home', address: 'SETU E2E Test House', landmark: 'Near E2E Test Village', is_default: true }]),
});

const sessions = {
  customer: await signIn(customer.email),
  vendor: await signIn(vendorOwner.email),
  rider: await signIn(rider.email),
};

const runtime = {
  runId, password,
  customer: { id: customer.id, email: customer.email, session: sessions.customer },
  vendor: { id: vendorOwner.id, email: vendorOwner.email, session: sessions.vendor, vendorId },
  rider: { id: rider.id, email: rider.email, session: sessions.rider, riderId },
  product: { id: productId, name: 'SETU E2E Test Product', price: 100 },
  addressId, villageId: village.id,
};
fs.mkdirSync('qa/reports/business-flow', { recursive: true });
fs.writeFileSync('qa/reports/business-flow/runtime.json', JSON.stringify(runtime, null, 2));
console.log(JSON.stringify({ ok: true, runId, productId, vendorId, riderId, customerId: customer.id }, null, 2));
