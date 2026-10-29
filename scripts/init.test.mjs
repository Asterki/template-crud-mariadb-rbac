import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const sourceRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const initialized = existsSync(path.join(sourceRoot, ".template-initialized"));
const copies = [];

function run(command, args, cwd) {
  return spawnSync(command, args, { cwd, encoding: "utf8" });
}

function makeCopy() {
  const directory = mkdtempSync(path.join(tmpdir(), "template-init-"));
  copies.push(directory);

  cpSync(sourceRoot, directory, {
    recursive: true,
    filter(source) {
      const base = path.basename(source);
      if (["node_modules", ".git", "dist", "coverage", "site", ".vite"].includes(base)) {
        return false;
      }
      if (base === ".env") return false;
      if (base.startsWith(".env.") && !base.endsWith(".example")) return false;
      return true;
    },
  });

  assert.equal(run("git", ["init", "-q"], directory).status, 0);
  assert.equal(run("git", ["config", "user.email", "test@example.test"], directory).status, 0);
  assert.equal(run("git", ["config", "user.name", "Test"], directory).status, 0);
  assert.equal(run("git", ["add", "-A"], directory).status, 0);
  assert.equal(run("git", ["commit", "-qm", "chore: baseline"], directory).status, 0);
  return directory;
}

function init(directory, args) {
  return run(process.execPath, ["scripts/init.mjs", ...args], directory);
}

function status(directory) {
  return run("git", ["status", "--porcelain"], directory).stdout.trim();
}

after(() => {
  for (const directory of copies) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("init", { skip: initialized ? "repository already initialized" : false }, () => {
  it("dry run writes nothing", () => {
    const directory = makeCopy();
    const result = init(directory, [
      "--name",
      "Acme",
      "--slug",
      "acme",
      "--yes",
      "--no-db",
      "--no-install",
      "--dry-run",
    ]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /would update shared\/src\/config\/app\.ts/);
    assert.equal(status(directory), "");
    assert.equal(existsSync(path.join(directory, ".template-initialized")), false);
    assert.equal(existsSync(path.join(directory, "server/.env")), false);
  });

  it("validates the slug", () => {
    const directory = makeCopy();
    const result = init(directory, [
      "--name",
      "Acme",
      "--slug",
      "Bad_Slug",
      "--yes",
      "--no-db",
      "--no-install",
    ]);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /--slug/);
    assert.equal(existsSync(path.join(directory, ".template-initialized")), false);
  });

  it("leaves the planning archive untouched", () => {
    const directory = makeCopy();
    const archive = path.join(directory, "docs/archive/PLAN.md");
    const before = readFileSync(archive, "utf8");
    const result = init(directory, [
      "--name",
      "Acme",
      "--slug",
      "acme",
      "--yes",
      "--no-db",
      "--no-install",
    ]);

    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(archive, "utf8"), before);
  });

  it("writes the marker once and refuses a second run", () => {
    const directory = makeCopy();
    const args = [
      "--name",
      "Acme",
      "--slug",
      "acme",
      "--yes",
      "--no-db",
      "--no-install",
      "--repo",
      "https://github.com/acme/acme",
    ];
    const first = init(directory, args);
    assert.equal(first.status, 0, first.stderr);

    const marker = JSON.parse(
      readFileSync(path.join(directory, ".template-initialized"), "utf8"),
    );
    assert.equal(marker.slug, "acme");
    assert.equal(marker.name, "Acme");
    assert.equal(marker.title, "Acme");
    assert.equal(existsSync(path.join(directory, "server/.env")), true);
    assert.equal(existsSync(path.join(directory, "client/.env")), true);

    const appConfig = readFileSync(
      path.join(directory, "shared/src/config/app.ts"),
      "utf8",
    );
    assert.match(appConfig, /APP_NAME = "Acme"/);
    assert.match(appConfig, /APP_SLUG = "acme"/);
    assert.match(readFileSync(path.join(directory, "client/index.html"), "utf8"), /<title>Acme<\/title>/);
    assert.match(readFileSync(path.join(directory, "mkdocs.yml"), "utf8"), /site_name: Acme/);

    const second = init(directory, args);
    assert.equal(second.status, 1);
    assert.match(second.stderr, /already initialized/);

    const forced = init(directory, [...args, "--force"]);
    assert.equal(forced.status, 0, forced.stderr);
  });
});
