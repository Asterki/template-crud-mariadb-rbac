import { createRequire } from "node:module";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const requireFromServer = createRequire(
  new URL("../../server/package.json", import.meta.url),
);
const mariadb = requireFromServer("mariadb") as {
  createConnection: (options: Record<string, unknown>) => Promise<{
    query: (sql: string, values?: unknown[]) => Promise<unknown>;
    end: () => Promise<void>;
  }>;
};

export type LegacyAccountRow = {
  id: string;
  email: string;
  name: string;
  password: string;
  status: string | null;
  createdAt: Date | string | null;
  roleName: string | null;
  roleLevel: number | null;
};

export type ExportedAccount = {
  id: string;
  email: string;
  name: string;
  password: string;
  role: "admin" | "manager" | "staff" | "viewer";
  status: "active" | "inactive";
  createdAt: string;
};

export function mapRole(
  roleName: string | null,
  roleLevel: number | null,
): ExportedAccount["role"] {
  const name = (roleName ?? "").trim().toLowerCase();

  if (roleLevel === -1 || name === "admin" || name.includes("admin")) {
    return "admin";
  }
  if (name.includes("manager") || name.includes("gerente")) {
    return "manager";
  }
  if (name.includes("staff") || name.includes("operador")) {
    return "staff";
  }
  return "viewer";
}

export function mapStatus(status: string | null): "active" | "inactive" {
  return status?.toLowerCase() === "active" ? "active" : "inactive";
}

export function toExportedAccount(row: LegacyAccountRow): ExportedAccount {
  return {
    id: row.id,
    email: row.email.toLowerCase(),
    name: row.name,
    password: row.password,
    role: mapRole(row.roleName, row.roleLevel),
    status: mapStatus(row.status),
    createdAt: row.createdAt
      ? new Date(row.createdAt).toISOString()
      : new Date(0).toISOString(),
  };
}

function parseArgs(argv: string[]) {
  const outIndex = argv.indexOf("--out");
  return {
    dryRun: argv.includes("--dry-run"),
    out: outIndex >= 0 ? argv[outIndex + 1] : "legacy-accounts.ndjson",
  };
}

function connectionOptions(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 3306,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: decodeURIComponent(parsed.pathname.replace(/^\//, "")),
    multipleStatements: false,
  };
}

function mappingTable(rows: ExportedAccount[]): string {
  const groups = new Map<
    string,
    { mapped: string; count: number }
  >();
  for (const row of rows) {
    const key = `${row.role}`;
    const current = groups.get(key);
    groups.set(key, {
      mapped: row.role,
      count: (current?.count ?? 0) + 1,
    });
  }

  const lines = [
    "Mapped role  Accounts",
    "-----------  --------",
    ...["admin", "manager", "staff", "viewer"].map(
      (role) =>
        `${role.padEnd(11)}  ${String(groups.get(role)?.count ?? 0).padStart(8)}`,
    ),
  ];
  return lines.join("\n");
}

async function main(): Promise<void> {
  const { dryRun, out } = parseArgs(process.argv.slice(2));
  const url = process.env.LEGACY_DATABASE_URL;
  if (!url) {
    throw new Error("LEGACY_DATABASE_URL is required");
  }

  const connection = await mariadb.createConnection(connectionOptions(url));

  try {
    await connection.query("START TRANSACTION READ ONLY");

    const rows = (await connection.query(`
      SELECT
        a.id,
        a.email,
        a.name,
        a.password,
        a.status,
        COALESCE(m.createdAt, a.lastPasswordChange) AS createdAt,
        r.name AS roleName,
        r.level AS roleLevel
      FROM Account a
      LEFT JOIN AccountRole r ON r.id = a.roleId
      LEFT JOIN Metadata m ON m.id = a.metadataId
    `)) as LegacyAccountRow[];

    await connection.query("COMMIT");

    const exported = rows.map(toExportedAccount);

    process.stdout.write(`${mappingTable(exported)}\n`);
    process.stdout.write(`Total accounts: ${exported.length}\n`);

    if (dryRun) {
      process.stdout.write("Dry run: no file written.\n");
      return;
    }

    const outputPath = path.resolve(process.cwd(), out);
    const ndjson = exported.map((row) => JSON.stringify(row)).join("\n");
    await writeFile(outputPath, ndjson.length > 0 ? `${ndjson}\n` : "", "utf8");
    process.stdout.write(`Wrote ${exported.length} accounts to ${outputPath}\n`);
  } finally {
    await connection.end();
  }
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (invokedDirectly) {
  main().catch((error: unknown) => {
    process.stderr.write(
      `Legacy export failed: ${error instanceof Error ? error.message : "unknown error"}\n`,
    );
    process.exitCode = 1;
  });
}
