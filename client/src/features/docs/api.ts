import { api } from "../../utils/api";

export type DocManifestEntry = {
  slug: string;
  title: string;
};

export type DocPage = {
  slug: string;
  title: string;
  markdown: string;
};

export const docsApi = {
  manifest() {
    return api.get<DocManifestEntry[]>("/docs");
  },
  get(slug: string) {
    return api.get<DocPage>(`/docs/${encodeURIComponent(slug)}`);
  },
};
