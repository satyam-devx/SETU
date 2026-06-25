# SETU — Security Policy

SETU handles real money (wallet, credit, escrow, payouts), COD cash, and
Aadhaar KYC. Security reports are taken seriously.

## Reporting a vulnerability (coordinated disclosure)

- Email: **security@setu.example** (replace with the real inbox before launch).
- Please include: affected area, reproduction steps, impact, and any PoC.
- Do **not** open public issues for security bugs, and do not access, modify, or
  exfiltrate other users' data while testing.
- We aim to acknowledge within 3 business days and to remediate critical issues
  before public disclosure. We credit reporters who follow this policy.

**Safe harbour:** good-faith research that respects the rules above (no privacy
violations, no service degradation, no data destruction) will not be pursued.

## What's already in place (defence-in-depth)

- Auth via Supabase (phone OTP / OAuth); JWT verified at the Edge Function
  gateway except the HMAC-verified Razorpay webhook.
- Row-Level Security on every table; security-definer RPCs with explicit
  ownership/role checks for all money and config paths (migrations 013–020).
- Server-authoritative order pricing (`create_order`) — clients cannot set
  totals or item prices.
- CSP + HSTS + security headers (`public/_headers`) on Cloudflare; CORS
  allow-listed; Aadhaar stored pgcrypto-encrypted.
- Per-user + global rate limits; third-party spend caps (`AI_DAILY_CAP`,
  `KYC_DAILY_CAP`).
- Executable security regression proofs in CI (`qa/sql/*_test.sql`).

## Third-party penetration test — scope to hand an auditor

A static review (even a thorough one) cannot replace a live pentest. Before
launch, commission one and scope it to at least:

1. **Auth & session** — OTP brute force / interception, session fixation, JWT
   handling, OAuth redirect abuse, the `localStorage` token-theft surface
   (XSS → account takeover; verify the CSP closes it).
2. **Authorization / IDOR** — attempt cross-user access on every RPC and table:
   orders, wallets, credit, addresses, KYC, payouts. Re-test the
   `supabase.rpc()` direct-call vectors the audit found (these are the highest
   historical risk area).
3. **Payment integrity** — order total tampering, webhook signature forgery,
   replay, amount mismatch, double-spend on wallet/escrow, refund abuse.
4. **Injection / input** — SQLi via PostgREST filters, stored XSS via vendor
   names / product descriptions / notices (renders into the SPA), SSRF.
5. **Rate limiting / DoS** — confirm edge WAF + per-DB limits hold; test the
   `log_client_error` and OTP endpoints for abuse.
6. **Secrets & infra** — verify no service-role key reaches the browser, build
   artifacts contain no secrets (`verify_build_config.py`), and Edge Function
   secrets aren't logged.

## Pre-audit checklist (close these before the pentest, not during)

- [ ] PITR enabled on production Supabase (see `DR.md`).
- [ ] CSP validated in staging as `Report-Only`, then enforced (`HOSTING.md`).
- [ ] Cloudflare WAF + rate-limiting rules live (`SCALING.md`).
- [ ] `npm audit --omit=dev --audit-level=high` clean (CI gate already enforces).
- [ ] All Edge Function secrets set; `ALLOW_KYC_DEV_BYPASS` unset in prod;
      `VITE_DEMO_MODE` unset in prod.
- [ ] Both SQL security proofs pass against a fresh prod-equivalent DB.
- [ ] Admin/super-admin accounts use strong, unique credentials + 2FA
      (`require_2fa_admin` config is honoured by the auth flow).
- [ ] Real `security@` inbox monitored.

## Known residual risks (disclose to the auditor)

- Supabase JWTs live in `localStorage` — mitigated by CSP, not eliminated.
  Moving to an `HttpOnly` cookie via an auth proxy is the durable fix (deferred).
- `update_order_status` / `assignRider` direct-table paths: status RPC is now
  role-gated (migration 017/019), but confirm the rider self-assignment flow.
- Full declarative partitioning and a dedicated async payment worker are
  deferred (see `SCALING.md`).
