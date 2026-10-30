import { timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";

import type { AppConfig } from "../config/index.js";
import { ForbiddenError } from "../http/errors.js";

function matches(expected: string, actual: string | undefined): boolean {
  if (actual === undefined) {
    return false;
  }
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);
  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }
  return timingSafeEqual(expectedBuffer, actualBuffer);
}

/**
 * Optional shared secret for the proxy in front of the API.
 *
 * When unset the check is skipped, which keeps local development and tests
 * working. Health endpoints are mounted outside `/api` and stay exempt.
 */
export function originSecret(
  config: Pick<AppConfig, "originSecret">,
): RequestHandler {
  const expected = config.originSecret;
  if (!expected) {
    return (_req, _res, next) => next();
  }

  return (req, _res, next) => {
    if (!matches(expected, req.get("x-origin-secret"))) {
      next(new ForbiddenError("invalid-origin-secret"));
      return;
    }
    next();
  };
}
