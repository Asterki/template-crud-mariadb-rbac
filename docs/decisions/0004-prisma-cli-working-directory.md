# 0004 Prisma CLI working directory

Context: the plan and `docs/contributing.md` ran `npm --prefix server exec prisma validate` from the repository root.

Finding: `npm exec --prefix server` keeps the caller's working directory, so Prisma looks for `prisma.config.ts` in the root and fails with "Could not find Prisma Schema".

Decision: run Prisma through the server package scripts (`npm --prefix server run db:validate`, `db:deploy`, `db:status`), which set the working directory to `server/`.
