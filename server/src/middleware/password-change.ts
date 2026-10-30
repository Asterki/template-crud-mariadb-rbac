import type { RequestHandler } from "express";

import { PasswordChangeRequiredError } from "../http/errors.js";

const ALLOWED = new Set([
  "GET /api/auth/me",
  "GET /api/auth/csrf",
  "POST /api/auth/login",
  "POST /api/auth/logout",
  "POST /api/auth/change-password",
]);

/**
 * While the account still uses a bootstrap password, only self-service auth
 * routes are reachable. Everything else fails closed with a stable code.
 */
export const enforcePasswordChange: RequestHandler = (req, _res, next) => {
  if (!req.user?.mustChangePassword) {
    next();
    return;
  }

  if (ALLOWED.has(`${req.method} ${req.path}`)) {
    next();
    return;
  }

  next(new PasswordChangeRequiredError());
};
