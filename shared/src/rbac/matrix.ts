import type { Permission } from "./permissions.js";
import { PERMISSIONS } from "./permissions.js";
import type { Role } from "./roles.js";

export const ROLE_PERMISSIONS = {
  admin: [...PERMISSIONS],
  manager: [
    "accounts:read",
    "accounts:create",
    "accounts:update",
    "accounts:update-status",
    "accounts:change-password",
    "accounts:delete",
    "accounts:restore",
    "items:read",
    "items:create",
    "items:update",
    "items:delete",
    "items:restore",
    "roles:read",
    "docs:read",
  ],
  staff: [
    "accounts:read",
    "items:read",
    "items:create",
    "items:update",
    "roles:read",
  ],
  viewer: ["items:read"],
} as const satisfies Record<Role, readonly Permission[]>;
