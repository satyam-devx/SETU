# SETU — F11 UX / Accessibility Engineering

## Goal
Every important SETU flow should remain usable with keyboard, screen reader and touch, not only visually.

## Implemented
- Added reusable `useFocusTrap` for custom dialogs/sheets.
- Custom support-ticket sheet now has dialog semantics, labelled controls, focus entry/return, Escape handling and keyboard trap.
- Customer cancel-order sheet now has dialog semantics, focus management, Escape handling, labelled reason input and announced errors.
- Added global `.sr-only` and `.touch-target` accessibility utilities.
- Added `AccessibilityAnnouncer` primitive for polite/assertive live announcements.
- Route loading fallback now exposes `role="status"`, `aria-live="polite"`, and `aria-busy`.
- Customer language selection no longer uses a clickable `div` with a nested button; language selection is a native button and the Listen control remains a separate native button.
- Existing focus-visible ring is retained globally.
- Existing reduced-motion support is retained.
- Existing semantic form controls and Radix controls remain the preferred primitives.

## Loading / error behavior
- Loading fallback is announced without stealing focus.
- Existing retry controls remain native buttons.
- Custom modal validation/server errors use `role="alert"` where appropriate.
- Disabled submission controls remain disabled during in-flight work.

## Interaction audit notes
- Existing `role="button"` patterns in admin image/order/customer cards were reviewed. They contain complex block content, so they were not blindly converted to `<button>` elements (which would introduce invalid nested interactive/phrasing-content structures). They retain keyboard Enter/Space behavior and visible focus styling.
- Interactive controls inside cards are kept as separate native controls.
- No new nested button/link structures were introduced by F11.

## Manual verification still required
Automated/static checks cannot establish full WCAG conformance. Before release, run:
- TalkBack on Android
- keyboard-only navigation
- NVDA/VoiceOver spot checks
- 200% zoom and 320px viewport
- touch target audit on dense screens
- axe/Lighthouse against authenticated portals

## Runtime limitation
The workspace currently has no installed `node_modules`, so full browser/Vite/axe runtime execution was not claimed as green in this phase.
