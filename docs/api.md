# API reference

Base path: `/api`. JSON in, JSON out. The SPA uses `VITE_API_URL=/api`; on
Vercel the same path is proxied to the API.

## Authentication and CSRF

Authentication uses a server-side session stored in MariaDB. The session
cookie is `app.sid` in development and `__Host-app.sid` in production
(`HttpOnly`, `Secure` in production, `SameSite=Lax`).

1. `GET /api/auth/csrf` returns a token and sets the CSRF cookie.
2. Send the token in `x-csrf-token` on every `POST`, `PATCH` and `DELETE`.
3. The browser sends the session cookie automatically (`withCredentials`).

Requests with an `Origin` header on an unsafe method must come from an origin
listed in `CORS_ORIGINS`. When `ORIGIN_SECRET` is set, every `/api/*` request
must also send `x-origin-secret`.

The client's single axios instance in `client/src/utils/api.ts` performs steps
1 and 2 automatically.

## Health

These routes are mounted before sessions, CSRF, rate limiting and the origin
secret.

| Method | Path | Auth | Response |
|---|---|---|---|
| `GET` | `/healthz` | public | `200 {"status":"ok"}` |
| `GET` | `/readyz` | public | `200 {"status":"ready"}` or `503 {"status":"degraded"}` |

## Auth

| Method | Path | Permission | Request | Success response |
|---|---|---|---|---|
| `POST` | `/api/auth/login` | public (rate limited) | `{ "email": string, "password": string }` | `200 { "data": SessionAccountDto }` |
| `GET` | `/api/auth/csrf` | public | — | `200 { "csrfToken": string }` |
| `POST` | `/api/auth/logout` | authenticated | — | `200 { "data": { "success": true } }` |
| `GET` | `/api/auth/me` | authenticated | — | `200 { "data": SessionAccountDto }` |
| `POST` | `/api/auth/change-password` | authenticated | `{ "currentPassword": string, "newPassword": string }` | `200 { "data": SessionAccountDto }` |

`SessionAccountDto`:

```json
{
  "id": "cuid",
  "email": "user@example.com",
  "name": "User",
  "role": "staff",
  "permissions": ["items:read", "items:create"],
  "status": "active",
  "mustChangePassword": false,
  "lastLogin": "2026-10-29T12:00:00.000Z"
}
```

`lastLogin` is `null` before the first login. `permissions` is computed from the
shared role matrix and is not stored in the database.

After login, passwords are rehashed to bcrypt cost 12 when the stored hash uses
a different cost. `mustChangePassword=true` blocks every other route except the
five self-service auth routes until the password is changed.

## Accounts

All account routes require authentication plus the permission shown.

| Method | Path | Permission | Request | Success response |
|---|---|---|---|---|
| `GET` | `/api/accounts` | `accounts:read` | Query: `page`, `pageSize`, `search`, `role`, `status`, `includeDeleted` | `200 { "data": AccountDto[], "meta": PageMeta }` |
| `GET` | `/api/accounts/:id` | `accounts:read` | — | `200 { "data": AccountDto }` |
| `POST` | `/api/accounts` | `accounts:create` | `{ "email", "name", "password", "role" }` | `201 { "data": AccountDto }` |
| `PATCH` | `/api/accounts/:id` | `accounts:update` | `{ "email"?, "name"?, "role"? }` (at least one) | `200 { "data": AccountDto }` |
| `POST` | `/api/accounts/:id/status` | `accounts:update-status` | `{ "status": "active" \| "inactive" }` | `200 { "data": AccountDto }` |
| `POST` | `/api/accounts/:id/password` | `accounts:change-password` | `{ "newPassword": string }` | `200 { "data": AccountDto }` |
| `DELETE` | `/api/accounts/:id` | `accounts:delete` | — | `200 { "data": AccountDto }` (soft deleted) |
| `POST` | `/api/accounts/:id/restore` | `accounts:restore` | — | `200 { "data": AccountDto }` |

`AccountDto`:

```json
{
  "id": "cuid",
  "email": "user@example.com",
  "name": "User",
  "role": "staff",
  "status": "active",
  "mustChangePassword": false,
  "lastLogin": null,
  "createdAt": "2026-10-29T12:00:00.000Z",
  "updatedAt": "2026-10-29T12:00:00.000Z",
  "deleted": false
}
```

### Pagination and filters

`page` is 1-based and defaults to `1`; `pageSize` defaults to `20` and is capped
at `100`. `PageMeta` is `{ "page", "pageSize", "total" }`.

`search` matches name or email (maximum 100 characters). `role` accepts
`admin`, `manager`, `staff`, `viewer`. `status` accepts `active` or `inactive`.
`includeDeleted=true` includes soft-deleted accounts.

### Policy

- A role can only be assigned by an actor who strictly outranks it
  (`canAssignRole`).
- An account can only be changed by an actor who strictly outranks its current
  role (`canManage`). Self-management is rejected.
- The last active, non-deleted admin cannot be deleted, demoted or disabled.
- Soft delete anonymises the email to `deleted+<id>@invalid`; restore recovers
  the previous email from the audit history.
- Passwords are hashed with bcrypt cost 12. Password history stores
  `"[changed]"`, never the hash.
- `POST /api/accounts/:id/password` sets `mustChangePassword=true` for the
  target. `POST /api/auth/change-password` clears it for the caller.

## Items (example module)

| Method | Path | Permission | Request | Success response |
|---|---|---|---|---|
| `GET` | `/api/items` | `items:read` | Query: `page`, `pageSize`, `q`, `status`, `includeDeleted` | `200 { "data": ItemDto[], "meta": PageMeta }` |
| `GET` | `/api/items/:id` | `items:read` | — | `200 { "data": ItemDto }` |
| `POST` | `/api/items` | `items:create` | `{ "name": string, "description"?: string }` | `201 { "data": ItemDto }` |
| `PATCH` | `/api/items/:id` | `items:update` | `{ "name"?, "description"?, "status"? }` | `200 { "data": ItemDto }` |
| `DELETE` | `/api/items/:id` | `items:delete` | — | `200 { "data": ItemDto }` (soft deleted) |
| `POST` | `/api/items/:id/restore` | `items:restore` | — | `200 { "data": ItemDto }` |

`ItemDto`:

```json
{
  "id": "cuid",
  "name": "Example",
  "description": "Optional text",
  "status": "active",
  "createdAt": "2026-10-29T12:00:00.000Z",
  "updatedAt": "2026-10-29T12:00:00.000Z",
  "deleted": false
}
```

`status` is `active` or `archived`. `q` matches the name. The item module can
be removed with `node scripts/remove-example.mjs --dry-run`; see
[example module](example-module.md).

## Roles

| Method | Path | Permission | Response |
|---|---|---|---|
| `GET` | `/api/roles` | `roles:read` | `200 { "data": [{ "role": "admin", "permissions": [...] }] }` |

The list is read-only and comes from the shared matrix. There is no role CRUD
API.

## Error format

Every error uses:

```json
{
  "error": {
    "code": "forbidden",
    "message": "forbidden",
    "details": [],
    "traceId": "request-id"
  }
}
```

`details` is optional. `traceId` matches the `x-trace-id` response header and
the pino `req.id`. In production, stacks are logged but never returned.

| Status | Code | Meaning |
|---|---|---|
| `400` | `validation_error` | Zod validation failed; `details` lists `{ path, code, message }`. |
| `401` | `unauthorized` | No session, or invalid credentials. |
| `403` | `forbidden` | Missing permission, bad CSRF token/origin, or bad origin secret. |
| `403` | `password-change-required` | The account must change the bootstrap password first. |
| `404` | `not_found` | Unknown route, account, item or document. |
| `409` | `conflict` | Duplicate email (`email-in-use`) or another unique violation. |
| `429` | `rate_limited` | Login or global rate limit exceeded (`express-rate-limit` response). |
| `500` | `internal_error` | Unhandled error; details are in the logs only. |
| `503` | `service-unavailable` | Database unavailable or readiness degraded. |

Domain-specific messages that are intentionally stable include
`invalid-credentials`, `account-locked`, `invalid-current-password`,
`account-not-found`, `email-in-use`, `invalid-origin`, `invalid-csrf-token`,
`invalid-origin-secret` and `password-change-required`.

## Shared contracts

Request schemas and DTOs live in `shared/src/schemas` and `shared/src/dto`.
Response types live in `shared/src/api`. Both packages import these types, so a
contract change is visible to the server and the client at typecheck time.
