# BUILD PROMPT — Phase P1: Server foundation

You are an autonomous senior engineer executing one phase of an approved refactor of a Node/Express/Prisma/MariaDB + React/Vite/Ant Design template. Work from the repository root.

## Read first
1. `FINAL_PLAN.md` at the repo root: §0 (what changed), §1 (execution rules), §4 (decisions), §5 (architecture and env reference) and the P1 table in §6. This prompt expands that table. If they conflict, FINAL_PLAN.md wins; record the conflict in your final report.
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
- Branch is `refactor/template-v1` and `git log --oneline main..HEAD` shows the six P0 commits.
- `npm run bootstrap` succeeds; `git ls-files "*package-lock.json"` lists exactly three locks.
- Read `docs/decisions/0001-package-layout.md` and follow its decision about shared-code consumption (file link or sync script).

## Final report (your last message)
Reply with exactly these sections:
1. Commits made: `hash subject` per task.
2. Gate results: each gate command and pass or fail.
3. Deviations from the plan, ADRs written, and anything left `UNVERIFIED`.
4. Open problems that block the next phase (or "none").

## Goal
Make the server observable, fail-fast and free of import-time side effects, without changing the schema or the API shape. Every commit in this phase must keep lint, typecheck, test (and build where it built before) green.

## Task P1-01 — Typed Zod configuration
Commit: `refactor: add typed zod configuration`
1. Create `server/src/config/env.ts` with a Zod schema covering every server variable in FINAL_PLAN.md §5.3: `NODE_ENV`, `PORT` (int, default 3000), `DATABASE_URL` (string, must start with `mysql://` or `mariadb://`), `MIGRATE_DATABASE_URL` (optional), `SESSION_SECRET` (min 32 chars), `CORS_ORIGINS` (comma list to array of valid URLs), `TRUST_PROXY` (int, default 0), `ORIGIN_SECRET` (optional), `SERVE_CLIENT` (boolean, default false), `LOG_LEVEL` (enum), `LOG_FORMAT` (`json` or `pretty`, default json in production), `SERVICE_NAME`, `OTEL_ENABLED` (boolean), `RATE_LIMIT_*`, `BOOTSTRAP_ADMIN_*`, `DOCS_DIR`, `COOKIE_DOMAIN`, plus the DB pool variable decided in the P0-03 ADR.
2. `server/src/config/index.ts` exports `loadConfig(env = process.env)` returning a frozen typed `AppConfig`. On failure print every invalid field (name and reason, never values of secrets) and `process.exit(1)`.
3. Env file loading happens in exactly one place: if `ENV_FILE` is set use it, else `server/.env` when present. No other module imports `dotenv`.
4. Update `server/prisma.config.ts` to read only `MIGRATE_DATABASE_URL ?? DATABASE_URL`.
5. Delete the old `server/src/config/env.ts` content, `config/redis.ts`, and all `dotenv` imports elsewhere.
6. Tests (`server/src/config/config.test.ts`): valid env parses; missing `SESSION_SECRET`, short secret, bad URL and non-numeric `PORT` each report the right field; secrets are not echoed.
Verify: `npm --prefix server run lint && npm --prefix server run typecheck && npm --prefix server run test -- config`.

## Task P1-02 — Structured logging with pino
Commit: `refactor: replace logging with pino`
1. Add `pino`, `pino-http`; dev dependency `pino-pretty`.
2. `server/src/logger.ts`: `createLogger(config)` returning a pino instance. Base fields `service`, `env`, `version` (from package.json). JSON output in production; `pino-pretty` transport only when `LOG_FORMAT=pretty` (dev). Redact paths: `req.headers.cookie`, `req.headers.authorization`, `res.headers["set-cookie"]`, `*.password`, `*.newPassword`, `*.currentPassword`, `*.token`, `*.secret`, `*.DATABASE_URL`. Use `censor: "[redacted]"`.
3. `server/src/middleware/request-logger.ts`: `pino-http` with `genReqId` = incoming `x-trace-id` (if it looks like a UUID) else `crypto.randomUUID()`; set response header `x-trace-id`; custom log level by status (>=500 error, >=400 warn); skip `/healthz` and `/readyz` at `debug`.
4. Replace every `console.*` and every `LoggingService` call in `server/src` with the logger (use `req.log` in handlers, the root logger elsewhere). Delete `services/logging.ts` and `middleware/traceId.ts`. Remove unused logging-related types.
5. Process handlers: `unhandledRejection` and `uncaughtException` log at `fatal` and exit 1 (wire these in P1-03's `main.ts`; implement the helper here).
6. `server/src/telemetry.ts`: if `OTEL_ENABLED`, lazily import OpenTelemetry (Node SDK, OTLP exporter, pino instrumentation) so that trace_id and span_id are injected into log records; otherwise a no-op. Add those packages as `optionalDependencies` or `dependencies` as appropriate. It must be imported first in `main.ts` (P1-03).
7. Tests: logging a request body containing `password` and a request with a `cookie` header produces output without those values; `x-trace-id` is returned.
Verify: `rg -n "console\." server/src` returns nothing; tests pass.

## Task P1-03 — Explicit startup and graceful shutdown
Commit: `refactor: make startup sequence explicit`
1. `server/src/db/prisma.ts` exports `createPrismaClient(config)` building the client with the MariaDB adapter and pool options chosen in the P0-03 ADR. Importing the file must not connect.
2. `server/src/app.ts` exports `createApp(deps: {config, logger, prisma})` returning an Express app (middleware order for now: request logger, `express.json({limit: "1mb"})`, cookie-parser, existing session/passport, existing routers, 404 and error handler added in P1-04). Move all route mounting here.
3. `server/src/main.ts`: `loadConfig` → telemetry → `createLogger` → `createPrismaClient` → `await prisma.$connect()` → (temporary) call the existing bootstrap seed function, passing the client explicitly → `createApp` → `listen`. `index.ts` only calls `main()`.
4. Delete `config/prisma.ts` (the import-time connect and seed). Refactor `setup.ts` to take the Prisma client as a parameter instead of importing a global.
5. Graceful shutdown on SIGTERM and SIGINT: stop accepting connections (`server.close`), wait up to 10 seconds, `await prisma.$disconnect()`, exit 0. Second signal exits immediately.
6. DB unreachable at boot: log `fatal` with a clear message (no credentials) and exit 1.
7. Test: `createApp` can be constructed with a fake Prisma and responds to a request (supertest).
Verify: build still builds as before; a manual run with a bad `DATABASE_URL` exits non-zero with a clear message; SIGTERM exits 0.

## Task P1-04 — Central error handling
Commit: `refactor: add centralized error handling`
1. `server/src/http/errors.ts`: `AppError(code, status, message, details?)` plus `NotFoundError`, `ConflictError`, `ForbiddenError`, `UnauthorizedError`, `ValidationError`, `ServiceUnavailableError`.
2. `async-handler.ts` wraps async handlers and forwards rejections (Express 5 forwards promise rejections already; keep the helper only if it adds typing value, otherwise skip it and note why).
3. `error-handler.ts`: maps `AppError`, `ZodError` (400 with issues), Prisma known errors (unique constraint to 409), everything else to 500; response `{ error: { code, message, details?, traceId } }`; stack traces never in production; 5xx logged at `error` with the trace id; 4xx at `warn`.
4. `not-found.ts`: JSON 404 for any `/api/*` path that matched no route.
5. Wire into `createApp` last. Existing controllers keep their own try/catch for now; they are replaced in P2.
6. Tests: `AppError` maps correctly; unknown error returns 500 with no stack; unknown API path returns JSON 404.

## Task P1-05 — Apply validated request data
Commit: `fix: apply validated request data`
1. `server/src/http/validation.ts`: `validateBody`, `validateQuery`, `validateParams` take a Zod schema, and on success assign the parsed result back (`req.body = parsed`; for query and params store on `req.validated.query` / `req.validated.params` because Express 5 makes `req.query` a getter) and on failure throw `ValidationError` with the Zod issues.
2. Replace `validationMiddleware.ts` usage in existing routes; delete the old file and the `parsedBody` type augmentation.
3. Regression test: a schema with a default and a transform; the handler receives the transformed value.
Verify: `rg -n parsedBody server shared` returns nothing.

## Task P1-06 — Health and readiness
Commit: `feat: add health and readiness endpoints`
1. `server/src/routes/health.ts`: `GET /healthz` returns `{status:"ok"}` with no dependency checks; `GET /readyz` runs `prisma.$queryRaw` with a `SELECT 1` query with a 2 second timeout and returns 200 `{status:"ready"}` or 503 `{status:"degraded"}`, logging the failure at `error`.
2. Mount before auth, session and any future CSRF, rate limit or origin-secret middleware (those arrive in P2-05, and must exempt these paths).
3. Tests for 200 and 503 (fake Prisma that rejects).

## Task P1-07 — Remove unused services and dependencies
Commit: `chore: remove unused services and dependencies`
1. Delete Redis (client, `REDIS_URL`, compose references are handled in P5), Socket.IO on both server and client (`services/socket.ts`, client socket usage, `Header.tsx` demo if it only served sockets), and every GPS or coordinate demo (`update_coords`, `sample/` references).
2. Run `knip` in `server` and `client`; remove every dependency it reports as unused after confirming with `rg`. Candidates: `redis`, `socket.io`, `socket.io-client`, `connect-mongo`, `chromadb`, `sharp`, `leaflet`, `recharts`, `nodemailer`, `@hello-pangea/dnd`, `antd-img-crop`, `react-markdown` (keep: used in P6), `idb-keyval`, `fs`, `fs-extra`, `validator`, `@tanstack/nitro-v2-vite-plugin`, `@tanstack/react-devtools`, `web-vitals`, `uuid` (if replaced by `crypto.randomUUID`), `async-retry` (keep until P2-03). Keep `dayjs` only if imported.
3. Pin `prisma`, `@prisma/client` and `@prisma/adapter-mariadb` to the same exact version (no caret) in `server/package.json`; regenerate the lock; remove `@prisma/client-runtime-utils` if it is no longer needed.
4. Regenerate both lockfiles with `npm install` inside each package.
Verify: `rg -n -e "socket\.io" -e "REDIS_URL" -e "update_coords" server client` returns nothing; `npm --prefix server exec knip` and `npm --prefix client exec knip` report no unused dependencies.

## Phase gate
```bash
npm run bootstrap
npm run lint && npm run typecheck && npm run test
npm --prefix server run build        # record status; may still fail on schema drift until P2
rg -n "console\." server/src         # empty
git log --oneline main..HEAD         # 6 (P0) + 7 (P1) commits
```
Do not start P2 until lint, typecheck and test are green in all three packages.
