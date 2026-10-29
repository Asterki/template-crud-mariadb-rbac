import type { PrismaClient } from "@prisma/client";
import type { Logger } from "pino";

import { createAccountWithRetry } from "./services/accounts/create.js";

/**
 * Bootstraps the system with default admin role and account if none exist.
 *
 * The caller passes the Prisma client and logger explicitly; this module has no
 * import-time side effects.
 */
export async function setupServer(
  prismaClient: PrismaClient,
  logger: Logger,
): Promise<void> {
  // Check if system is fresh
  const existingAccounts = await prismaClient.account.count({});
  logger.info(`Existing accounts in system: ${existingAccounts}`);

  if (existingAccounts > 0) {
    logger.info("System already initialized, skipping bootstrap");
    return;
  }

  logger.info("Fresh system detected, running bootstrap");

  // 1. Create Admin Role
  let adminRole = await prismaClient.accountRole.findFirst({
    where: { level: -1 },
  });

  if (!adminRole) {
    adminRole = await prismaClient.accountRole.create({
      data: {
        name: "Admin",
        level: -1,
        description: "Administrator role with full permissions",
        isSystemRole: true,
        permissions: "*",
        requiresTwoFactor: true,
        metadata: {
          create: {
            documentVersion: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
            deleted: false,
            deletedAt: null,
            deletedById: null,
            status: "active",
            source: "manual",
            tags: "",
            notes: "",
          },
        },
      },
    });
    logger.info("Created default Admin role");
  } else {
    logger.info("Admin role already exists");
  }

  // 2. Create Primary Admin Account
  await createAccountWithRetry(
    {
      roleId: adminRole.id,
      password: "admin123", // Service will hash this password before saving
      name: "Admin User",
      email: "admin@local.test",
    },
    { prismaClient },
  );

  logger.info("Created default admin account");
}

export default setupServer;
