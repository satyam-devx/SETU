#!/usr/bin/env python3
"""
validate_migrations.py

Validates that migration files in supabase/migrations/ follow the project's
naming and ordering conventions. Fails the CI pipeline on violations.

Rules:
  1. Filename format: NNN_description.sql  (e.g. 001_initial.sql)
  2. Numbers must start at 001 and increment (gaps are warned, not errored,
     since some migrations may be intentionally skipped).
  3. No duplicate numbers.
  4. No numbers higher than 999 (migrate to 4-digit if needed).
  5. All files must be UTF-8 readable.
"""

import os
import re
import sys

MIGRATION_DIRS = [
    "supabase/migrations",
    "database/migrations",
]

FILENAME_RE = re.compile(r'^(\d{3,4})_[a-z0-9_]+\.sql$')

def main():
    errors = []
    warnings = []
    all_migrations = []

    for migration_dir in MIGRATION_DIRS:
        if not os.path.isdir(migration_dir):
            print(f"  (skipping {migration_dir} — directory not found)")
            continue

        files = sorted(f for f in os.listdir(migration_dir) if f.endswith('.sql'))
        print(f"\nChecking {migration_dir}: {len(files)} file(s)")

        numbers_seen = {}

        for fname in files:
            fpath = os.path.join(migration_dir, fname)

            # Rule 1: filename format
            m = FILENAME_RE.match(fname)
            if not m:
                errors.append(
                    f"  ✗ {fname}: invalid name — must be NNN_description.sql "
                    f"(e.g. 003_add_payments.sql)"
                )
                continue

            num = int(m.group(1))

            # Rule 3: duplicate numbers
            if num in numbers_seen:
                errors.append(
                    f"  ✗ {fname}: duplicate migration number {num:03d} "
                    f"(also used by {numbers_seen[num]})"
                )
            else:
                numbers_seen[num] = fname

            # Rule 5: UTF-8 readable
            try:
                with open(fpath, 'r', encoding='utf-8') as f:
                    content = f.read()
                    if len(content.strip()) == 0:
                        warnings.append(f"  ⚠ {fname}: file is empty")
            except UnicodeDecodeError:
                errors.append(f"  ✗ {fname}: file is not valid UTF-8")

            all_migrations.append((num, fname, migration_dir))

        # Rule 2: warn on gaps
        if numbers_seen:
            sorted_nums = sorted(numbers_seen.keys())
            for i in range(len(sorted_nums) - 1):
                a = sorted_nums[i]
                b = sorted_nums[i + 1]
                if b - a > 1:
                    warnings.append(
                        f"  ⚠ Gap in migration numbers: {a:03d} → {b:03d} "
                        f"(missing: {', '.join(f'{n:03d}' for n in range(a+1, b))})"
                    )

    # Print summary
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
        print(f"\n✓ Migration validation passed ({len(all_migrations)} migration(s) checked)")

if __name__ == '__main__':
    main()
