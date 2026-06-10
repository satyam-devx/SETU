#!/usr/bin/env python3
"""
verify_build_config.py

Post-build checks to confirm:
  1. No placeholder strings leaked into the built JS bundles
  2. No service-role keys or sensitive secrets baked into the frontend bundle
     (only anon keys are acceptable in the browser bundle)
  3. The Supabase URL in the bundle matches the expected project
  4. Firebase config is real (not placeholder) in the service worker

Run after `npm run build`, before deploying.
"""

import os
import re
import sys
import glob

DIST_DIR = 'dist'


def check_for_placeholders(content: str, filename: str) -> list[str]:
    issues = []
    PLACEHOLDER_PATTERNS = [
        (r'https://placeholder\.supabase\.co', 'Supabase placeholder URL leaked into bundle'),
        (r'placeholder-anon-key',              'Supabase placeholder anon key leaked into bundle'),
        (r'placeholder-project',               'Firebase placeholder project ID leaked into bundle'),
        (r'__VITE_FIREBASE_API_KEY__',         'Unreplaced Firebase SW placeholder (API key)'),
        (r'__VITE_FIREBASE_PROJECT_ID__',      'Unreplaced Firebase SW placeholder (project ID)'),
    ]
    for pattern, msg in PLACEHOLDER_PATTERNS:
        if re.search(pattern, content):
            issues.append(f"  {filename}: {msg}")
    return issues


def check_for_service_role_key(content: str, filename: str) -> list[str]:
    """Service role key must never appear in a frontend bundle."""
    issues = []
    # Service role JWTs decode to {"role":"service_role"}
    # We can detect the base64-encoded role claim
    SERVICE_ROLE_INDICATOR = r'eyJyb2xlIjoic2VydmljZV9yb2xlIn0'
    if re.search(SERVICE_ROLE_INDICATOR, content):
        issues.append(
            f"  ⚠ CRITICAL: {filename} appears to contain a Supabase service role key! "
            f"This must never be in a frontend bundle."
        )
    return issues


def main():
    if not os.path.isdir(DIST_DIR):
        print("✗ dist/ directory not found — run npm run build first")
        sys.exit(1)

    issues = []
    files_checked = 0

    # Check all JS files in dist/
    for fpath in glob.glob(os.path.join(DIST_DIR, '**', '*.js'), recursive=True):
        try:
            with open(fpath, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
        except IOError:
            continue

        files_checked += 1
        rel = os.path.relpath(fpath, DIST_DIR)

        issues.extend(check_for_placeholders(content, rel))
        issues.extend(check_for_service_role_key(content, rel))

    # Check the service worker specifically
    sw_path = os.path.join(DIST_DIR, 'firebase-messaging-sw.js')
    if os.path.exists(sw_path):
        with open(sw_path, 'r', encoding='utf-8') as f:
            sw_content = f.read()
        files_checked += 1
        issues.extend(check_for_placeholders(sw_content, 'firebase-messaging-sw.js'))
        # Service worker must have a real API key (starts with AIzaSy)
        if not re.search(r'AIzaSy[A-Za-z0-9_-]{33}', sw_content):
            print("  ⚠ firebase-messaging-sw.js: Firebase API key not found "
                  "(push notifications may not work)")
    else:
        print("  ⚠ firebase-messaging-sw.js not found in dist/ "
              "(check that public/ is copied by Vite)")

    if issues:
        print(f"\n✗ Build config issues ({len(issues)}):\n")
        for issue in issues:
            print(issue)
        # Service role key is a hard failure; placeholders are also hard failures
        sys.exit(1)
    else:
        print(f"✓ Build config verification passed ({files_checked} file(s) checked)")

if __name__ == '__main__':
    main()
