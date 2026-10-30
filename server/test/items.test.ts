import type { PrismaClient, Role } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config/index.js";
import { createLogger } from "../src/logger.js";
import {
  createTestPrisma,
  hasTestDatabase,
  migrateTestDatabase,
  seedAccount,
  truncateAll,
} from "./helpers/db.js";
import { csrfToken, loginAgent } from "./helpers/http.js";

const describeDb = hasTestDatabase ? describe : describe.skip;
const db = (hasTestDatabase ? createTestPrisma() : null) as PrismaClient;

const config = loadConfig({
  NODE_ENV: "test",
  PORT: "3000",
  DATABASE_URL:
    process.env.TEST_DATABASE_URL ??
    process.env.DATABASE_URL ??
    "mysql://root:root@127.0.0.1:3306/app",
  SESSION_SECRET: "a".repeat(32),
  CORS_ORIGINS: "http://localhost:2173",
  LOG_LEVEL: "silent",
  LOG_FORMAT: "json",
});

const app = createApp({ config, logger: createLogger(config), prisma: db });

type Method = "get" | "post" | "patch" | "delete";

function login(email: string) {
  return loginAgent(app, email, "InitialPassword123!");
}

async function seedItem(input: { name?: string; deleted?: boolean } = {}) {
  const metadata = await db.metadata.create({
    data: { deleted: input.deleted ?? false },
  });
  return db.item.create({
    data: {
      name: input.name ?? `Item ${Date.now()}`,
      description: "Seeded item",
      status: "active",
      metadataId: metadata.id,
    },
    include: { metadata: true },
  });
}

async function historyFor(itemId: string) {
  const item = await db.item.findUnique({
    where: { id: itemId },
    select: { metadataId: true },
  });
  return db.metadataUpdateHistory.findMany({
    where: { metadataId: item?.metadataId ?? "" },
  });
}

function send(
  agent: Awaited<ReturnType<typeof login>>,
  token: string,
  method: Method,
  url: string,
  body?: unknown,
) {
  let builder = agent[method](url);
  if (method !== "get") {
    builder = builder.set("x-csrf-token", token);
  }
  return body === undefined ? builder : builder.send(body as object);
}

describeDb("items API", () => {
  beforeAll(async () => {
    migrateTestDatabase();
    await db.$connect();
  });

  beforeEach(async () => {
    await truncateAll(db);
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("enforces the item permission matrix for every role", async () => {
    const roles: Role[] = ["admin", "manager", "staff", "viewer"];
    const accounts = {} as Record<Role, { email: string }>;

    for (const role of roles) {
      accounts[role] = await seedAccount(db, { role });
    }

    const cases: Array<{
      label: string;
      method: Method;
      permission:
        | "items:read"
        | "items:create"
        | "items:update"
        | "items:delete"
        | "items:restore"
        | null;
      body?: unknown;
      target: (ids: { active: string; deleted: string }) => string;
    }> = [
      {
        label: "list",
        method: "get",
        permission: "items:read",
        target: () => "/api/items",
      },
      {
        label: "get",
        method: "get",
        permission: "items:read",
        target: ({ active }) => `/api/items/${active}`,
      },
      {
        label: "create",
        method: "post",
        permission: "items:create",
        body: { name: "Created item", description: "Created" },
        target: () => "/api/items",
      },
      {
        label: "update",
        method: "patch",
        permission: "items:update",
        body: { name: "Updated item" },
        target: ({ active }) => `/api/items/${active}`,
      },
      {
        label: "delete",
        method: "delete",
        permission: "items:delete",
        target: ({ active }) => `/api/items/${active}`,
      },
      {
        label: "restore",
        method: "post",
        permission: "items:restore",
        target: ({ deleted }) => `/api/items/${deleted}/restore`,
      },
    ];

    for (const role of roles) {
      const active = await seedItem({ name: `${role} active` });
      const deleted = await seedItem({
        name: `${role} deleted`,
        deleted: true,
      });
      const agent = await login(accounts[role].email);
      const token = await csrfToken(agent);

      const list = await agent.get("/api/items").expect(200);
      expect(list.body.meta.total).toBeGreaterThan(0);
      await agent.get(`/api/items/${active.id}`).expect(200);

      for (const testCase of cases) {
        const response = await send(
          agent,
          token,
          testCase.method,
          testCase.target({ active: active.id, deleted: deleted.id }),
          testCase.body,
        );

        const allowed =
          testCase.permission === null ||
          ["admin", "manager"].includes(role) ||
          (role === "staff" &&
            ["items:read", "items:create", "items:update"].includes(
              testCase.permission,
            )) ||
          (role === "viewer" && testCase.permission === "items:read");

        if (allowed) {
          expect(
            [401, 403],
            `${role} should reach ${testCase.label} (got ${response.status})`,
          ).not.toContain(response.status);
        } else {
          expect(
            response.status,
            `${role} should be denied ${testCase.label}`,
          ).toBe(403);
        }
      }
    }
  });

  it("writes one history row per mutation", async () => {
    const admin = await seedAccount(db, { role: "admin" });
    const agent = await login(admin.email);
    const token = await csrfToken(agent);

    const created = await send(agent, token, "post", "/api/items", {
      name: "Audited",
      description: "Audit me",
    }).expect(201);
    const id = created.body.data.id as string;
    expect(await historyFor(id)).toHaveLength(1);

    await send(agent, token, "patch", `/api/items/${id}`, {
      name: "Audited again",
      status: "archived",
    }).expect(200);
    expect(await historyFor(id)).toHaveLength(2);

    await send(agent, token, "delete", `/api/items/${id}`).expect(200);
    expect(await historyFor(id)).toHaveLength(3);

    await send(agent, token, "post", `/api/items/${id}/restore`).expect(200);
    expect(await historyFor(id)).toHaveLength(4);
  });

  it("hides soft-deleted items by default and restores them", async () => {
    const manager = await seedAccount(db, { role: "manager" });
    const staff = await seedAccount(db, { role: "staff" });
    const managerAgent = await login(manager.email);
    const staffAgent = await login(staff.email);
    const managerToken = await csrfToken(managerAgent);
    const staffToken = await csrfToken(staffAgent);

    const created = await send(
      managerAgent,
      managerToken,
      "post",
      "/api/items",
      {
        name: "Recoverable",
      },
    ).expect(201);
    const id = created.body.data.id as string;

    await send(managerAgent, managerToken, "delete", `/api/items/${id}`).expect(
      200,
    );

    const hidden = await managerAgent.get("/api/items").expect(200);
    expect(hidden.body.meta.total).toBe(0);
    await managerAgent.get(`/api/items/${id}`).expect(404);

    const staffDeleted = await send(
      staffAgent,
      staffToken,
      "get",
      "/api/items?includeDeleted=true",
    ).expect(200);
    expect(staffDeleted.body.meta.total).toBe(0);

    const visible = await managerAgent
      .get("/api/items?includeDeleted=true")
      .expect(200);
    expect(visible.body.meta.total).toBe(1);
    expect(visible.body.data[0]).toMatchObject({ id, deleted: true });

    await send(
      managerAgent,
      managerToken,
      "post",
      `/api/items/${id}/restore`,
    ).expect(200);

    const restored = await managerAgent.get("/api/items").expect(200);
    expect(restored.body.meta.total).toBe(1);
    expect(restored.body.data[0]).toMatchObject({ id, deleted: false });
  });

  it("rejects page sizes above the shared maximum", async () => {
    const viewer = await seedAccount(db, { role: "viewer" });
    const agent = await login(viewer.email);

    await agent.get("/api/items?pageSize=101").expect(400);
    await agent.get(`/api/items?q=${"a".repeat(101)}`).expect(400);
  });
});
