# BUILD PROMPT — Phase P4: Theme, branding and i18n

You are an autonomous senior engineer executing one phase of an approved refactor of a Node/Express/Prisma/MariaDB + React/Vite/Ant Design template. Work from the repository root.

## Read first
1. `FINAL_PLAN.md` at the repo root: §0 (what changed), §1 (execution rules), §4 (decisions), §5 (architecture and env reference) and the P4 table in §6. This prompt expands that table. If they conflict, FINAL_PLAN.md wins; record the conflict in your final report.
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
- Branch `refactor/template-v1`; all P3 commits present.
- `npm run lint && npm run typecheck && npm run test && npm run build` is green.

## Final report (your last message)
Reply with exactly these sections:
1. Commits made: `hash subject` per task.
2. Gate results: each gate command and pass or fail.
3. Deviations from the plan, ADRs written, and anything left `UNVERIFIED`.
4. Open problems that block the next phase (or "none").

## Goal
One Ant Design theme source, one brand configuration, bilingual UI (`en` default, `es`), no hardcoded branding or ad-hoc styling. Work only in `client/` and `shared/src/config/`. Every commit stays green.

## Task P4-01 — Brand configuration and theme provider
Commit: `feat: add antd theme provider and brand tokens`
1. `client/src/config/brand.ts`: merges `shared/src/config/app.ts` defaults with `import.meta.env.VITE_APP_NAME`, `VITE_APP_SLUG`, `VITE_BRAND_COLOR`, `VITE_DEFAULT_LOCALE`; exports a frozen `brand` object. Validate the colour is a hex string and fall back to the default if not.
2. `client/src/theme/tokens.ts`: AntD `ThemeConfig` factory `buildTheme(mode, brand)` using `theme.defaultAlgorithm` or `theme.darkAlgorithm`, token overrides (`colorPrimary`, `borderRadius`, `fontFamily`, `colorBgLayout`), and `components` overrides for `Layout`, `Menu`, `Button`, `Table`, `Modal`.
3. `client/src/theme/antd-locale.ts`: map `en` to `antd/locale/en_US` and `es` to `antd/locale/es_ES`.
4. `client/src/theme/ThemeProvider.tsx`: wraps AntD `ConfigProvider` and `App`; holds `mode` (`light` or `dark`, initial from `localStorage` then `prefers-color-scheme`), persists it, toggles `class="dark"` on `<html>`, sets CSS variables `--brand-primary`, `--color-bg`, `--color-text`, and picks the AntD locale from the active i18n language. Exports `useThemeMode()`.
5. Tests: provider applies the dark class and persists the choice; invalid brand colour falls back.
Verify: client lint, typecheck, test.

## Task P4-02 — Single provider and Tailwind alignment
Commit: `refactor: centralize theme and align tailwind`
1. Mount `ThemeProvider` once at the app root (inside the Redux provider, wrapping the router). Delete every other `ConfigProvider` and hardcoded `esES` / `isDark` in `layouts/Admin.tsx` and `layouts/General.tsx`.
2. Tailwind v4: move `darkMode` out of the invalid nested position (use the v4 `@custom-variant dark` pattern in CSS or the correct top-level option for the installed version; check the installed Tailwind version first). Do not load Tailwind preflight; import theme and utilities layers only, so AntD's reset wins. Map the Tailwind `primary` colour to `var(--brand-primary)`. Document the layer order in a comment at the top of `index.css`.
3. Add a top-level React error boundary with a localised fallback and a retry button; lazy-load heavy routes (`React.lazy` or TanStack route-level code splitting); wire the existing 404 page as the router's not-found component.
4. Add a theme-mode toggle to the admin header.
Verify: `rg -n "<ConfigProvider" client/src` shows exactly one match; build passes; run the dev server and check login, accounts table, a modal and the items page in light and dark.

## Task P4-03 — Locale packs and switcher
Commit: `feat: add en and es locale packs`
1. Replace `client/src/locales/es.ts` with `client/src/locales/en/` and `client/src/locales/es/`, one file per namespace: `common`, `auth`, `accounts`, `items`, `roles`, `docs`, `validation`, `errors`. Configure i18next with namespaces, `fallbackLng: "en"`, default from `brand.defaultLocale`, language persisted in `localStorage`.
2. Move every user-facing string out of components into keys. Server error codes map to `errors:*` keys through a single lookup so API errors display translated messages.
3. `components/LanguageSwitcher.tsx` in the header; switching updates i18next, the AntD locale and `<html lang>`.
4. Test: every key in `en` exists in `es` and vice versa (walk both trees); no empty strings. Add a check that fails if a component contains a quoted human sentence by running a simple lint rule or a documented manual grep (do not block the build on the grep).
5. Delete the old `es.ts`.

## Task P4-04 — Remove hardcoded branding and inline styles
Commit: `refactor: remove hardcoded branding and inline styles`
1. Replace "Universidad de Las Americas", "Plantilla Random", "Sistema Random" and any logo or title strings in `client/index.html`, layouts and features with `brand.name` or i18n keys. `<title>` is set at runtime from the brand; `index.html` uses the neutral default.
2. Replace `style={{...}}` in layouts and features with Tailwind utilities, AntD props, or theme tokens; leave a short comment where a dynamic inline style is truly needed.
3. Logo comes from `brand.logo` (an imported asset with a neutral placeholder, not a university logo). Remove university assets from the repo.
Verify: `rg -n -e Universidad -e "Sistema Random" -e "Plantilla" client/src client/index.html` returns nothing.

## Phase gate
```bash
npm --prefix client run lint && npm --prefix client run typecheck && npm --prefix client run test && npm --prefix client run build
npm run lint && npm run typecheck && npm run test && npm run build
```
Visual smoke (describe results in the report): light and dark, `en` and `es`, login, accounts, items, roles, error boundary, 404.
