import express, { type Express } from "express";
import cookie from "cookie-parser";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { PrismaClient } from "@prisma/client";
import type { Logger } from "pino";

import type { AppConfig } from "./config/index.js";
import { errorHandler } from "./http/error-handler.js";
import { notFound } from "./http/not-found.js";
import { requestLogger } from "./middleware/request-logger.js";
import { registerRoutes } from "./routes/index.js";
import { createSessionManager } from "./services/sessions.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export type AppDependencies = {
  config: AppConfig;
  logger: Logger;
  prisma: PrismaClient;
};

/**
 * Build the Express application.
 *
 * All I/O (config, logging, database) is supplied by the caller so tests can
 * construct an app with fakes and importing this module has no side effects.
 */
export function createApp({
  config,
  logger,
  prisma,
}: AppDependencies): Express {
  const app = express();

  app.set("trust proxy", config.trustProxy);

  app.use(requestLogger(logger));
  app.use(express.json({ limit: "1mb" }));
  app.use(cookie(config.sessionSecret));
  app.use("/uploads/", express.static(path.join(__dirname, "../uploads")));

  if (config.nodeEnv !== "production") {
    app.use(
      cors({
        origin: [...config.corsOrigins],
        credentials: true,
        exposedHeaders: ["set-cookie"],
      }),
    );
  } else {
    const clientPath = path.join(__dirname, "../../client-dist");
    app.use(express.static(clientPath));
    app.get(/.*/, (req, res, next) => {
      if (req.path.startsWith("/api/")) return next();
      res.sendFile(path.join(clientPath, "index.html"));
    });
  }

  const sessions = createSessionManager({ config, prisma, logger });
  sessions.loadToServer(app);

  registerRoutes(app);
  app.use("/api", notFound);
  app.use(errorHandler);

  return app;
}
