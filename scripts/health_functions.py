#!/usr/bin/env python3
"""health_functions.py — Check Edge Function availability."""
import os, sys, urllib.request, urllib.error

SUPABASE_URL = os.environ.get('SUPABASE_URL', os.environ.get('VITE_SUPABASE_URL', ''))
ANON_KEY     = os.environ.get('SUPABASE_ANON_KEY', os.environ.get('VITE_SUPABASE_ANON_KEY', ''))

if not SUPABASE_URL:
    print("⚠  SUPABASE_URL not set — skipping")
    sys.exit(0)

FUNCTIONS = ['ai-assistant', 'create-razorpay-order', 'kyc-verify',
             'razorpay-webhook', 'send-fcm-notification', 'verify-aadhaar']

def probe(fn):
    url = f"{SUPABASE_URL.rstrip('/')}/functions/v1/{fn}"
    req = urllib.request.Request(url, method='OPTIONS', headers={
        'Origin': 'https://health-check.example.com',
        'Access-Control-Request-Method': 'POST',
        'apikey': ANON_KEY,
    })
    try:
        with urllib.request.urlopen(req, timeout=8) as r:
            return r.status, None
    except urllib.error.HTTPError as e:
        return e.code, None
    except Exception as e:
        return 0, str(e)

def main():
    print("Edge Function availability:\n")
    errors = []
    for fn in FUNCTIONS:
        status, err = probe(fn)
        if err:
            print(f"  ✗ {fn}: {err}")
            errors.append(fn)
        elif status in (200, 204, 405):
            # 405 Method Not Allowed also means the function exists
            print(f"  ✓ {fn}: HTTP {status}")
        elif status in (401, 403):
            # Auth error means function is up, just requires auth
            print(f"  ✓ {fn}: HTTP {status} (requires auth — function is live)")
        elif status == 404:
            print(f"  ✗ {fn}: 404 — function not deployed!")
            errors.append(fn)
        else:
            print(f"  ⚠ {fn}: HTTP {status}")

    print()
    if errors:
        print(f"✗ Functions unavailable: {errors}")
        sys.exit(1)
    else:
        print("✓ All Edge Functions are reachable")

if __name__ == '__main__':
    main()
