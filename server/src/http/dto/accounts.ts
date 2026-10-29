import type { AccountDto } from "@template/shared";

type AccountRecord = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "manager" | "staff" | "viewer";
  status: "active" | "inactive";
  mustChangePassword: boolean;
  lastLogin: Date | null;
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    deleted: boolean;
  } | null;
};

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

/** Map a database row to the public account shape. Never include the hash. */
export function toAccountDto(account: AccountRecord): AccountDto {
  return {
    id: account.id,
    email: account.email,
    name: account.name,
    role: account.role,
    status: account.status,
    mustChangePassword: account.mustChangePassword,
    lastLogin: iso(account.lastLogin),
    createdAt:
      account.metadata?.createdAt.toISOString() ?? new Date(0).toISOString(),
    updatedAt:
      account.metadata?.updatedAt.toISOString() ?? new Date(0).toISOString(),
    deleted: account.metadata?.deleted ?? false,
  };
}
