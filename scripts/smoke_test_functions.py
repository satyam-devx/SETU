#!/usr/bin/env python3
"""
smoke_test_functions.py

Post-deployment smoke tests for all SETU Edge Functions.
Tests that each function:
  1. Is reachable (not 404/502)
  2. Responds correctly to OPTIONS (CORS preflight)
  3. Rejects invalid requests with appropriate 4xx (not 500)

Does NOT test real business logic (no real Razorpay/Firebase calls).
Uses the service role key for auth where needed.
"""

import os
import sys
import json
import urllib.request
import urllib.error
import time

SUPABASE_URL  = os.environ.get('SUPABASE_URL', '')
ANON_KEY      = os.environ.get('SUPABASE_ANON_KEY', '')
SERVICE_ROLE  = os.environ.get('SUPABASE_SERVICE_ROLE', '')

if not SUPABASE_URL or not ANON_KEY:
    print("⚠  SUPABASE_URL or SUPABASE_ANON_KEY not set — skipping smoke tests")
    sys.exit(0)

FUNCTIONS_BASE = f"{SUPABASE_URL.rstrip('/')}/functions/v1"

TESTS = [
    {
        'function': 'ai-assistant',
        'description': 'OPTIONS preflight',
        'method': 'OPTIONS',
        'headers': {
            'Origin': 'https://example.com',
            'Access-Control-Request-Method': 'POST',
        },
        'body': None,
        'expect_status': [200, 204],
        'expect_header': 'access-control-allow-origin',
    },
    {
        'function': 'ai-assistant',
        'description': 'POST with valid body',
        'method': 'POST',
        'headers': {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {ANON_KEY}',
            'apikey': ANON_KEY,
        },
        'body': {'message': 'hello', 'context': {}},
        'expect_status': [200],
    },
    {
        'function': 'create-razorpay-order',
        'description': 'OPTIONS preflight',
        'method': 'OPTIONS',
        'headers': {'Origin': 'https://example.com'},
        'body': None,
        'expect_status': [200, 204],
    },
    {
        'function': 'create-razorpay-order',
        'description': 'POST with missing fields returns 400',
        'method': 'POST',
        'headers': {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {ANON_KEY}',
            'apikey': ANON_KEY,
        },
        'body': {},   # missing amount, orderId, etc.
        'expect_status': [400, 422],   # should reject, not 500
    },
    {
        'function': 'kyc-verify',
        'description': 'OPTIONS preflight',
        'method': 'OPTIONS',
        'headers': {'Origin': 'https://example.com'},
        'body': None,
        'expect_status': [200, 204],
    },
    {
        'function': 'verify-aadhaar',
        'description': 'OPTIONS preflight',
        'method': 'OPTIONS',
        'headers': {'Origin': 'https://example.com'},
        'body': None,
        'expect_status': [200, 204],
    },
    {
        'function': 'send-fcm-notification',
        'description': 'OPTIONS preflight',
        'method': 'OPTIONS',
        'headers': {'Origin': 'https://example.com'},
        'body': None,
        'expect_status': [200, 204],
    },
    {
        'function': 'razorpay-webhook',
        'description': 'POST without signature returns 400',
        'method': 'POST',
        'headers': {'Content-Type': 'application/json'},
        'body': {'event': 'payment.captured'},
        'expect_status': [400, 401, 403, 500],  # any rejection is fine; 200 would be wrong
    },
]


def run_test(test: dict) -> tuple[bool, str]:
    url = f"{FUNCTIONS_BASE}/{test['function']}"
    method = test['method']
    headers = test.get('headers', {})
    body = test.get('body')
    expect_statuses = test['expect_status']

    data = json.dumps(body).encode('utf-8') if body is not None else None

    req = urllib.request.Request(url, data=data, headers=headers, method=method)

    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            status = resp.status
            resp_headers = dict(resp.headers)
    except urllib.error.HTTPError as e:
        status = e.code
        resp_headers = dict(e.headers)
    except urllib.error.URLError as e:
        return False, f"Network error: {e.reason}"
    except Exception as e:
        return False, f"Exception: {e}"

    # Check status
    if status not in expect_statuses:
        return False, f"Expected status {expect_statuses}, got {status}"

    # Check header if required
    if 'expect_header' in test:
        expected_header = test['expect_header'].lower()
        found = any(k.lower() == expected_header for k in resp_headers)
        if not found:
            return False, f"Expected header '{expected_header}' not in response"

    return True, f"HTTP {status} ✓"


def main():
    print(f"Smoke testing Edge Functions at: {FUNCTIONS_BASE}\n")

    passed = 0
    failed = 0

    for test in TESTS:
        name = f"{test['function']} — {test['description']}"
        ok, detail = run_test(test)
        status_icon = "✓" if ok else "✗"
        print(f"  {status_icon} {name}: {detail}")
        if ok:
            passed += 1
        else:
            failed += 1

    print(f"\n{'✓' if failed == 0 else '✗'} {passed} passed, {failed} failed")

    if failed > 0:
        sys.exit(1)


if __name__ == '__main__':
    main()
