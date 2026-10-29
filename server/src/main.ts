import { startTelemetry, stopTelemetry } from "./telemetry.js";

import type { Server } from "node:http";
import type { PrismaClient } from "@prisma/client";
import type { Logger } from "pino";

import { createApp } from "./app.js";
import { loadConfig } from "./config/index.js";
import { createPrismaClient } from "./db/prisma.js";
import {
  createLogger,
  installProcessHandlers,
  setRootLogger,
} from "./logger.js";

const SHUTDOWN_TIMEOUT_MS = 10_000;

function errorCode(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function timeout(ms: number): Promise<"timeout"> {
  return new Promise((resolve) => {
    const handle = setTimeout(() => resolve("timeout"), ms);
    handle.unref();
  });
}

async function shutdown(
  signal: string,
  server: Server,
  prisma: PrismaClient,
  logger: Logger,
): Promise<void> {
  logger.info({ signal }, "Shutting down");

  const result = await Promise.race([
    closeServer(server).then(() => "closed" as const),
    timeout(SHUTDOWN_TIMEOUT_MS),
  ]);

  if (result === "timeout") {
    logger.warn(
      { timeoutMs: SHUTDOWN_TIMEOUT_MS },
      "HTTP server did not drain in time, closing remaining connections",
    );
    server.closeAllConnections();
  }

  try {
    await prisma.$disconnect();
  } catch (error) {
    logger.error({ code: errorCode(error) }, "Prisma disconnect failed");
  }

  await stopTelemetry();
  logger.info("Shutdown complete");
  process.exit(0);
}

export async function main(): Promise<void> {
  const config = loadConfig();

  await startTelemetry(config);

  const logger = createLogger(config);
  setRootLogger(logger);
  installProcessHandlers(logger);

  const prisma = createPrismaClient(config);

  try {
    await prisma.$connect();
    // Driver adapters may connect lazily, so force a real round-trip.
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    logger.fatal(
      { code: errorCode(error) },
      "Database connection failed. Check DATABASE_URL and that MariaDB is reachable.",
    );
    process.exit(1);
  }

  const app = createApp({ config, logger, prisma });
  const server = app.listen(config.port, () => {
    logger.info({ port: config.port }, "Server listening");
  });

  let shuttingDown = false;
  const handleSignal = (signal: NodeJS.Signals): void => {
    if (shuttingDown) {
      logger.warn({ signal }, "Received second signal, exiting immediately");
      process.exit(0);
    }
    shuttingDown = true;
    void shutdown(signal, server, prisma, logger);
  };

  process.on("SIGTERM", handleSignal);
  process.on("SIGINT", handleSignal);
}
