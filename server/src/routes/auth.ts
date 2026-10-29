import { Router } from "express";
import { changePasswordSchema, loginAccountSchema } from "@template/shared";

import { createAuthController } from "../controllers/auth.js";
import { validateBody } from "../http/validation.js";
import { requireAuthenticated } from "../middleware/require-permission.js";
import type { AccountService } from "../services/account-service.js";

export function createAuthRouter(accounts: AccountService): Router {
  const router = Router();
  const controller = createAuthController(accounts);

  router.post("/login", validateBody(loginAccountSchema), controller.login);
  router.get("/csrf", controller.csrf);
  router.post("/logout", requireAuthenticated, controller.logout);
  router.get("/me", requireAuthenticated, controller.me);
  router.post(
    "/change-password",
    requireAuthenticated,
    validateBody(changePasswordSchema),
    controller.changePassword,
  );

  return router;
}
