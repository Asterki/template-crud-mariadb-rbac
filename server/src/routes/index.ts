import type { Express } from "express";

import type { AccountService } from "../services/account-service.js";
import { createAccountsRouter } from "./accounts.js";
import { createAuthRouter } from "./auth.js";
import { createRolesRouter } from "./roles.js";

export type RouteDependencies = {
  accounts: AccountService;
};

export function registerRoutes(
  app: Express,
  { accounts }: RouteDependencies,
): void {
  app.use("/api/auth", createAuthRouter(accounts));
  app.use("/api/accounts", createAccountsRouter(accounts));
  app.use("/api/roles", createRolesRouter());
}
