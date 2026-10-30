#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import {
  existsSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dryRun = process.argv.includes("--dry-run");
const serverDir = join(root, "server");

const exampleFiles = [
  "shared/src/schemas/items.ts",
  "shared/src/api/items.ts",
  "server/src/services/item-service.ts",
  "server/src/controllers/items.ts",
  "server/src/routes/items.ts",
  "server/src/http/dto/items.ts",
  "server/test/items.test.ts",
  "client/src/routes/admin/items.tsx",
  "client/src/features/items",
];

const changes = [];

function logChange(type, path, detail) {
  changes.push({ type, path, detail });
}

function listFiles(path) {
  const full = join(root, path);
  if (!existsSync(full)) return [];
  if (statSync(full).isFile()) return [path];

  return readdirSync(full).flatMap((entry) => {
    const child = join(path, entry);
    return statSync(join(root, child)).isDirectory()
      ? listFiles(child)
      : [child];
  });
}

function removePath(path) {
  const files = listFiles(path);
  if (files.length === 0) return;
  for (const file of files) {
    logChange("delete", file);
    if (!dryRun) rmSync(join(root, file), { force: true });
  }
  if (!dryRun) rmSync(join(root, path), { recursive: true, force: true });
}

/** Remove a brace-delimited block that starts at the beginning of a line. */
function removeBraceBlock(text, marker) {
  let start = -1;
  let from = 0;
  while ((from = text.indexOf(marker, from)) !== -1) {
    if (from === 0 || text[from - 1] === "\n") {
      start = from;
      break;
    }
    from += 1;
  }
  if (start === -1) return text;

  let depth = 0;
  let index = start;
  for (; index < text.length; index += 1) {
    if (text[index] === "{") depth += 1;
    if (text[index] === "}") {
      depth -= 1;
      if (depth === 0) {
        index += 1;
        break;
      }
    }
  }

  if (text[index] === ",") index += 1;
  if (text[index] === "\n") index += 1;
  if (text[index] === "\n") index += 1;

  return text.slice(0, start) + text.slice(index);
}

function editFile(path, edits) {
  const full = join(root, path);
  if (!existsSync(full)) return;

  let text = readFileSync(full, "utf8");
  for (const edit of edits) {
    const next = edit.run(text);
    if (next === text) continue;
    logChange("edit", path, edit.label);
    text = next;
  }

  if (!dryRun) writeFileSync(full, text);
}

function replace(pattern, replacement, label) {
  return { label, run: (text) => text.replace(pattern, replacement) };
}

function removeBrace(marker, label) {
  return { label, run: (text) => removeBraceBlock(text, marker) };
}

for (const path of exampleFiles) removePath(path);

editFile("shared/src/schemas/index.ts", [
  replace('export * from "./items.js";\n', "", "remove items schema export"),
]);

editFile("shared/src/api/index.ts", [
  replace('export * from "./items.js";\n', "", "remove items API export"),
]);

editFile("shared/src/index.ts", [
  replace(
    /export type \{[^}]*ItemDto[^}]*\} from "\.\/api\/items\.js";\n/,
    "",
    "remove ItemDto export",
  ),
  replace(
    'export * as itemApi from "./api/items.js";\n',
    "",
    "remove itemApi export",
  ),
]);

editFile("shared/src/rbac/permissions.ts", [
  replace(/^ *"items:[a-z-]+",\n/gm, "", "remove items permissions"),
]);

editFile("shared/src/rbac/matrix.ts", [
  replace(/^ *"items:[a-z-]+",\n/gm, "", "remove items from role matrix"),
  replace('viewer: ["items:read"],', "viewer: [],", "empty viewer permissions"),
]);

editFile("shared/src/rbac/rbac.test.ts", [
  replace(/^ *"items:[a-z-]+",\n/gm, "", "remove items from expected matrix"),
  replace(
    'viewer: ["items:read"],',
    "viewer: [],",
    "empty expected viewer permissions",
  ),
]);

editFile("server/src/app.ts", [
  replace(
    'import { createItemService } from "./services/item-service.js";\n',
    "",
    "remove item service import",
  ),
  replace(
    /  registerRoutes\(app, \{\n    accounts: createAccountService\(prisma\),\n    items: createItemService\(prisma\),\n    config,\n  \}\);/,
    "  registerRoutes(app, { accounts: createAccountService(prisma), config });",
    "remove item service dependency",
  ),
]);

editFile("server/src/routes/index.ts", [
  replace(
    'import type { ItemService } from "../services/item-service.js";\n',
    "",
    "remove item service type import",
  ),
  replace(
    'import { createItemsRouter } from "./items.js";\n',
    "",
    "remove items router import",
  ),
  replace("  items: ItemService;\n", "", "remove items route dependency"),
  replace(
    "{ accounts, items, config }: RouteDependencies",
    "{ accounts, config }: RouteDependencies",
    "remove items route destructuring",
  ),
  replace(
    '  app.use("/api/items", createItemsRouter(items));\n',
    "",
    "remove items router mount",
  ),
]);

editFile("server/test/routes/route-audit.test.ts", [
  replace(
    'import { createItemsRouter } from "../../src/routes/items.js";\n',
    "",
    "remove items router import from route audit",
  ),
  replace(
    'import type { ItemService } from "../../src/services/item-service.js";\n',
    "",
    "remove item service type from route audit",
  ),
  replace(
    "const itemService = {} as ItemService;\n",
    "",
    "remove item service stub",
  ),
  replace(
    '  { prefix: "/api/items", router: createItemsRouter(itemService) },\n',
    "",
    "remove items route from route audit",
  ),
]);

editFile("server/test/helpers/db.ts", [
  replace('    "Item",\n', "", "remove Item from test truncation"),
]);

editFile("client/src/layouts/Admin.tsx", [
  replace("  FaBoxes,\n", "", "remove items icon"),
  replace(
    'import { Can, useCan } from "../rbac";',
    'import { useCan } from "../rbac";',
    "remove Can import",
  ),
  {
    label: "remove items nav entry",
    run: (text) =>
      text
        .replace(
          /\n    if \(can\("items:read"\)\) \{\n      items\.push\(\{\n        key: "items",\n        label: \(\n          <Can permission="items:read">\n            <Link to="\/admin\/items">\{t\("sidebar\.items"\)\}<\/Link>\n          <\/Can>\n        \),\n        icon: <FaBoxes \/>,\n      \}\);\n    \}\n/,
          "\n",
        )
        .replace(
          /\n\n\n    if \(can\("roles:read"\)\)/,
          '\n\n    if (can("roles:read"))',
        ),
  },
]);

editFile("client/src/routeTree.gen.ts", [
  replace(
    "import { Route as AdminItemsRouteImport } from './routes/admin/items'\n",
    "",
    "remove items route import",
  ),
  replace(
    /const AdminItemsRoute = AdminItemsRouteImport\.update\(\{[\s\S]*?\} as any\)\n/,
    "",
    "remove items route definition",
  ),
  replace(
    /^ *'\/admin\/items': typeof AdminItemsRoute\n/gm,
    "",
    "remove items route type",
  ),
  replace(/^ *\| '\/admin\/items'\n/gm, "", "remove items route union member"),
  removeBrace("    '/admin/items': {\n", "remove items route declaration"),
  replace(/^ *AdminItemsRoute:.*\n/gm, "", "remove items route child"),
]);

editFile("client/src/locales/es.ts", [
  replace(
    /^ *"items\.(read|create|update|delete|restore)":.*\n/gm,
    "",
    "remove items permission labels",
  ),
  replace('        items: "Elementos",\n', "", "remove items nav label"),
  removeBrace("      items: {\n", "remove items page strings"),
  replace(
    '    "item-not-found": "El elemento no fue encontrado.",\n',
    "",
    "remove item-not-found message",
  ),
  replace(
    '    "description-too-long": "La descripción es demasiado larga.",\n',
    "",
    "remove item description validation message",
  ),
]);

editFile("client/src/rbac/Can.test.tsx", [
  replace(
    'permissions: ["items:read"],',
    "permissions: [],",
    "clear test permissions",
  ),
]);

editFile("client/src/rbac/RequirePermission.test.tsx", [
  replace(
    'permissions: ["items:read"],',
    "permissions: [],",
    "clear test permissions",
  ),
]);

editFile("server/prisma/schema.prisma", [
  replace(/^  item\s+Item\?\n/m, "", "remove Item relation from Metadata"),
  removeBrace("enum ItemStatus {\n", "remove ItemStatus enum"),
  removeBrace("model Item {\n", "remove Item model"),
]);

console.log(
  dryRun
    ? "[remove-example] dry run: planned changes"
    : "[remove-example] applying changes",
);

if (changes.length === 0) {
  console.log("[remove-example] nothing to do; example is already removed");
} else {
  for (const change of changes) {
    const suffix = change.detail ? ` (${change.detail})` : "";
    console.log(`[${change.type}] ${change.path}${suffix}`);
  }
}

const migrationExists =
  existsSync(join(serverDir, "prisma", "migrations")) &&
  readdirSync(join(serverDir, "prisma", "migrations")).some((entry) =>
    entry.endsWith("_drop_item"),
  );

const hasDatabase =
  Boolean(process.env.MIGRATE_DATABASE_URL ?? process.env.DATABASE_URL) ||
  existsSync(join(serverDir, ".env"));

const migrationCommand =
  "cd server && MIGRATE_DATABASE_URL=<dev-database-url> npx prisma migrate dev --create-only --name drop_item";

if (dryRun) {
  if (migrationExists) {
    console.log(
      "[remove-example] migration drop_item already exists; skipping",
    );
  } else {
    console.log(
      "[create] server/prisma/migrations/<timestamp>_drop_item/migration.sql (prisma migrate dev --create-only --name drop_item)",
    );
    if (!hasDatabase) {
      console.log(
        `[remove-example] no development database configured; the migration command would be:\n  ${migrationCommand}`,
      );
    }
  }
  console.log("[remove-example] dry run: no files were written");
  process.exit(0);
}

if (migrationExists) {
  console.log("[remove-example] migration drop_item already exists; skipping");
} else {
  if (!hasDatabase) {
    console.log(
      `[remove-example] no development database configured; run:\n  ${migrationCommand}`,
    );
  } else {
    const result = spawnSync(
      "npx",
      ["prisma", "migrate", "dev", "--create-only", "--name", "drop_item"],
      { cwd: serverDir, stdio: "inherit", env: process.env },
    );

    if (result.error || result.status !== 0) {
      console.error(
        `[remove-example] migration creation failed; run it manually:\n  ${migrationCommand}`,
      );
    }
  }
}

const generate = spawnSync("npx", ["prisma", "generate"], {
  cwd: serverDir,
  stdio: "inherit",
  env: process.env,
});

if (generate.error || generate.status !== 0) {
  console.error(
    "[remove-example] prisma generate failed; run `npm run bootstrap` before building",
  );
  process.exit(generate.status ?? 1);
}

console.log("[remove-example] done");
