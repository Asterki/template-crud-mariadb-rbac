# Testing

The three packages use Vitest. Tests ship in the same commit as the code they
cover. There is no separate end-to-end framework.

## Commands

From the repository root:

```bash
npm run test                 # all three packages
npm --prefix shared run test
npm --prefix server run test
npm --prefix client run test
```

Focused runs:

```bash
npm --prefix server run test -- routes/permissions
npm --prefix client run test -- DocsPage
npm --prefix shared run test -- rbac
```

Coverage:

```bash
npm --prefix shared run test:coverage
npm --prefix server run test:coverage
npm --prefix client run test:coverage
```

## Unit tests

- `shared`: role matrix, `canManage`, schema validation and pagination limits.
- `server/src/**/*.test.ts`: config parsing, logger redaction, error handling,
  validation, health routes, headless/all-in-one mode.
- `client/src/**/*.test.{ts,tsx}`: RBAC helpers, guards, theme, i18n parity,
  item and docs pages, markdown rendering.

Unit tests do not need a database. They use injected fake dependencies or
`supertest` against `createApp` with a fake Prisma client.

## Integration tests

`server/test/**` exercises the real services and routes against MariaDB. The
suite:

- runs `prisma migrate deploy` once per test file;
- truncates the tables between tests;
- creates accounts for each role and signs them in through the real session
  store;
- asserts the default-deny permission matrix and the last-admin rule.

When neither `TEST_DATABASE_URL` nor `DATABASE_URL` is set, the integration
files are skipped (`describe.skip`); unit files still run. Do not hide failures
by relying on that skip in CI: the server CI job always starts MariaDB.

### Run integration tests locally

```bash
# Start only the development database (reads server/.env)
docker compose -f compose.dev.yaml up -d mariadb

# Use a disposable database/user for tests. The suite truncates tables.
export TEST_DATABASE_URL='mysql://root:root@127.0.0.1:3306/app_test'
npm --prefix server run test
```

The CI workflow uses the same idea with a MariaDB 11.4 service container and
the root account. Never point `TEST_DATABASE_URL` at a database with data you
need: tests delete rows.

## Client tests

The client uses jsdom with Testing Library. `client/src/test/setup.ts` provides
the browser APIs Ant Design expects (`matchMedia`, `ResizeObserver`). Tests mock
the axios API modules, not the shared permission map.

## CI

`.github/workflows/ci.yml` runs, per package:

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

The server job additionally runs `npx prisma migrate deploy` before tests. The
Docker job builds the image and scans it with Trivy. Keep the local commands and
the workflow aligned.
