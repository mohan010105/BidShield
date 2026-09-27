import { logger } from "./logger";

/**
 * Phase 10: Startup Environment Validator
 * 
 * Validates required and recommended environment variables at server boot.
 * Prevents production from accidentally using development configuration.
 * Never exposes secret values — only logs variable names.
 */

interface EnvVarSpec {
  name: string;
  required: boolean;
  secret: boolean;
  description: string;
}

const ENV_SPECS: EnvVarSpec[] = [
  { name: "NODE_ENV",      required: false, secret: false, description: "Runtime environment (development|production)" },
  { name: "PORT",          required: false, secret: false, description: "API server port" },
  { name: "DATABASE_URL",  required: false, secret: true,  description: "PostgreSQL connection string (empty = demo dataset)" },
  { name: "ENTITY_RESOLUTION_SERVICE_KEY", required: false, secret: true, description: "Entity resolution API key" },
  { name: "ANALYTICS_API_KEY",             required: false, secret: true, description: "Analytics engine API key" },
  { name: "AI_PROVIDER",   required: false, secret: false, description: "AI provider (mock|openai)" },
  { name: "AI_MODEL",      required: false, secret: false, description: "AI model identifier" },
  { name: "AI_API_KEY",    required: false, secret: true,  description: "AI provider API key (server-side only)" },
  { name: "AI_API_ENDPOINT", required: false, secret: false, description: "AI provider API endpoint URL" },
];

export function validateEnvironment(): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];
  const nodeEnv = process.env.NODE_ENV || "development";
  const isProduction = nodeEnv === "production";

  logger.info({ environment: nodeEnv }, "[Phase 10] Environment validation starting");

  // Check required vars
  for (const spec of ENV_SPECS) {
    const value = process.env[spec.name];
    if (spec.required && (!value || value.trim() === "")) {
      const msg = `Missing required environment variable: ${spec.name} — ${spec.description}`;
      logger.error(msg);
      warnings.push(msg);
    }
  }

  // Production safety checks
  if (isProduction) {
    if (!process.env.DATABASE_URL) {
      warnings.push("Production environment is using the built-in demo dataset (DATABASE_URL is not set).");
      logger.warn("[Phase 10] Production is running without DATABASE_URL — using demo dataset");
    }
    if (process.env.AI_PROVIDER === "mock" || !process.env.AI_PROVIDER) {
      logger.info("[Phase 10] AI provider is set to 'mock' — deterministic fallback summaries will be used");
    }
  }

  // Verify VITE_ vars never contain server-side secrets
  for (const key of Object.keys(process.env)) {
    if (key.startsWith("VITE_") && (key.includes("SECRET") || key.includes("JWT") || key.includes("AI_API_KEY"))) {
      const msg = `SECURITY: VITE_-prefixed variable ${key} may expose a server-side secret to the browser`;
      logger.error(msg);
      warnings.push(msg);
    }
  }

  // Log config summary (never log secret values)
  const summary: Record<string, string> = {};
  for (const spec of ENV_SPECS) {
    const value = process.env[spec.name];
    if (spec.secret) {
      summary[spec.name] = value ? "••••••••" : "(not set)";
    } else {
      summary[spec.name] = value || "(not set)";
    }
  }
  logger.info({ config: summary }, "[Phase 10] Environment configuration summary");

  if (warnings.length === 0) {
    logger.info("[Phase 10] Environment validation passed");
  } else {
    logger.warn({ warningCount: warnings.length }, "[Phase 10] Environment validation completed with warnings");
  }

  return { valid: warnings.filter((w) => w.startsWith("Missing required")).length === 0, warnings };
}
