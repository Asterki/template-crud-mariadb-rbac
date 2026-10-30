import { existsSync, statSync } from "node:fs";
import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { NotFoundError } from "../http/errors.js";

export const DOCS_SLUG_PATTERN = /^[a-z0-9-]{1,64}$/;

export type DocManifestEntry = {
  slug: string;
  title: string;
};

export type DocPage = {
  slug: string;
  title: string;
  markdown: string;
};

export type DocsServiceDependencies = {
  docsDir: string;
  cache?: boolean;
};

const serverRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

/**
 * Resolve the configured docs directory in source and bundled layouts.
 *
 * In development the process runs from `server/`, while `docs/` sits at the
 * repository root. In the container the working directory is `/app` and the
 * docs are copied to `/app/docs/in-app`.
 */
export function resolveDocsDir(configured: string): string {
  const candidates = path.isAbsolute(configured)
    ? [configured]
    : [
        path.resolve(process.cwd(), configured),
        path.resolve(serverRoot, configured),
        path.resolve(serverRoot, "..", configured),
      ];

  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isDirectory()) {
      return candidate;
    }
  }

  return candidates[0]!;
}

function isManifestEntry(value: unknown): value is DocManifestEntry {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as DocManifestEntry).slug === "string" &&
    DOCS_SLUG_PATTERN.test((value as DocManifestEntry).slug) &&
    typeof (value as DocManifestEntry).title === "string" &&
    (value as DocManifestEntry).title.trim().length > 0
  );
}

function inside(root: string, candidate: string): boolean {
  return candidate === root || candidate.startsWith(`${root}${path.sep}`);
}

/**
 * Read allowlisted markdown pages.
 *
 * The allowlist is `manifest.json` in the docs directory. Paths are resolved
 * with `realpath` and must stay inside the real docs directory, which rejects
 * `..`, encoded traversal that survives routing, absolute paths and symlinks
 * that escape the directory.
 */
export function createDocsService({
  docsDir,
  cache = process.env.NODE_ENV === "production",
}: DocsServiceDependencies) {
  const root = resolveDocsDir(docsDir);
  let manifestCache: DocManifestEntry[] | undefined;
  const pageCache = new Map<string, DocPage>();

  async function manifest(): Promise<DocManifestEntry[]> {
    if (cache && manifestCache) return manifestCache;

    const file = path.join(root, "manifest.json");
    let raw: string;
    try {
      raw = await readFile(file, "utf8");
    } catch {
      throw new NotFoundError("docs-manifest-not-found");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("Invalid in-app docs manifest");
    }

    if (!Array.isArray(parsed) || !parsed.every(isManifestEntry)) {
      throw new Error("Invalid in-app docs manifest");
    }

    const entries = parsed.map(({ slug, title }) => ({ slug, title }));
    if (cache) manifestCache = entries;
    return entries;
  }

  async function get(slug: string): Promise<DocPage> {
    if (!DOCS_SLUG_PATTERN.test(slug)) {
      throw new NotFoundError("doc-not-found");
    }

    if (cache) {
      const cached = pageCache.get(slug);
      if (cached) return cached;
    }

    const entries = await manifest();
    const entry = entries.find((item) => item.slug === slug);
    if (!entry) {
      throw new NotFoundError("doc-not-found");
    }

    const file = path.resolve(root, `${slug}.md`);

    let rootReal: string;
    let fileReal: string;
    try {
      rootReal = await realpath(root);
      fileReal = await realpath(file);
    } catch {
      throw new NotFoundError("doc-not-found");
    }

    if (!inside(rootReal, fileReal) || fileReal === rootReal) {
      throw new NotFoundError("doc-not-found");
    }

    let markdown: string;
    try {
      markdown = await readFile(fileReal, "utf8");
    } catch {
      throw new NotFoundError("doc-not-found");
    }

    const page: DocPage = { slug, title: entry.title, markdown };
    if (cache) pageCache.set(slug, page);
    return page;
  }

  return { manifest, get };
}

export type DocsService = ReturnType<typeof createDocsService>;
