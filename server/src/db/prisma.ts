import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";

import { loadConfig, type AppConfig } from "../config/index.js";

export type DatabaseConfig = Pick<AppConfig, "databaseUrl" | "dbPoolLimit">;

function poolConfig(databaseUrl: string, connectionLimit: number) {
  const url = new URL(databaseUrl);
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\//, "")),
    connectionLimit,
  };
}

/**
 * Build a Prisma client without connecting.
 *
 * The caller owns the lifecycle and must `await $connect()` explicitly.
 */
export function createPrismaClient(config: DatabaseConfig): PrismaClient {
  const adapter = new PrismaMariaDb(
    poolConfig(config.databaseUrl, config.dbPoolLimit),
  );

  return new PrismaClient({ adapter });
}

let legacyClient: PrismaClient | undefined;

/**
 * Temporary bridge for modules that still import the default client.
 *
 * It is created lazily, so importing this file never reads config or connects.
 * P2 replaces these modules with an explicitly injected client.
 */
function getLegacyClient(): PrismaClient {
  if (!legacyClient) {
    legacyClient = createPrismaClient(loadConfig());
  }
  return legacyClient;
}

const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getLegacyClient();
    const value = Reflect.get(client, property) as unknown;
    if (typeof value === "function") {
      return (value as (...args: unknown[]) => unknown).bind(client);
    }
    return value;
  },
});

export default prisma;
