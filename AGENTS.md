# AGENTS.md — SETU on Base44

SETU is a Vite 8 + React 19 single-page app backed by Supabase (external SaaS).
There is no in-repo backend process — all data goes to Supabase. The repo also
ships Supabase migrations and Deno Edge Functions, but those are NOT run here.

## Running here

- `docker compose -f docker-compose.base44.yml up -d --build` brings up the Vite
  dev server (live reload) on host port 3000 → container 5173.
- The dev server runs FROM THE CLONED SOURCE (bind-mounted `./`), so edits hot-reload.
- Node 22 (`node:22-slim`); deps install at container start via
  `npm install --legacy-peer-deps` (the `.npmrc` sets `legacy-peer-deps=true` for
  React 19 peer conflicts — keep it).
- `node_modules` lives in a named volume (`setu_node_modules`), not the bind mount.

## Demo mode (no credentials needed)

- The app boots in **demo mode** (`VITE_DEMO_MODE=true`, set in `.env.base44-defaults`)
  with NO real Supabase backend. It logs in as a hardcoded demo customer and renders
  the full UI; data-fetch calls to the placeholder Supabase URL fail harmlessly
  (console `TypeError: Failed to fetch` for FeatureFlags/Settings is expected).
- Without demo mode AND without real Supabase creds, `App.jsx` renders a hard
  "SETU isn't configured yet" screen (fail-closed, by design).

## Credentials (optional)

Real Supabase/Firebase/Mapbox/Razorpay keys are NOT required to preview. To wire
them in, provide them as platform secrets (see `.base44/environment.json`); they land
in `/run/base44/app.env` and override the placeholders in `.env.base44-defaults`.
Only `VITE_*`-prefixed vars reach the browser.

## Vite config note

`vite.config.js` has `server.allowedHosts: true` so the Base44 preview's external
hostname is accepted (Vite 8 otherwise blocks it). Do not remove it.

## Verify it works

- `curl -sf http://localhost:3000/` → 200 + the Vite HTML shell (serves `/src/main.jsx`).
- Preview shows the SETU login/landing card.
