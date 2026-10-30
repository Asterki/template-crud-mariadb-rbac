import cors from "cors";
import helmet from "helmet";
import type { RequestHandler } from "express";

import type { AppConfig } from "../config/index.js";

export function securityHeaders(): RequestHandler {
  return helmet();
}

export function corsMiddleWare(
  config: Pick<AppConfig, "corsOrigins">,
): RequestHandler {
  return cors({
    origin: [...config.corsOrigins],
    credentials: true,
    allowedHeaders: [
      "content-type",
      "x-csrf-token",
      "x-trace-id",
      "x-origin-secret",
    ],
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  });
}
