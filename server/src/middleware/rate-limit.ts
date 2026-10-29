import { rateLimit, type RateLimitRequestHandler } from "express-rate-limit";

import type { AppConfig } from "../config/index.js";

type LimitConfig = Pick<
  AppConfig,
  "rateLimitWindowMs" | "rateLimitMax" | "loginRateLimitMax"
>;

export function globalRateLimit(config: LimitConfig): RateLimitRequestHandler {
  return rateLimit({
    windowMs: config.rateLimitWindowMs,
    limit: config.rateLimitMax,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skip: (req) => req.path === "/healthz" || req.path === "/readyz",
  });
}

export function loginRateLimit(config: LimitConfig): RateLimitRequestHandler {
  return rateLimit({
    windowMs: config.rateLimitWindowMs,
    limit: config.loginRateLimitMax,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  });
}
