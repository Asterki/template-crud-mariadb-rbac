import type { Account } from "@prisma/client";

declare global {
  namespace Express {
    interface User extends Account {}
  }
}

export {};
