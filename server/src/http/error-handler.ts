import type { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";

import { logger } from "../logger.js";
import {
  AppError,
  ConflictError,
  ServiceUnavailableError,
  ValidationError,
} from "./errors.js";

const DATABASE_UNAVAILABLE_CODES = new Set([
  "P1001",
  "P1002",
  "P1008",
  "P1017",
  "P2024",
]);

type ErrorPayload = {
  error: {
    code: string;
    message: string;
    details?: unknown;
    traceId: string;
  };
};

function traceIdFor(req: Request): string {
  return typeof req.id === "undefined" ? "unknown" : String(req.id);
}

function zodDetails(error: ZodError): unknown {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    code: issue.code,
    message: issue.message,
  }));
}

function normalize(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof ZodError) {
    return new ValidationError("Invalid request", zodDetails(error));
  }

  if (
    error instanceof Prisma.PrismaClientInitializationError ||
    (error instanceof Prisma.PrismaClientKnownRequestError &&
      DATABASE_UNAVAILABLE_CODES.has(error.code))
  ) {
    return new ServiceUnavailableError("service-unavailable");
  }

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return new ConflictError("A record with this value already exists");
  }

  return new AppError("internal_error", 500, "Internal server error");
}

/**
 * Central Express error handler.
 *
 * Known errors keep their status and public message. Unknown errors always map
 * to a generic 500 and never leak a stack trace in the response.
 */
export function errorHandler(
  error: unknown,
  req: Request,
  res: Response<ErrorPayload>,
  _next: NextFunction,
): void {
  if (res.headersSent) {
    _next(error);
    return;
  }

  const appError = normalize(error);
  const traceId = traceIdFor(req);
  const details = appError.details;

  const log = req.log ?? logger;
  const logPayload = {
    err: error,
    code: appError.code,
    status: appError.status,
    traceId,
  };

  if (appError.status >= 500) {
    log.error(logPayload, appError.message);
  } else {
    log.warn(logPayload, appError.message);
  }

  res.status(appError.status).json({
    error: {
      code: appError.code,
      message: appError.message,
      ...(details === undefined ? {} : { details }),
      traceId,
    },
  });
}
