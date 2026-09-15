# syntax=docker/dockerfile:1
# ═══════════════════════════════════════════════════════════════════════
# SETU — production Docker image
#
# Vite SPA, static after build (no Node server at runtime — verified: no
# Express/custom server anywhere in the repo). Supabase/Firebase/Razorpay/
# Mapbox are all hosted remotely and reached from the browser; nothing
# backend-shaped is (or should be) containerized here — see DOCKER.md.
#
#   Stage "base"    — install dependencies once (cached across builds
#                      that only change application source).
#   Stage "builder" — copy source, build the production bundle.
#   Stage "runtime" — minimal nginx image serving the static dist/ output.
#                      Nothing from "base"/"builder" (Node, source,
#                      node_modules) reaches this final image.
#
# Build:   docker build -t setu .
# Run:     docker run -p 8080:8080 setu
# Dev:     docker compose up --build          (hot reload — see DOCKER.md)
# ═══════════════════════════════════════════════════════════════════════

# ── Stage: base — dependencies only ─────────────────────────────────────
# Node 24, matching every existing workflow's `node-version: '24'`
# (ci.yml, deploy.yml, deploy-cloudflare.yml, qa.yml, nightly.yml,
# health-monitor.yml, build-android.yml) — a floating major-version tag is
# an intentional match to how this project already pins Node elsewhere,
# not an oversight.
FROM node:24-alpine AS base

# python3 is only needed for scripts/inject_sw_config.py (Firebase service
# worker config templating) in the "builder" stage below — the same step
# deploy.yml / deploy-cloudflare.yml run before `npm run build`. This
# layer is discarded with the "base"/"builder" stages; it never reaches
# the final "runtime" image.
RUN apk add --no-cache python3

WORKDIR /app

# Install dependencies before copying the rest of the source, so this
# (slow) layer is only invalidated when package.json/package-lock.json/
# .npmrc actually change.
COPY package.json package-lock.json .npmrc ./

# `npm install`, not `npm ci`, is deliberate — it matches the *entire*
# existing pipeline (every workflow above uses `npm install`). Per
# CHANGELOG.md 1.0.5, package-lock.json has previously drifted a step
# behind package.json between commits here, and `npm ci`'s strict
# lockfile-sync check refuses to install when that happens; `npm install`
# doesn't. `legacy-peer-deps=true` in .npmrc (copied above) is required
# for this to succeed — see that file's own comment for why.
RUN npm install

# ── Stage: builder — production build ───────────────────────────────────
FROM base AS builder

COPY . .

# Public, client-visible build-time config only. Vite inlines VITE_*
# values into the JS bundle by design (see .env.example) — nothing secret
# belongs here, and nothing secret is ever read below. Defaults mirror
# ci.yml's own no-secrets PR fallback values, so `docker build` with zero
# --build-arg flags still produces a working build, exactly like a fork PR
# does in CI.
ARG VITE_SUPABASE_URL=https://placeholder.supabase.co
ARG VITE_SUPABASE_ANON_KEY=placeholder-anon-key
ARG VITE_SUPABASE_REPLICA_URL=
ARG VITE_DEMO_MODE=false
ARG VITE_FIREBASE_API_KEY=placeholder
ARG VITE_FIREBASE_AUTH_DOMAIN=placeholder.firebaseapp.com
ARG VITE_FIREBASE_PROJECT_ID=placeholder-project
ARG VITE_FIREBASE_STORAGE_BUCKET=placeholder.appspot.com
ARG VITE_FIREBASE_MESSAGING_SENDER_ID=000000000000
ARG VITE_FIREBASE_APP_ID=1:000000000000:web:placeholder
ARG VITE_FIREBASE_VAPID_KEY=placeholder-vapid-key
ARG VITE_MAPBOX_TOKEN=pk.placeholder
ARG VITE_RAZORPAY_KEY_ID=rzp_test_placeholder
# This image serves from the domain root ("/"), like the Cloudflare Pages
# target in deploy-cloudflare.yml — NOT the GitHub Pages "/SETU/"
# subdirectory that vite.config.js otherwise defaults `build` to.
ARG VITE_BASE_PATH=/

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY \
    VITE_SUPABASE_REPLICA_URL=$VITE_SUPABASE_REPLICA_URL \
    VITE_DEMO_MODE=$VITE_DEMO_MODE \
    VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY \
    VITE_FIREBASE_AUTH_DOMAIN=$VITE_FIREBASE_AUTH_DOMAIN \
    VITE_FIREBASE_PROJECT_ID=$VITE_FIREBASE_PROJECT_ID \
    VITE_FIREBASE_STORAGE_BUCKET=$VITE_FIREBASE_STORAGE_BUCKET \
    VITE_FIREBASE_MESSAGING_SENDER_ID=$VITE_FIREBASE_MESSAGING_SENDER_ID \
    VITE_FIREBASE_APP_ID=$VITE_FIREBASE_APP_ID \
    VITE_FIREBASE_VAPID_KEY=$VITE_FIREBASE_VAPID_KEY \
    VITE_MAPBOX_TOKEN=$VITE_MAPBOX_TOKEN \
    VITE_RAZORPAY_KEY_ID=$VITE_RAZORPAY_KEY_ID \
    VITE_BASE_PATH=$VITE_BASE_PATH

# Bakes real Firebase config into public/firebase-messaging-sw.js before
# the build picks it up (service workers can't read import.meta.env) —
# the same step deploy.yml / deploy-cloudflare.yml run. Safe no-op when
# Firebase vars are left as placeholders: the script only ever skips
# replacement in that case, it never fails the build.
RUN python3 scripts/inject_sw_config.py

RUN npm run build

# ── Stage: runtime — minimal static server ──────────────────────────────
# Official nginx, pre-configured to run as a non-root user on an
# unprivileged port (8080) — every cache/temp/pid path nginx needs is
# already writable by that user in this image, which a hand-rolled
# `USER nginx` on plain nginx:alpine does not guarantee out of the box.
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/security-headers.conf /etc/nginx/security-headers.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 8080

# Answers exactly one question: "is this container's web server alive and
# serving the app?" — no Supabase/Razorpay/external-API dependency, so a
# third-party outage never flips this container unhealthy.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:8080/ || exit 1

# Base image already sets a non-root USER and the correct CMD; kept
# explicit here for clarity/auditability.
CMD ["nginx", "-g", "daemon off;"]
