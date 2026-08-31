# SETU — AppFlow.md

**Document Class:** Product · Evolving (updated per feature addition)
**Owner:** Chief Product Officer / Product Manager
**Audience:** Designers, engineers, QA (test case derivation)
**Status:** v1.0 — MVP Flows
**Depends On:** PRD.md, Schema.md, SystemArchitecture.md

---

## 0. How to Use This Document

This document maps every MVP user journey screen-by-screen, including every error and edge-case branch. `Designs.md` will render the screens defined here; `TestingRequirements.md` will derive test scenarios directly from the branches documented here; `APIContract.md` will define the exact request/response shapes for each transition.

**Notation convention:** Each flow is presented as a numbered sequence of screens/states, with branches marked explicitly. `[Screen]` denotes a UI screen. `{API call}` denotes a backend interaction (cross-referenced to SystemArchitecture.md §2 step numbers where applicable). `→ ERROR:` denotes an error/edge-case branch with its resolution.

---

## 1. Customer App — Onboarding & Login Flow

### 1.1 First Launch

```
[Splash Screen] (SETU logo, ~1s)
   │
   ▼
[Phone Number Entry]
   - Single numeric input field, 10 digits
   - Hindi label: "अपना मोबाइल नंबर डालें"
   - "आगे बढ़ें" (Continue) button — disabled until 10 digits entered
   │
   ▼ {POST /api/v1/auth/otp/send}
   │
   ├─ SUCCESS → [OTP Entry Screen]
   │
   └─ → ERROR: Network failure
        Display: "कनेक्शन में समस्या है। फिर कोशिश करें।" (Connection issue, retry)
        Action: "फिर कोशिश करें" (Retry) button re-triggers same call
```

### 1.2 OTP Verification

```
[OTP Entry Screen]
   - 6-digit OTP input, auto-focus, numeric keypad
   - "OTP फिर भेजें" (Resend OTP) — disabled for 30s countdown, then enabled
   - Auto-read SMS permission requested (Android SMS Retriever API) to auto-fill
   │
   ▼ {POST /api/v1/auth/otp/verify}
   │
   ├─ SUCCESS, new user (no `users` row yet)
   │    → [Village Selection Screen] (Section 1.3)
   │
   ├─ SUCCESS, returning user (`users` row exists, `village_id` set)
   │    → [Home Screen] (Section 2.1)
   │
   ├─ → ERROR: Incorrect OTP
   │    Display: "गलत OTP। फिर से कोशिश करें।" (Wrong OTP, try again)
   │    Action: Clear input, remain on screen, allow retry (no attempt limit in MVP —
   │            rate limiting per APIContract.md handles abuse at API layer)
   │
   └─ → ERROR: OTP expired (>10 min)
        Display: "OTP की समय सीमा समाप्त हो गई। नया OTP भेजें।" (OTP expired, send new)
        Action: "नया OTP भेजें" button → returns to 1.1 send-OTP call
```

### 1.3 Village Selection (First-Time Only)

```
[Village Selection Screen]
   - Search/scroll list of villages where blocks.is_active = true → villages.is_active = true
     (per Schema.md §2.3, queried via PostGREST)
   - Each village shown with name only (Hindi script)
   - GPS-based suggestion: if location permission granted, nearest active village
     highlighted at top with "आपके पास" (Near you) tag
   │
   ▼ User taps a village
   │
   ▼ {Creates `users` row: role='customer', village_id=<selected>}
   ▼ {Creates default `user_addresses` row: village_id=<selected>, is_default=true}
   │
   ▼
[Name Entry — Optional]
   - "अपना नाम बताएं (वैकल्पिक)" (Tell us your name - optional)
   - "छोड़ें" (Skip) button always visible
   │
   ▼ → [Home Screen]

→ ERROR: No active villages found (block not yet launched)
   This should not occur in production (block must be active before app is
   distributed), but if it does:
   Display: "SETU अभी आपके क्षेत्र में उपलब्ध नहीं है।" (SETU not yet available in your area)
   Action: No further action possible — this is a distribution/config error,
           logged to audit_log for admin attention
```

---

## 2. Customer App — Discovery & Browsing Flow

### 2.1 Home Screen

```
[Home Screen]
   Layout (top to bottom):
   - Header: Village name (tappable → change village, with confirmation dialog
     since changing village may affect cart — see 2.4 edge case)
   - Voice search icon (microphone) + text search bar
   - Category grid (icons from `categories` table, sorted by sort_order,
     filtered is_active=true)
   - "आपके पास के दुकान" (Shops near you) — horizontal scroll of vendor cards,
     sorted by distance from user's default address
   │
   ▼ {GET /api/v1/discovery/categories}
   ▼ {GET /api/v1/discovery/vendors?village_id=X&sort=distance}
   │
   ├─ Tap category → [Vendor List Screen] (2.2), filtered by category
   ├─ Tap vendor card → [Vendor Detail Screen] (2.3)
   └─ Tap voice search icon → [Voice Search Active] (2.5)

→ ERROR: No vendors found in village (zero verified vendors)
   Display empty state: "अभी इस गाँव में कोई दुकान उपलब्ध नहीं है। जल्द ही आएंगी!"
   (No shops available in this village yet. Coming soon!)
   This is expected during early MVP rollout in villages with low vendor density —
   not an error condition requiring retry, but a genuine empty state.
```

### 2.2 Vendor List Screen (By Category)

```
[Vendor List Screen]
   - Header shows selected category name + back button
   - List of vendor cards: photo, business_name, rating (stars + review_count),
     open/closed badge (based on vendors.is_open — informational only per
     Schema §4.2 / PRD §7 Q4)
   - Sorted by distance from customer's default address
   │
   ▼ {GET /api/v1/discovery/vendors?category_id=X&village_id=Y}
   │
   ├─ Tap vendor card → [Vendor Detail Screen] (2.3)
   │
   └─ → EDGE CASE: Vendor shows "Closed" badge
        Vendor remains tappable (informational only, PRD §7 Q4 decision).
        On Vendor Detail Screen, a banner reads: "यह दुकान अभी बंद है, लेकिन आप
        ऑर्डर दे सकते हैं।" (This shop is currently closed, but you can place
        an order.) — vendor will see it when they reopen.
```

### 2.3 Vendor Detail Screen

```
[Vendor Detail Screen]
   - Cover image, business_name, category, rating
   - "बंद है" (Closed) banner if applicable (see 2.2 edge case)
   - Product grid: photo, name, price (formatted from paise → ₹X), unit
   - Each product: "+" button to add to cart
   │
   ▼ {GET /api/v1/discovery/vendors/:id}  → returns vendor + products
   │
   ├─ Tap "+" on a product → ADD TO CART (2.4)
   │
   └─ → ERROR: Product `is_available = false`
        Product card shown grayed out with "उपलब्ध नहीं" (Not available) label,
        "+" button hidden. Product remains visible (not removed from view) so
        customer knows the vendor sells this item generally.
```

### 2.4 Add to Cart — Single-Vendor Cart Enforcement

```
User taps "+" on Product A (Vendor X)
   │
   ▼ Check: is cart currently empty, OR does cart already contain items from Vendor X?
   │
   ├─ YES (empty or same vendor) → Add item to cart, show quantity stepper,
   │                                 floating cart summary bar appears at bottom
   │                                 of screen ("कार्ट देखें — ₹XX")
   │
   └─ NO (cart contains items from Vendor Y ≠ Vendor X)
        → [Dialog: "आपके कार्ट में Vendor Y की चीज़ें हैं"]
          ("Your cart has items from Vendor Y")
          Two options:
            - "कार्ट खाली करें और जोड़ें" (Clear cart and add) → clears cart,
              adds Product A from Vendor X
            - "रद्द करें" (Cancel) → dialog closes, no change

→ EDGE CASE: User changes village (from Home Screen header, 2.1) while cart
   has items
   → [Dialog: "गाँव बदलने से आपका कार्ट खाली हो जाएगा"]
     ("Changing village will clear your cart")
   Options: "जारी रखें" (Continue, clears cart + village) / "रद्द करें" (Cancel)
```

### 2.5 Voice Search Flow

```
[Voice Search Active] — microphone icon pulses, listening
   │
   ▼ User speaks (Hindi)
   │
   ▼ {POST /api/v1/ai/voice/transcribe} (audio → text via Whisper, per
     SystemArchitecture.md Phase 2 AI Service — but transcription endpoint
     itself is in MVP scope per PRD A4)
   │
   ├─ SUCCESS, transcription returned
   │    ▼ {GET /api/v1/discovery/search?q=<transcribed text>}
   │    │
   │    ├─ Results found → [Search Results Screen] (list of matching
   │    │                    vendors/products, same card format as 2.2)
   │    │
   │    └─ No results → Empty state: "कुछ नहीं मिला। श्रेणी से खोजें।"
   │                     (Nothing found. Browse by category.)
   │                     → Button returns to [Home Screen] category grid
   │
   └─ → ERROR: Transcription failed (audio unclear / API timeout)
        Display: "आवाज़ समझ नहीं पाए। फिर कोशिश करें या टाइप करें।"
        (Couldn't understand. Try again or type.)
        Action: Microphone icon resets to idle; text search bar gains focus
        as fallback (Constitution III — voice failure must not be a dead end,
        text remains available)
```

---

## 3. Customer App — Checkout & Order Placement Flow

### 3.1 Cart Review

```
[Cart Screen]
   - List of items: name, quantity stepper (+/-), unit price, line total
   - Subtotal (sum of line totals)
   - "ऑर्डर करें" (Place Order) button
   │
   ├─ User adjusts quantity to 0 → item removed from cart
   │    → EDGE CASE: Last item removed → cart empty → [Empty Cart State]
   │       "आपका कार्ट खाली है" with button back to Home
   │
   └─ Tap "ऑर्डर करें" → [Checkout Screen] (3.2)
```

### 3.2 Checkout Screen

```
[Checkout Screen]
   - Delivery address: shows default address (village + landmark if set);
     "बदलें" (Change) link → [Address Selection/Edit] (not detailed here —
     simple list of user_addresses + add-new form, standard pattern)
   - Special instructions text field (optional) — maps to orders.special_instructions
   - Order summary: subtotal, delivery_fee (flat rate per ADR/PRD §7 Q3,
     displayed clearly), total
   - Payment method selector:
       ◉ "कैश ऑन डिलीवरी (COD)" — pre-selected (Constitution II)
       ○ "ऑनलाइन भुगतान (UPI)"
   - "ऑर्डर पक्का करें" (Confirm Order) button
   │
   ├─ COD selected → tap Confirm
   │    ▼ {POST /api/v1/orders} with payment_method='cod'
   │    │  (SystemArchitecture.md §2, steps 2-3)
   │    │
   │    ├─ SUCCESS → [Order Confirmation Screen] (3.3)
   │    │
   │    └─ → ERROR: Product became unavailable between cart and checkout
   │         (vendor marked is_available=false in the interim)
   │         API returns 409 Conflict with details of which item(s)
   │         Display: [Dialog] "माफ़ करें, '<item name>' अब उपलब्ध नहीं है।"
   │         (Sorry, '<item>' is no longer available.)
   │         Action: "ठीक है, हटाएं" (OK, remove) → item removed from cart,
   │         returns to Cart Screen (3.1) for review before retry
   │
   └─ UPI selected → tap Confirm
        ▼ {POST /api/v1/orders} with payment_method='upi'
           → Backend creates orders row (payment_status='pending') AND
             initiates Razorpay order via PaymentService
           → Returns Razorpay order details to client
        │
        ▼ [Razorpay Payment Sheet opens] (native SDK UI)
        │
        ├─ Payment SUCCESS
        │    ▼ {POST /api/v1/payments/verify}
        │    → transactions row created (status='success'),
        │      orders.payment_status='paid'
        │    → [Order Confirmation Screen] (3.3)
        │
        ├─ Payment FAILED / cancelled by user
        │    → orders row remains payment_status='pending' (NOT 'failed' —
        │      see note below)
        │    Display: [Dialog] "भुगतान पूरा नहीं हुआ।" (Payment not completed)
        │    Options: "फिर कोशिश करें" (Retry — reopens Razorpay sheet for
        │    same order) / "कैश ऑन डिलीवरी से ऑर्डर करें" (Order with COD
        │    instead — converts this order's payment_method to 'cod' via
        │    a dedicated endpoint, see APIContract.md)
        │
        └─ → ERROR: Network failure during Razorpay verification
             (payment may have succeeded on Razorpay's side but verification
             call failed)
             Display: "भुगतान की पुष्टि नहीं हो पाई। कृपया प्रतीक्षा करें।"
             (Payment confirmation pending, please wait)
             Action: Poll {GET /api/v1/orders/:id} every 5s for up to 30s to
             check if payment_status updated via webhook (PaymentService
             webhook handler may have processed it independently of the
             client-side verify call). If still 'pending' after 30s, show
             support contact (WhatsApp number) — this is the one MVP flow
             where a manual ops fallback is explicitly acceptable per
             Execution Bible's "what stays manual" principle.

NOTE on payment_status='pending' vs 'failed': An order is only marked
'failed' by an explicit failure signal from Razorpay (webhook), never by
client-side cancellation alone — this prevents a scenario where a user
closes the payment sheet after actually completing payment, and the order
is incorrectly marked failed. 'pending' allows retry; 'failed' (set via
webhook with explicit failure reason) does not.
```

### 3.3 Order Confirmation Screen

```
[Order Confirmation Screen]
   - Large checkmark animation
   - "आपका ऑर्डर मिल गया!" (Your order has been received!)
   - Order number (orders.order_number)
   - Estimated delivery time (if estimated_delivery_at is set — MVP may leave
     this null initially and show a generic "लगभग 45 मिनट" / ~45 min message
     instead, per AppFlow decision deferring exact ETA calculation)
   - "ऑर्डर ट्रैक करें" (Track Order) button → [Order Tracking Screen] (4.1)
   - "होम पर जाएं" (Go Home) button → [Home Screen] (2.1), cart is cleared
```

---

## 4. Customer App — Order Tracking Flow

### 4.1 Order Tracking Screen

```
[Order Tracking Screen]
   - Visual status stepper showing 5 stages:
     प्राप्त (Placed) → स्वीकृत (Confirmed) → उठाया गया (Picked Up) →
     रास्ते में (On the way) → पहुंचा (Delivered)
   - Current stage highlighted; completed stages shown with checkmarks
   - If status >= 'picked_up': map view showing rider's live location
     (via Supabase Realtime subscription) + drop location pin
   - Order items summary (collapsed, expandable)
   - Vendor name + (if status='confirmed' or later) a note: vendor contact
     is handled via SETU, no direct customer-vendor calling in MVP
   │
   ▼ {GET /api/v1/orders/:id/track} (initial load)
   ▼ Realtime subscription to `orders` row + `deliveries` row for live updates
   │
   ├─ Status transitions trigger:
   │    - Stepper animation advances
   │    - Push notification received (NotificationService, per
   │      SystemArchitecture.md §2 steps 7, 9, 12)
   │
   ├─ Status = 'delivered' → [Rating Prompt] (4.2) appears as overlay
   │
   ├─ Status = 'cancelled'
   │    Display: Stepper replaced with cancellation message:
   │    "आपका ऑर्डर रद्द कर दिया गया। कारण: <cancel_reason translated>"
   │    (Your order was cancelled. Reason: <reason>)
   │    If payment_method was 'upi' and payment_status='paid':
   │      additional line: "आपका पैसा वापस किया जा रहा है।" (Your payment is
   │      being refunded.) — orders.payment_status moves to 'refund_pending'
   │      (manual refund process per PRD §4.3, but customer sees this status
   │      message regardless)
   │
   └─ → ERROR: Realtime connection drops (customer's own connectivity issue)
        Tracking screen shows last-known status (no error dialog — this is
        expected/common). A small "अपडेट हो रहा है..." (Updating...) indicator
        appears in the header. On reconnect, Realtime subscription
        re-establishes automatically and screen refreshes silently.
```

### 4.2 Rating Prompt (Post-Delivery)

```
[Rating Prompt — Overlay on Tracking Screen]
   - "<Vendor name> को रेट करें" (Rate <Vendor name>)
   - 5-star tap selector for vendor_rating
   - If rider_id is set: separate 5-star selector for rider_rating, labeled
     "डिलीवरी को रेट करें" (Rate the delivery)
   - Optional text field: "कुछ कहना चाहते हैं? (वैकल्पिक)" (Want to say
     something? Optional)
   - "जमा करें" (Submit) button
   - "बाद में" (Later) — dismisses overlay
   │
   ├─ Submit → {POST /api/v1/reviews}
   │    → reviews row created, vendors.rating/review_count updated via trigger
   │    → Overlay closes, brief "धन्यवाद!" (Thank you!) toast
   │
   └─ "बाद में" tapped
        → Overlay dismissed
        → EDGE CASE (per PRD A8): Next time app is opened, if this order's
          review still doesn't exist, prompt reappears ONCE on Home Screen
          as a non-blocking banner: "अपना पिछला ऑर्डर रेट करें" (Rate your
          last order) — tapping it returns to this overlay. After this
          second prompt, no further reminders (avoids notification fatigue).
```

---

## 5. Vendor App — Order Management Flow

### 5.1 Vendor Dashboard (Home)

```
[Vendor Dashboard]
   - Today's summary: order count, gross earnings (sum of delivered orders'
     totals for today, formatted from paise)
   - "नए ऑर्डर" (New Orders) section — list of status='pending' orders for
     this vendor, sorted oldest-first
   - Bottom nav: Dashboard | Orders | Catalog
   │
   ▼ {GET /api/v1/vendor/orders?status=pending} (initial load)
   ▼ Realtime subscription to orders where vendor_id = self
   │
   ├─ New pending order arrives (Realtime push)
   │    → Order appears at top of "नए ऑर्डर" list with a brief highlight
   │      animation + notification sound
   │    → Push notification + WhatsApp message also sent (SystemArchitecture
   │      §2 step 4) — Realtime in-app update and external notifications are
   │      complementary, not redundant: vendor may not have app open
   │
   └─ Tap an order → [Order Detail Screen] (5.2)
```

### 5.2 Order Detail Screen (Vendor View)

```
[Order Detail Screen — Vendor]
   - Order number, time placed
   - Items list: name, quantity, unit price, line total (vendor sees same
     snapshot data as customer — order_items table)
   - Customer's delivery address: village + landmark (NOT full precise
     address/phone — vendor doesn't need customer's phone number in MVP;
     all customer communication flows through SETU per PRD §4.3)
   - Special instructions (if any)
   - Two large buttons: "स्वीकार करें" (Accept) / "अस्वीकार करें" (Reject)
     — only shown if status='pending'
   │
   ├─ Tap "स्वीकार करें" (Accept)
   │    ▼ {PATCH /api/v1/vendor/orders/:id} → status='confirmed'
   │    → SystemArchitecture §2 step 6-7 (customer notified, admin sees
   │      order ready for rider assignment)
   │    → Screen updates: Accept/Reject buttons replaced with status
   │      indicator "स्वीकृत — डिलीवरी की तैयारी करें" (Confirmed — prepare
   │      for delivery)
   │
   └─ Tap "अस्वीकार करें" (Reject)
        ▼ [Reason Selection Dialog]
          Options (radio buttons):
            - "स्टॉक खत्म है" (Out of stock)
            - "बंद हो रहे हैं" (Closing soon)
            - "अन्य" (Other) → reveals text field for free-text reason
        ▼ {PATCH /api/v1/vendor/orders/:id} → status='cancelled',
           cancel_reason=<selected>
        → Customer notified (4.1 cancelled branch)
        → → EDGE CASE: If orders.payment_status='paid' (UPI), this rejection
          triggers orders.payment_status='refund_pending'. Vendor sees a
          note: "ग्राहक का पैसा वापस किया जाएगा।" (Customer's payment will
          be refunded.) — refund itself is a manual admin process (PRD §4.3),
          but the status change and customer-facing messaging happen
          automatically.
```

---

## 6. Vendor App — Catalog Management Flow

### 6.1 Catalog List

```
[Catalog Screen]
   - List of vendor's products: photo thumbnail, name, price, availability
     toggle switch
   - Floating "+" button → [Add Product Screen] (6.2)
   │
   ▼ {GET /api/v1/vendor/products}
   │
   ├─ Toggle availability switch
   │    ▼ {PATCH /api/v1/vendor/products/:id} → is_available=<toggled>
   │    → Immediate visual feedback (switch animates), no confirmation dialog
   │      (low-friction per Constitution II/V — vendor needs to do this
   │      quickly, multiple times a day)
   │
   └─ Tap product row → [Edit Product Screen] (same form as 6.2, pre-filled)
```

### 6.2 Add/Edit Product Screen

```
[Add Product Screen]
   - Photo picker (camera or gallery) — first photo becomes primary
     image_urls[0]
   - Name field (Hindi keyboard default)
   - Price field (numeric, displayed in ₹, converted to paise on submit —
     ADR-002)
   - Unit selector (dropdown: piece, kg, litre, etc. — from a small fixed
     list; not a separate table in MVP, just an enum-like dropdown matching
     Schema's free-text `unit` column)
   - Category selector (dropdown from `categories` table)
   - "सेव करें" (Save) button
   │
   ▼ {POST /api/v1/vendor/products} (new) or {PATCH /api/v1/vendor/products/:id} (edit)
   │
   ├─ SUCCESS → returns to [Catalog Screen] (6.1), new/updated item visible
   │
   └─ → ERROR: Photo upload failure (poor connectivity during upload)
        Product save is NOT blocked on photo upload completing — product
        record is created/updated with image_urls=[] or existing images,
        and photo upload retries in background (queued, per offline-tolerant
        patterns). A small "फोटो अपलोड हो रही है..." (Photo uploading...)
        indicator shows on the product row in Catalog Screen until complete.
        Rationale: Constitution IV — a connectivity hiccup must not block
        the vendor from saving a price change just because a photo is
        attached to the same form submission.
```

---

## 7. Rider App — Delivery Execution Flow

### 7.1 Active Deliveries List

```
[Rider Home / Active Deliveries]
   - List of deliveries where rider_id = self AND status IN ('assigned',
     'picked_up')
   - Each card: order number, vendor name + village (pickup), customer
     village + landmark (drop), item count
   │
   ▼ {GET /api/v1/rider/available-orders} — naming note: in MVP with
     admin-only assignment (ADR-003), this endpoint effectively returns
     "my assigned orders," not a marketplace of unclaimed orders. The
     endpoint name is preserved from the original API catalog for
     forward-compatibility with V1 self-assignment, but MVP behavior is
     "orders assigned to me."
   │
   └─ Tap a delivery card → [Delivery Detail Screen] (7.2)
```

### 7.2 Delivery Detail Screen

```
[Delivery Detail Screen]
   - Map showing: rider's current location (GPS), pickup pin (vendor), drop
     pin (customer address)
   - Offline map tiles for Madhepur block pre-downloaded (Constitution IV) —
     map renders even without connectivity
   - Pickup details: vendor name, village, item list (so rider can verify
     items at pickup)
   - Drop details: village + landmark (large text, since this is the
     critical navigation info)
   - Order's payment_method shown prominently: "COD - ₹XXX" or "ऑनलाइन भुगतान
     हो गया" (Paid online)
   - Primary action button — label depends on current status:
       - If status='assigned' (deliveries.status): "पिकअप हो गया" (Picked up)
       - If status='picked_up': "डिलीवर हो गया" (Delivered)
   │
   ├─ Tap "पिकअप हो गया" (status='assigned' → 'picked_up')
   │    ▼ {POST /api/v1/rider/orders/:id/pickup}
   │    → orders.status='picked_up', deliveries.picked_at=now(),
   │      deliveries.status='picked_up'
   │    → (Per SystemArchitecture §2 note) orders.status may also be set to
   │      'on_the_way' at this same step — AppFlow decision: YES, for MVP,
   │      'picked_up' and 'on_the_way' are combined into a single rider
   │      action. The customer tracking stepper (4.1) shows both stages
   │      advancing together. This avoids requiring a second rider action
   │      for a transition that adds no operational value in a small block
   │      where pickup-to-departure is nearly instantaneous.
   │    → Button label updates to "डिलीवर हो गया" (Delivered)
   │
   │    → IF OFFLINE when tapped:
   │         Action queued locally (Hive/Isar). Button shows "✓ पिकअप (सेव
   │         हो रहा है)" (Pickup ✓, saving...) with a small sync icon.
   │         On reconnect, queued action POSTs automatically; sync icon
   │         disappears once server confirms.
   │
   └─ Tap "डिलीवर हो गया" (status='picked_up' → 'delivered')
        → [Delivery Confirmation Flow] (7.3)
```

### 7.3 Delivery Confirmation Flow

```
[Delivery Confirmation — Step 1: Photo]
   - Camera opens directly (not gallery — must be a fresh photo, per PRD C3
     "mandatory photo proof")
   - "डिलीवरी की फोटो लें" (Take delivery photo)
   - Photo preview with "फिर लें" (Retake) / "ठीक है" (OK) options
   │
   ▼ Photo confirmed
   │
   ├─ IF orders.is_cod = true → [Step 2: COD Amount Entry]
   │    - Large numeric input, pre-filled with orders.total (converted to ₹)
   │      as a default/suggestion
   │    - "प्राप्त राशि" (Amount received) label
   │    - Rider can adjust if customer paid a different amount (edge case:
   │      change-making, partial payment disputes — these are logged as-is;
   │      reconciliation discrepancy handling is an admin/D4 process, not
   │      blocked here)
   │    - "पुष्टि करें" (Confirm) button
   │
   └─ IF orders.is_cod = false (UPI, already paid) → skip to submission
        directly (no COD entry needed)
   │
   ▼ {POST /api/v1/rider/orders/:id/deliver} with photo + cod_amount (if applicable)
   │
   → orders.status='delivered', delivered_at=now()
   → deliveries.delivery_photo_url set, delivered_at=now()
   → IF COD: orders.cod_collected=true, orders.cod_amount=<entered value>
   → Customer notified (4.1 → rating prompt 4.2)
   │
   ▼ [Delivery Complete Screen]
   - "डिलीवरी पूरी हुई!" (Delivery complete!)
   - Shows rider_earnings for this delivery (if calculated — MVP may show
     a flat per-delivery rate configured at block level, per Execution
     Bible ₹25-30/delivery structure; exact calculation is APIContract.md
     concern)
   - "अगली डिलीवरी" (Next delivery) button → back to [Active Deliveries List]
     (7.1)

   → IF OFFLINE during this entire flow:
        Photo is stored locally (device storage), COD amount captured
        locally. Entire delivery-confirmation payload queued. [Delivery
        Complete Screen] still shows (rider needs to move on to next
        delivery regardless of sync status), with a persistent small
        banner: "X डिलीवरी सेव होने का इंतज़ार में" (X deliveries waiting to
        sync) — visible across the Rider App until sync completes.

   → → SYNC CONFLICT EDGE CASE (Constitution IV / Schema note):
        If, while rider was offline, an admin reassigned this order to a
        different rider (rare, but possible if rider was unreachable and
        admin intervened), the queued "deliver" action will be rejected by
        the server on sync with a conflict response.
        Display: [Dialog] "यह ऑर्डर किसी और को सौंपा गया है। कृपया एडमिन से
        बात करें।" (This order has been reassigned. Please contact admin.)
        The locally-captured photo/COD data is retained on-device (not
        discarded) and an audit_log entry is created server-side noting the
        conflict, so admin can manually reconcile (e.g., if the rider did
        in fact complete the delivery before reassignment — a rare race
        condition resolved via human judgment, consistent with Constitution
        X's "system survives founder" via documented manual-resolution
        paths for edge cases too rare to fully automate).
```

---

## 8. Admin Dashboard — Operations Flow

### 8.1 Orders Overview

```
[Admin: Orders Tab]
   - Table view, columns: Order #, Customer (village), Vendor, Status,
     Payment, Created time
   - Filter dropdown: status (default view: 'confirmed' — i.e., orders
     awaiting rider assignment, the admin's primary actionable queue)
   - Row click → [Order Detail Panel] (side panel or modal)
   │
   ▼ {GET /api/v1/admin/orders?status=confirmed&block_id=<admin's block>}
   │  (RLS enforces block-scoping per Schema §12)
   │
   └─ [Order Detail Panel]
        - Full order details (items, customer address with landmark, vendor)
        - "राइडर असाइन करें" (Assign Rider) dropdown — lists riders where
          role='rider' AND is_active=true AND village_id near delivery
          address (simple proximity filter; exact "near" definition is
          APIContract.md concern, MVP may simply list all active riders in
          the block without distance sorting — admin has local knowledge)
        │
        ▼ {PATCH /api/v1/admin/orders/:id/assign}
        → orders.rider_id set, deliveries row created (status='assigned')
        → Rider notified (push + the order appears in their Active
          Deliveries list, 7.1)
        → Panel closes, order row updates status indicator to show
          "राइडर असाइन किया गया" (Rider assigned)
```

### 8.2 Vendor Approval Flow

```
[Admin: Vendors Tab]
   - Two sections: "स्वीकृति बाकी" (Pending Approval) and "सक्रिय" (Active)
   - Pending section shows vendors where is_verified=false
   │
   ▼ {GET /api/v1/admin/vendors?is_verified=false}
   │
   └─ Tap a pending vendor → [Vendor Review Panel]
        - Business name, category, submitted address, FSSAI/GST if provided
        - "स्वीकार करें" (Approve) / "अस्वीकार करें" (Reject) buttons
        │
        ├─ Approve → {PATCH /api/v1/admin/vendors/:id/verify} → is_verified=true
        │    → Vendor becomes visible in customer-facing vendor lists (2.2)
        │    → Vendor notified via WhatsApp: "आपकी दुकान SETU पर लाइव है!"
        │      (Your shop is live on SETU!)
        │
        └─ Reject → [Reason text field] → {PATCH .../verify} with rejection
             → Vendor notified with reason via WhatsApp
             → audit_log entry created (Schema §11, Constitution X)
```

### 8.3 COD Reconciliation View

```
[Admin: Cash Reconciliation Tab]
   - Date selector (default: today)
   - Per-rider table: Rider name, # COD deliveries today, expected cash
     (sum of orders.total where rider_id=X, is_cod=true, status='delivered',
     for selected date), actual cash entry field
   │
   ▼ {GET /api/v1/admin/cash?date=<selected>&block_id=<admin's block>}
   │
   ├─ Admin enters "actual cash received" per rider (manual count, end of
   │    day per Execution Bible §5 daily ops rhythm)
   │    ▼ Discrepancy = expected - actual
   │    → If discrepancy ≠ 0, row highlighted in amber/red
   │    → This entry itself is NOT yet schema-backed by a dedicated table in
   │      MVP (no `cash_reconciliation` table in Schema.md v1.0) — for MVP,
   │      this view computes "expected" from existing `orders`/`deliveries`
   │      data and "actual" entry is logged to audit_log as a structured
   │      entry (action='cash.reconciled', new_values={rider_id, date,
   │      expected, actual, discrepancy}). A dedicated table is a candidate
   │      V1 schema addition if reconciliation reporting needs grow beyond
   │      what audit_log queries comfortably support — flagged here for
   │      Schema.md's next revision discussion, not actioned in v1.0.
   │
   └─ → EDGE CASE: Rider has zero COD deliveries for the date → row shows
        "0" expected, actual field still enterable (defensive — handles
        any cash a rider might be holding from a prior day's
        discrepancy, logged as a note)
```

---

## 9. Notification Trigger Map

This table is the canonical reference for "what event sends what notification to whom" — referenced by `NotificationService` (SystemArchitecture.md §1.2) and `ErrorHandlingGuide.md`.

| Event | Recipient | Channel(s) | Notification Type (`notifications.type`) | Message Summary |
|---|---|---|---|---|
| Order created | Vendor | Push + WhatsApp | `new_order` | "नया ऑर्डर मिला" (New order received) |
| Order confirmed (vendor accepts) | Customer | Push | `order_confirmed` | "आपका ऑर्डर स्वीकार हो गया" |
| Order rejected/cancelled | Customer | Push + WhatsApp | `order_cancelled` | "आपका ऑर्डर रद्द हुआ। कारण: ..." |
| Rider assigned | Rider | Push | `delivery_assigned` | "नई डिलीवरी असाइन हुई" |
| Rider assigned | Customer | Push | `rider_assigned` | "राइडर असाइन हुआ" |
| Order picked up | Customer | Push | `order_picked_up` | "आपका ऑर्डर रास्ते में है" |
| Order delivered | Customer | Push + WhatsApp | `order_delivered` | "आपका ऑर्डर पहुंच गया!" |
| Order delivered | Vendor | Push | `order_completed` | "ऑर्डर पूरा हुआ" |
| Vendor approved | Vendor | WhatsApp | `vendor_approved` | "आपकी दुकान लाइव है!" |
| Vendor rejected | Vendor | WhatsApp | `vendor_rejected` | "आवेदन अस्वीकृत। कारण: ..." |
| Payment refund initiated | Customer | Push | `refund_initiated` | "रिफंड प्रक्रिया में है" |

**Note on WhatsApp dependency:** Every WhatsApp notification has a Push equivalent or is paired with Push — WhatsApp delivery is not guaranteed (rate limits, opt-outs) and the app's own push notifications + in-app status (Realtime) must independently convey the same information. WhatsApp is a *reinforcement* channel per Constitution's trust-building rationale, not the sole channel for any critical status.

---

## 10. Cross-Cutting Edge Cases

These apply across multiple flows above and are documented once here for clarity, referenced by section number elsewhere.

### 10.1 App Version Mismatch
If a client app's version is significantly behind (per `X-App-Version` header, SystemArchitecture/APIContract concern), any API call may return a `426 Upgrade Required` response. All flows above should handle this uniformly: a full-screen "अपडेट करें" (Update) prompt with a Play Store link, blocking further use. This is referenced here once; individual flow sections do not repeat it.

### 10.2 Session Expiry Mid-Flow
If a JWT expires during any flow (e.g., customer mid-checkout), the API returns `401 Unauthorized`. The app attempts silent token refresh (per SystemArchitecture/APIContract token refresh flow); if refresh also fails, the user is returned to [Phone Number Entry] (1.1) with their cart/in-progress action preserved in local storage where possible (cart contents specifically — Section 3.1 — survive a re-login).

### 10.3 Concurrent Order Status Changes
If two admins (in a future multi-admin scenario) attempt to assign different riders to the same order simultaneously, the second `PATCH /api/v1/admin/orders/:id/assign` call should fail with a `409 Conflict` if `rider_id` is already non-null, with a response indicating the current assignee — admin UI (8.1) shows "यह ऑर्डर पहले से असाइन है" (This order is already assigned) and refreshes the row.

---

*End of AppFlow.md — v1.0 (MVP Flows)*
