import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient, type Role } from "@prisma/client";
import bcrypt from "bcrypt";

const serverRoot = fileURLToPath(new URL("../../", import.meta.url));

export const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

export const hasTestDatabase = Boolean(testDatabaseUrl);

export function createTestPrisma(): PrismaClient {
  if (!testDatabaseUrl) {
    throw new Error("TEST_DATABASE_URL or DATABASE_URL is required");
  }
  const url = new URL(testDatabaseUrl);
  const adapter = new PrismaMariaDb({
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\//, "")),
    connectionLimit: 2,
  });
  return new PrismaClient({ adapter });
}

export function migrateTestDatabase(): void {
  if (!testDatabaseUrl) {
    throw new Error("TEST_DATABASE_URL or DATABASE_URL is required");
  }
  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    cwd: serverRoot,
    env: {
      ...process.env,
      DATABASE_URL: testDatabaseUrl,
      MIGRATE_DATABASE_URL: testDatabaseUrl,
    },
    stdio: "pipe",
  });
}

export async function truncateAll(prisma: PrismaClient): Promise<void> {
  // Child rows first so foreign keys stay valid on every pooled connection.
  for (const table of [
    "MetadataUpdateHistory",
    "Account",
    "Item",
    "Metadata",
    "sessions",
  ]) {
    await prisma.$executeRawUnsafe(`DELETE FROM \`${table}\``);
  }
}

let sequence = 0;

export function testEmail(prefix = "account"): string {
  sequence += 1;
  return `${prefix}-${process.pid}-${sequence}@example.test`;
}

export const TEST_PASSWORD = "InitialPassword123!";

export async function seedAccount(
  prisma: PrismaClient,
  input: {
    role: Role;
    email?: string;
    name?: string;
    status?: "active" | "inactive";
    deleted?: boolean;
    password?: string;
  },
) {
  const metadata = await prisma.metadata.create({
    data: { deleted: input.deleted ?? false },
  });
  const password = await bcrypt.hash(input.password ?? TEST_PASSWORD, 4);

  return prisma.account.create({
    data: {
      email: input.email ?? testEmail(input.role),
      name: input.name ?? `${input.role} account`,
      password,
      role: input.role,
      status: input.status ?? "active",
      metadataId: metadata.id,
    },
    include: { metadata: true },
  });
}
