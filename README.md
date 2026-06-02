# SETU — Rural Commerce Operating System

> Rural hyperlocal commerce platform for Madhepur–Laxmipur–Parsad, Madhubani District, Bihar

## 🌾 Platform Overview

SETU is a multi-sided rural commerce OS connecting customers, local vendors, delivery riders, service providers, village anchors, block admins, and a super admin — all within a hub-and-spoke model designed for Tier 4/5 India.

---

## 🚀 Quick Start

```bash
npm install
npm run dev
```

Then open http://localhost:5173 to see the SETU role selector.

---

## 🗂️ Project Structure

```
SETU/
├── src/
│   ├── App.jsx                     # Root router — all 7 app portals
│   ├── main.jsx
│   ├── index.css                   # Design tokens, Tailwind, Google Fonts
│   ├── components/
│   │   ├── shared/                 # Reusable components
│   │   │   ├── AppHeader.jsx       # Sticky top bar with back/notifications
│   │   │   ├── MobileNav.jsx       # Bottom nav bar
│   │   │   ├── StatusBadge.jsx     # Order/delivery status chips
│   │   │   ├── StatCard.jsx        # KPI card
│   │   │   └── EmptyState.jsx      # Zero-state placeholder
│   │   ├── admin/
│   │   │   ├── AdminSidebar.jsx    # Block admin sidebar
│   │   │   └── SuperAdminSidebar.jsx
│   │   └── ui/                     # shadcn/ui components (self-contained)
│   ├── lib/
│   │   ├── mockData.js             # Complete mock dataset
│   │   └── utils.js                # cn() helper
│   └── pages/
│       ├── RoleSelect.jsx          # Entry: choose which app to demo
│       ├── customer/               # 16 screens — full customer journey
│       ├── vendor/                 # 8 screens — store management
│       ├── rider/                  # 5 screens — delivery operations
│       ├── seva/                   # 5 screens — service provider
│       ├── anchor/                 # 5 screens — Village Anchor portal
│       ├── onboarding/             # 3 multi-step onboarding flows
│       ├── admin/                  # 11 screens — block admin dashboard
│       └── superadmin/             # 8 screens — platform control
└── package.json
```

---

## 🎭 App Portals

| Portal | Route | Description |
|--------|-------|-------------|
| **Customer App** | `/customer` | Shop local, track orders, SETU Credit, schemes, voice input |
| **Vendor App** | `/vendor` | Dashboard, orders, products, earnings, analytics |
| **Rider App** | `/rider` | Deliveries, earnings, COD management, SOS |
| **Seva Provider** | `/seva` | Job requests, scheduling, earnings |
| **Village Anchor** | `/anchor` | Onboarding, noticeboard, dispute mediation |
| **Block Admin** | `/admin` | Full operations dashboard |
| **Super Admin** | `/superadmin` | Platform-wide GMV, credit, security, blocks |
| **Vendor Onboarding** | `/onboarding/vendor` | 5-step KYC + shop setup |
| **Rider Onboarding** | `/onboarding/rider` | 5-step identity + zone selection |
| **Seva Verification** | `/onboarding/seva` | 4-step skill test + portfolio |

---

## 🏗️ Tech Stack

- **React 18** + **React Router 6**
- **Vite 5** (build tool)
- **Tailwind CSS 3** (custom design system)
- **shadcn/ui** (Radix UI primitives)
- **Recharts** (all analytics charts)
- **Framer Motion** (role selector animations)
- **Lucide React** (icons)

## 🎨 Design System

SETU uses a warm, earthy color palette inspired by Bihar's cultural identity:
- **Primary**: Saffron/amber (hsl 24°)
- **Accent**: Deep green (hsl 150°)
- **Fonts**: Playfair Display (headings) + Inter (body)
- **Dark sidebar** for admin panels
- **Mobile-first** — all customer/vendor/rider/seva screens are 375-414px wide

---

## 📦 Production Checklist

- [ ] Replace mock data with Supabase queries
- [ ] Wire Razorpay for payments
- [ ] Integrate Mapbox for delivery tracking
- [ ] Wire Whisper STT for voice input
- [ ] Connect Claude Haiku API for AI insights
- [ ] Enable Supabase Realtime for live order updates
- [ ] Add push notifications (FCM)
- [ ] Add offline PWA support (Service Worker)

---

## 🌍 Supported Languages (mock ready)
- Hindi (हिन्दी)
- Maithili (मैथिली)
- Bhojpuri (भोजपुरी)
- English

---

*SETU — Bridging rural India to the digital economy, one village at a time.*
