import {
  appConfigSchema,
  loadEnvFile,
  seedEnvSchema,
  type AppConfig,
  type SeedAppConfig,
} from "./env.js";

function reportConfigErrors(error: {
  issues: Array<{ path: PropertyKey[]; message: string }>;
}): void {
  process.stderr.write("[config] Invalid environment configuration:\n");
  for (const issue of error.issues) {
    const field = issue.path.length > 0 ? issue.path.join(".") : "environment";
    process.stderr.write(`  - ${field}: ${issue.message}\n`);
  }
}

/**
 * Parse and freeze the server configuration.
 *
 * Values are never echoed on failure, only the field name and the reason, so
 * secrets cannot leak into container or CI logs.
 */
export function loadConfig(
  env: NodeJS.ProcessEnv = process.env,
): Readonly<AppConfig> {
  if (env === process.env) {
    loadEnvFile(env);
  }

  const parsed = appConfigSchema.safeParse(env);
  if (!parsed.success) {
    reportConfigErrors(parsed.error);
    process.exit(1);
  }

  return Object.freeze(parsed.data);
}

/** Minimal configuration for migration/seed one-shot jobs. */
export function loadSeedConfig(
  env: NodeJS.ProcessEnv = process.env,
): Readonly<SeedAppConfig> {
  if (env === process.env) {
    loadEnvFile(env);
  }

  const parsed = seedEnvSchema.safeParse(env);
  if (!parsed.success) {
    reportConfigErrors(parsed.error);
    process.exit(1);
  }

  return Object.freeze(parsed.data);
}

export { loadEnvFile, type AppConfig, type SeedAppConfig };
