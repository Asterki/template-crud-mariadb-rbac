import { z } from "zod";

import { passwordSchema } from "./accounts.js";

export const loginAccountSchema = z.object({
  email: z.email("invalid-email"),
  password: z.string().min(1, "password-required").max(256),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "password-required").max(256),
    newPassword: passwordSchema,
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    message: "password-unchanged",
    path: ["newPassword"],
  });

export type LoginRequest = z.infer<typeof loginAccountSchema>;
export type ChangePasswordRequest = z.infer<typeof changePasswordSchema>;
