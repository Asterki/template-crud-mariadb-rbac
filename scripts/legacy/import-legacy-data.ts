import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import path from "node:path";

const requireFromServer = createRequire(
  new URL("../../server/package.json", import.meta.url),
);
const { PrismaClient } = requireFromServer("@prisma/client") as {
  PrismaClient: new (options: { adapter: unknown }) => {
    account: {
      findFirst: (args: unknown) => Promise<unknown>;
      create: (args: unknown) => Promise<unknown>;
    };
    metadata: { create: (args: unknown) => Promise<{ id: string }> };
    $transaction: <T>(fn: (tx: unknown) => Promise<T>) => Promise<T>;
    $disconnect: () => Promise<void>;
  };
};
const { PrismaMariaDb } = requireFromServer("@prisma/adapter-mariadb") as {
  PrismaMariaDb: new (options: Record<string, unknown>) => unknown;
};

type ImportedAccount = {
  id: string;
  email: string;
  name: string;
  password: string;
  role: string;
  status: string;
  createdAt: string;
};

const ROLES = new Set(["admin", "manager", "staff", "viewer"]);
const STATUSES = new Set(["active", "inactive"]);

function parseArgs(argv: string[]) {
  const fileIndex = argv.indexOf("--file");
  return {
    dryRun: argv.includes("--dry-run"),
    file: fileIndex >= 0 ? argv[fileIndex + 1] : "legacy-accounts.ndjson",
  };
}

function parseUrl(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 3306,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: decodeURIComponent(parsed.pathname.replace(/^\//, "")),
    connectionLimit: 2,
  };
}

function parseLines(contents: string): ImportedAccount[] {
  return contents
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const row = JSON.parse(line) as ImportedAccount;
      if (!row.id || !row.email || !row.password) {
        throw new Error(`Invalid NDJSON record on line ${index + 1}`);
      }
      if (!ROLES.has(row.role)) {
        throw new Error(`Unknown role on line ${index + 1}: ${row.role}`);
      }
      if (!STATUSES.has(row.status)) {
        throw new Error(`Unknown status on line ${index + 1}: ${row.status}`);
      }
      return row;
    });
}

async function main(): Promise<void> {
  const { dryRun, file } = parseArgs(process.argv.slice(2));
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const accounts = parseLines(
    await readFile(path.resolve(process.cwd(), file), "utf8"),
  );

  if (dryRun) {
    process.stdout.write(
      `Dry run: ${accounts.length} accounts read from ${file}; no rows written.\n`,
    );
    return;
  }

  const prisma = new PrismaClient({
    adapter: new PrismaMariaDb(parseUrl(databaseUrl)),
  });

  let imported = 0;
  let skipped = 0;

  try {
    for (const row of accounts) {
      const existing = await prisma.account.findFirst({
        where: { OR: [{ id: row.id }, { email: row.email }] },
        select: { id: true },
      });
      if (existing) {
        skipped += 1;
        continue;
      }

      await prisma.$transaction(async (tx) => {
        const transaction = tx as {
          metadata: { create: (args: unknown) => Promise<{ id: string }> };
          account: { create: (args: unknown) => Promise<unknown> };
        };
        const createdAt = new Date(row.createdAt);
        const metadata = await transaction.metadata.create({
          data: { createdAt, updatedAt: createdAt },
        });
        await transaction.account.create({
          data: {
            id: row.id,
            email: row.email.toLowerCase(),
            name: row.name,
            password: row.password,
            role: row.role,
            status: row.status,
            mustChangePassword: true,
            metadataId: metadata.id,
          },
        });
      });

      imported += 1;
    }
  } finally {
    await prisma.$disconnect();
  }

  process.stdout.write(
    `Imported ${imported} accounts, skipped ${skipped} existing accounts.\n`,
  );
}

main().catch((error: unknown) => {
  process.stderr.write(
    `Legacy import failed: ${error instanceof Error ? error.message : "unknown error"}\n`,
  );
  process.exitCode = 1;
});
