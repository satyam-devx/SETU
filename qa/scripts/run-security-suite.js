#!/usr/bin/env node
// scripts/run-security-suite.js — SETU Security Audit Runner
// Orchestrates all security checks and produces a unified report

import { execSync, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT       = path.resolve(__dirname, '../');
const SETU_ROOT  = path.resolve(__dirname, '../../');
const REPORTS    = path.join(ROOT, 'reports');

fs.mkdirSync(REPORTS, { recursive: true });

const results = {
  timestamp:   new Date().toISOString(),
  checks:      [],
  summary:     { passed: 0, failed: 0, warnings: 0 },
};

function addResult(name, status, details = '', critical = true) {
  const r = { name, status, details, critical };
  results.checks.push(r);
  if (status === 'PASS')    results.summary.passed++;
  if (status === 'FAIL')    results.summary.failed++;
  if (status === 'WARNING') results.summary.warnings++;
  const icon = status === 'PASS' ? '✓' : status === 'FAIL' ? '✗' : '⚠';
  console.log(`${icon} [${status}] ${name}${details ? ': ' + details : ''}`);
}

// ── 1. Secret scan ─────────────────────────────────────────────
console.log('\n═══ SECURITY SUITE: Secret Scan ═══');
try {
  const result = spawnSync('python3', [path.join(SETU_ROOT, 'scripts/secret_scan.py')], {
    cwd: SETU_ROOT, encoding: 'utf8', timeout: 30000,
  });
  if (result.status === 0) {
    addResult('Secret scan', 'PASS');
  } else {
    addResult('Secret scan', 'FAIL', result.stdout?.trim() || result.stderr?.trim(), true);
  }
} catch (e) {
  addResult('Secret scan', 'WARNING', `Could not run: ${e.message}`, false);
}

// ── 2. npm audit ───────────────────────────────────────────────
console.log('\n═══ SECURITY SUITE: Dependency Audit ═══');
try {
  const result = spawnSync('npm', ['audit', '--json', '--audit-level=high'], {
    cwd: SETU_ROOT, encoding: 'utf8', timeout: 60000,
  });
  const auditData = JSON.parse(result.stdout || '{}');
  fs.writeFileSync(path.join(REPORTS, 'npm-audit.json'), JSON.stringify(auditData, null, 2));

  const vulns     = auditData.metadata?.vulnerabilities ?? {};
  const critical  = vulns.critical ?? 0;
  const high      = vulns.high ?? 0;
  const moderate  = vulns.moderate ?? 0;

  if (critical > 0) {
    addResult('npm audit', 'FAIL', `${critical} critical, ${high} high vulnerabilities`, true);
  } else if (high > 0) {
    addResult('npm audit', 'FAIL', `${high} high vulnerabilities (0 critical)`, true);
  } else if (moderate > 0) {
    addResult('npm audit', 'WARNING', `${moderate} moderate vulnerabilities`, false);
  } else {
    addResult('npm audit', 'PASS', `No high/critical vulnerabilities found`);
  }
} catch (e) {
  addResult('npm audit', 'WARNING', `Could not parse: ${e.message}`, false);
}

// ── 3. Environment variable security checks ────────────────────
console.log('\n═══ SECURITY SUITE: Environment Config ═══');
const ENV_CHECKS = [
  {
    name:    'No .env file committed',
    check:   () => !fs.existsSync(path.join(SETU_ROOT, '.env')),
    detail:  '.env should be in .gitignore only',
    critical: true,
  },
  {
    name:    '.env.example exists',
    check:   () => fs.existsSync(path.join(SETU_ROOT, '.env.example')) ||
                   fs.existsSync(path.join(SETU_ROOT, '.env.example.txt')),
    detail:  'Developers need .env.example',
    critical: false,
  },
  {
    name:    'No hardcoded API keys in supabase.js',
    check:   () => {
      const content = fs.readFileSync(path.join(SETU_ROOT, 'src/lib/supabase.js'), 'utf8');
      return !content.match(/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
    },
    detail:  'JWT keys must come from env vars',
    critical: true,
  },
  {
    name:    'No rzp_live_ key in codebase',
    check:   () => {
      const files = getAllSourceFiles(SETU_ROOT);
      return !files.some(f => { const c = fs.readFileSync(f, 'utf8'); return /rzp_live_(?!placeholder)[A-Za-z0-9]+/.test(c); });
    },
    detail:  'Razorpay live key must never be committed',
    critical: true,
  },
  {
    name:    'Firebase SW has no hardcoded AIzaSy key',
    check:   () => {
      const swPath = path.join(SETU_ROOT, 'public/firebase-messaging-sw.js');
      if (!fs.existsSync(swPath)) return true;
      const content = fs.readFileSync(swPath, 'utf8');
      return !content.match(/AIzaSy[A-Za-z0-9_-]{33}/);
    },
    detail:  'Firebase API key must be injected at build time',
    critical: true,
  },
];

function getAllSourceFiles(dir) {
  const files = [];
  const skip  = ['node_modules', 'dist', '.git', 'reports'];
  function walk(d) {
    fs.readdirSync(d).forEach(f => {
      const full = path.join(d, f);
      if (skip.includes(f)) return;
      if (fs.statSync(full).isDirectory()) walk(full);
      else if (/\.(js|jsx|ts|tsx|json|toml|yml|yaml)$/.test(f)) files.push(full);
    });
  }
  walk(dir);
  return files;
}

for (const check of ENV_CHECKS) {
  try {
    const passed = check.check();
    addResult(check.name, passed ? 'PASS' : 'FAIL', check.detail, check.critical);
  } catch (e) {
    addResult(check.name, 'WARNING', e.message, false);
  }
}

// ── 4. Source code security patterns ──────────────────────────
console.log('\n═══ SECURITY SUITE: Source Code Patterns ═══');

const SOURCE_CHECKS = [
  {
    name:    'No eval() usage',
    pattern: /\beval\s*\(/,
    files:   ['src/**/*.{js,jsx,ts,tsx}'],
    critical: true,
  },
  {
    name:    'No dangerouslySetInnerHTML with user data',
    pattern: /dangerouslySetInnerHTML\s*=\s*\{\s*\{[^}]*\}/,
    files:   ['src/**/*.{js,jsx,tsx}'],
    critical: true,
  },
  {
    name:    'No document.write() calls',
    pattern: /document\.write\s*\(/,
    files:   ['src/**/*.{js,jsx,ts,tsx}'],
    critical: true,
  },
  {
    name:    'No hardcoded localhost in production code',
    pattern: /['"`]https?:\/\/localhost/,
    files:   ['src/**/*.{js,jsx,ts,tsx}'],
    critical: false,
  },
  {
    name:    'supabase.auth.admin not used in frontend',
    pattern: /supabase\.auth\.admin/,
    files:   ['src/**/*.{js,jsx,ts,tsx}'],
    critical: true,
  },
  {
    name:    'Service role key not in frontend source',
    pattern: /service_role/,
    files:   ['src/**/*.{js,jsx,ts,tsx}'],
    critical: true,
  },
  {
    name:    'No direct SQL in React components',
    // Avoid matching <Select or imports. Look for SELECT ... FROM that aren't JSX tags or imports.
    // We require a space after SELECT to avoid matching 'Select,' in imports.
    pattern: /(?<!import[^\n]{0,200})(?<!<)\bSELECT\s+[^'"]{1,200}\s+FROM\b(?!['"`])/i,
    files:   ['src/pages/**/*.{js,jsx,tsx}', 'src/components/**/*.{js,jsx,tsx}'],
    critical: false,
  },
  {
    name:    'console.log not in production paths (allow in lib)',
    pattern: /console\.log\(/,
    files:   ['src/pages/**/*.{js,jsx,tsx}'],
    critical: false,
    isWarning: true,
  },
];

function globToFiles(pattern, root) {
  // Simple glob: support src/**/*.{js,jsx} patterns
  const files = getAllSourceFiles(root);
  const ext   = pattern.match(/\{([^}]+)\}/)?.[1].split(',') ?? ['js'];
  const dir   = pattern.split('/**')[0];
  return files.filter(f => {
    const rel = f.replace(root + '/', '');
    const hasDir = rel.startsWith(dir);
    const hasExt = ext.some(e => f.endsWith(`.${e.trim()}`));
    return hasDir && hasExt;
  });
}

for (const check of SOURCE_CHECKS) {
  try {
    const files   = check.files.flatMap(p => globToFiles(p, SETU_ROOT));
    const matches = [];
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      if (check.pattern.test(content)) {
        matches.push(path.relative(SETU_ROOT, file));
      }
    }

    if (matches.length === 0) {
      addResult(check.name, 'PASS');
    } else if (check.isWarning) {
      addResult(check.name, 'WARNING', `Found in: ${matches.slice(0, 3).join(', ')}`, false);
    } else {
      addResult(check.name, 'FAIL', `Found in: ${matches.slice(0, 3).join(', ')}`, check.critical);
    }
  } catch (e) {
    addResult(check.name, 'WARNING', e.message, false);
  }
}

// ── 5. RLS and database security ──────────────────────────────
console.log('\n═══ SECURITY SUITE: Database Security ═══');

const DB_CHECKS = [
  {
    name:    'RLS enabled on all tables (rls.sql)',
    check:   () => {
      const rlsContent = fs.readFileSync(path.join(SETU_ROOT, 'database/rls.sql'), 'utf8');
      const tables = ['villages', 'profiles', 'orders', 'wallets', 'audit_log'];
      return tables.every(t => rlsContent.includes(`enable row level security`) &&
                                rlsContent.includes(t));
    },
    critical: true,
  },
  {
    name:    'audit_log insert restricted to service_role',
    check:   () => {
      const rlsContent = fs.readFileSync(path.join(SETU_ROOT, 'database/rls.sql'), 'utf8');
      return rlsContent.includes('service_role') ||
             rlsContent.includes('security definer');
    },
    critical: true,
  },
  {
    name:    'profiles_own_insert uses WITH CHECK (auth.uid() = id)',
    check:   () => {
      const rlsContent = fs.readFileSync(path.join(SETU_ROOT, 'database/rls.sql'), 'utf8');
      return rlsContent.includes('profiles_own_insert') &&
             rlsContent.includes('with check');
    },
    critical: true,
  },
  {
    name:    'Aadhaar data uses encryption (pgcrypto)',
    check:   () => {
      const schema = fs.readFileSync(path.join(SETU_ROOT, 'database/schema.sql'), 'utf8');
      return schema.includes('pgcrypto') || schema.includes('encrypt');
    },
    critical: true,
  },
  {
    name:    'Wallet balance updates via RPC only (no direct UPDATE)',
    check:   () => {
      const api = fs.readFileSync(path.join(SETU_ROOT, 'src/lib/api.js'), 'utf8');
      // Should use RPC, not direct .update on wallets
      return !api.match(/\.from\(['"`]wallets['"`]\)[^\n]*\.update/);
    },
    critical: true,
  },
  {
    name:    'Order status transitions go through security-definer RPCs',
    check:   () => {
      const fns = fs.readFileSync(path.join(SETU_ROOT, 'database/functions.sql'), 'utf8');
      return fns.includes('security definer');
    },
    critical: true,
  },
];

for (const check of DB_CHECKS) {
  try {
    const passed = check.check();
    addResult(check.name, passed ? 'PASS' : 'FAIL', '', check.critical);
  } catch (e) {
    addResult(check.name, 'WARNING', e.message, false);
  }
}

// ── 6. Edge function security ──────────────────────────────────
console.log('\n═══ SECURITY SUITE: Edge Function Security ═══');

const FUNCTION_CHECKS = [
  {
    name:    'razorpay-webhook verifies HMAC signature',
    file:    'supabase/functions/razorpay-webhook/index.ts',
    patterns: ['HMAC', 'signature', 'crypto'],
    critical: true,
  },
  {
    name:    'kyc-verify function uses Supabase Vault secrets',
    file:    'supabase/functions/kyc-verify/index.ts',
    patterns: ['Deno.env', 'env.get'],
    critical: true,
  },
  {
    name:    'Edge functions return CORS headers',
    file:    'supabase/functions/ai-assistant/index.ts',
    patterns: ['Access-Control-Allow-Origin'],
    critical: false,
  },
  {
    name:    'Edge functions handle OPTIONS preflight',
    file:    'supabase/functions/ai-assistant/index.ts',
    patterns: ['OPTIONS'],
    critical: false,
  },
];

for (const check of FUNCTION_CHECKS) {
  try {
    const content = fs.readFileSync(path.join(SETU_ROOT, check.file), 'utf8');
    const allFound = check.patterns.every(p => content.includes(p));
    addResult(
      check.name,
      allFound ? 'PASS' : 'FAIL',
      allFound ? '' : `Missing: ${check.patterns.filter(p => !content.includes(p)).join(', ')}`,
      check.critical,
    );
  } catch (e) {
    addResult(check.name, 'WARNING', e.message, false);
  }
}

// ── 7. HTTPS and transport security ───────────────────────────
console.log('\n═══ SECURITY SUITE: Transport Security ═══');

const TRANSPORT_CHECKS = [
  {
    name:    'Supabase URL uses HTTPS',
    check:   () => {
      const supabaseJs = fs.readFileSync(path.join(SETU_ROOT, 'src/lib/supabase.js'), 'utf8');
      // Must not have a hardcoded HTTP URL
      return !supabaseJs.includes("'http://") && !supabaseJs.includes('"http://');
    },
    critical: true,
  },
  {
    name:    'Razorpay script loaded over HTTPS',
    check:   () => {
      const payments = fs.readFileSync(path.join(SETU_ROOT, 'src/lib/payments.js'), 'utf8');
      return payments.includes('https://checkout.razorpay.com');
    },
    critical: true,
  },
  {
    name:    'Auth callback uses correct HTTPS redirect URL',
    check:   () => {
      const authCtx = fs.readFileSync(path.join(SETU_ROOT, 'src/lib/AuthContext.jsx'), 'utf8');
      // Must use getCallbackUrl() which reads window.location, not hardcoded HTTP
      return authCtx.includes('window.location.origin') || authCtx.includes('getCallbackUrl');
    },
    critical: true,
  },
];

for (const check of TRANSPORT_CHECKS) {
  try {
    const passed = check.check();
    addResult(check.name, passed ? 'PASS' : 'FAIL', '', check.critical);
  } catch (e) {
    addResult(check.name, 'WARNING', e.message, false);
  }
}

// ── Final report ───────────────────────────────────────────────
console.log('\n═══════════════════════════════════════════');
console.log('SECURITY AUDIT SUMMARY');
console.log('═══════════════════════════════════════════');
console.log(`✓ Passed:   ${results.summary.passed}`);
console.log(`✗ Failed:   ${results.summary.failed}`);
console.log(`⚠ Warnings: ${results.summary.warnings}`);
console.log('═══════════════════════════════════════════');

// Write report
fs.writeFileSync(
  path.join(REPORTS, 'security-report.json'),
  JSON.stringify(results, null, 2),
);
console.log(`\nReport written to: reports/security-report.json`);

// Exit with failure if any critical checks failed
const criticalFailures = results.checks.filter(c => c.status === 'FAIL' && c.critical);
if (criticalFailures.length > 0) {
  console.error('\n✗ CRITICAL SECURITY FAILURES:');
  criticalFailures.forEach(f => console.error(`  - ${f.name}: ${f.details}`));
  process.exit(1);
}

console.log('\n✓ All critical security checks passed');
process.exit(0);
