import type { RequestHandler } from "express";

import type { DocsService } from "../services/docs-service.js";

export type DocsControllerDependencies = {
  docs: DocsService;
};

export function createDocsController({ docs }: DocsControllerDependencies) {
  const list: RequestHandler = async (_req, res) => {
    res.setHeader("Cache-Control", "private, max-age=60");
    res.json(await docs.manifest());
  };

  const get: RequestHandler = async (req, res) => {
    const { slug } = req.params as { slug: string };
    res.setHeader("Cache-Control", "private, max-age=60");
    res.json(await docs.get(slug));
  };

  return { list, get };
}
