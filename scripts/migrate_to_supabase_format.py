#!/usr/bin/env python3
"""
migrate_to_supabase_format.py

One-time migration helper.

SETU currently stores migrations under database/migrations/ without
the Supabase CLI's expected format. This script:
  1. Copies existing SQL files to supabase/migrations/
  2. Renames them to Supabase's timestamp format: YYYYMMDDHHMMSS_description.sql
  3. Fixes the duplicate 006 migration number conflict
  4. Does NOT modify or delete the originals

Run this ONCE locally, commit the result, then use `supabase db push` going forward.

MIGRATION NUMBER → TIMESTAMP MAPPING:
  002_payments.sql          → 20240101000002_payments.sql
  003_locations.sql         → 20240101000003_locations.sql
  005_cod_deposits.sql      → 20240101000005_cod_deposits.sql
  006_anchor_portal.sql     → 20240101000006_anchor_portal.sql
  006_phase2_hardening.sql  → 20240101000007_phase2_hardening.sql (renamed to avoid conflict)

NOTE: 001_initial.sql (schema.sql + functions.sql + rls.sql combined) must be
created separately — see comments below.
"""

import os
import shutil
import sys

SRC_DIR  = 'database/migrations'
DEST_DIR = 'supabase/migrations'

# Mapping: original filename → supabase timestamp filename
# Timestamps are synthetic but ordered correctly.
# The "missing" 001 and 004 are handled via schema.sql bootstrap.
RENAME_MAP = {
    '002_payments.sql':         '20240101000002_payments.sql',
    '003_locations.sql':        '20240101000003_locations.sql',
    '005_cod_deposits.sql':     '20240101000005_cod_deposits.sql',
    '006_anchor_portal.sql':    '20240101000006_anchor_portal.sql',
    # 006 conflict: phase2_hardening becomes 007
    '006_phase2_hardening.sql': '20240101000007_phase2_hardening.sql',
}


def main():
    if not os.path.isdir(SRC_DIR):
        print(f"✗ Source directory {SRC_DIR} not found")
        sys.exit(1)

    os.makedirs(DEST_DIR, exist_ok=True)

    print(f"Copying migrations from {SRC_DIR} → {DEST_DIR}\n")

    for original, new_name in RENAME_MAP.items():
        src  = os.path.join(SRC_DIR, original)
        dest = os.path.join(DEST_DIR, new_name)

        if not os.path.exists(src):
            print(f"  ⚠ {original}: source file not found, skipping")
            continue

        if os.path.exists(dest):
            print(f"  ⚠ {new_name}: already exists in {DEST_DIR}, skipping")
            continue

        shutil.copy2(src, dest)
        print(f"  ✓ {original} → {new_name}")

    print(f"""
Done! Next steps:

1. Create the initial baseline migration (001):
   Combine schema.sql + functions.sql + rls.sql into:
   supabase/migrations/20240101000001_initial_schema.sql

   This is the baseline for all new database setups.
   On an existing database, mark it as already applied:
     supabase migration repair --status applied 20240101000001

2. Commit the supabase/migrations/ directory

3. From now on, add new migrations as:
   supabase/migrations/YYYYMMDDHHMMSS_description.sql
   (use `supabase migration new <name>` to generate the timestamp)

4. Deploy with: supabase db push
   (CI/CD does this automatically on push to main)
""")


if __name__ == '__main__':
    main()
