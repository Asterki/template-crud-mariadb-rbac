# 0002 Shared package build without Prisma types

Context: P0-02 builds `shared/` with tsup and d.ts before the server generates a Prisma client, but `shared/api` imported `@prisma/client` types.
Finding: dts build fails with TS2305 because an ungenerated `@prisma/client` exports no models; generating a client inside `shared/` would couple it to `server/prisma`.
Decision: replace the Prisma payload types in `shared/api` with the existing `IAccount`/`IAccountRole` domain types now (P2-01 keeps them Prisma-free). Runtime behaviour is unchanged.
