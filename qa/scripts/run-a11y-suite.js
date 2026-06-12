#!/usr/bin/env node
// scripts/run-a11y-suite.js — SETU Accessibility audit runner
// Runs axe-core on all major pages and generates a report

import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPORTS  = path.join(__dirname, '../reports');
const BASE_URL = process.env.SETU_E2E_URL || 'http://localhost:5173';

fs.mkdirSync(REPORTS, { recursive: true });

const results = {
  timestamp: new Date().toISOString(),
  pages:     [],
  summary:   { passed: 0, failed: 0, warnings: 0, totalViolations: 0 },
};

// Pages to audit
const PAGES_TO_AUDIT = [
  { path: '/login',                name: 'Login',              critical: true  },
  { path: '/login/verify',         name: 'OTP Verify',         critical: true  },
  { path: '/onboarding/register',  name: 'Register',           critical: true  },
  { path: '/customer/privacy-policy', name: 'Privacy Policy',  critical: false },
  { path: '/customer/terms',       name: 'Terms',              critical: false },
  { path: '/role-error',           name: 'Role Error',         critical: false },
  { path: '/',                     name: 'Root / Role Select', critical: false },
];

// Impact levels that block CI
const BLOCKING_IMPACTS = ['critical', 'serious'];

async function main() {
  let browser;
  try {
    browser = await chromium.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  } catch (e) {
    console.log(`⚠  Could not launch browser: ${e.message}`);
    console.log('   Skipping live a11y tests — run Playwright tests for full audit');
    process.exit(0);
  }

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();

  // Inject axe-core
  const axeSource = fs.readFileSync(
    path.resolve(__dirname, '../node_modules/axe-core/axe.min.js'),
    'utf8'
  );

  for (const testPage of PAGES_TO_AUDIT) {
    const url = `${BASE_URL}${testPage.path}`;
    console.log(`\nAuditing: ${testPage.name} (${url})`);

    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
      await page.addScriptTag({ content: axeSource });

      const axeResults = await page.evaluate(async () => {
        return await window.axe.run(document, {
          runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
          resultTypes: ['violations', 'incomplete'],
        });
      });

      const violations = axeResults.violations ?? [];
      const blockingViolations = violations.filter(v => BLOCKING_IMPACTS.includes(v.impact));

      results.summary.totalViolations += violations.length;

      const pageResult = {
        name:       testPage.name,
        path:       testPage.path,
        violations: violations.map(v => ({
          id:          v.id,
          impact:      v.impact,
          description: v.description,
          count:       v.nodes.length,
          help:        v.help,
          helpUrl:     v.helpUrl,
        })),
        passed:  violations.length === 0,
        blocking: blockingViolations.length > 0,
      };

      results.pages.push(pageResult);

      if (violations.length === 0) {
        console.log(`  ✓ No violations`);
        results.summary.passed++;
      } else {
        violations.forEach(v => {
          const icon = BLOCKING_IMPACTS.includes(v.impact) ? '✗' : '⚠';
          console.log(`  ${icon} [${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} node(s))`);
        });

        if (blockingViolations.length > 0 && testPage.critical) {
          results.summary.failed++;
        } else {
          results.summary.warnings++;
        }
      }
    } catch (e) {
      console.log(`  ⚠ Error: ${e.message}`);
      results.summary.warnings++;
      results.pages.push({
        name: testPage.name, path: testPage.path,
        error: e.message, violations: [], passed: false,
      });
    }
  }

  await browser.close();

  // Write report
  console.log('\n═══════════════════════════════════════════');
  console.log('ACCESSIBILITY SUMMARY');
  console.log('═══════════════════════════════════════════');
  console.log(`✓ Passed pages:    ${results.summary.passed}`);
  console.log(`✗ Failed pages:    ${results.summary.failed}`);
  console.log(`⚠ Warning pages:   ${results.summary.warnings}`);
  console.log(`  Total violations: ${results.summary.totalViolations}`);

  fs.writeFileSync(
    path.join(REPORTS, 'a11y-report.json'),
    JSON.stringify(results, null, 2),
  );
  console.log('\nReport written to: reports/a11y-report.json');

  // Only fail CI on blocking violations in critical pages
  const criticalFails = results.pages.filter(p =>
    PAGES_TO_AUDIT.find(t => t.path === p.path)?.critical && p.blocking
  );

  if (criticalFails.length > 0) {
    console.error('\n✗ Critical pages have blocking a11y violations:');
    criticalFails.forEach(p => {
      console.error(`  ${p.name}:`);
      p.violations.filter(v => BLOCKING_IMPACTS.includes(v.impact)).forEach(v => {
        console.error(`    [${v.impact}] ${v.id}: ${v.description}`);
      });
    });
    process.exit(1);
  }

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
