import { rolesApi } from "@template/shared";

import { api } from "../../utils/api";

export const rolesApiClient = {
  async list() {
    return api.get<rolesApi.RolesResponse>("/roles");
  },
};

export default rolesApiClient;
