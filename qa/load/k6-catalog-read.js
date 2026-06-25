// ═══════════════════════════════════════════════════════════════
// SETU — Load test: public catalog reads (read-scaling path)
//
// Ramps virtual users hitting the PUBLIC, RLS-exposed catalog endpoints
// (vendors + products) via Supabase REST. These are exactly the reads
// Phase-4 routes through the optional read replica (supabaseRead), so
// this is the test to run before/after enabling a replica to measure
// the win.
//
// Run:
//   k6 run \
//     -e SUPABASE_URL=https://<ref>.supabase.co \
//     -e SUPABASE_ANON_KEY=<anon> \
//     -e VUS=100 -e RAMP=30s -e HOLD=2m \
//     qa/load/k6-catalog-read.js
//
// Point SUPABASE_URL at a STAGING project — do not load-test prod
// without a maintenance window and Supabase's awareness.
// ═══════════════════════════════════════════════════════════════
import http from 'k6/http';
import { check, sleep } from 'k6';

const SUPABASE_URL = __ENV.SUPABASE_URL;
const ANON         = __ENV.SUPABASE_ANON_KEY;
const VUS          = Number(__ENV.VUS || 50);

export const options = {
  scenarios: {
    catalog_ramp: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: __ENV.RAMP || '30s', target: VUS },
        { duration: __ENV.HOLD || '1m',  target: VUS },
        { duration: '15s',                target: 0 },
      ],
    },
  },
  thresholds: {
    // <1% errors and p95 under 800ms for catalog reads.
    http_req_failed:   ['rate<0.01'],
    http_req_duration: ['p(95)<800'],
  },
};

export function setup() {
  if (!SUPABASE_URL || !ANON) {
    throw new Error('Set SUPABASE_URL and SUPABASE_ANON_KEY env vars (see file header).');
  }
}

const headers = { apikey: ANON, Authorization: `Bearer ${ANON}` };

export default function () {
  const vendors = http.get(
    `${SUPABASE_URL}/rest/v1/vendors?select=id,name,rating,village_id&is_active=eq.true&order=rating.desc&limit=20`,
    { headers, tags: { name: 'vendors_list' } }
  );
  check(vendors, { 'vendors 200': (r) => r.status === 200 });

  const products = http.get(
    `${SUPABASE_URL}/rest/v1/products?select=id,name,price,vendor_id&is_available=eq.true&limit=30`,
    { headers, tags: { name: 'products_list' } }
  );
  check(products, { 'products 200': (r) => r.status === 200 });

  sleep(1);
}
