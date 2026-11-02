import type { Role } from "@unah-poa-pacc/shared";

import { can } from "../../rbac/can";

/** The docs navigation entry is shown only when the API would allow the page. */
export function docsNavVisible(role: Role | null | undefined): boolean {
  return can(role, "docs:read");
}
