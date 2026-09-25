# F9 — Mobile / Android Engineering

## Scope

F9 hardens the Capacitor Android shell so SETU behaves as a mobile application rather than a web page inside a wrapper.

## WebView

- Native shell patch sets the WebView background before the first React frame, removing the splash-to-white seam.
- WebSettings explicitly enable DOM storage/database support and use `LOAD_DEFAULT` cache semantics.
- Zoom controls are disabled because SETU owns responsive layout.
- No destructive `WebView.reload()` or `clearCache()` is used for lifecycle changes.
- React lifecycle is coordinated through `useAppLifecycle` and the centralized `mobile-runtime` bootstrap.
- The Vite entry remains code-split; Firebase and native-only modules are lazy-loaded.

## Capacitor startup

Startup order is now: native shell → native splash → WebView background → React boot → OTA health confirmation/runtime initialization → application UI. The existing React splash waits for real readiness milestones and hides the native splash only after its content is paint-ready.

## Splash

- `launchAutoHide: false` remains intentional.
- Native and React splash backgrounds match.
- AVIF/WebP splash assets are available with original fallbacks.
- The React splash uses `assetUrl()` so GitHub Pages/custom-domain paths are not hard-coded to `/`.

## Memory

- Realtime, GPS and timers are lifecycle-cleaned.
- Rider GPS stops in background/offline states.
- Realtime channels are centrally released and reconnect safely.
- The native Activity does not clear WebView cache or reload under memory pressure; Android/Chromium retains ownership of renderer reclamation.
- Native `onTrimMemory()` is handled without clearing the WebView cache or forcing a reload; Android/Chromium retains renderer-memory ownership.

## GPS

F6 already provides the runtime policy:
- active delivery: high accuracy, 5s maximum age, 10s/15m publish budget
- online idle: lower-power accuracy, 30s maximum age, 30s/40m publish budget
- background/offline/manual offline: watch stopped
- latest point is coalesced in memory rather than writing every callback

## Push

The current push implementation uses Firebase Web Messaging and a service worker. Token registration is lazy and only occurs after explicit notification permission. Service-worker registration now respects the Vite base path.

**Native push plugin gap:** `@capacitor/push-notifications` is not installed in this workspace. Therefore F9 does not falsely claim native FCM/Android push parity. A future native-push subphase should add that plugin, request Android notification permission, register the native token, persist token/device metadata, and route notification taps through the same navigation contract.

## Background/resume

- `useAppLifecycle` listens to browser visibility, page show/hide, and Capacitor `appStateChange`.
- Realtime domains use the same active-state boundary.
- GPS uses the same boundary.
- Network recovery is centralized.
- App URL/back-button events are surfaced by `mobile-runtime` without forcing page reloads.

## Asset/path correctness

- Service-worker URL/scope use `import.meta.env.BASE_URL`.
- React splash assets use `assetUrl()`.
- Native Android builds continue to force `VITE_BASE_PATH=/`.
- GitHub Pages builds retain `/SETU/`.

## Validation

- JavaScript syntax checks must pass for the F9 source changes.
- Android native source is generated in CI by `npx cap add android`, then patched by `scripts/patch-android-native.mjs`.
- The local workspace does not contain the generated `android/` directory because it is intentionally gitignored; native verification therefore belongs in the Android CI job.
- Full APK build/runtime remains an environment-dependent verification step and must not be reported green without an actual Gradle build/install test.
