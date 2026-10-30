import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    // Integration suites share one MariaDB database and truncate between tests.
    fileParallelism: false,
    // bcrypt logins and multi-step permission matrices exceed Vitest's 5s default.
    testTimeout: 15_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      thresholds: {
        "src/rbac/**": { lines: 80 },
        "src/http/**": { lines: 80 },
        "src/middleware/**": { lines: 80 },
      },
    },
  },
});
