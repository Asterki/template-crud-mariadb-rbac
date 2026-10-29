import type { ReactNode } from "react";
import type { Permission } from "@template/shared";

import { useCan } from "./useCan";

type CanProps = {
  permission: Permission;
  children: ReactNode;
  fallback?: ReactNode;
};

export function Can({ permission, children, fallback = null }: CanProps) {
  const { can } = useCan();
  return can(permission) ? children : fallback;
}
