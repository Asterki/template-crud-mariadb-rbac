import type { Prisma, PrismaClient } from "@prisma/client";

export type TransactionClient = Prisma.TransactionClient;

/** Run a unit of work in a single database transaction. */
export function runInTransaction<T>(
  prisma: PrismaClient,
  fn: (tx: TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(fn);
}
