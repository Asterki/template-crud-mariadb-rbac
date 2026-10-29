import { PrismaMariaDb } from "@prisma/adapter-mariadb";

import { PrismaClient } from "@prisma/client";

import setupServer from "../setup.js";
import { loadEnvFile } from "./env.js";

loadEnvFile();

const adapter = new PrismaMariaDb(process.env.DATABASE_URL as string, {});

(async () => {
  try {
    await adapter.connect();
    console.log("[PRISMA] Connected to MariaDB successfully");
    await setupServer();
  } catch (err) {
    console.error("[PRISMA] Connection failed:", (err as Error).message);
    process.exit(1);
  }
})();

const prisma = new PrismaClient({
  adapter,
});

export default prisma;
