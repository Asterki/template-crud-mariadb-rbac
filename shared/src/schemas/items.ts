import { z } from "zod";

import { pageSchema, pageSizeSchema } from "./pagination.js";

export const ITEM_STATUSES = ["active", "archived"] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

const itemNameSchema = z
  .string()
  .trim()
  .min(1, "name-too-short")
  .max(120, "name-too-long");

const itemDescriptionSchema = z
  .string()
  .max(2000, "description-too-long")
  .optional();

const optionalBooleanQuery = z.preprocess(
  (value) => (value === "true" ? true : value === "false" ? false : undefined),
  z.boolean().optional(),
);

export const createItemSchema = z.object({
  name: itemNameSchema,
  description: itemDescriptionSchema,
});

export const updateItemSchema = z
  .object({
    name: itemNameSchema.optional(),
    description: itemDescriptionSchema,
    status: z.enum(ITEM_STATUSES, "invalid-status").optional(),
  })
  .refine((value) => Object.values(value).some((v) => v !== undefined), {
    message: "no-fields",
  });

export const listItemsQuerySchema = z.object({
  page: pageSchema,
  pageSize: pageSizeSchema,
  q: z.string().max(100, "query-too-long").optional(),
  status: z.enum(ITEM_STATUSES, "invalid-status").optional(),
  includeDeleted: optionalBooleanQuery,
});

export type CreateItemRequest = z.infer<typeof createItemSchema>;
export type UpdateItemRequest = z.infer<typeof updateItemSchema>;
export type ListItemsQuery = z.infer<typeof listItemsQuerySchema>;
