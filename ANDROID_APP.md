# SETU Android App + In-App Updater

Two separate systems, don't confuse them:

1. **The APK** (native shell) — built by GitHub Actions, only needs rebuilding
   when something *native* changes (a Capacitor plugin, an Android
   permission, the app icon).
2. **The OTA updater** (JS/CSS/HTML) — `npm run release:ota` pushes a new
   web bundle straight to installed apps, **no APK rebuild, no reinstall**.
   This is the "in-app update option" you asked for.

Everything below that touches the database/storage already ships itself —
migration `20240101000062_app_updates_ota.sql` creates the `app_updates`
table *and* the `app-updates` Storage bucket, and your existing
`deploy.yml` applies it automatically on the next push to `main`. Nothing
manual needed there.

## One-time setup (do this once)

1. **Push this to GitHub as normal.** `deploy.yml` applies the new
   migration automatically.

2. **Install the new dependencies** — this needs `npm install` with
   internet access, which I can't run from here. On your machine (or let
   CI do it — see step 3):
   ```
   npm install
   ```

3. **Build the first APK.** GitHub → your repo → **Actions** tab →
   **"Build Android APK"** → **Run workflow**. It installs everything,
   generates the native Android project fresh (`npx cap add android`),
   builds a debug APK, and uploads it as a downloadable artifact on that
   run's summary page. Download it, copy to your phone, enable
   **"Install unknown apps"** for your file manager/browser, install.

   That's your first real APK — no Android Studio, no Termux Gradle setup.

## Shipping a JS-only change (the "in-app updater")

Once the app is installed, for any change that's *just* React/CSS/logic
(which is nearly everything you'll do day-to-day):

```
SUPABASE_URL=https://xxxx.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=eyJ...   \
npm run release:ota "fixed the coupon bug, added dark mode toggle"
```

(Service role key — **not** the anon key — from Supabase Dashboard →
Project Settings → API. Export it in your shell for just this one
command; never commit it.)

This builds `dist/`, zips it, uploads it to the `app-updates` Storage
bucket, and publishes a row in `app_updates`. Every installed app checks
that table on launch and whenever it comes back to the foreground
(`AppUpdateBanner.jsx`) — if there's a newer bundle than the one it's
running, it shows a small "A new update is ready" card at the bottom with
an **Update now** button. Tap it → downloads → app reloads on the new
code. No Play Store, no reinstall, no waiting.

## When you *do* need a new APK

Only for native-shell changes — a new Capacitor plugin, a new Android
permission, the app icon/splash. Re-run the same **"Build Android APK"**
Action. Day-to-day feature work almost never needs this.

## If a release turns out to be bad

The updater is self-healing for most failure modes automatically (see
"Rollback & safety" below), but if you spot a bad release yourself:

```
SUPABASE_URL=https://xxxx.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=eyJ...   \
npm run revoke:ota -- v1.0.0-1234567890
```

(the exact version string `release-ota.mjs` printed when it was published —
`npm run` needs `--` before script args). Devices not yet on that version
will never be offered it again; devices already running it roll themselves
back automatically next time the app is foregrounded — no manual device
action needed.

## Rollback & safety

A bad OTA update can never permanently brick the app or trap a device on
a broken bundle — this is enforced in layers, from the plugin's own
native safety net up to our application-level checks:

1. **Every download is integrity-checked before activation.** `release-ota.mjs`
   computes a SHA-256 checksum of the bundle zip and stores it; the device
   passes that checksum to the plugin's `download()` call, which verifies
   it natively before the bundle is ever considered valid. A corrupted or
   incomplete download simply fails — nothing broken gets activated.
2. **A short post-boot health check gates confirmation.** Right after
   activating a new bundle, `confirmHealthyBoot()` runs a bounded check
   before telling the plugin "this one's good". Fail it (or take too
   long), and the app explicitly rolls back to the *exact* bundle that
   was running before the update — captured at download time, not
   guessed — and that version is permanently blocked on that device.
3. **The plugin's own native timeout is the backstop.** If a bundle is so
   broken its JS never runs at all, the plugin rolls back on its own
   after `appReadyTimeout` (`capacitor.config.json`) even if our JS-level
   check above never got the chance to run.
4. **A revoked release rolls back devices already running it**, not just
   new ones — `checkForRevocation()` runs on every foreground.
5. **Nothing loops.** A version that fails its health check, exceeds
   download retry attempts, or gets revoked is blocklisted on-device —
   it's never re-offered or re-attempted, even if the server still lists
   it as the latest release.
6. **The ultimate floor is the bundle shipped inside the APK itself** —
   if there's no known-good OTA bundle to fall back to (or falling back
   to it also fails), the app resets to the builtin bundle, which by
   definition was never touched by any OTA and always exists.

This is entirely separate from APK-level rollback (reinstalling an older
APK) — it only ever moves between JS/CSS/HTML bundles on the same
install. See `src/lib/appUpdater.js` for the implementation and
`qa/tests/unit/app-updater.test.js` for the scenarios this covers
(successful update, failed/interrupted/corrupted download, startup
failure + rollback, loop prevention, revoked release).

## What's still missing (being upfront about this)

- **Google Sign-In inside the native app isn't wired up.** It works fine
  on the web build; inside a Capacitor WebView, OAuth needs a native
  deep-link redirect (`@capacitor/app`'s `appUrlOpen` + a custom URL
  scheme) that I haven't built yet. Phone/OTP login (your primary flow
  already) works as-is with no changes needed.
- **No custom app icon/splash asset yet** — ships with Capacitor's default
  icon. Once you've got a square PNG logo, `npx @capacitor/assets generate`
  does this in one command — happy to wire that into the build workflow
  next.
- **Debug APK only.** Fine for you/testers installing directly. A Play
  Store submission needs a signed *release* build — the workflow has a
  comment stub for this (needs a keystore + 4 GitHub secrets) whenever
  you're ready for that step.
- **iOS not touched** — Android only, per what you asked for.

## Files this added

| File | What it does |
|---|---|
| `capacitor.config.json` | App ID, name, and OTA plugin config |
| `.github/workflows/build-android.yml` | Builds the APK on demand / on version tags |
| `scripts/release-ota.mjs` | `npm run release:ota` — publishes a JS-only update |
| `supabase/migrations/20240101000062_app_updates_ota.sql` | `app_updates` table + `app-updates` Storage bucket + RLS |
| `supabase/migrations/20240101000063_app_updates_hardening.sql` | Adds `checksum` + `revoked` columns for rollback/kill-switch |
| `src/lib/appUpdater.js` | Native-only: checks for, downloads, validates, activates, and rolls back updates |
| `scripts/revoke-ota.mjs` | `npm run revoke:ota` — remotely kills a bad release |
| `qa/tests/unit/app-updater.test.js` | Update/rollback/revocation scenario coverage |
| `src/components/shared/AppUpdateBanner.jsx` | The "Update now" card |
| `.gitignore` | `android/` excluded — CI regenerates it fresh every build |
