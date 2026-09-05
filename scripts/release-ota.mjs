#!/usr/bin/env node
// scripts/release-ota.mjs — publish a new OTA (over-the-air) update for the
// Android app: builds the web bundle with the correct (native) base path,
// zips it, uploads it to Supabase Storage, and inserts a row into
// `app_updates` so the app picks it up on next launch/foreground.
//
// Usage:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/release-ota.mjs [notes]
//
// Requires the SERVICE ROLE key (not the anon key) — app_updates writes are
// locked to service_role via RLS (see migration 20240101000062). Get it from
// Supabase Dashboard → Project Settings → API. Never commit this key or put
// it in a client-side .env — export it in your shell for this one command.
//
// This does NOT touch the native shell (Java/Gradle/AndroidManifest) — only
// the web bundle (HTML/CSS/JS) changes ship this way. A change to a native
// plugin, permission, or app icon still needs a normal APK rebuild + reinstall
// (see .github/workflows/build-android.yml).

import { execSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import AdmZip from 'adm-zip';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT, 'dist');
const ZIP_PATH = path.join(ROOT, 'dist.zip');
const BUCKET = 'app-updates';
const PLATFORM = 'android';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const notes = process.argv[2] || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your shell first.');
  console.error('   (Dashboard → Project Settings → API → service_role key)');
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const version = `${pkg.version}-${Date.now()}`; // unique per release, even for the same package.json version

console.log(`\n▶ Building web bundle for native (VITE_BASE_PATH=/)...`);
execSync('npx cross-env VITE_BASE_PATH=/ vite build', { cwd: ROOT, stdio: 'inherit' });

if (!fs.existsSync(DIST_DIR)) {
  console.error('❌ dist/ not found after build — aborting.');
  process.exit(1);
}

console.log(`▶ Zipping dist/ → dist.zip`);
const zip = new AdmZip();
zip.addLocalFolder(DIST_DIR);
zip.writeZip(ZIP_PATH);

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const storagePath = `${PLATFORM}/${version}.zip`;

console.log(`▶ Uploading to Supabase Storage: ${BUCKET}/${storagePath}`);
const fileBuffer = fs.readFileSync(ZIP_PATH);
const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');
console.log(`▶ SHA-256: ${checksum}`);

const { error: uploadError } = await supabase.storage
  .from(BUCKET)
  .upload(storagePath, fileBuffer, { contentType: 'application/zip', upsert: false });

if (uploadError) {
  console.error('❌ Upload failed:', uploadError.message);
  process.exit(1);
}

const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
const bundleUrl = publicUrlData.publicUrl;

console.log(`▶ Deactivating previous ${PLATFORM} releases...`);
await supabase.from('app_updates').update({ is_active: false }).eq('platform', PLATFORM).eq('is_active', true);

console.log(`▶ Publishing app_updates row (version ${version})...`);
const { error: insertError } = await supabase
  .from('app_updates')
  .insert({ platform: PLATFORM, version, bundle_url: bundleUrl, checksum, notes, is_active: true, revoked: false });

if (insertError) {
  console.error('❌ Failed to publish update row:', insertError.message);
  process.exit(1);
}

fs.unlinkSync(ZIP_PATH);

console.log(`\n✅ Published ${PLATFORM} OTA update ${version}`);
console.log(`   ${bundleUrl}`);
console.log(`\nDevices with the app open will offer this update on next launch/foreground.\n`);
