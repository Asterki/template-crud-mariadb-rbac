import type { Express } from "express";

import type { AppConfig } from "../config/index.js";
import type { AccountService } from "../services/account-service.js";
import type { ItemService } from "../services/item-service.js";
import { createAccountsRouter } from "./accounts.js";
import { createAuthRouter } from "./auth.js";
import { createItemsRouter } from "./items.js";
import { createRolesRouter } from "./roles.js";

export type RouteDependencies = {
  accounts: AccountService;
  items: ItemService;
  config: AppConfig;
};

export function registerRoutes(
  app: Express,
  { accounts, items, config }: RouteDependencies,
): void {
  app.use("/api/auth", createAuthRouter(accounts, config));
  app.use("/api/accounts", createAccountsRouter(accounts));
  app.use("/api/items", createItemsRouter(items));
  app.use("/api/roles", createRolesRouter());
}
