import type { CookieOptions } from "express";

import type { AppConfig } from "../config/index.js";

export const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7;

function isProduction(config: Pick<AppConfig, "nodeEnv">): boolean {
  return config.nodeEnv === "production";
}

export function sessionCookieName(config: Pick<AppConfig, "nodeEnv">): string {
  return isProduction(config) ? "__Host-app.sid" : "app.sid";
}

export function sessionCookieOptions(
  config: Pick<AppConfig, "nodeEnv" | "cookieDomain">,
): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction(config),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_MS,
    ...(config.cookieDomain ? { domain: config.cookieDomain } : {}),
  };
}

export function clearSessionCookieOptions(
  config: Pick<AppConfig, "nodeEnv" | "cookieDomain">,
): CookieOptions {
  const { maxAge: _maxAge, ...options } = sessionCookieOptions(config);
  return options;
}

export function csrfCookieName(config: Pick<AppConfig, "nodeEnv">): string {
  return isProduction(config) ? "__Host-csrf" : "csrf";
}

export function csrfCookieOptions(
  config: Pick<AppConfig, "nodeEnv">,
): CookieOptions {
  return {
    httpOnly: false,
    secure: isProduction(config),
    sameSite: "lax",
    path: "/",
  };
}
