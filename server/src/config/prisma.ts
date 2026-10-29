import { PrismaMariaDb } from "@prisma/adapter-mariadb";

import { PrismaClient } from "@prisma/client";

import setupServer from "../setup.js";
import { logger } from "../logger.js";
import { loadEnvFile } from "./env.js";

loadEnvFile();

const adapter = new PrismaMariaDb(process.env.DATABASE_URL as string, {});

(async () => {
  try {
    await adapter.connect();
    logger.info("Connected to MariaDB successfully");
    await setupServer();
  } catch (err) {
    logger.error({ err }, "Database connection failed");
    process.exit(1);
  }
})();

const prisma = new PrismaClient({
  adapter,
});

export default prisma;
