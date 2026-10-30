import { Router } from "express";

import { listRoles } from "../controllers/roles.js";
import {
  requireAuthenticated,
  requirePermission,
} from "../middleware/require-permission.js";

export function createRolesRouter(): Router {
  const router = Router();

  router.get(
    "/",
    requireAuthenticated,
    requirePermission("roles:read"),
    listRoles,
  );

  return router;
}
