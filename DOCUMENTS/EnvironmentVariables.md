# SETU — EnvironmentVariables.md

**Document Class:** Engineering · Living (every new integration adds entries)
**Owner:** Principal DevOps Engineer
**Audience:** All engineers, DevOps, new hires (environment setup)
**Status:** v1.0 — MVP Configuration Registry
**Depends On:** TechSpec.md, SecurityRequirements.md, SystemArchitecture.md

---

## 0. How to Use This Document

This is the canonical registry of every environment variable and secret that SETU's systems require. It defines what each variable is for, which environments it differs across (dev/staging/prod), where it is stored, and who can access it.

**Critical rules (from SecurityRequirements.md §7):**
1. Real secret values are never written in this document — only descriptions and formats
2. `.env.local` is gitignored — the repository contains only `.env.example`
3. Adding a new integration to `TechSpec.md` requires a corresponding entry here in the same PR
4. Rotating a secret requires updating all storage locations simultaneously (see Section 4)

---

## 1. Variable Classification

Every variable in this registry belongs to one of three classes:

| Class | Definition | Safe to Expose? | Examples |
|---|---|---|---|
| **Public config** | Non-sensitive values that can be in source code or `.env.example` with real values | Yes | Supabase project URL, Mapbox public token, app bundle ID |
| **App secrets** | Values that must be kept out of source code but are technically semi-public (e.g., Supabase anon key — it's designed to be used in client apps but still shouldn't be in Git) | Client-side only | Supabase anon key, Razorpay publishable key |
| **Server secrets** | Values that must never leave the server environment | Never | Supabase service role key, Razorpay secret key, Twilio auth token, Razorpay webhook secret |

---

## 2. Variable Registry

### 2.1 Supabase

| Variable | Class | Description | Format | Apps That Use It |
|---|---|---|---|---|
| `SUPABASE_URL` | Public config | The Supabase project's REST API base URL | `https://<project-ref>.supabase.co` | All Flutter apps, Admin, Edge Functions |
| `SUPABASE_ANON_KEY` | App secret | The public JWT key for client-side Supabase access — safe in Flutter apps; RLS and JWT validation are the security controls, not this key's secrecy | JWT string starting with `eyJ...` | All Flutter apps |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server secret** | Bypasses RLS — used only in Edge Functions to perform admin DB operations (e.g., creating an order row on behalf of a customer). **Never in Flutter apps.** | JWT string starting with `eyJ...` | Edge Functions only |
| `SUPABASE_DB_URL` | **Server secret** | Direct PostgreSQL connection string — used for migration scripts and local dev only | `postgresql://postgres:[password]@[host]:5432/postgres` | `supabase` CLI, CI/CD migrations step |
| `SUPABASE_STORAGE_BUCKET_PRODUCTS` | Public config | Name of the Supabase Storage bucket for product images | String, e.g., `product-images` | Flutter apps, Edge Functions |
| `SUPABASE_STORAGE_BUCKET_DELIVERIES` | Public config | Name of the Supabase Storage bucket for delivery proof photos | String, e.g., `delivery-proofs` | Rider App, Edge Functions |

**Dev values:** Use `supabase start` (TechSpec.md §4.2) to get local dev values — the CLI prints `SUPABASE_URL` and `SUPABASE_ANON_KEY` on startup. These local values are safe to share with the team.

**Staging/Prod values:** Stored in GitHub Secrets (`SUPABASE_URL_STAGING`, `SUPABASE_URL_PROD`, etc.) and in Supabase project environment variables for Edge Functions.

---

### 2.2 Razorpay (Payments)

| Variable | Class | Description | Format | Apps That Use It |
|---|---|---|---|---|
| `RAZORPAY_KEY_ID` | App secret | Publishable key — included in the `razorpay` object returned by `POST /api/v1/orders` (APIContract §5.1) for the Flutter Razorpay SDK to open the payment sheet | `rzp_live_XXXXXXXXXXXX` or `rzp_test_XXXXXXXXXXXX` | Flutter Customer App (via API response), PaymentService |
| `RAZORPAY_KEY_SECRET` | **Server secret** | Used server-side only to create Razorpay orders and verify payment signatures | Alphanumeric string | PaymentService Edge Function only |
| `RAZORPAY_WEBHOOK_SECRET` | **Server secret** | Used to verify the `X-Razorpay-Signature` header on incoming webhooks (SecurityRequirements.md §4.1) | Alphanumeric string | PaymentService webhook handler only |

**Environment split:**
- `dev`: Use Razorpay **test mode** keys (`rzp_test_*`) — test card/UPI payments work, no real money moves
- `staging`: Use Razorpay test mode keys (same as dev — staging never moves real money)
- `prod`: Use Razorpay **live mode** keys (`rzp_live_*`) — real money, real users

**Test card for dev/staging:** Razorpay provides test cards and UPI IDs at `https://razorpay.com/docs/payments/payments/test-card-details/`

---

### 2.3 Twilio / WhatsApp (Messaging + OTP SMS)

| Variable | Class | Description | Format | Apps That Use It |
|---|---|---|---|---|
| `TWILIO_ACCOUNT_SID` | **Server secret** | Twilio account identifier | `AC...` | NotificationService, Supabase Auth SMS provider |
| `TWILIO_AUTH_TOKEN` | **Server secret** | Twilio authentication token | Alphanumeric string | NotificationService, Supabase Auth |
| `TWILIO_PHONE_NUMBER` | Public config | The SETU Twilio phone number used to send SMS OTPs | `+1XXXXXXXXXX` or Indian virtual number | Supabase Auth SMS config |
| `TWILIO_WHATSAPP_NUMBER` | Public config | The WhatsApp Business number (format: `whatsapp:+91XXXXXXXXXX`) | `whatsapp:+91XXXXXXXXXX` | NotificationService |
| `WHATSAPP_TEMPLATE_APPROVED` | Public config | Boolean flag — `true` once WhatsApp message templates are approved by Meta for production use. Controls whether WhatsApp notifications use templates (prod) or freeform sandbox messages (dev) | `true` / `false` | NotificationService |

**Dev/staging:** Use Twilio's Sandbox WhatsApp number — requires each recipient to "join" the sandbox by sending a message first. OTP SMS works in test mode with real phone numbers.
**Prod:** Requires a WhatsApp Business Account with Meta-approved message templates. Template approval can take 2–5 business days — plan ahead of production launch.

---

### 2.4 Firebase (Push Notifications)

| Variable | Class | Description | Format | Apps That Use It |
|---|---|---|---|---|
| `FIREBASE_PROJECT_ID` | Public config | Firebase project identifier | String, e.g., `setu-app-prod` | All Flutter apps, NotificationService |
| `FIREBASE_SERVER_KEY` | **Server secret** | FCM server key for sending push notifications server-side | Alphanumeric string | NotificationService Edge Function |
| `GOOGLE_SERVICES_JSON` | App secret | The `google-services.json` file content for Android Firebase configuration | JSON file (base64-encoded in CI) | Flutter apps — placed at `android/app/google-services.json` at build time |

**Note on `GOOGLE_SERVICES_JSON` in CI:** The file is not committed to Git (it contains the Firebase config including API keys). In CI (GitHub Actions), it is stored as a secret and written to the correct path before the Flutter build step:
```yaml
- name: Write google-services.json
  run: echo "${{ secrets.GOOGLE_SERVICES_JSON }}" | base64 --decode > apps/customer/android/app/google-services.json
```

---

### 2.5 Mapbox (Maps)

| Variable | Class | Description | Format | Apps That Use It |
|---|---|---|---|---|
| `MAPBOX_PUBLIC_TOKEN` | App secret | Mapbox access token for map tile requests from client apps | `pk.eyJ1...` | Flutter Rider App (maps + offline tiles) |
| `MAPBOX_SECRET_TOKEN` | **Server secret** | For generating offline tile download URLs (requires a secret token with `downloads:read` scope) | `sk.eyJ1...` | Supabase Edge Function (tile download URL generation if needed) |
| `MAPBOX_OFFLINE_STYLE_URL` | Public config | The Mapbox style URL for SETU's map style (customized for rural India readability) | `mapbox://styles/...` | Rider App |
| `MAPBOX_OFFLINE_REGION_BOUNDS` | Public config | JSON bounding box for the offline tile download region (Madhepur block + buffer) | `[[lng_min,lat_min],[lng_max,lat_max]]` | Rider App tile download logic |

**Offline tile pre-download strategy:** On first Rider App launch (or when the block is changed), the app downloads offline tiles for the entire Madhepur block region. Approximate tile size for zoom levels 12–18 over Madhepur block: ~40–80MB. This download is triggered over WiFi only (checked via `connectivity_plus`), not over mobile data without user confirmation.

---

### 2.6 AI Services

| Variable | Class | Description | Format | Apps That Use It |
|---|---|---|---|---|
| `CLAUDE_API_KEY` | **Server secret** | Anthropic Claude API key for WhatsApp bot and vendor insights (Phase 2) | `sk-ant-...` | AI Edge Function (Phase 2) |
| `OPENAI_API_KEY` | **Server secret** | OpenAI API key for Whisper voice transcription | `sk-...` | AI Edge Function (`/ai/voice/transcribe` endpoint) |

**Cost controls:** Both AI API keys should have spending limits configured in their respective dashboards:
- Anthropic: Set a monthly budget cap (e.g., $50/month for MVP) to prevent unexpected cost spikes
- OpenAI: Set a monthly limit (e.g., $30/month for Whisper usage at MVP scale)
These caps do not need to be in environment variables — they are configured in the provider dashboard.

---

### 2.7 Monitoring & Error Tracking

| Variable | Class | Description | Format | Apps That Use It |
|---|---|---|---|---|
| `SENTRY_DSN` | App secret | Sentry Data Source Name — identifies where crash reports are sent | `https://xxx@xxx.ingest.sentry.io/xxx` | All Flutter apps, Edge Functions, Admin |
| `SENTRY_DSN_CUSTOMER` | App secret | Separate Sentry project DSN for the Customer App (separate projects help filter issues by app) | Same format | Flutter Customer App |
| `SENTRY_DSN_VENDOR` | App secret | Vendor App Sentry DSN | Same format | Flutter Vendor App |
| `SENTRY_DSN_RIDER` | App secret | Rider App Sentry DSN | Same format | Flutter Rider App |
| `SENTRY_DSN_BACKEND` | App secret | Edge Functions Sentry DSN | Same format | All Edge Functions |
| `POSTHOG_API_KEY` | App secret | PostHog project API key for product analytics | `phc_...` | All Flutter apps, Admin |
| `POSTHOG_HOST` | Public config | PostHog instance URL (self-hosted Phase 3+, cloud for MVP) | `https://app.posthog.com` | All Flutter apps |

---

### 2.8 Application Configuration

| Variable | Class | Description | Format | Apps That Use It |
|---|---|---|---|---|
| `APP_ENV` | Public config | Current environment identifier | `development` / `staging` / `production` | All services (controls behavior switches) |
| `APP_VERSION` | Public config | Current app version (injected at build time) | Semantic version string `x.y.z` | All Flutter apps (sent as `X-App-Version` header per APIContract §12) |
| `ACTIVE_BLOCK_ID` | Public config | The Supabase UUID of the currently active block (Madhepur) — used as a seed value and default for operations in MVP | UUID string | Edge Functions (default block context) |
| `DEFAULT_DELIVERY_FEE_PAISE` | Public config | Flat delivery fee for MVP (in paise — ADR-002) | Integer, e.g., `1000` (= ₹10) | OrderService (PRD §7 Q3 resolution — flat fee, configurable here without a code change) |
| `MIN_APP_VERSION` | Public config | Minimum supported app version (below this, `426 Upgrade Required` is returned per AppFlow §10.1) | Semantic version string | API gateway / Edge Function version check |

---

### 2.9 Admin Dashboard (Next.js Only)

| Variable | Class | Description | Format |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Public config | Same as `SUPABASE_URL` — Next.js `NEXT_PUBLIC_` prefix exposes it to the browser | Same |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | App secret | Same as `SUPABASE_ANON_KEY` | Same |
| `NEXTAUTH_SECRET` | **Server secret** | NextAuth.js session secret (if NextAuth is used for admin SSR session management) | Random 32-char string |
| `NEXTAUTH_URL` | Public config | The admin dashboard's base URL | `https://admin.setu.app` / `http://localhost:3000` |

---

## 3. `.env.example` File

This file is committed to the repository with placeholder values. Every engineer copies this to `.env.local` and fills in real dev values.

```bash
# SETU — .env.example
# Copy to .env.local and fill in values
# NEVER commit .env.local to Git

# ── APPLICATION ─────────────────────────────────────────────────
APP_ENV=development
APP_VERSION=0.1.0
ACTIVE_BLOCK_ID=<uuid-of-madhepur-block-from-seed>
DEFAULT_DELIVERY_FEE_PAISE=1000
MIN_APP_VERSION=0.1.0

# ── SUPABASE ────────────────────────────────────────────────────
# Run 'supabase start' to get dev values — CLI prints them on startup
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=<printed by supabase start>
SUPABASE_SERVICE_ROLE_KEY=<printed by supabase start>
SUPABASE_DB_URL=postgresql://postgres:postgres@localhost:54322/postgres
SUPABASE_STORAGE_BUCKET_PRODUCTS=product-images
SUPABASE_STORAGE_BUCKET_DELIVERIES=delivery-proofs

# ── RAZORPAY (test mode) ─────────────────────────────────────────
# Use test keys from https://dashboard.razorpay.com (test mode)
RAZORPAY_KEY_ID=rzp_test_REPLACE_ME
RAZORPAY_KEY_SECRET=REPLACE_ME
RAZORPAY_WEBHOOK_SECRET=REPLACE_ME

# ── TWILIO ──────────────────────────────────────────────────────
TWILIO_ACCOUNT_SID=REPLACE_ME
TWILIO_AUTH_TOKEN=REPLACE_ME
TWILIO_PHONE_NUMBER=+1XXXXXXXXXX
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886  # Twilio sandbox number for dev
WHATSAPP_TEMPLATE_APPROVED=false  # true only in production

# ── FIREBASE ─────────────────────────────────────────────────────
FIREBASE_PROJECT_ID=setu-app-dev
FIREBASE_SERVER_KEY=REPLACE_ME
# GOOGLE_SERVICES_JSON: download from Firebase console and place at
# apps/customer/android/app/google-services.json (gitignored)

# ── MAPBOX ──────────────────────────────────────────────────────
MAPBOX_PUBLIC_TOKEN=pk.eyJ1REPLACE_ME
MAPBOX_SECRET_TOKEN=sk.eyJ1REPLACE_ME
MAPBOX_OFFLINE_STYLE_URL=mapbox://styles/mapbox/streets-v12
MAPBOX_OFFLINE_REGION_BOUNDS=[[85.9,26.2],[86.4,26.6]]

# ── AI SERVICES ─────────────────────────────────────────────────
OPENAI_API_KEY=sk-REPLACE_ME
CLAUDE_API_KEY=sk-ant-REPLACE_ME

# ── MONITORING ──────────────────────────────────────────────────
SENTRY_DSN_CUSTOMER=https://REPLACE_ME@sentry.io/REPLACE_ME
SENTRY_DSN_VENDOR=https://REPLACE_ME@sentry.io/REPLACE_ME
SENTRY_DSN_RIDER=https://REPLACE_ME@sentry.io/REPLACE_ME
SENTRY_DSN_BACKEND=https://REPLACE_ME@sentry.io/REPLACE_ME
POSTHOG_API_KEY=phc_REPLACE_ME
POSTHOG_HOST=https://app.posthog.com

# ── ADMIN DASHBOARD ─────────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<same as SUPABASE_ANON_KEY>
NEXTAUTH_SECRET=REPLACE_WITH_RANDOM_32_CHARS
NEXTAUTH_URL=http://localhost:3000
```

---

## 4. Storage Locations Per Environment

| Variable Class | Development | Staging | Production |
|---|---|---|---|
| Public config | `.env.local` (not committed), or hardcoded in non-secret config files | GitHub Secrets (staging) | GitHub Secrets (prod) |
| App secrets | `.env.local` | GitHub Secrets | GitHub Secrets + Supabase project env vars |
| Server secrets | `.env.local` | GitHub Secrets + Supabase project env vars | GitHub Secrets + Supabase project env vars |
| Flutter-embedded (anon key, Mapbox token) | `.env.local` → `flutter_dotenv` at dev build time | Injected at CI build time from GitHub Secrets | Injected at CI build time from GitHub Secrets |

**Supabase Edge Function secrets:** Set via Supabase CLI:
```bash
supabase secrets set RAZORPAY_KEY_SECRET=<value> --project-ref <staging-ref>
supabase secrets set RAZORPAY_KEY_SECRET=<value> --project-ref <prod-ref>
```

**GitHub Secrets naming convention:** Use environment suffixes:
- `RAZORPAY_KEY_ID_STAGING`, `RAZORPAY_KEY_ID_PROD`
- `TWILIO_AUTH_TOKEN_STAGING`, `TWILIO_AUTH_TOKEN_PROD`
- etc.

---

## 5. Secret Rotation Procedure

### 5.1 Scheduled Rotation (Annual)

All server secrets rotate annually. The procedure:

1. **Generate new credential** in the provider's dashboard (Razorpay, Twilio, OpenAI, etc.)
2. **Do not revoke the old one yet**
3. **Update all storage locations:**
   - GitHub Secrets (staging + prod entries)
   - Supabase project env vars (staging + prod)
   - Local `.env.local` for any developers who have the secret
4. **Deploy** (Edge Functions pick up new secrets on next cold start)
5. **Verify** one complete flow that uses the rotated secret (e.g., a test payment for Razorpay)
6. **Revoke old credential** only after verification passes
7. **Update this document's changelog** (Section 6) with rotation date and who performed it

### 5.2 Emergency Rotation (Suspected Compromise)

If a secret is suspected to have been exposed (e.g., found in a Git commit, logged accidentally):

1. **Immediately revoke** the secret in the provider dashboard — do not wait to generate a replacement first
2. This may cause a brief service disruption (acceptable — security over availability for a P0 event)
3. Generate new secret and follow steps 2–7 of the scheduled rotation procedure
4. Create a P0 incident entry and post-mortem per `SecurityRequirements.md §10`
5. Run `trufflehog git` across the full repository history to confirm no other secrets were exposed in the same commit range

### 5.3 Access Control — Who Can View/Rotate

| Secret Type | View Access | Rotate Access |
|---|---|---|
| Supabase service role key | CTO only | CTO only |
| Razorpay secret / webhook secret | CTO only | CTO only |
| Twilio auth token | CTO + Ops Lead | CTO |
| OpenAI / Claude API keys | CTO only | CTO only |
| Firebase server key | CTO + Lead Engineer | CTO |
| Sentry DSN | All engineers (view) | CTO |
| Mapbox secret token | Lead Engineer + CTO | CTO |
| Supabase anon key | All engineers (view — it's semi-public) | CTO |

---

## 6. Changelog

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-06 | Initial registry — MVP service integrations |

*Append rotation records here: `| — | YYYY-MM | Rotated: <secret name> by <initials> |`*

---

*End of EnvironmentVariables.md — v1.0*
