#!/usr/bin/env node
/**
 * Guard against hardcoded user-facing text in React components.
 *
 * This is a heuristic check, not a parser. It catches the common regressions:
 * plain JSX text and quoted values on user-facing props. Run it manually with
 * `npm --prefix client run check:i18n`; it is intentionally not part of the
 * build so it cannot block a release on a false positive.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const srcDir = fileURLToPath(new URL("../src", import.meta.url));
const skipped = [/\.test\./, /routeTree\.gen\.ts$/, /\/locales\//, /\/i18n\//];

const attributes =
  /\b(title|label|placeholder|description|subTitle|alt|aria-label|okText|cancelText|content)\s*=\s*"([^"]+)"/g;
const jsxText = />\s*([A-Za-zÀ-ÿ][^<>{}]*?[A-Za-zÀ-ÿ0-9.!?])\s*</g;

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return walk(path);
    return path.endsWith(".tsx") ? [path] : [];
  });
}

const findings = [];

for (const path of walk(srcDir)) {
  const relativePath = relative(srcDir, path).replaceAll("\\", "/");
  if (skipped.some((pattern) => pattern.test(relativePath))) continue;

  const source = readFileSync(path, "utf8");
  const lines = source.split("\n");

  for (const [index, line] of lines.entries()) {
    for (const match of line.matchAll(attributes)) {
      findings.push(`${relativePath}:${index + 1}: ${match[0]}`);
    }
    for (const match of line.matchAll(jsxText)) {
      const text = match[1].trim();
      if (text.length > 2) {
        findings.push(`${relativePath}:${index + 1}: >${text}<`);
      }
    }
  }
}

if (findings.length > 0) {
  console.error("Hardcoded user-facing strings found:");
  for (const finding of findings) console.error(`  ${finding}`);
  process.exit(1);
}

console.log("No hardcoded user-facing strings found.");
