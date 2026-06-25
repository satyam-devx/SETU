// ═══════════════════════════════════════════════════════════════
// SETU — Load test: frontend smoke
//
// Light, safe load against the deployed SPA's entry document. Verifies
// the host serves the app under modest concurrency. Use this as the
// first, low-risk load check (it does not touch the database).
//
// Run:
//   k6 run -e BASE_URL=https://<your-host>/ qa/load/k6-smoke.js
// ═══════════════════════════════════════════════════════════════
import http from 'k6/http';
import { check } from 'k6';

const BASE_URL = __ENV.BASE_URL;

export const options = {
  vus:      Number(__ENV.VUS || 5),
  duration: __ENV.DURATION || '30s',
  thresholds: {
    http_req_failed:   ['rate<0.05'],
    http_req_duration: ['p(95)<2000'],
  },
};

export function setup() {
  if (!BASE_URL) throw new Error('Set BASE_URL env var (e.g. https://setu.example/).');
}

export default function () {
  const res = http.get(BASE_URL);
  check(res, {
    'status 200':   (r) => r.status === 200,
    'serves app':   (r) => !!r.body && r.body.includes('id="root"'),
  });
}
