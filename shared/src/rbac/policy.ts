import { ROLE_PERMISSIONS } from "./matrix.js";
import type { Permission } from "./permissions.js";
import { ROLE_RANK, type Role } from "./roles.js";

export function roleHasPermission(
  role: Role,
  permission: Permission,
): boolean {
  return (ROLE_PERMISSIONS[role] as readonly Permission[]).includes(permission);
}

/** True only when the actor ranks strictly above the target. */
export function canManage(actor: Role, target: Role): boolean {
  return ROLE_RANK[actor] < ROLE_RANK[target];
}

/** Roles can only assign roles they outrank. */
export function canAssignRole(actor: Role, newRole: Role): boolean {
  return ROLE_RANK[actor] < ROLE_RANK[newRole];
}
