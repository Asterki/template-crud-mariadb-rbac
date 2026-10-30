// Prisma CLI configuration for local development and the migrate job.
// It is deliberately self-contained: the runtime image does not ship `src/`.
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import { defineConfig } from "prisma/config";

const configDir = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.join(configDir, ".env"), quiet: true });

export default defineConfig({
  schema: path.join(configDir, "prisma", "schema.prisma"),
  migrations: {
    path: path.join(configDir, "prisma", "migrations"),
  },
  datasource: {
    url: process.env.MIGRATE_DATABASE_URL ?? process.env.DATABASE_URL,
  },
});
