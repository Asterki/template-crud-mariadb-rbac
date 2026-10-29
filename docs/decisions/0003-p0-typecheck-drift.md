# 0003 P0 typecheck drift

Context: the P0 gate requires `typecheck` green before P1, and every P1 commit must keep it green.

Finding: P0-04 and ADR-0002 replaced Prisma payload types in `shared` with the legacy `IAccount`/`IAccountRole` domain types. Before any P1 change, `server` and `client` typecheck fail (25 and 21 errors) because the legacy types, client code, and current Prisma schema disagree.

Decision: keep P1 runtime, config and logging work green for lint and tests, and do not absorb the P2 schema/domain cutover. Typecheck and `build:server` remain red until P2; the P1 gate is reported as failed rather than skipped.
