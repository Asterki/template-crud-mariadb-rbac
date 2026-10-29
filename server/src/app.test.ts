import type { PrismaClient } from "@prisma/client";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "./app.js";
import { loadConfig } from "./config/index.js";
import { createLogger } from "./logger.js";

const config = loadConfig({
  NODE_ENV: "test",
  PORT: "3000",
  DATABASE_URL: "mysql://user:password@localhost:3306/app",
  SESSION_SECRET: "a".repeat(32),
  CORS_ORIGINS: "http://localhost:2173",
  LOG_LEVEL: "silent",
  LOG_FORMAT: "json",
});

describe("createApp", () => {
  it("constructs with a fake Prisma client and serves a request", async () => {
    const logger = createLogger(config);
    const prisma = {} as PrismaClient;

    const app = createApp({ config, logger, prisma });
    const response = await request(app).get("/api/auth/fetch");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ status: "unauthenticated" });
  });

  it("importing the Prisma module does not connect", async () => {
    const module = await import("./db/prisma.js");

    expect(module.createPrismaClient).toBeTypeOf("function");
  });
});
