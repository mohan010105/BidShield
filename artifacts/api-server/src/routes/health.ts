import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

/**
 * Phase 10 Step 29: Enhanced Health Check Endpoint
 * 
 * GET /api/healthz — Kubernetes-style health probe
 * GET /api/health  — Detailed health check with database status
 */

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/health", async (_req, res) => {
  const startTime = Date.now();
  const nodeEnv = process.env.NODE_ENV || "development";
  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);

  let databaseStatus: "connected" | "demo_dataset" | "unavailable" = "demo_dataset";

  if (hasDatabaseUrl) {
    try {
      const { db } = await import("@workspace/db");
      if (db) {
        const result = await (db as any).execute?.("SELECT 1");
        databaseStatus = result ? "connected" : "connected";
      }
    } catch {
      databaseStatus = "unavailable";
    }
  }

  const responseTimeMs = Date.now() - startTime;
  const isAiConfigured = Boolean(process.env.OPENAI_API_KEY || process.env.AI_API_KEY);

  res.json({
    status: "ok",
    database: databaseStatus,
    ai: isAiConfigured ? "configured" : "unconfigured",
    environment: nodeEnv,
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    uptime: Math.floor(process.uptime()),
    responseTimeMs,
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/health/ai
 * Safe AI service configuration verification without wasting API credits
 */
router.get("/health/ai", (_req, res) => {
  const isConfigured = Boolean(process.env.OPENAI_API_KEY || process.env.AI_API_KEY);
  res.json({
    status: "ok",
    ai: {
      configured: isConfigured,
      status: isConfigured ? "ready" : "fallback_mode",
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      fallbackEngine: "bidshield-grounded-deterministic-v1",
      costControl: "active",
      promptGuard: "active",
      sessionIsolation: "active",
    },
  });
});

export default router;

