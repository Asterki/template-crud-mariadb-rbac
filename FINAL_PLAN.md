# FINAL_PLAN.md — Template v1 Refactor (build-ready)

> **Supersedes:** PLAN.md (2026-10-29). **Planned against:** `d6ea18dbf7eb7f9a8e536cd1f9c07ba85605fad1` on `main`.
> **Branch:** `refactor/template-v1` (never work on `main`). **Push:** exactly once, at the very end (§9).
> **Audience:** an AI executor. Follow tasks in order. A task is done only when its Acceptance and Verify columns pass.
> Items tagged `UNVERIFIED` could not be executed during planning; the named spike or task must prove them before dependants proceed.

---

## 0. What changed versus PLAN.md (and why)

| # | Change | Reason |
|---|---|---|
| O1 | **Independent packages** `client/`, `server/`, `shared/` (own `package.json`, lockfile, `node_modules`); **no npm workspaces**, no root deps. | Requested. PLAN.md still assumed workspaces and a root `prisma/`. |
| O2 | `prisma/` and `prisma.config.ts` move into `server/`. `shared/` becomes **Prisma-free** (no generated Prisma types). | The server owns the DB. Today `shared/api` imports Prisma types, which couples the client to the ORM. |
| O3 | `shared` consumed via `file:../shared` (built with tsup, ESM + d.ts). Server is **bundled with tsup** (`noExternal: shared`) so the runtime image needs no link. Vercel builds from repo root with explicit commands. A spike (P0-03) proves it, with a documented fallback (`scripts/sync-shared.mjs` copy). | Avoids runtime symlink/layout fragility. |
| O4 | Logging: pino to **stdout only**, no DB log path, plus optional `compose.observability.yaml` (Loki + Grafana + Alloy) and opt-in OpenTelemetry. | Requested. A DB outage must never break logging. |
| O5 | Migrations and seed run in a **one-shot `migrate` compose service** (same image, different command), not in the API entrypoint and not on import. API waits with `service_completed_successfully`. | Avoids races between replicas and hidden startup side effects. Matches best practice. |
| O6 | release-please and image publish are **jobs in the same workflow** (`needs`), not separate workflows keyed on `push tags`. | Events created with `GITHUB_TOKEN` do not start other workflows, so a tag-triggered publish workflow would silently never run [41][46]. |
| O7 | Image tags: `edge` + `sha-*` on `main`; `latest`, `X.Y.Z`, `X.Y` only from releases. | `latest` must mean "a release". |
| O8 | Vercel: `routes` with `dest` + `env` and a `transforms` request-header rule is the **documented** way to proxy to an external API and inject a header [35][37]. Needs `handle: filesystem` and an SPA fallback in the same `routes` list. `UNVERIFIED`: mixing `routes` with other keys, proven in spike P0-03 and P5-07. | PLAN.md used the right idea but did not specify the SPA fallback. |
| O9 | `ORIGIN_SECRET` is **optional**: enforced only when set (so local dev, curl and tests work). | PLAN.md would have broken local dev. |
| O10 | `TRUST_PROXY` is a **hop count** (default `1` behind Vercel), verified in spike. Rate limiting keys on the client IP. | Behind a proxy every request looks like one IP unless forwarded headers are parsed correctly. |
| O11 | Node **24 LTS** target (`engines >=24 <25`, `node:24-alpine`). | Local audited machine already runs Node 24.x, and Node 22 is in maintenance. Native module (bcrypt) prebuilds on alpine amd64 and arm64 are proven in spike. |
| O12 | Prisma pool settings go through the **adapter** options, not `?connection_limit=` URL params. `UNVERIFIED`; the spike confirms. | With driver adapters, engine URL params may not apply. |
| O13 | Red-build commits are confined to **one cutover phase (P2)** and every other phase stays green per commit. Server-only cleanups (Redis, Socket.IO, unused deps, config, logging, errors) are moved **before** the cutover. | PLAN.md scattered 5+ red windows. |
| O14 | Tests ship in the **same commit** as the code they cover (no "tests later" phase). CI gets the MariaDB service container the moment the first integration test lands. | Safety net grows with the change. |
| O15 | Added: one-command bootstrap (`npm run init`, `npm run doctor`), `lastLogin` update, async bcrypt, session-store-on-DB behavior, Prisma version pin, image scanning (Trivy), secret scanning (gitleaks), commitlint in CI only (no root deps), CODEOWNERS, PR template, read-only rootfs + dropped capabilities in prod compose, graceful shutdown. | Gaps against the best-practice checklist. |
| O16 | `SUMMARY.md`, `PLAN.md`, `FINAL_PLAN.md` are moved to `docs/archive/` in the last task. | Keep the root clean for the template. |

---

## 1. Execution rules

1. One task = one commit, Conventional Commits (`feat`, `fix`, `refactor`, `chore`, `docs`, `ci`, `build`, `test`), header at most 72 chars, `!` plus `BREAKING CHANGE:` footer for schema or API breaks.
2. Tests, docs and env-example updates for a change are in that same commit.
3. Every commit must pass its task's Verify command. Exception: tasks inside **Phase P2** may leave `build`/`typecheck` red; Phase P2's gate is the buildable unit (§5, P2).
4. Never commit `.env`, `.env.*` (except `*.example`), tokens, passwords or generated secrets. Never edit an applied migration after P2-02. Never use `prisma db push` anywhere.
5. Do not push until P7-02. Do not open a PR before the checklist in §9.2 is green.
6. When a task discovers that a planning assumption is false, record it in `docs/decisions/` (an ADR, 10 lines max), adjust the dependent tasks minimally, and continue.
7. Commands run per package: `npm --prefix server run <script>`, `npm --prefix client run <script>`, `npm --prefix shared run <script>`. The root `package.json` only has convenience scripts delegating this way and **no dependencies**.

---

## 2. Corrections to SUMMARY.md (verified against code)

| # | SUMMARY claim | Reality | Evidence |
|---|---|---|---|
| C1 | Update role "cannot touch a role at actor's level" | False. Only `level < actorLevel` or `-1` is rejected, and the new level may equal the actor's. Real privilege bug (removed with dynamic roles). | `server/src/controllers/account-roles/update.ts:40-45,81-88` |
| C2 | "No audit trail" | Overstated. `MetadataUpdateHistory` is written on account and role mutations. Kept as business audit; only `Log` is removed. | `services/accounts/update.ts:105-118`, `delete.ts:61-77` |
| C3 | Startup order starts with `loadEnv()` | Misleading. Static imports run `config/prisma.ts` (connect and seed) before `startServer()`. | `server/src/index.ts:13-19`, `config/prisma.ts:21-30` |
| C4 | `db push` would drop `campus` and `FormSubmission*` | Destructive risk, not a tested fact. | `compose.yaml:41` |
| C5 | Client build likely fails on the missing `@shared` alias | UNVERIFIED and probably too strong (type-only imports are erased). Moot after O3. | `client/vite.config.ts:16-19` |
| C6 | LoggingService does not persist | True. The only log-like DB writes are session rows and `MetadataUpdateHistory`. **The user states a custom function was believed to write a `log` record; the code shows it does not. The `Log` model is dead.** | `server/src/services/logging.ts:171-200` |

---

## 3. Findings

Severity: Critical = data loss, security, or blocks deployment. High = broken behavior or major flaw. Medium = maintainability or ops. Low = polish. "Task" is the task that fixes it.

| ID | Finding | Evidence | Sev | Task |
|---|---|---|---|---|
| A01 | 8 near-identical services duplicate metadata, history, soft-delete, retry, logging. | `server/src/services/{accounts,account-roles}/*` | High | P2-03 |
| A02 | No global error handler; per-controller try/catch and ad-hoc status mapping. | `controllers/accounts/create.ts:83-104` | High | P1-04, P2-04 |
| A03 | Non-idempotent creates retried without transaction; `EmailInUseError` checks legacy `emailValue`. | `services/accounts/create.ts:49-151` | Critical | P2-03 |
| A04 | Validation writes `req.parsedBody`; controllers read `req.body`. | `middleware/validationMiddleware.ts:24-32` | High | P1-05 |
| A05 | Client-supplied `fields`/`populate` drive Prisma selects. | `utils/prisma.ts:16-101` | Medium | P2-03 |
| A06 | Unbounded pagination and ID arrays. | `shared/schemas/accounts.ts:50-74` | Medium | P2-03 |
| D01 | Schema and migration disagree (`campus`, `inactive` vs `locked`, `FormSubmission*`). | `schema.prisma:29-68`, `migration.sql:22-23,112-136` | Critical | P2-02 |
| D02 | Compose runs `prisma db push` on every start. | `compose.yaml:37-42` | Critical | P5-03 |
| D03 | One misnamed migration, no baseline. | `migrations/20260512025450_add_form_submission` | Medium | P2-02 |
| D04 | Domain residue (campus, Spanish weekdays, attendance, university branding). | `UpdateModal.tsx:75-90`, `Admin.tsx:206` | High | P2-02, P2-08, P4-04 |
| D05 | Dynamic `AccountRole` (level, comma-separated permissions, 2FA flag). | `schema.prisma:11-24` | High | P2-01..P2-04 |
| D06 | Missing indexes on `Metadata.deleted`, `sessions.expiresAt`. | `schema.prisma:142-148` | Medium | P2-02 |
| L01 | `LoggingService` is `console.log` plus dead Mongo query code. | `services/logging.ts:171-265` | High | P1-02 |
| L02 | `Log` model, log permissions and logs page are dead. | `schema.prisma:166-181`, `admin/logs.tsx` | Medium | P2-02, P2-08 |
| L03 | No structured request logs, levels, redaction or trace correlation. | `index.ts:29-32`, `traceId.ts` | High | P1-02 |
| L04 | Bootstrap logs the admin password. | `setup.ts:67-69` | Critical | P2-06 |
| C01 | Three env loaders with different paths. | `env.ts:8-14`, `prisma.ts:9-18`, `prisma.config.ts:8-11` | High | P1-01 |
| C02 | Import-time DB connect and seed; listener does not await. | `config/prisma.ts:21-30` | Critical | P1-03 |
| C03 | Env validation checks presence only. | `env.ts:16-31` | High | P1-01 |
| C04 | `client/.env.example` empty. | `client/.env.example` | Medium | P0-06 |
| C05 | Inconsistent ports (3132, 3000, 3000:80, 2173). | `.env.example:12`, `compose.yaml:35` | High | P1-01, P5-03 |
| S01 | Read endpoints have no permission checks. | `routes/accounts.ts:77-79` | Critical | P2-04 |
| S02 | Unauthenticated Socket.IO broadcast. | `services/socket.ts:28-35` | High | P1-07 |
| S03 | Cookie `httpOnly:false`, `secure:false`; no session regeneration. | `services/sessions.ts:16-31` | Critical | P2-05 |
| S04 | No CSRF or Origin enforcement. | `index.ts:28-41` | High | P2-05 |
| S05 | No helmet or rate limit; 50 MB body. | `index.ts:29` | High | P2-05 |
| S06 | Hardcoded bootstrap admin credential. | `setup.ts:56-69` | Critical | P2-06 |
| S07 | Admin cannot change own password. | `update-password.ts:40-46` | High | P2-04 |
| S08 | No last-admin protection; system role deletable. | `account-roles/delete.ts:22-26` | Critical | P2-03 |
| S09 | 2FA, email verification, reset tokens are stubs. | `sessions.ts:58-77` | Medium | P2-02, P2-08 |
| S10 | Sync `bcrypt.compareSync` blocks the event loop; `lastLogin` never updated; logout does not destroy session. | `sessions.ts:59`, `logout.ts:9-17` | Medium | P2-05 |
| S11 | No DB least-privilege docs; one URL for runtime and migrations. | `prisma.config.ts:18-20` | High | P6-01 |
| S12 | Session store is in the app DB: outage means no logins. | `sessions.ts:26-30` | Medium | DEC-12, P1-06 |
| P01 | Three lockfiles with conflicting versions. | `server/package-lock.json` | High | P0-02 |
| P02 | Many unused dependencies. | `package.json:26-75` | Medium | P1-07 |
| P03 | Broken scripts (`build`, `build:shared`, `lint`, `sample:gps`). | `package.json:12-22` | High | P0-04 |
| P04 | No `engines`, `.nvmrc`; Node 20 image vs Node 24 local; Prisma CLI/client mismatch. | `Dockerfile:1`, lockfile | Medium | P0-01, P1-07 |
| P05 | Repo metadata points at `pumai`; ISC/MIT/proprietary conflict. | `package.json:108-116`, `LICENSE:1-3` | High | P6-07 |
| P06 | Drone only builds; no tests, push or deploy. | `.drone.yml` | High | P0-05, P5-10 |
| T01 | Single-stage root image with dev deps and client dist. | `Dockerfile:1-27` | High | P5-01 |
| T02 | Compose: `latest` DB, unused Redis, no healthchecks, port bug. | `compose.yaml:2-42` | High | P5-02..P5-04 |
| T03 | No headless mode; no Vercel config. | `index.ts:42-49` | High | P5-06, P5-07 |
| T04 | No GHCR publish, multi-arch, scan, release automation. | no `.github` | High | P5-08..P5-10 |
| U01 | AntD unthemed; `isDark=false` hardcoded; two providers with hardcoded `esES`. | `Admin.tsx:179-184`, `General.tsx:22-24` | High | P4-01, P4-02 |
| U02 | Tailwind `darkMode` misplaced; preflight vs AntD reset. | `tailwind.config.js:3-6`, `index.css:1-2` | High | P4-02 |
| U03 | Inline styles, hardcoded brand and Spanish-only locale. | `Admin.tsx:186-276` | Medium | P4-03, P4-04 |
| R01 | Client `some` vs server `every` permission semantics. | `client/src/utils/permissions.ts:13`, `authMiddleware.ts:25` | High | P2-01, P2-08 |
| X01 | No example module. | `routes/index.ts:8-12` | High | P3-01..P3-03 |
| X02 | No init or doctor tooling. | none | Medium | P6-04, P6-05 |
| X03 | Docs contradict code (JWT, Postgres, pnpm). No AGENTS.md. | `docs/*.md` | High | P6-01, P6-06 |
| X04 | No in-app docs; `react-markdown` unused. | `package.json:55` | Medium | P6-02, P6-03 |
| X05 | No tests, no health endpoints. | none | High | P0-04, P1-06 |

---

## 4. Decisions

| ID | Decision | Chosen | Tradeoff |
|---|---|---|---|
| DEC-01 | Repo layout | Three independent npm packages, no workspaces | Three installs and locks; `npm run bootstrap` hides it. No hoisting surprises. |
| DEC-02 | Sharing code | `shared/` built with tsup, linked by `file:../shared`; `zod` is a peer dependency | Build step before consumers typecheck; fallback is a copy sync script. |
| DEC-03 | Server bundling | tsup bundle with shared inlined; externals stay in `node_modules` | One more build tool; removes runtime link risk. |
| DEC-04 | Auth topology | Vercel `routes` proxy, same-site cookie `SameSite=Lax`, `__Host-` prefix in prod | One extra hop. WebSocket not proxied (none needed). |
| DEC-05 | Role storage | Prisma enum `Role {admin, manager, staff, viewer}` | New role needs a migration; document engine caveats. |
| DEC-06 | Permissions | Explicit `ROLE_PERMISSIONS` map in `shared/rbac`; admin = `ALL_PERMISSIONS`; no wildcard | More lines; auditable and identical on client and server. |
| DEC-07 | Management rule | `canManage(actor, target)` with strict rank, no self-management; last-admin guard in a transaction | Managers cannot create peers. |
| DEC-08 | Logger | pino + pino-http; pino-pretty in dev only; stdout JSON in prod | None. |
| DEC-09 | Log shipping | Collector reads stdout (Grafana Alloy), not an in-app transport | Needs a sidecar; app stays decoupled. `pino-loki` documented as opt-in. |
| DEC-10 | Tracing | Optional OpenTelemetry, off unless `OTEL_ENABLED=true`; pino instrumentation injects `trace_id` and `span_id` | Extra deps only when enabled. |
| DEC-11 | Audit data | Keep `MetadataUpdateHistory`; remove `Log` | None. |
| DEC-12 | Session store | Keep Prisma session store in the app DB. `/readyz` reports degraded; auth fails closed with 503, logged. | Logins stop during a DB outage; acceptable for single-tenant. |
| DEC-13 | API style | REST resources, explicit DTOs, `page` (1-based) and `pageSize` (max 100) | One-time client rewrite (cheap since role CRUD and dynamic selects are removed anyway). |
| DEC-14 | Schema history | Squash to `0001_init`; legacy export script for old data | Existing deployments need export and import. |
| DEC-15 | Migrations | One-shot `migrate` service runs `prisma migrate deploy` then the seed CLI; the API never migrates | One more compose service. |
| DEC-16 | CSRF | Double-submit token (`x-csrf-token` vs `csrf` cookie) plus Origin check | Token cookie is JS-readable by design. |
| DEC-17 | Rate limiting | In-memory `express-rate-limit` | Single instance only; document shared store for scale-out. |
| DEC-18 | Password hashing | bcrypt cost 12, async API, rehash-on-login when cost changes | Native module; prebuilds proven in spike. |
| DEC-19 | Remove | Redis, Socket.IO, GPS demo, 2FA, email verification, reset tokens, reports placeholders, config/logs pages | Documented as future modules. |
| DEC-20 | Runtime | Node 24 LTS, `node:24-alpine`, `mariadb:11.4` pinned, Prisma CLI = client exact version | Re-test on upgrades. |
| DEC-21 | Test DB | CI MariaDB 11.4 service container; local `compose.dev.yaml` | Not hermetic locally without compose. |
| DEC-22 | Releases | release-please; publish is a job in the same workflow; image tags per O7 | Needs `contents`/`pull-requests` write; manual tag fallback. |
| DEC-23 | Docs | English canonical developer docs; UI `en` default plus `es`; docs API-served from allowlisted `docs/in-app/*.md` with `docs:read` | Docs need the API up. |
| DEC-24 | Bootstrap admin | Env email and password, or one-time generated password printed once; `mustChangePassword=true` | Operator must capture the one-time password. |
| DEC-25 | License | MIT, pending owner approval | Legal sign-off needed before P6-07. |
| DEC-26 | Origin secret | Optional `ORIGIN_SECRET`, constant-time compare when set; health endpoints exempt | Unset means the API is directly reachable (acceptable for dev). |

---

## 5. Target architecture

### 5.1 Repository tree

```text
.
├── .github/{workflows/{ci,release}.yml, dependabot.yml, CODEOWNERS, pull_request_template.md}
├── client/                      # Vite SPA, own package.json + lock
│   ├── src/{app,components,config,features/{auth,accounts,items,roles,docs},layouts,locales/{en,es},rbac,routes,theme}
│   └── .env.example
├── server/                      # headless API, own package.json + lock
│   ├── prisma/{schema.prisma,migrations/0001_init/}        # prisma.config.ts sits in server/
│   ├── src/{config,db,http,middleware,rbac,routes,services,cli/{seed,doctor}.ts,app.ts,main.ts,logger.ts,telemetry.ts}
│   ├── test/
│   └── .env.example
├── shared/                      # Prisma-free contracts, own package.json + lock
│   └── src/{config/app.ts,rbac,schemas,api,index.ts}
├── docs/{index,architecture,configuration,deployment,observability,rbac,database,api,testing,contributing,template-usage,example-module,upgrading}.md
│   ├── in-app/{index,database,rbac,deployment}.md
│   ├── decisions/               # ADRs
│   └── archive/                 # SUMMARY, PLAN, FINAL_PLAN (P7-02)
├── deploy/{observability/{loki.yaml,alloy.river,grafana-datasource.yaml}}
├── scripts/{init.mjs,doctor.mjs,bootstrap.mjs,sync-shared.mjs,remove-example.mjs,legacy/export-legacy-data.ts}
├── compose.dev.yaml  compose.prod.yaml  compose.ghcr.yaml  compose.observability.yaml
├── Dockerfile  .dockerignore  vercel.json  mkdocs.yml
├── AGENTS.md  README.md  LICENSE  .nvmrc  .editorconfig  .gitattributes
└── package.json                 # scripts only, zero dependencies
```

### 5.2 Topology

```mermaid
flowchart TB
  U[Browser] -->|HTTPS| V[Vercel static SPA]
  V -->|same-origin /api| R["vercel.json routes<br/>dest API_URL + x-origin-secret"]
  R -->|HTTPS| API["Headless API container<br/>SERVE_CLIENT=false"]
  API --> DB[(MariaDB 11.4)]
  MIG["migrate one-shot<br/>prisma migrate deploy + seed"] --> DB
  API -. stdout JSON .-> ALLOY[Grafana Alloy] --> LOKI[(Loki)] --> GRAF[Grafana]
  CI[GitHub Actions] -->|buildx amd64+arm64, Trivy| GHCR[(ghcr.io)] -->|compose pull| API
```

### 5.3 Environment reference (names only)

| Name | Purpose | Required | Default | Read by |
|---|---|---|---|---|
| `NODE_ENV` | mode | prod | `development` | server |
| `PORT` | API port | yes | `3000` | server, compose |
| `DATABASE_URL` | runtime DSN `mysql://user:pass@host:3306/db` | yes | none | server |
| `MIGRATE_DATABASE_URL` | DDL user DSN for migrate | no | `DATABASE_URL` | prisma, migrate service |
| `DB_POOL_LIMIT` | adapter pool size (`UNVERIFIED` name; confirm in spike) | no | `10` | server |
| `SESSION_SECRET` | session and cookie signing, at least 32 chars | yes | none | server |
| `CORS_ORIGINS` | comma-separated browser origins (include the Vercel domain) | prod | none | server |
| `TRUST_PROXY` | proxy hop count | no | `0` (`1` behind Vercel) | server |
| `ORIGIN_SECRET` | enforced when set; Vercel injects it | prod | unset | server, Vercel |
| `SERVE_CLIENT` | serve `client-dist` from API | no | `false` | server |
| `LOG_LEVEL` | `trace` to `fatal` | no | `info` | server |
| `LOG_FORMAT` | `json` or `pretty` | no | `json` in prod | server |
| `SERVICE_NAME` | log field `service` | no | package slug | server |
| `OTEL_ENABLED` | enable OpenTelemetry | no | `false` | server |
| `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_SERVICE_NAME` | standard OTel vars | when enabled | none | server |
| `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD`, `BOOTSTRAP_ADMIN_NAME` | first admin | first run | password generated if empty | seed CLI |
| `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`, `LOGIN_RATE_LIMIT_MAX` | limits | no | `900000`, `300`, `10` | server |
| `DOCS_DIR` | in-app docs dir | no | `docs/in-app` | server |
| `COOKIE_DOMAIN` | optional cookie domain | no | empty | server |
| `VITE_API_URL` | browser API base | client build | `/api` | client |
| `VITE_APP_NAME`, `VITE_APP_SLUG`, `VITE_BRAND_COLOR`, `VITE_DEFAULT_LOCALE` | brand overrides | no | shared defaults | client |
| `API_URL`, `ORIGIN_SECRET` | Vercel-side proxy target and secret | Vercel | none | `vercel.json` |
| `MYSQL_ROOT_PASSWORD`, `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD` | compose DB init | compose | none | compose |
| `GHCR_OWNER`, `IMAGE_NAME`, `IMAGE_TAG` | image reference | ghcr compose | tag `latest` | compose |

---

## 6. Phased tasks

Columns: **ID | Task and work | Files (C create, M modify, D delete) | Acceptance and Verify | Commit | Needs**.
"Pkg gate" means run lint, typecheck, test and build in every package touched.

### P0 — Structure spike and safety net (all green)

| ID | Task and work | Files | Acceptance and Verify | Commit | Needs |
|---|---|---|---|---|---|
| P0-01 | Create branch; pin runtime: `.nvmrc` = `24`, `engines` (`node >=24 <25`, `npm >=10`) in each package; add `.editorconfig`, `.gitattributes` (eol=lf). | C `.nvmrc`, `.editorconfig`, `.gitattributes`; M package manifests | `node -v` prints 24.x; `git branch --show-current` = `refactor/template-v1` | `chore: pin node and npm versions` | none |
| P0-02 | Split into independent packages. `git mv` so history is kept. Delete root `workspaces`, root and child lockfiles. Each package gets its own `package.json` (name, `type: module`, scripts, engines, license placeholder) and lock via `npm install` run inside it. `shared/package.json`: `exports`, `build` with tsup (ESM + d.ts), `zod` as `peerDependency` plus `devDependency`. Move `prisma/` and `prisma.config.ts` into `server/` (paths fixed, still compiling is not required yet if only moves; keep old behavior). Root `package.json` has scripts only (`bootstrap`, `dev`, `build`, `lint`, `typecheck`, `test`, each delegating with `npm --prefix`). Create `scripts/bootstrap.mjs` (install shared, build shared, install server, install client). | C `shared/package.json`, `scripts/bootstrap.mjs`; M `package.json`, `server/package.json`, `client/package.json`; D `package-lock.json` (root), stray locks; git mv `prisma/` → `server/prisma/` | `git ls-files "*package-lock.json"` lists exactly three locks (shared, server, client); root `node_modules` absent after `npm run bootstrap`; `npm run bootstrap` exits 0 | `refactor!: split into independent packages` | P0-01 |
| P0-03 | **Spike (must pass before P1).** Prove: (a) server tsup bundle inlines shared and runs with plain `node`; (b) client Vite resolves shared types and values; (c) Docker build with repo-root context builds shared then server, runtime image has no link to `../shared`; (d) bcrypt prebuild loads in `node:24-alpine` on amd64 and arm64 (buildx or QEMU); (e) Vercel: Root Directory = repo root, install/build commands run `shared`, then `client`, output `client/dist`; a `routes` list with `{"handle":"filesystem"}`, an `/api/(.*)` proxy with `transforms` header injection and `env`, and an SPA fallback is accepted by `vercel build` (`UNVERIFIED` item [37]); (f) the adapter pool option name and whether `connection_limit` URL params apply (O12); (g) the `TRUST_PROXY` hop count seen through the Vercel proxy (test in P5-07). Record each result and the fallback taken in `docs/decisions/0001-package-layout.md`. If (a)-(c) fail, adopt `scripts/sync-shared.mjs` (copy `shared/src` to `client/src/_shared` and `server/src/_shared`, git-ignored, run in `predev`/`prebuild`) and update dependants. | C `docs/decisions/0001-package-layout.md`, temp spike files removed after | ADR lists a pass/fail line for (a)-(f); no spike artefacts left in the tree | `docs: record package layout spike results` | P0-02 |
| P0-04 | Per-package tooling: ESLint flat config, Prettier, strict tsconfig extending a copy of a base config per package (no cross-package extends), Vitest (node for server and shared, jsdom for client). Scripts: `lint`, `format:check`, `typecheck`, `test`, `test:coverage`, `build` per package; fix `build`, remove `sample:gps`, `build:shared`. Add `knip` (or `depcheck`) as a dev tool to find unused deps. | C `*/eslint.config.js`, `*/.prettierrc.json`, `*/tsconfig.json` updates, `*/vitest.config.ts` | `npm run lint`, `typecheck`, `test` (with `--passWithNoTests`) from the root exit 0; `build` may only fail in `server` until P2 (record) | `chore: add per-package lint, typecheck and test tooling` | P0-03 |
| P0-05 | Baseline CI: matrix job per package (`working-directory`, `npm ci`, lint, typecheck, test, build where green), top-level `permissions: contents: read`, concurrency cancel-in-progress, `setup-node` cache keyed per lock, actions pinned by major version (SHA for third-party), `gitleaks` job, commitlint job on PR titles and commits via a pinned action (no root deps). | C `.github/workflows/ci.yml` | YAML parses; workflow green on the branch | `ci: add baseline workflow with secret and commit lint` | P0-04 |
| P0-06 | Env examples per package listing every var from §5.3 for that package, no real values; `.gitignore` for `.env*` except `*.example`; client `.env.example` with `VITE_*`. | C `server/.env.example`, `client/.env.example`; M `.gitignore` | `git check-ignore -v server/.env` matches; examples contain placeholders only | `chore: document environment files` | P0-02 |

**P0 gate:** `npm run bootstrap && npm run lint && npm run typecheck && npm run test`.

### P1 — Server foundation (all green; no schema change)

| ID | Task and work | Files | Acceptance and Verify | Commit | Needs |
|---|---|---|---|---|---|
| P1-01 | One Zod config module: parse and coerce every server var, secret length check, `TRUST_PROXY` int, URL checks; field-level error list then exit 1. Env file resolved once from `ENV_FILE` or `server/.env`. Remove other dotenv loaders and `config/redis.ts`; `prisma.config.ts` loads only `MIGRATE_DATABASE_URL ?? DATABASE_URL`. Unit tests with valid and invalid env. | C `server/src/config/{env,index}.ts` + test; M `server/prisma.config.ts`; D old `env.ts`, `redis.ts` | Invalid env prints all problems; `npm --prefix server run test -- config` passes | `refactor: add typed zod configuration` | P0 |
| P1-02 | pino + pino-http. JSON in prod, pino-pretty in dev. Fields: time, level, msg, service, env, version, `req.id` (also returned as `x-trace-id`), method, path, status, duration. Redact `req.headers.cookie`, `authorization`, `set-cookie`, and `password`, `newPassword`, `currentPassword`, `token`, `DATABASE_URL`. Replace every `console.*` and `LoggingService` call; delete `services/logging.ts` and `middleware/traceId.ts`. Unhandled rejection and uncaught exception log `fatal` and exit non-zero. Optional `telemetry.ts` (OTel, off by default) loaded first in `main.ts`. Test: logger output contains no secrets. | C `server/src/logger.ts`, `middleware/request-logger.ts`, `telemetry.ts`, tests; D `services/logging.ts`, `middleware/traceId.ts` | `rg -n "console\." server/src` empty; redaction test passes | `refactor: replace logging with pino` | P1-01 |
| P1-03 | Explicit startup: `main()` = config, logger, Prisma client, `$connect`, (temporary) existing bootstrap call, `createApp()`, `listen`. No import-time side effects. SIGTERM/SIGINT: stop accepting, drain, `$disconnect`, exit 0 (hard timeout 10 s). `app.ts` exports `createApp(deps)` for tests. | C `server/src/{main,app}.ts`, `db/prisma.ts`; M `index.ts`; D `config/prisma.ts` | Server does not connect on import; SIGTERM exits 0; DB down logs a clear fatal and exits non-zero | `refactor: make startup sequence explicit` | P1-02 |
| P1-04 | `AppError` family, `asyncHandler`, global `errorHandler` returning `{error:{code,message,details?,traceId}}` (no stack in prod), JSON 404 for `/api/*`. Wire into `createApp`; existing controllers keep working (they are replaced in P2). | C `server/src/http/{errors,async-handler,error-handler,not-found}.ts` + tests | Unknown error gives 500 with no stack; known `AppError` maps correctly | `refactor: add centralized error handling` | P1-03 |
| P1-05 | Validation applies parsed data (`req.body = parsed`), plus `validateQuery` and `validateParams`. Regression test with a Zod default and transform. | C `server/src/http/validation.ts` + test; D `validationMiddleware.ts`; M routes | `rg -n parsedBody server shared` empty; test passes | `fix: apply validated request data` | P1-04 |
| P1-06 | `GET /healthz` (no deps) and `GET /readyz` (`SELECT 1`, 503 plus log on failure). Exempt from CSRF, origin secret and rate limit. | C `server/src/routes/health.ts` + test | 200 and 503 behaviour tested | `feat: add health and readiness endpoints` | P1-03 |
| P1-07 | Remove Redis, Socket.IO (server and client), GPS demo, unused deps (`chromadb`, `connect-mongo`, `sharp`, `leaflet`, `recharts`, `nodemailer`, `@hello-pangea/dnd`, `antd-img-crop`, `idb-keyval`, `fs`, `fs-extra`, `validator`, `dayjs` if unused, `@tanstack/nitro-v2-vite-plugin`, `web-vitals`, etc., confirmed with knip). Pin Prisma CLI and client to the same exact version; pin `@prisma/adapter-mariadb` to it. | M package manifests and locks; D socket and demo files | `rg -n -e "socket\.io" -e "REDIS_URL" -e "update_coords" server client` empty; knip reports no unused deps; build still as before | `chore: remove unused services and dependencies` | P1-05 |

**P1 gate:** per-package lint, typecheck, test (green); `server` build status recorded.

### P2 — Cutover: schema, hardcoded RBAC, hardening, client sync

Intermediate commits P2-02 through P2-07 may leave `typecheck`/`build` red. **The P2 gate is the unit.** Work server first (P2-01 to P2-07), then client (P2-08).

| ID | Task and work | Files | Acceptance and Verify | Commit | Needs |
|---|---|---|---|---|---|
| P2-01 | **Additive, green.** `shared/src/rbac`: `Role` const, `Permission` union, `ROLE_PERMISSIONS` (admin = explicit full list), `ROLE_RANK`, `roleHasPermission`, `canManage(actor, target)` (strict rank, never self). Permissions: `accounts:{read,create,update,update-status,change-password,delete,restore}`, `items:{read,create,update,delete,restore}`, `roles:read`, `docs:read`. No wildcard. Table-driven tests for every role and permission pair. Shared also exports Zod schemas for pagination (`page` 1-based, `pageSize` 1-100, ID arrays max 100) and `src/config/app.ts` (name, slug, logo, default locale, brand colour). Remove all Prisma-type imports from `shared`. | C `shared/src/{rbac,config,schemas}/*`; M `shared/src/api/*` | `npm --prefix shared run test` and `build` pass; `rg -n "@prisma" shared` empty | `feat: define shared roles and permissions` | P1 |
| P2-02 | Server schema and baseline. Models: `Account`, `Item`, `Metadata`, `MetadataUpdateHistory`, `Session` (`@@map("sessions")`). Enums `Role`, `AccountStatus {active, inactive}`, `ItemStatus {active, archived}`. `Account.mustChangePassword`, `Account.lastLogin`. Indexes: `Account.role`, `Account.status`, `Item.status`, `Metadata.deleted`, `MetadataUpdateHistory.updatedAt`, `Session.expiresAt`. `utf8mb4/utf8mb4_unicode_ci`. Delete the old migration; generate `0001_init` with `prisma migrate diff --from-empty --to-schema-datamodel`; inspect. Remove `AccountRole`, `Config`, `Log`, `FormSubmission*`, `campus`, TFA/verification/reset columns. Prisma client built through the MariaDB adapter with pool options per spike (f). | M `server/prisma/schema.prisma`, `db/prisma.ts`; D old migration; C `server/prisma/migrations/0001_init/migration.sql` | `npx prisma validate`; `migrate deploy` on empty MariaDB 11.4 creates the five tables; second run is a no-op; `migrate status` clean | `refactor!: replace schema with template v1` | P2-01 |
| P2-03 | Persistence layer. `db/audit.ts` (metadata create, history append, soft delete, restore) and `db/tx.ts`. `services/account-service.ts`: create, update, status, password, delete, restore, list, get, all in one `$transaction` with history rows (passwords never stored in history). Policy: `canManage`, last-admin guard (count admins inside the transaction; reject delete, demote or disable of the last active admin), no self-delete. Explicit DTO mappers (no hash, no tokens). Anonymise email on soft delete. Remove `async-retry`, dynamic select builders, `services/accounts/*`, `services/account-roles/*`, `utils/prisma.ts`. Tests against MariaDB. | C `server/src/{db/audit,db/tx,services/account-service,rbac/account-policy,http/dto/accounts,http/pagination}.ts` + tests; D old services and utils | Unit tests: manager cannot manage manager or admin; last admin cannot be removed; audit row per mutation; `pageSize=1000` rejected | `refactor: rebuild account persistence with audit and policy` | P2-02 |
| P2-04 | Routes and controllers (REST): `/api/auth/{csrf,login,logout,me,change-password}`, `/api/accounts` (GET list, GET :id, POST, PATCH :id, POST :id/status, POST :id/password, DELETE :id, POST :id/restore), `GET /api/roles` (static map, read-only). **Default deny:** `requireAuthenticated` and `requirePermission(p)` on every route except `login`, `csrf`, `healthz`, `readyz`; a route-table test fails if any route lacks middleware. 403 for missing permission, 401 only when unauthenticated. Controllers throw `AppError`; no try/catch. Delete role CRUD, old controllers and routes. Add the CI MariaDB service container here (first integration tests). | C `server/src/{middleware/require-permission,routes/*,controllers/*}.ts`, `server/test/{routes,accounts,auth}.test.ts`; M `.github/workflows/ci.yml`; D `controllers/*`, `routes/account-roles.ts` | Route audit test passes; permission matrix test for 4 roles; CI integration job green | `feat: rest api with default-deny permissions` | P2-03 |
| P2-05 | HTTP and session hardening. helmet; body limit 1 MB; `trust proxy` from config; cookie `__Host-app.sid` in prod (`app.sid` in dev), `HttpOnly`, `Secure` in prod, `SameSite=Lax`, 7 days; session `regenerate` on login, `destroy` and cookie clear on logout; CSRF double-submit plus Origin check on unsafe methods (allowed origins from `CORS_ORIGINS`); `express-rate-limit` (login 10 per 15 min, global 300 per 15 min, keyed by client IP); optional origin-secret check with `timingSafeEqual` (exempts health); async bcrypt cost 12 with rehash on login; update `lastLogin`; when the DB is unavailable, auth returns 503 and logs it (DEC-12). Tests for each control. | C `server/src/middleware/{security,csrf,rate-limit,origin-secret}.ts` + tests; M `app.ts`, session setup | Cookie flags asserted; missing CSRF gives 403; bad origin 403; wrong secret 403; 429 on the 11th login; `lastLogin` updates | `feat: harden sessions and http security` | P2-04 |
| P2-06 | Bootstrap and password flows. `server/src/cli/seed.ts` (idempotent): if no accounts, create admin from env, `mustChangePassword=true`; if no password given, generate 24+ random chars and print once to stdout (never to the logger). Remove `setup.ts` and the temporary bootstrap call from `main.ts`. Middleware blocks every route except `me`, `change-password`, `logout` while `mustChangePassword`. `POST /api/auth/change-password` verifies the current password. Admin reset via policy. Add `db:seed` script (`node dist/cli/seed.js`). | C `server/src/cli/seed.ts` + tests; D `server/src/setup.ts`; M `main.ts`, `auth` controller | Seed twice gives one admin; generated password appears once; flag enforced; old password stops working after change; `rg -n "admin123"` empty | `feat: env-driven seed and forced password change` | P2-05 |
| P2-07 | Legacy export script (read-only) mapping old `AccountRole` (`level -1` or name Admin to `admin`, known names to `manager`, `staff`, `viewer`, unknown to `viewer`) into NDJSON for import, with `--dry-run`; `docs/upgrading.md` (backup, new DB, import, cutover, rollback). | C `scripts/legacy/export-legacy-data.ts`, `docs/upgrading.md` | `--dry-run` prints the mapping table and writes nothing | `feat: add legacy data export script` | P2-06 |
| P2-08 | Client cutover. API modules rewritten for REST and DTOs (single axios instance, CSRF header, one error path). Remove roles CRUD UI, 2FA modal, campus, reports placeholders, logs and config pages. Add `rbac/{can,Can,useCan}` using the shared map, route guards, read-only roles page, change-password page and forced-change redirect. Nav and buttons gated by `Can`. Tests (`Can`, route guard). | C `client/src/{rbac,features/roles,features/auth}/*`; M layouts, routes; D old role features, TFA code | **P2 gate passes**; `rg -n -e campus -e FormSubmission -e requiresTwoFactor -e account-roles -e tfa client server shared` empty | `feat: sync client with hardcoded rbac` | P2-07 |

**P2 gate (first fully green build):** `npm run bootstrap && npm run lint && npm run typecheck && npm run test && npm run build`; `migrate deploy` on a disposable MariaDB; manual matrix for admin, manager, staff, viewer; forced password change; last-admin deletion rejected.

### P3 — Example module (green)

| ID | Task and work | Files | Acceptance and Verify | Commit | Needs |
|---|---|---|---|---|---|
| P3-01 | `Item` backend slice: shared schema and DTO, service with audit, REST `/api/items` (list, get, create, patch, delete soft, restore), permissions `items:*`, integration tests. | C `shared/src/{schemas,api}/items.ts`, `server/src/{services/item-service,routes/items,controllers/items}.ts` + tests | Viewer reads only; mutations write history rows; CRUD and restore tested | `feat: add items example module (server)` | P2 |
| P3-02 | `Item` client slice: AntD table with search and pagination, create and edit modal, delete and restore confirm, `Can` gating, loading, error and empty states, tests. | C `client/src/features/items/*`, `client/src/routes/admin/items.tsx`; M nav, locales | Page works per role; tests pass | `feat: add items example module (client)` | P3-01 |
| P3-03 | `scripts/remove-example.mjs` (deletes the example files, permissions, nav entry and a `drop Item` migration stub) and `docs/example-module.md` (copy or delete procedure). | C script and doc | `--dry-run` lists exactly the files; running it on a scratch copy still builds | `feat: add example module removal script` | P3-02 |

### P4 — Theme, branding, i18n (green)

| ID | Task and work | Files | Acceptance and Verify | Commit | Needs |
|---|---|---|---|---|---|
| P4-01 | `client/src/theme`: one `ThemeProvider` wrapping AntD `ConfigProvider` with light and dark algorithms, brand tokens from `shared/src/config/app.ts` plus `VITE_*` overrides, component overrides (Layout, Menu, Button, Table, Modal), mode persisted, CSS variables for Tailwind. Tests. | C `client/src/{theme,config}/*` | Light and dark switch; tokens applied | `feat: add antd theme provider and brand tokens` | P3 |
| P4-02 | Mount the single provider at app root; delete per-layout providers; fix Tailwind (`darkMode` at top level, preflight disabled or scoped so AntD resets win; map `primary` to `var(--brand-primary)`). Add error boundary, route-level code splitting, wire the 404 route as the router default. | M `main.tsx`, `App.tsx`, layouts, `index.css`, tailwind config | `rg -n "<ConfigProvider" client/src` shows exactly one; build passes | `refactor: centralize theme and align tailwind` | P4-01 |
| P4-03 | Locale packs by namespace (`en` default, `es` complete), AntD locale map, language switcher, move all strings. Test: key parity between `en` and `es`. | C `client/src/locales/{en,es}/*`, `components/LanguageSwitcher.tsx`; D `locales/es.ts` | Parity test passes; switching updates AntD locale | `feat: add en and es locale packs` | P4-02 |
| P4-04 | Remove hardcoded branding ("Universidad", "Plantilla", "Sistema Random") and inline styles in layouts and features; title and logo from brand config. | M layouts, `index.html`, features | `rg -n -e Universidad -e "Sistema Random" client/src client/index.html` empty | `refactor: remove hardcoded branding and inline styles` | P4-03 |

**P4 gate:** client lint, typecheck, test, build; visual smoke light/dark and en/es.

### P5 — Docker, compose, observability, Vercel, GHCR (green)

| ID | Task and work | Files | Acceptance and Verify | Commit | Needs |
|---|---|---|---|---|---|
| P5-01 | Multi-stage `Dockerfile` (context = repo root): `deps-shared`, `build-shared`, `deps-server`, `build-server` (prisma generate, tsup), `prod-deps` (`npm ci --omit=dev`), `runtime` (non-root `USER node`, `tini` or `--init`, exec-form CMD, `HEALTHCHECK` on `/healthz`, `NODE_ENV=production`, prisma CLI available to the `migrate` command, docs copied for the docs API). `.dockerignore`. Image excludes `client/`. | C `Dockerfile`, `.dockerignore` | `docker build` passes; `docker run --rm img id` is uid 1000; image has no `client/dist`; `docker run img node dist/main.js` fails fast with a config error and no stack | `build: add multi-stage production image` | P4 |
| P5-02 | `compose.dev.yaml`: `mariadb:11.4` with healthcheck, named volume, `env_file`, port `127.0.0.1:3306`; `adminer` under profile `tools`; no app service. | C `compose.dev.yaml` | `docker compose -f compose.dev.yaml config` valid; db becomes healthy | `build: add development compose` | P5-01 |
| P5-03 | `compose.prod.yaml`: services `mariadb` (pinned, healthcheck, volume), `migrate` (same image, command `prisma migrate deploy` then seed CLI, `restart: "no"`, uses `MIGRATE_DATABASE_URL`), `api` (`depends_on` migrate `service_completed_successfully`, `read_only: true`, `tmpfs: /tmp`, `cap_drop: [ALL]`, `security_opt: no-new-privileges`, `restart: unless-stopped`, healthcheck, port `127.0.0.1:${PORT}:${PORT}`, `env_file`). | C `compose.prod.yaml` | `config` valid; `up --build` leaves `migrate` exited 0 and `api` healthy; `curl /readyz` 200 | `build: add production compose with migrate job` | P5-02 |
| P5-04 | `compose.ghcr.yaml`: same shape as prod but `image: ghcr.io/${GHCR_OWNER}/${IMAGE_NAME}:${IMAGE_TAG:-latest}` and **no `build:`**; `.env.ghcr.example`; README quick start (`docker login ghcr.io`, `pull`, `up -d`). | C `compose.ghcr.yaml`, `.env.ghcr.example` | `docker compose -f compose.ghcr.yaml config` has no `build` | `build: add ghcr pull-only compose` | P5-03 |
| P5-05 | Observability overlay `compose.observability.yaml`: Loki, Grafana (provisioned Loki datasource), Grafana Alloy reading container stdout via the Docker socket (read-only; dev and demo only, documented risk), labels `service`, `level`. `deploy/observability/*`. `docs/observability.md`: stdout to collector to Loki or any backend, `pino-loki` opt-in tradeoff, OTel enablement and `trace_id` correlation. | C compose overlay, `deploy/observability/*`, doc | `docker compose -f compose.dev.yaml -f compose.observability.yaml config` valid; logs from a running API appear in Grafana Explore (manual) | `build: add optional observability stack` | P5-03 |
| P5-06 | Headless mode: `SERVE_CLIENT=false` default; static serving and SPA fallback only when true; `/` returns a JSON 404 under headless. Test both modes. | M `server/src/app.ts`, config; C test | Headless has no static middleware; `SERVE_CLIENT=true` serves a supplied `client-dist` | `feat: add headless server mode` | P5-01 |
| P5-07 | Vercel: `vercel.json` with `routes`: `{"handle":"filesystem"}`; `/api/(.*)` to `${API_URL}/api/$1` (route `env: ["API_URL"]`) with a `transforms` request-header set for `x-origin-secret` from `ORIGIN_SECRET` (`env: ["ORIGIN_SECRET"]`) [37]; SPA fallback to `/index.html`; install/build commands build `shared` then `client`; output `client/dist`; `VITE_API_URL=/api`. Preview and production env scoping documented. Confirm the client IP the API sees and set `TRUST_PROXY` accordingly. | C `vercel.json`, `docs/deployment.md` | `vercel build` accepts it (`UNVERIFIED` if CLI unavailable, then verify on a preview deploy); `/api/healthz` proxied; deep link serves the SPA; API logs show the real client IP | `feat: add vercel spa and api proxy config` | P5-06 |
| P5-08 | Image publish job (in `.github/workflows/release.yml`): `permissions` `contents: read`, `packages: write`; QEMU, Buildx, login with `GITHUB_TOKEN`; `docker/metadata-action` tags: `edge` and `sha-*` on pushes to `main`; `latest`, `X.Y.Z`, `X.Y` only on releases; platforms `linux/amd64,linux/arm64`; GHA cache; OCI labels; SBOM and provenance on; Trivy scan (fail on HIGH/CRITICAL fixed vulns) before push. | C `.github/workflows/release.yml` | YAML valid; dry build on a branch; both architectures present after a test publish | `ci: build, scan and publish multi-arch image to ghcr` | P5-01 |
| P5-09 | release-please in the same workflow; the publish job `needs` the release job and runs when `release_created` is true. Manual `vX.Y.Z` tag fallback via `workflow_dispatch`. Do not rely on a separate tag-triggered workflow [41][46]. | C `release-please-config.json`, `.release-please-manifest.json`; M `release.yml` | A release PR opens with a changelog; merging it publishes the image in the same run | `ci: add release automation` | P5-08 |
| P5-10 | `dependabot.yml` (npm per package dir, docker, github-actions, weekly, grouped); delete `.drone.yml`; add `CODEOWNERS`, PR template. | C `.github/*`; D `.drone.yml` | Files parse; no Drone left | `chore: add dependabot and remove drone` | P5-08 |

**P5 gate:** `docker build`; `config` for all four compose files; `up` prod stack and `curl /readyz`; `npm run build`.

### P6 — Docs, in-app docs, init, doctor, AGENTS (green)

| ID | Task and work | Files | Acceptance and Verify | Commit | Needs |
|---|---|---|---|---|---|
| P6-01 | Rewrite docs from the code: quickstart, architecture, configuration, deployment (Vercel plus headless plus GHCR), rbac, observability, database (content in §8), api, testing, contributing, template-usage. Delete `docs.md`, `docs/es`, outdated pages. MkDocs nav; `docs/requirements.txt`. | C docs set, `docs/in-app/*`; M `README.md`, `mkdocs.yml`; D stale docs | `mkdocs build --strict` passes; every command copy-pasteable | `docs: rewrite template documentation` | P5 |
| P6-02 | Docs API: `GET /api/docs` (manifest) and `GET /api/docs/:slug`, slug regex, `realpath` containment inside `DOCS_DIR`, allowlist from manifest, `docs:read`, in-memory cache in prod. Tests for traversal (`..`, encoded, absolute, symlink). | C `server/src/{routes,controllers}/docs.ts`, tests | Viewer 403, admin 200; traversal attempts rejected | `feat: serve permissioned in-app docs` | P6-01 |
| P6-03 | Docs UI: route gated by `docs:read`, manifest sidebar, `react-markdown` + `remark-gfm` (no `rehype-raw`), table of contents, states, localised chrome. Includes the database-switching page from §8. | C `client/src/features/docs/*`, route; M nav | Viewer cannot see nav or page; markdown tables and code render; no raw HTML | `feat: add in-app documentation page` | P6-02 |
| P6-04 | `scripts/init.mjs` (`npm run init`): flags `--name --slug --title --image --repo --locale --brand --yes --dry-run --force`; renames package names, container, image, titles, repo URLs; generates `server/.env` and `client/.env` with random `SESSION_SECRET` and DB passwords; optionally starts `compose.dev.yaml` DB; runs `bootstrap`, `migrate deploy`, seed; prints the login (one-time password) once; idempotent, refuses a second run without `--force`; never prints secrets except the one-time admin password. | C `scripts/init.mjs`; M root scripts | `--dry-run` writes nothing and prints a diff plan; a real run on a scratch copy yields a working login | `feat: add one-command template init` | P6-01 |
| P6-05 | `scripts/doctor.mjs` (`npm run doctor`): Node version, env completeness, DB reachability, migration status, port conflicts, shared build presence; actionable messages. | C `scripts/doctor.mjs` | Fails with clear text on a missing `.env` and on an unreachable DB | `feat: add doctor diagnostics` | P6-04 |
| P6-06 | `AGENTS.md` (at most 250 lines): overview, exact per-package commands, repo map, conventions, commit format, how to add a module, permission and role, testing expectations, never-do list (`db push`, committing `.env`, editing applied migrations, wildcard permissions, importing Prisma into `shared`, logging to the DB). | C `AGENTS.md` | Every listed command runs | `docs: add AGENTS.md` | P6-05 |
| P6-07 | MIT licence and metadata: `LICENSE`, `"license": "MIT"` and repository, homepage and bugs in all three packages, remove `pumai`. **Blocked until the owner approves MIT.** | M `LICENSE`, manifests, README | `npm pkg get license` is MIT in all three | `chore: adopt mit licence and fix metadata` | P6-01 |

**P6 gate:** `mkdocs build --strict`; `npm run init -- --dry-run`; docs permission matrix tests.

### P7 — Final

| ID | Task and work | Files | Acceptance and Verify | Commit | Needs |
|---|---|---|---|---|---|
| P7-01 | Coverage thresholds (80 percent lines for `shared/src/rbac`, `server/src/rbac`, `server/src/http`, `server/src/middleware`); full clean-clone run of the §9.2 checklist; fix findings. | M vitest configs, CI | Checklist green | `test: enforce coverage thresholds` | P6 |
| P7-02 | Move `SUMMARY.md`, `PLAN.md`, `FINAL_PLAN.md` to `docs/archive/` (excluded from MkDocs nav), review `git diff main...HEAD` for secrets, then **push once** (§9.3). | M files moved | `git status` clean; commits are conventional | `docs: archive planning documents` | P7-01 |

---

## 7. Risks and rollback

| Risk | Mitigation | Rollback |
|---|---|---|
| Squashed baseline loses old migration history | Backup, legacy export script, import into a new DB, verify counts | Restore dump, redeploy previous tag |
| Dropped `AccountRole`, `campus`, `FormSubmission*` data | Export first; confirm disposable | Restore dump |
| Role mapping errors | Mapping table, default `viewer`, dry-run, spot check | Restore, fix mapping, re-import |
| Last-admin guard bug locks everyone out | Seed always ensures an admin; tests; documented break-glass SQL | Promote an account in SQL |
| Cookie and secret changes log everyone out | Deploy in a window | Revert config |
| Vercel `routes` mixing unsupported or header transform fails | Spike P0-03 and P5-07; fallback is a thin Vercel serverless or edge proxy function adding the header | Revert `vercel.json`; call the API directly with CORS temporarily |
| Wrong proxy hop count makes all users share one rate limit | Verify forwarded IP in P5-07 | Set `TRUST_PROXY` explicitly |
| bcrypt native build fails on arm64/alpine | Spike (d); fallback `bcryptjs` | Publish amd64 only temporarily |
| Release tag not triggering publish | Publish is a job in the release workflow (O6) | `workflow_dispatch` manual run |
| Docs API path traversal | Regex, `realpath` containment, allowlist, tests | Remove route, redeploy previous image |
| Shared package not buildable by consumers | Spike P0-03; copy-sync fallback | Switch to `sync-shared.mjs` |

---

## 8. Database-switching guide (content for `docs/database.md` and `docs/in-app/database.md`)

**DSN:** `mysql://<user>:<password>@<host>:3306/<database>`. Provider is `mysql` and MariaDB goes through `@prisma/adapter-mariadb`. URL-encode special characters. Pool size is set through the adapter option confirmed in spike P0-03(f), not guaranteed by `connection_limit` URL parameters.

**Where it changes:**

| Location | Change |
|---|---|
| `server/.env` (local) | `DATABASE_URL`, `MIGRATE_DATABASE_URL` |
| `.env.prod` or `.env` on the host | same two |
| `compose.dev.yaml` and `compose.prod.yaml` | `MYSQL_*`, volume name |
| `compose.ghcr.yaml` | `.env` only; the image is immutable |
| CI | service container values |
| Vercel | nothing; the SPA never talks to the DB |

**Create DB and least-privilege users (MariaDB admin):**

```sql
CREATE DATABASE `app` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'app_runtime'@'%' IDENTIFIED BY '<runtime-password>';
GRANT SELECT, INSERT, UPDATE, DELETE ON `app`.* TO 'app_runtime'@'%';
CREATE USER 'app_migrator'@'%' IDENTIFIED BY '<migrator-password>';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, DROP, REFERENCES ON `app`.* TO 'app_migrator'@'%';
```

Restrict `'%'` to the network that needs it. `prisma migrate dev` additionally needs permission to create a shadow database, so use a separate local dev user for that. Production uses `migrate deploy` only.

**Run:** `migrate` service (or `npx prisma migrate deploy` with `MIGRATE_DATABASE_URL`), then `node dist/cli/seed.js`. Seed is idempotent. If no `BOOTSTRAP_ADMIN_PASSWORD`, a one-time password is printed once.

**After switching:** all users sign in again (sessions live in the DB); changing `SESSION_SECRET` also invalidates sessions. Backup with `mariadb-dump --single-transaction --routines --triggers --hex-blob app`. Never edit an applied migration; add a forward one.

**Troubleshooting:**

| Symptom | Cause | Fix |
|---|---|---|
| `ER_ACCESS_DENIED_ERROR` or `P1000` | Bad user, password, or host grant | Check DSN, re-run GRANT, URL-encode password |
| `Unknown database` | DB missing or wrong name | Create it; check URL path |
| Charset or collation error | DB not `utf8mb4` | Recreate with `utf8mb4_unicode_ci` |
| `P1001` cannot reach DB | Host, port, firewall, network | Check host, port 3306, container network |
| `P3009` failed migration | Interrupted migration | Inspect `_prisma_migrations`, fix forward |
| Too many connections | Pool too large | Lower the pool limit |
| Client not generated | Build skipped `prisma generate` | Rebuild the image |
| Login loops after a DB switch | Stale cookie | Clear cookies |

**Engine limits:** MariaDB and MySQL 8 are supported by provider `mysql`. PostgreSQL and SQLite are out of scope: the enums, `@db.*` types, JSON and the adapter change. Single-tenant: one database per deployment.

---

## 9. Verification and push

### 9.1 Checks after each phase

```bash
npm run bootstrap
npm run lint && npm run typecheck && npm run test
# from P2 onward
npm run build
npm --prefix server exec prisma validate
npm --prefix server exec prisma migrate deploy      # disposable MariaDB 11.4
# from P5 onward
docker build -t template-api:test .
for f in dev prod ghcr; do docker compose -f compose.$f.yaml config > /dev/null; done
# from P6 onward
mkdocs build --strict
# hygiene
git diff --check && git status --short
```

### 9.2 Final checklist

- [ ] Fresh clone: `npm run bootstrap` succeeds; exactly three lockfiles; no root `node_modules`.
- [ ] Lint, typecheck, tests with coverage thresholds, and build pass in every package.
- [ ] `prisma validate`; `migrate deploy` on empty MariaDB 11.4 works; running it twice is a no-op; `migrate status` clean.
- [ ] Seed twice yields one admin; first login forces a password change; self password change works.
- [ ] Route-table test proves every non-public route has a permission; viewer cannot read accounts or docs.
- [ ] Last admin cannot be deleted, demoted or disabled.
- [ ] Cookies: `HttpOnly`, `Secure` (prod), `SameSite=Lax`, `__Host-` prefix; CSRF required; 429 on login flood.
- [ ] No `console.*` in `server/src`; pino redaction test passes; nothing writes logs to the DB.
- [ ] `rg -n -e campus -e FormSubmission -e Universidad -e requiresTwoFactor -e account-roles` finds nothing live; `rg -n "@prisma" shared` finds nothing.
- [ ] Docker image runs as non-root, has no `client/dist`, passes Trivy; `compose.ghcr.yaml` has no `build:`; prod compose `migrate` exits 0 before `api` starts.
- [ ] Publish workflow produces amd64 and arm64; a release-please release publishes in the same run.
- [ ] Vercel preview: SPA deep link works, `/api/healthz` proxied, origin secret enforced, real client IP seen by the API.
- [ ] Observability overlay shows API logs in Grafana (manual).
- [ ] `mkdocs build --strict`; in-app docs: admin and manager 200, viewer 403.
- [ ] `npm run init -- --dry-run` writes nothing; a real run on a scratch copy logs in.
- [ ] Licences agree (MIT); no `.env` or secrets in history; all commits are Conventional.

### 9.3 Push (once, at the very end)

```bash
git push -u origin refactor/template-v1
```

---

## 10. Open questions (defaults let the build proceed)

1. Is there production data that must be preserved in place? Default: no; squash plus export and import.
2. Is MIT approved? Default: yes; P6-07 is blocked on written approval.
3. Does the Vercel plan support `routes` transforms and env expansion? Default: yes [37]; fallback is a proxy function.
4. What are the GitHub owner and repo names (for GHCR)? Default: read from `git remote`, set by `init`.
5. Where do logs go in production (Grafana Cloud, self-hosted Loki, other)? Default: documented generic Alloy config.
6. Is the role set admin, manager, staff, viewer sufficient? Default: yes.
7. Any non-SPA API clients? Default: no; origin secret may be enforced.
8. Is the in-memory rate limiter acceptable (single API instance)? Default: yes.
9. Keep release-please? Default: yes; manual tags remain a fallback.
10. Is Node 24 acceptable for the target hosts? Default: yes.
