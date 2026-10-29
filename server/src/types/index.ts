import "express";
import type { Account, AccountRole } from "@prisma/client";

export type AccountWithRole = Account & {
  role: AccountRole;
};

// Add AccountWithRole to the req.user type
declare global {
  namespace Express {
    interface User extends AccountWithRole {}
  }
}
