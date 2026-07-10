#!/usr/bin/env node
// scripts/extract-routes.js — parses src/App.jsx's <Route> tree into a flat,
// static route manifest (qa/fixtures/routes.json) consumed by
// qa/tests/e2e/crawler.spec.js and qa/tests/visual/visual-regression.spec.js.
//
// Why a static generated file instead of parsing App.jsx at test-run time:
// a committed JSON manifest is fast to load, diffable in PRs (you can see
// exactly which routes were added/removed), and doesn't make the test
// suite depend on a regex/JSX parser succeeding at run time. Regenerate
// whenever routes.jsx changes:
//
//   node scripts/extract-routes.js
//
// This is a line-based parser tuned to this file's actual formatting (see
// the ── portal ── blocks in App.jsx) — not a general JSX/AST parser. If
// App.jsx's Route formatting changes structurally, re-check this script.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const APP_JSX = path.join(ROOT, 'src/App.jsx');
const OUT = path.join(ROOT, 'qa/fixtures/routes.json');

const src = fs.readFileSync(APP_JSX, 'utf8');
const lines = src.split(/\r?\n/);

// role required to view a parent portal, keyed by its top-level path —
// filled in as we see `<ProtectedRoute allowedRoles={[...]}>` following a
// parent <Route path="/x" element={ ... }>
const routes = [];
let stack = []; // { parentPath, role }
let pendingParentPath = null; // set when we see an opening `<Route path="/x" element={`

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  // Opening (non-self-closing) parent route: <Route path="/customer" element={
  const parentOpen = line.match(/<Route path="(\/[a-z0-9/-]*)" element=\{\s*$/i);
  if (parentOpen) {
    pendingParentPath = parentOpen[1];
    continue;
  }

  // Role, if the very next lines contain a ProtectedRoute
  if (pendingParentPath) {
    const roleMatch = line.match(/allowedRoles=\{\[([^\]]*)\]\}/);
    if (roleMatch) {
      const roles = roleMatch[1].split(',').map(r => r.trim().replace(/['"]/g, '')).filter(Boolean);
      stack.push({ parentPath: pendingParentPath, role: roles[0] || null });
      // Public top-level route with its own element (no ProtectedRoute) —
      // handled below when we hit the closing `}>` without ever pushing.
    }
  }

  // Closing of the element={...} prop that opens the route's children: `}>`
  if (/^\s*\}>\s*$/.test(line) && pendingParentPath) {
    if (stack.length === 0 || stack[stack.length - 1].parentPath !== pendingParentPath) {
      // No ProtectedRoute found for this parent (shouldn't happen for the
      // current portals, but fail safe: push with role=null = public).
      stack.push({ parentPath: pendingParentPath, role: null });
    }
    pendingParentPath = null;
    continue;
  }

  // Self-closing top-level public route: <Route path="/login" element={<LoginOTP />} />
  const topLevel = line.match(/<Route path="(\/[a-z0-9/:._-]*)"\s+element=\{.*\/>\s*$/i);
  if (topLevel && stack.length === 0) {
    routes.push({ path: topLevel[1], role: null, dynamic: topLevel[1].includes(':') });
    continue;
  }

  // Index route inside a portal: <Route index element={...} />
  if (/<Route index\s+element=\{.*\/>\s*$/.test(line) && stack.length > 0) {
    const top = stack[stack.length - 1];
    routes.push({ path: top.parentPath, role: top.role, dynamic: false });
    continue;
  }

  // Child route inside a portal: <Route path="orders" element={...} />
  const child = line.match(/<Route path="([a-z0-9/:._-]*)"\s+element=\{.*\/>\s*$/i);
  if (child && stack.length > 0) {
    const top = stack[stack.length - 1];
    const full = `${top.parentPath}/${child[1]}`;
    routes.push({ path: full, role: top.role, dynamic: full.includes(':') });
    continue;
  }

  // Closing </Route> — pop
  if (/^\s*<\/Route>\s*$/.test(line) && stack.length > 0) {
    stack.pop();
    continue;
  }
}

// Substitute a placeholder for dynamic segments (:orderId, :productId, etc.)
// — the app is expected to render a graceful "not found" state for an
// unknown ID rather than crash (already exercised by
// qa/tests/e2e/auth.spec.js's '/customer/orders/nonexistent-order-id-xyz'
// case), so a placeholder is a reasonable, safe stand-in for crawling.
function withPlaceholders(p) {
  return p.replace(/:[a-zA-Z]+/g, 'crawler-test-id');
}

const manifest = routes.map(r => ({
  path: r.path,
  crawlPath: withPlaceholders(r.path),
  role: r.role,
  dynamic: r.dynamic,
}));

// Sanity floor — if the parser regresses (formatting change in App.jsx) it
// should fail loudly rather than silently produce a tiny, wrong manifest.
if (manifest.length < 80) {
  console.error(`::error::Only extracted ${manifest.length} routes — expected 100+. `
    + `App.jsx's <Route> formatting may have changed; check scripts/extract-routes.js.`);
  process.exit(1);
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(manifest, null, 2) + '\n');
console.log(`Extracted ${manifest.length} routes → ${path.relative(ROOT, OUT)}`);

const byRole = manifest.reduce((acc, r) => {
  const key = r.role || 'public';
  acc[key] = (acc[key] || 0) + 1;
  return acc;
}, {});
console.log('By role:', byRole);
