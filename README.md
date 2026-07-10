# SETU — Rural Commerce Operating System

> Rural hyperlocal commerce platform for Madhepur–Laxmipur–Parsad, Madhubani District, Bihar.

**Version:** 1.0.0 · **Last updated:** 2026-07-08

SETU is a production Supabase-backed multi-portal commerce platform connecting customers, local vendors, delivery riders, service providers ("Seva" providers), village anchors, block admins, and a super admin — all within a hub-and-spoke model designed for Tier 4/5 India, on 2G/3G networks and entry-level Android phones.

---

## 🚀 Quick Start

```bash
git clone https://github.com/satyam-devx/SETU.git
cd SETU
npm install
cp .env.example .env.local   # fill in your Supabase/Firebase/Razorpay/Mapbox keys
npm run dev
```

Open `http://localhost:5173` to see the SETU role selector. Without real credentials, set `VITE_DEMO_MODE=true` in `.env.local` for local preview (see `.env.example` for what every variable does and where to get it).

### Common scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview a production build locally |
| `npm run lint` / `lint:fix` | ESLint (React + Hooks + a11y rules) |
| `npm run format` / `format:check` | Prettier |
| `npm run typecheck` | `tsc --noEmit` — editor/CI sanity check (project is plain JS, not migrated to TypeScript) |
| `npm run analyze` | Build + open a bundle-size visualizer |
| `npm run clean` | Remove `dist/` and Vite cache |
| `npm test` / `npm run test:all` | Delegates into `qa/` — see [`qa/README.md`](qa/README.md) |

---

## 🗂️ Project Structure

```
SETU/
├── src/
│   ├── App.jsx                     # Root router — every portal, all routes lazy-loaded
│   ├── main.jsx
│   ├── index.css                   # Design tokens, Tailwind, fonts
│   ├── components/
│   │   ├── shared/                 # AppHeader, MobileNav, StatusBadge, StatCard, ErrorBoundary, Img, …
│   │   ├── admin/                  # AdminSidebar, SuperAdminSidebar, AdminShell
│   │   ├── maps/                   # Leaflet/Mapbox wrappers (CDN-loaded, see Tech Stack below)
│   │   └── ui/                     # shadcn/ui-style primitives (Radix UI based)
│   ├── hooks/                      # useDataFetch, useFcmToken, useRealtimeOrders, useRiderLocation, …
│   ├── lib/                        # api.js, supabase.js, AuthContext, cartContext, permissions, settings, …
│   └── pages/
│       ├── customer/                # 29 screens — full customer journey
│       ├── vendor/                  # 12 screens — store management
│       ├── rider/                   # 9 screens — delivery operations
│       ├── seva/                    # 8 screens — service provider
│       ├── anchor/                  # 8 screens — Village Anchor portal
│       ├── onboarding/              # 3 multi-step onboarding flows
│       ├── admin/                   # 24 screens — block admin dashboard
│       └── superadmin/              # 17 screens — platform control
├── supabase/
│   ├── migrations/                 # 51 sequential SQL migrations — schema, RLS, RPCs (see below)
│   └── functions/                  # 8 Deno Edge Functions (payments, KYC, notifications, AI)
├── qa/                              # Separate QA/security pipeline — Vitest, Playwright, k6, SQL proofs
├── scripts/                         # Python ops tooling (migration validation, health checks, secret scanning)
└── .github/workflows/               # CI, deploy (GitHub Pages + Cloudflare Pages), nightly, health-monitor
```

---

## 🎭 App Portals

| Portal | Route | Description |
|---|---|---|
| **Customer App** | `/customer` | Shop local, track orders, SETU Credit, schemes, voice input, wallet |
| **Vendor App** | `/vendor` | Dashboard, orders, products, earnings, analytics |
| **Rider App** | `/rider` | Deliveries, earnings, COD management, SOS/safety |
| **Seva Provider** | `/seva` | Job requests, scheduling, earnings |
| **Village Anchor** | `/anchor` | Onboarding, noticeboard, dispute mediation |
| **Block Admin** | `/admin` | Full operations dashboard (24 screens) |
| **Super Admin** | `/superadmin` | Platform-wide GMV, credit, security, feature flags, developer tools (17 screens) |
| **Onboarding flows** | `/onboarding/vendor`, `/onboarding/rider`, `/onboarding/seva` | Multi-step KYC + setup |

---

## 🏗️ Tech Stack

**Frontend**
- React 18 + React Router 6, Vite 5
- Tailwind CSS 3 + shadcn/ui-style components on Radix UI primitives
- Recharts (analytics charts, lazy-loaded per route)
- Leaflet + Mapbox GL — **not npm dependencies.** Both are loaded from a CDN at runtime by `src/lib/maps.js` specifically to keep mapping code off the JS bundle for customers who never open a map screen (2G budget — see `PERFORMANCE.md`).

**Backend**
- Supabase (PostgreSQL, Row-Level Security, Realtime, Storage, Auth via phone OTP/OAuth)
- 51 sequential SQL migrations — schema, RLS policies, `SECURITY DEFINER` RPCs for every money/admin path
- 8 Deno Edge Functions: `create-razorpay-order`, `razorpay-webhook`, `vendor-payout`, `verify-aadhaar`, `kyc-verify`, `send-fcm-notification`, `dispatch-notifications`, `ai-assistant`
- Razorpay (payments, HMAC-verified webhook), Firebase Cloud Messaging (push, dynamically imported only after opt-in), Anthropic API (AI assistant), SurePass (Aadhaar KYC)

**QA / Ops**
- Vitest (unit + integration), Playwright (e2e + accessibility via axe-core), k6 (load testing), 15 dedicated SQL security/regression proof files
- GitHub Actions: CI, dual-target deploy (GitHub Pages live / Cloudflare Pages feature-flagged), nightly regression, health monitoring, secrets sync
- ESLint + Prettier (frontend), `deno lint` (Edge Functions), `lint_sql.py` (migrations)

---

## 🎨 Design System

A warm, earthy palette inspired by Bihar's cultural identity:
- **Primary:** Saffron/amber (hsl 24°) · **Accent:** Deep green (hsl 150°)
- **Fonts:** Playfair Display (headings) + Inter (body)
- **Dark sidebar** for admin panels · **Mobile-first** — all customer/vendor/rider/seva screens sized 375–414px

---

## 🌍 Languages

Hindi (हिन्दी) · Maithili (मैथिली) · Bhojpuri (भोजपुरी) · English — full i18n system, not mock data.

---

## 📚 Documentation

| Doc | Covers |
|---|---|
| [`SECURITY.md`](SECURITY.md) | Security posture, vulnerability reporting, pre-launch checklist |
| [`SECURITY_FIXES.md`](SECURITY_FIXES.md) | Detailed changelog of security-hardening work |
| [`CHANGELOG.md`](CHANGELOG.md) | Project-wide release history |
| [`PERFORMANCE.md`](PERFORMANCE.md) | 2G/low-end-device performance budget and bundle strategy |
| [`ACCESSIBILITY.md`](ACCESSIBILITY.md) | WCAG 2.1 AA scope, automated + manual testing checklist |
| [`HOSTING.md`](HOSTING.md) | GitHub Pages → Cloudflare Pages migration, deploy targets |
| [`SCALING.md`](SCALING.md) | Read replicas, WAF/rate-limiting, scaling playbook |
| [`DR.md`](DR.md) | Disaster recovery — RTO/RPO, rollback procedure |
| [`RUNBOOK.md`](RUNBOOK.md) | Operational runbook for incidents |
| [`qa/README.md`](qa/README.md) | QA pipeline usage |
| [`.env.example`](.env.example) | Every environment variable, what it does, where to get it |

---

## 📄 License

Proprietary — All Rights Reserved. See [`LICENSE`](LICENSE). This is closed-source software; the code is not licensed for reuse, modification, or redistribution without written permission.

---

*SETU — Bridging rural India to the digital economy, one village at a time.*
