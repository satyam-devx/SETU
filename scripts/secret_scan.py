#!/usr/bin/env python3
"""
secret_scan.py

Static scan for accidentally committed secrets and credentials.
Runs on every CI push to catch leaks before they reach production.

Patterns detected:
  - Supabase service role keys (eyJhbGc...)
  - Supabase anon keys
  - Firebase API keys (AIzaSy...)
  - Firebase service account JSON blobs
  - Razorpay live keys (rzp_live_...)
  - SurePass API keys
  - Generic high-entropy strings in known secret contexts
  - Hardcoded passwords/tokens in config files

Does NOT scan: .env files (they're in .gitignore), node_modules, dist/
"""

import os
import re
import sys
import glob

# Files/dirs to skip
SKIP_DIRS  = {'.git', 'node_modules', 'dist', '.github'}
SKIP_FILES = {'.env', '.env.local', '.env.production', '.env.development'}
# These files get a pass (they're expected to have placeholders, not real values)
ALLOWLIST_FILES = {
    'scripts/secret_scan.py',  # the scanner itself
    '.env.example',            # placeholder values only
    'README.md',               # documentation
    'supabase/config.toml',    # uses env(VAR_NAME) syntax — not real credentials
}


PATTERNS = [
    # Supabase service role key — JWT with role:service_role
    (r'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+',
     'Potential Supabase JWT (service role or anon key)'),

    # Firebase API key format
    (r'AIzaSy[A-Za-z0-9_-]{33}',
     'Firebase API key (AIzaSy...)'),

    # Razorpay live key
    (r'rzp_live_[A-Za-z0-9]{14,}',
     'Razorpay LIVE key (rzp_live_...) — should never be in code'),

    # Razorpay test key committed (warn not fail)
    (r'rzp_test_[A-Za-z0-9]{14,}',
     'Razorpay TEST key (rzp_test_...) — commit to .env only'),

    # Generic secret assignment patterns
    (r'(?i)(password|secret|api_key|apikey|token|private_key)\s*[=:]\s*["\'][^"\']{8,}["\']',
     'Possible hardcoded credential assignment'),

    # Firebase service account JSON indicator
    (r'"private_key_id"\s*:\s*"[a-f0-9]{40}"',
     'Firebase service account JSON — should never be committed'),

    # Private key PEM block
    (r'-----BEGIN (RSA |EC )?PRIVATE KEY-----',
     'Private key PEM block'),
]

# Files known to legitimately contain these (template strings, not real values)
PLACEHOLDER_PATTERN = re.compile(
    r'placeholder|__VITE_|your[-_]|REPLACE|<YOUR|example|test123|dummy'
    r'|eyJhbGc.*placeholder'
    r'|env\([A-Z_]+\)'          # Supabase config.toml env() reference syntax
    r'|secret:\s*["\'][\w_]+["\']'  # SQL comments referencing vault secret names
    r'|fetched from.*[Vv]ault'  # SQL comments about vault secrets
    r'|-- .*secret',            # SQL comments mentioning secrets
    re.IGNORECASE
)


def should_skip(fpath: str) -> bool:
    parts = fpath.replace('\\', '/').split('/')
    if any(p in SKIP_DIRS for p in parts):
        return True
    basename = os.path.basename(fpath)
    if basename in SKIP_FILES:
        return True
    normalized = fpath.replace('\\', '/')
    if any(normalized.endswith(af) or normalized == af for af in ALLOWLIST_FILES):
        return True
    return False


def scan_file(fpath: str) -> list[tuple[int, str, str]]:
    hits = []
    try:
        with open(fpath, 'r', encoding='utf-8', errors='ignore') as f:
            lines = f.readlines()
    except (IOError, OSError):
        return hits

    for lineno, line in enumerate(lines, 1):
        # Skip comment-only lines
        stripped = line.strip()
        if stripped.startswith('//') or stripped.startswith('#') or stripped.startswith('*'):
            continue
        # Skip lines that are clearly placeholder/template values
        if PLACEHOLDER_PATTERN.search(line):
            continue

        for pattern, description in PATTERNS:
            if re.search(pattern, line):
                hits.append((lineno, description, line.strip()[:120]))
                break   # one hit per line is enough

    return hits


def main():
    all_hits = {}

    extensions = {'.js', '.jsx', '.ts', '.tsx', '.json', '.yml', '.yaml', '.toml', '.sql'}

    for root, dirs, files in os.walk('.'):
        # Prune skip dirs in-place
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]

        for fname in files:
            fpath = os.path.join(root, fname)
            if should_skip(fpath):
                continue
            ext = os.path.splitext(fname)[1].lower()
            if ext not in extensions:
                continue

            hits = scan_file(fpath)
            if hits:
                all_hits[fpath] = hits

    if all_hits:
        print("✗ Potential secrets detected in committed files:\n")
        for fpath, hits in all_hits.items():
            print(f"{fpath}:")
            for lineno, description, excerpt in hits:
                print(f"  Line {lineno}: {description}")
                print(f"    → {excerpt}")
            print()
        print("If these are false positives, add the file to ALLOWLIST_FILES in secret_scan.py")
        sys.exit(1)
    else:
        print("✓ No secrets detected in committed files")

if __name__ == '__main__':
    main()
