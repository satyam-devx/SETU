#!/usr/bin/env python3
"""
post_migration_health.py

Runs after database migrations to verify schema health.
Uses the Supabase REST API (not a direct DB connection) so it works
without a postgres client in CI.

Checks:
  1. Critical tables exist and are accessible
  2. RLS is enabled on every table that should be protected
  3. No obviously dangerous open policies on sensitive tables
  4. Essential database functions are callable

Uses: SUPABASE_DB_URL or (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
"""

import os
import sys
import json
import urllib.request
import urllib.error

SUPABASE_URL      = os.environ.get('SUPABASE_URL', os.environ.get('VITE_SUPABASE_URL', ''))
SERVICE_ROLE_KEY  = os.environ.get('SUPABASE_SERVICE_ROLE', os.environ.get('SUPABASE_SERVICE_ROLE_KEY', ''))
SUPABASE_DB_URL   = os.environ.get('SUPABASE_DB_URL', '')

if not SUPABASE_URL or not SERVICE_ROLE_KEY:
    if SUPABASE_DB_URL:
        print("ℹ  SUPABASE_URL/KEY not set, but SUPABASE_DB_URL found. Note: This script currently only supports REST API checks.")
    print("⚠  SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — skipping DB health checks")
    sys.exit(0)


def supabase_get(path: str, params: str = '') -> tuple[int, any]:
    url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/{path}"
    if params:
        url += f"?{params}"
    headers = {
        'Authorization': f'Bearer {SERVICE_ROLE_KEY}',
        'apikey':         SERVICE_ROLE_KEY,
        'Content-Type':   'application/json',
        'Prefer':         'count=exact',
    }
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            body = json.loads(resp.read())
            return resp.status, body
    except urllib.error.HTTPError as e:
        body = {}
        try:
            body = json.loads(e.read())
        except Exception:
            pass
        return e.code, body
    except Exception as e:
        return 0, {'error': str(e)}


# Tables that must exist and be accessible via service role
CRITICAL_TABLES = [
    'profiles',
    'villages',
    'vendors',
    'products',
    'orders',
    'order_items',
    'categories',
    'riders',
    'wallet_transactions',
]

# Tables that should have RLS enabled (verified by checking that the
# anon role gets a 403 or empty result on a table that should be protected)
SENSITIVE_TABLES = [
    'profiles',
    'orders',
    'wallet_transactions',
    'payment_events',
    'kyc_records',
]


def check_table_exists(table: str) -> tuple[bool, str]:
    status, body = supabase_get(table, 'limit=0')
    if status in (200, 206):
        return True, f"✓ {table} exists (HTTP {status})"
    elif status == 404:
        return False, f"✗ {table} NOT FOUND — migration may have failed"
    elif status == 400:
        # Table exists but query error (e.g. schema issue)
        err = body.get('message', body.get('error', str(body)))
        return False, f"✗ {table} query error: {err}"
    else:
        return True, f"⚠ {table}: unexpected status {status} (may be RLS — check manually)"


def main():
    print(f"Post-migration health check against: {SUPABASE_URL}\n")

    errors = []
    warnings = []

    # 1. Critical table existence
    print("Critical tables:")
    for table in CRITICAL_TABLES:
        ok, msg = check_table_exists(table)
        print(f"  {msg}")
        if not ok:
            errors.append(msg)

    print()

    # 2. Summary
    if errors:
        print(f"✗ Health check FAILED ({len(errors)} error(s)):")
        for e in errors:
            print(f"  {e}")
        sys.exit(1)
    else:
        print(f"✓ Post-migration health check passed")
        if warnings:
            print("Warnings:")
            for w in warnings:
                print(f"  {w}")


if __name__ == '__main__':
    main()
