import type { Request, RequestHandler } from "express";
import type { ZodType } from "zod";

import { ValidationError } from "./errors.js";

export type ValidatedRequestData = {
  query?: unknown;
  params?: unknown;
};

declare module "express-serve-static-core" {
  interface Request {
    validated?: ValidatedRequestData;
  }
}

function issues(error: {
  issues: Array<{ path: PropertyKey[]; code: string; message: string }>;
}) {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    code: issue.code,
    message: issue.message,
  }));
}

function parse<T>(schema: ZodType<T>, value: unknown) {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ValidationError("Invalid request", issues(result.error));
  }
  return result.data;
}

export function validateBody<T>(schema: ZodType<T>): RequestHandler {
  return (req, _res, next) => {
    req.body = parse(schema, req.body);
    next();
  };
}

export function validateQuery<T>(schema: ZodType<T>): RequestHandler {
  return (req, _res, next) => {
    req.validated = {
      ...req.validated,
      query: parse(schema, req.query),
    };
    next();
  };
}

export function validateParams<T>(schema: ZodType<T>): RequestHandler {
  return (req, _res, next) => {
    req.validated = {
      ...req.validated,
      params: parse(schema, req.params),
    };
    next();
  };
}

export type ValidatedRequest<
  TBody = unknown,
  TQuery = unknown,
  TParams = unknown,
> = Request & {
  body: TBody;
  validated?: {
    query?: TQuery;
    params?: TParams;
  };
};
