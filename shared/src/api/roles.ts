import type { RolePermissionsEntry } from "../dto/accounts.js";
import type { DataResponse } from "../dto/pagination.js";

export type RolesResponse = DataResponse<RolePermissionsEntry[]>;
