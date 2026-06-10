#!/usr/bin/env python3
"""
health_db.py — Scheduled database health check.
Checks connectivity and key table health via Supabase REST API.
"""

import os
import sys
import json
import time
import urllib.request
import urllib.error

SUPABASE_URL     = os.environ.get('SUPABASE_URL', os.environ.get('VITE_SUPABASE_URL', ''))
SERVICE_ROLE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE', os.environ.get('SUPABASE_SERVICE_ROLE_KEY', ''))

if not SUPABASE_URL or not SERVICE_ROLE_KEY:
    print("⚠  Env vars not set — skipping DB health check")
    sys.exit(0)


def query(table, params='limit=1'):
    url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/{table}?{params}"
    req = urllib.request.Request(url, headers={
        'Authorization': f'Bearer {SERVICE_ROLE_KEY}',
        'apikey':         SERVICE_ROLE_KEY,
    })
    start = time.time()
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            return resp.status, time.time() - start, None
    except urllib.error.HTTPError as e:
        return e.code, time.time() - start, None
    except Exception as e:
        return 0, time.time() - start, str(e)


TABLES = ['profiles', 'villages', 'vendors', 'orders', 'products']

def main():
    print(f"DB health check: {SUPABASE_URL}\n")
    errors = []
    for table in TABLES:
        status, elapsed, err = query(table)
        if err:
            print(f"  ✗ {table}: {err}")
            errors.append(table)
        elif status in (200, 206):
            slowness = " ⚠ SLOW" if elapsed > 2.0 else ""
            print(f"  ✓ {table} ({elapsed*1000:.0f}ms){slowness}")
        else:
            print(f"  ✗ {table}: HTTP {status}")
            errors.append(table)

    if errors:
        print(f"\n✗ DB health DEGRADED: {errors}")
        sys.exit(1)
    else:
        print(f"\n✓ DB health OK")

if __name__ == '__main__':
    main()
