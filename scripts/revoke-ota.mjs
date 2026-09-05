#!/usr/bin/env node
// scripts/revoke-ota.mjs — remotely kill a bad OTA release.
//
// Marks a published `app_updates` row as revoked. Any device that
// hasn't activated it yet will stop being offered it (checkForUpdate
// filters revoked rows out); any device already running it will roll
// itself back to its last known-good bundle the next time the app is
// foregrounded (checkForRevocation), no reinstall or manual action
// needed on the device.
//
// Usage:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/revoke-ota.mjs <version>
//
// <version> must match the exact `version` string printed by
// release-ota.mjs when that release was published.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const version = process.argv[2];
const PLATFORM = process.env.OTA_PLATFORM || 'android';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your shell first.');
  process.exit(1);
}

if (!version) {
  console.error('❌ Usage: node scripts/revoke-ota.mjs <version>');
  console.error('   (the exact version string printed when it was published)');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const { data, error } = await supabase
  .from('app_updates')
  .update({ revoked: true, is_active: false, revoked_at: new Date().toISOString() })
  .eq('platform', PLATFORM)
  .eq('version', version)
  .select('version');

if (error) {
  console.error('❌ Revoke failed:', error.message);
  process.exit(1);
}

if (!data || data.length === 0) {
  console.error(`❌ No ${PLATFORM} release found with version "${version}" — nothing changed.`);
  process.exit(1);
}

console.log(`\n✅ Revoked ${PLATFORM} release ${version}`);
console.log('   Devices not yet on it will never be offered it.');
console.log('   Devices already on it will roll back automatically next time the app is foregrounded.\n');
