import type { Request, Response, NextFunction } from "express";
import { logger } from "./logger";

/**
 * Phase 10: Security Middleware
 * 
 * Provides:
 * 1. Security headers (equivalent to Helmet)
 * 2. Request size limits
 * 3. Rate limiting for sensitive endpoints
 * 4. Error response sanitization
 */

// ── Security Headers ──────────────────────────────────────────────
export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  // Prevent MIME type sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");
  // Prevent clickjacking
  res.setHeader("X-Frame-Options", "DENY");
  // XSS protection for older browsers
  res.setHeader("X-XSS-Protection", "1; mode=block");
  // Referrer policy
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  // Permissions policy
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  // Content Security Policy
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https:; connect-src 'self' https://api.openai.com; frame-ancestors 'none';"
  );
  // Strict transport security (when behind HTTPS proxy)
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
}

// ── CORS Configuration ────────────────────────────────────────────
export function corsConfig(): { origin: string | string[] | boolean; credentials: boolean; methods: string[]; allowedHeaders: string[] } {
  const nodeEnv = process.env.NODE_ENV || "development";
  const frontendUrl = process.env.FRONTEND_URL || process.env.VITE_API_URL;
  const headers = [
    "Content-Type",
    "Authorization",
    "x-api-key",
    "x-analytics-api-key",
    "x-entity-resolution-key",
    "x-user-id",
    "x-user-name",
    "x-user-role",
    "x-investigator-id",
  ];

  if (nodeEnv === "production" && frontendUrl) {
    return {
      origin: frontendUrl,
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: headers,
    };
  }

  // Development: allow current origin
  return {
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: headers,
  };
}


// ── Rate Limiter ──────────────────────────────────────────────────
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    if (entry.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

export function createRateLimiter(options: { windowMs: number; maxRequests: number; keyPrefix?: string }) {
  const { windowMs, maxRequests, keyPrefix = "rl" } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const key = `${keyPrefix}:${ip}`;
    const now = Date.now();

    let entry = rateLimitStore.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      rateLimitStore.set(key, entry);
    }

    entry.count++;

    res.setHeader("X-RateLimit-Limit", String(maxRequests));
    res.setHeader("X-RateLimit-Remaining", String(Math.max(0, maxRequests - entry.count)));
    res.setHeader("X-RateLimit-Reset", String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > maxRequests) {
      logger.warn({ ip, key, count: entry.count }, "Rate limit exceeded");
      res.status(429).json({
        success: false,
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: "Too many requests. Please try again later.",
        },
      });
      return;
    }

    next();
  };
}

// Pre-configured rate limiters
export const generalRateLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 120, keyPrefix: "general" });
export const aiRateLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 30, keyPrefix: "ai" });
export const uploadRateLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 10, keyPrefix: "upload" });
export const recalcRateLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 5, keyPrefix: "recalc" });

// ── Error Sanitizer ───────────────────────────────────────────────
export function sanitizedErrorHandler(err: Error & { status?: number; statusCode?: number }, req: Request, res: Response, _next: NextFunction): void {
  const status = err.status || err.statusCode || 500;
  const isProduction = process.env.NODE_ENV === "production";

  logger.error({
    error: err.message,
    stack: isProduction ? undefined : err.stack,
    url: req.url,
    method: req.method,
  }, "Unhandled error");

  res.status(status).json({
    success: false,
    error: {
      code: status >= 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR",
      message: isProduction
        ? "An internal error occurred. Please try again later."
        : err.message || "Unknown error",
    },
  });
}

// ── Request Logger (structured) ──────────────────────────────────
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";
    logger[level]({
      method: req.method,
      url: req.url?.split("?")[0],
      status: res.statusCode,
      durationMs: duration,
    }, `${req.method} ${req.url?.split("?")[0]} ${res.statusCode} ${duration}ms`);
  });

  next();
}
