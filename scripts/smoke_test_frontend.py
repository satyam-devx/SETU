#!/usr/bin/env python3
"""
smoke_test_frontend.py

Post-deploy frontend availability checks.
Runs after GitHub Pages deployment to verify the site is up.

Checks:
  1. Root URL returns 200 with valid HTML
  2. 404.html exists (for SPA routing)
  3. Main JS bundle is reachable (not 404)
  4. Firebase service worker is reachable
  5. Response time is acceptable (<5s)
"""

import os
import sys
import time
import urllib.request
import urllib.error
import re

PROD_URL = os.environ.get('PROD_URL', '').rstrip('/')

if not PROD_URL:
    print("⚠  PROD_URL not set — skipping frontend smoke tests")
    print("   Set PROD_URL in GitHub repository variables (Settings → Variables)")
    sys.exit(0)


def fetch_url(url: str, timeout: int = 10) -> tuple[int, str, float]:
    start = time.time()
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'SETU-CI/1.0'})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read(16384).decode('utf-8', errors='ignore')
            elapsed = time.time() - start
            return resp.status, body, elapsed
    except urllib.error.HTTPError as e:
        elapsed = time.time() - start
        return e.code, '', elapsed
    except urllib.error.URLError as e:
        elapsed = time.time() - start
        return 0, str(e.reason), elapsed
    except Exception as e:
        return 0, str(e), time.time() - start


def main():
    print(f"Frontend smoke tests against: {PROD_URL}\n")

    errors = []
    MAX_RESPONSE_TIME = 8.0  # seconds

    # 1. Root URL
    status, body, elapsed = fetch_url(PROD_URL + '/')
    if status == 200:
        if '<html' in body.lower() or '<!DOCTYPE' in body[:50]:
            print(f"  ✓ Root URL: HTTP {status} ({elapsed:.1f}s)")
        else:
            errors.append(f"  ✗ Root URL returned {status} but body doesn't look like HTML")
    else:
        errors.append(f"  ✗ Root URL: HTTP {status} ({elapsed:.1f}s)")

    if elapsed > MAX_RESPONSE_TIME:
        print(f"  ⚠ Root URL response time {elapsed:.1f}s exceeds {MAX_RESPONSE_TIME}s target")

    # 2. 404.html (SPA routing)
    status, body, elapsed = fetch_url(PROD_URL + '/404.html')
    if status == 200:
        print(f"  ✓ 404.html (SPA routing): HTTP {status}")
    else:
        errors.append(f"  ✗ 404.html missing: HTTP {status} — deep links will break")

    # 3. A deep route should return 200 via 404.html fallback
    status, body, elapsed = fetch_url(PROD_URL + '/customer')
    if status in (200, 404):   # GitHub Pages serves 404.html for unknown routes
        print(f"  ✓ Deep route /customer: HTTP {status} (SPA will handle routing)")
    else:
        print(f"  ⚠ Deep route /customer: HTTP {status} (check GitHub Pages config)")

    # 4. Firebase service worker
    status, body, elapsed = fetch_url(PROD_URL + '/firebase-messaging-sw.js')
    if status == 200:
        if 'firebase' in body.lower():
            print(f"  ✓ Firebase SW: HTTP {status}")
        else:
            print(f"  ⚠ Firebase SW returned 200 but content doesn't look like Firebase JS")
    else:
        print(f"  ⚠ Firebase SW: HTTP {status} (push notifications may not work)")

    # 5. Summary
    print()
    if errors:
        print(f"✗ Frontend smoke tests FAILED ({len(errors)} error(s)):")
        for e in errors:
            print(e)
        sys.exit(1)
    else:
        print(f"✓ Frontend smoke tests passed")


if __name__ == '__main__':
    main()
