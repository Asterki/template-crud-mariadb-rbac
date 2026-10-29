// Shared contracts used by both the server and the client.

// API response/request contracts.
export type { ResponseStatus } from "./api/index.js";
export * as accountApi from "./api/accounts.js";
export * as accountRoleApi from "./api/account-roles.js";
export * as authApi from "./api/auth.js";

// Zod schemas.
export * from "./schemas/index.js";
export * as accountSchemas from "./schemas/accounts.js";
export * as accountRoleSchemas from "./schemas/account-roles.js";
export * as authSchemas from "./schemas/auth.js";
export * as fileSchemas from "./schemas/files.js";
export * as logSchemas from "./schemas/logs.js";

// Domain types.
export type { Permission } from "./types/permissions.js";
export type { ISessionAccount } from "./types/sessions.js";
export type { DeepPartial, DeepNullablePartial } from "./types/custom.js";
export type {
  CampusCode,
  DeliveryMode,
  DocumentCategory,
  SourceType,
} from "./models/index.js";
export type { IAccount } from "./models/account.js";
export type { IAccountRole } from "./models/account-role.js";
export type { IMetadata } from "./models/metadata.js";
export type { IMetadataUpdateHistory } from "./models/metadata-update-history.js";
export type { ILog } from "./models/log.js";

// Permission catalogue (default export kept for the existing client code).
export { default as permissions } from "./constants/permissions.js";
