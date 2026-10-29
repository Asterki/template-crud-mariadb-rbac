export const ROLES = ["admin", "manager", "staff", "viewer"] as const;

export type Role = (typeof ROLES)[number];

/** Lower rank means a stronger role. */
export const ROLE_RANK = {
  admin: 0,
  manager: 1,
  staff: 2,
  viewer: 3,
} as const satisfies Record<Role, number>;

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}
