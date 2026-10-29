import type { Router } from "express";
import { describe, expect, it } from "vitest";

import { createHealthRouter } from "../../src/routes/health.js";
import { createAuthRouter } from "../../src/routes/auth.js";
import { createAccountsRouter } from "../../src/routes/accounts.js";
import { createRolesRouter } from "../../src/routes/roles.js";
import type { AccountService } from "../../src/services/account-service.js";

type Handle = {
  authenticatedGuard?: boolean;
  requiredPermission?: string;
};

type Layer = {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: Array<{ handle: Handle }>;
  };
};

type StackRouter = {
  stack: Layer[];
};

const publicRoutes = new Set([
  "POST /api/auth/login",
  "GET /api/auth/csrf",
  "GET /healthz",
  "GET /readyz",
]);

const authenticatedOnlyRoutes = new Set([
  "POST /api/auth/logout",
  "GET /api/auth/me",
  "POST /api/auth/change-password",
]);

function collect(
  router: StackRouter,
  prefix: string,
): Array<{ key: string; handles: Handle[] }> {
  const routes: Array<{ key: string; handles: Handle[] }> = [];

  for (const layer of router.stack) {
    if (!layer.route) continue;
    const path = layer.route.path;
    const fullPath = `${prefix}${path === "/" ? "" : path}` || "/";
    for (const method of Object.keys(layer.route.methods)) {
      routes.push({
        key: `${method.toUpperCase()} ${fullPath}`,
        handles: layer.route.stack.map((entry) => entry.handle),
      });
    }
  }

  return routes;
}

const service = {} as AccountService;

const routers = [
  {
    prefix: "",
    router: createHealthRouter({ prisma: {} as never, logger: {} as never }),
  },
  { prefix: "/api/auth", router: createAuthRouter(service) },
  { prefix: "/api/accounts", router: createAccountsRouter(service) },
  { prefix: "/api/roles", router: createRolesRouter() },
] as Array<{ prefix: string; router: Router }>;

describe("route policy audit", () => {
  const routes = routers.flatMap(({ prefix, router }) =>
    collect(router as unknown as StackRouter, prefix),
  );

  it("discovers the API surface", () => {
    expect(routes.length).toBeGreaterThan(10);
  });

  for (const route of routes) {
    if (publicRoutes.has(route.key)) {
      it(`${route.key} is explicitly public`, () => {
        expect(route.handles.some((handle) => handle.authenticatedGuard)).toBe(
          false,
        );
      });
      continue;
    }

    it(`${route.key} requires authentication`, () => {
      expect(route.handles.some((handle) => handle.authenticatedGuard)).toBe(
        true,
      );
    });

    if (!authenticatedOnlyRoutes.has(route.key)) {
      it(`${route.key} declares a permission`, () => {
        expect(route.handles.some((handle) => handle.requiredPermission)).toBe(
          true,
        );
      });
    }
  }
});
