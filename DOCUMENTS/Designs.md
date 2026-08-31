# SETU — Designs.md

**Document Class:** Product · Evolving (design system grows with each new screen/feature)
**Owner:** Designer / Chief Product Officer
**Audience:** Frontend engineers, designers, QA (visual regression baseline)
**Status:** v1.0 — MVP Design System
**Depends On:** PRD.md, AppFlow.md, Constitution.md, APIContract.md

---

## 0. How to Use This Document

This document defines SETU's visual and interaction design system — design tokens, component library, and screen-by-screen rendering specifications for every flow in `AppFlow.md`. Every screen specified here is checked against two things: (1) does it satisfy `AppFlow.md`'s defined transitions and edge cases, and (2) does it only display data that `APIContract.md` actually provides.

**Rural-UX governing principle (Constitution III):** Every design decision in this document defaults toward visual-first, high-contrast, large-touch-target, low-literacy-friendly patterns. Where a "standard" mobile UX pattern (e.g., swipe gestures, hidden menus, small icon-only buttons) conflicts with this principle, the SETU-native pattern wins — this is the same precedence rule as Constitution §6.

---

## 1. Design Tokens

### 1.1 Color Palette

The palette is drawn from the brand identity established in Technical Constitution Part 9 — Mithila art, agricultural identity, and festive warmth, translated into a functional UI palette.

| Token | Hex | Usage |
|---|---|---|
| `color.forest` | `#1a5c2a` | Primary brand color — headers, primary buttons, active states |
| `color.forest.dark` | `#0f3d1c` | Pressed/active state of primary buttons |
| `color.growth` | `#2d8a44` | Success states, "Delivered" status, confirmed orders |
| `color.marigold` | `#e8851a` | Alerts, "new order" highlights, festive moments, secondary CTAs |
| `color.marigold.dark` | `#c46a0f` | Pressed state of marigold elements |
| `color.khaadi` | `#f5f0e4` | Background — warm off-white, not stark white |
| `color.earth` | `#1a1a1a` | Primary text color |
| `color.earth.muted` | `#6b6b6b` | Secondary text, timestamps, helper text |
| `color.error` | `#c0392b` | Error states, rejection/cancellation, COD discrepancies |
| `color.warning` | `#e8a93a` | "Closed" badges, pending/unverified states |
| `color.border` | `#d8d2c2` | Card borders, dividers |
| `color.surface` | `#ffffff` | Card backgrounds (on khaadi page background) |

**Contrast requirement (Constitution III accessibility):** All text-on-background combinations must meet WCAG AA (4.5:1) at minimum. `color.earth` on `color.khaadi` = 14.8:1 — comfortably exceeds this. `color.earth.muted` on `color.surface` = 4.6:1 — passes but is the floor; do not introduce lighter muted tones.

### 1.2 Typography

| Token | Font | Size | Weight | Usage |
|---|---|---|---|---|
| `text.display` | Noto Sans Devanagari | 28sp | 700 | Order confirmation headlines ("आपका ऑर्डर मिल गया!") |
| `text.heading` | Noto Sans Devanagari | 20sp | 600 | Screen titles, vendor names |
| `text.body` | Noto Sans Devanagari | 16sp | 400 | Default body text — **never smaller than 16sp** |
| `text.body.bold` | Noto Sans Devanagari | 16sp | 700 | Prices, order numbers, emphasis |
| `text.caption` | Noto Sans Devanagari | 13sp | 400 | Timestamps, helper text — minimum size, used sparingly |
| `text.button` | Noto Sans Devanagari | 18sp | 600 | All button labels |

**Font rationale:** Noto Sans Devanagari is chosen for: (a) free/open license, (b) excellent rendering on low-end Android devices without requiring a custom font download (it ships with most Android Devanagari locales), (c) consistent rendering of Hindi and the Maithili script (which uses Devanagari) — supporting Constitution III's Maithili commitment without a separate font asset.

**16sp minimum body text rationale:** Per Constitution III and the Execution Bible's device-testing matrix (₹5,000–15,000 Android devices, often with lower-density screens), 14sp body text common in urban apps becomes difficult to read. 16sp is SETU's floor, not a maximum.

### 1.3 Spacing Scale

| Token | Value | Usage |
|---|---|---|
| `space.xs` | 4dp | Icon-to-label gaps |
| `space.sm` | 8dp | Internal card padding (small) |
| `space.md` | 16dp | Standard card padding, list item spacing |
| `space.lg` | 24dp | Section spacing |
| `space.xl` | 32dp | Screen top/bottom margins |

### 1.4 Touch Targets

**Minimum touch target: 48dp × 48dp** (exceeds Android's 44dp baseline — Constitution III, larger targets for users less familiar with precise tapping). All buttons, list rows, and interactive icons meet this minimum, including spacing — no two adjacent tap targets share an edge without at least 8dp gap.

### 1.5 Iconography

Icons follow a consistent **filled, rounded, single-color** style (not outline/stroke icons — filled shapes are more legible at small sizes on low-DPI screens). Category icons (Section 1.1 of categories table, `icon_url`) are custom-illustrated, not generic stock icons — e.g., the "Grocery" category icon depicts a recognizable local grocery basket, not a generic Western shopping cart, for visual-first recognition (Constitution III: "visual-first browsing").

**Status icons** (order tracking stepper, AppFlow §4.1):

| Status | Icon | Color |
|---|---|---|
| Placed (प्राप्त) | Filled circle/dot | `color.forest` |
| Confirmed (स्वीकृत) | Checkmark in circle | `color.forest` |
| Picked Up (उठाया गया) | Bag/box icon | `color.forest` |
| On the way (रास्ते में) | Scooter/bike icon (animated subtly) | `color.marigold` |
| Delivered (पहुंचा) | House with checkmark | `color.growth` |
| Cancelled | X in circle | `color.error` |

---

## 2. Core Components

### 2.1 `VendorCard`

Used in: AppFlow §2.1 (Home Screen vendor row), §2.2 (Vendor List Screen)

**Visual structure:**
```
┌─────────────────────────────────┐
│ [Cover Image - 16:9]             │
│                                   │
│ ┌─────────────┐                  │
│ │ ★ 4.5 (12)  │  ← rating badge  │
│ └─────────────┘                  │
├───────────────────────────────────┤
│ Ramesh General Store    [बंद]    │ ← business_name + optional
│ किराना · 0.8 km                  │   "closed" badge (color.warning)
└─────────────────────────────────┘
```

**Data binding (from APIContract §3.2 vendor object):**
- Cover image → `cover_image_url` (fallback: category-themed placeholder if null)
- Rating badge → `rating` + `review_count`, hidden entirely if `review_count = 0` (showing "★ 0.0 (0)" looks broken/discouraging — absence of the badge is preferable to a zero-state)
- Title → `business_name`
- Subtitle → `category_name` + `distance_km` (formatted "0.8 km")
- "बंद" (Closed) badge → shown if `is_open = false`, using `color.warning` background with `color.earth` text — **informational only** (AppFlow §2.2), never disables the tap action

**Touch target:** Entire card is tappable (48dp+ height guaranteed by image aspect ratio + text block).

---

### 2.2 `ProductCard`

Used in: AppFlow §2.3 (Vendor Detail Screen product grid)

**Visual structure (available state):**
```
┌───────────────┐
│ [Photo 1:1]    │
│                │
├────────────────┤
│ Tata Salt      │
│ ₹25      [+]   │ ← price + add button
└────────────────┘
```

**Visual structure (unavailable state — `is_available: false`):**
```
┌───────────────┐
│ [Photo 1:1]    │ ← 40% opacity overlay
│  उपलब्ध नहीं   │ ← "Not available" label, centered
├────────────────┤
│ Basmati Rice   │ ← text at full opacity (readable)
│ ₹120           │ ← price shown, no [+] button
└────────────────┘
```

**Data binding (from APIContract §3.3 product object):**
- Photo → `image_urls[0]` (fallback: category placeholder)
- Price → `price` formatted as `₹{price/100}` — e.g., `2500` paise → `₹25`. If `mrp` is present and `mrp > price`, show `mrp` with strikethrough alongside `price` (visual signal of discount, builds trust per Constitution I — customer sees they're getting value)
- `[+]` button → only rendered if `is_available: true`; tapping triggers AppFlow §2.4 add-to-cart logic

**Rationale for showing unavailable products (vs. hiding):** Per AppFlow §2.3, unavailable products remain visible so customers understand the vendor's general range — hiding them entirely would make the catalog look sparse and could make customers think the vendor doesn't carry that item at all (when really it's just out of stock today).

---

### 2.3 `OrderStatusStepper`

Used in: AppFlow §4.1 (Order Tracking Screen)

**Visual structure:**
```
●━━━━━●━━━━━○┄┄┄┄○┄┄┄┄○
प्राप्त  स्वीकृत  उठाया   रास्ते में  पहुंचा
```

- Completed steps: filled circle (`color.forest`), solid connecting line
- Current step: filled circle with pulsing ring animation (subtle, 1.5s loop — communicates "in progress" without text)
- Future steps: outlined circle (`color.border`), dashed connecting line
- Step labels below each icon, `text.caption`, wrap to 2 lines if needed (Hindi labels can be longer than English)

**Cancelled state override:** Per AppFlow §4.1, when `status='cancelled'`, the entire stepper is replaced (not shown alongside) with a single centered message block:
```
┌─────────────────────────────────┐
│         [X icon, color.error]    │
│                                   │
│   आपका ऑर्डर रद्द कर दिया गया।  │
│   कारण: स्टॉक खत्म है            │
│                                   │
│   [conditional refund message]   │
└─────────────────────────────────┘
```

**Live map (status >= picked_up):** Below the stepper, a map view renders using Mapbox offline tiles (TechSpec.md will specify SDK). Rider marker uses the scooter icon from Section 1.5, animates position smoothly between Realtime location updates (interpolation over the ~30s update interval per APIContract §8.4, to avoid jarring jumps).

---

### 2.4 `ReviewPromptOverlay`

Used in: AppFlow §4.2

**Visual structure:**
```
┌─────────────────────────────────┐
│  [Vendor cover image, dimmed]    │
│                                   │
│  Ramesh General Store को रेट करें │
│  ☆ ☆ ☆ ☆ ☆  (48dp each, tappable)│
│                                   │
│  डिलीवरी को रेट करें             │
│  ☆ ☆ ☆ ☆ ☆                       │
│                                   │
│  [text input - optional]         │
│  कुछ कहना चाहते हैं? (वैकल्पिक)   │
│                                   │
│  ┌─────────────────────────────┐│
│  │      जमा करें (primary)      ││
│  └─────────────────────────────┘│
│         बाद में (text link)       │
└─────────────────────────────────┘
```

**Star rating interaction:** Tapping a star fills that star and all stars to its left (standard pattern), using `color.marigold` for filled stars, `color.border` for empty. Each star is a 48dp tap target with 4dp gaps — total row width fits comfortably on smallest supported screen width (assume 360dp viewport).

**Rider rating visibility:** Per Schema §8.1, `rider_rating` is nullable — if the order's `delivery.rider_id` is somehow null (shouldn't happen for a `delivered` order, but defensive), the entire "डिलीवरी को रेट करें" block is omitted, not shown with a disabled state.

---

### 2.5 `OrderCard` (Vendor & Admin views)

Used in: AppFlow §5.1 (Vendor Dashboard "New Orders"), §8.1 (Admin Orders table — mobile/compact variant)

**Visual structure:**
```
┌─────────────────────────────────┐
│ #SETU-20260612-0042    [नया]    │ ← order_number + "New" badge
│                                   │   (color.marigold bg) if pending
│ 2× Tata Salt                     │
│ 1× Basmati Rice                  │
│                                   │
│ 📍 परसाद · नीम के पेड़ के पास    │ ← delivery village + landmark
│                                   │
│ ₹180                  08:30 AM   │ ← total + created time
└─────────────────────────────────┘
```

**Highlight animation on new arrival (AppFlow §5.1):** When a new `pending` order arrives via Realtime, the card animates in with a brief `color.marigold` border pulse (2 cycles, ~1s total) plus the in-app notification sound — this is the "highlight animation" referenced in AppFlow, specified precisely here so engineers don't need to invent the exact effect.

---

### 2.6 `PrimaryButton`, `SecondaryButton`, `DangerButton`

| Component | Background | Text Color | Usage |
|---|---|---|---|
| `PrimaryButton` | `color.forest` | `color.khaadi` | Main CTAs: "ऑर्डर पक्का करें", "जमा करें", "स्वीकार करें" |
| `SecondaryButton` | `color.surface` + `color.forest` border (2dp) | `color.forest` | Secondary actions: "बाद में", "फिर कोशिश करें" |
| `DangerButton` | `color.error` | `color.khaadi` | "अस्वीकार करें" (Reject) |

All buttons: 48dp minimum height, `space.md` horizontal padding, `text.button` typography, fully rounded corners (8dp radius — soft but not pill-shaped, matching the warm/approachable but not "playful" brand tone).

**Disabled state:** 40% opacity, no color change (avoids introducing a 4th color variant per button type) — used for "आगे बढ़ें" before phone number is complete (AppFlow §1.1).

---

## 3. Screen Specifications

This section maps each major AppFlow.md screen to its component composition. Screens not explicitly detailed here (e.g., simple list/form screens like Address Selection) follow the component library above using standard composition — only screens with notable layout decisions are detailed.

### 3.1 Home Screen (AppFlow §2.1)

```
┌─────────────────────────────────┐
│ 📍 परसाद              [बदलें]   │ ← Header: village name, change link
├─────────────────────────────────┤
│ [🎤]  खोजें...                   │ ← Voice icon + search bar, combined
├─────────────────────────────────┤
│ श्रेणियां (Categories)            │
│ [🛒][🍵][🥬][🔧] ...             │ ← 4-column icon grid, horizontal
│  scroll if >4 categories          │   scroll for overflow (not pagination —
│                                    │   per Constitution III, scrolling is
│                                    │   more discoverable than page dots)
├─────────────────────────────────┤
│ आपके पास के दुकान                │ ← "Shops near you" section header
│ [VendorCard][VendorCard]...      │ ← horizontal scroll
└─────────────────────────────────┘
```

**Empty state (zero vendors in village, AppFlow §2.1):**
```
┌─────────────────────────────────┐
│ 📍 परसाद              [बदलें]   │
├─────────────────────────────────┤
│ [🎤]  खोजें...                   │
├─────────────────────────────────┤
│ श्रेणियां (Categories)            │
│ [🛒][🍵][🥬][🔧] ...             │ ← categories still shown (browsable)
├─────────────────────────────────┤
│                                   │
│        [illustration]            │
│  अभी इस गाँव में कोई दुकान        │
│  उपलब्ध नहीं है। जल्द ही आएंगी!   │
│                                   │
└─────────────────────────────────┘
```
> Categories remain visible/tappable even in the empty state — tapping one leads to Vendor List Screen, which would also be empty, but this is consistent rather than hiding navigation entirely. The illustration is a simple line-art shop icon (not a generic "404" graphic) — maintains warmth.

### 3.2 Checkout Screen (AppFlow §3.2)

```
┌─────────────────────────────────┐
│ ← चेकआउट                         │
├─────────────────────────────────┤
│ डिलीवरी का पता            [बदलें]│
│ परसाद · नीम के पेड़ के पास        │
├─────────────────────────────────┤
│ निर्देश (वैकल्पिक)                │
│ [text input]                     │
├─────────────────────────────────┤
│ ऑर्डर समरी                       │
│   सामान            ₹170          │
│   डिलीवरी फीस       ₹10          │
│   ─────────────────────          │
│   कुल               ₹180         │
├─────────────────────────────────┤
│ भुगतान का तरीका                   │
│ ◉ कैश ऑन डिलीवरी (COD)           │ ← pre-selected, larger touch target
│ ○ ऑनलाइन भुगतान (UPI)            │   for each radio row (full-width row
│                                   │   tappable, not just the radio dot)
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │   ऑर्डर पक्का करें  (Primary) │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

**Order summary line-item formatting:** All amounts displayed as `₹{value/100}` (no decimals shown for whole-rupee amounts — `17000` paise → `₹170`, not `₹170.00`; if a value has paise remainder, e.g. `17050` → `₹170.50`). This formatting rule applies platform-wide wherever paise values are displayed.

### 3.3 Vendor Dashboard (AppFlow §5.1)

```
┌─────────────────────────────────┐
│ Ramesh General Store              │
│                                   │
│ ┌───────────┐ ┌───────────┐     │
│ │ आज के ऑर्डर│ │ आज की कमाई │     │ ← two stat tiles, side by side
│ │     8      │ │   ₹1,440    │     │
│ └───────────┘ └───────────┘     │
├─────────────────────────────────┤
│ नए ऑर्डर (New Orders)            │
│ [OrderCard - highlighted]         │
│ [OrderCard]                       │
│ [OrderCard]                       │
└─────────────────────────────────┘
[Bottom nav: डैशबोर्ड | ऑर्डर | कैटलॉग]
```

**Stat tile data binding:** From APIContract §7.9 `today.order_count` and `today.gross_earnings` (formatted per 3.2's rupee-display rule).

### 3.4 Rider Delivery Detail (AppFlow §7.2)

```
┌─────────────────────────────────┐
│ ← #SETU-20260612-0042            │
├─────────────────────────────────┤
│ [Map view, ~50% screen height]   │
│   📍 (pickup pin, forest)         │
│   📍 (drop pin, marigold)         │
│   🛵 (rider position, live)       │
├─────────────────────────────────┤
│ पिकअप: Ramesh General Store      │
│ मधेपुर                            │
│ • 2× Tata Salt                   │
│ • 1× Basmati Rice                │
├─────────────────────────────────┤
│ ड्रॉप: परसाद                     │
│ नीम के पेड़ के पास                │ ← large text, text.heading size
│                                   │   (this is THE critical info for
│                                   │   navigation — given visual priority)
├─────────────────────────────────┤
│ COD - ₹180                       │ ← prominent payment method badge
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │      पिकअप हो गया (Primary)   │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

**Offline state indicator (AppFlow §7.2):** When an action is queued offline, the primary button's label changes to include a small sync icon and "(सेव हो रहा है)" suffix, button remains in its "completed" visual state (not disabled-looking) — communicates "this worked, just waiting to sync," not "this failed."

**Persistent sync banner (AppFlow §7.3):** A thin banner (`color.marigold` background, `color.earth` text, `text.caption` size) appears below the header when queued actions exist: "X डिलीवरी सेव होने का इंतज़ार में" — persists across all Rider App screens until queue is empty, then auto-dismisses.

### 3.5 Admin Cash Reconciliation (AppFlow §8.3)

This is the one MVP screen that is **desktop-first** (Admin Dashboard is Next.js web, per SystemArchitecture §1) rather than mobile-first — design priorities shift slightly: information density is acceptable, smaller touch targets (32dp minimum, standard web) are fine since admins use mouse/trackpad.

```
┌──────────────────────────────────────────────────┐
│ नकद मिलान — 12 जून 2026          [तारीख बदलें ▾]  │
├──────────────────────────────────────────────────┤
│ राइडर        | COD डिलीवरी | अनुमानित | वास्तविक  │
│ Vikash Kumar |     6        |  ₹960    | [____]   │
│ Suresh Yadav |     4        |  ₹640    | [____]   │
├──────────────────────────────────────────────────┤
│ [प्रत्येक पंक्ति: सेव करें बटन]                    │
└──────────────────────────────────────────────────┘
```

**Discrepancy highlighting:** Once an admin enters "वास्तविक" (actual) and the computed discrepancy ≠ 0, that row's background shifts to a subtle `color.warning` tint (discrepancy > 0, i.e., less cash than expected) or a subtle blue tint (discrepancy < 0, more cash than expected — also worth flagging, could indicate a miscounted prior day). Discrepancy = 0 rows remain default background — no unnecessary green "success" coloring for the default-correct case (avoids visual noise across what should usually be a clean table).

---

## 4. Voice/Audio UI Patterns

Per Constitution III, voice is a primary interface, not decorative. This section specifies visual feedback patterns for voice interactions across the app.

### 4.1 Voice Search Activation (AppFlow §2.5)

| State | Visual |
|---|---|
| Idle | Microphone icon, `color.forest`, static |
| Listening | Microphone icon pulses (scale 1.0→1.15→1.0, 0.8s loop), background of search bar shifts to light `color.forest` tint |
| Processing | Microphone icon replaced with small spinner (same position, no layout shift) |
| Success | Brief checkmark flash (200ms) before transitioning to results screen |
| Failure | Microphone icon shows brief shake animation (signals "try again"), then returns to idle; error message appears below search bar per AppFlow §2.5 |

### 4.2 Future Voice Review Recording (Schema-present, MVP UI may defer per PRD A8)

Specified here for design-system completeness even though MVP may not surface it: a voice review recording UI would use a large circular record button (64dp, exceeding standard touch target — voice recording benefits from an unambiguous, hard-to-mis-tap large target), waveform visualization during recording, and playback controls before submission. **Not built for MVP** — included so that if V1 prioritizes this, the design pattern is pre-established and consistent with the rest of this system.

---

## 5. Responsive Behavior & Device Considerations

Per Execution Bible's device testing matrix (₹5,000 / ₹10,000 / ₹15,000 Android price tiers):

- **Minimum supported screen width:** 360dp (covers low-end devices like budget Android phones with HD 720×1280 displays at standard density)
- **Text scaling:** All `text.*` tokens use `sp` (scale-independent pixels) so they respect system font-size settings — some users may have increased system font size for readability; the layout must not break (no fixed-height containers around text that could clip at larger system font sizes)
- **Image loading:** All images (vendor covers, product photos) are served via Cloudflare CDN (SystemArchitecture §1) with responsive sizing — Flutter requests appropriately-sized images for the device's pixel density to minimize data usage (Constitution IV — bandwidth is a real cost for users)
- **Dark mode:** **Not implemented in MVP.** The `color.khaadi` warm-off-white background was deliberately chosen over stark white partly because it reduces the urgency for a dark mode (less harsh in low-light than pure white). Dark mode is a candidate for V1+ if user feedback indicates demand — not a Constitution-driven requirement either way.

---

## 6. What This Document Does NOT Cover

To keep this document focused and avoid duplicating other documents:

- **Exact pixel/dp measurements for every screen** — Section 3's ASCII layouts communicate structure and component composition; precise spacing follows Section 1.3's scale tokens, implemented in Flutter theme configuration (TechSpec.md)
- **Animation timing curves** — beyond the specific animations called out (status pulse, highlight animation, voice mic states), standard Flutter Material motion defaults apply
- **Admin Dashboard full screen inventory** — only the Cash Reconciliation screen (3.5) is detailed as a representative example of the desktop-first treatment; other Admin screens (Orders Overview, Vendor Approval — AppFlow §8.1, §8.2) follow the same density/touch-target conventions using standard table/panel patterns
- **Error/empty state illustrations as image assets** — referenced conceptually (e.g., "simple line-art shop icon") but actual asset creation is a design production task tracked in `ImplementationPlan.md`, not specified pixel-by-pixel here

---

*End of Designs.md — v1.0 (MVP Design System)*
