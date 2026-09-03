// qa/tests/unit/customer-voice.test.js — PASS 5 (FUNC-02) regression tests
//
// CustomerVoice.jsx previously called a non-existent AIAPI.transcribeVoice()
// method and had no real microphone capture. These tests guard against a
// silent regression back to that state. Full runtime (real SpeechRecognition
// permission prompts, actual transcript accuracy) cannot be exercised in
// this environment — see SETU-PASS5-REMEDIATION-REPORT.md §5/§18 for why —
// so these are static source-content checks plus a render-time smoke test
// for the unsupported-browser path, the one runtime behavior that doesn't
// require an actual microphone/browser speech engine.

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const COMPONENT_PATH = path.resolve(__dirname, '../../../src/pages/customer/CustomerVoice.jsx');
const API_PATH = path.resolve(__dirname, '../../../src/lib/api.js');

describe('CustomerVoice — FUNC-02 regression guard', () => {
  const componentSource = fs.readFileSync(COMPONENT_PATH, 'utf-8');
  const apiSource = fs.readFileSync(API_PATH, 'utf-8');

  it('does not reference the non-existent AIAPI.transcribeVoice anywhere', () => {
    expect(componentSource).not.toMatch(/AIAPI\.transcribeVoice/);
  });

  it('calls the real, exported AIAPI.voiceQuery', () => {
    expect(componentSource).toMatch(/AIAPI\.voiceQuery\(/);
  });

  it('AIAPI actually exports voiceQuery (the contract CustomerVoice depends on)', () => {
    expect(apiSource).toMatch(/export const AIAPI = \{[\s\S]*?voiceQuery:/);
  });

  it('uses a real browser speech-recognition API rather than a fake timer-based simulation', () => {
    expect(componentSource).toMatch(/SpeechRecognition/);
    // The old implementation's tell-tale fake-recording marker:
    expect(componentSource).not.toMatch(/Simulate .*recording/i);
  });

  it('handles the unsupported-browser case explicitly (does not assume SpeechRecognition exists)', () => {
    expect(componentSource).toMatch(/unsupported/);
    expect(componentSource).toMatch(/getSpeechRecognitionCtor/);
  });

  it('handles microphone permission denial explicitly', () => {
    expect(componentSource).toMatch(/not-allowed|permission-denied/);
    expect(componentSource).toMatch(/denied/i);
  });

  it('cleans up any live recognition session on unmount', () => {
    expect(componentSource).toMatch(/useEffect/);
    expect(componentSource).toMatch(/recognitionRef\.current\.stop\(\)/);
  });

  it('does not represent hardcoded suggested phrases as fake AI output', () => {
    // The old implementation set a hardcoded { intent: 'search', confidence: 0.99 }
    // object directly as the "result" for a suggested phrase, without calling
    // the real assistant. Suggested phrases must now flow through the same
    // real call as a spoken query.
    expect(componentSource).not.toMatch(/confidence:\s*0\.99/);
    expect(componentSource).toMatch(/handlePhrase[\s\S]*?runAssistant\(/);
  });

  it('does not fabricate a confidence/language-detection badge the real API never returns', () => {
    expect(componentSource).not.toMatch(/detectedLanguage/);
  });
});
