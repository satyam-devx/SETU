#!/usr/bin/env python3
"""health_frontend.py — Check production frontend availability."""
import os, sys, urllib.request, urllib.error, time

PROD_URL = os.environ.get('PROD_URL', '').rstrip('/')

if not PROD_URL:
    print("⚠  PROD_URL not set — skipping frontend health check")
    sys.exit(0)

def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'SETU-HealthBot/1.0'})
    t = time.time()
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            r.read(4096)
            return r.status, time.time() - t, None
    except urllib.error.HTTPError as e:
        return e.code, time.time() - t, None
    except Exception as e:
        return 0, time.time() - t, str(e)

def main():
    print(f"Frontend health: {PROD_URL}\n")
    status, elapsed, err = fetch(PROD_URL + '/')
    if err:
        print(f"  ✗ Site unreachable: {err}")
        sys.exit(1)
    elif status == 200:
        slow = " ⚠ SLOW" if elapsed > 5.0 else ""
        print(f"  ✓ HTTP {status} ({elapsed:.1f}s){slow}")
        print("✓ Frontend is up")
    else:
        print(f"  ✗ HTTP {status}")
        sys.exit(1)

if __name__ == '__main__':
    main()
