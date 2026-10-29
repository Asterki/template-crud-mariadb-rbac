import { Permission } from "@template/shared";

export const hasPermissions = (
  accountPermissions: Permission[],
  permissions: Permission[],
): boolean => {
  if (accountPermissions.includes("*")) return true;

  const requestedPermissions = Array.isArray(permissions)
    ? permissions
    : [permissions];

  return requestedPermissions.some((permission) =>
    accountPermissions.includes(permission),
  );
};
