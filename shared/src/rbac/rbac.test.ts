import { describe, expect, it } from "vitest";

import { ROLE_PERMISSIONS } from "./matrix.js";
import { canAssignRole, canManage, roleHasPermission } from "./policy.js";
import { PERMISSIONS, type Permission } from "./permissions.js";
import { ROLE_RANK, ROLES, type Role } from "./roles.js";

const expected: Record<Role, readonly Permission[]> = {
  admin: PERMISSIONS,
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
};

describe("role permission matrix", () => {
  for (const role of ROLES) {
    for (const permission of PERMISSIONS) {
      it(`${role} ${expected[role].includes(permission) ? "has" : "lacks"} ${permission}`, () => {
        expect(roleHasPermission(role, permission)).toBe(
          expected[role].includes(permission),
        );
      });
    }
  }

  it("admin has every permission explicitly, without a wildcard", () => {
    expect(ROLE_PERMISSIONS.admin).toEqual([...PERMISSIONS]);
    for (const permission of PERMISSIONS) {
      expect(roleHasPermission("admin", permission)).toBe(true);
    }
    expect(PERMISSIONS).not.toContain("*");
  });

  it("viewer cannot read accounts", () => {
    expect(roleHasPermission("viewer", "accounts:read")).toBe(false);
  });

  it("staff can read accounts but cannot mutate them", () => {
    expect(roleHasPermission("staff", "accounts:read")).toBe(true);
    expect(roleHasPermission("staff", "accounts:create")).toBe(false);
    expect(roleHasPermission("staff", "accounts:update")).toBe(false);
  });
});

describe("management rules", () => {
  const rankOrder = [...ROLES].sort((a, b) => ROLE_RANK[a] - ROLE_RANK[b]);

  for (const actor of ROLES) {
    for (const target of ROLES) {
      it(`${actor} ${ROLE_RANK[actor] < ROLE_RANK[target] ? "can" : "cannot"} manage ${target}`, () => {
        expect(canManage(actor, target)).toBe(
          ROLE_RANK[actor] < ROLE_RANK[target],
        );
        expect(canAssignRole(actor, target)).toBe(
          ROLE_RANK[actor] < ROLE_RANK[target],
        );
      });
    }
  }

  it("admin cannot manage another admin", () => {
    expect(canManage("admin", "admin")).toBe(false);
  });

  it("manager cannot manage a manager or an admin", () => {
    expect(canManage("manager", "manager")).toBe(false);
    expect(canManage("manager", "admin")).toBe(false);
    expect(canManage("manager", "staff")).toBe(true);
  });

  it("ranks are ordered strongest to weakest", () => {
    expect(rankOrder).toEqual(["admin", "manager", "staff", "viewer"]);
  });
});
