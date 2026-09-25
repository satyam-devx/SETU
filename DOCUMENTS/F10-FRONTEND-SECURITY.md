# SETU — F10 Frontend Security

## Objective
Treat the frontend as an untrusted execution environment. UI restrictions are usability controls only; authorization, ownership, payment, role changes, and storage access remain server-side/RLS boundaries.

## URL sanitization
- `src/lib/url-security.js` centralizes external, internal, and telephone navigation checks.
- External navigation permits only `http:` and `https:` schemes and strips ASCII control characters.
- Internal redirects must resolve to the current origin and a local path.
- Post-login redirect state is sanitized before entering or leaving `sessionStorage`.
- Customer banner links now use the centralized external/internal checks.
- Existing scheme links already use the same security helper.
- OAuth callback continues to let Supabase process the auth hash; arbitrary callback navigation is not accepted as an external URL.

## Storage
- Supabase Auth persists its session through the Supabase client storage adapter; the application does not manually store access/refresh tokens.
- `sessionStorage` is limited to short-lived navigation/OTP UI state.
- `localStorage` is used for non-secret preferences, feature-flag cache, OTA rollback metadata, test/demo switches, and the explicitly safe offline mutation queue.
- No IndexedDB application credential store is introduced.
- Sensitive server data is not intentionally copied into persistent browser storage by F10.
- Offline mutation queue remains restricted to mutations whose server contract explicitly supports safe replay; financial operations are not blindly queued.

## CSP
`index.html` now ships a baseline Content-Security-Policy:
- `default-src 'self'`
- `script-src 'self'`
- `object-src 'none'`
- `base-uri 'self'`
- `frame-ancestors 'self'`
- controlled `connect-src` for HTTPS/WSS APIs
- `img-src` supports first-party, data/blob previews, and remote HTTPS media
- workers remain limited to same-origin/blob contexts
- `form-action` is restricted to the app and Supabase auth origin

This policy is intentionally compatible with Supabase, Firebase, Mapbox, remote media, and Capacitor/WebView usage. Server response headers remain preferable where the hosting platform supports them.

## Auth lifecycle
- Supabase `autoRefreshToken` remains enabled.
- Auth state is centralized in `AuthContext`.
- Sign-out clears profile state and the application query/fetch cache.
- Profile loading is tied to the authenticated user id and retries transient auth propagation failures.
- Background/foreground behavior is coordinated by the existing lifecycle/realtime/network layers.
- The native Google flow exchanges the native identity token with Supabase rather than exposing a browser redirect in the native app.
- The frontend never treats a role selector or portal route as authorization.

## Sensitive-data minimization
- F4 removed the nested `products(*)` vendor payload from `getVendorById` and uses a bounded vendor-products query.
- F1/F4/F5 canonical query boundaries reduce duplicate and oversized client fetches.
- Admin/vendor/customer datasets remain role-scoped by backend/RLS contracts; frontend filtering is not considered a security control.
- Cache invalidation and sign-out cleanup prevent stale account data from surviving a session transition in the application cache.

## Upload validation
`src/lib/upload-security.js` centralizes client-side validation:
- MIME allowlist
- extension/MIME consistency
- maximum byte size
- image magic/signature checks for JPEG/PNG/WebP/AVIF
- PDF signature validation

Integrated into sensitive upload paths including product images, vendor KYC documents, rider KYC image selection, and delivery-proof uploads.

Client checks are deliberately treated as a first line of defense only. Supabase Storage policies, authenticated ownership checks, server-side validation, and backend/RPC authorization remain mandatory security boundaries.

## F10 acceptance criteria
- No arbitrary `javascript:`/`data:` URL navigation from user-controlled external links.
- Internal post-login redirects cannot escape the application origin.
- No application code manually persists Supabase access/refresh tokens.
- Persistent client storage contains only bounded non-secret state or explicitly safe replay metadata.
- Baseline CSP is present.
- Uploads are validated before storage writes on covered paths.
- Frontend role/route restrictions are never relied upon as authorization.
