#!/usr/bin/env node
// scripts/generate-report.js — SETU QA Unified Report Generator
// Merges Vitest, Playwright, Security, A11y, and Performance results
// into a single HTML dashboard and JSON summary

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPORTS   = path.join(__dirname, '../reports');

fs.mkdirSync(REPORTS, { recursive: true });

function safeReadJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

// ── Load all reports ───────────────────────────────────────────
const vitestResults  = safeReadJSON(path.join(REPORTS, 'vitest-results.json'));
const playwrightJson = safeReadJSON(path.join(REPORTS, 'playwright-results.json'));
const securityReport = safeReadJSON(path.join(REPORTS, 'security-report.json'));
const a11yReport     = safeReadJSON(path.join(REPORTS, 'a11y-report.json'));
const perfReport     = safeReadJSON(path.join(REPORTS, 'performance-report.json'));
const npmAudit       = safeReadJSON(path.join(REPORTS, 'npm-audit.json'));

// ── Build summary ──────────────────────────────────────────────
function getVitestSummary() {
  if (!vitestResults) return null;
  // Vitest JSON format
  const stats = vitestResults.testResults?.reduce(
    (acc, suite) => {
      acc.total += suite.assertionResults?.length ?? 0;
      acc.passed += suite.assertionResults?.filter(t => t.status === 'passed').length ?? 0;
      acc.failed += suite.assertionResults?.filter(t => t.status === 'failed').length ?? 0;
      return acc;
    },
    { total: 0, passed: 0, failed: 0 }
  ) ?? { total: 0, passed: 0, failed: 0 };
  return stats;
}

function getPlaywrightSummary() {
  if (!playwrightJson) return null;
  const stats = { total: 0, passed: 0, failed: 0, skipped: 0 };
  playwrightJson.suites?.forEach(suite => {
    suite.specs?.forEach(spec => {
      spec.tests?.forEach(test => {
        stats.total++;
        if (test.status === 'passed') stats.passed++;
        else if (test.status === 'failed') stats.failed++;
        else stats.skipped++;
      });
    });
  });
  return stats;
}

const summary = {
  generated:   new Date().toISOString(),
  commit:      process.env.GITHUB_SHA ?? 'local',
  branch:      process.env.GITHUB_REF_NAME ?? 'local',
  actor:       process.env.GITHUB_ACTOR ?? 'local',
  suites: {
    unit:        getVitestSummary(),
    e2e:         getPlaywrightSummary(),
    security:    securityReport?.summary ?? null,
    a11y:        a11yReport?.summary ?? null,
    performance: perfReport?.summary ?? null,
  },
  overall: {
    passed:  true, // updated below
    score:   0,
  },
};

// Calculate overall pass/fail
const hasUnitFails    = (summary.suites.unit?.failed ?? 0) > 0;
const hasE2EFails     = (summary.suites.e2e?.failed ?? 0) > 0;
const hasSecFails     = (summary.suites.security?.failed ?? 0) > 0;
const hasPerfFails    = (summary.suites.performance?.failed ?? 0) > 0;
const hasA11yFails    = (summary.suites.a11y?.failed ?? 0) > 0;

summary.overall.passed = !hasUnitFails && !hasE2EFails && !hasSecFails && !hasPerfFails && !hasA11yFails;

// Score: 0–100
const totalTests  = (summary.suites.unit?.total ?? 0) + (summary.suites.e2e?.total ?? 0);
const passedTests = (summary.suites.unit?.passed ?? 0) + (summary.suites.e2e?.passed ?? 0);
summary.overall.score = totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0;

// ── Write JSON summary ─────────────────────────────────────────
fs.writeFileSync(
  path.join(REPORTS, 'summary.json'),
  JSON.stringify(summary, null, 2),
);

// ── Generate HTML dashboard ────────────────────────────────────
function statusBadge(status) {
  if (status === true || status === 'PASS' || status === 'passed') {
    return '<span class="badge pass">PASS</span>';
  }
  if (status === false || status === 'FAIL' || status === 'failed') {
    return '<span class="badge fail">FAIL</span>';
  }
  return '<span class="badge warn">WARN</span>';
}

function suiteSummaryHtml(label, stats, icon) {
  if (!stats) {
    return `
      <div class="suite-card unknown">
        <div class="suite-icon">${icon}</div>
        <div class="suite-name">${label}</div>
        <div class="suite-result">Not run</div>
      </div>`;
  }
  const failed  = stats.failed ?? 0;
  const passed  = stats.passed ?? 0;
  const total   = stats.total ?? (passed + failed + (stats.warnings ?? 0));
  const cls     = failed > 0 ? 'fail' : 'pass';
  return `
    <div class="suite-card ${cls}">
      <div class="suite-icon">${icon}</div>
      <div class="suite-name">${label}</div>
      <div class="suite-stats">
        <span class="stat-pass">✓ ${passed}</span>
        ${failed > 0 ? `<span class="stat-fail">✗ ${failed}</span>` : ''}
        ${stats.warnings > 0 ? `<span class="stat-warn">⚠ ${stats.warnings}</span>` : ''}
      </div>
    </div>`;
}

function securityChecksHtml() {
  if (!securityReport) return '<p class="muted">Security report not available</p>';
  return `
    <table>
      <thead><tr><th>Check</th><th>Status</th><th>Details</th></tr></thead>
      <tbody>
        ${securityReport.checks.map(c => `
          <tr class="${c.status === 'FAIL' ? 'row-fail' : c.status === 'WARNING' ? 'row-warn' : ''}">
            <td>${c.name}</td>
            <td>${statusBadge(c.status)}</td>
            <td class="detail">${c.details || '—'}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

function perfBudgetsHtml() {
  if (!perfReport) return '<p class="muted">Performance report not available</p>';
  return `
    <table>
      <thead><tr><th>Metric</th><th>Value</th><th>Budget</th><th>Status</th></tr></thead>
      <tbody>
        ${perfReport.budgets.map(b => `
          <tr class="${b.status === 'FAIL' ? 'row-fail' : b.status === 'WARNING' ? 'row-warn' : ''}">
            <td>${b.name}</td>
            <td>${b.value}${b.unit}</td>
            <td>${b.threshold}${b.unit}</td>
            <td>${statusBadge(b.status)}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

function a11yViolationsHtml() {
  if (!a11yReport) return '<p class="muted">A11y report not available</p>';
  const allViolations = a11yReport.pages.flatMap(p =>
    p.violations.map(v => ({ page: p.name, ...v }))
  );
  if (allViolations.length === 0) return '<p class="success">✓ No accessibility violations found</p>';
  return `
    <table>
      <thead><tr><th>Page</th><th>Rule ID</th><th>Impact</th><th>Count</th><th>Description</th></tr></thead>
      <tbody>
        ${allViolations.map(v => `
          <tr class="${v.impact === 'critical' || v.impact === 'serious' ? 'row-fail' : 'row-warn'}">
            <td>${v.page}</td>
            <td><code>${v.id}</code></td>
            <td><span class="impact-${v.impact}">${v.impact}</span></td>
            <td>${v.count}</td>
            <td>${v.description}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

function npmVulnsHtml() {
  if (!npmAudit) return '<p class="muted">npm audit not available</p>';
  const vulns = npmAudit.metadata?.vulnerabilities ?? {};
  const total = Object.values(vulns).reduce((a, b) => a + b, 0);
  if (total === 0) return '<p class="success">✓ No known vulnerabilities</p>';
  return `
    <table>
      <thead><tr><th>Severity</th><th>Count</th></tr></thead>
      <tbody>
        ${Object.entries(vulns).map(([sev, count]) => count > 0 ? `
          <tr class="${sev === 'critical' || sev === 'high' ? 'row-fail' : 'row-warn'}">
            <td>${sev}</td><td>${count}</td>
          </tr>` : '').join('')}
      </tbody>
    </table>`;
}

const overallClass = summary.overall.passed ? 'overall-pass' : 'overall-fail';
const scoreColor   = summary.overall.score >= 90 ? '#22c55e'
                   : summary.overall.score >= 70 ? '#f59e0b'
                   : '#ef4444';

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>SETU QA Report — ${summary.generated.slice(0, 10)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
           background: #0f172a; color: #e2e8f0; line-height: 1.5; }
    .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
    h1 { font-size: 1.75rem; font-weight: 700; color: #f1f5f9; }
    h2 { font-size: 1.2rem; font-weight: 600; color: #cbd5e1; margin-bottom: 1rem; border-bottom: 1px solid #1e293b; padding-bottom: 0.5rem; }
    .meta { color: #64748b; font-size: 0.85rem; margin-top: 0.5rem; }
    .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 2rem; }
    .score-ring { text-align: center; }
    .score-value { font-size: 2.5rem; font-weight: 800; color: ${scoreColor}; }
    .score-label { font-size: 0.75rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.1em; }
    .overall-pass { color: #22c55e; }
    .overall-fail { color: #ef4444; }
    .overall-banner { padding: 1rem 1.5rem; border-radius: 0.75rem; font-weight: 600; margin-bottom: 2rem;
      background: ${summary.overall.passed ? '#14532d' : '#7f1d1d'};
      color: ${summary.overall.passed ? '#86efac' : '#fca5a5'}; }
    .suites-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
    .suite-card { padding: 1.25rem; border-radius: 0.75rem; background: #1e293b; border: 1px solid #334155; }
    .suite-card.pass { border-color: #166534; background: #0f2a1a; }
    .suite-card.fail { border-color: #991b1b; background: #2a0f0f; }
    .suite-icon { font-size: 1.5rem; margin-bottom: 0.5rem; }
    .suite-name { font-size: 0.8rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem; }
    .suite-stats { font-size: 1.1rem; font-weight: 600; }
    .stat-pass { color: #22c55e; }
    .stat-fail { color: #ef4444; margin-left: 0.5rem; }
    .stat-warn { color: #f59e0b; margin-left: 0.5rem; }
    .suite-result { color: #64748b; }
    .section { background: #1e293b; border: 1px solid #334155; border-radius: 0.75rem; padding: 1.5rem; margin-bottom: 1.5rem; }
    table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    th { text-align: left; padding: 0.5rem 0.75rem; color: #64748b; font-weight: 500; border-bottom: 1px solid #334155; }
    td { padding: 0.5rem 0.75rem; border-bottom: 1px solid #1e293b; }
    tr:last-child td { border-bottom: none; }
    .row-fail td { background: rgba(239, 68, 68, 0.05); }
    .row-warn td { background: rgba(245, 158, 11, 0.05); }
    .badge { font-size: 0.7rem; font-weight: 700; padding: 0.15rem 0.4rem; border-radius: 0.25rem; }
    .badge.pass { background: #14532d; color: #86efac; }
    .badge.fail { background: #7f1d1d; color: #fca5a5; }
    .badge.warn { background: #78350f; color: #fcd34d; }
    .detail { color: #94a3b8; font-size: 0.8rem; max-width: 400px; word-break: break-word; }
    code { background: #0f172a; padding: 0.1rem 0.3rem; border-radius: 0.2rem; font-family: monospace; font-size: 0.8rem; }
    .muted { color: #64748b; font-style: italic; }
    .success { color: #22c55e; }
    .impact-critical { color: #ef4444; font-weight: 600; }
    .impact-serious  { color: #f97316; font-weight: 600; }
    .impact-moderate { color: #f59e0b; }
    .impact-minor    { color: #64748b; }
    footer { text-align: center; color: #334155; font-size: 0.75rem; margin-top: 3rem; padding-top: 1rem; border-top: 1px solid #1e293b; }
  </style>
</head>
<body>
<div class="container">
  <div class="header">
    <div>
      <h1>🔬 SETU QA Report</h1>
      <p class="meta">
        Generated: ${summary.generated} &nbsp;|&nbsp;
        Commit: <code>${summary.commit.slice(0, 8)}</code> &nbsp;|&nbsp;
        Branch: <code>${summary.branch}</code>
        ${summary.actor !== 'local' ? `&nbsp;|&nbsp; Actor: ${summary.actor}` : ''}
      </p>
    </div>
    <div class="score-ring">
      <div class="score-value">${summary.overall.score}%</div>
      <div class="score-label">Test score</div>
    </div>
  </div>

  <div class="overall-banner">
    ${summary.overall.passed
      ? '✓ All critical checks passed — build is safe to deploy'
      : '✗ Critical failures detected — build should NOT deploy'}
  </div>

  <div class="suites-grid">
    ${suiteSummaryHtml('Unit Tests',    summary.suites.unit,        '🧪')}
    ${suiteSummaryHtml('E2E Tests',     summary.suites.e2e,         '🎭')}
    ${suiteSummaryHtml('Security',      summary.suites.security,    '🔒')}
    ${suiteSummaryHtml('Accessibility', summary.suites.a11y,        '♿')}
    ${suiteSummaryHtml('Performance',   summary.suites.performance, '⚡')}
  </div>

  <div class="section">
    <h2>🔒 Security Checks</h2>
    ${securityChecksHtml()}
  </div>

  <div class="section">
    <h2>⚡ Performance Budgets</h2>
    ${perfBudgetsHtml()}
  </div>

  <div class="section">
    <h2>♿ Accessibility Violations</h2>
    ${a11yViolationsHtml()}
  </div>

  <div class="section">
    <h2>📦 Dependency Vulnerabilities</h2>
    ${npmVulnsHtml()}
  </div>

  <footer>
    SETU QA Pipeline &nbsp;·&nbsp; Powered by Vitest + Playwright + axe-core
  </footer>
</div>
</body>
</html>`;

fs.writeFileSync(path.join(REPORTS, 'qa-dashboard.html'), html);
console.log('✓ QA report written to: reports/qa-dashboard.html');
console.log('✓ Summary written to:   reports/summary.json');

// Print summary to stdout
console.log('\n══════════════════════════════════════');
console.log(`OVERALL: ${summary.overall.passed ? '✓ PASS' : '✗ FAIL'} (score: ${summary.overall.score}%)`);
if (summary.suites.unit)
  console.log(`  Unit:         ${summary.suites.unit.passed} passed, ${summary.suites.unit.failed} failed`);
if (summary.suites.e2e)
  console.log(`  E2E:          ${summary.suites.e2e.passed} passed, ${summary.suites.e2e.failed} failed`);
if (summary.suites.security)
  console.log(`  Security:     ${summary.suites.security.passed} passed, ${summary.suites.security.failed} failed`);
if (summary.suites.a11y)
  console.log(`  A11y:         ${summary.suites.a11y.passed} passed, ${summary.suites.a11y.failed} failed`);
if (summary.suites.performance)
  console.log(`  Performance:  ${summary.suites.performance.passed} passed, ${summary.suites.performance.failed} failed`);
console.log('══════════════════════════════════════');
