# BUILD PROMPT — Phase P2: Cutover: schema, hardcoded RBAC, hardening, client sync

You are an autonomous senior engineer executing one phase of an approved refactor of a Node/Express/Prisma/MariaDB + React/Vite/Ant Design template. Work from the repository root.

## Read first
1. `FINAL_PLAN.md` at the repo root: §0 (what changed), §1 (execution rules), §4 (decisions), §5 (architecture and env reference) and the P2 table in §6. This prompt expands that table. If they conflict, FINAL_PLAN.md wins; record the conflict in your final report.
2. `AGENTS.md` if it exists (it appears in Phase 6).
3. Before editing any file, read the files you are about to change. Do not rely on memory of earlier phases.

## Non-negotiable rules
- Branch: `refactor/template-v1`. Never commit to `main`.
- One task = one commit. Conventional Commits, header at most 72 characters, imperative mood. Use the exact commit message given for each task.
- Tests, docs and `.env.example` updates for a change go in the same commit as the change.
- Do NOT push. Do not open a PR. Commits stay local until Phase 7.
- Never commit `.env`, `.env.*` (except `*.example`), tokens, passwords or generated secrets. Never print secrets in logs or in your report.
- Never use `prisma db push`. Never edit a migration after it has been committed.
- Do not do work that belongs to another phase. If something outside this phase blocks you, stop and report.
- Items marked `UNVERIFIED` in FINAL_PLAN.md must be proven by running something. If you cannot run it (no Docker, no network), say so explicitly and mark the result `UNVERIFIED` in the report. Do not claim success.
- If a verify command fails, fix the cause and amend the task's commit (`git commit --amend`) before moving on. Never skip a task, never disable a test or lint rule to make a check pass.
- If a planning assumption turns out false, write a short ADR in `docs/decisions/NNNN-title.md` (at most 10 lines: context, finding, decision) in the same commit as the fix.
- Prefer the smallest change that satisfies the acceptance criteria. Do not refactor unrelated code.

## Preflight (run first; stop and report if any fails)
- Branch `refactor/template-v1`; `git log --oneline main..HEAD` shows the P0 and P1 commits.
- `npm run bootstrap && npm run lint && npm run typecheck && npm run test` is green in all three packages.
- A disposable MariaDB 11.4 is available (for example `docker run --rm -d -p 3307:3306 -e MARIADB_ROOT_PASSWORD=root -e MARIADB_DATABASE=app mariadb:11.4`). If Docker is unavailable, stop and report: this phase cannot be verified without a database.
- You will use the database URL `mysql://root:root@127.0.0.1:3307/app` for local verification only; never commit it.

## Final report (your last message)
Reply with exactly these sections:
1. Commits made: `hash subject` per task.
2. Gate results: each gate command and pass or fail.
3. Deviations from the plan, ADRs written, and anything left `UNVERIFIED`.
4. Open problems that block the next phase (or "none").

## Goal
Replace the dynamic role system with hardcoded roles and permissions, replace the schema and migration history, rebuild the account API as REST with default-deny permissions, harden sessions and HTTP, and bring the client in sync. This is the only phase where intermediate commits may fail `typecheck` and `build`. **The phase gate at the end is the unit of correctness.** P2-01 is additive and must stay green. Work server first (P2-01 to P2-07), then the client (P2-08).

## Task P2-01 — Shared roles and permissions (additive, green)
Commit: `feat: define shared roles and permissions`
Create in `shared/src/rbac/`:
- `roles.ts`: `export const ROLES = ["admin","manager","staff","viewer"] as const; type Role`. `ROLE_RANK = {admin: 0, manager: 1, staff: 2, viewer: 3}` (lower = stronger).
- `permissions.ts`: `PERMISSIONS` const list and `Permission` union: `accounts:read`, `accounts:create`, `accounts:update`, `accounts:update-status`, `accounts:change-password`, `accounts:delete`, `accounts:restore`, `items:read`, `items:create`, `items:update`, `items:delete`, `items:restore`, `roles:read`, `docs:read`. No wildcard anywhere.
- `matrix.ts`: `ROLE_PERMISSIONS: Record<Role, readonly Permission[]>`. admin = all (explicit `PERMISSIONS`). manager = accounts read/create/update/update-status/change-password/delete/restore (limited by `canManage`), all items, `roles:read`, `docs:read`. staff = `accounts:read`, all items except delete/restore, `roles:read`. viewer = `accounts:read` is NOT granted; viewer gets `items:read` only. Adjust only if FINAL_PLAN.md says otherwise.
- `policy.ts`: `roleHasPermission(role, permission)`; `canManage(actor: Role, target: Role): boolean` returns true only when `ROLE_RANK[actor] < ROLE_RANK[target]`; `canAssignRole(actor, newRole)` same strict rule; self-management is checked by account id in the server policy, not here.
- Also in `shared/src/schemas/pagination.ts`: `page` int >= 1 (default 1), `pageSize` int 1..100 (default 20), `ids` array max 100. In `shared/src/config/app.ts`: `APP_NAME`, `APP_SLUG`, `APP_LOGO`, `DEFAULT_LOCALE`, `BRAND_COLOR` with neutral defaults.
- Remove every `@prisma` import from `shared` by replacing Prisma-derived types with explicit DTO types (`AccountDto`, `SessionAccountDto` with `role` and `permissions`, `ItemDto` later). Delete `shared/src/constants/permissions.ts` and `shared/src/types/permissions.d.ts` once nothing imports them (update server and client imports, even if those packages will be rewritten later; if that causes red, defer the deletion to P2-08 and note it).
- Table-driven tests: every role x permission pair against the matrix; `canManage` full 4x4 matrix; admin has every permission.
Verify: `npm --prefix shared run lint && npm --prefix shared run test && npm --prefix shared run build`; `rg -n "@prisma" shared/src` returns nothing.

## Task P2-02 — Canonical schema and baseline migration
Commit: `refactor!: replace schema with template v1`
Rewrite `server/prisma/schema.prisma`. Keep the existing generator and datasource style (provider `mysql`, adapter in code). Models and enums:
```prisma
enum Role          { admin manager staff viewer }
enum AccountStatus { active inactive }
enum ItemStatus    { active archived }

model Metadata {
  id String @id @default(cuid())
  createdBy String?  updatedBy String?  deletedBy String?
  createdAt DateTime @default(now()) updatedAt DateTime @updatedAt
  deleted Boolean @default(false) deletedAt DateTime?
  account Account? item Item? history MetadataUpdateHistory[]
  @@index([deleted])
}
model Account {
  id String @id @default(cuid())
  email String @unique  name String  password String
  role Role @default(viewer)  status AccountStatus @default(active)
  mustChangePassword Boolean @default(false)  lastLogin DateTime?
  metadataId String? @unique  metadata Metadata? @relation(fields:[metadataId], references:[id], onDelete: SetNull)
  @@index([role]) @@index([status])
}
model Item {
  id String @id @default(cuid())  name String  description String? @db.Text
  status ItemStatus @default(active)
  metadataId String? @unique  metadata Metadata? @relation(fields:[metadataId], references:[id], onDelete: SetNull)
  @@index([status])
}
model MetadataUpdateHistory {
  id String @id @default(cuid())  metadataId String
  metadata Metadata @relation(fields:[metadataId], references:[id], onDelete: Cascade)
  updatedAt DateTime @default(now())  updatedById String?  changes Json
  @@index([metadataId]) @@index([updatedAt])
}
model Session { id String @id  sid String @unique  data String @db.Text  expiresAt DateTime  @@index([expiresAt]) @@map("sessions") }
```
The above is a sketch: keep the existing column types and `@db.*` annotations that the current schema and session store require (read the existing `Session` model and `@quixo3/prisma-session-store` requirements first), set `utf8mb4`/`utf8mb4_unicode_ci` at the DDL level, and keep `createdBy`, `updatedBy`, `deletedBy` as plain ids if the foreign keys to `Account` cause circular-dependency problems (state the choice in the commit body). Remove `AccountRole`, `Config`, `Log`, `FormSubmission*`, `campus`, and all 2FA, email-verification and password-reset columns.
Migration: delete `server/prisma/migrations/20260512025450_add_form_submission`, keep or regenerate `migration_lock.toml` (provider `mysql`), generate `0001_init` with `npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/0001_init/migration.sql` (run from `server/`), and inspect the SQL for the tables, indexes, foreign keys and charset. Add `db:generate`, `db:deploy` (`prisma migrate deploy`), `db:status` scripts.
Verify against the disposable DB: `prisma validate`; `prisma migrate deploy` creates exactly Account, Item, Metadata, MetadataUpdateHistory, sessions and `_prisma_migrations`; running it again is a no-op; `prisma migrate status` is clean; `prisma generate` works. Type errors elsewhere are expected.

## Task P2-03 — Persistence layer, account service, policy
Commit: `refactor: rebuild account persistence with audit and policy`
1. `server/src/db/tx.ts`: `runInTransaction(prisma, fn)` wrapper.
2. `server/src/db/audit.ts`: helpers used inside a transaction: `createMetadata(tx, actorId)`, `appendHistory(tx, metadataId, actorId, changes)` (changes never contain password or hash values; store field names and old/new values for non-sensitive fields, and `"[changed]"` for password), `softDelete(tx, metadataId, actorId)`, `restore(tx, metadataId, actorId)`.
3. `server/src/rbac/account-policy.ts`: `assertCanManage(actor, targetRole)`, `assertCanAssign(actor, newRole)`, `assertNotSelf(actorId, targetId)` and `assertNotLastAdmin(tx, targetId, change)`: inside the transaction count active, non-deleted admins; throw `ConflictError("last-admin")` when the operation would delete, demote or deactivate the only remaining admin.
4. `server/src/http/dto/accounts.ts`: `toAccountDto(account)` mapping only safe fields (id, email, name, role, status, mustChangePassword, lastLogin, createdAt, updatedAt, deleted flag). Never return `password`.
5. `server/src/http/pagination.ts`: parse `page`/`pageSize`, return `{skip, take}` and build `{data, meta:{page,pageSize,total}}`.
6. `server/src/services/account-service.ts`: `list`, `get`, `create`, `update`, `setStatus`, `setPassword` (bcrypt cost 12, async), `softDelete` (rename email to a tombstone such as `deleted+<id>@invalid` to free the unique key), `restore`. Every write runs in one transaction with an audit history row. Email uniqueness violations map to `ConflictError`. No retry wrapper.
7. Delete `services/accounts/*`, `services/account-roles/*`, `utils/prisma.ts` (dynamic select builders), `utils/accounts.ts` if redundant, and remove `async-retry` from `server/package.json`.
8. Integration tests against the disposable DB (`server/test/helpers/db.ts` migrates and truncates between tests): manager cannot manage manager or admin; admin cannot delete, demote or deactivate the last admin; cannot manage self for delete; an audit row exists for each mutation and contains no password; `pageSize=1000` is rejected by the schema.

## Task P2-04 — REST routes, default-deny permissions, CI database
Commit: `feat: rest api with default-deny permissions`
1. `server/src/middleware/require-permission.ts`: `requireAuthenticated` (401 when no session) and `requirePermission(permission)` (403 when `roleHasPermission` is false). Both read the role from the session user loaded from the DB.
2. Routes (all JSON; controllers are thin and throw `AppError`; no try/catch):
   - `POST /api/auth/login` (public), `GET /api/auth/csrf` (public), `POST /api/auth/logout` (authenticated), `GET /api/auth/me` (authenticated, returns `SessionAccountDto` with `permissions` computed from the shared matrix), `POST /api/auth/change-password` (authenticated, bypasses the `mustChangePassword` block).
   - `GET /api/accounts` (`accounts:read`), `GET /api/accounts/:id` (`accounts:read`), `POST /api/accounts` (`accounts:create`), `PATCH /api/accounts/:id` (`accounts:update`), `POST /api/accounts/:id/status` (`accounts:update-status`), `POST /api/accounts/:id/password` (`accounts:change-password`), `DELETE /api/accounts/:id` (`accounts:delete`), `POST /api/accounts/:id/restore` (`accounts:restore`).
   - `GET /api/roles` (`roles:read`) returns the static map for display.
3. Default deny: build a route registry helper so that every route declares its policy (`public` or a permission). Add a test that walks the Express router stack and fails if any `/api` route lacks `requireAuthenticated` or `requirePermission` and is not on the explicit public allowlist (`login`, `csrf`, `healthz`, `readyz`).
4. Delete role CRUD routes, controllers and services, the old `routes/accounts.ts` and `controllers/accounts/*`, and `authMiddleware.ts` after replacing usages.
5. Permission matrix integration test: for each of the four roles, call each protected endpoint and assert 200/201 or 403 as the matrix dictates; unauthenticated gets 401.
6. CI: add a MariaDB 11.4 service container (with healthcheck) to the `server` job in `.github/workflows/ci.yml`, export `DATABASE_URL`/`MIGRATE_DATABASE_URL`, run `npx prisma migrate deploy` before tests. Keep the `server` build `continue-on-error` until P2-08.

## Task P2-05 — Session and HTTP hardening
Commit: `feat: harden sessions and http security`
1. `helmet` with defaults suitable for a JSON API. Body limit already 1 MB. `app.set("trust proxy", config.TRUST_PROXY)`.
2. Session cookie: name `__Host-app.sid` in production and `app.sid` otherwise; `httpOnly: true`; `secure: production`; `sameSite: "lax"`; `path: "/"`; no `domain` in production (required by the `__Host-` prefix) unless `COOKIE_DOMAIN` is set; 7 days. Session store stays the Prisma session store.
3. Login flow: Passport local → `req.session.regenerate` → log in → update `lastLogin` → respond. Logout: `req.logout` → `req.session.destroy` → `res.clearCookie(sameName, sameOptions)`.
4. Async bcrypt (`bcrypt.compare`). Cost 12; on successful login, if the stored hash cost differs, rehash and save.
5. CSRF double-submit: `GET /api/auth/csrf` sets a readable cookie (`__Host-csrf` in production, `csrf` in dev; `secure` in production, `sameSite: "lax"`, not HttpOnly) with a random token and returns it. For `POST/PUT/PATCH/DELETE` require header `x-csrf-token` equal to the cookie (constant-time compare). Exempt `login` only if it is called after fetching the CSRF token; the client must always fetch first. Also enforce the `Origin` header against `CORS_ORIGINS` for unsafe methods when an `Origin` header is present.
6. CORS: allow only `CORS_ORIGINS`, `credentials: true`, explicit headers (`content-type`, `x-csrf-token`, `x-trace-id`).
7. Rate limiting with `express-rate-limit`: login 10 per 15 minutes per IP, global 300 per 15 minutes per IP (configurable). Exempt `/healthz` and `/readyz`.
8. Origin secret: if `ORIGIN_SECRET` is set, every `/api/*` request except health must carry `x-origin-secret` equal to it (`crypto.timingSafeEqual`), otherwise 403. If unset, the check is skipped.
9. Database down during auth: respond 503 with code `service-unavailable` and log the cause at `error` (Decision DEC-12).
10. Tests for each control: cookie attributes in production mode, missing or wrong CSRF 403, wrong Origin 403, wrong or missing origin secret 403 only when configured, 429 on the 11th login, `lastLogin` updated, session destroyed on logout.

## Task P2-06 — Env-driven seed and forced password change
Commit: `feat: env-driven seed and forced password change`
1. `server/src/cli/seed.ts` (compiled to `dist/cli/seed.js`): idempotent. If there are zero accounts, create one admin from `BOOTSTRAP_ADMIN_EMAIL` (required for first run), `BOOTSTRAP_ADMIN_NAME` (default `Administrator`), and `BOOTSTRAP_ADMIN_PASSWORD`. If the password is empty, generate 24+ random characters, print them to stdout once with a clear banner (not through the logger), and never store or log them again. Set `mustChangePassword = true`.
2. Add `db:seed` script (`tsx src/cli/seed.ts` in dev, `node dist/cli/seed.js` built). Delete `server/src/setup.ts` and the temporary bootstrap call in `main.ts`.
3. While `mustChangePassword` is true, a middleware allows only `GET /api/auth/me`, `POST /api/auth/change-password` and `POST /api/auth/logout`; everything else returns 403 with code `password-change-required`.
4. `POST /api/auth/change-password` requires `currentPassword`, validates `newPassword` (min 12 chars, different from current), hashes with cost 12, clears the flag, and regenerates the session.
5. Admin reset of another account's password uses `canManage` and sets `mustChangePassword = true`.
6. Tests: seed twice gives exactly one admin; generated password printed once; flag enforced; wrong current password rejected; the old password no longer logs in. `rg -n "admin123"` is empty and no password literal remains in `server/src`.

## Task P2-07 — Legacy data export script
Commit: `feat: add legacy data export script`
1. `scripts/legacy/export-legacy-data.ts` (run with `tsx`): connects read-only to an old-schema database via `LEGACY_DATABASE_URL`, reads `AccountRole` and `Account`, maps roles (`level = -1` or name `Admin` to `admin`; names containing manager/gerente to `manager`; staff/operador to `staff`; everything else to `viewer`), and writes NDJSON (id, email, name, password hash, role, status where `locked` becomes `inactive`, createdAt). `--dry-run` prints the mapping table and counts and writes nothing. Never prints password hashes.
2. `docs/upgrading.md`: backup (`mariadb-dump --single-transaction`), create new DB, run `migrate deploy`, import NDJSON with an import script or documented SQL, cutover, rollback, and the note that sessions are not migrated.

## Task P2-08 — Client cutover
Commit: `feat: sync client with hardcoded rbac`
1. Rewrite `client/src/features/*/api.ts` for the REST endpoints and DTOs: one axios instance (`baseURL = import.meta.env.VITE_API_URL ?? "/api"`, `withCredentials: true`), an interceptor that fetches the CSRF token once and sends `x-csrf-token`, and one error-normalising path producing `{code, message, details}`.
2. `client/src/rbac/`: `can(role, permission)` using the shared matrix, `<Can permission="...">`, `useCan()`, and a route guard that redirects to `/admin` with a localised 403 message. Replace every `hasPermissions`/`permissions.includes` usage.
3. Delete roles CRUD UI (`features/roles/*` except what the read-only page needs), 2FA modal and fields, campus fields, reports placeholders, `routes/admin/logs.tsx`, `routes/admin/config.tsx`, and related nav items.
4. Add a read-only roles page (`GET /api/roles`) listing role to permissions, a change-password page, and the forced-change redirect (if `/api/auth/me` returns `mustChangePassword`, redirect to the change-password page until done).
5. Accounts page uses `page`/`pageSize` and shows role as a `Tag`; role select options come from the shared `ROLES` list; actions disabled by `canManage` against the row's role.
6. Remove the `continue-on-error` on the `server` build in CI (the build must be green now).
7. Client tests: `Can` shows and hides; the route guard redirects; the forced-change redirect works.
Verify: `rg -n -e campus -e FormSubmission -e requiresTwoFactor -e account-roles -e tfa client/src server/src shared/src` returns nothing live.

## Phase gate (first fully green build)
```bash
npm run bootstrap
npm run lint && npm run typecheck && npm run test && npm run build
# against the disposable MariaDB 11.4:
npm --prefix server exec prisma validate
npm --prefix server exec prisma migrate deploy && npm --prefix server exec prisma migrate status
npm --prefix server run db:seed && npm --prefix server run db:seed     # second run is a no-op
```
Manual matrix: log in as admin (forced password change), create one account per role, confirm each role sees only permitted navigation and gets 403 on forbidden endpoints, confirm the last admin cannot be deleted. Do not start P3 until the whole gate passes.
