import express from "express";

import createHandler from "../controllers/accounts/create.js";
import getHandler from "../controllers/accounts/get.js";
import listHandler from "../controllers/accounts/list.js";
import updateHandler from "../controllers/accounts/update.js";
import deleteHandler from "../controllers/accounts/delete.js";
import restoreHandler from "../controllers/accounts/restore.js";
import updatePasswordHandler from "../controllers/accounts/update-password.js";
import updateStatusHandler from "../controllers/accounts/update-status.js";

import { validateBody } from "../http/validation.js";
import {
  ensureAuthenticated,
  ensurePermissions,
} from "../middleware/authMiddleware.js";

const router = express.Router();

// Import the schemas and types
import { accountSchemas } from "@template/shared";

const {
  createSchema,
  deleteSchema,
  getSchema,
  updateSchema,
  listSchema,
  updatePasswordSchema,
  updateStatusSchema,
} = accountSchemas;

// Apply global middlewares
router.use(ensureAuthenticated);

// Routes with their schemas
router.post(
  "/create",
  ensurePermissions(["accounts:create"]),
  validateBody(createSchema),
  createHandler,
);

router.post(
  "/update",
  ensurePermissions(["accounts:update"]),
  validateBody(updateSchema),
  updateHandler,
);

router.post(
  "/update-status",
  ensurePermissions(["accounts:update-status"]),
  validateBody(updateStatusSchema),
  updateStatusHandler,
);

router.post(
  "/update-password",
  ensurePermissions(["accounts:change-password"]),
  validateBody(updatePasswordSchema),
  updatePasswordHandler,
);

router.post(
  "/delete",
  ensurePermissions(["accounts:delete"]),
  validateBody(deleteSchema),
  deleteHandler,
);

router.post(
  "/restore",
  ensurePermissions(["accounts:restore"]),
  validateBody(deleteSchema),
  restoreHandler,
);

router.post("/get", validateBody(getSchema), getHandler);

router.post("/list", validateBody(listSchema), listHandler);

export default router;
