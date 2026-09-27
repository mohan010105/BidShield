import fs from "node:fs";
import path from "node:path";
import type { Request } from "express";

/**
 * Lightweight environment file loader that checks root and local directories.
 */
export function loadEnv(): void {
  const candidates = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "../../.env"),
    path.resolve(process.cwd(), "../.env"),
    path.resolve(import.meta.dirname, "../../../.env"),
    path.resolve(import.meta.dirname, "../../.env"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      try {
        const content = fs.readFileSync(candidate, "utf-8");
        for (const rawLine of content.split("\n")) {
          const line = rawLine.trim();
          if (!line || line.startsWith("#")) continue;
          const eq = line.indexOf("=");
          if (eq > 0) {
            const key = line.slice(0, eq).trim();
            const val = line.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
            if (process.env[key] === undefined && val !== "") {
              process.env[key] = val;
            }
          }
        }
      } catch {
        // Fallback silently if unreadable
      }
    }
  }
}

// Initial load
loadEnv();

export const config = {
  get entityResolutionServiceKey(): string {
    return process.env.ENTITY_RESOLUTION_SERVICE_KEY || "ZsazUckgZlrZqUqoWlt1Wwvf0WQbyUTQ";
  },
  get analyticsApiKey(): string {
    return process.env.ANALYTICS_API_KEY || "JAFZD1XpgLIvLPULX1Q4G56o7A67NjMsQMCKCvtH";
  },
};

/**
 * Masks an API key for safe public or logging output.
 */
export function maskKey(key: string): string {
  if (!key || key.length < 12) return "••••••••";
  return `${key.slice(0, 8)}••••••••••••${key.slice(-6)}`;
}

/**
 * Extracts candidate API key from standard HTTP headers:
 * - x-api-key
 * - x-analytics-api-key / x-entity-resolution-key
 * - Authorization: Bearer <key>
 */
export function extractApiKey(req: Request, customHeader?: string): string | null {
  const genericHeader = req.headers["x-api-key"];
  if (typeof genericHeader === "string" && genericHeader.trim()) {
    return genericHeader.trim();
  }

  if (customHeader) {
    const specificHeader = req.headers[customHeader.toLowerCase()];
    if (typeof specificHeader === "string" && specificHeader.trim()) {
      return specificHeader.trim();
    }
  }

  const authHeader = req.headers["authorization"];
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }

  return null;
}

/**
 * Validates request for Analytics API key.
 */
export function verifyAnalyticsApiKey(req: Request): { valid: boolean; provided: boolean; keyMasked?: string } {
  const key = extractApiKey(req, "x-analytics-api-key");
  if (!key) {
    return { valid: false, provided: false };
  }
  const expected = config.analyticsApiKey;
  const valid = key === expected;
  const keyMasked = maskKey(key);
  return { valid, provided: true, keyMasked };
}

/**
 * Validates request for Entity Resolution Service key.
 */
export function verifyEntityResolutionKey(req: Request): { valid: boolean; provided: boolean; keyMasked?: string } {
  const key = extractApiKey(req, "x-entity-resolution-key");
  if (!key) {
    return { valid: false, provided: false };
  }
  const expected = config.entityResolutionServiceKey;
  const valid = key === expected;
  const keyMasked = maskKey(key);
  return { valid, provided: true, keyMasked };
}
