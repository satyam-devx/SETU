# SETU — Accessibility (WCAG 2.1 AA)

**Version:** 1.0.0 · **Last updated:** 2026-07-08

SETU serves first-time smartphone users, many with limited literacy or vision.
Accessibility is a usability requirement here, not a checkbox.

> **Honest scope note:** automated tooling (axe-core) catches roughly a third
> of WCAG issues. Full AA conformance **requires manual testing with real
> assistive technology** and human judgement. The checklist below is the manual
> pass that automation cannot replace; it must be run before claiming AA.

## Automated coverage (CI)

`qa/tests/e2e/a11y/accessibility.spec.js` runs axe-core (WCAG 2.1 AA ruleset)
against: Login, OTP Verify, Register, Privacy Policy, Terms, Role Error.
Critical rules enforced: `color-contrast`, `label`, `button-name`, `link-name`,
`image-alt`, `heading-order`. Critical violations block the QA pipeline.

**Extend it:** add each portal's primary authenticated screens (CustomerHome,
Cart, Checkout, Orders; Vendor/Rider/Seva dashboards) to the spec's page list
as they stabilise, behind the `setu_test_unauth`/demo-mode test harness.

## Manual assistive-tech checklist (run before each release)

Test on a real low-end Android device where possible.

### Screen reader (TalkBack on Android, NVDA on desktop)
- [ ] Every screen has a logical heading order (h1→h2…), no skipped levels.
- [ ] All actionable controls announce a name + role (buttons, links, switches).
- [ ] Icon-only buttons have an `aria-label` (back, notifications, dismiss).
- [ ] Images: meaningful `alt`; decorative images `alt=""`. `<Img>` defaults to
      `alt=""` — confirm callers pass real text for content images.
- [ ] Form fields have associated `<label>`s; errors are announced
      (`role="alert"`/`aria-live`) — see `ProtectedRoute` error state as the pattern.
- [ ] Dynamic updates (toasts, order status, loading) use `aria-live` and don't
      steal focus unexpectedly.
- [ ] Modals/sheets trap focus and restore it on close; Esc closes them.

### Keyboard only (no pointer)
- [ ] Every interactive element is reachable and operable via Tab/Enter/Space.
- [ ] Visible focus ring everywhere (the global `*:focus-visible` ring exists —
      verify it's never removed by a component).
- [ ] No keyboard traps; tab order matches visual order.

### Visual / motor
- [ ] Text contrast ≥ 4.5:1 (3:1 for large text). The saffron primary was
      darkened to `20 90% 40%` for AA — re-verify after any palette change.
- [ ] Touch targets ≥ 44×44px (`.touch-target` utility exists; audit nav + chips).
- [ ] App is usable at 200% browser zoom and 320px width without horizontal scroll.
- [x] Respect `prefers-reduced-motion` for entrance animations. (2026-07-09:
      framer-motion removed entirely — see CHANGELOG.md — replaced with CSS
      `@keyframes` on RoleSelect.jsx that fall back to a plain 1ms fade under
      `@media (prefers-reduced-motion: reduce)` in `index.css`.)

### Language / literacy (SETU-specific)
- [ ] UI language matches the user's chosen language (Hindi/Maithili/Bhojpuri/EN);
      `lang` attribute reflects it for screen-reader pronunciation.
- [ ] Critical actions (pay, cancel, confirm) are icon + text, not text alone.
- [ ] Error messages are plain-language, not codes.

## Tools

- TalkBack (Android), NVDA (Windows, free), VoiceOver (iOS/macOS).
- Chrome DevTools Lighthouse a11y audit (quick signal, not sufficient alone).
- axe DevTools browser extension for spot checks during development.
