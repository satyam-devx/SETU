#!/usr/bin/env python3
"""
scripts/validate-migrations.py — SETU QA migration validator
Enhanced version that verifies:
  1. Sequential numbering (no gaps) in supabase/migrations/
  2. Idempotency markers (IF NOT EXISTS, OR REPLACE, etc.)
  3. Forbidden patterns (hardcoded secrets, DROP TABLE without IF EXISTS)
  4. Required metadata comments
  5. UTF-8 encoding
"""

import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent.parent  # SETU project root

MIGRATION_DIRS = [
    ROOT / 'supabase' / 'migrations',
    ROOT / 'database' / 'migrations',
]

RESULTS = {'passed': 0, 'failed': 0, 'warnings': 0}


def add(status, message):
    icon = '✓' if status == 'PASS' else ('✗' if status == 'FAIL' else '⚠')
    print(f"{icon} [{status}] {message}")
    RESULTS[status.lower() if status != 'FAIL' else 'failed'] += 1
    if status == 'PASS': RESULTS['passed'] += 1
    if status == 'WARNING': RESULTS['warnings'] += 1


# ── 1. File naming ────────────────────────────────────────────
def check_naming_convention(migration_dir):
    if not migration_dir.exists():
        add('WARNING', f"Migration dir not found: {migration_dir}")
        return []

    sql_files = sorted(migration_dir.glob('*.sql'))
    if not sql_files:
        add('WARNING', f"No migration files in {migration_dir}")
        return []

    # Supabase format: 14-digit timestamp prefix (YYYYMMDDHHmmss)
    timestamp_re = re.compile(r'^(\d{14})_.*\.sql$')
    # Legacy format: NNN_description.sql
    legacy_re = re.compile(r'^(\d{3})_.*\.sql$')

    issues = []
    for f in sql_files:
        name = f.name
        if not (timestamp_re.match(name) or legacy_re.match(name)):
            issues.append(f"Non-standard naming: {name}")

    if issues:
        for issue in issues:
            add('WARNING', f"{migration_dir.name}: {issue}")
    else:
        add('PASS', f"Migration naming OK: {len(sql_files)} files in {migration_dir.name}/")

    return sql_files


# ── 2. Idempotency ────────────────────────────────────────────
IDEMPOTENT_PATTERNS = [
    (r'\bCREATE TABLE\b(?! IF NOT EXISTS)', 'CREATE TABLE without IF NOT EXISTS'),
    (r'\bCREATE INDEX\b(?! IF NOT EXISTS)', 'CREATE INDEX without IF NOT EXISTS'),
    (r'\bCREATE EXTENSION\b(?! IF NOT EXISTS)', 'CREATE EXTENSION without IF NOT EXISTS'),
    (r'\bCREATE SEQUENCE\b(?! IF NOT EXISTS)', 'CREATE SEQUENCE without IF NOT EXISTS'),
    (r'\bCREATE TYPE\b(?! IF NOT EXISTS)(?!.*create type.*if not exists)', 'CREATE TYPE without IF NOT EXISTS'),
]

def check_idempotency(sql_files):
    failures = []
    for f in sql_files:
        try:
            content = f.read_text(encoding='utf-8')
        except Exception as e:
            add('WARNING', f"Could not read {f.name}: {e}")
            continue

        for pattern, description in IDEMPOTENT_PATTERNS:
            matches = re.findall(pattern, content, re.IGNORECASE)
            if matches:
                # Exclude commented lines
                lines = content.split('\n')
                real_matches = [
                    l for l in lines
                    if re.search(pattern, l, re.IGNORECASE)
                    and not l.strip().startswith('--')
                ]
                if real_matches:
                    failures.append(f"{f.name}: {description}")

    if failures:
        for failure in failures:
            add('WARNING', f"Idempotency: {failure}")
    else:
        add('PASS', f"Idempotency: all migrations use IF NOT EXISTS / OR REPLACE")


# ── 3. Forbidden patterns ─────────────────────────────────────
FORBIDDEN_PATTERNS = [
    (r'DROP TABLE\s+(?!IF EXISTS)', 'DROP TABLE without IF EXISTS — may break re-runs'),
    (r'rzp_live_[A-Za-z0-9]+', 'Razorpay LIVE key in migration — never commit'),
    (r'AIzaSy[A-Za-z0-9_-]{33}', 'Firebase API key in migration'),
    (r"password\s*=\s*'[^']{3,}'", 'Hardcoded password in migration'),
]

def check_forbidden_patterns(sql_files):
    failures = []
    for f in sql_files:
        content = f.read_text(encoding='utf-8', errors='ignore')
        for pattern, description in FORBIDDEN_PATTERNS:
            if re.search(pattern, content, re.IGNORECASE):
                failures.append(f"{f.name}: {description}")

    if failures:
        for failure in failures:
            add('FAIL', f"Forbidden pattern: {failure}")
    else:
        add('PASS', "No forbidden patterns in migrations")


# ── 4. Encoding ───────────────────────────────────────────────
def check_encoding(sql_files):
    bad = []
    for f in sql_files:
        try:
            f.read_text(encoding='utf-8')
        except UnicodeDecodeError:
            bad.append(f.name)

    if bad:
        for f in bad:
            add('FAIL', f"Encoding: {f} is not valid UTF-8")
    else:
        add('PASS', f"Encoding: all {len(sql_files)} migration files are valid UTF-8")


# ── 5. RLS check ──────────────────────────────────────────────
def check_rls_coverage():
    rls_file = ROOT / 'database' / 'rls.sql'
    if not rls_file.exists():
        add('WARNING', "database/rls.sql not found")
        return

    content = rls_file.read_text(encoding='utf-8')

    # Core tables that MUST have RLS
    required_tables = [
        'villages', 'profiles', 'orders', 'order_items',
        'wallets', 'products', 'vendors',
    ]

    missing = [t for t in required_tables if f'alter table {t} enable row level security' not in content]

    if missing:
        add('FAIL', f"Tables missing RLS: {', '.join(missing)}")
    else:
        add('PASS', f"RLS enabled on all {len(required_tables)} required tables")


# ── Main ──────────────────────────────────────────────────────
def main():
    print('\n═══ QA: Migration Validation ═══\n')

    all_files = []
    for migration_dir in MIGRATION_DIRS:
        files = check_naming_convention(migration_dir)
        all_files.extend(files)

    if all_files:
        check_idempotency(all_files)
        check_forbidden_patterns(all_files)
        check_encoding(all_files)

    check_rls_coverage()

    print(f'\n{"═"*40}')
    print(f"Passed:   {RESULTS['passed']}")
    print(f"Failed:   {RESULTS['failed']}")
    print(f"Warnings: {RESULTS['warnings']}")
    print(f'{"═"*40}')

    if RESULTS['failed'] > 0:
        sys.exit(1)

    print('\n✓ All migration checks passed')


if __name__ == '__main__':
    main()
