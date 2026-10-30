import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { loadConfig } from "../config/index.js";
import { createLogger } from "../logger.js";
import { createHealthRouter } from "./health.js";

const config = loadConfig({
  NODE_ENV: "test",
  PORT: "3000",
  DATABASE_URL: "mysql://user:password@localhost:3306/app",
  SESSION_SECRET: "a".repeat(32),
  LOG_LEVEL: "silent",
  LOG_FORMAT: "json",
});

const logger = createLogger(config);

function app($queryRaw: () => Promise<unknown>) {
  const instance = express();
  instance.use(createHealthRouter({ prisma: { $queryRaw } as never, logger }));
  return instance;
}

describe("health routes", () => {
  it("returns 200 from /healthz without touching the database", async () => {
    const response = await request(
      app(() => Promise.reject(new Error("database down"))),
    ).get("/healthz");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });

  it("returns 200 from /readyz when the database responds", async () => {
    const query = vi.fn().mockResolvedValue([{ result: 1 }]);
    const response = await request(app(query)).get("/readyz");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ready" });
    expect(query).toHaveBeenCalledOnce();
  });

  it("returns 503 from /readyz when the database rejects", async () => {
    const response = await request(
      app(() => Promise.reject(new Error("database down"))),
    ).get("/readyz");

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ status: "degraded" });
  });
});
