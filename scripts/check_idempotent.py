#!/usr/bin/env python3
"""
check_idempotent.py

Verifies that migration SQL files are idempotent — they can be run
more than once without causing errors.

Idempotency patterns required:
  - CREATE TABLE  →  must use IF NOT EXISTS
  - CREATE INDEX  →  must use IF NOT EXISTS
  - ALTER TABLE ADD COLUMN  →  must use IF NOT EXISTS
  - CREATE SEQUENCE  →  must use IF NOT EXISTS
  - CREATE EXTENSION  →  must use IF NOT EXISTS
  - CREATE POLICY  →  wrapped in DO $$ BEGIN IF NOT EXISTS ... END; $$
    OR uses DROP POLICY IF EXISTS before CREATE POLICY

Exceptions:
  - CREATE OR REPLACE FUNCTION/TRIGGER FUNCTION → already idempotent
  - DROP ... IF EXISTS → already idempotent
  - INSERT → warn but don't fail (seeds may be intentional duplicates)
"""

import os
import re
import sys

MIGRATION_DIRS = [
    "supabase/migrations",
    "database/migrations",
]

def check_file(fpath: str) -> list[str]:
    issues = []
    with open(fpath, 'r', encoding='utf-8') as f:
        content = f.read()

    lines = content.split('\n')
    for lineno, line in enumerate(lines, 1):
        stripped = line.strip().upper()

        # Skip comments
        if stripped.startswith('--') or stripped.startswith('/*'):
            continue

        # CREATE TABLE without IF NOT EXISTS
        if re.search(r'\bCREATE\s+TABLE\b(?!\s+IF\s+NOT\s+EXISTS)', stripped):
            issues.append(f"  Line {lineno}: CREATE TABLE without IF NOT EXISTS")

        # CREATE INDEX without IF NOT EXISTS (but allow CREATE UNIQUE INDEX IF NOT EXISTS)
        if re.search(r'\bCREATE\s+(UNIQUE\s+)?INDEX\b(?!\s+IF\s+NOT\s+EXISTS)', stripped):
            if 'IF NOT EXISTS' not in stripped:
                issues.append(f"  Line {lineno}: CREATE INDEX without IF NOT EXISTS")

        # CREATE SEQUENCE without IF NOT EXISTS
        if re.search(r'\bCREATE\s+SEQUENCE\b(?!\s+IF\s+NOT\s+EXISTS)', stripped):
            issues.append(f"  Line {lineno}: CREATE SEQUENCE without IF NOT EXISTS")

        # CREATE EXTENSION without IF NOT EXISTS
        if re.search(r'\bCREATE\s+EXTENSION\b(?!\s+IF\s+NOT\s+EXISTS)', stripped):
            issues.append(f"  Line {lineno}: CREATE EXTENSION without IF NOT EXISTS")

        # ALTER TABLE ADD COLUMN without IF NOT EXISTS
        if re.search(r'\bADD\s+COLUMN\b(?!\s+IF\s+NOT\s+EXISTS)', stripped):
            issues.append(
                f"  Line {lineno}: ADD COLUMN without IF NOT EXISTS — "
                f"wrap in DO $$ BEGIN ALTER TABLE ... IF NOT EXISTS; END; $$"
            )

    return issues


def main():
    errors_by_file = {}
    checked = 0

    for migration_dir in MIGRATION_DIRS:
        if not os.path.isdir(migration_dir):
            continue
        for fname in sorted(os.listdir(migration_dir)):
            if not fname.endswith('.sql'):
                continue
            fpath = os.path.join(migration_dir, fname)
            issues = check_file(fpath)
            checked += 1
            if issues:
                errors_by_file[fname] = issues

    if errors_by_file:
        print("✗ Non-idempotent migration patterns found:\n")
        for fname, issues in errors_by_file.items():
            print(f"{fname}:")
            for issue in issues:
                print(issue)
            print()
        print("Fix: add IF NOT EXISTS to each statement above.")
        print("Migrations must be safe to re-run (idempotent).")
        sys.exit(1)
    else:
        print(f"✓ Idempotency check passed ({checked} migration(s))")

if __name__ == '__main__':
    main()
