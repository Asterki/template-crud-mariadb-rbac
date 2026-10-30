#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import net from "node:net";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const serverDir = join(root, "server");
const clientDir = join(root, "client");

const results = [];
function report(status, label, detail, fix) {
  results.push({ status, label, detail, fix });
}

function pass(label, detail) {
  report("ok", label, detail);
}
function warn(label, detail, fix) {
  report("warn", label, detail, fix);
}
function failed(label, detail, fix) {
  report("fail", label, detail, fix);
}

function output(result) {
  return `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
}

function tryRun(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    timeout: 20_000,
    ...options,
  });
}

function envFile() {
  return process.env.ENV_FILE
    ? resolve(root, process.env.ENV_FILE)
    : join(serverDir, ".env");
}

function parseEnvFile(path) {
  const values = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);
    if (!match) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value;
  }
  return values;
}

function checkNode() {
  const nvmrcPath = join(root, ".nvmrc");
  if (!existsSync(nvmrcPath)) {
    failed("Node version", ".nvmrc is missing", "Restore .nvmrc (expected 24).");
    return;
  }
  const expected = readFileSync(nvmrcPath, "utf8").trim();
  const actual = process.versions.node;
  const actualMajor = actual.split(".")[0];
  const expectedMajor = expected.replace(/^v/, "").split(".")[0];
  if (actualMajor === expectedMajor) {
    pass("Node version", `${actual} matches .nvmrc ${expected}`);
  } else {
    failed(
      "Node version",
      `${actual} does not match .nvmrc ${expected}`,
      `Install Node ${expected} (nvm use) and re-run.`,
    );
  }
}

function checkNpm() {
  const result = tryRun("npm", ["--version"], { timeout: 10_000 });
  if (result.error || result.status !== 0) {
    failed("npm", "npm is not available", "Install npm 10 or newer.");
    return;
  }
  const version = result.stdout.trim();
  const major = Number(version.split(".")[0]);
  if (Number.isFinite(major) && major >= 10) {
    pass("npm", version);
  } else {
    failed("npm", `${version} is too old`, "Install npm 10 or newer.");
  }
}

function checkEnvFiles() {
  const serverEnv = envFile();
  const clientEnv = join(clientDir, ".env");

  if (existsSync(serverEnv)) {
    pass("server env file", serverEnv);
  } else {
    failed(
      "server env file",
      `${serverEnv} is missing`,
      "cp server/.env.example server/.env and fill in the values.",
    );
  }

  if (existsSync(clientEnv)) {
    pass("client env file", clientEnv);
  } else {
    failed(
      "client env file",
      `${clientEnv} is missing`,
      "cp client/.env.example client/.env.",
    );
  }

  return existsSync(serverEnv) ? parseEnvFile(serverEnv) : null;
}

function checkRequiredEnv(env) {
  if (!env) return;

  const required = ["DATABASE_URL", "SESSION_SECRET"];
  for (const name of required) {
    if (!env[name]) failed(`env ${name}`, "is missing", `Set ${name} in the server env file.`);
  }

  if (env.DATABASE_URL) {
    try {
      const url = new URL(env.DATABASE_URL);
      if (url.protocol !== "mysql:" && url.protocol !== "mariadb:") {
        failed(
          "env DATABASE_URL",
          "must use mysql:// or mariadb://",
          "Use a mysql:// DSN; other engines are out of scope.",
        );
      } else if (!url.hostname || !url.pathname.replace(/^\//, "")) {
        failed(
          "env DATABASE_URL",
          "needs a host and a database name",
          "Use mysql://<user>:<password>@<host>:3306/<database>.",
        );
      } else {
        pass("env DATABASE_URL", `${url.hostname}:${url.port || 3306}/${url.pathname.replace(/^\//, "")}`);
      }
    } catch {
      failed(
        "env DATABASE_URL",
        "is not a valid URL",
        "Use mysql://<user>:<password>@<host>:3306/<database>.",
      );
    }
  }

  if (env.SESSION_SECRET && env.SESSION_SECRET.length < 32) {
    failed("env SESSION_SECRET", "is shorter than 32 characters", "Generate a longer random value.");
  } else if (env.SESSION_SECRET) {
    pass("env SESSION_SECRET", "present (value not printed)");
  }

  if (env.PORT && (!/^\d+$/.test(env.PORT) || Number(env.PORT) < 1 || Number(env.PORT) > 65535)) {
    failed("env PORT", "must be an integer from 1 to 65535", "Set a valid PORT.");
  }
  if (env.DB_POOL_LIMIT && (!/^\d+$/.test(env.DB_POOL_LIMIT) || Number(env.DB_POOL_LIMIT) < 1)) {
    failed("env DB_POOL_LIMIT", "must be a positive integer", "Set a valid pool size.");
  }
  if (env.CORS_ORIGINS) {
    const origins = env.CORS_ORIGINS.split(",").map((value) => value.trim()).filter(Boolean);
    for (const origin of origins) {
      try {
        new URL(origin);
      } catch {
        failed("env CORS_ORIGINS", `contains an invalid origin: ${origin}`, "Use comma-separated absolute URLs.");
        break;
      }
    }
  }
}

function checkSharedBuild() {
  const entry = join(root, "shared/dist/index.js");
  const types = join(root, "shared/dist/index.d.ts");
  if (existsSync(entry) && existsSync(types)) {
    pass("shared build", "shared/dist exists");
  } else {
    failed("shared build", "shared/dist is missing", "Run npm --prefix shared run build.");
  }
}

function canConnect(host, port, timeout = 1500) {
  return new Promise((resolvePromise) => {
    const socket = net.createConnection({ host, port });
    const finish = (value) => {
      socket.destroy();
      resolvePromise(value);
    };
    socket.setTimeout(timeout);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

async function handshake(url) {
  const requireFromServer = createRequire(join(serverDir, "package.json"));
  const adapterPath = requireFromServer.resolve("@prisma/adapter-mariadb");
  let PrismaMariaDb;
  try {
    ({ PrismaMariaDb } = requireFromServer("@prisma/adapter-mariadb"));
  } catch {
    ({ PrismaMariaDb } = await import(pathToFileURL(adapterPath).href));
  }

  const clientPath = requireFromServer.resolve("@prisma/client");
  let PrismaClient;
  try {
    ({ PrismaClient } = requireFromServer("@prisma/client"));
  } catch {
    ({ PrismaClient } = await import(pathToFileURL(clientPath).href));
  }

  const adapter = new PrismaMariaDb({
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\//, "")),
    connectionLimit: 1,
  });
  const client = new PrismaClient({ adapter });

  try {
    await client.$queryRawUnsafe("SELECT 1");
    return true;
  } finally {
    await client.$disconnect();
  }
}

async function checkDatabase(env) {
  if (!env?.DATABASE_URL) return;

  let url;
  try {
    url = new URL(env.DATABASE_URL);
  } catch {
    return;
  }

  const host = url.hostname;
  const port = url.port ? Number(url.port) : 3306;
  const reachable = await canConnect(host, port);
  if (!reachable) {
    failed(
      "database reachability",
      `cannot open a TCP connection to ${host}:${port}`,
      "Start MariaDB (docker compose -f compose.dev.yaml up -d mariadb) or fix DATABASE_URL.",
    );
    return;
  }
  pass("database reachability", `TCP connection to ${host}:${port} works`);

  if (!existsSync(join(serverDir, "node_modules/@prisma/adapter-mariadb"))) {
    warn(
      "database handshake",
      "Prisma adapter is not installed, skipping the SQL handshake",
      "Run npm run bootstrap.",
    );
    return;
  }

  try {
    await handshake(url);
    pass("database handshake", "SELECT 1 succeeded");
  } catch {
    failed(
      "database handshake",
      "MariaDB rejected the login or the query",
      "Check DATABASE_URL credentials and the user GRANTs. Values are not printed.",
    );
  }
}

function checkMigrations(env) {
  if (!env?.DATABASE_URL) return;
  const prisma = join(serverDir, "node_modules/.bin/prisma");
  if (!existsSync(prisma)) {
    failed("migration status", "Prisma CLI is not installed", "Run npm run bootstrap.");
    return;
  }

  const result = tryRun(prisma, ["migrate", "status"], {
    cwd: serverDir,
    env: { ...process.env, ...env },
  });
  const text = output(result).replace(/(?:mysql|mariadb):\/\/\S+/g, "[redacted-dsn]");
  if (result.status !== 0) {
    const line = text.split("\n").filter(Boolean).slice(-3).join(" | ");
    failed(
      "migration status",
      line || "prisma migrate status failed",
      "Check DATABASE_URL/MIGRATE_DATABASE_URL and run npm --prefix server run db:deploy.",
    );
    return;
  }

  if (/not yet been applied/i.test(text)) {
    failed(
      "migration status",
      "there are pending migrations",
      "Run npm --prefix server run db:deploy.",
    );
  } else if (/up to date/i.test(text)) {
    pass("migration status", "database schema is up to date");
  } else {
    warn("migration status", text.split("\n").filter(Boolean).slice(-1)[0] ?? "completed");
  }
}

async function checkPorts(env) {
  const apiPort = Number(env?.PORT ?? 3000);
  const apiInUse = await canConnect("127.0.0.1", apiPort);
  if (apiInUse) {
    pass(`port ${apiPort}`, "in use (API or another process is listening)");
  } else {
    warn(`port ${apiPort}`, "nothing is listening yet", "Start the API with npm --prefix server run dev.");
  }

  const dbInUse = await canConnect("127.0.0.1", 3306);
  if (dbInUse) {
    pass("port 3306", "in use (likely MariaDB)");
  } else {
    warn("port 3306", "nothing is listening", "Start MariaDB if it is expected on this host.");
  }
}

function checkDocker() {
  const result = tryRun("docker", ["info", "--format", "{{.ServerVersion}}"], {
    timeout: 10_000,
  });
  if (result.status === 0) {
    pass("Docker", `daemon ${result.stdout.trim()} is available`);
  } else {
    failed(
      "Docker",
      "the Docker daemon is not available",
      "Start Docker Desktop or the docker service.",
    );
  }
}

function printResults() {
  for (const result of results) {
    const prefix = result.status === "ok" ? "OK  " : result.status === "warn" ? "WARN" : "FAIL";
    console.log(`[${prefix}] ${result.label}: ${result.detail}`);
    if (result.fix) console.log(`       Fix: ${result.fix}`);
  }

  const failedCount = results.filter((result) => result.status === "fail").length;
  const warnCount = results.filter((result) => result.status === "warn").length;
  console.log("");
  console.log(
    `Summary: ${results.length - failedCount - warnCount} ok, ${warnCount} warnings, ${failedCount} failures.`,
  );
  if (failedCount > 0) process.exitCode = 1;
}

async function main() {
  console.log("[doctor] checking the repository");
  checkNode();
  checkNpm();
  const env = checkEnvFiles();
  checkRequiredEnv(env);
  checkSharedBuild();
  await checkDatabase(env);
  checkMigrations(env);
  await checkPorts(env);
  checkDocker();
  printResults();
}

main().catch((error) => {
  console.error(`[doctor] unexpected error: ${error instanceof Error ? error.message : "unknown"}`);
  process.exitCode = 1;
});
