import { z } from "zod";

import { ROLES } from "../rbac/roles.js";
import { pageSchema, pageSizeSchema } from "./pagination.js";

export const accountIdSchema = z.string().min(1).max(191);

const emailSchema = z.email("invalid-email");
const nameSchema = z
  .string()
  .min(1, "name-too-short")
  .max(100, "name-too-long");

export const passwordSchema = z
  .string()
  .min(12, "password-too-short")
  .max(256, "password-too-long");

const optionalBooleanQuery = z.preprocess(
  (value) =>
    value === "true" ? true : value === "false" ? false : undefined,
  z.boolean().optional(),
);

export const createAccountSchema = z.object({
  email: emailSchema,
  name: nameSchema,
  password: passwordSchema,
  role: z.enum(ROLES, "invalid-role"),
});

export const updateAccountSchema = z
  .object({
    email: emailSchema.optional(),
    name: nameSchema.optional(),
    role: z.enum(ROLES, "invalid-role").optional(),
  })
  .refine((value) => Object.values(value).some((v) => v !== undefined), {
    message: "no-fields",
  });

export const setAccountStatusSchema = z.object({
  status: z.enum(["active", "inactive"], "invalid-status"),
});

export const setAccountPasswordSchema = z.object({
  newPassword: passwordSchema,
});

export const listAccountsQuerySchema = z.object({
  page: pageSchema,
  pageSize: pageSizeSchema,
  search: z.string().max(100, "query-too-long").optional(),
  role: z.enum(ROLES, "invalid-role").optional(),
  status: z.enum(["active", "inactive"], "invalid-status").optional(),
  includeDeleted: optionalBooleanQuery,
});

export type CreateAccountRequest = z.infer<typeof createAccountSchema>;
export type UpdateAccountRequest = z.infer<typeof updateAccountSchema>;
export type SetAccountStatusRequest = z.infer<typeof setAccountStatusSchema>;
export type SetAccountPasswordRequest = z.infer<typeof setAccountPasswordSchema>;
export type ListAccountsQuery = z.infer<typeof listAccountsQuerySchema>;
