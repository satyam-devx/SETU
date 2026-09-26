import fs from 'node:fs';
import path from 'node:path';
import { expect } from '@playwright/test';

export class BusinessFlowAgent {
  constructor({ runId, reportDir, timeoutMs = 30000 }) {
    this.runId = runId;
    this.reportDir = reportDir;
    this.timeoutMs = timeoutMs;
    this.steps = [];
    this.startedAt = Date.now();
  }

  async step(name, fn) {
    const started = Date.now();
    const record = { name, startedAt: new Date(started).toISOString(), status: 'running' };
    this.steps.push(record);
    try {
      const value = await fn();
      record.status = 'passed';
      record.durationMs = Date.now() - started;
      record.finishedAt = new Date().toISOString();
      return value;
    } catch (error) {
      record.status = 'failed';
      record.durationMs = Date.now() - started;
      record.finishedAt = new Date().toISOString();
      record.error = error?.stack || error?.message || String(error);
      throw error;
    }
  }

  async screenshot(page, name) {
    fs.mkdirSync(this.reportDir, { recursive: true });
    const file = path.join(this.reportDir, name);
    await page.screenshot({ path: file, fullPage: true }).catch(() => {});
    return file;
  }

  writeReport(extra = {}) {
    fs.mkdirSync(this.reportDir, { recursive: true });
    const report = {
      runId: this.runId,
      status: this.steps.some(s => s.status === 'failed') ? 'failed' : 'passed',
      durationMs: Date.now() - this.startedAt,
      steps: this.steps,
      ...extra,
    };
    fs.writeFileSync(path.join(this.reportDir, 'business-flow-report.json'), JSON.stringify(report, null, 2));
    return report;
  }
}

export { expect };
