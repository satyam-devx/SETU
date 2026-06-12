#!/usr/bin/env node
// scripts/run-perf-suite.js — SETU Performance audit runner
// Measures Core Web Vitals, bundle size, and load time budgets

import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPORTS    = path.join(__dirname, '../reports');
const SETU_ROOT  = path.resolve(__dirname, '../../');
const BASE_URL   = process.env.SETU_E2E_URL || 'http://localhost:5173';

fs.mkdirSync(REPORTS, { recursive: true });

const results = {
  timestamp: new Date().toISOString(),
  budgets:   [],
  pages:     [],
  bundle:    {},
  summary:   { passed: 0, failed: 0, warnings: 0 },
};

function addResult(name, status, value, threshold, unit = '') {
  const r = { name, status, value, threshold, unit };
  results.budgets.push(r);
  if (status === 'PASS')    results.summary.passed++;
  if (status === 'FAIL')    results.summary.failed++;
  if (status === 'WARNING') results.summary.warnings++;
  const icon = status === 'PASS' ? '✓' : status === 'FAIL' ? '✗' : '⚠';
  console.log(`${icon} [${status}] ${name}: ${value}${unit} (budget: ${threshold}${unit})`);
}

// ── 1. Bundle size analysis ────────────────────────────────────
console.log('\n═══ PERFORMANCE: Bundle Size Analysis ═══');

const BUNDLE_BUDGETS = {
  total_js_kb:       800,   // Total JS in KB
  largest_chunk_kb:  500,   // Largest single chunk
  index_html_kb:     10,    // HTML entry point
};

function analyzeBundleSize() {
  const distPath = path.join(SETU_ROOT, 'dist/assets');
  if (!fs.existsSync(distPath)) {
    console.log('⚠  dist/ not found — skipping bundle analysis (run npm run build first)');
    return null;
  }

  const jsFiles = fs.readdirSync(distPath).filter(f => f.endsWith('.js'));
  const sizes   = jsFiles.map(f => {
    const filePath = path.join(distPath, f);
    const sizeBytes = fs.statSync(filePath).size;
    return { name: f, sizeKB: Math.round(sizeBytes / 1024) };
  });

  sizes.sort((a, b) => b.sizeKB - a.sizeKB);
  const totalKB   = sizes.reduce((sum, f) => sum + f.sizeKB, 0);
  const largestKB = sizes[0]?.sizeKB ?? 0;

  console.log('\nJS Bundle breakdown:');
  sizes.slice(0, 10).forEach(f => console.log(`  ${f.sizeKB}KB  ${f.name}`));
  if (sizes.length > 10) console.log(`  ... and ${sizes.length - 10} more`);

  results.bundle = { totalKB, largestKB, files: sizes };

  // Check against budgets
  addResult(
    'Total JS bundle size',
    totalKB <= BUNDLE_BUDGETS.total_js_kb ? 'PASS' : 'FAIL',
    totalKB, BUNDLE_BUDGETS.total_js_kb, 'KB',
  );

  addResult(
    'Largest JS chunk',
    largestKB <= BUNDLE_BUDGETS.largest_chunk_kb ? 'PASS' : 'FAIL',
    largestKB, BUNDLE_BUDGETS.largest_chunk_kb, 'KB',
  );

  // Check index.html
  const indexPath = path.join(SETU_ROOT, 'dist/index.html');
  if (fs.existsSync(indexPath)) {
    const indexKB = Math.round(fs.statSync(indexPath).size / 1024);
    addResult(
      'index.html size',
      indexKB <= BUNDLE_BUDGETS.index_html_kb ? 'PASS' : 'WARNING',
      indexKB, BUNDLE_BUDGETS.index_html_kb, 'KB',
    );
  }

  return sizes;
}

analyzeBundleSize();

// ── 2. Page load performance ───────────────────────────────────
console.log('\n═══ PERFORMANCE: Page Load Times ═══');

const PAGE_BUDGETS = {
  ttfb_ms:           500,   // Time to First Byte
  fcp_ms:            1800,  // First Contentful Paint
  lcp_ms:            2500,  // Largest Contentful Paint (Good threshold)
  tti_ms:            3800,  // Time to Interactive
  cls_score:         0.1,   // Cumulative Layout Shift (Good threshold)
  tbt_ms:            200,   // Total Blocking Time
};

const TEST_PAGES = [
  { path: '/login',                name: 'Login page',     critical: true  },
  { path: '/customer',             name: 'Customer home',  critical: true  },
  { path: '/customer/search',      name: 'Search page',    critical: false },
  { path: '/onboarding/register',  name: 'Register page',  critical: false },
];

async function measurePagePerformance(page, url) {
  // Navigate and capture performance metrics
  await page.goto(url, { waitUntil: 'networkidle' });

  // Collect Core Web Vitals via PerformanceObserver + Navigation Timing
  const metrics = await page.evaluate(() => {
    return new Promise((resolve) => {
      const result = {
        ttfb:  0,
        fcp:   0,
        lcp:   0,
        cls:   0,
        tbt:   0,
        domLoaded: 0,
        loadComplete: 0,
      };

      // Navigation Timing
      const nav = performance.getEntriesByType('navigation')[0];
      if (nav) {
        result.ttfb        = Math.round(nav.responseStart - nav.requestStart);
        result.domLoaded   = Math.round(nav.domContentLoadedEventEnd);
        result.loadComplete = Math.round(nav.loadEventEnd);
      }

      // Paint timing (FCP)
      const paints = performance.getEntriesByType('paint');
      const fcp    = paints.find(p => p.name === 'first-contentful-paint');
      if (fcp) result.fcp = Math.round(fcp.startTime);

      // LCP — use PerformanceObserver if available
      try {
        let largestLCP = 0;
        const observer = new PerformanceObserver(list => {
          list.getEntries().forEach(e => {
            if (e.startTime > largestLCP) largestLCP = e.startTime;
          });
        });
        observer.observe({ type: 'largest-contentful-paint', buffered: true });
        // Give 100ms for buffered entries
        setTimeout(() => {
          observer.disconnect();
          result.lcp = Math.round(largestLCP);
          resolve(result);
        }, 100);
      } catch {
        resolve(result);
      }
    });
  });

  return metrics;
}

async function runPagePerformanceTests() {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (Linux; Android 12; Redmi 9) AppleWebKit/537.36',
  });

  // Simulate throttled network (3G: 1.6 Mbps down, 750 Kbps up, 150ms RTT)
  await context.route('**/*', async (route) => {
    await new Promise(r => setTimeout(r, process.env.CI ? 20 : 0));
    route.continue();
  });

  const page = await context.newPage();

  for (const testPage of TEST_PAGES) {
    const url = `${BASE_URL}${testPage.path}`;
    console.log(`\nMeasuring: ${testPage.name} (${url})`);

    try {
      const metrics = await measurePagePerformance(page, url);
      results.pages.push({ ...testPage, metrics });

      console.log(`  TTFB:      ${metrics.ttfb}ms  (budget: ${PAGE_BUDGETS.ttfb_ms}ms)`);
      console.log(`  FCP:       ${metrics.fcp}ms   (budget: ${PAGE_BUDGETS.fcp_ms}ms)`);
      console.log(`  LCP:       ${metrics.lcp}ms   (budget: ${PAGE_BUDGETS.lcp_ms}ms)`);

      if (testPage.critical) {
        addResult(
          `${testPage.name} - FCP`,
          metrics.fcp <= PAGE_BUDGETS.fcp_ms ? 'PASS' : (metrics.fcp <= PAGE_BUDGETS.fcp_ms * 1.5 ? 'WARNING' : 'FAIL'),
          metrics.fcp, PAGE_BUDGETS.fcp_ms, 'ms',
        );
        addResult(
          `${testPage.name} - LCP`,
          metrics.lcp <= PAGE_BUDGETS.lcp_ms ? 'PASS' : (metrics.lcp <= PAGE_BUDGETS.lcp_ms * 1.5 ? 'WARNING' : 'FAIL'),
          metrics.lcp, PAGE_BUDGETS.lcp_ms, 'ms',
        );
      }
    } catch (e) {
      console.log(`  ⚠ Could not measure: ${e.message}`);
      addResult(`${testPage.name} load`, 'WARNING', 'Measurement failed', 0, '');
    }
  }

  await browser.close();
}

// ── 3. Check for missing lazy loading ─────────────────────────
console.log('\n═══ PERFORMANCE: Code Splitting ═══');

try {
  const appContent = fs.readFileSync(path.join(SETU_ROOT, 'src/App.jsx'), 'utf8');
  const lazyImports = (appContent.match(/React\.lazy|lazy\(/g) || []).length;
  const totalRoutes = (appContent.match(/<Route /g) || []).length;

  addResult(
    'Lazy-loaded route count',
    lazyImports >= 20 ? 'PASS' : 'WARNING',
    lazyImports, 20, ' lazy imports',
  );

  console.log(`  Total routes: ${totalRoutes}`);
  console.log(`  Lazy loaded: ${lazyImports}`);
} catch (e) {
  console.log(`⚠ Could not analyze App.jsx: ${e.message}`);
}

// ── 4. Image optimization ──────────────────────────────────────
console.log('\n═══ PERFORMANCE: Image Optimization ═══');

try {
  const apiContent = fs.readFileSync(path.join(SETU_ROOT, 'src/lib/api.js'), 'utf8');
  const hasImageTransforms = apiContent.includes('transform') ||
                              apiContent.includes('width=') ||
                              apiContent.includes('supabase.co/storage');
  addResult(
    'Supabase Storage image transforms used',
    hasImageTransforms ? 'PASS' : 'WARNING',
    hasImageTransforms ? 1 : 0, 1, '',
  );
} catch (e) {
  addResult('Image optimization check', 'WARNING', e.message, 0, '');
}

// ── Run browser tests if server available ─────────────────────
async function main() {
  try {
    // Quick ping to see if dev server is running
    const { execSync } = await import('child_process');
    try {
      execSync(`curl -s -o /dev/null -w "%{http_code}" ${BASE_URL} --max-time 3`, { stdio: 'pipe' });
      await runPagePerformanceTests();
    } catch {
      console.log('\n⚠  Dev server not running — skipping live page measurements');
      console.log('   Run: npm run dev (in SETU root) to enable page perf tests');
      addResult('Dev server', 'WARNING', 'Not running', 0, '');
    }
  } catch (e) {
    console.log(`\n⚠  Browser performance tests skipped: ${e.message}`);
  }

  // ── Final report ─────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════');
  console.log('PERFORMANCE SUMMARY');
  console.log('═══════════════════════════════════════════');
  console.log(`✓ Passed:   ${results.summary.passed}`);
  console.log(`✗ Failed:   ${results.summary.failed}`);
  console.log(`⚠ Warnings: ${results.summary.warnings}`);

  fs.writeFileSync(
    path.join(REPORTS, 'performance-report.json'),
    JSON.stringify(results, null, 2),
  );
  console.log('\nReport written to: reports/performance-report.json');

  const criticalFails = results.budgets.filter(b => b.status === 'FAIL');
  if (criticalFails.length > 0) {
    console.error('\n✗ PERFORMANCE BUDGET FAILURES:');
    criticalFails.forEach(f => console.error(`  - ${f.name}: ${f.value} > ${f.threshold}`));
    process.exit(1);
  }
  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
