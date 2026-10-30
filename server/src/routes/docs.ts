import { Router } from "express";

import { createDocsController } from "../controllers/docs.js";
import {
  requireAuthenticated,
  requirePermission,
} from "../middleware/require-permission.js";
import type { DocsService } from "../services/docs-service.js";

export function createDocsRouter(docs: DocsService): Router {
  const router = Router();
  const controller = createDocsController({ docs });

  router.get(
    "/",
    requireAuthenticated,
    requirePermission("docs:read"),
    controller.list,
  );

  router.get(
    "/:slug",
    requireAuthenticated,
    requirePermission("docs:read"),
    controller.get,
  );

  return router;
}
