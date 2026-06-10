#!/usr/bin/env python3
"""
bootstrap_migrations.py

Marks all pre-existing migrations as applied in Supabase's internal
migration tracking table — using only the Supabase REST API over HTTPS.

No psql. No port 5432. Works from GitHub Actions, Termux, anywhere.

HOW IT WORKS:
  Supabase exposes a /rest/v1/rpc endpoint that lets you execute
  arbitrary SQL via the service role key. We use this to:
    1. Create the supabase_migrations schema + table (if not exists)
    2. Insert a row per migration (ON CONFLICT DO NOTHING)
    3. Return the current state so CI can print a verification table

Usage:
  python3 scripts/bootstrap_migrations.py             # run bootstrap
  python3 scripts/bootstrap_migrations.py --verify-only  # just print state
"""

import os
import sys
import json
import urllib.request
import urllib.error

SUPABASE_URL   = os.environ.get('SUPABASE_URL', '').rstrip('/')
SERVICE_ROLE   = os.environ.get('SUPABASE_SERVICE_ROLE', '')

# ── The 6 migrations that already exist in your live database ─────────────
# version = timestamp prefix of the filename in supabase/migrations/
# name    = description part of the filename
EXISTING_MIGRATIONS = [
    ('20240101000001', 'initial_schema'),
    ('20240101000002', 'payments'),
    ('20240101000003', 'locations'),
    ('20240101000005', 'cod_deposits'),
    ('20240101000006', 'anchor_portal'),
    ('20240101000007', 'phase2_hardening'),
]

# ── SQL executed via the REST API ─────────────────────────────────────────
BOOTSTRAP_SQL = """
-- Create the schema + table the Supabase CLI uses for migration tracking
CREATE SCHEMA IF NOT EXISTS supabase_migrations;

CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
  version    text  PRIMARY KEY,
  statements text[],
  name       text
);

-- Mark every pre-existing migration as applied
-- ON CONFLICT DO NOTHING makes this safe to re-run
INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES
  {values}
ON CONFLICT (version) DO NOTHING;
""".strip()

VERIFY_SQL = """
SELECT version, name
FROM supabase_migrations.schema_migrations
ORDER BY version;
""".strip()


def sql_via_rest(sql: str) -> tuple[int, any]:
    """
    Execute SQL through Supabase's /rest/v1/rpc/... endpoint.

    Supabase doesn't expose a raw SQL endpoint on the REST API directly,
    but it DOES allow calling any SQL function. We create a one-shot
    function, call it, then drop it — all in a single transaction.

    Actually, the cleanest approach is the pg_dump/pg_restore pattern
    via the Management API: POST /v1/projects/{ref}/database/query
    which accepts raw SQL and returns results. This is the official
    Supabase Management API endpoint, uses port 443, and works from
    any network.
    """
    # Extract project ref from the project URL
    # URL format: https://abcdefghijklmnop.supabase.co
    project_ref = SUPABASE_URL.replace('https://', '').split('.')[0]

    url = f"https://api.supabase.com/v1/projects/{project_ref}/database/query"

    payload = json.dumps({"query": sql}).encode('utf-8')
    headers = {
        'Content-Type':  'application/json',
        'Authorization': f'Bearer {SERVICE_ROLE}',
    }

    req = urllib.request.Request(url, data=payload, headers=headers, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
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


def run_bootstrap():
    if not SUPABASE_URL or not SERVICE_ROLE:
        print("✗ SUPABASE_URL and SUPABASE_SERVICE_ROLE must be set")
        sys.exit(1)

    values_sql = ',\n  '.join(
        f"('{v}', '{n}')" for v, n in EXISTING_MIGRATIONS
    )
    sql = BOOTSTRAP_SQL.format(values=values_sql)

    print(f"Connecting to: {SUPABASE_URL}")
    print(f"Project ref:   {SUPABASE_URL.replace('https://','').split('.')[0]}")
    print()
    print("Running bootstrap SQL via Management API (HTTPS)...")

    status, body = sql_via_rest(sql)

    if status in (200, 201):
        print("✓ Bootstrap SQL executed successfully")
    else:
        print(f"✗ Bootstrap failed: HTTP {status}")
        print(f"  Response: {json.dumps(body, indent=2)}")
        print()
        print("Troubleshooting:")
        print("  - Verify SUPABASE_SERVICE_ROLE_KEY is the service_role key (not anon)")
        print("  - Verify VITE_SUPABASE_URL is correct")
        sys.exit(1)


def run_verify():
    print("Verifying migration tracking table...")
    status, body = sql_via_rest(VERIFY_SQL)

    if status in (200, 201):
        rows = body if isinstance(body, list) else body.get('data', [])
        if rows:
            print()
            print(f"  {'version':<20}  {'name'}")
            print(f"  {'-'*20}  {'-'*30}")
            for row in rows:
                v = row.get('version', '')
                n = row.get('name', '')
                print(f"  {v:<20}  {n}")
            print()
            print(f"✓ {len(rows)} migration(s) marked as applied")
        else:
            print("⚠  Table exists but is empty — bootstrap may not have run yet")
    else:
        print(f"✗ Verify failed: HTTP {status}")
        print(f"  {json.dumps(body, indent=2)}")
        sys.exit(1)


def main():
    verify_only = '--verify-only' in sys.argv

    if verify_only:
        run_verify()
    else:
        run_bootstrap()
        print()
        run_verify()


if __name__ == '__main__':
    main()
