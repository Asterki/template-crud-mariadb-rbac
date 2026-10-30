import type { AccountDto } from "../dto/accounts.js";
import type { DataResponse, Paginated } from "../dto/pagination.js";
import type {
  CreateAccountRequest,
  ListAccountsQuery,
  SetAccountPasswordRequest,
  SetAccountStatusRequest,
  UpdateAccountRequest,
} from "../schemas/accounts.js";

export type {
  CreateAccountRequest,
  ListAccountsQuery,
  SetAccountPasswordRequest,
  SetAccountStatusRequest,
  UpdateAccountRequest,
};

export type AccountResponse = DataResponse<AccountDto>;
export type AccountListResponse = Paginated<AccountDto>;
