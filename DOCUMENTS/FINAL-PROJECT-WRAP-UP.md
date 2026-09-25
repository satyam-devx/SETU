# SETU — Final Project Wrap-Up

## Included scope

This archive contains the complete current SETU project workspace, including:

- React/Vite application source (`src/`), including all customer, vendor, rider, admin and superadmin pages/components/hooks/lib code.
- Supabase migrations and Edge Functions (`supabase/`).
- Database assets and migration tooling (`database/`, `scripts/`).
- QA suites, fixtures, SQL checks, load tests and test configuration (`qa/`).
- GitHub Actions workflows and deployment/CI configuration (`.github/`).
- Public assets and application assets (`public/`, `assets/`).
- Android/Capacitor configuration and Android build workflow configuration.
- Environment template (`.env.example`) with no real environment secret values.
- Product, architecture, security, accessibility, performance, operations and production-readiness documentation.
- F1 through F12 engineering planning/audit documents currently present under `DOCUMENTS/`.

## Engineering phases represented

- F1 — Frontend state, performance, resilience and hardening
- F2 — Data fetching / TanStack Query
- F3 — Rendering performance
- F4 — Customer performance
- F5 — Vendor performance
- F6 — Rider performance
- F7 — Realtime engineering
- F8 — Media engineering
- F9 — Mobile / Android engineering
- F10 — Frontend security
- F11 — UX / accessibility engineering
- F12 — Production performance measurement

## Important verification status

Static/source-level validation has been performed during the engineering work. The workspace currently does **not** contain the root `node_modules/` directory, and external npm installation was unavailable in the execution environment. Therefore this archive does not claim that a fresh Vite build, browser/Playwright run, runtime axe scan, or Android/WebView runtime measurement was executed in this environment.

Those are runtime gates, not reasons to invent a green result. The F12 instrumentation is included so those measurements can be collected in a real browser/device/CI environment.

## Archive hygiene

Generated dependency directories, Python caches and temporary archive files are excluded from the final archive. Real `.env` files are not included; only the committed environment template is included.
