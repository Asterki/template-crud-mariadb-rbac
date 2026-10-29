// Slice
import slice, { login, logout, fetch } from "./slice";

// API
import { authApi as AuthAPITypes } from "@template/shared";
import { authSchemas as schemas } from "@template/shared";
import authApi from "./api";

export type { AuthAPITypes };
export default {
  slice,
  authApi,
  actions: {
    login,
    logout,
    fetch,
  },
  schemas,
};
