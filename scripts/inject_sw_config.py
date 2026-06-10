#!/usr/bin/env python3
"""
inject_sw_config.py

Injects real Firebase config values into public/firebase-messaging-sw.js
at build time.

WHY THIS IS NEEDED:
Service workers execute in a separate context and cannot access Vite's
import.meta.env. The service worker file uses placeholder strings like
'__VITE_FIREBASE_API_KEY__' which this script replaces with real values
from environment variables before the Vite build copies the file to dist/.

The result: FCM background notifications work correctly in production
without hardcoding any credentials in the repository.

Usage:
  python3 scripts/inject_sw_config.py
  (run before `npm run build`)
"""

import os
import sys

SW_SOURCE = 'public/firebase-messaging-sw.js'
SW_TEMP   = 'public/firebase-messaging-sw.js'  # edit in-place during build


REPLACEMENTS = {
    '__VITE_FIREBASE_API_KEY__':             'VITE_FIREBASE_API_KEY',
    '__VITE_FIREBASE_AUTH_DOMAIN__':         'VITE_FIREBASE_AUTH_DOMAIN',
    '__VITE_FIREBASE_PROJECT_ID__':          'VITE_FIREBASE_PROJECT_ID',
    '__VITE_FIREBASE_STORAGE_BUCKET__':      'VITE_FIREBASE_STORAGE_BUCKET',
    '__VITE_FIREBASE_MESSAGING_SENDER_ID__': 'VITE_FIREBASE_MESSAGING_SENDER_ID',
    '__VITE_FIREBASE_APP_ID__':              'VITE_FIREBASE_APP_ID',
}


def main():
    missing = []
    values  = {}

    for placeholder, env_var in REPLACEMENTS.items():
        val = os.environ.get(env_var, '')
        if not val:
            missing.append(env_var)
        values[placeholder] = val

    if missing:
        print(f"⚠  Missing Firebase env vars for service worker injection:")
        for m in missing:
            print(f"   {m}")
        print("   Service worker will use placeholder values (push notifications may not work)")
        # Don't fail — allows builds without Firebase configured
        return

    with open(SW_SOURCE, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content
    for placeholder, real_value in values.items():
        content = content.replace(placeholder, real_value)

    if content == original:
        # Placeholders were already replaced or not present (e.g. using __FIREBASE_CONFIG__ object)
        print("  (service worker already uses __FIREBASE_CONFIG__ object injection — no replacements needed)")
        return

    with open(SW_TEMP, 'w', encoding='utf-8') as f:
        f.write(content)

    replaced = sum(1 for p in values if p in original)
    print(f"✓ Service worker config injected ({replaced} placeholder(s) replaced)")
    print("  Remember: dist/firebase-messaging-sw.js contains real API keys — keep dist/ in .gitignore")


if __name__ == '__main__':
    main()
