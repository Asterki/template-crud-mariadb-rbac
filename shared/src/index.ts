// Shared contracts used by both the server and the client.

// Hardcoded RBAC.
export * from "./rbac/index.js";

// Branding defaults.
export * from "./config/app.js";

// Explicit wire DTOs and Zod request schemas.
export * from "./dto/index.js";
export * from "./schemas/index.js";

// Namespaced API contracts.
export * as accountApi from "./api/accounts.js";
export * as authApi from "./api/auth.js";
export * as rolesApi from "./api/roles.js";
