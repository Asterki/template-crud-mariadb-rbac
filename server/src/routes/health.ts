import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import type { Logger } from "pino";

const READINESS_TIMEOUT_MS = 2000;

export type HealthDependencies = {
  prisma: Pick<PrismaClient, "$queryRaw">;
  logger: Logger;
};

function readinessTimeout(): Promise<never> {
  return new Promise((_resolve, reject) => {
    const handle = setTimeout(
      () => reject(new Error("Readiness check timed out")),
      READINESS_TIMEOUT_MS,
    );
    handle.unref();
  });
}

/**
 * Liveness and readiness endpoints.
 *
 * They are mounted before auth, sessions, CSRF, rate limiting and origin-secret
 * middleware so probes never depend on application security state.
 */
export function createHealthRouter({ prisma, logger }: HealthDependencies) {
  const router = Router();

  router.get("/healthz", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  router.get("/readyz", async (_req, res) => {
    try {
      await Promise.race([prisma.$queryRaw`SELECT 1`, readinessTimeout()]);
      res.status(200).json({ status: "ready" });
    } catch (error) {
      logger.error({ err: error }, "Readiness check failed");
      res.status(503).json({ status: "degraded" });
    }
  });

  return router;
}
