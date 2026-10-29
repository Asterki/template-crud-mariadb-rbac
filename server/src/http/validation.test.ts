import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { loadConfig } from "../config/index.js";
import { createLogger, setRootLogger } from "../logger.js";
import { errorHandler } from "./error-handler.js";
import { validateBody, validateParams, validateQuery } from "./validation.js";

const config = loadConfig({
  NODE_ENV: "test",
  PORT: "3000",
  DATABASE_URL: "mysql://user:password@localhost:3306/app",
  SESSION_SECRET: "a".repeat(32),
  LOG_LEVEL: "silent",
  LOG_FORMAT: "json",
});

setRootLogger(createLogger(config));

function app() {
  const instance = express();
  instance.use(express.json());

  instance.post(
    "/body",
    validateBody(
      z.object({
        name: z
          .string()
          .default("anonymous")
          .transform((name) => name.toUpperCase()),
        count: z.coerce.number().transform((value) => value * 2),
      }),
    ),
    (req, res) => {
      res.json(req.body);
    },
  );

  instance.get(
    "/query/:id",
    validateQuery(z.object({ page: z.coerce.number().default(1) })),
    validateParams(z.object({ id: z.string().transform(Number) })),
    (req, res) => {
      res.json(req.validated);
    },
  );

  instance.use(errorHandler);
  return instance;
}

describe("request validation", () => {
  it("assigns the parsed body so defaults and transforms reach the handler", async () => {
    const response = await request(app()).post("/body").send({ count: "4" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ name: "ANONYMOUS", count: 8 });
  });

  it("stores validated query and params without assigning req.query", async () => {
    const response = await request(app()).get("/query/42?page=3");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ query: { page: 3 }, params: { id: 42 } });
  });

  it("returns 400 with issues when validation fails", async () => {
    const response = await request(app()).post("/body").send({ count: "nope" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("validation_error");
    expect(response.body.error.details.length).toBeGreaterThan(0);
  });
});
