# SETU — F1-H Frontend Hardening Audit

## Scope

Frontend security, UX correctness, React error recovery, accessibility, form validation, loading/empty/error states, and production hardening.

## Implemented

### Security
- Added `src/lib/frontend-security.js` for allow-listing remote navigation URLs to HTTP(S).
- Customer scheme external application links now reject unsafe URL schemes instead of rendering untrusted `javascript:`/`data:` navigation targets.
- Error boundary never renders production stack/error details; diagnostics remain development-only.
- Offline mutation queue now has a bounded size and item lifetime and reports storage/quota failure instead of silently claiming durability.

### Error recovery
- `ErrorBoundary` recovery now performs a full WebView/page reload rather than re-rendering the same crashing subtree.
- Error fallback has `role="alert"` and assertive announcement semantics.
- Existing portal-level boundaries remain preserved.

### Forms
- Added `src/lib/form-validation.js` with reusable required, Indian-phone, email, and positive-amount validation.
- OTP login now uses the shared Indian-phone validator.
- OTP errors are announced with `role="alert"`/`aria-live` and the phone field is explicitly labelled.
- Server-side validation remains authoritative; client validation is UX only.

### Offline/recovery hardening
- Offline mutation queue is capped at 50 items.
- Queued items older than 24 hours are discarded rather than replayed indefinitely.
- Queue IDs prefer `crypto.randomUUID()`.
- Local-storage quota/private-mode failures return a failed enqueue result instead of creating a false persistence guarantee.

## Existing protections verified by source audit

- Global error and unhandled-rejection observability is installed in `main.jsx`.
- Portal-level React error boundaries exist for Customer, Vendor, Rider, Seva, Anchor, Admin, and Super Admin.
- Suspense fallbacks exist for lazy-loaded portal routes.
- Existing accessibility guidance requires labels, named controls, live error announcements, focus management, touch targets, reduced motion, and manual TalkBack/NVDA testing.
- Supabase remains the server authority for order totals, payment state, inventory, authorization, and other sensitive business rules.

## Remaining release-gate items

These are not silently marked complete because they require runtime/device evidence rather than source-only changes:

1. Run the full Vite production build and ESLint in CI.
2. Run axe accessibility tests across authenticated Customer/Vendor/Rider/Seva dashboards, not only public/auth screens.
3. Manual TalkBack test on a low-end Android device.
4. Test 320px viewport and 200% zoom for horizontal overflow.
5. Exercise offline → foreground → online recovery while an explicitly safe mutation is queued.
6. Exercise WebView process/background lifecycle with an active order-tracking screen.
7. Verify all remote image URLs and user-generated URLs are served over HTTPS in production.
8. Verify production CSP/security headers at the hosting layer.

## Architectural rule

Client-side validation, optimistic UI, offline cache, and retry are convenience layers only. Money, inventory, order creation, payment state, authorization, and final totals remain server-authoritative.
