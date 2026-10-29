import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { NotFoundError } from "../http/errors.js";
import { createDocsService } from "./docs-service.js";

const directories: string[] = [];

function docsFixture(manifest: Array<{ slug: string; title: string }>) {
  const root = mkdtempSync(path.join(tmpdir(), "docs-service-"));
  directories.push(root);
  mkdirSync(root, { recursive: true });
  writeFileSync(path.join(root, "manifest.json"), JSON.stringify(manifest));
  return root;
}

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("docs service", () => {
  it("serves manifest entries and markdown", async () => {
    const root = docsFixture([{ slug: "index", title: "Home" }]);
    writeFileSync(path.join(root, "index.md"), "# Hello\n");
    const service = createDocsService({ docsDir: root, cache: false });

    await expect(service.manifest()).resolves.toEqual([
      { slug: "index", title: "Home" },
    ]);
    await expect(service.get("index")).resolves.toEqual({
      slug: "index",
      title: "Home",
      markdown: "# Hello\n",
    });
  });

  it("rejects slugs outside the allowlist and unknown pages", async () => {
    const root = docsFixture([{ slug: "index", title: "Home" }]);
    writeFileSync(path.join(root, "index.md"), "# Hello\n");
    writeFileSync(path.join(root, "not-allowed.md"), "# Secret\n");
    const service = createDocsService({ docsDir: root, cache: false });

    for (const slug of [
      "..",
      "../index",
      "%2e%2e%2findex",
      "/etc/passwd",
      "index\0",
      "not-allowed",
    ]) {
      await expect(service.get(slug)).rejects.toBeInstanceOf(NotFoundError);
    }
  });

  it("rejects a symlink that escapes the docs directory", async () => {
    const root = docsFixture([{ slug: "evil", title: "Evil" }]);
    const outside = mkdtempSync(path.join(tmpdir(), "docs-outside-"));
    directories.push(outside);
    writeFileSync(path.join(outside, "secret.md"), "# Secret\n");
    symlinkSync(path.join(outside, "secret.md"), path.join(root, "evil.md"));

    const service = createDocsService({ docsDir: root, cache: false });
    await expect(service.get("evil")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("caches pages when caching is enabled", async () => {
    const root = docsFixture([{ slug: "index", title: "Home" }]);
    const file = path.join(root, "index.md");
    writeFileSync(file, "# First\n");
    const service = createDocsService({ docsDir: root, cache: true });

    await expect(service.get("index")).resolves.toMatchObject({
      markdown: "# First\n",
    });
    writeFileSync(file, "# Second\n");
    await expect(service.get("index")).resolves.toMatchObject({
      markdown: "# First\n",
    });
  });
});
