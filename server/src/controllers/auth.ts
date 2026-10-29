import { randomBytes } from "node:crypto";
import type { RequestHandler } from "express";
import passport from "passport";
import type { ChangePasswordRequest } from "@template/shared";

import { toSessionAccountDto } from "../http/dto/accounts.js";
import { UnauthorizedError } from "../http/errors.js";
import type { AccountService } from "../services/account-service.js";

function csrfCookieName(): string {
  return process.env.NODE_ENV === "production" ? "__Host-csrf" : "csrf";
}

export function createAuthController(accounts: AccountService) {
  const login: RequestHandler = (req, res, next) => {
    passport.authenticate(
      "local",
      { session: false },
      (
        error: unknown,
        user: Express.User | false,
        info?: { message?: string },
      ) => {
        if (error) {
          next(error);
          return;
        }
        if (!user) {
          next(new UnauthorizedError(info?.message ?? "invalid-credentials"));
          return;
        }

        req.logIn(user, (loginError) => {
          if (loginError) {
            next(loginError);
            return;
          }
          if (!req.user) {
            next(new UnauthorizedError("invalid-credentials"));
            return;
          }
          res.json({ data: toSessionAccountDto(req.user) });
        });
      },
    )(req, res, next);
  };

  const csrf: RequestHandler = (_req, res) => {
    const csrfToken = randomBytes(32).toString("hex");
    const secure = process.env.NODE_ENV === "production";

    res.cookie(csrfCookieName(), csrfToken, {
      httpOnly: false,
      secure,
      sameSite: "lax",
      path: "/",
    });
    res.setHeader("Cache-Control", "no-store");
    res.json({ csrfToken });
  };

  const logout: RequestHandler = (req, res, next) => {
    req.logout((error) => {
      if (error) {
        next(error);
        return;
      }
      res.json({ data: { success: true } });
    });
  };

  const me: RequestHandler = (req, res) => {
    if (!req.user) {
      throw new UnauthorizedError("unauthenticated");
    }
    res.json({ data: toSessionAccountDto(req.user) });
  };

  const changePassword: RequestHandler = async (req, res) => {
    if (!req.user) {
      throw new UnauthorizedError("unauthenticated");
    }
    const body = req.body as ChangePasswordRequest;
    const updated = await accounts.changeOwnPassword(
      req.user.id,
      body.currentPassword,
      body.newPassword,
    );
    res.json({ data: toSessionAccountDto(updated) });
  };

  return { login, csrf, logout, me, changePassword };
}
