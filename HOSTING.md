# SETU — Hosting & Security Headers

**Version:** 1.0.0 · **Last updated:** 2026-07-08

## Why move off GitHub Pages

GitHub Pages serves static files only. It **cannot**:

- send a `Content-Security-Policy` (or any custom security header),
- sit behind a WAF or edge rate-limiter,
- give you DDoS protection beyond GitHub's generic infrastructure.

For a platform that handles real money (wallet, credit, escrow, payouts),
Aadhaar KYC, and stores Supabase JWTs in `localStorage`, the missing CSP is a
real defence-in-depth gap: a single stored-XSS (e.g. via a vendor name or
notice) could read the token and take over an account. This is the audit's
HIGH finding "token storage in localStorage + GitHub Pages = no real security
headers."

**Target host: Cloudflare Pages** (Netlify works the same way). Both honour
`public/_headers` and `public/_redirects`, and Cloudflare's WAF/rate-limiting
sits in front of the origin.

## What's already in the repo (host-ready)

| File | Purpose |
|------|---------|
| `public/_headers` | CSP + HSTS + `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, asset caching. Ignored by GitHub Pages; enforced by Cloudflare Pages / Netlify. |
| `public/_redirects` | SPA history-API fallback (`/* /index.html 200`). |
| `vite.config.js` | `base` is now `VITE_BASE_PATH` env → `/` for Cloudflare (root domain), still `/SETU/` for GitHub Pages. |
| `.github/workflows/deploy-cloudflare.yml` | Production deploy to Cloudflare Pages. **Dormant** until `vars.ENABLE_CLOUDFLARE_DEPLOY == 'true'`. |

## Cutover steps (ops)

1. Create a Cloudflare Pages project (suggested name: `setu`).
2. Add repo **secrets**: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
   (plus the existing `VITE_*` build secrets, same as `deploy.yml`).
3. (Optional) Add repo **variable** `CLOUDFLARE_PAGES_PROJECT` if the project
   name isn't `setu`.
4. Add the Pages URL / custom domain to:
   - `supabase/config.toml` → `auth.additional_redirect_urls` (OAuth callback),
   - the `ALLOWED_ORIGINS` Edge Function secret (CORS allow-list).
5. **Validate the CSP in staging first.** Ship `public/_headers` with the header
   renamed to `Content-Security-Policy-Report-Only`, watch the browser console /
   report endpoint for violations on every flow (checkout/Razorpay, maps,
   FCM, login), fix any missing origin, then switch back to enforcing.
6. Set repo variable `ENABLE_CLOUDFLARE_DEPLOY = true`. Push to `main`.
7. Once verified, disable the old GitHub Pages pipeline (`deploy.yml`) so you
   don't deploy to two hosts at once.

## CSP origin allow-list (keep in sync)

The CSP in `public/_headers` allow-lists exactly the external origins the app
uses today (grep-verified against `src/` + `public/`):

| Service | Origins |
|---------|---------|
| Supabase | `https://*.supabase.co`, `wss://*.supabase.co` |
| Razorpay | `https://checkout.razorpay.com` (script), `https://api.razorpay.com`, `https://*.razorpay.com` (xhr/iframe), `https://lumberjack.razorpay.com` |
| Firebase / FCM | `https://www.gstatic.com` (SW SDK), `https://*.googleapis.com`, `https://fcm.googleapis.com` |
| Mapbox | `https://api.mapbox.com`, `https://*.tiles.mapbox.com`, `https://events.mapbox.com` |
| Leaflet / OSM | `https://unpkg.com`, `https://*.tile.openstreetmap.org` |

**If you add a new third-party origin, update `public/_headers` or the browser
will block it.**

## Related follow-up (not done here)

Moving JWTs out of `localStorage` (e.g. to a server-set, `HttpOnly`,
`SameSite` cookie via a small auth proxy) would remove the XSS-token-theft
vector entirely. That's a larger change than a host swap; the CSP above is the
pragmatic first layer of defence in the meantime.
