import type { Prisma } from "@prisma/client";

import type { TransactionClient } from "./tx.js";

export type AuditChanges = Record<string, unknown>;

/** Create the metadata row owned by a new resource. */
export function createMetadata(
  tx: TransactionClient,
  actorId: string | null,
): Promise<{ id: string }> {
  return tx.metadata.create({
    data: {
      createdBy: actorId,
      updatedBy: actorId,
    },
    select: { id: true },
  });
}

/** Append one audit row. Callers must never place secrets in `changes`. */
export function appendHistory(
  tx: TransactionClient,
  metadataId: string,
  actorId: string | null,
  changes: AuditChanges,
): Promise<{ id: string }> {
  return tx.metadataUpdateHistory.create({
    data: {
      metadataId,
      updatedById: actorId,
      changes: changes as Prisma.InputJsonValue,
    },
    select: { id: true },
  });
}

export async function softDelete(
  tx: TransactionClient,
  metadataId: string,
  actorId: string | null,
): Promise<void> {
  const deletedAt = new Date();

  await tx.metadata.update({
    where: { id: metadataId },
    data: {
      deleted: true,
      deletedAt,
      deletedBy: actorId,
      updatedBy: actorId,
    },
  });

  await appendHistory(tx, metadataId, actorId, {
    deleted: true,
    deletedAt: deletedAt.toISOString(),
  });
}

export async function restore(
  tx: TransactionClient,
  metadataId: string,
  actorId: string | null,
): Promise<void> {
  await tx.metadata.update({
    where: { id: metadataId },
    data: {
      deleted: false,
      deletedAt: null,
      deletedBy: null,
      updatedBy: actorId,
    },
  });

  await appendHistory(tx, metadataId, actorId, {
    deleted: false,
    deletedAt: null,
  });
}
