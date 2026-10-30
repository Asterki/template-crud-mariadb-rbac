# BUILD PROMPT — Phase P6: Docs, in-app docs, init, doctor, AGENTS, licence

You are an autonomous senior engineer executing one phase of an approved refactor of a Node/Express/Prisma/MariaDB + React/Vite/Ant Design template. Work from the repository root.

## Read first
1. `FINAL_PLAN.md` at the repo root: §0 (what changed), §1 (execution rules), §4 (decisions), §5 (architecture and env reference) and the P6 table in §6. This prompt expands that table. If they conflict, FINAL_PLAN.md wins; record the conflict in your final report.
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
- Branch `refactor/template-v1`; all P5 commits present; full build green.
- Python 3 with `pip` is available for MkDocs (`pip install -r docs/requirements.txt`). If not, mark `mkdocs build` `UNVERIFIED`.
- Licence: P6-07 is **blocked until the repository owner has approved MIT**. If the user has not stated approval in the task instructions or in an `APPROVED_MIT` note, skip P6-07, report it as blocked, and continue.

## Final report (your last message)
Reply with exactly these sections:
1. Commits made: `hash subject` per task.
2. Gate results: each gate command and pass or fail.
3. Deviations from the plan, ADRs written, and anything left `UNVERIFIED`.
4. Open problems that block the next phase (or "none").

## Goal
Make the template understandable and usable: accurate docs, a permissioned in-app documentation page (including how to switch the MariaDB database), a one-command init, a doctor command, and AGENTS.md. Every commit stays green.

## Task P6-01 — Rewrite developer docs
Commit: `docs: rewrite template documentation`
1. English is canonical. Write from the code as it is now (read it; do not copy from old docs). Delete `docs.md`, `docs/es/`, and every outdated page that mentions JWT, PostgreSQL, pnpm, 2FA or refresh tokens.
2. Create under `docs/`: `index.md`, `architecture.md` (package layout, request lifecycle, Mermaid diagrams for components and deployment), `configuration.md` (the full env reference from FINAL_PLAN.md §5.3, per package), `deployment.md` (extend the P5 page: Vercel, headless API, GHCR, rollback), `observability.md` (from P5), `rbac.md` (roles, permissions matrix generated from the shared source, `canManage`, last-admin rule, how to add a role or permission), `database.md` (content in the section below), `api.md` (every endpoint with method, path, permission, request and response shape, error format), `testing.md`, `contributing.md` (commit format, branch, checks), `template-usage.md` (GitHub "Use this template", `npm run init`, deleting the example module, first deploy), `example-module.md` and `upgrading.md` (already present).
3. In-app pages in `docs/in-app/`: `index.md`, `database.md`, `rbac.md`, `deployment.md`. These are short operator-facing versions; `database.md` must contain the full content below.
4. `mkdocs.yml` with nav for all pages and the Material theme if already used; `docs/requirements.txt` (mkdocs, theme, pymdown-extensions, mermaid plugin if used).
5. Update `README.md`: what the project is, quick start (`npm run init`), commands per package, links to docs.

### Content required in `docs/database.md` and `docs/in-app/database.md`
- DSN format `mysql://<user>:<password>@<host>:3306/<database>`; provider is `mysql`, MariaDB through `@prisma/adapter-mariadb`; URL-encode special characters; pool size is set through the adapter option recorded in the P0-03 ADR (state precisely what you found).
- A table "where the database changes": `server/.env`, `.env.prod` or `.env` on the host, `compose.dev.yaml` and `compose.prod.yaml` (`MYSQL_*`, volume name), `compose.ghcr.yaml` (`.env` only), CI service container values, Vercel (nothing).
- Create database and users:
```sql
CREATE DATABASE `app` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'app_runtime'@'%' IDENTIFIED BY '<runtime-password>';
GRANT SELECT, INSERT, UPDATE, DELETE ON `app`.* TO 'app_runtime'@'%';
CREATE USER 'app_migrator'@'%' IDENTIFIED BY '<migrator-password>';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, DROP, REFERENCES ON `app`.* TO 'app_migrator'@'%';
```
  Explain restricting `'%'` to the needed network, and that `prisma migrate dev` needs shadow-database privileges so local development uses a separate dev user.
- Run order: `migrate` service (or `prisma migrate deploy` with `MIGRATE_DATABASE_URL`), then `node dist/cli/seed.js`; seed is idempotent; the one-time admin password is printed once.
- After switching: users sign in again (sessions live in the DB); changing `SESSION_SECRET` also invalidates sessions; backup with `mariadb-dump --single-transaction --routines --triggers --hex-blob`; never edit an applied migration; rollback by restoring the dump and redeploying the previous image tag.
- Troubleshooting table: `ER_ACCESS_DENIED_ERROR`/`P1000`, `Unknown database`, charset or collation error, `P1001`, `P3009`, too many connections, Prisma client not generated, login loops after a switch.
- Engine limits: MariaDB and MySQL 8 work with provider `mysql`; PostgreSQL and SQLite are out of scope (enums, `@db.*` types, JSON and the adapter change); single-tenant, one database per deployment.
Every command in the docs must be one you have run or can run as written; otherwise mark it clearly.
Verify: `pip install -r docs/requirements.txt && mkdocs build --strict`; `rg -n -i -e jwt -e postgres -e pnpm docs README.md` finds only intentional mentions (for example "PostgreSQL is out of scope").

## Task P6-02 — Permissioned in-app docs API
Commit: `feat: serve permissioned in-app docs`
1. `GET /api/docs` returns a manifest `[{slug, title}]` built from an allowlist file `docs/in-app/manifest.json` (not a directory scan). `GET /api/docs/:slug` returns `{slug, title, markdown}`.
2. Slug validation `^[a-z0-9-]{1,64}$`; resolve to `DOCS_DIR/<slug>.md`; `fs.realpath` the result and require it to stay inside the real path of `DOCS_DIR`; reject symlinks that escape; 404 for unknown slugs.
3. Both routes require `docs:read` through the default-deny registry. Cache file contents in memory in production.
4. Tests: viewer and staff get 403; manager and admin get 200; traversal attempts (`..`, `%2e%2e`, absolute paths, null bytes, a symlink inside the docs dir pointing outside) are rejected; unknown slug is 404.
5. Ensure `docs/in-app` is copied into the image (Dockerfile) and `DOCS_DIR` defaults correctly in the container; adjust `.dockerignore` if needed.

## Task P6-03 — In-app docs page
Commit: `feat: add in-app documentation page`
1. `client/src/features/docs/`: API hooks, `DocsViewer` using `react-markdown` with `remark-gfm` (add the dependency). No `rehype-raw`; links open safely (`rel="noopener noreferrer"`); code blocks styled; a generated table of contents from headings; loading, error and empty states.
2. Route `/admin/docs` guarded by `docs:read`; sidebar of pages from the manifest; navigation entry shown only with `docs:read`.
3. Add a prominent "Switching the database" entry linking to the `database` page.
4. Localise the chrome (docs content itself stays English).
5. Tests: viewer does not see the nav item and is redirected; markdown tables and code blocks render; a `<script>` in markdown is not rendered as HTML.

## Task P6-04 — One-command init
Commit: `feat: add one-command template init`
`scripts/init.mjs` (Node, no third-party dependencies; run as `npm run init -- <flags>` from the root). Flags: `--name`, `--slug`, `--title`, `--image`, `--owner`, `--repo`, `--locale`, `--brand`, `--yes`, `--dry-run`, `--force`, `--no-db`, `--no-install`. Without flags it asks questions with `readline`.
Behaviour:
1. Validate inputs (slug `^[a-z][a-z0-9-]{1,40}$`, hex colour, locale in `en|es`).
2. Refuse to run twice: write a marker `.template-initialized` (git-tracked) with the chosen values; require `--force` to re-run.
3. Rename: package names in the three `package.json` files, compose service and container names and volumes, the image name in `compose.ghcr.yaml`, `.env.ghcr.example` and workflow, titles, `shared/src/config/app.ts` defaults, README title, repository URLs, CODEOWNERS placeholder, MkDocs `site_name`.
4. Generate `server/.env` and `client/.env` from the examples with strong random `SESSION_SECRET`, DB passwords and `ORIGIN_SECRET`; never overwrite an existing `.env` without `--force`.
5. Unless `--no-db`: start `compose.dev.yaml` mariadb and wait for health; unless `--no-install`: run `npm run bootstrap`, `prisma migrate deploy`, and the seed. Print the admin email and the one-time password **once** (captured from the seed's stdout), with a reminder that the first login forces a password change.
6. `--dry-run` prints a plan of every file and replacement and writes nothing. Output never contains secrets other than the one-time admin password.
7. Test (a Node test file run by Vitest in `shared` or a small `scripts/init.test.mjs` using `node --test`): dry run leaves `git status` clean on a temp copy; slug validation; idempotency marker.
Verify: on a scratch copy of the repo, run `npm run init -- --name Acme --slug acme --yes --no-db --no-install`, then `npm run bootstrap && npm run build`; the renamed project builds.

## Task P6-05 — Doctor
Commit: `feat: add doctor diagnostics`
`scripts/doctor.mjs` (`npm run doctor`): checks (each prints OK or a one-line fix): Node version versus `.nvmrc`, npm version, presence of `server/.env` and `client/.env`, every required variable in `server/.env` (parse with the same schema by importing the built config or re-implementing minimal checks), `shared` build present, DB reachability (TCP connect then a MariaDB handshake through the server's Prisma if available), migration status (`prisma migrate status` output summarised), ports 3000 and 3306 in use, Docker availability. Exit code non-zero if any check fails. Never print secret values.
Verify: delete `server/.env` temporarily and see a clear failure; with a stopped DB see the reachability failure.

## Task P6-06 — AGENTS.md
Commit: `docs: add AGENTS.md`
At most 250 lines, accurate to the final repo: project overview; the three-package layout and the rule that `shared` is Prisma-free and framework-free; exact commands per package (install, dev, lint, typecheck, test, build, db:generate, db:deploy, db:seed); repo map; conventions (REST, DTOs only, every route declares a permission, errors thrown as `AppError`, logging only via pino and never to the database, migrations only through Prisma Migrate); commit format and branching; how to add a module, a permission, and a role (steps and files, including the migration for the `Role` enum); testing expectations (tests ship with code, integration tests need MariaDB); a **never-do list**: `prisma db push`, committing `.env`, editing applied migrations, wildcard permissions, importing Prisma into `shared`, logging secrets, bypassing default-deny, adding dependencies without checking `knip`.
Verify: run every command listed in the file (or note it as not runnable here).

## Task P6-07 — MIT licence and metadata (blocked until approved)
Commit: `chore: adopt mit licence and fix metadata`
1. Replace `LICENSE` with the MIT text (year current, holder name from the repository owner; if unknown use a clearly marked placeholder that `init` replaces).
2. Set `"license": "MIT"` in all three `package.json` files; fix `repository`, `homepage` and `bugs` to the template repository (derive from `git remote get-url origin`), remove every reference to `pumai` and `Asterki` metadata.
3. README licence section.
Verify: `npm pkg get license` prints MIT in each package directory; `rg -n -i -e pumai -e "all rights reserved" .` finds nothing live.

## Phase gate
```bash
npm run lint && npm run typecheck && npm run test && npm run build
pip install -r docs/requirements.txt && mkdocs build --strict
node scripts/init.mjs --name Acme --slug acme --dry-run     # writes nothing; git status clean
node scripts/doctor.mjs
```
Plus the docs permission matrix (admin and manager 200, staff and viewer 403) and an init run on a scratch copy that builds.
