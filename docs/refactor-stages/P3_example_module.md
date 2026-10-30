# BUILD PROMPT — Phase P3: Example module

You are an autonomous senior engineer executing one phase of an approved refactor of a Node/Express/Prisma/MariaDB + React/Vite/Ant Design template. Work from the repository root.

## Read first
1. `FINAL_PLAN.md` at the repo root: §0 (what changed), §1 (execution rules), §4 (decisions), §5 (architecture and env reference) and the P3 table in §6. This prompt expands that table. If they conflict, FINAL_PLAN.md wins; record the conflict in your final report.
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
- Branch `refactor/template-v1`; all P2 commits present.
- The P2 gate is green: `npm run bootstrap && npm run lint && npm run typecheck && npm run test && npm run build`.
- A disposable MariaDB 11.4 is available for integration tests.

## Final report (your last message)
Reply with exactly these sections:
1. Commits made: `hash subject` per task.
2. Gate results: each gate command and pass or fail.
3. Deviations from the plan, ADRs written, and anything left `UNVERIFIED`.
4. Open problems that block the next phase (or "none").

## Goal
Add one small, complete vertical slice (`Item`) that demonstrates the full stack: Prisma model, shared contracts, service with audit, REST routes with permissions, client page, tests, and a scripted way to remove it. Every commit stays green.

## Task P3-01 — Items backend
Commit: `feat: add items example module (server)`
1. Shared contracts in `shared/src/schemas/items.ts` and `shared/src/api/items.ts`: `ItemDto {id, name, description, status, createdAt, updatedAt, deleted}`; `createItemSchema` (name 1..120, description max 2000 optional), `updateItemSchema` (all optional, at least one field), `listItemsQuery` (pagination + `q` max 100 + `status` optional + `includeDeleted` boolean).
2. `server/src/services/item-service.ts`: `list`, `get`, `create`, `update`, `softDelete`, `restore`, each using the helpers from `db/audit.ts` and one transaction; `list` filters `metadata.deleted = false` unless `includeDeleted` and the caller can restore; search uses `contains` on `name`.
3. `server/src/http/dto/items.ts` mapper; controllers and routes: `GET /api/items`, `GET /api/items/:id`, `POST /api/items`, `PATCH /api/items/:id`, `DELETE /api/items/:id` (soft), `POST /api/items/:id/restore`, with permissions `items:read|create|update|delete|restore` through the default-deny registry. Mount in the router index.
4. Integration tests: viewer can list and get but gets 403 on every mutation; staff can create and update but not delete or restore; manager and admin can do everything; each mutation writes a history row; soft-deleted items are hidden from the default list; restore brings them back; `pageSize` above 100 is rejected.
Verify: `npm --prefix server run lint && npm --prefix server run typecheck && npm --prefix server run test && npm --prefix server run build`; the route-table default-deny test still passes with the new routes.

## Task P3-02 — Items client
Commit: `feat: add items example module (client)`
1. `client/src/features/items/`: `api.ts` (uses the shared axios instance), hooks (`useItems`, `useItemMutations`) with loading, error and cache invalidation, `components/ItemsTable.tsx` (AntD `Table` server-side pagination, search input, status filter, row actions), `components/ItemFormModal.tsx` (create and edit with the shared Zod schema for validation), delete and restore confirmations (`Popconfirm`).
2. Route `client/src/routes/admin/items.tsx` guarded by `items:read`; add a navigation entry in the admin layout gated by `<Can permission="items:read">`; buttons gated individually by `<Can>`.
3. Empty, loading and error states are explicit and localised through i18next keys (strings go in the current locale files; they are reorganised into packs in P4).
4. No inline `style` unless unavoidable; use Tailwind utilities or AntD props.
5. Tests with React Testing Library: table renders rows from a mocked API; viewer sees no create button; staff sees create but not delete; error state renders.
Verify: client lint, typecheck, test, build; manual smoke with each role.

## Task P3-03 — Example removal script and guide
Commit: `feat: add example module removal script`
1. `docs/example-module.md`: the exact list of files that make up the example (server service, routes, controller, DTO, tests; shared schemas and API; client feature, route, nav entry, locale keys; permissions; Prisma `Item` model and `ItemStatus` enum), and a copy-and-rename procedure for a new module (naming, permission additions, migration, tests, nav).
2. `scripts/remove-example.mjs`: with `--dry-run` it prints every file and edit it would make and writes nothing. Without it, it deletes the files, removes `items:*` permissions from the shared matrix, removes the nav entry and route, removes the model and enum from the schema, and creates a new Prisma migration named `drop_item` (via `prisma migrate dev --create-only`, documented as requiring a dev database) or prints the exact command if no database is available. Idempotent.
3. Test the script on a scratch copy of the repo (`cp -r` to a temp dir): after running it, `npm run lint && npm run typecheck && npm run build` must still pass in every package. Record the result in the commit body.

## Phase gate
```bash
npm run lint && npm run typecheck && npm run test && npm run build
```
Plus: with the disposable DB seeded, confirm each of the four roles can or cannot use the Items page as specified, and that `node scripts/remove-example.mjs --dry-run` changes nothing (`git status --short` empty).
