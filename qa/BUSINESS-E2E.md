# SETU Business E2E Agent

`npm run qa:business` runs one isolated real commerce transaction end-to-end:

1. Creates temporary customer/vendor/rider accounts and test product/address.
2. Signs the three browser contexts in directly with Supabase test sessions.
3. Customer opens the product, adds it to cart, checks out and selects COD.
4. Places the order through the real checkout UI.
5. Vendor receives the order and advances `pending -> confirmed -> preparing -> ready`.
6. Dispatch creates a rider offer; rider comes online and accepts it.
7. Rider advances `ready -> picked_up -> on_the_way` through the secured status RPC.
8. Customer observes the realtime `on_the_way` state and retrieves the real delivery OTP.
9. Rider completes delivery using the OTP and a real image upload.
10. Customer observes the realtime delivered state.
11. Backend integrity checks verify delivered state, COD collection, rider assignment, financial finalization, proof, consumed OTP and stock decrement.
12. Cleanup removes the test order and dependent records, test product/vendor/rider/address and temporary auth users even when the Playwright run fails.

## Required environment

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

The runner intentionally refuses to run in `VITE_DEMO_MODE`; a demo/mock run cannot prove the real order, dispatch, realtime, storage or financial pipeline.

## Commands

```bash
npm run qa:business
```

or from `qa/`:

```bash
npm run test:business
```

Artifacts are written under `qa/reports/business-flow/` and include a JSON step report plus failure screenshots. Playwright's trace/video artifacts are also retained according to `qa/playwright.config.js`.

## Safety

The runner generates unique E2E accounts and entity IDs per run. It never searches for or deletes normal users. Cleanup is scoped to the generated test accounts and the orders owned by the generated test vendor/customer/rider.
