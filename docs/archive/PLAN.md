# PLAN.md — Template v1 Refactor

> **Date:** 2026-10-29
> **Planned against:** `d6ea18dbf7eb7f9a8e536cd1f9c07ba85605fad1` on `main` (working tree had only untracked `SUMMARY.md` at audit time)
> **Deliverable:** this plan only. No source files were changed while producing it.
> **Execution branch:** `refactor/template-v1` (created from the commit above; do not work on `main`).

## 0. Assumptions and verification

### 0.1 Assumptions

1. This repository is a template, not a live production system with irreplaceable data. Existing deployments, if any, can be migrated with the legacy script and a backup window (§6).
2. MIT is acceptable for the template license.
3. English is the canonical language for developer documentation; the UI remains bilingual (`en` default, `es` retained).
4. Redis, Socket.IO, the GPS/coordinate demo, 2FA, email verification, password-reset tokens, and the dynamic role-management UI are out of scope and will be removed.
5. The frontend is a static SPA on Vercel; the API is a headless Docker service on a host with MariaDB. Same-site cookies are achieved with a Vercel external rewrite proxy, not a cross-site cookie.
6. One API instance is acceptable initially, so an in-memory login rate limiter is acceptable. If horizontal scaling is needed later, the limiter must move to a shared store.
7. Node 22 LTS, npm 10+, MariaDB 11.4 LTS, Prisma 7, Express 5, React 19, Vite 7, Ant Design 5, Tailwind 4.
8. Conventional Commits are used for every change; releases are automated with release-please.
9. No public API consumers other than the SPA and health probes exist; the API can therefore require a Vercel-injected origin secret.

### 0.2 Verification performed on SUMMARY.md

Read `SUMMARY.md` end to end, then checked every material claim against the code and lockfiles with `rg`, `find`, `nl`, and `node -e` against `package-lock.json`. No dependencies were installed and no server/DB was started, so runtime behavior remains `UNVERIFIED` where noted. Findings verified directly include: schema/migration drift, missing read permission checks, unauthenticated Socket.IO, cookie flags, absence of Log persistence, broken scripts, three lockfiles, stale `server/package-lock.json`, license conflict, and absence of `.github`/tests/ESLint config.

### 0.3 Claims in SUMMARY.md that were wrong or need correction

| # | SUMMARY claim | Verified reality | Evidence |
|---|---|---|---|
| C1 | “Update role: cannot touch a role at actor’s level” (SUMMARY §4.2) | **False.** The controller rejects only `roleToUpdate.level < actorLevel` or `-1`; a role at the actor’s exact level can be updated, and the new `level` may also equal the actor’s level (`level < userAccountRoleLevel` only). This is a real privilege bug, not just an inconsistency. | `server/src/controllers/account-roles/update.ts:40-45`, `:81-88` |
| C2 | “No audit trail” (SUMMARY §9.5, §12.1) | **Overstated.** There is no security/event log, but `MetadataUpdateHistory` is actively written as business audit data through nested `updateHistory.create` calls on account/role mutations. The plan keeps this table and removes only the unused `Log` model. | `server/src/services/accounts/update.ts:105-118`; `server/src/services/accounts/delete.ts:61-77`; `server/src/services/account-roles/update.ts:109-121`; `prisma/schema.prisma:112-123` |
| C3 | “Order of middleware and startup: 1. loadEnv()” (SUMMARY §2.2) | **Misleading.** Static ESM imports evaluate `config/prisma.ts` before `startServer()` runs, so DB connect and `setupServer()` execute before `loadEnv()`. SUMMARY later notes the side effect, but the ordered list implies otherwise. | `server/src/index.ts:13-19`; `server/src/config/prisma.ts:21-30` |
| C4 | “`prisma db push` would drop `campus` and `FormSubmission*`” (SUMMARY §3.2/§6.4) | **Partly UNVERIFIED.** `db push` makes the DB match the schema and is unsafe for those objects, but the exact drop behavior was not executed. Treat as a destructive-operation risk, not a tested fact. | `compose.yaml:41`; `prisma/schema.prisma` (objects absent) |
| C5 | “Client build likely fails on `@shared` alias” (SUMMARY §7.1/§9.5) | **UNVERIFIED and probably too strong.** No `@shared` Vite alias exists, but the current `@shared/*` imports are type-only and may be erased by esbuild. The missing alias is still a correctness risk for future value imports. | `client/vite.config.ts:16-19`; `client/src/utils/permissions.ts:1`; `client/src/features/accounts/components/AccountsTable.tsx:22` |
| C6 | “LoggingService does not persist; nothing writes request logs to the DB” | **Verified true**, and strengthened: the only DB writes that look log-like are the Prisma session store (`sessions` rows) and `MetadataUpdateHistory` business-audit rows. No Prisma middleware/extension, `log.create`, or logging library exists. | `server/src/services/logging.ts:171-200`; `server/src/services/sessions.ts:26-30`; `rg -e '\\$extends' -e '\\$use' -e 'log\\.create' server/src` returned nothing |

### 0.4 Verification commands used

```bash
git log --oneline -5
rg -n "LoggingService|MetadataUpdateHistory|\\$extends|\\$use|log\\.create|pino|winston|morgan" server/src shared client/src
rg -n "ConfigProvider|theme=|algorithm|preflight|darkMode" client/src client/tailwind.config.js
node -e "const l=require('./package-lock.json'); /* print resolved versions */"
npx --no-install prisma --version   # not run: node_modules absent
```

---

# 1. Findings

Severity: **Critical** = data loss/security or blocks deployment; **High** = broken behavior or major design flaw; **Medium** = maintainability/ops; **Low** = polish.

| ID | Category | Finding | Evidence (file:line) | Severity | Fix summary |
|---|---|---|---|---|---|
| A01 | Architecture | Account and role services duplicate metadata creation, update-history writes, soft-delete/restore, retry wrappers, and logging in 8 near-identical files. | `server/src/services/accounts/{create,update,delete,restore}.ts`; `server/src/services/account-roles/{create,update,delete,restore}.ts`; SUMMARY §9.1 | High | Replace with `db/audit.ts` + `db/tx.ts` helpers; delete per-action role services. |
| A02 | Architecture | No global Express error handler; controllers repeat `try/catch`, map status inline, and some paths can fail without responding. | `server/src/controllers/accounts/create.ts:83-104`; no `error-handler.ts` in `server/src` | High | Add `AppError`, `asyncHandler`, `errorHandler`, JSON 404; controllers throw. |
| A03 | Architecture | Non-idempotent creates are retried without a transaction; metadata may be orphaned and duplicates possible. `EmailInUseError` checks legacy `emailValue`. | `server/src/services/accounts/create.ts:49-78`, `:101-111`, `:116-151`; `server/src/services/account-roles/create.ts:55-85` | Critical | Use one `prisma.$transaction` for metadata + entity; remove `async-retry`; check `email` only. |
| A04 | Architecture | Validation writes `req.parsedBody`; controllers read `req.body`, so Zod defaults/transforms never apply. | `server/src/middleware/validationMiddleware.ts:24-32`; `server/src/controllers/accounts/create.ts:19`; `server/src/controllers/accounts/update.ts:24` | High | Replace request body with parsed data or use a single typed `req.validated`; update all controllers. |
| A05 | Architecture | Dynamic Prisma select/populate builders and client-supplied field arrays add attack surface and obscure response contracts. | `server/src/utils/prisma.ts:16-101`; `shared/schemas/accounts.ts:50-74` | Medium | Delete builders; explicit DTO serializers and fixed response shapes. |
| A06 | Architecture | Pagination is unbounded (`count` has no max; accounts allow `count:0`; `get` arrays have no `.max()`). | `shared/schemas/accounts.ts:50-74`; `shared/schemas/account-roles.ts:45-69`; `server/src/controllers/accounts/list.ts:69-83` | Medium | `page>=1`, `pageSize` 1–100; `.max(100)` on ID arrays. |
| D01 | Data | `schema.prisma` and the only migration disagree: `campus` absent from schema, `inactive` vs `locked`, migration-only `FormSubmission*`. | `prisma/schema.prisma:29-68`; `prisma/migrations/20260512025450_add_form_submission/migration.sql:22-23`, `:112-136` | Critical | One canonical final schema + clean baseline migration; remove domain tables. |
| D02 | Data | Compose runs `prisma db push` on every container start. | `compose.yaml:37-42` | Critical | Replace with `prisma migrate deploy` in a controlled entrypoint; never `db push` in deployed environments. |
| D03 | Data | Single migration is named `add_form_submission` but creates the whole schema; no baseline, no ordered history. | `prisma/migrations/20260512025450_add_form_submission/migration.sql:1-169` | Medium | Squash to `0001_init`; document legacy migration path. |
| D04 | Data | Domain residue: campus, Spanish weekdays, attendance tables, university branding, reports placeholders. | `migration.sql:23`, `:126-136`; `client/src/features/accounts/components/UpdateModal.tsx:75-90`; `client/src/layouts/Admin.tsx:206`; `server/src/setup.ts:58` | High | Remove all domain fields/tables/UI; keep one neutral example module. |
| D05 | Data | Dynamic `AccountRole` table stores `level`, comma-separated `permissions`, `requiresTwoFactor`; role CRUD is user-managed. | `prisma/schema.prisma:11-24`; `server/src/routes/account-roles.ts:34-69` | High | Replace with Prisma `Role` enum + shared static permission map. |
| D06 | Data | Business audit data exists (`MetadataUpdateHistory`) but there is no security/event audit trail. | `server/src/services/accounts/update.ts:105-118`; `server/src/services/accounts/delete.ts:61-77`; `prisma/schema.prisma:112-123` | Medium | Keep `MetadataUpdateHistory` as business audit; remove `Log`; add structured request/auth logs. |
| L01 | Logging | `LoggingService.log` only calls `console.log`; `getLogs`/`query` return empty arrays and contain dead Mongo operators. | `server/src/services/logging.ts:171-200`, `:202-265` | High | Delete service; replace with pino; remove dead query code. |
| L02 | Logging | `Log` model, indexes, `logs:read`/`logs:export`, and `/admin/logs` placeholder are unused. | `prisma/schema.prisma:166-181`; `shared/constants/permissions.ts:38-40`; `client/src/routes/admin/logs.tsx:14-67` | Medium | Remove model, permissions, page, shared log schemas/types. |
| L03 | Logging | No structured request logging, no levels, no redaction, no `LOG_LEVEL`; trace IDs are generated but not correlated into logs. | `server/src/index.ts:29-32`; `server/src/middleware/traceId.ts:4-13`; `server/src/services/logging.ts:183` | High | pino + pino-http, JSON prod/pretty dev, redaction, `LOG_LEVEL`, `x-trace-id`. |
| L04 | Logging | Session store writes session rows (`sessions`) but this is persistence, not logging. | `server/src/services/sessions.ts:26-30`; `prisma/schema.prisma:142-149` | Info | Keep; document as session storage, not audit. |
| C01 | Config | Three env loaders resolve different paths; `env.ts` is relative to module while `prisma.ts`/`prisma.config.ts` use cwd. | `server/src/config/env.ts:8-14`; `server/src/config/prisma.ts:9-18`; `prisma.config.ts:8-11` | High | One Zod config module; one explicit env file resolution; remove dotenv from feature modules. |
| C02 | Config | `config/prisma.ts` connects and runs `setupServer()` as an import side effect; HTTP listener does not await it. | `server/src/config/prisma.ts:21-30`; `server/src/index.ts:19-20`, `:54-60` | Critical | Explicit `main()` sequence: config → `$connect` → seed → `listen`; migrations in entrypoint/CI. |
| C03 | Config | Env validation only checks presence; no types, ranges, URL parsing, secret length, or enum validation. | `server/src/config/env.ts:16-31` | High | Zod schema for all env; fail fast with clear messages. |
| C04 | Config | `client/.env.example` is empty; `VITE_SERVER_URL` is required for dev but undocumented. | `client/.env.example` (0 bytes); `client/src/features/auth/api.ts:7-10` | Medium | Add `client/.env.example` with `VITE_API_URL`/brand vars. |
| C05 | Config | Ports/paths are inconsistent: example `3132`, code fallback `3000`, compose `3000:80`, Vite `2173`. | `.env.example:12`; `server/src/index.ts:23`; `compose.yaml:35`; `client/package.json:6` | High | One `PORT` contract; compose maps `${PORT}:${PORT}`; client dev port documented. |
| S01 | Security | Read endpoints require only authentication: `accounts/get`, `accounts/list`, `account-roles/get`, `account-roles/list` have no permission check. | `server/src/routes/accounts.ts:77-79`; `server/src/routes/account-roles.ts:66-69` | Critical | `requirePermission` on every route, including reads; replace with `accounts:read`/`roles:read`/`items:read`. |
| S02 | Security | Socket.IO has no auth; `update_coords` broadcasts arbitrary payloads to all clients. | `server/src/services/socket.ts:28-35`, `:49-54`, `:82` | High | Remove Socket.IO and the demo (chosen); no realtime feature in scope. |
| S03 | Security | Session cookie is `httpOnly:false`, `secure:false`, `sameSite:lax`; no session regeneration on login. | `server/src/services/sessions.ts:16-31`; `server/src/controllers/auth/login.ts:32-42` | Critical | `httpOnly:true`, `secure` in prod, `__Host-` cookie, regenerate on login, destroy on logout. |
| S04 | Security | No CSRF token and no Origin/Referer enforcement for state-changing requests. | `server/src/index.ts:28-41`; no CSRF middleware found | High | Double-submit CSRF token + strict Origin check; Vercel origin secret. |
| S05 | Security | No helmet, no rate limiting, and a 50 MB JSON body limit. | `server/src/index.ts:29`; no helmet/limiter dependency in `package.json` | High | Helmet, login/global rate limits, 1 MB body limit, `trust proxy`. |
| S06 | Security | Bootstrap admin email/password are hardcoded and the credentials are printed to stdout. | `server/src/setup.ts:56-69` | Critical | Env-driven email; env or one-time generated password; never log the password; force change. |
| S07 | Security | Admin cannot change its own password via API; target must be strictly lower privilege. | `server/src/controllers/accounts/update-password.ts:40-46`; `shared/api/accounts.ts:81-87` | High | Add `POST /api/auth/change-password`; allow self with current password; admin reset via policy. |
| S08 | Security | Role update allows editing a role at the actor’s own level and setting `level` equal to actor level (SUMMARY understated this). | `server/src/controllers/account-roles/update.ts:40-45`, `:81-88` | High | Remove dynamic roles entirely; `canManage` policy with strict rank. |
| S09 | Security | No last-admin protection; role delete has no `isSystemRole`/`-1` guard. | `server/src/controllers/account-roles/delete.ts:22-26`; `server/src/services/account-roles/delete.ts:30-60` | Critical | Remove role CRUD; enforce last-admin guard transactionally in account service. |
| S10 | Security | 2FA is declared but ignored; email verification and reset tokens are dead fields. | `server/src/services/sessions.ts:58-77`; `shared/schemas/auth.ts:11-15`; `prisma/schema.prisma:43-57` | Medium | Remove 2FA/verification/reset stubs; document future extension. |
| S11 | Security | Socket CORS uses undocumented `CORS_ORIGIN`; HTTP CORS uses `ALLOWED_ORIGINS`; values diverge. | `server/src/services/socket.ts:17`, `:76`; `.env.example:13` | Medium | Remove Socket.IO; one `CORS_ORIGINS` for HTTP. |
| S12 | Security | No DB least-privilege/GRANT documentation; app uses one URL for runtime and migrations. | `prisma.config.ts:18-20`; `.env.example:2`; no GRANT SQL in repo | High | Document two DB users (`app_runtime`, `app_migrator`); add `MIGRATE_DATABASE_URL`. |
| P01 | Dependency | Three lockfiles; `server/package-lock.json` pins Express 4/bcrypt 5/Mongoose while root uses Express 5/bcrypt 6. | `package-lock.json`; `server/package-lock.json:1-30`; `client/package-lock.json:1-30` | High | Delete child locks; one root `package-lock.json`; `npm ci` only. |
| P02 | Dependency | Many unused dependencies (Redis, Socket.IO, Mongo, Chroma, sharp, leaflet, recharts, nodemailer, etc.). | `package.json:26-75`; server imports grep (only a subset used) | Medium | Remove unused packages after code removal; keep only runtime imports. |
| P03 | Dependency | Broken scripts: `build` calls missing `build:client`; `build:shared` has no `shared/package.json`; `lint` has no ESLint; `sample:gps` references absent `sample/`. | `package.json:12-22`; `shared/` has no package.json; `package-lock.json` has no eslint | High | Add `shared/package.json`; fix scripts; add ESLint; remove `sample:gps`. |
| P04 | Dependency | No `engines`, no `packageManager`, no `.nvmrc`; Docker Node 20 vs local Node 24. | `package.json`; `Dockerfile:1` | Medium | Pin Node 22 LTS/npm 10+; add `.nvmrc`; align Docker. |
| P05 | Dependency | Repository/homepage points to `github.com/Asterki/pumai`, not this repo. | `package.json:108-116` | Low | Fix metadata; init script parameterizes. |
| P06 | Dependency | License conflict: root ISC, server MIT, `LICENSE` proprietary/all rights reserved. | `LICENSE:1-3`; `package.json:25`; `server/package.json:6` | High (legal) | Adopt MIT consistently after human approval. |
| P07 | CI/CD | The legacy CI is the only CI; no tests/lint/typecheck; no registry push/deploy. | legacy CI config; no `.github` | High | Replace with GitHub Actions CI + GHCR publish + release. |
| T01 | Deployment | Dockerfile is single-stage, runs as root, installs dev deps and builds the client into the server image. | `Dockerfile:1-27` | High | Multi-stage build; prod-deps runtime; non-root; headless server image; no client dist. |
| T02 | Deployment | Compose has no healthchecks, uses `mariadb:latest`, starts Redis with no consumer, maps 3000→80, and runs `db push`. | `compose.yaml:2-42` | High | Separate dev/prod/ghcr compose files; pinned MariaDB; healthchecks; correct ports. |
| T03 | Deployment | Server always serves the SPA in production; no headless mode. | `server/src/index.ts:42-49` | High | `SERVE_CLIENT=false` default; static serving only when explicitly enabled. |
| T04 | Deployment | No Vercel config, no API URL contract, no rewrite/proxy, no preview/production separation. | no `vercel.json`; `client/src/features/auth/api.ts:7-10` | High | `vercel.json` SPA + API external rewrite with `API_URL` and origin secret. |
| T05 | Deployment | No GitHub Actions, GHCR publish, multi-arch build, OCI labels, release automation, or Dependabot. | no `.github`; legacy CI config | High | Add workflows and Dependabot; remove the legacy CI. |
| U01 | UI Theme | Ant Design is not themed: `ConfigProvider` receives only `locale`; `isDark=false` is hardcoded. | `client/src/layouts/Admin.tsx:179-184`; `client/src/layouts/General.tsx:22-24` | High | One `ThemeProvider` with algorithm, tokens, component overrides, locale. |
| U02 | UI Theme | Two independent `ConfigProvider`s and hardcoded `esES`; no language-driven locale. | `Admin.tsx:182-184`; `General.tsx:22-24`; `client/src/i18n.ts:10-17` | Medium | Single provider at app root; locale from i18n. |
| U03 | UI Theme | Tailwind config nests `darkMode` under `theme` (invalid top-level placement); Tailwind preflight can override AntD resets. | `client/tailwind.config.js:3-6`; `client/src/index.css:1-2` | High | Move `darkMode` to top level; disable preflight or scope it; document reset order. |
| U04 | UI Theme | Inline styles and hardcoded colors/fonts are spread across layouts. | `Admin.tsx:186-207`, `:212-276`; `General.tsx:25-55`; `client/src/index.css:5-10` | Medium | Remove inline styles; use theme tokens/Tailwind utilities/CSS variables. |
| U05 | UI Theme | Branding is university-specific and hardcoded. | `Admin.tsx:206`; `General.tsx:44`; `client/index.html:5` | Medium | `shared/config/app.ts` + `VITE_*` overrides; init script. |
| U06 | UI Theme | i18n ships Spanish only; AntD locale fixed to Spanish; no language switch. | `client/src/i18n.ts:10-17`; `client/src/locales/es.ts`; `Admin.tsx:27`; `General.tsx:8` | Medium | Locale packs `en`/`es`; `en` default; AntD locale map; switcher. |
| R01 | RBAC | Dynamic roles with `level`, comma-separated permissions, wildcard `*`, and client/server mismatch (`some` vs `every`). | `prisma/schema.prisma:11-24`; `server/src/middleware/authMiddleware.ts:20-37`; `client/src/utils/permissions.ts:3-15` | High | Static role→permission map; one `requirePermission`; identical client/server semantics. |
| R02 | RBAC | User-managed role CRUD routes/UI/services; no need in a fixed-role template. | `server/src/routes/account-roles.ts`; `server/src/controllers/account-roles/*`; `client/src/features/roles/*` | High | Delete role CRUD; read-only roles reference page. |
| R03 | RBAC | No explicit “who can manage whom” policy; comparisons are scattered and inconsistent. | `controllers/accounts/{create,update,delete,update-password,update-status}.ts`; `controllers/account-roles/update.ts:81-88` | High | `canManage(actorRole, targetRole)` + last-admin guard; unit tests. |
| X01 | Template | No neutral example module; only accounts/roles, coupled to the old RBAC. | `server/src/routes/index.ts:8-12`; `client/src/features/*` | High | Add `Item` vertical slice + copy/delete guide. |
| X02 | Template | No init/scaffolding script; names must be edited manually. | no `scripts/init*`; `package.json:2`; `compose.yaml:4,13,26` | Medium | `scripts/init.mjs` with `--dry-run`. |
| X03 | Docs | Docs contradict code: JWT/Postgres/pnpm/2FA/refresh tokens. | `docs/deployment.md:13`; `docs/middleware.md:7`; `docs/prisma.md:11`; `docs/testing.md:9`; `docs/features/auth.md:7-13` | High | Rewrite docs from code; one language policy. |
| X04 | Docs | `docs/es/index.md` is one line; docs claim Spanish translations. | `docs/es/index.md:1`; `README.Md:5-7` | Low | Remove or complete; choose English canonical. |
| X05 | Docs | No `AGENTS.md`. | absent | Medium | Add concise agent guide. |
| X06 | Docs | No in-app Docs area; `react-markdown` installed but unused; no permissioned docs API. | `package.json:55`; no docs route; `client/src/routes/admin/*` | Medium | Serve selected `docs/in-app` markdown via API with `docs:read`; render with `react-markdown`. |
| X07 | Testing | No tests, no test config, no DB strategy. | `find` returned no test/spec/config; `server/package.json:9` | High | Vitest workspace; unit + API integration tests; MariaDB service container. |
| X08 | Docs | No database-switching/least-privilege runbook. | `docs/prisma.md` only generic commands; no GRANT SQL | High | Add `docs/in-app/database.md` and `docs/database.md`. |
| X09 | Ops | No health/readiness endpoints. | `server/src/routes/index.ts:8-12` | High | `/healthz` (liveness) + `/readyz` (DB readiness). |

---

# 2. Decisions

| ID | Decision | Options considered | Chosen | Tradeoff / rationale |
|---|---|---|---|---|
| DEC-01 | Cross-site auth | (a) `SameSite=None; Secure` cross-site cookie; (b) Vercel external rewrite proxy → same-site cookie | **(b) Vercel rewrite proxy** | Avoids third-party-cookie blocking (Safari ITP, Chrome), keeps `SameSite=Lax`, simplifies CSRF. Proxy adds one hop and requires Vercel `routes` with `API_URL` + origin secret. If Socket.IO were kept, Vercel rewrites are not a WebSocket transport; it would need a direct WSS endpoint and `SameSite=None`, which is why it is removed. |
| DEC-02 | Role storage | Prisma enum vs string + Zod | **Prisma enum `Role`** | DB-level integrity and generated types. Adding a role requires a migration; switching DB engines requires enum mapping. Document both. |
| DEC-03 | Role set | admin/manager/staff/viewer vs admin/editor/viewer | **admin, manager, staff, viewer** | Four levels cover most single-tenant apps; `canManage` is simple and testable. |
| DEC-04 | Permission model | Wildcard `*` vs explicit lists | **Explicit `ROLE_PERMISSIONS` map; admin = `ALL_PERMISSIONS`** | Auditable, no wildcard edge cases, client/server identical. |
| DEC-05 | Logger | pino vs winston vs console | **pino + pino-http; pino-pretty in dev** | Fast, JSON-native, redaction, request correlation. Remove `LoggingService` and `Log` model. |
| DEC-06 | Audit data | Delete all history vs keep business audit vs keep event log | **Keep `MetadataUpdateHistory`; remove `Log`** | History is already written and valuable for account/item changes. Security/event logs go to stdout (pino); no DB log table. |
| DEC-07 | Test DB | Testcontainers vs GitHub Actions service container | **MariaDB service container in CI; local `compose.dev.yaml`** | Faster, no Docker socket, deterministic. Tradeoff: tests are not fully hermetic without compose locally. |
| DEC-08 | Redis / Socket.IO | Keep vs remove | **Remove both** | Redis is never initialized; Socket.IO is an unauthenticated demo. Removing cuts attack surface and deployment complexity. Reintroduce only with an authenticated, documented feature. |
| DEC-09 | Docs language | Spanish-only vs bilingual docs vs English canonical | **English canonical developer docs; `en`/`es` UI locales** | One docs source to maintain; UI still bilingual. Delete `docs/es` and root `docs.md`. |
| DEC-10 | Release automation | Manual tags vs release-please | **release-please** | Conventional Commits already required; automated changelog/version PR. Tradeoff: bot PR permissions; manual tag remains the fallback. |
| DEC-11 | API style | Keep `POST /resource/action` vs RESTful resources | **RESTful resources** | Standard semantics, easier client/API contracts. Larger diff; all client API modules rewritten. |
| DEC-12 | Pagination | Offset page/count vs cursor | **Offset `page` (1-based) + `pageSize` (max 100)** | Simple for admin tables; acceptable for template scale. Cursor can be added later. |
| DEC-13 | Dynamic field selection | Keep `fields`/`populate` vs explicit DTOs | **Explicit DTOs** | Removes schema-driven query surface and client/server coupling. Slightly more code per resource. |
| DEC-14 | Schema history | Keep broken migration chain vs squash baseline | **Squash to `0001_init` + legacy migration script** | Clean template; existing deployments require backup/export/import. See §6. |
| DEC-15 | Docs delivery | Bundle in SPA vs API-served | **API-served allowlisted `docs/in-app/*.md` with `docs:read`** | Real server-side restriction; docs not in public JS. Tradeoff: docs require API availability. |
| DEC-16 | Cookie/session defaults | Long-lived vs short-lived | **7-day session, `__Host-app.sid`, HttpOnly, Secure, SameSite=Lax, regenerate on login, destroy on logout** | Standard admin UX. Rotation of `SESSION_SECRET` or DB switch invalidates sessions. |
| DEC-17 | CSRF | None vs double-submit token vs signed token | **Double-submit (`__Host-csrf` + `x-csrf-token`) + Origin check + Vercel origin secret** | Defense in depth without a session-stored token. Token cookie is readable by JS by design. |
| DEC-18 | Rate limiting | None vs in-memory vs Redis | **In-memory `express-rate-limit`** | Acceptable for one instance. Document that horizontal scaling requires a shared store. |
| DEC-19 | 2FA/email verification | Implement vs remove | **Remove** | Out of scope; avoids dead schema/UI. Document as a future module. |
| DEC-20 | Docker base/DB | Node 20 + `mariadb:latest` vs Node 22 LTS + pinned MariaDB | **`node:22-alpine`, `mariadb:11.4`** | Supported LTS, reproducible. Multi-arch build includes arm64. |
| DEC-21 | API proxy privacy | Public API vs origin secret | **Require `x-origin-secret` on `/api/*` except health** | Prevents bypassing Vercel; Vercel attaches the secret via `routes` transform. Tradeoff: other clients need the secret or a separate auth gateway. |
| DEC-22 | Password hashing | bcrypt cost 10 vs 12 vs argon2 | **bcrypt cost 12** | Existing bcrypt dependency; cost 12 is a reasonable 2026 baseline. Rehash on login if cost changes. |
| DEC-23 | License | Proprietary vs MIT | **MIT** | Required for a reusable template; must be approved by the copyright holder. |
| DEC-24 | Bootstrap admin | Hardcoded vs env/one-time generated | **Env email + env password or one-time generated password shown once; `mustChangePassword=true`** | No secret in source; forced rotation. Generated password is printed once and never logged again. |
| DEC-25 | Account deletion | Hard delete vs soft delete | **Soft delete via `Metadata` for accounts and items** | Recoverable, demonstrates audit pattern. Emails are anonymized on delete to free the unique key. |
| DEC-26 | Docs permission | Public vs `docs:read` | **`docs:read` for admin/manager only** | Docs include DB hosts, rollback, and GRANT commands; restrict to operators. |

---

# 3. Target architecture

## 3.1 Final repository tree (target)

```text
.
├── .github/
│   ├── dependabot.yml
│   └── workflows/
│       ├── ci.yml
│       ├── docker-publish.yml
│       └── release-please.yml
├── client/
│   ├── src/
│   │   ├── app/                 # providers, router bootstrap
│   │   ├── components/          # shared UI (Can, LanguageSwitcher, PageHeader)
│   │   ├── config/              # VITE_* brand/API config
│   │   ├── features/
│   │   │   ├── auth/            # login, change-password, session state
│   │   │   ├── accounts/        # users CRUD
│   │   │   ├── items/           # example module
│   │   │   ├── roles/           # read-only role reference
│   │   │   └── docs/            # in-app docs viewer
│   │   ├── layouts/             # AppShell, AuthLayout
│   │   ├── locales/{en,es}/     # locale packs
│   │   ├── rbac/                # can(), <Can>, useCan
│   │   ├── routes/              # TanStack file routes
│   │   ├── theme/               # ThemeProvider, tokens, AntD locale map
│   │   └── index.css
│   └── .env.example
├── server/
│   ├── src/
│   │   ├── config/              # env.ts (Zod), index.ts
│   │   ├── db/                  # prisma.ts, audit.ts, tx.ts, seed.ts
│   │   ├── http/                # errors, async-handler, error-handler, validation, pagination
│   │   ├── middleware/          # auth, require-permission, csrf, rate-limit, request-logger
│   │   ├── rbac/                # account policy, last-admin guard
│   │   ├── routes/              # auth, accounts, items, roles, docs, health
│   │   ├── services/            # account-service, item-service, docs-service
│   │   ├── app.ts               # createApp(deps)
│   │   ├── main.ts              # explicit startup/shutdown
│   │   └── logger.ts
│   └── test/                    # integration helpers + API tests
├── shared/
│   ├── config/app.ts            # app name, slug, logo, locale, brand colour
│   ├── rbac/                    # roles, permissions, policy, types
│   ├── schemas/                 # auth, accounts, items, roles, docs
│   ├── api/                     # request/response contracts
│   └── package.json
├── prisma/
│   ├── schema.prisma
│   ├── migrations/0001_init/migration.sql
│   └── seed.ts
├── docs/                        # MkDocs English docs + docs/in-app/*.md
├── scripts/
│   ├── init.mjs                 # template renamer (dry-run)
│   └── legacy/                  # export/migrate v0 data
├── compose.dev.yaml
├── compose.prod.yaml
├── compose.ghcr.yaml
├── Dockerfile
├── docker-entrypoint.sh
├── vercel.json
├── AGENTS.md
├── README.md
├── LICENSE                      # MIT
└── package.json                 # npm workspace root
```

## 3.2 Deployment topology

```mermaid
flowchart TB
  subgraph Browser
    U[User]
  end
  subgraph Vercel
    SPA[Static React SPA]
    ROUTE["vercel.json routes<br/>/api/* → API_URL<br/>+ x-origin-secret"]
  end
  subgraph Host["Docker host"]
    API[Headless Express API<br/>SERVE_CLIENT=false]
    DB[(MariaDB 11.4)]
  end
  GHCR[(GitHub Container Registry)]
  CI[GitHub Actions]
  U -->|HTTPS| SPA
  SPA -->|same-origin /api| ROUTE
  ROUTE -->|HTTPS + secret| API
  API --> DB
  CI -->|buildx amd64+arm64| GHCR
  GHCR -->|docker compose pull| API
```

Key points:

- Browser never talks to the API origin directly; `/api/*` is same-site on the Vercel domain. Session cookies are `SameSite=Lax`, `Secure`, `HttpOnly`, `__Host-` prefixed.
- Vercel attaches `x-origin-secret` via a `routes` transform. The API rejects `/api/*` requests without it (constant-time compare), except `/healthz` and `/readyz`.
- The Docker image contains only the server + Prisma schema/migrations; no `client/dist`. `SERVE_CLIENT` defaults to `false`.
- GHCR publishes multi-arch images; `compose.ghcr.yaml` has no `build:` key.

## 3.3 Environment reference

Values below are names/purposes only. Never commit real values.

| Name | Purpose | Required | Default | Read by |
|---|---|---|---|---|
| `NODE_ENV` | Runtime mode | Yes in prod | `development` | server config, Prisma |
| `PORT` | API listen port | Yes | `3000` | server |
| `DATABASE_URL` | Runtime MariaDB DSN (`mysql://user:pass@host:3306/db`) | Yes | — | server, Prisma client |
| `MIGRATE_DATABASE_URL` | Migration-only DSN (DDL user); falls back to `DATABASE_URL` | No | `DATABASE_URL` | Prisma CLI/entrypoint |
| `SESSION_SECRET` | Session signing secret, ≥32 chars | Yes | — | server |
| `CORS_ORIGINS` | Comma-separated allowed browser origins (dev/direct) | Prod | — | server |
| `TRUST_PROXY` | Trust `X-Forwarded-*` (Vercel/reverse proxy) | No | `false` (prod `true` when behind proxy) | server |
| `SERVE_CLIENT` | Serve `client-dist` from API | No | `false` | server |
| `LOG_LEVEL` | pino level (`trace…fatal`) | No | `info` | server |
| `BOOTSTRAP_ADMIN_EMAIL` | First admin email | First boot | — | seed |
| `BOOTSTRAP_ADMIN_PASSWORD` | First admin password; if absent generate one-time | No | generated | seed |
| `BOOTSTRAP_ADMIN_NAME` | First admin display name | No | `Administrator` | seed |
| `ORIGIN_SECRET` | Shared secret injected by Vercel and checked by API | Prod | — | server, Vercel |
| `RATE_LIMIT_WINDOW_MS` | Rate-limit window | No | `900000` | server |
| `RATE_LIMIT_MAX` | Global requests/window/IP | No | `300` | server |
| `LOGIN_RATE_LIMIT_MAX` | Login attempts/window/IP | No | `10` | server |
| `DOCS_DIR` | Directory containing allowlisted in-app markdown | No | `docs/in-app` | server |
| `APP_NAME` | Server-side app name (docs/metadata) | No | shared default | server |
| `COOKIE_DOMAIN` | Optional cookie domain; leave empty for host-only | No | empty | server |
| `VITE_API_URL` | Browser API base (`/api` on Vercel, `http://localhost:3000/api` locally) | Client build | `/api` | client |
| `VITE_APP_NAME` | Browser title/brand override | No | shared default | client |
| `VITE_APP_SLUG` | Slug/brand override | No | shared default | client |
| `VITE_BRAND_COLOR` | AntD/Tailwind primary colour | No | shared default | client |
| `VITE_DEFAULT_LOCALE` | `en` or `es` | No | `en` | client |
| `API_URL` | Vercel **server-side** rewrite target, e.g. `https://api.example.com` | Vercel | — | Vercel `routes` |
| `ORIGIN_SECRET` | Must match API; Vercel attaches it | Vercel | — | Vercel `routes` |
| `MYSQL_ROOT_PASSWORD` | Compose MariaDB root | Compose only | — | compose |
| `MYSQL_DATABASE` | Compose DB name | Compose only | — | compose |
| `MYSQL_USER` | Compose app user | Compose only | — | compose |
| `MYSQL_PASSWORD` | Compose app password | Compose only | — | compose |
| `IMAGE_TAG` | GHCR image tag | `compose.ghcr.yaml` | `latest` | compose |
| `IMAGE_NAME` | GHCR image/repository name | `compose.ghcr.yaml` | — | compose |
| `GHCR_OWNER` | GHCR owner/org | `compose.ghcr.yaml` | — | compose |

---

# 4. Phased task list

**Execution rules**

- Work on `refactor/template-v1`; never commit directly to `main`.
- One commit per task, Conventional Commits: `type(scope): imperative summary`, ≤72 chars, body optional. Allowed types: `feat`, `fix`, `refactor`, `chore`, `docs`, `ci`, `build`, `test`; use `!` and a `BREAKING CHANGE:` footer for schema/API breaks.
- One task = one commit = one logical change. Do not mix unrelated cleanup into a feature commit.
- Each phase ends with its “Phase gate” commands. A phase must be green before the next starts, except where a task explicitly notes that it is an intermediate step.
- Never commit `.env`, `.env.*`, tokens, passwords, or generated secrets. Only `*.example` files are committed.
- Do not push until the final task; push exactly once at the end (§8.4).
- `UNVERIFIED` means the plan author could not execute it because dependencies/DB were absent.

## Phase P0 — Safety net

**Goal:** make the repository installable, lintable, typecheckable, and reproducible before changing architecture.

| ID | Title | Files (C/M/D) | Steps | Acceptance criteria | Verify command | Commit message | Depends on |
|---|---|---|---|---|---|---|---|
| P0-01 | Create branch and pin runtime | C: `.nvmrc`; M: `package.json`, `server/package.json`, `client/package.json` | `git switch -c refactor/template-v1`; add `"engines": {"node": ">=22 <25", "npm": ">=10"}` and `"packageManager": "npm@10"`; add `.nvmrc` with `22`; set root `"private": true` | `node -v` is 22.x or 24.x; engines present in all manifests; branch exists | `node -v && npm pkg get engines && git branch --show-current` | `chore: pin node and npm versions` | — |
| P0-02 | Consolidate npm workspaces and lockfiles | C: `shared/package.json`; D: `server/package-lock.json`, `client/package-lock.json`; M: `package.json`, `package-lock.json` | Create private `@template/shared` package with `"type": "module"` and no build step; delete child locks; run `npm install` once at root; verify one lockfile | `git ls-files '*package-lock.json'` returns only root; `npm ls --workspaces --depth=0` succeeds | `git ls-files '*package-lock.json' && npm ls --workspaces --depth=0` | `chore: consolidate npm workspace lockfile` | P0-01 |
| P0-03 | Add lint/format/typecheck tooling | C: `eslint.config.js`, `.prettierrc.json`, `.prettierignore`, `tsconfig.base.json`, `.editorconfig`; M: `package.json`, `server/tsconfig.json`, `client/tsconfig.json`, `shared/tsconfig.json` | Add ESLint flat config with `@eslint/js`, `typescript-eslint`, react-hooks, react-refresh, prettier compatibility; add Prettier; base tsconfig with strict flags; extend in workspaces; add `lint`, `format`, `format:check`, `typecheck` scripts now; add Vite alias `@shared` in P0-04 | `npm run lint` and `npm run format:check` pass; `npm run typecheck` is configured and its known schema errors are recorded for P2 | `npm run lint && npm run format:check` | `chore: add lint format and typecheck tooling` | P0-02 |
| P0-04 | Repair and standardize scripts | M: `package.json`, `server/package.json`, `client/package.json`, `shared/package.json`, `client/vite.config.ts` | Define the remaining scripts: `dev`, `dev:server`, `dev:client`, `build`, `build:server`, `build:web-client`, `test`, `test:coverage`, `db:generate`, `db:migrate`, `db:deploy`, `db:seed`, `prisma:validate`, `docs:serve`, `docker:build`, `docker:up`; remove `sample:gps`; fix `build` to call `build:web-client`; add `@shared` Vite alias | `npm run` lists all scripts; `npm run build:web-client` succeeds; `npm run build:server` and `npm run typecheck` may fail until P2 and are recorded as the only expected failures | `npm run && npm run build:web-client` | `chore: repair and standardize npm scripts` | P0-03 |
| P0-05 | Baseline CI workflow | C: `.github/workflows/ci.yml`; M: `package.json` | Node 22, `npm ci`, `npm run lint`, `npm run format:check`, `npx prisma validate`, `npm run build:web-client`; **no typecheck/server build/test yet** (typecheck is added in P2-06); concurrency cancel-in-progress; least-privilege `contents: read` | Workflow parses; CI green on P0 branch | `python -c "import yaml;yaml.safe_load(open('.github/workflows/ci.yml'))"` | `ci: add baseline ci workflow` | P0-04 |
| P0-06 | Document env files and ignore rules | C: `.env.example` (replace), `client/.env.example`; M: `.gitignore`, `README.md` | List every var from §3.3 with placeholders; explain root `.env`; ensure `.env`, `.env.*`, `!.env.example`, `!*.env.example`; add client `VITE_*`; no real values | `git check-ignore -v .env` matches; examples contain no secrets; `npm run lint` unaffected | `git check-ignore -v .env && grep -R "VITE_API_URL" .env.example client/.env.example` | `chore: document environment files` | P0-02 |
| P0-07 | Add Vitest harness skeleton | C: `vitest.workspace.ts`, `server/vitest.config.ts`, `client/vitest.config.ts`, `server/test/setup.ts`, `server/test/env.ts`; M: `package.json`, `server/tsconfig.json`, `client/tsconfig.json` | Root workspace with a `server` node project and a `client` jsdom project; setup file; `test`/`test:coverage` scripts; coverage v8; no feature tests yet | `npm test -- --passWithNoTests` exits 0; both projects are discovered | `npm test -- --passWithNoTests` | `test: add vitest workspace skeleton` | P0-04 |

**P0 phase gate:** `npm ci && npm run lint && npm run format:check && npx prisma validate && npm test -- --passWithNoTests`. `typecheck` and `build:server` are expected to be red because of the known schema/code drift; record the errors and proceed. They must pass at the end of P2.

**Buildability note:** P0-04 leaves `build:server` and `typecheck` red until P2; P0-05 runs lint/format/client build only; P0-07 provides the harness so later phases can add tests incrementally, while P7 expands coverage and wires tests into CI.

## Phase P1 — Config, startup, logging, errors

**Goal:** remove import-time side effects and make the server observable and fail-fast.

| ID | Title | Files (C/M/D) | Steps | Acceptance criteria | Verify command | Commit message | Depends on |
|---|---|---|---|---|---|---|---|
| P1-01 | Add one typed Zod config module | C: `server/src/config/env.ts`, `server/src/config/index.ts`; M: `prisma.config.ts`, `.env.example`; D: `server/src/config/redis.ts` | Define Zod schema for every server var in §3.3; parse booleans/ints/urls; require `SESSION_SECRET` ≥32; export `loadConfig()` and frozen `AppConfig`; load `.env` only in `loadConfig` via `ENV_FILE` or repo-root `.env`; `prisma.config.ts` loads only `MIGRATE_DATABASE_URL ?? DATABASE_URL` | Invalid env exits with field-level errors; valid env returns typed object; no `dotenv` import in feature modules; `npx prisma validate` works | `npx prisma validate && npm run lint` | `refactor: add typed zod configuration` | P0 |
| P1-02 | Explicit startup sequence and Prisma factory | C: `server/src/main.ts`, `server/src/app.ts`, `server/src/db/prisma.ts`, `server/src/db/seed.ts`; D: `server/src/config/prisma.ts`, `server/src/setup.ts`; M: `server/src/index.ts`, `server/tsconfig.json`, `server/package.json` | `main()`: `loadConfig()` → `createLogger()` → `createPrismaClient()` → `await $connect()` → `await seed()` → `createApp()` → `listen`; graceful SIGTERM/SIGINT closes HTTP then `$disconnect`; migrations are a documented entrypoint/CI step (`prisma migrate deploy`), not an import side effect; `index.ts` only invokes `main()` | Server does not connect on import; startup logs ordered; SIGTERM exits 0; DB failure exits non-zero with clear message | `npm run lint`; startup smoke is deferred to the P2 gate because the old schema is still present | `refactor: make startup sequence explicit` | P1-01 |
| P1-03 | Structured pino logging | C: `server/src/logger.ts`, `server/src/middleware/request-logger.ts`, `server/src/logger.test.ts`; D: `server/src/services/logging.ts`, `server/src/middleware/traceId.ts`; M: all services/controllers, `server/src/services/sessions.ts`, `server/src/app.ts`, `package.json` | Add `pino`, `pino-http`, and dev-only `pino-pretty`; JSON in production, pretty in dev; `LOG_LEVEL`; `genReqId` = `crypto.randomUUID()`; set/return `x-trace-id`; log method/path/status/duration; redact `req.headers.cookie`, `authorization`, `set-cookie`, `password`, `newPassword`, `currentPassword`, `token`, `*.password`, `*.token`; replace every `console.*` in `server/src` | No `console.log`/`console.error` in `server/src`; JSON logs contain `traceId`; secrets absent from serialized logs; redaction test passes | `rg -n "console\\.(log/error/warn/info)" server/src` returns nothing; `npm run test -- logger` | `refactor: add structured pino logging` | P1-02 |
| P1-04 | Central error handling | C: `server/src/http/errors.ts`, `server/src/http/async-handler.ts`, `server/src/http/error-handler.ts`, `server/src/http/not-found.ts`, `server/src/http/error-handler.test.ts`; M: all controllers, `server/src/app.ts` | `AppError(code,httpStatus,details?)`, `NotFoundError`, `ConflictError`, `ForbiddenError`, `UnauthorizedError`, `ValidationError`; `asyncHandler` wraps async handlers; global handler maps known errors, logs 5xx with traceId, returns `{error:{code,message,details?,traceId}}`; JSON 404 for `/api/*` | Controllers contain no `try/catch`; thrown `AppError` maps correctly; unknown errors return 500 without stack leakage; 404 JSON | `rg -n "try \\{" server/src/controllers server/src/services` returns none; `npm run test -- error` | `refactor: centralize error handling` | P1-03 |
| P1-05 | Apply validated request data | C: `server/src/http/validation.ts`, `server/src/http/validation.test.ts`; D: `server/src/middleware/validationMiddleware.ts`; M: `server/src/types/index.ts`, `shared/schemas/*`, all controllers/routes | `validateBody(schema)` parses and assigns `req.body = parsed.data`; `validateQuery`/`validateParams` store typed data; remove `parsedBody`; export `ValidatedRequest<TBody,TQuery,TParams>`; ensure defaults/coercions apply; add a regression test with a transform | Controller sees transformed values; invalid body returns 400 with issues; no `parsedBody` references remain | `rg -n "parsedBody" server/src shared` returns nothing; `npm run test -- validation` | `fix: apply validated request data` | P1-04 |
| P1-06 | Health and readiness endpoints | C: `server/src/routes/health.ts`, `server/src/routes/health.test.ts`; M: `server/src/routes/index.ts`, `server/src/app.ts` | `GET /healthz` returns `{status:"ok"}` without DB; `GET /readyz` runs `SELECT 1` and returns 503 on failure; no auth, no origin secret; add compose healthcheck targets later | `/healthz` 200; `/readyz` 200 with DB and 503 without; tests cover both | `npm run lint`; health tests run at the P2 gate once the app compiles | `feat: add health and readiness endpoints` | P1-02 |

**P1 phase gate:** `npm ci && npm run lint && npm run format:check && npx prisma validate && npm test -- logger error validation` (health/app tests run at P2). `typecheck`/`build:server` remain red until P2 and are recorded.

## Phase P2 — Schema, migrations, domain removal

**Goal:** one schema, one baseline, no `db push`, no domain residue.

| ID | Title | Files (C/M/D) | Steps | Acceptance criteria | Verify command | Commit message | Depends on |
|---|---|---|---|---|---|---|---|
| P2-01 | Write canonical template schema | M: `prisma/schema.prisma` | Final models: `Account`, `Item`, `Metadata`, `MetadataUpdateHistory`, `Session`; enums `Role {admin,manager,staff,viewer}`, `AccountStatus {active,inactive}`, `ItemStatus {active,archived}`; `Account.role Role @default(viewer)`; `mustChangePassword Boolean @default(false)`; remove `AccountRole`, `Config`, `Log`, `FormSubmission*`, `campus`, TFA/verification/reset fields; add indexes on `Account.role`, `Account.status`, `Item.status`, `Metadata.deleted`, `MetadataUpdateHistory.updatedAt`, `Session.expiresAt` | `npx prisma validate`; schema has exactly the five models; no `AccountRole`/`Log`/`campus` references | `npx prisma validate && npx prisma format --check` | `refactor!: replace schema with template v1` | P1 |
| P2-02 | Clean baseline migration | D: `prisma/migrations/20260512025450_add_form_submission/`; C: `prisma/migrations/0001_init/migration.sql`; M: `prisma/migrations/migration_lock.toml`, `package.json` | Generate baseline with `npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script`; inspect types/indexes/FKs; use `utf8mb4`/`utf8mb4_unicode_ci`; add `db:deploy` script | `npx prisma migrate deploy` on an empty MariaDB creates all tables; second run is no-op; `prisma migrate status` clean | `npx prisma migrate deploy && npx prisma migrate status` | `refactor!: add clean baseline migration` | P2-01 |
| P2-03 | Idempotent seed/bootstrap | C: `prisma/seed.ts`; M: `package.json`, `server/src/db/seed.ts`, `server/src/config/env.ts` | Seed reads `BOOTSTRAP_ADMIN_EMAIL`/`PASSWORD`/`NAME`; if no accounts, create admin with `mustChangePassword=true`; if password absent, generate 24+ char random password and print **once** to stdout; never store/print it again; idempotent when accounts exist; `prisma.seed` config | Fresh DB creates one admin; second run is no-op; no hardcoded credentials; generated password appears once | `npx prisma db seed && npx prisma db seed`; query admin count | `feat: add idempotent env-driven seed` | P2-02 |
| P2-04 | Remove domain and dynamic-role residue | D: `shared/models/{account,account-role,log,metadata,index}.d.ts`, `shared/schemas/{logs,files,account-roles}.ts`, `shared/api/account-roles.ts`, `client/src/routes/admin/{logs,config}.tsx`, `server/src/routes/account-roles.ts`, `server/src/controllers/account-roles/*`, `server/src/services/account-roles/*`, `client/src/routes/admin/accounts/roles.tsx`, `client/src/features/roles/**`; M: account schemas/controllers/client components, `README.md` | Remove `campus`, Spanish weekdays, FormSubmission, reports placeholders, config/logs pages, file TODO, `requiresTwoFactor` UI, university strings; delete role CRUD so the P2 schema compiles; roles return read-only in P3-06 | `rg -n -e 'campus' -e 'FormSubmission' -e 'Lunes' -e 'Universidad' -e 'requiresTwoFactor' server shared client` returns nothing; role CRUD files gone; reports menu placeholder removed | `rg -n -e 'campus' -e 'FormSubmission' -e 'Lunes' -e 'Universidad' -e 'requiresTwoFactor' server shared client; test ! -d server/src/controllers/account-roles` | `refactor: remove domain residue` | P2-03 |
| P2-05 | Legacy data migration | C: `scripts/legacy/export-legacy-data.ts`, `docs/upgrading.md`; M: `package.json` | Script connects to old schema, reads `AccountRole` + `Account`, maps `level=-1`/Admin→`admin`, known names→manager/staff/viewer, unknown→`viewer`; exports accounts (id/email/password/name/role/status/metadata) to NDJSON; document backup, new DB, import, cutover, `prisma migrate resolve` for in-place; never auto-run on startup | Script runs with `--dry-run`; mapping table documented; sample output has no plaintext passwords; upgrading doc covers backup/rollback | `npx tsx scripts/legacy/export-legacy-data.ts --dry-run` | `feat: add legacy data migration script` | P2-04 |
| P2-06 | Remove Redis, Socket.IO, demo, and enable server build in CI | D: `server/src/services/socket.ts`, `server/src/config/redis.ts` (if not already), `client/src/components/Header.tsx`; M: `server/src/app.ts`, `package.json`, `.env.example`, `.github/workflows/ci.yml` | Remove Socket.IO attach and event handlers; remove Redis client and `REDIS_URL`; remove unused demo deps (`socket.io`, `socket.io-client`, `redis`, `connect-mongo`, `chromadb`); delete GPS references in scripts/docs; add `npm run typecheck && npm run build` to CI now that the schema compiles | `rg -n -e 'socket\\.io' -e 'REDIS_URL' -e 'setupRedis' -e 'update_coords' server client package.json` returns nothing; build passes; CI includes typecheck + server build | `npm run typecheck && npm run build && rg -n -e 'socket\\.io' -e 'REDIS_URL' -e 'update_coords' server client` | `refactor: remove redis and socket.io` | P2-04 |

**P2 phase gate:** `npm ci && npx prisma validate && npm run build && npx prisma migrate deploy` against a throwaway MariaDB; `npm run lint && npm run typecheck`. This is the first phase where `build:server` must be green.

**Buildability note:** P2-01 through P2-04 are intermediate commits; the branch may not build between them. Do not run CI on each intermediate commit; gate at P2 end.

## Phase P3 — Hardcoded RBAC and security hardening

**Goal:** fixed roles, explicit permissions on every route, secure sessions, safe bootstrap.

| ID | Title | Files (C/M/D) | Steps | Acceptance criteria | Verify command | Commit message | Depends on |
|---|---|---|---|---|---|---|---|
| P3-01 | Shared role/permission source of truth | C: `shared/rbac/{roles,permissions,policy,index}.ts`, `shared/rbac/permissions.test.ts`; D: `shared/constants/permissions.ts`, `shared/types/permissions.d.ts`; M: `shared/types/sessions.d.ts`, `shared/api/*` | `Role` const map; `Permission` union; `ROLE_PERMISSIONS`; `ROLE_RANK`; `roleHasPermission(role, permission)`; `canManage(actor, target)` (strict rank, no self); `docs:read`, `roles:read`, account/item permissions; admin = explicit `ALL_PERMISSIONS`; no wildcard | Unit tests for every role/permission pair pass; client/server import the same map; no `"*"` permission in code | `npm run test -- shared/rbac` | `feat: define shared roles and permissions` | P2 |
| P3-02 | Permission middleware on every route | C: `server/src/middleware/require-permission.ts`, `server/src/routes/routes.test.ts`; M: `server/src/middleware/authMiddleware.ts`, all `server/src/routes/*`, `server/src/types/index.ts` | One `requirePermission(permission)`; `requireAuthenticated`; apply to **every** route: auth login/csrf public, auth me/logout/change-password authenticated, accounts reads `accounts:read`, writes specific permissions, items `items:*`, roles `roles:read`, docs `docs:read`; health public | Route audit table in code comments/tests; every non-public route has a permission; 403 for missing permission; 401 only for unauthenticated | `npm run test -- routes`; `rg -n 'router\\.' server/src/routes` and verify each has middleware | `feat: enforce permissions on all routes` | P3-01 |
| P3-03 | Account management policy and last-admin guard | C: `server/src/rbac/account-policy.ts`, `server/src/rbac/account-policy.test.ts`, `server/src/services/account-service.ts`; M: `server/src/controllers/accounts.ts` | `assertCanManage(actor, targetRole)`; self rules; role assignment limited to lower/equal rank; last-admin guard inside `prisma.$transaction` (count admins, reject delete/demote/disable if last); soft-delete self forbidden; restore requires `canManage`; no role-level comparisons left | Tests: manager cannot manage manager/admin; admin cannot delete/demote last admin; self password uses separate endpoint; deleting self is rejected | `npm run test -- account-policy` | `feat: add account management policy` | P3-02 |
| P3-04 | Secure bootstrap, forced change, self password | C: `server/test/auth.test.ts`; M: `prisma/seed.ts`, `server/src/config/env.ts`, `server/src/routes/auth.ts`, `server/src/controllers/auth.ts`, `shared/schemas/auth.ts`, `shared/api/auth.ts`, `client/src/features/auth/*`, `client/src/routes/auth/login.tsx` | Seed from env or one-time generated password; set `mustChangePassword`; login returns `mustChangePassword`; middleware blocks all routes except `/api/auth/me`, `/api/auth/change-password`, `/api/auth/logout` until changed; `POST /api/auth/change-password` verifies current password, hashes cost 12, clears flag; admin reset uses policy | Fresh admin must change password; self change works; wrong current password rejected; old password no longer works; no hardcoded password in repo | `npm run test -- auth`; `rg -n -e 'BOOTSTRAP_ADMIN_PASSWORD' -e 'password\\s*=\\s*[\"'\\'']' server` | `feat: secure bootstrap and self-service password` | P3-03 |
| P3-05 | HTTP security hardening | C: `server/src/middleware/{security,csrf,rate-limit}.ts`, `server/src/middleware/security.test.ts`; M: `server/src/app.ts`, `server/src/services/sessions.ts`, `server/src/config/env.ts`, `package.json` | Add `helmet` and `express-rate-limit`; body limit 1 MB; `trust proxy` when configured; cookie `httpOnly:true`, `secure` in prod, `sameSite:lax`, `__Host-app.sid` in prod and `app.sid` in dev; session regenerate on login, destroy+clear on logout; CSRF double-submit (`__Host-csrf` prod / `csrf` dev + `x-csrf-token`) on unsafe methods; strict Origin check; login limiter 10/15 min, global 300/15 min; `x-origin-secret` check for `/api/*` except health | Cookie flags verified in tests; missing CSRF token → 403; wrong origin → 403; wrong origin secret → 403; rate limit → 429; `/healthz` bypasses | `npm run test -- security`; `curl -i -X POST /api/auth/login` without CSRF | `feat: harden http security` | P3-04 |
| P3-06 | Add read-only roles reference | C: `server/src/controllers/roles.ts`, `server/src/routes/roles.ts`, `shared/api/roles.ts`, `client/src/features/roles/{api.ts,index.ts}`, `client/src/routes/admin/roles.tsx`; M: `server/src/routes/index.ts`, navigation | `GET /api/roles` (`roles:read`) returns static `ROLE_PERMISSIONS`; no create/update/delete/restore; client shows a read-only table of role → permissions; depends on role CRUD deletion in P2-04 | `rg -n 'account-roles' server client` returns nothing; role page renders static data; no write UI | `npm run typecheck`; `rg -n 'account-roles' server client`; manual role page render | `feat: add read-only roles reference` | P3-02 |
| P3-07 | Client `can()` and `<Can>` helper | C: `client/src/rbac/{can.ts,Can.tsx,useCan.ts,index.ts}`, `client/src/rbac/Can.test.tsx`; M: `client/src/layouts/Admin.tsx`, all feature action buttons/routes | `can(role, permission)` uses shared map; `<Can permission="...">` hides children; route guard redirects to `/admin` with 403 message; nav items use the same helper; no direct `permissions.includes` anywhere | Manager sees only permitted nav/actions; viewer cannot reach accounts; semantics identical to server tests | `npm run test -- client/rbac`; `rg -n -e 'permissions\\.includes' -e 'hasPermissions' client/src` returns none | `feat: add client permission helpers` | P3-06 |
| P3-08 | Remove 2FA and dead auth stubs | M: `server/src/services/sessions.ts`, `shared/schemas/auth.ts`, `shared/api/auth.ts`, `client/src/routes/auth/login.tsx`, `client/src/locales/*`; D: TFA modal code | Remove `tfaCode`, `tfaSecret`, TFA response statuses, `requiresTwoFactor`; remove email verification/reset fields from schema (P2 already); update login UI and translations | `rg -n -e 'tfa' -e 'twoFactor' -e 'emailVerification' -e 'forgotPassword' server shared client` returns no live code; login tests pass | `rg -n -e 'tfa' -e 'twoFactor' -e 'emailVerification' -e 'forgotPassword' server shared client` | `refactor: remove unused auth stubs` | P3-04 |
| P3-09 | Account mutation audit | C: `server/src/db/audit.ts`, `server/src/db/audit.test.ts`; M: `server/src/services/account-service.ts` | Every create/update/delete/restore/password/status writes `MetadataUpdateHistory` with actor id and changed fields (password redacted); all inside the same transaction as the account write | Audit row exists for each mutation; rejected mutations write nothing; password value absent | `npm run test -- audit` | `feat: audit account mutations` | P3-03 |

**P3 phase gate:** `npm run lint && npm run typecheck && npm run test && npm run build && npx prisma migrate deploy`. Manual auth matrix: admin/manager/staff/viewer; last-admin deletion; forced password change; CSRF.

**Buildability note:** P3-01/02/06/07 are intermediate; the branch is expected to be red between P3-01 and P3-07. Gate at P3 end.

## Phase P4 — De-duplication and example module

**Goal:** one persistence/audit implementation and one complete vertical slice.

| ID | Title | Files (C/M/D) | Steps | Acceptance criteria | Verify command | Commit message | Depends on |
|---|---|---|---|---|---|---|---|
| P4-01 | Shared audit/transaction helpers | C: `server/src/db/audit.ts`, `server/src/db/tx.ts`, `server/src/services/account-service.test.ts`; M: `server/src/services/account-service.ts`, `server/src/controllers/accounts.ts`; D: `server/src/services/accounts/*` | `withMetadataCreate`, `appendHistory`, `softDelete`, `restore`, `runInTransaction`; all account operations use one transaction; remove `async-retry`; no duplicated metadata code | No `services/accounts/*` or `services/account-roles/*` remain; account tests pass; no `async-retry` import | `rg -n -e 'async-retry' -e 'services/accounts' server/src` returns nothing; `npm run test -- accounts` | `refactor: deduplicate persistence and audit logic` | P3 |
| P4-02 | Explicit DTOs and pagination | C: `server/src/http/pagination.ts`, `server/src/http/pagination.test.ts`, `server/src/http/dto/accounts.ts`, `shared/schemas/pagination.ts`; D: `server/src/utils/prisma.ts`; M: `shared/schemas/accounts.ts`, `shared/api/accounts.ts`, account controllers/client | Fixed DTOs (no password/hash/tokens); `page` 1-based, `pageSize` max 100; list returns `{data,meta:{page,pageSize,total}}`; get returns `{data}`; remove `fields`/`populate` | Response has no secret fields; `pageSize=1000` → 400; `page=0` → 400; client compiles | `npm run test -- pagination`; `rg -n -e 'getFieldsToSelect' -e 'populate' -e 'fields:' server/src/controllers/accounts.ts` | `refactor: replace dynamic selects with DTOs` | P4-01 |
| P4-03 | Items backend vertical slice | C: `shared/schemas/items.ts`, `shared/api/items.ts`, `server/src/services/item-service.ts`, `server/src/services/item-service.test.ts`, `server/src/controllers/items.ts`, `server/src/routes/items.ts`; M: `server/src/routes/index.ts`, `prisma/schema.prisma` (Item already), `shared/rbac/*` | `GET /api/items`, `GET /api/items/:id`, `POST /api/items`, `PATCH /api/items/:id`, `DELETE /api/items/:id` (soft), `POST /api/items/:id/restore`; permissions `items:read/create/update/delete/restore`; audit each mutation; explicit DTO | CRUD + restore works; viewer can read but not write; audit rows created; API tests pass | `npm run test -- items` | `feat: add items example module (server)` | P4-02 |
| P4-04 | Items client vertical slice | C: `client/src/features/items/{api.ts,index.ts,hooks/*,components/*}`, `client/src/routes/admin/items.tsx`; M: `client/src/layouts/Admin.tsx`, locale packs | AntD table, create/edit modal, delete/restore confirm; `Can` gates each action; pagination/search; no inline styles | Items page works for admin/manager/staff; viewer read-only; empty/error/loading states | `npm run build:web-client`; manual smoke with each role | `feat: add items example module (client)` | P4-03, P3-07 |
| P4-05 | Document module copy/delete | C: `docs/example-module.md`; M: `AGENTS.md` (later) | Exact file list to copy/delete for a new module; permission additions; migration; tests; client route/nav; pitfall list | A developer can add/remove `Item` by following the doc; links valid | `markdown-link-check docs/example-module.md` (if installed) or manual link check | `docs: document the example module` | P4-04 |

**P4 phase gate:** `npm run lint && npm run typecheck && npm run test && npm run build`; manual items CRUD/restore; verify audit rows.

## Phase P5 — AntD theme, branding, i18n

**Goal:** one theme/brand source, no ad-hoc styles, bilingual UI.

| ID | Title | Files (C/M/D) | Steps | Acceptance criteria | Verify command | Commit message | Depends on |
|---|---|---|---|---|---|---|---|
| P5-01 | Brand/app config and theme module | C: `shared/config/app.ts`, `client/src/config/brand.ts`, `client/src/theme/{ThemeProvider.tsx,tokens.ts,antd-locale.ts,index.ts}`, `client/src/theme/ThemeProvider.test.tsx`; M: `client/src/app/*`, `package.json` | `shared/config/app.ts`: `APP_NAME`, `APP_SLUG`, `APP_LOGO`, `DEFAULT_LOCALE`, `BRAND_COLOR`; client overrides via `VITE_*`; `ThemeProvider`: AntD `ConfigProvider` with `defaultAlgorithm`/`darkAlgorithm`, token `colorPrimary`, `borderRadius`, `fontFamily`, component overrides for Layout/Menu/Button/Table/Modal; mode persisted in `localStorage`; sets CSS vars `--brand-primary`, `--color-bg`, `--color-text` | One provider; light/dark toggles; tokens applied; no `ConfigProvider` in layouts | `npm run test -- theme`; manual toggle | `feat: add brand tokens and antd theme provider` | P4 |
| P5-02 | Apply theme provider and remove duplicate providers | M: `client/src/main.tsx`, `client/src/App.tsx`, `client/src/routes/__root.tsx`, `client/src/layouts/Admin.tsx`, `General.tsx`; D: inline `ConfigProvider` blocks | Wrap router in `ThemeProvider`; layouts consume theme; AntD `App` inside provider; locale from i18n | Single `ConfigProvider` in codebase; layouts render without provider props | `rg -n "<ConfigProvider" client/src` returns one; `npm run build:web-client` | `refactor: apply centralized theme` | P5-01 |
| P5-03 | Align Tailwind and AntD resets | M: `client/src/index.css`, `client/tailwind.config.js` (or migrate to CSS `@theme`), `client/vite.config.ts`; C: `client/src/styles/antd.css` if needed | Move `darkMode` to top level; omit Tailwind preflight (`@import "tailwindcss/theme.css"` + `utilities.css` or explicit base) and use AntD reset/`App`; map Tailwind `primary` to `var(--brand-primary)`; document layer order; verify buttons/inputs/tables | AntD buttons/tables retain styles; Tailwind utilities work; dark class works; no duplicate resets | `npm run build:web-client`; visual smoke of login/table/modal | `fix: align tailwind and antd styling` | P5-02 |
| P5-04 | Locale packs and language switcher | C: `client/src/locales/en/{common,auth,accounts,items,roles,docs,validation}.ts`, `client/src/locales/es/*`, `client/src/components/LanguageSwitcher.tsx`, `client/src/i18n.test.ts`; D: `client/src/locales/es.ts`; M: `client/src/i18n.ts`, all components | `en` default, `es` complete; `i18next` namespaces; `antd-locale.ts` maps `en`→`enUS`, `es`→`esES`; switcher persists language; all hardcoded UI strings moved | No hardcoded user-facing strings in components; switching updates AntD + i18n; missing-key check clean | `npm run test -- i18n`; `rg -n '"[A-Z][a-z]+ ' client/src/features client/src/routes` manual review | `feat: add en/es locale packs` | P5-02 |
| P5-05 | Remove hardcoded branding and inline styles | M: `client/index.html`, `client/src/layouts/Admin.tsx`, `General.tsx`, `client/src/routes/**`, `client/src/features/**`; D: unused `Header.tsx` | Replace university/template strings with `APP_NAME`/i18n; use CSS classes/theme tokens; remove `style={{...}}` where a token/utility exists; logo from brand config | `rg -n -e 'Universidad' -e 'Plantilla' -e 'Sistema Random' -e 'style=\\{\\{' client/src` returns only justified cases; build passes | `npm run build:web-client`; `rg -n -e 'Universidad' -e 'Plantilla' -e 'Sistema Random' client/src` | `refactor: remove hardcoded branding and inline styles` | P5-04 |

**P5 phase gate:** `npm run lint && npm run typecheck && npm run build:web-client`; visual smoke in light/dark and en/es.

## Phase P6 — Docker, Compose, GHCR, Vercel, headless mode

**Goal:** deploy the SPA on Vercel and a headless image from GHCR.

| ID | Title | Files (C/M/D) | Steps | Acceptance criteria | Verify command | Commit message | Depends on |
|---|---|---|---|---|---|---|---|
| P6-01 | Multi-stage non-root image | C: `Dockerfile` (replace), `docker-entrypoint.sh`, `.dockerignore`; M: `package.json`, `server/package.json` | Stages: `base` (node:22-alpine + build deps), `deps` (`npm ci`), `build` (`prisma generate`, `npm run build:server`), `prod-deps` (`npm ci --omit=dev`), `runtime` (copy dist/shared/prisma/node_modules; `USER node`; `HEALTHCHECK`; entrypoint `prisma migrate deploy` then `node dist/server/src/main.js`); no client build; copy `node_modules/prisma` + `.bin/prisma` from the build stage (or move `prisma` to runtime deps) so migrations work without network | `docker build -t template-api .`; container runs as uid 1000; healthcheck passes; image has no `client/dist`; migrations run once | `docker build -t template-api . && docker run --rm template-api id && docker run --rm template-api npx prisma --version` | `build: add multi-stage production image` | P5 |
| P6-02 | Development compose | C: `compose.dev.yaml`; M: `.env.example` | `mariadb:11.4` with healthcheck, `env_file: .env.dev`, volume, `3306:3306`; `adminer` under `profiles: [tools]`, port 8080; no app service (host hot reload); no Redis; documented commands | `docker compose -f compose.dev.yaml config` valid; `up -d mariadb` becomes healthy; adminer only with `--profile tools` | `docker compose -f compose.dev.yaml config && docker compose -f compose.dev.yaml up -d mariadb` | `build: add development compose` | P6-01 |
| P6-03 | Production compose | C: `compose.prod.yaml`; M: `.env.example` | `app` builds from source; `mariadb:11.4`; `depends_on: {mariadb: {condition: service_healthy}}`; `env_file: .env.prod`; ports `127.0.0.1:${PORT}:${PORT}`; restart `unless-stopped`; named volumes; healthcheck; non-root; no Redis | `docker compose -f compose.prod.yaml config`; `up --build` healthy; app reachable on `${PORT}` | `docker compose -f compose.prod.yaml config && docker compose -f compose.prod.yaml up -d --build` | `build: add production compose` | P6-02 |
| P6-04 | GHCR pull-only compose | C: `compose.ghcr.yaml`, `.env.ghcr.example`; M: `README.md` | `image: ghcr.io/${GHCR_OWNER}/${IMAGE_NAME}:${IMAGE_TAG:-latest}`; **no `build:`**; MariaDB service pinned + healthcheck; `env_file: .env`; volume; healthcheck; restart; document `docker login ghcr.io` and `docker compose -f compose.ghcr.yaml pull/up -d` | `docker compose -f compose.ghcr.yaml config` has no build key; `pull` works with a published image; app starts with only `.env` | `docker compose -f compose.ghcr.yaml config > /tmp/cfg && ! grep -q "build:" /tmp/cfg` | `build: add ghcr deployment compose` | P6-01 |
| P6-05 | Headless server mode | C: `server/test/headless.test.ts`; M: `server/src/config/env.ts`, `server/src/app.ts`, `server/src/index.ts` | `SERVE_CLIENT=false` default; only mount static/SPA fallback when true; `/api/*` 404 JSON; document all-in-one optional mode; Docker never copies client | Headless mode has no static middleware; `/` returns API 404 or JSON; `SERVE_CLIENT=true` still works with a supplied `client-dist` | `npm run test -- headless`; start with `SERVE_CLIENT=false` and curl `/` | `feat: add headless server mode` | P6-04 |
| P6-06 | Vercel SPA + API proxy | C: `vercel.json`, `client/src/config/env.ts`; M: `client/src/utils/api.ts`, `client/src/features/*/api.ts`, `client/.env.example`, `docs/deployment.md`, `client/vite.config.ts` | `vercel.json`: root install `npm ci`, build `npm run build:web-client`, output `client/dist`; `routes` for `/api/(.*)` → `${API_URL}/api/$1` with `env:["API_URL"]` and `x-origin-secret` transform via `$ORIGIN_SECRET`; SPA rewrite `/(.*)` → `/index.html`; `VITE_API_URL=/api`; preview/prod env scopes documented; no `VITE_API_URL` direct cross-origin in prod | `vercel build` (if CLI) or `npx vercel dev` smoke; `/api/healthz` proxied; SPA deep link works; API sees origin secret; preview uses preview `API_URL` | `npx vercel build` (UNVERIFIED if CLI unavailable) + `curl -I https://<preview>/api/healthz` | `feat: add vercel spa and api proxy configuration` | P6-05 |
| P6-07 | GHCR multi-arch publish workflow | C: `.github/workflows/docker-publish.yml`; M: `package.json` | Triggers: push to `main`, tags `v*`; `permissions: contents: read, packages: write`; `setup-qemu`, `setup-buildx`, `login-action` with `GITHUB_TOKEN`; `metadata-action` tags (`latest` only default branch, semver, sha, ref); `build-push-action` platforms `linux/amd64,linux/arm64`, cache `type=gha`, OCI labels; no secrets beyond token | Workflow YAML valid; test buildx build succeeds locally; GHCR package appears after a test tag; both architectures present | `docker buildx build --platform linux/amd64,linux/arm64 -t ghcr.io/<owner>/<repo>:test --push .` (manual, with login) | `ci: publish multi-arch images to ghcr` | P6-01 |
| P6-08 | Release automation | C: `.github/workflows/release-please.yml`, `release-please-config.json`, `.release-please-manifest.json`; M: `README.md`, `docs/deployment.md` | release-please on `main`; Conventional Commits; changelog sections; tag `vX.Y.Z`; Docker workflow consumes tags; document manual fallback | Dry run on branch; release PR opens with expected changelog; tag triggers image publish | `npx release-please release-pr --dry-run` (UNVERIFIED if network/permissions unavailable) | `ci: add release automation` | P6-07 |
| P6-09 | Dependabot and remove the legacy CI | C: `.github/dependabot.yml`; D: legacy CI config; M: `.github/workflows/ci.yml` | Dependabot: npm weekly grouped, docker weekly, github-actions weekly; remove the legacy CI; document GitHub Actions as sole CI | No legacy CI file; Dependabot config valid; CI still runs | `test ! -f legacy-ci.yml && python -c "import yaml;yaml.safe_load(open('.github/dependabot.yml'))"` | `chore: add dependabot and repo hygiene` | P6-07 |

**P6 phase gate:** `docker build`, `docker compose -f compose.dev.yaml config`, `docker compose -f compose.prod.yaml config`, `docker compose -f compose.ghcr.yaml config`, `vercel build` (if available), `npm run build`. Manual: run `compose.ghcr.yaml` with a locally tagged image.

## Phase P7 — Tests

**Goal:** regression coverage for the security and data rules that the refactor changes.

| ID | Title | Files (C/M/D) | Steps | Acceptance criteria | Verify command | Commit message | Depends on |
|---|---|---|---|---|---|---|---|
| P7-01 | Extend Vitest harness and coverage | M: `vitest.workspace.ts`, `server/vitest.config.ts`, `client/vitest.config.ts`, `server/test/setup.ts`, `server/test/env.ts`, `package.json` | Add coverage v8 thresholds for `shared/rbac`, `server/src/rbac`, `server/src/http`; ensure both projects discover tests; add `test:coverage`; document test env | `npm run test:coverage` runs both projects and writes coverage; threshold failure is non-zero | `npm run test:coverage` | `test: configure coverage and test helpers` | P6 |
| P7-02 | Expand RBAC and policy tests | M: `shared/rbac/permissions.test.ts`; C: `shared/rbac/policy.test.ts`, `server/src/rbac/account-policy.test.ts` | Table-driven tests: every role/permission pair; admin all; viewer read-only; `canManage` matrix; last-admin guard; self rules; unknown role rejected | 100% branch coverage for `shared/rbac` and `account-policy`; tests fail if map changes unexpectedly | `npm run test -- rbac` | `test: cover roles and account policy` | P7-01 |
| P7-03 | API integration tests | C: `server/test/helpers/db.ts`, `server/test/items.test.ts`, `server/test/accounts.test.ts`; M: `server/test/auth.test.ts`, `server/test/setup.ts` | Use `supertest` with `createApp` and a test Prisma client; migrate test DB; truncate between tests; cover login/CSRF/forced password, permission matrix, items CRUD/restore, last-admin guard, pagination limits | Tests pass against MariaDB 11.4; no shared state; no real secrets; cleanup on failure | `DATABASE_URL=... npm run test -- server/test` | `test: add api integration coverage` | P7-02, P4 |
| P7-04 | Expand client permission/theme tests | C: `client/src/features/items/ItemsTable.test.tsx`; M: `client/src/rbac/Can.test.tsx`, `client/src/theme/ThemeProvider.test.tsx`, `client/vitest.config.ts` | React Testing Library: `<Can>` hides/shows; route guard; theme provider applies token/algorithm; items table renders empty/error/loading | Tests pass in jsdom; no network; no snapshots of entire DOM | `npm run test -- client` | `test: cover client permissions and theme` | P7-01 |
| P7-05 | CI database integration | M: `.github/workflows/ci.yml` | Add `mariadb:11.4` service with healthcheck; env `DATABASE_URL`/`MIGRATE_DATABASE_URL`; run `npx prisma migrate deploy`, `npm test`; upload coverage; remove `--passWithNoTests` | CI integration job green; service healthy before migrations; coverage artifact uploaded | `act -j test` (optional) or GitHub Actions run | `ci: run integration tests against mariadb` | P7-03 |

**P7 phase gate:** `npm run lint && npm run typecheck && npm run test:coverage && npm run build`; coverage thresholds (proposed: 80% lines for `shared/rbac`, `server/src/rbac`, `server/src/http`; no global threshold initially).

## Phase P8 — Docs, in-app docs, AGENTS, init, license, final verification

**Goal:** make it usable as a template and safe to hand to another team.

| ID | Title | Files (C/M/D) | Steps | Acceptance criteria | Verify command | Commit message | Depends on |
|---|---|---|---|---|---|---|---|
| P8-01 | Rewrite developer docs | C: `docs/{index,architecture,configuration,deployment,rbac,logging,database,api,testing,contributing,template-usage}.md`, `docs/in-app/{index,database,rbac,deployment}.md`, `docs/requirements.txt`; M: `README.md`, `mkdocs.yml`; D: `docs.md`, `docs/es/index.md`, obsolete `docs/*.md` | English canonical; quickstart; architecture; env reference; Vercel + headless + GHCR; RBAC; logging; database switching (exact SQL and troubleshooting from §5); template usage; contributing; remove JWT/Postgres/pnpm/2FA claims; MkDocs nav | Every command in docs is copy-paste correct; no dead links; no false stack claims; `mkdocs build --strict` passes | `python -m pip install -r docs/requirements.txt && mkdocs build --strict` | `docs: rewrite template documentation` | P7 |
| P8-02 | Add AGENTS.md | C: `AGENTS.md` | Sections: overview; exact commands; repo map; conventions (REST, DTOs, permissions, logging, migrations); commit format; how to add module/permission/role; testing expectations; never do (`db push`, commit `.env`, edit applied migrations, add wildcard permissions, raw SQL) | File is accurate against final repo; commands pass; ≤250 lines; no secrets | `rg -n -e 'npm run' -e 'prisma' -e 'permission' AGENTS.md` manual review | `docs: add AGENTS.md` | P8-01 |
| P8-03 | Permissioned in-app docs API | C: `server/src/controllers/docs.ts`, `server/src/routes/docs.ts`, `server/test/docs.test.ts`, `shared/api/docs.ts`; M: `server/src/routes/index.ts`, `server/src/config/env.ts`, `Dockerfile`, `.dockerignore` | `GET /api/docs` returns allowlisted manifest from `DOCS_DIR`; `GET /api/docs/:slug` reads only `docs/in-app/<slug>.md` (slug regex, realpath check, no traversal); require `docs:read`; cache in memory in prod; include docs in image | `/api/docs` 403 for viewer; 200 for admin/manager; traversal attempts 400/404; markdown content served; tests | `npm run test -- docs`; `curl -H "Cookie: ..." /api/docs/database` | `feat: serve permissioned in-app docs` | P8-01, P3-02 |
| P8-04 | In-app docs UI | C: `client/src/features/docs/{api.ts,hooks/useDocs.ts,components/DocsViewer.tsx}`, `client/src/routes/admin/docs.tsx`, `client/src/features/docs/DocsViewer.test.tsx`; M: `client/src/layouts/Admin.tsx`, locale packs, `package.json` (`remark-gfm`) | Nav item gated by `docs:read`; fetch manifest + selected doc; render with `react-markdown` + `remark-gfm`; loading/error/empty states; table of contents; no raw HTML | Viewer cannot see nav/page; deep link redirects; markdown tables/code render; no XSS (no `rehype-raw`) | `npm run test -- docs-viewer`; manual admin/viewer check | `feat: add in-app documentation page` | P8-03, P3-07 |
| P8-05 | Template init script | C: `scripts/init.mjs`; M: `package.json` (add `init`), `shared/config/app.ts`, `compose*.yaml`, `Dockerfile`, `README.md`, `AGENTS.md` | `npm run init -- --name "Acme" --slug acme --dry-run`; rename package names, container names, image name, titles, repo URLs, brand config; write only after confirmation; idempotent; never touch `.env`/secrets; print diff | `--dry-run` shows planned changes and writes nothing; real run on a copy produces a bootable build; no secrets read | `node scripts/init.mjs --name "Acme" --slug acme --dry-run` | `feat: add template init script` | P8-01 |
| P8-06 | Adopt MIT and fix metadata | M: `LICENSE`, `package.json`, `server/package.json`, `client/package.json`, `shared/package.json`, `README.md`; C: `NOTICE` (optional) | Replace proprietary license with MIT (copyright holder name/year); set `"license":"MIT"` everywhere; fix repository/homepage/bugs to the template repo; add `author`; remove `pumai` | `npm pkg get license` returns MIT in all workspaces; LICENSE text matches; no conflicting claims | `npm pkg get license --workspaces && head -3 LICENSE` | `chore: adopt MIT license and fix metadata` | P8-01 |
| P8-07 | Template repository instructions | C: `docs/template-usage.md`; M: `README.md` | Explain GitHub “Use this template”, `npm run init`, first boot, deleting the example module, creating a new repo; document required Vercel/host/GHCR settings | A new user can create a project from the template without reading source; commands correct | Manual walkthrough on a scratch copy | `docs: document template repository usage` | P8-05 |
| P8-08 | Final verification and single push | M: any fixes found; no source feature changes | Run full local matrix; inspect `git diff main...HEAD`; ensure no `.env`/secrets; ensure each commit is Conventional; then one push | All checks green; `git status` clean; no secrets; branch contains only intended commits | See §8.3 checklist | `chore: final verification` (only if fixes are needed) | P8-07 |

**P8 phase gate:** full verification checklist (§8.3); `mkdocs build --strict`; `npm run init -- --dry-run`; docs permission matrix.

---

# 5. Database switching guide (content requirements for P8-01/P8-03)

The in-app docs must include a page `docs/in-app/database.md` and a developer copy `docs/database.md` with the following exact content.

## 5.1 `DATABASE_URL` format

```text
mysql://<runtime_user>:<runtime_password>@<host>:<port>/<database>?connection_limit=10&pool_timeout=20
```

- Prisma provider is `mysql`; MariaDB is supported through `@prisma/adapter-mariadb`.
- `MIGRATE_DATABASE_URL` may use the DDL user; if omitted, migrations use `DATABASE_URL`.
- URL-encode special characters in passwords.
- Keep `connection_limit` modest (5–20) per API instance.

## 5.2 Every place the database changes

| Location | What to change |
|---|---|
| Local `.env` / `.env.dev` | `DATABASE_URL`, `MIGRATE_DATABASE_URL` |
| `.env.prod` on the host | Same two variables |
| `compose.dev.yaml` | `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD`, volume name if a separate DB is desired |
| `compose.prod.yaml` | Same, plus the `DATABASE_URL` in `.env.prod` |
| `compose.ghcr.yaml` | `.env` only; the image is immutable |
| Prisma CLI | `MIGRATE_DATABASE_URL` / `DATABASE_URL` via `prisma.config.ts` |
| Vercel | No DB env; the SPA never talks to MariaDB |
| CI | `DATABASE_URL`/`MIGRATE_DATABASE_URL` service-container values |

## 5.3 Create the database and least-privilege users

Run as a MariaDB admin:

```sql
CREATE DATABASE `app`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER 'app_runtime'@'%' IDENTIFIED BY '<runtime-password>';
GRANT SELECT, INSERT, UPDATE, DELETE ON `app`.* TO 'app_runtime'@'%';

CREATE USER 'app_migrator'@'%' IDENTIFIED BY '<migrator-password>';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, DROP, REFERENCES
  ON `app`.* TO 'app_migrator'@'%';
```

- `app_runtime` is used by the API; it cannot change schema.
- `app_migrator` is used only by `prisma migrate deploy` / CI.
- No `FLUSH PRIVILEGES` is required after `GRANT` in MariaDB.
- If the DB host is remote, restrict hosts (`'app_runtime'@'10.%'`) instead of `%`.
- The app runs migrations in `docker-entrypoint.sh` with `MIGRATE_DATABASE_URL`; the runtime process uses `DATABASE_URL`.

## 5.4 Migrate, seed, and first boot

```bash
npm run db:generate
MIGRATE_DATABASE_URL="mysql://app_migrator:...@host:3306/app" npx prisma migrate deploy
DATABASE_URL="mysql://app_runtime:...@host:3306/app" npm run db:seed
```

- `prisma migrate deploy` only applies committed migrations; never `db push`.
- Seed is idempotent and only creates the first admin when no accounts exist.
- If `BOOTSTRAP_ADMIN_PASSWORD` is omitted, the seed prints a one-time password once; store it immediately.
- First login forces a password change.

## 5.5 Sessions, backups, rollback

- Switching DB means all users re-authenticate; old sessions live in the old `sessions` table.
- Changing `SESSION_SECRET` also invalidates all sessions.
- Backup: `mariadb-dump --single-transaction --routines --triggers --hex-blob app > backup.sql`.
- Restore: `mariadb app < backup.sql` into a fresh database, then repoint `DATABASE_URL`.
- Rollback a deployment: restore the DB backup, redeploy the previous image tag, rotate `SESSION_SECRET` only if sessions must be invalidated.
- Never edit an applied migration; add a new forward migration.

## 5.6 Troubleshooting table

| Symptom | Likely cause | Fix |
|---|---|---|
| `ER_ACCESS_DENIED_ERROR` | Wrong user/password or host grant | Check `DATABASE_URL`, user host (`'%'` vs `'10.%'`), re-run GRANT |
| `ER_BAD_DB_ERROR` / `Unknown database` | DB name typo or not created | `CREATE DATABASE ...`; verify URL path |
| `ER_UNKNOWN_CHARACTER_SET` / collation error | DB/tables not `utf8mb4` | Recreate with `utf8mb4`/`utf8mb4_unicode_ci`; migrate data |
| `P1000` authentication failed | Bad credentials | Rotate password; URL-encode it |
| `P1001` can't reach DB | Host/port/firewall | Check host, port 3306, security group, container network |
| `P3009` failed migration | Interrupted migration | Inspect `_prisma_migrations`, fix forward; do not delete history blindly |
| `Too many connections` | Pool too large / leak | Lower `connection_limit`; check `$disconnect` |
| `Prisma Client ... not generated` | Build skipped generate | `npm run db:generate`; rebuild image |
| Login loops / 401 after DB switch | Old session cookie | Clear cookies; ensure `SESSION_SECRET` matches deployment |

## 5.7 Engine/provider limits

- `provider = "mysql"` is correct for MariaDB; keep `@prisma/adapter-mariadb`.
- PostgreSQL is out of scope: enums, `@db.VarChar/@db.Text`, `Json`, `DATETIME(3)`, and adapter code change. A provider switch requires a schema audit and data migration.
- SQLite is out of scope: enum/JSON/`@db.*` differences and no MariaDB adapter.
- MySQL 8 works with the same provider but has different JSON/collation defaults; test migrations before switching.
- Document that this template is single-tenant: one database per deployment.

---

# 6. Risks and rollback

| Risk | Impact | Mitigation | Rollback |
|---|---|---|---|
| Baseline migration squashes history | Existing deployments lose migration continuity | Back up; run `scripts/legacy/export-legacy-data.ts`; migrate into a new DB; verify counts; cut over during a window | Restore dump; redeploy previous tag; repoint `DATABASE_URL` |
| Dropping `AccountRole`/`campus`/`FormSubmission*` | Data loss if still needed | Export before migration; confirm domain residue is disposable; keep backup for 30 days | Restore dump |
| Role mapping mistakes | Users get wrong privileges | Explicit mapping table; default `viewer`; admin mapping by `level=-1`; dry-run report; spot-check counts | Restore; fix mapping; re-import |
| Last admin guard bug | Nobody can administer the instance | Seed always creates an admin; tests cover delete/demote/disable of last admin; break-glass SQL documented | Promote an account via SQL; restart |
| Session/cookie changes log everyone out | UX disruption | Deploy during a window; document; rotate secret intentionally | Revert cookie config (sessions may still be invalid) |
| Vercel proxy/origin secret misconfig | 401/403/502 for all API calls | Test `x-origin-secret` in preview; document envs; `/healthz` bypass; rollback `vercel.json` | Revert Vercel deployment; direct API temporarily with CORS |
| Multi-arch build fails (bcrypt native) | No arm64 image | Build tools in builder stage; test buildx locally; pin Node 22; use `npm ci` | Publish amd64-only temporarily; fix build |
| GHCR permissions | Push denied | `packages: write`; repository package settings; `GITHUB_TOKEN` | Manual `docker push` with PAT |
| Docs API path traversal | Arbitrary file read | Slug regex, realpath containment, allowlist manifest, tests | Remove docs route; redeploy previous image |
| Theme/Tailwind reset regression | Broken AntD controls | Disable preflight, visual smoke, component tests | Revert CSS commit |
| Removing dynamic API fields | Client breakage | Rewrite all client API modules in P4; versioned contract in `shared/api`; tests | Revert API commit |
| `npm ci` with workspaces | Install failures | One root lockfile; `shared/package.json`; CI on Node 22 | Revert lockfile commit |
| MIT license change | Legal/ownership issue | Human approval before P8-06 | Restore previous LICENSE |

---

# 7. Open questions for the human (max 10)

Each has a default so the build can proceed without blocking.

1. **Is there existing production data that must be preserved in place?** Default: no; squash baseline + legacy export/import script.
2. **Is MIT approved for this template?** Default: yes; P8-06 is blocked only on written approval.
3. **Should 2FA/email verification/password reset be removed?** Default: yes; document as a future module.
4. **Is English canonical for developer docs, with `en`/`es` UI?** Default: yes.
5. **Is the Vercel rewrite proxy acceptable, or must the API be called cross-origin?** Default: proxy + origin secret; no WebSocket.
6. **Are Redis and Socket.IO definitely removable?** Default: yes; no realtime feature in scope.
7. **Is MariaDB 11.4 LTS the target?** Default: yes; pin `mariadb:11.4` and test upgrades.
8. **Is the role set `admin/manager/staff/viewer` sufficient?** Default: yes; adding a role requires a schema migration + shared map entry.
9. **Are there non-SPA API clients?** Default: no; origin secret is required for all `/api/*`.
10. **Is release-please acceptable?** Default: yes; manual `v*` tags remain a fallback.

---

# 8. Build-prompt hints

## 8.1 Ordering and batch size

Execute phases **P0 → P8** in order. Within a phase, run **3–5 tasks per batch**, then stop and run the phase gate. Do not start a phase until the previous gate is green, except where a task explicitly states an intermediate build break.

Recommended stop-and-verify points:

1. **P0 gate** — install/lint/typecheck/prisma validate.
2. **P2 gate** — `prisma migrate deploy` on an empty DB + server build (first green build).
3. **P3 gate** — auth/RBAC/security matrix + forced password change.
4. **P4 gate** — items CRUD + audit rows.
5. **P6 gate** — Docker/Compose/Vercel/GHCR configs.
6. **P7 gate** — full unit + integration suite.
7. **P8 gate** — docs/MkDocs, init dry-run, full checklist.

## 8.2 Exact checks after each phase

```bash
# Always
npm ci
npm run lint
npm run typecheck
npx prisma validate

# From P2 onward
npm run build
npx prisma migrate deploy          # against a disposable MariaDB
npx prisma migrate status

# From P7 onward
npm test
npm run test:coverage

# From P6 onward
docker build -t template-api:test .
docker compose -f compose.dev.yaml config
docker compose -f compose.prod.yaml config
docker compose -f compose.ghcr.yaml config
# docker compose -f compose.prod.yaml up -d --build && curl -fsS localhost:${PORT}/readyz

# Docs
mkdocs build --strict

# Hygiene
git diff --check
git status --short
rg -n "BEGIN (RSA|OPENSSH)|password\\s*=\\s*['\"]" --glob '!*.example' .
```

## 8.3 Final verification checklist (before the single push)

- [ ] `npm ci` from a clean clone succeeds with one lockfile.
- [ ] `npm run lint`, `npm run typecheck`, `npm run test:coverage`, `npm run build` pass.
- [ ] `npx prisma validate` passes; `prisma migrate deploy` on an empty MariaDB 11.4 succeeds; `prisma migrate status` clean.
- [ ] Seed twice: one admin only; first login forces password change; self password change works.
- [ ] Permission matrix: admin/manager/staff/viewer; every route has an explicit permission; viewer cannot read accounts/docs.
- [ ] Last admin cannot be deleted, demoted, or disabled; tested.
- [ ] Cookie flags: `HttpOnly`, `Secure` (prod), `SameSite=Lax`, `__Host-`; CSRF required; rate limits return 429.
- [ ] No `console.*` in `server/src`; pino redaction test passes.
- [ ] No `campus|FormSubmission|Universidad|requiresTwoFactor|reports:|account-roles` live references.
- [ ] `docker build` succeeds; image runs as non-root; `docker compose -f compose.ghcr.yaml config` has no `build:`.
- [ ] GHCR workflow builds amd64+arm64; release-please dry-run works; Dependabot config valid.
- [ ] Vercel SPA deep link works; `/api/healthz` proxied; `x-origin-secret` enforced; preview/prod `API_URL` documented.
- [ ] In-app docs: admin/manager 200, viewer 403; traversal tests pass.
- [ ] `mkdocs build --strict`; no dead links; docs match commands.
- [ ] `node scripts/init.mjs --dry-run` writes nothing; real run on a scratch copy builds.
- [ ] `LICENSE`, all `package.json` licenses, and README agree (MIT).
- [ ] `git log --oneline main..refactor/template-v1` is Conventional Commits; no `.env`/secrets in history.
- [ ] `git diff --check`; `git status` clean.

## 8.4 Push (only once, at the very end)

```bash
git push -u origin refactor/template-v1
```

Do not push earlier. Do not open a PR until the checklist is green; if a PR is required, open it after the push and include the checklist result.

## 8.5 Tasks that cannot leave the repo buildable in isolation

These are intermediate steps; the phase gate is the buildable unit:

- **P2-01 → P2-04:** schema/type/domain removal breaks server/client builds until the baseline, seed, and references are updated.
- **P3-01 → P3-07:** removing dynamic roles and rewriting all routes/client guards breaks auth/UI until the client helper and route hardening are complete.
- **P3-08:** removing TFA/verification types breaks login UI until translations and schemas are updated (same commit should include both).
- **P4-02:** replacing dynamic DTOs breaks client API modules until P4-04 if done in a separate commit; keep the DTO change and client update in one PR/batch.
- **P5-01 → P5-04:** theme/locale provider migration is a coordinated change; keep commits small but do not run full UI CI until the provider and locales are both in place.
- **P6-01 → P6-05:** Docker/headless changes depend on the new config and build; gate at P6 end.
- **P8-03 → P8-04:** docs API and UI can land separately, but the nav/page must not reference a missing route; land API first.

Everything else should leave `npm run typecheck`, `npm run lint`, and `npm test` green at each commit where practical.
