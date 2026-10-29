# Deployment Guide

The template ships two deployment surfaces:

- a static React SPA on Vercel;
- a headless Express API in Docker, published to GHCR and run with
  `compose.ghcr.yaml`.

The browser calls `/api/*` on the Vercel domain. Vercel proxies those requests
to `API_URL` and injects `x-origin-secret`. The API is never called
cross-origin from the browser, so the session cookie stays same-site.

```text
Browser --HTTPS--> Vercel SPA
                    |
                    | /api/* rewrite + x-origin-secret
                    v
              HTTPS reverse proxy --HTTP--> API container --> MariaDB
```

## Headless vs all-in-one

The published Docker image is **headless**. `SERVE_CLIENT` defaults to `false`
and the image does not contain `client/dist`. In headless mode `GET /` returns a
small JSON banner (`{"service":"...","version":"..."}`) and only `/api/*` and
the health endpoints are served.

Serving the SPA from the API is optional and intended for small all-in-one
deployments. Build the client, set `SERVE_CLIENT=true`, and point `CLIENT_DIR`
at the directory containing `index.html` (for example an absolute path or
`client/dist`). The SPA fallback never handles `/api/*`, `/healthz` or
`/readyz`. The Vercel deployment in this repository uses the headless image and
the API proxy instead.

## Vercel SPA and API proxy

`vercel.json` at the repository root contains:

- `installCommand`: builds `shared/` and installs `client/`;
- `buildCommand`: builds the Vite SPA;
- `outputDirectory`: `client/dist`;
- `routes`: filesystem handler, `/api/(.*)` proxy to `${API_URL}/api/$1` with an
  `x-origin-secret` request-header transform, then the SPA fallback.

The route uses the documented Vercel `routes` + `transforms` + `env` syntax.
`transforms[].target` must be an object (`{"key":"x-origin-secret"}`); a string
target is rejected. No Edge Function or Middleware fallback is needed.

### Project settings

| Setting | Value |
|---|---|
| Root Directory | repository root (not `client/`) |
| Framework Preset | Other |
| Node.js Version | 24 (matches `.nvmrc`) |
| Install Command | from `vercel.json` (leave the dashboard override empty) |
| Build Command | from `vercel.json` |
| Output Directory | `client/dist` |

### Environment variables

Set these for both **Preview** and **Production** scopes in the Vercel project:

| Name | Purpose |
|---|---|
| `API_URL` | Public HTTPS origin of the API, without a trailing slash (for example `https://api.example.com`) |
| `ORIGIN_SECRET` | Long random value; must match the API's `ORIGIN_SECRET` |
| `VITE_API_URL` | `/api` (the client default; set it explicitly for clarity) |
| `VITE_APP_NAME`, `VITE_APP_SLUG`, `VITE_BRAND_COLOR`, `VITE_DEFAULT_LOCALE` | Optional build-time branding |

Use different `API_URL`/`ORIGIN_SECRET` values for Preview and Production when
they point at different API deployments. `ORIGIN_SECRET` is server-side only;
never expose it through a `VITE_*` variable.

### CORS and Origin checks

The API's `CORS_ORIGINS` is a comma-separated, exact-match allowlist. It is
used both by the CORS middleware and by the CSRF Origin check for unsafe
methods, so it must include every browser origin that reaches the API through
the proxy:

```text
CORS_ORIGINS=https://app.example.com,https://app-git-main-example.vercel.app
```

Preview deployments use generated hostnames. Either add each preview origin to
`CORS_ORIGINS`, use a stable preview domain, or use a separate API deployment
for previews. Wildcards are not supported.

### TRUST_PROXY and proxy hops

`TRUST_PROXY` is the number of trusted proxy hops in front of the API. It must
be an integer:

- Vercel rewrite directly to the API: start with `1`.
- Vercel plus a host reverse proxy (Caddy, Nginx, Traefik, a load balancer):
  count each hop; usually `2`.

`TRUST_PROXY` was **not measured against a live Vercel preview** in this
environment. To determine it:

1. Deploy a preview with `LOG_LEVEL=debug` and a temporary API deployment.
2. Request `/healthz` through the preview URL.
3. Inspect the pino request log: `req.headers["x-forwarded-for"]` lists the
   chain and `req.ip`/`req.remoteAddress` show what Express trusts.
4. Raise `TRUST_PROXY` one hop at a time until `req.ip` is the real client
   address, not a Vercel or reverse-proxy address.
5. Do not set a number larger than the real number of proxies; that lets a
   client spoof `X-Forwarded-For`.

### TLS and cookies

- Vercel terminates TLS for the SPA. The API must also be reached over HTTPS:
  put it behind a reverse proxy or load balancer that terminates TLS and
  forwards to `127.0.0.1:${PORT}`. Do not expose plain HTTP on a public
  interface.
- In production the API uses `__Host-app.sid` and `__Host-csrf`. `__Host-`
  cookies require `Secure`, `Path=/` and no `Domain`, so the API must see
  HTTPS at the browser-facing edge.
- Leave `COOKIE_DOMAIN` empty. The browser only sees the Vercel domain; Vercel
  forwards the cookie to the API. `SameSite=Lax` works because the browser's
  requests are same-site, not cross-site.
- If you terminate TLS at a proxy, forward `Host`, `X-Forwarded-Proto` and
  `X-Forwarded-For`, and set `TRUST_PROXY` accordingly.

## Headless API with GHCR

```bash
docker login ghcr.io
cp .env.ghcr.example .env
# set GHCR_OWNER, IMAGE_NAME, IMAGE_TAG, database passwords, secrets
docker compose -f compose.ghcr.yaml pull
docker compose -f compose.ghcr.yaml up -d
curl -fsS "http://127.0.0.1:${PORT:-3000}/readyz"
```

The `migrate` service runs `prisma migrate deploy` with
`MIGRATE_DATABASE_URL` and the idempotent seed with `DATABASE_URL`, then exits.
The `api` service starts only after the migration job succeeds. Both use the
same immutable image with different commands.

Build from source with `compose.prod.yaml`:

```bash
cp .env.example .env
docker compose -f compose.prod.yaml up -d --build
```

For a least-privilege database, create a runtime user with DML only and a
migration user with DDL rights, then point `DATABASE_URL` at the runtime user
and `MIGRATE_DATABASE_URL` at the migration user. See the database section in
the project documentation.

## Rollback

1. **Vercel:** use the dashboard's deployment history or `vercel rollback` to
   promote the previous deployment. Environment variables are versioned with
   the deployment.
2. **API:** set `IMAGE_TAG` to the previous published tag and run
   `docker compose -f compose.ghcr.yaml up -d`. The image is immutable; do not
   rebuild the old tag.
3. **Database:** restore the backup taken before the deployment if a migration
   is not backward-compatible. Migrations are forward-only; never edit an
   applied migration.
4. **Sessions:** changing `SESSION_SECRET` invalidates all sessions. Rotate it
   only when you intend to log everyone out.
5. **Origin secret:** to rotate, deploy the API with both old and new values
   accepted if your proxy supports it, update Vercel, then remove the old value.

## CI/CD

GitHub Actions runs lint, typecheck, tests and the SPA build on pull requests,
and builds the Docker image for scanning. Pushes to `main` publish
`linux/amd64` and `linux/arm64` images to GHCR; release-please adds semver tags
and `latest` when it creates a release.
