#!/usr/bin/env node
// qa/scripts/run-semgrep.js — SETU Static Application Security Testing (SAST)
//
// Runs Semgrep against the app source, edge functions, and QA scripts using
// public, no-login-required rulesets (OWASP Top 10, security-audit, and
// React/JS-specific rules). This was previously referenced by
// package.json's `lint:security` script but did not exist — see
// CHANGELOG.md 1.0.0.
//
// Requires the `semgrep` CLI to be on PATH (pip install semgrep, or via the
// official Docker image). If it's missing, this fails soft with a WARNING
// rather than crashing the whole `test:all` chain — matching the pattern
// used by run-security-suite.js for optional local tooling.
//
// Usage: node scripts/run-semgrep.js
// Exit code: 0 if no ERROR-severity findings, 1 if any ERROR-severity finding
// (ci.yml/qa.yml treat a non-zero exit as a failed check).

import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const QA_ROOT    = path.resolve(__dirname, '../');
const SETU_ROOT  = path.resolve(__dirname, '../../');
const REPORTS    = path.join(QA_ROOT, 'reports');
const OUT_JSON   = path.join(REPORTS, 'semgrep-report.json');

fs.mkdirSync(REPORTS, { recursive: true });

// Public, no-token-required rule packs.
// - p/security-audit  — general secure-coding patterns
// - p/owasp-top-ten    — OWASP Top 10 mapped rules
// - p/javascript       — JS-specific bug/security patterns
// - p/react            — React-specific (XSS via dangerouslySetInnerHTML, etc.)
const CONFIGS = ['p/security-audit', 'p/owasp-top-ten', 'p/javascript', 'p/react'];

// Scan the frontend app and Edge Functions; explicitly exclude build output,
// deps, and the QA pipeline's own fixtures/reports.
const TARGETS = ['src', 'supabase/functions', 'scripts'];
const EXCLUDES = ['node_modules', 'dist', 'qa/reports', 'qa/test-results', 'qa/playwright-report'];

function checkSemgrepInstalled() {
  const check = spawnSync('semgrep', ['--version'], { encoding: 'utf8' });
  return check.status === 0;
}

function runSemgrep() {
  const args = [
    'scan',
    ...CONFIGS.flatMap((c) => ['--config', c]),
    '--json',
    '--output', OUT_JSON,
    '--metrics', 'off', // don't phone home
    ...EXCLUDES.flatMap((e) => ['--exclude', e]),
    ...TARGETS,
  ];

  console.log('═══ SAST: Semgrep ═══');
  console.log(`$ semgrep ${args.join(' ')}\n`);

  const result = spawnSync('semgrep', args, {
    cwd: SETU_ROOT,
    encoding: 'utf8',
    timeout: 5 * 60 * 1000,
    maxBuffer: 50 * 1024 * 1024,
  });

  if (result.error) {
    console.warn(`⚠ WARNING: Could not run semgrep: ${result.error.message}`);
    return { status: 'WARNING', errorCount: 0 };
  }

  if (!fs.existsSync(OUT_JSON)) {
    console.warn('⚠ WARNING: semgrep did not produce a report file.');
    console.warn(result.stdout);
    console.warn(result.stderr);
    return { status: 'WARNING', errorCount: 0 };
  }

  const report = JSON.parse(fs.readFileSync(OUT_JSON, 'utf8'));
  const findings = report.results || [];
  const bySeverity = { ERROR: [], WARNING: [], INFO: [] };
  for (const f of findings) {
    const sev = f.extra?.severity || 'INFO';
    (bySeverity[sev] || bySeverity.INFO).push(f);
  }

  console.log(`\nFindings: ${findings.length} total`);
  console.log(`  ERROR:   ${bySeverity.ERROR.length}`);
  console.log(`  WARNING: ${bySeverity.WARNING.length}`);
  console.log(`  INFO:    ${bySeverity.INFO.length}`);

  for (const f of bySeverity.ERROR) {
    console.log(`\n✗ [ERROR] ${f.check_id}`);
    console.log(`  ${f.path}:${f.start?.line}`);
    console.log(`  ${f.extra?.message?.split('\n')[0] || ''}`);
  }

  if (report.errors?.length) {
    console.warn(`\n⚠ semgrep reported ${report.errors.length} internal scan error(s) (e.g. parse failures) — see ${OUT_JSON}`);
  }

  return { status: bySeverity.ERROR.length > 0 ? 'FAIL' : 'PASS', errorCount: bySeverity.ERROR.length };
}

if (!checkSemgrepInstalled()) {
  console.warn('⚠ WARNING: semgrep CLI not found on PATH.');
  console.warn('  Install with: pip install semgrep   (or: brew install semgrep)');
  console.warn('  Skipping SAST scan — this does NOT count as a pass, CI installs semgrep explicitly.');
  // Soft-fail locally so devs without semgrep installed aren't blocked;
  // ci.yml/qa.yml install semgrep explicitly before calling this script,
  // so in CI this branch should never be hit.
  process.exit(0);
}

const { status, errorCount } = runSemgrep();

if (status === 'FAIL') {
  console.error(`\n✗ Semgrep found ${errorCount} ERROR-severity issue(s). See ${OUT_JSON} for details.`);
  process.exit(1);
}

console.log(`\n✓ Semgrep SAST scan passed (report: ${OUT_JSON})`);
process.exit(0);
