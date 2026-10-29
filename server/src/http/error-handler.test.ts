import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createApp } from "../app.js";
import { loadConfig } from "../config/index.js";
import { createLogger, setRootLogger } from "../logger.js";
import { ConflictError } from "./errors.js";
import { errorHandler } from "./error-handler.js";
import { notFound } from "./not-found.js";

const config = loadConfig({
  NODE_ENV: "test",
  PORT: "3000",
  DATABASE_URL: "mysql://user:password@localhost:3306/app",
  SESSION_SECRET: "a".repeat(32),
  LOG_LEVEL: "silent",
  LOG_FORMAT: "json",
});

afterEach(() => {
  vi.restoreAllMocks();
});

function testApp() {
  setRootLogger(createLogger(config));
  const app = express();
  app.get("/known", () => {
    throw new ConflictError("Already exists");
  });
  app.get("/unknown", () => {
    throw new Error("secret stack content");
  });
  app.use("/api", notFound);
  app.use(errorHandler);
  return app;
}

describe("errorHandler", () => {
  it("maps AppError to its status, code and message", async () => {
    const response = await request(testApp()).get("/known");

    expect(response.status).toBe(409);
    expect(response.body.error).toMatchObject({
      code: "conflict",
      message: "Already exists",
    });
    expect(response.body.error.traceId).toBe("unknown");
  });

  it("returns a generic 500 without a stack for unknown errors", async () => {
    const response = await request(testApp()).get("/unknown");

    expect(response.status).toBe(500);
    expect(response.body.error).toMatchObject({
      code: "internal_error",
      message: "Internal server error",
    });
    expect(JSON.stringify(response.body)).not.toContain("secret stack");
    expect(response.body.error.stack).toBeUndefined();
  });

  it("returns JSON 404 for an unknown API path", async () => {
    const app = createApp({
      config,
      logger: createLogger(config),
      prisma: {} as never,
    });

    const response = await request(app).get("/api/does-not-exist");

    expect(response.status).toBe(404);
    expect(response.body.error).toMatchObject({
      code: "not_found",
      message: "Route not found",
    });
  });
});
