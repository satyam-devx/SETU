#!/usr/bin/env python3
"""
validate_migrations.py

Validates migration files in both:
  supabase/migrations/   — Supabase CLI format: YYYYMMDDHHMMSS_description.sql
  database/migrations/   — Legacy format: NNN_description.sql

Rules:
  1. supabase/migrations/ must use 14-digit timestamp prefix (Supabase CLI standard)
  2. database/migrations/ must use 3-4 digit prefix (legacy — kept for reference)
  3. No duplicate version numbers within each directory
  4. No empty files
  5. All files must be UTF-8 readable
  6. Gaps in sequence are warned (not errored) — intentional skips are allowed
"""

import os
import re
import sys

# Supabase CLI format: 20240101120000_description.sql
SUPABASE_RE = re.compile(r'^(\d{14})_[a-z0-9_]+\.sql$')

# Legacy format: 001_description.sql
LEGACY_RE = re.compile(r'^(\d{3,4})_[a-z0-9_]+\.sql$')

MIGRATION_DIRS = {
    "supabase/migrations":  SUPABASE_RE,
    "database/migrations":  LEGACY_RE,
}


def main():
    errors   = []
    warnings = []
    total    = 0

    for migration_dir, filename_re in MIGRATION_DIRS.items():
        if not os.path.isdir(migration_dir):
            print(f"  (skipping {migration_dir} — directory not found)")
            continue

        files = sorted(f for f in os.listdir(migration_dir) if f.endswith('.sql'))
        print(f"\nChecking {migration_dir}: {len(files)} file(s)")

        versions_seen = {}

        for fname in files:
            fpath = os.path.join(migration_dir, fname)

            # Rule 1/2: filename format
            m = filename_re.match(fname)
            if not m:
                # Explain the expected format for this directory
                if migration_dir == "supabase/migrations":
                    expected = "20240615120000_description.sql (14-digit timestamp)"
                else:
                    expected = "003_description.sql (3-digit number)"
                errors.append(f"  ✗ {fname}: invalid name — expected format: {expected}")
                continue

            version = m.group(1)

            # Rule 3: duplicate versions
            if version in versions_seen:
                errors.append(
                    f"  ✗ {fname}: duplicate version '{version}' "
                    f"(also used by {versions_seen[version]})"
                )
            else:
                versions_seen[version] = fname
                print(f"  ✓ {fname}")

            # Rule 4/5: readable and non-empty
            try:
                with open(fpath, 'r', encoding='utf-8') as f:
                    content = f.read()
                if not content.strip():
                    warnings.append(f"  ⚠ {fname}: file is empty")
            except UnicodeDecodeError:
                errors.append(f"  ✗ {fname}: not valid UTF-8")

            total += 1

        # Rule 6: warn on gaps (numeric sort)
        if versions_seen:
            sorted_versions = sorted(versions_seen.keys())
            for i in range(len(sorted_versions) - 1):
                a = int(sorted_versions[i])
                b = int(sorted_versions[i + 1])
                # For timestamps, a gap > 1 second is normal — don't warn
                # For legacy NNN format, warn on gaps
                if migration_dir == "database/migrations" and b - a > 1:
                    warnings.append(
                        f"  ⚠ Gap between {sorted_versions[i]} and {sorted_versions[i+1]}"
                    )

    if warnings:
        print("\nWarnings:")
        for w in warnings:
            print(w)

    if errors:
        print("\nErrors:")
        for e in errors:
            print(e)
        print(f"\n✗ Migration validation FAILED ({len(errors)} error(s))")
        sys.exit(1)
    else:
        print(f"\n✓ Migration validation passed ({total} migration(s) checked)")


if __name__ == '__main__':
    main()
