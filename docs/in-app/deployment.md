# Deployment

## Topology

- The SPA is static hosting on Vercel.
- The API is a headless Docker container (`SERVE_CLIENT=false`).
- MariaDB runs next to the API.
- Vercel proxies `/api/*` to the API and adds `x-origin-secret`.

## Health

```bash
curl -fsS "http://127.0.0.1:${PORT:-3000}/healthz"
curl -fsS "http://127.0.0.1:${PORT:-3000}/readyz"
```

`/healthz` only proves the process is alive. `/readyz` runs `SELECT 1` against
MariaDB and returns `503` when the database is unavailable.

## Deploy or update

From source:

```bash
docker compose -f compose.prod.yaml up -d --build
```

From GHCR:

```bash
docker compose -f compose.ghcr.yaml pull
docker compose -f compose.ghcr.yaml up -d
```

The `migrate` service applies migrations and runs the idempotent seed, then
exits. The `api` service starts only after it succeeds. Watch the migration job
if the release contains a schema change.

## Vercel settings

Set `API_URL` (HTTPS origin of the API), `ORIGIN_SECRET` (same value as the API)
and optionally the `VITE_*` brand variables for both Preview and Production.
`CORS_ORIGINS` on the API must include every browser origin that uses the API.
`TRUST_PROXY` is `1` for a direct Vercel rewrite and one more for each extra
proxy hop.

## Rollback

1. Set `IMAGE_TAG` to the previous published tag and run
   `docker compose -f compose.ghcr.yaml up -d`.
2. Promote the previous Vercel deployment from the dashboard.
3. If the release changed the schema incompatibly, restore the backup taken
   before the release and then start the previous image.

Never edit an applied migration. Changing `SESSION_SECRET` or the database logs
every user out.
