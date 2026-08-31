# SETU — PRD.md (Product Requirements Document)

**Document Class:** Foundation · Evolving (revised per major version)
**Owner:** Chief Product Officer / Founder
**Audience:** Engineers, designers, QA, investors
**Status:** v1.0 — MVP Scope
**Depends On:** Constitution.md

---

## 0. How to Use This Document

This PRD translates Constitution.md's principles into a concrete, buildable product definition for **MVP (v0.1)**. Every feature listed here must be traceable to a Constitution commandment or a user need validated through ground execution (vendor mapping, customer interviews, 50+ manual WhatsApp deliveries — per the Execution Bible).

This document defines **MVP only**. Future versions (V1–V4) are scoped in `FeaturesRoadmap.md`, which this PRD feeds into.

If a feature request arrives that is not in this PRD's in-scope list, it does not get built for MVP — regardless of how easy it seems — unless this PRD is formally revised.

---

## 1. Problem Statement

Rural consumers, vendors, service providers, and delivery workers in Madhepur–Laxmipur–Parsad (Madhubani district, Bihar) lack:

1. **Discovery** — Customers cannot easily find what local vendors sell or what local service providers offer.
2. **Logistics** — There is no organized, reliable delivery infrastructure connecting customers to nearby vendors.
3. **Trust mechanisms** — Existing digital trust signals (star ratings, anonymous reviews) don't map to how trust actually works in this community.
4. **Payment flexibility** — Most residents are COD-first; platforms that force digital payment exclude them.
5. **Language/literacy accessibility** — Text-heavy, English-first or even Hindi-text-only interfaces exclude users who are most comfortable with voice in Maithili/Bhojpuri/Hindi.

SETU's MVP exists to prove, in one block (Madhepur), that a platform designed around these five realities — rather than around urban assumptions — can create a reliable, trusted, repeatedly-used commerce and delivery experience.

---

## 2. User Personas

### Persona 1: The Customer ("Sunita")
- 28–45 years old, lives in Parsad or Madhepur chowk area
- Owns a ₹6,000–10,000 Android smartphone, moderate literacy
- Comfortable with WhatsApp, voice notes; less comfortable with typing long text
- Currently buys groceries/food by walking to local shops; would value home delivery for convenience, especially during monsoon or for bulk/heavy items
- Prefers COD; UPI familiarity is growing but not default
- Trusts recommendations from neighbors and known community members far more than star ratings

### Persona 2: The Vendor ("Ramesh Bhaiya")
- Runs a grocery, tea stall, or small eatery at Madhepur chowk
- Has a smartphone with WhatsApp; minimal experience with "apps" beyond WhatsApp and YouTube
- Wants more customers but has no way to reach beyond foot traffic
- Cannot invest time in complex catalog management — needs near-zero-effort onboarding
- Cares about: will this actually bring me orders, and will I get paid reliably

### Persona 3: The Rider ("Vikash")
- 19–28 years old, local resident of Madhepur or nearby village
- Owns a bike, has a smartphone
- Looking for supplemental or primary income via deliveries
- Knows the local lanes better than any map
- Needs the app to work even when network is patchy mid-route

### Persona 4: The Seva Provider (Phase 2 — referenced for context, not built in MVP)
- Plumbers, electricians, tailors — referenced here because AppFlow and Schema must not preclude this persona, even though SETU Seva is not part of MVP scope (see Section 4).

---

## 3. Success Metrics (MVP)

These metrics are drawn directly from the Execution Bible's operational discipline targets. MVP is considered successful when, over a sustained 2-week period in Madhepur block:

| Metric | Target | Source |
|---|---|---|
| Order fulfillment rate | >95% | Operational Discipline (Execution Bible §8) |
| On-time delivery rate | >90% | Operational Discipline |
| Customer 30-day repeat rate | >40% | Operational Discipline |
| Average delivery time | <45 min | Operational Discipline |
| COD cash accuracy | 100% | Operational Discipline |
| Vendor response time | <15 min | Operational Discipline |
| Customer rating average | >4.2/5 | Operational Discipline |
| Daily active vendors | >80% of listed | Operational Discipline |

**Gate to V1:** All metrics above sustained for 30 consecutive days before FeaturesRoadmap.md's V1 scope (SETU Seva, vendor subscriptions, voice search) begins development — per Constitution Commandment VIII.

---

## 4. MVP Scope

### 4.1 In Scope — The 15 Non-Negotiables

These map directly to the Execution Bible's MVP feature list. Each is mandatory; MVP is not "done" until all 15 function end-to-end on a real device with a real order.

1. Phone number + OTP login (no passwords, no email)
2. Village/location selection on first open
3. Vendor list by category (visual grid, photo-forward)
4. Product catalog per vendor (photo + name + price; voice description optional field in schema even if not surfaced in MVP UI)
5. Add to cart (single-vendor cart only — see 4.3)
6. Order summary + checkout
7. COD payment option (mandatory, default)
8. UPI payment option (via Razorpay)
9. WhatsApp order confirmation to customer and vendor
10. Order status tracking — 5 states: `placed → confirmed → picked_up → on_the_way → delivered` (plus `cancelled`/`failed` as terminal states)
11. Vendor dashboard (today's orders: pending / accepted / completed; basic earnings total)
12. Rider assignment (admin manually assigns via Admin Dashboard in MVP — not automated)
13. Simple 1–5 star review after delivery (voice review URL field present in schema for future use)
14. Admin Dashboard (view all orders, assign riders, manage vendor approval status)
15. Basic push notification (order confirmed, rider assigned, delivered) via FCM

### 4.2 In Scope — Supporting Requirements (Non-Functional)

- **Voice-capable search** for product/vendor discovery (Constitution III) — even a simple keyword-matching implementation via Whisper transcription is in scope; full NLU is not.
- **Offline-capable Rider App** (Constitution IV) — order acceptance, navigation, and delivery confirmation must queue and sync when connectivity returns. This is in scope for MVP because it is foundational, not deferrable.
- **COD reconciliation flow** (Constitution II) — daily cash log per rider, with photo-proof delivery confirmation, is in scope from Day 1.
- **Hindi as default language**, Maithili strings present in schema (`name_maithili` fields etc.) but UI translation to Maithili may lag MVP — see 4.4.

### 4.3 Explicitly Out of Scope for MVP

The following are deliberately deferred. Each has a trigger condition (defined in FeaturesRoadmap.md) for reconsideration — they are not "maybe later," they are "not until X is true."

| Feature | Why deferred | Reconsider when |
|---|---|---|
| Multi-vendor cart | Adds significant checkout/delivery-routing complexity; single-vendor orders are the proven manual-ops pattern | Single-vendor order fulfillment rate >95% sustained |
| SETU Seva (services marketplace) | Different trust/verification model (Persona 4); no ground-validated demand yet | Commerce-side metrics hit V1 gate |
| Vendor subscription tiers | Vendors must first experience free value before being asked to pay | 50+ active vendors with demonstrated platform value |
| AI recommendations | No data to train on yet | 1,000+ completed orders |
| Loyalty points / referral code automation | Manual tracking (Google Sheet, per Execution Bible) is sufficient at MVP volume | 100+ registered users |
| Real-time chat (customer↔vendor) | WhatsApp already serves this function | Never — likely permanently deferred unless WhatsApp dependency becomes a liability |
| Returns/refund automation | Case-by-case WhatsApp resolution is sufficient at MVP volume | 50+ orders/day sustained |
| Coupon/promo engine | No pricing strategy requiring this yet | V1+ when vendor subscriptions create a need for promotional tooling |
| Multiple payment wallets beyond Razorpay (UPI/cards) + COD | Razorpay covers the realistic MVP payment surface | Never for MVP; revisit only if Razorpay reliability issues emerge |
| iOS app | Android is >95% of target user base | V2+ when expansion geography justifies it |

### 4.4 Language Scope Note

Per Constitution III, voice is the primary interface and Maithili support is a long-term commitment. For MVP specifically:

- **Schema** must include Maithili-language fields (`name_maithili`, etc.) from Day 1 — per Constitution VI (data architecture should not require painful retrofits).
- **UI text** for MVP ships in Hindi as the default/only language. Maithili UI translation is a V1 commitment, not an MVP blocker — but the architecture must not make adding it expensive later.
- **Voice input/output** in MVP targets Hindi; Maithili voice support follows the same V1 timeline as UI translation.

---

## 5. User Stories with Acceptance Criteria

### Epic A: Customer Ordering Journey

**A1 — As a customer, I want to log in using just my phone number, so that I don't need to remember a password.**
- Given I open the app for the first time, I am prompted for my phone number
- When I enter a valid 10-digit number, an OTP is sent via SMS
- When I enter the correct OTP, I am logged in and taken to village selection (if first login) or home (if returning)
- If OTP is incorrect, I see an error in Hindi and can retry
- *Constitution link: II (no forced digital complexity), III (low-literacy friendly — numeric input only)*

**A2 — As a customer, I want to select my village so that I see vendors near me.**
- Given I am logging in for the first time, I see a list/search of villages within Madhepur block
- When I select my village, my default address is set to that village's coordinates
- I can add more specific address details (landmark) later, but village selection alone is sufficient to proceed
- *Constitution link: I (hyperlocal trust starts with hyperlocal geography)*

**A3 — As a customer, I want to browse vendors by category, so that I can find what I need quickly.**
- Given I am on the home screen, I see category icons/tiles (Grocery, Cooked Food, Vegetables, etc. — final category list defined during vendor mapping, per Execution Bible §3)
- When I tap a category, I see a list of vendors in that category, sorted by distance from my village
- Each vendor card shows: name, photo, category, rating (if any), open/closed status
- *Constitution link: III (visual-first browsing for low-literacy users)*

**A4 — As a customer, I want to search using my voice, so that I don't need to type.**
- Given I am on the home or search screen, I can tap a microphone icon
- When I speak a product or vendor name in Hindi, the app transcribes it (via Whisper) and shows matching results
- If transcription fails or no results match, I see a friendly Hindi message suggesting I browse by category instead
- *Constitution link: III (voice is primary interface)*

**A5 — As a customer, I want to view a vendor's products and add items to my cart.**
- Given I am viewing a vendor's page, I see their product catalog (photo, name, price, unit)
- When I tap a product, I can adjust quantity and add it to cart
- My cart can only contain items from one vendor at a time (per 4.3 — multi-vendor cart is out of scope); if I try to add an item from a different vendor, I am prompted to either clear my current cart or cancel
- *Constitution link: V (single-vendor cart matches proven manual ops pattern)*

**A6 — As a customer, I want to choose COD or UPI at checkout, with COD as the default.**
- Given I am at checkout with items in my cart, I see two payment options: "Cash on Delivery" (pre-selected) and "Pay Online (UPI)"
- If I choose COD, my order is placed immediately with `payment_status = pending`, `is_cod = true`
- If I choose UPI, I am taken to Razorpay's payment flow; on success, `payment_status = paid`; on failure, I return to checkout with a retry option and the order is not yet created
- *Constitution link: II (COD is default, not penalized or hidden)*

**A7 — As a customer, I want to track my order status in real time.**
- Given I have placed an order, I can view its current status on an order tracking screen
- The status updates through: Placed → Confirmed (vendor accepted) → Picked Up (rider collected) → On the Way → Delivered
- I receive a push notification at each major transition (Confirmed, Picked Up assigned to "on the way", Delivered)
- If the order is cancelled or fails, I see the reason in Hindi and any refund/COD implications
- *Constitution link: V (operational transparency builds trust)*

**A8 — As a customer, I want to rate my order after delivery.**
- Given my order status becomes "Delivered", I see a prompt to rate the vendor (1–5 stars) and optionally the rider (1–5 stars)
- I can optionally leave a text comment (voice review recording is schema-supported but UI may defer to V1)
- Skipping the rating is allowed but the prompt reappears once on next app open if not yet rated
- *Constitution link: I (community-visible reputation, simple format)*

### Epic B: Vendor Operations Journey

**B1 — As a vendor, I want to receive new orders immediately, so I can prepare them.**
- Given a customer places an order for my shop, I receive a push notification and a WhatsApp message with order details
- When I open the Vendor App, the new order appears in my "Pending" list with item details and customer's delivery address/landmark
- *Constitution link: V (vendor response time <15 min target depends on immediate, reliable notification)*

**B2 — As a vendor, I want to confirm or reject an order.**
- Given a pending order, I can tap "Accept" or "Reject"
- If I accept, the order status changes to "Confirmed" and the customer is notified
- If I reject, I must select a reason (out of stock / closing soon / other) and the customer is notified with a Hindi message; the order moves to `cancelled` and (if UPI-paid) a refund flow is triggered (manual in MVP, per 4.3 — refund automation deferred, but the *status* and *flag for manual refund* must exist)
- *Constitution link: V (accurate, fast vendor response is core to reliability)*

**B3 — As a vendor, I want to manage my product catalog with minimal effort.**
- Given I am in my Vendor App, I can view my product list
- I can add a new product by entering name, price, unit, and uploading a photo (camera or gallery)
- I can toggle a product's availability on/off without deleting it (e.g., "out of stock today")
- *Constitution link: II/V (near-zero-effort onboarding and day-to-day management is required for vendor retention)*

**B4 — As a vendor, I want to see my daily earnings at a glance.**
- Given I open my Vendor App dashboard, I see: today's completed order count, today's gross earnings, this week's totals
- *Constitution link: VII (vendors must see clear value to justify future monetization layers)*

### Epic C: Rider Operations Journey

**C1 — As a rider, I want to see orders assigned to me and accept them.**
- Given the admin has assigned an order to me, I see it in my Rider App with pickup location (vendor) and drop location (customer), plus item summary
- I can mark the order as "Picked Up" once I have collected it from the vendor
- *Constitution link: IV (this flow must function even with degraded connectivity — actions queue locally and sync)*

**C2 — As a rider, I want offline-capable navigation to the customer's location.**
- Given I have picked up an order, I see a map with my current location and the drop location, using pre-downloaded offline map tiles for Madhepur block
- If I lose connectivity mid-delivery, navigation continues to function using cached tiles
- *Constitution link: IV (offline is a design requirement)*

**C3 — As a rider, I want to confirm delivery with photo proof and log COD cash.**
- Given I have arrived at the drop location, I tap "Mark Delivered"
- I am prompted to take a photo (delivery proof) — this is mandatory, not optional
- If the order is COD, I enter the cash amount collected; this is logged against the order for daily reconciliation
- Upon confirmation, order status becomes "Delivered" and customer/vendor are notified
- *Constitution link: II (COD reconciliation is core, not bolted on)*

**C4 — As a rider, I want my actions to sync automatically once I'm back online.**
- Given I marked an order as "Picked Up" or "Delivered" while offline, these actions are queued locally
- When connectivity returns, queued actions sync to the backend automatically, in the order they occurred
- If a sync conflict occurs (e.g., admin reassigned the order while I was offline), I see a clear Hindi message explaining what happened
- *Constitution link: IV (offline-first with graceful conflict resolution)*

### Epic D: Admin Operations Journey

**D1 — As an admin, I want to see all orders in my block and their current status.**
- Given I am logged into the Admin Dashboard, I see a table of all orders: order number, customer, vendor, status, payment status, created time
- I can filter by status (e.g., show only "Confirmed, awaiting rider assignment")
- *Constitution link: V/X (operational visibility is required for the system to function without founder presence at every order)*

**D2 — As an admin, I want to manually assign a rider to a confirmed order.**
- Given an order's status is "Confirmed" and has no rider assigned, I can select from a list of currently-active riders
- Upon assignment, the rider receives a notification, and the order's `rider_id` is set
- *Constitution link: X (MVP keeps this manual deliberately — automation is V2+, per FeaturesRoadmap)*

**D3 — As an admin, I want to approve or reject new vendor signups.**
- Given a new vendor has registered, I see them in a "Pending Approval" list with their submitted business details
- I can approve (vendor becomes visible to customers) or reject (with a reason, vendor is notified)
- *Constitution link: I (trust verification gate before a vendor is community-visible)*

**D4 — As an admin, I want a daily COD reconciliation view.**
- Given a day has ended, I can view a summary per rider: number of COD deliveries, total cash expected (sum of order totals), and a field to log actual cash received
- Discrepancies are highlighted
- *Constitution link: II (COD cash accuracy = 100% target depends on this tooling existing from Day 1)*

---

## 6. Non-Functional Requirements

| Requirement | Specification | Constitution Link |
|---|---|---|
| Offline tolerance (Rider App) | Core delivery actions (accept, pickup, deliver) must queue and sync after up to 4 hours offline | IV |
| Language | Hindi UI for MVP; schema supports Maithili (`*_maithili` fields) from Day 1 | III, VI |
| Voice input | Hindi voice search via Whisper transcription on customer app | III |
| Device support | Must run acceptably on Android devices in the ₹5,000–₹15,000 range (per Execution Bible device testing matrix) | III |
| Payment | COD default; UPI via Razorpay as alternative | II |
| Notification channels | Push (FCM) + WhatsApp (Twilio/Gupshup) for order lifecycle events | V |
| Photo proof | Mandatory photo capture on delivery confirmation | II, V |
| Data residency | All user data stored in India-region infrastructure (Supabase/AWS ap-south-1) | Security (forward reference to SecurityRequirements.md) |

---

## 7. Open Questions / Assumptions Requiring Validation

These are explicitly flagged as unresolved as of PRD v1.0. Each should be resolved through ground execution (per Execution Bible) before or during early MVP development — not assumed away.

1. **Category taxonomy:** The exact category list (Grocery, Cooked Food, Vegetables, etc.) is assumed but not finalized — it must be derived from the actual vendor mapping exercise (Execution Bible §3), not designed in the abstract. *Schema.md should allow categories to be data-driven (a table/enum that can be amended), not hardcoded in application logic.*

2. **Minimum order value:** Whether SETU enforces a minimum order value (e.g., to ensure delivery economics work) is unresolved. The `vendors.min_order_value` field exists in the schema (Technical Constitution Part 5) to support this, but the MVP default behavior (0 = no minimum) should be validated against real delivery cost data from the 50-order manual phase.

3. **Delivery fee structure:** Flat fee vs. distance-based is unresolved. MVP schema supports a `delivery_fee` field on the order; the calculation logic should remain simple (flat fee) for MVP unless ground data strongly suggests otherwise, per Constitution's "do not architect for scale you haven't achieved."

4. **Vendor operating hours enforcement:** Whether the app should prevent ordering from a vendor outside their `opens_at`/`closes_at` window, or simply display "closed" as informational, is unresolved. Recommend informational-only for MVP (vendors and admins can override manually) to avoid blocking edge cases (a vendor staying open late).

5. **Rider self-assignment vs. admin-only assignment:** PRD specifies admin-only assignment for MVP (D2) per Constitution X (avoid premature automation). Whether riders should be able to "claim" unassigned orders themselves is a V1+ question, contingent on having enough riders that claiming doesn't create chaos — explicitly deferred.

---

## 8. Traceability Summary

Every in-scope MVP feature (Section 4.1) maps to at least one Constitution commandment and at least one user story (Section 5). Every out-of-scope item (Section 4.3) has an explicit reconsideration trigger. This traceability must be preserved as the PRD evolves — when FeaturesRoadmap.md introduces V1 features, those features should similarly trace back to this PRD's deferred-items table and to Constitution.md.

---

*End of PRD.md — v1.0 (MVP Scope)*
