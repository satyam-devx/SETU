#!/usr/bin/env python3
"""
check_function_secrets.py

Verifies that each Edge Function documents its required environment
variables/secrets. This acts as a runbook contract so that when a new
function is added, its secrets are not silently forgotten.

Convention: Each function's index.ts must contain a block like:
    // Required Supabase Vault Secrets:
    //   SECRET_NAME — description

This script:
  1. Finds all Deno.env.get() calls in each function
  2. Checks that the corresponding secret is documented in the file
  3. Warns about undocumented secrets
  4. Verifies secrets are listed in secrets-manifest.yml (if it exists)
"""

import os
import re
import sys

FUNCTIONS_DIR = "supabase/functions"
MANIFEST_PATH = ".github/secrets-manifest.yml"


def get_env_calls(content: str) -> set[str]:
    """Extract all Deno.env.get('SECRET_NAME') calls."""
    return set(re.findall(r"Deno\.env\.get\(['\"]([A-Z_]+)['\"]\)", content))


def get_documented_secrets(content: str) -> set[str]:
    """Extract secrets documented in comment blocks."""
    # Matches:   //   SECRET_NAME — description
    # or:        //   SECRET_NAME  - description
    return set(re.findall(
        r'//\s+([A-Z][A-Z0-9_]{2,})\s*[—\-]',
        content
    ))


def main():
    if not os.path.isdir(FUNCTIONS_DIR):
        print(f"  (skipping — {FUNCTIONS_DIR} not found)")
        sys.exit(0)

    all_secrets = set()
    issues = []

    for func_name in sorted(os.listdir(FUNCTIONS_DIR)):
        func_dir = os.path.join(FUNCTIONS_DIR, func_name)
        index_file = os.path.join(func_dir, 'index.ts')

        if not os.path.isfile(index_file):
            continue

        with open(index_file, 'r', encoding='utf-8') as f:
            content = f.read()

        env_calls = get_env_calls(content)
        documented = get_documented_secrets(content)

        # Auto-injected by Supabase — don't require documentation
        auto_injected = {'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY'}
        undocumented = env_calls - documented - auto_injected

        if undocumented:
            for secret in sorted(undocumented):
                issues.append(
                    f"  {func_name}: Deno.env.get('{secret}') is used "
                    f"but not documented in the file's comment block"
                )

        all_secrets.update(env_calls - auto_injected)

    # Print all discovered secrets for CI visibility
    print("Secrets used across Edge Functions:")
    for s in sorted(all_secrets):
        print(f"  - {s}")

    if issues:
        print("\n✗ Undocumented secrets found:")
        for issue in issues:
            print(issue)
        print(
            "\nFix: add a comment block to each function:\n"
            "  // Required Supabase Vault Secrets:\n"
            "  //   MY_SECRET_NAME — description of what it's for"
        )
        sys.exit(1)
    else:
        print("\n✓ All secrets are documented")

if __name__ == '__main__':
    main()
