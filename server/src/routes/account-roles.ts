import express from "express";

// Controllers
import createHandler from "../controllers/account-roles/create.js";
import updateHandler from "../controllers/account-roles/update.js";
import deleteHandler from "../controllers/account-roles/delete.js";
import getHandler from "../controllers/account-roles/get.js";
import listHandler from "../controllers/account-roles/list.js";
import restoreHandler from "../controllers/account-roles/restore.js";

// Middleware
import { validateBody } from "../http/validation.js";
import {
  ensureAuthenticated,
  ensurePermissions,
} from "../middleware/authMiddleware.js";

// Schemas
import { accountRoleSchemas } from "@template/shared";

const {
  getSchema,
  createSchema,
  deleteSchema,
  listSchema,
  updateSchema,
  restoreSchema,
} = accountRoleSchemas;

const router = express.Router();

// Apply global auth middleware
router.use(ensureAuthenticated);

// Create role
router.post(
  "/create",
  ensurePermissions(["account-roles:create"]),
  validateBody(createSchema),
  createHandler,
);

// Update role
router.post(
  "/update",
  ensurePermissions(["account-roles:update"]),
  validateBody(updateSchema),
  updateHandler,
);

// Delete role
router.post(
  "/delete",
  ensurePermissions(["account-roles:delete"]),
  validateBody(deleteSchema),
  deleteHandler,
);

// Restore role
router.post(
  "/restore",
  ensurePermissions(["account-roles:restore"]),
  validateBody(restoreSchema),
  restoreHandler,
);

// Get role(s)
router.post("/get", validateBody(getSchema), getHandler);

// List roles
router.post("/list", validateBody(listSchema), listHandler);

export default router;
