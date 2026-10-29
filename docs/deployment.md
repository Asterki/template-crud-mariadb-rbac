# Deployment Guide

Overview

This document outlines common deployment strategies for the application.

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

Containers

- Build the headless API image from the repository root (`docker build -t template-api .`).
- Use `compose.prod.yaml` to build from source or `compose.ghcr.yaml` to pull a
  published image from GHCR.

Database

- MariaDB 11.4 is the supported database. Run `prisma migrate deploy` from the
  `migrate` service or CI; never use `prisma db push` in a deployed environment.

CI/CD

- Build and test both client and server, generate artifacts, run migrations, then deploy containers.

Secrets

- Store `DATABASE_URL`, `SESSION_SECRET`, `ORIGIN_SECRET` and other secrets in a secure vault or environment variables provided by the host.
