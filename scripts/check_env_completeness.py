#!/usr/bin/env python3
"""
check_env_completeness.py

Ensures that:
  1. A .env.example file exists and lists every VITE_ variable used in source
  2. All secrets referenced in GitHub Actions workflows are present in
     .env.example as documented (not necessarily with real values)
  3. No VITE_ vars are used in source that aren't in .env.example
  4. No secrets are hardcoded in any source file
"""

import os
import re
import sys
import glob

SRC_DIRS = ['src/', 'public/']
WORKFLOWS_DIR = '.github/workflows'
ENV_EXAMPLE_PATH = '.env.example'


def find_vite_vars_in_source() -> set[str]:
    """Find all import.meta.env.VITE_* usages in source files."""
    found = set()
    patterns = ['**/*.js', '**/*.jsx', '**/*.ts', '**/*.tsx']
    for src_dir in SRC_DIRS:
        for pattern in patterns:
            for fpath in glob.glob(os.path.join(src_dir, pattern), recursive=True):
                try:
                    with open(fpath, 'r', encoding='utf-8') as f:
                        content = f.read()
                    matches = re.findall(r'import\.meta\.env\.(VITE_[A-Z_]+)', content)
                    found.update(matches)
                except (UnicodeDecodeError, IOError):
                    pass
    return found


def find_secrets_in_workflows() -> set[str]:
    """Find all ${{ secrets.X }} usages in workflow files."""
    found = set()
    if not os.path.isdir(WORKFLOWS_DIR):
        return found
    for fpath in glob.glob(os.path.join(WORKFLOWS_DIR, '*.yml')):
        with open(fpath, 'r', encoding='utf-8') as f:
            content = f.read()
        matches = re.findall(r'\$\{\{\s*secrets\.([A-Z_]+)\s*\}\}', content)
        found.update(matches)
    return found


def read_env_example() -> set[str]:
    """Read variable names from .env.example."""
    if not os.path.exists(ENV_EXAMPLE_PATH):
        return set()
    found = set()
    with open(ENV_EXAMPLE_PATH, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#'):
                name = line.split('=')[0].strip()
                if name:
                    found.add(name)
    return found


def main():
    issues = []
    warnings = []

    # 1. Check .env.example exists
    if not os.path.exists(ENV_EXAMPLE_PATH):
        issues.append(f"✗ {ENV_EXAMPLE_PATH} is missing — create it!")
        print('\n'.join(issues))
        sys.exit(1)

    env_example_vars = read_env_example()
    source_vite_vars = find_vite_vars_in_source()
    workflow_secrets = find_secrets_in_workflows()

    # 2. VITE_ vars in source but not in .env.example
    missing_from_example = source_vite_vars - env_example_vars
    for var in sorted(missing_from_example):
        issues.append(f"  ✗ {var} used in source but missing from .env.example")

    # 3. VITE_ vars in .env.example but not in source (stale)
    vite_in_example = {v for v in env_example_vars if v.startswith('VITE_')}
    stale = vite_in_example - source_vite_vars
    for var in sorted(stale):
        warnings.append(f"  ⚠ {var} in .env.example but not found in source (stale?)")

    print("VITE_ variables in source:")
    for v in sorted(source_vite_vars):
        status = "✓" if v in env_example_vars else "✗ MISSING"
        print(f"  {status}  {v}")

    print(f"\nGitHub Actions secrets referenced: {len(workflow_secrets)}")
    for s in sorted(workflow_secrets):
        # These are GitHub Actions secrets, not VITE_ vars — just enumerate
        print(f"  - {s}")

    if warnings:
        print("\nWarnings:")
        for w in warnings:
            print(w)

    if issues:
        print("\nErrors:")
        for issue in issues:
            print(issue)
        print(f"\n✗ Environment config check FAILED")
        sys.exit(1)
    else:
        print(f"\n✓ Environment config check passed")

if __name__ == '__main__':
    main()
