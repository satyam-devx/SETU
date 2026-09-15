# SETU — Docker

**Added:** 2026-09-15

SETU is a Vite SPA that's static after `npm run build` — there is no
Node server at runtime, and no part of the app (Supabase, Razorpay,
Firebase, Mapbox) runs inside this container; all of that is reached
remotely from the browser, same as every other deploy target. Docker just
gives you a reproducible way to build and serve that static output.

This is an *additional* packaging option alongside GitHub Pages and
Cloudflare Pages (see [`HOSTING.md`](HOSTING.md)) — it doesn't replace
either, and doesn't change how `deploy.yml` / `deploy-cloudflare.yml`
work.

## Architecture

- **`Dockerfile`** — 3-stage build: `base` (deps) → `builder` (`npm run
  build`) → `runtime` (nginx serving the static output). Only the
  `runtime` stage's contents — nginx + `dist/` — ship in the final image.
  No Node, no source, no `node_modules`.
- **`docker/nginx.conf`** + **`docker/security-headers.conf`** — SPA
  history-API fallback and the same CSP/security headers as
  [`public/_headers`](public/_headers) / [`public/_redirects`](public/_redirects),
  so the container behaves like Cloudflare Pages/Netlify. If you change
  the CSP in `public/_headers`, mirror the change in
  `docker/security-headers.conf` — nothing generates one from the other.
- **`docker-compose.yml`** — local dev only (hot reload via the real Vite
  dev server). Not used to build or run the production image.
- **No local Supabase container.** Supabase is hosted remotely for this
  project; `supabase/config.toml` is Supabase CLI state for migrations/
  Edge Functions, unrelated to this Docker setup. Don't run the
  production Supabase project inside Docker, and no Supabase
  service-role secret ever reaches this image.

## Development

```bash
cp .env.example .env.local     # fill in real values, or leave the
                                # placeholders (see below)
docker compose --env-file .env.local up --build
```

Open `http://localhost:5173`. This runs `npm run dev` inside a container
with your source bind-mounted — edits on the host hot-reload exactly like
running it directly, just with a container's Node version instead of the
host's (handy if you're on Termux/Android, where `node_modules` isn't
portable to a Linux container — see `docker-compose.yml`'s comments for
why the compose file uses a named volume for it).

Without real Supabase credentials, `VITE_DEMO_MODE` defaults to `true` in
`docker-compose.yml` for this service, matching `.env.example`'s guidance
for local previews.

To instead build and run the actual production image locally:

```bash
docker compose --profile prod-preview up --build preview
# open http://localhost:8080
```

## Production

```bash
docker build -t setu .
docker run -p 8080:8080 setu
```

`docker build -t setu .` with **zero** `--build-arg` flags still
produces a working build — the defaults baked into the `Dockerfile`
match `ci.yml`'s own no-secrets PR-build fallback values (placeholder
Supabase/Firebase/Mapbox/Razorpay config). For a real deployment, pass
your actual values:

```bash
docker build -t setu . \
  --build-arg VITE_SUPABASE_URL=https://your-project.supabase.co \
  --build-arg VITE_SUPABASE_ANON_KEY=eyJ... \
  --build-arg VITE_RAZORPAY_KEY_ID=rzp_live_... \
  # ...and so on — see the ARG list in the Dockerfile, it mirrors
  # .env.example's VITE_* section exactly.
```

The container serves plain HTTP on port `8080` (non-root — see
"Security" below). Put a TLS-terminating reverse proxy / load balancer
in front of it in production, the same way Cloudflare Pages already
does for the other deploy targets.

## Environment variables

Every build arg the Dockerfile accepts is a `VITE_*` variable — **public
by design.** Vite inlines these into the JS bundle at build time (see
`.env.example`'s own comment on this), so nothing here is a secret, and
none of it needs `docker secret` / mounted secret files.

**Never** pass these as build args or bake them into this image — they
aren't `VITE_*`, the frontend never needs them, and doing so would ship
them to every visitor's browser:

- `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_PASSWORD`, `SUPABASE_DB_URL`
- `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`
- `FIREBASE_SERVICE_ACCOUNT_JSON`
- `SUREPASS_API_KEY`, `ANTHROPIC_API_KEY`
- `ALLOW_KYC_DEV_BYPASS`, `ALLOWED_ORIGINS`

(These are all backend/CI-only secrets already documented in
`.env.example` — the Dockerfile doesn't read any of them, but it's worth
being explicit about what should never end up in a `--build-arg`.)

## QA / testing against the container

The existing Playwright suite in `qa/` can point at a running Dockerized
build instead of the dev server or a deployed URL — it already reads a
`SETU_E2E_URL` env var (`qa/playwright.config.js`):

```bash
docker run -d -p 8080:8080 --name setu-preview setu
cd qa && SETU_E2E_URL=http://localhost:8080 npm run test:e2e
docker rm -f setu-preview
```

No separate QA container was added — the existing suite works as-is
against the built image, so a second container would only duplicate
`qa/`'s own `node_modules`/Playwright browsers for no benefit.

## CI

`.github/workflows/docker.yml` is a new, additive workflow: it builds the
image and smoke-tests it (health check, root page, a deep SPA route,
security headers present, a grep for obviously-leaked secrets in the
served output). It only runs when Docker-related files (or things that
could break the build, like `package.json`) change, and it never touches
`ci.yml`, `deploy.yml`, or any other existing workflow.

## Security

- Runs as **non-root** (`nginxinc/nginx-unprivileged`), on unprivileged
  port `8080`.
- Multi-stage build — no Node, source, `node_modules`, or build tooling
  in the final image, only nginx + the static `dist/` output.
- `HEALTHCHECK` only checks that nginx itself is serving `/` — it never
  depends on Supabase/Razorpay/any external API, so a third-party outage
  can't flip the container "unhealthy."
- `server_tokens off` — nginx doesn't announce its version.
- The image build never touches `.env*` files (excluded via
  `.dockerignore`) — only explicit `--build-arg` values (or their
  defaults) reach the build, and those are all `VITE_*` public config.

## Troubleshooting

| Problem | Fix |
|---|---|
| `docker build` fails on `npm install` with peer-dependency errors | Make sure `.npmrc` (with `legacy-peer-deps=true`) is actually present in the build context — check it isn't excluded in `.dockerignore`. |
| Port already in use | `docker run -p 8081:8080 setu` (or free port 8080/5173 first). |
| Stale build after a source change | `docker build --no-cache -t setu .`, or `docker compose build --no-cache dev`. |
| Deep route (e.g. `/vendor/orders`) 404s when opened directly / on refresh | The nginx SPA fallback isn't active — confirm `docker/nginx.conf` was actually copied to `/etc/nginx/conf.d/default.conf` (check `docker exec <container> cat /etc/nginx/conf.d/default.conf`). |
| Dev container doesn't pick up new npm dependencies after a host `npm install` | The named `node_modules` volume only reflects what was installed *inside* the image. Rebuild: `docker compose build dev`. |
| File-watch / hot reload doesn't trigger on some hosts | Vite's default file watcher can miss changes through some bind-mount/filesystem combinations. If this happens, set `CHOKIDAR_USEPOLLING=true` in the `dev` service's `environment:` block in `docker-compose.yml`. |
| Need to confirm the image has no leaked secrets | `docker run --rm setu grep -rE 'service_role|KEY_SECRET|BEGIN PRIVATE KEY' /usr/share/nginx/html` — should find nothing. (`docker.yml` CI runs an equivalent check on every build.) |

## What this Docker setup deliberately does *not* do

Per the existing architecture, none of the following were added, because
nothing in this repo currently needs them: Kubernetes/Helm, a reverse
proxy in front of nginx, a local Supabase stack, Redis, a message queue,
or a separate QA/E2E container. If a real requirement for any of these
shows up later, add it then.
