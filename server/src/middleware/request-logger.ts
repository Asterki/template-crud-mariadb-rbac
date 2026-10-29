import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

import { pinoHttp } from "pino-http";
import type { Logger } from "pino";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEALTH_PATHS = new Set(["/healthz", "/readyz"]);

function requestPath(url: string | undefined): string {
  return (url ?? "/").split("?")[0] ?? "/";
}

function traceIdFrom(req: IncomingMessage): string {
  const header = req.headers["x-trace-id"];
  const candidate = Array.isArray(header) ? header[0] : header;
  return candidate && UUID_RE.test(candidate) ? candidate : randomUUID();
}

function levelFor(
  req: IncomingMessage,
  res: ServerResponse,
  error?: Error,
): "debug" | "info" | "warn" | "error" {
  if (HEALTH_PATHS.has(requestPath(req.url))) return "debug";
  if (error || res.statusCode >= 500) return "error";
  if (res.statusCode >= 400) return "warn";
  return "info";
}

/**
 * Request logging and trace-id propagation.
 *
 * The incoming `x-trace-id` is reused only when it is a UUID; otherwise a new
 * UUID is generated. The resolved id is returned on the response.
 */
export function requestLogger(logger: Logger) {
  return pinoHttp({
    logger,
    genReqId(req, res) {
      const id = traceIdFrom(req);
      res.setHeader("x-trace-id", id);
      return id;
    },
    customLogLevel(req, res, error) {
      return levelFor(req, res, error);
    },
    customSuccessMessage(req) {
      return `${req.method ?? "GET"} ${requestPath(req.url)} completed`;
    },
    customErrorMessage(req) {
      return `${req.method ?? "GET"} ${requestPath(req.url)} failed`;
    },
  });
}
