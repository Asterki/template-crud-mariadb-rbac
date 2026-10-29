# AGENTS.md

Guidance for AI agents and humans working in this repository. Read this before
changing code. If a command or path disagrees with the code, the code wins;
update this file in the same change.

## Project overview

A reusable, single-tenant admin template:

- **server/**: headless Express 5 API on Node 24, Prisma 7 with MariaDB through
  `@prisma/adapter-mariadb`, session auth, pino logs, default-deny RBAC.
- **client/**: React 19 + Vite 7 + Ant Design 5 SPA, TanStack Router, i18next
  (`en` default, `es` included).
- **shared/**: Zod request schemas, DTOs, wire types, roles, permissions and
  policy. It is **Prisma-free and framework-free**.

There are three independent npm packages and no npm workspaces. The root
`package.json` has scripts only and no dependencies. Each package has its own
`package.json`, `package-lock.json` and `node_modules`.

## Commands

Run commands from the repository root unless noted.

### Root

| Purpose | Command |
|---|---|
| Install everything | `npm run bootstrap` |
| Initialise a new project | `npm run init -- --name "Acme" --slug acme --yes` |
| Diagnostics | `npm run doctor` |
| Lint all packages | `npm run lint` |
| Typecheck all packages | `npm run typecheck` |
| Test all packages | `npm run test` |
| Build all packages | `npm run build` |
| Develop API and SPA | `npm run dev` |
| Legacy export/import | `npm run legacy:export`, `npm run legacy:import` |

### shared

| Purpose | Command |
|---|---|
| Install | `npm --prefix shared install` |
| Lint | `npm --prefix shared run lint` |
| Typecheck | `npm --prefix shared run typecheck` |
| Test | `npm --prefix shared run test` |
| Build (ESM + d.ts) | `npm --prefix shared run build` |
| Coverage | `npm --prefix shared run test:coverage` |

### server

| Purpose | Command |
|---|---|
| Install | `npm --prefix server install` |
| Develop | `npm --prefix server run dev` |
| Lint | `npm --prefix server run lint` |
| Typecheck | `npm --prefix server run typecheck` |
| Test | `npm --prefix server run test` |
| Build | `npm --prefix server run build` |
| Generate Prisma client | `npm --prefix server run db:generate` |
| Apply migrations | `npm --prefix server run db:deploy` |
| Migration status | `npm --prefix server run db:status` |
| Seed first admin | `npm --prefix server run db:seed` |

Integration tests need MariaDB (`TEST_DATABASE_URL` or `DATABASE_URL`).
Without a database the integration files are skipped; CI always provides one.

### client

| Purpose | Command |
|---|---|
| Install | `npm --prefix client install` |
| Develop | `npm --prefix client run dev` |
| Lint | `npm --prefix client run lint` |
| Typecheck | `npm --prefix client run typecheck` |
| Test | `npm --prefix client run test` |
| Build | `npm --prefix client run build` |
| i18n hardcoded-string check | `npm --prefix client run check:i18n` |

The client dev server proxies `/api` to `VITE_PROXY_TARGET` and injects the
optional `ORIGIN_SECRET` from `client/.env`. Production uses the Vercel rewrite.

## Repository map

```text
client/src/
  app, components, config, features/{accounts,auth,docs,items,roles}
  layouts, locales/{en,es}, rbac, routes, theme
server/
  prisma/{schema.prisma,migrations}
  src/config       Zod env parsing
  src/db           Prisma client, transactions, audit helpers
  src/http         errors, validation, DTOs, pagination, error handler
  src/middleware   auth/permission, CSRF, rate limit, origin secret, logging
  src/rbac         account policy and last-admin guard
  src/routes       auth, accounts, items, roles, docs, health
  src/services     account, item, docs, sessions
  src/cli/seed.ts  idempotent first-admin seed
  test/            integration tests
shared/src/
  api, config, dto, rbac, schemas
docs/              MkDocs site plus in-app operator pages
scripts/           bootstrap, init, doctor, remove-example, legacy
```

## Conventions

- **REST resources.** `GET/POST/PATCH/DELETE /api/<resource>` and action
  subresources such as `POST /api/accounts/:id/status`.
- **DTOs only.** Never return Prisma rows or password hashes. Map rows in
  `server/src/http/dto/`.
- **Every protected route declares a permission** with `requireAuthenticated`
  and `requirePermission`. Default deny; the route audit test enforces it.
- **Errors are thrown as `AppError` subclasses.** Do not add per-controller
  status mapping. The central handler returns
  `{ error: { code, message, details?, traceId } }`.
- **Log only through pino** (`req.log` or `server/src/logger.ts`). Never write
  application logs to the database. `MetadataUpdateHistory` is business audit
  data, not a log.
- **Database changes only through Prisma Migrate.** Never edit an applied
  migration; add a forward one.
- **Shared stays Prisma-free.** No `@prisma/*` imports in `shared/`, no Express,
  React or Node-only APIs.
- **Validate with the shared Zod schemas.** Do not duplicate request shapes.
- **Transactions and audit.** Mutations that touch metadata/entity/history use
  `runInTransaction` plus the helpers in `server/src/db/`.
- **The client mirrors the server policy.** Use `can`, `<Can>` and
  `<RequirePermission>`; never invent a permission string.

## Commits and branches

- Work on a branch. Do not commit to `main`.
- Conventional Commits: `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, `ci:`,
  `build:`, `test:`. Imperative mood, header at most 72 characters.
- Use `!` and a `BREAKING CHANGE:` footer for schema or API breaks.
- One logical change per commit. Tests, docs and `.env.example` updates ship in
  the same commit as the code.
- `commitlint.config.mjs` enforces the format in CI.

## Add a module

Use the `Item` slice as the reference. For a `Widget`:

1. Shared: `shared/src/schemas/widgets.ts`, `shared/src/api/widgets.ts`, export
   from the index files, add permissions to `shared/src/rbac/permissions.ts`
   and grants to `matrix.ts`, update `rbac.test.ts`.
2. Database: add the model/enum to `server/prisma/schema.prisma`, then create a
   forward migration:
   `MIGRATE_DATABASE_URL="mysql://…/app" npx prisma migrate dev --create-only --name add_widget`.
   Inspect the SQL, then `npm --prefix server run db:deploy`.
3. Server: service, DTO mapper, controller and router with permissions; mount
   it in `server/src/routes/index.ts` and construct the service in
   `server/src/app.ts`; add the router to
   `server/test/routes/route-audit.test.ts`.
4. Client: feature folder, API module, route under `client/src/routes/admin/`,
   nav entry gated by `<Can>`, locale keys in both `en` and `es`.
5. Tests at each layer, then `npm run lint && npm run typecheck && npm run test
   && npm run build`.

Remove the example with `node scripts/remove-example.mjs --dry-run` first.

## Add a permission

1. Add the literal to `shared/src/rbac/permissions.ts`.
2. Grant it in `shared/src/rbac/matrix.ts` (admin receives every permission
   automatically through `PERMISSIONS`).
3. Update `shared/src/rbac/rbac.test.ts`.
4. Add `requirePermission("resource:action")` to the route.
5. Gate the client UI with `<Can>` or `<RequirePermission>`.
6. Rebuild shared and run the full gate.

No migration is required for a permission.

## Add a role

A role is a Prisma enum value, so this needs a migration:

1. Add the value to `Role` in `server/prisma/schema.prisma`.
2. Add it to `ROLES` and `ROLE_RANK` in `shared/src/rbac/roles.ts`.
3. Add it to `ROLE_PERMISSIONS` in `shared/src/rbac/matrix.ts`.
4. Add locale labels for the roles page.
5. Create and apply a forward migration:
   `MIGRATE_DATABASE_URL="mysql://…/app" npx prisma migrate dev --create-only --name add_role_example`,
   then `MIGRATE_DATABASE_URL="mysql://…/app" npx prisma migrate deploy`.
6. Run the full gate.

## Testing expectations

- Tests ship with the code. Do not merge a feature without tests.
- `shared`: table-driven RBAC and schema tests.
- `server`: unit tests for config/logging/errors/validation plus integration
  tests for routes, the permission matrix, audit rows, last-admin guard and the
  docs API. Integration tests use MariaDB and truncate tables.
- `client`: Testing Library tests for RBAC, guards, pages, docs markdown and
  i18n key parity.
- Run `npm run test` before every commit. With a database, never leave the
  integration suites skipped by accident.

## Never do

- `prisma db push` (any environment).
- Commit `.env`, `.env.*` (except `*.example`), tokens, passwords or generated
  secrets.
- Edit a migration that has already been applied.
- Add wildcard permissions or bypass the default-deny registry.
- Import Prisma into `shared/`.
- Log secrets, cookies, authorization headers or database URLs.
- Bypass `requireAuthenticated`/`requirePermission` on a protected route.
- Add a dependency without checking `knip` (`npm --prefix <pkg> run knip`).
- Commit generated `dist/`, `coverage/` or `site/` output.
