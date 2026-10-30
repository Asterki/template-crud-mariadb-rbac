import type { Request, RequestHandler } from "express";

import type { AccountService } from "../services/account-service.js";
import type { AccountActor } from "../services/account-service.js";

export function actorFrom(req: Request): AccountActor {
  if (!req.user) {
    throw new Error("actorFrom called without an authenticated request");
  }
  return { id: req.user.id, role: req.user.role };
}

export type ControllerDependencies = {
  accounts: AccountService;
};

export function controller(handler: RequestHandler): RequestHandler {
  return handler;
}
