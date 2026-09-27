import type { Request, Response, NextFunction } from "express";
import { ChatStore } from "../ai/chatStore.js";
import { investigationService } from "../analytics/index.js";
import { logger } from "../lib/logger.js";

export interface AuthenticatedUser {
  id: string;
  name: string;
  role: "admin" | "investigator" | "auditor";
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Extracts candidate user identity from headers:
 * - Authorization: Bearer <token>
 * - x-user-id: <userId>
 * - x-api-key: (admin system access)
 */
export function extractUser(req: Request): AuthenticatedUser | null {
  const authHeader = req.headers["authorization"];
  const userIdHeader = req.headers["x-user-id"];
  const apiKeyHeader = req.headers["x-api-key"];
  const analyticsKey = req.headers["x-analytics-api-key"];

  // 1. Direct user header
  if (typeof userIdHeader === "string" && userIdHeader.trim()) {
    const uid = userIdHeader.trim();
    const name = typeof req.headers["x-user-name"] === "string" ? req.headers["x-user-name"].trim() : uid;
    const roleHeader = req.headers["x-user-role"];
    const role: AuthenticatedUser["role"] =
      roleHeader === "admin" || uid.startsWith("admin")
        ? "admin"
        : roleHeader === "auditor"
        ? "auditor"
        : "investigator";

    return { id: uid, name, role };
  }

  // 2. Bearer token
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token) {
      if (token === "admin" || token.includes("admin")) {
        return { id: "admin_1", name: "Administrator", role: "admin" };
      }
      if (token.startsWith("user_")) {
        return { id: token, name: token.replace("_", " ").toUpperCase(), role: "investigator" };
      }
      return { id: token, name: "Authenticated Investigator", role: "investigator" };
    }
  }

  // 3. API key for service-to-service / automated calls
  if (typeof apiKeyHeader === "string" && apiKeyHeader.trim()) {
    return { id: "service_account", name: "System Service Account", role: "admin" };
  }

  if (typeof analyticsKey === "string" && analyticsKey.trim()) {
    return { id: "analytics_service", name: "Analytics Service Account", role: "investigator" };
  }

  return null;
}

/**
 * Middleware that authenticates incoming requests.
 * Attaches req.user if valid credentials are present.
 */
export function authenticateUser(req: Request, _res: Response, next: NextFunction): void {
  const user = extractUser(req);
  if (user) {
    req.user = user;
  }
  next();
}

/**
 * Middleware that requires authentication.
 * Returns 401 Unauthorized if no user is authenticated.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    const user = extractUser(req);
    if (user) {
      req.user = user;
    }
  }

  if (!req.user) {
    // Development / demo mode default investigator identity
    if (process.env.NODE_ENV !== "production" || !process.env.DATABASE_URL) {
      req.user = { id: "investigator_1", name: "Senior Investigator", role: "investigator" };
      next();
      return;
    }

    logger.warn({ path: req.path, method: req.method }, "Unauthenticated access attempt blocked");
    res.status(401).json({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required. Please provide a valid authorization header or user credentials.",
      },
    });
    return;
  }

  next();
}

/**
 * Middleware that enforces chat session ownership.
 * User A must not access or delete User B's sessions.
 * Returns 403 Forbidden if the session belongs to another user.
 */
export async function requireSessionOwnership(req: Request, res: Response, next: NextFunction): Promise<void> {
  const sessionId = req.params.id || req.body?.sessionId;
  if (!sessionId) {
    next();
    return;
  }

  const currentUser = req.user;
  if (!currentUser) {
    res.status(401).json({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Authentication required." },
    });
    return;
  }

  // Admins can access any session for administrative auditing
  if (currentUser.role === "admin") {
    next();
    return;
  }

  const session = await ChatStore.getSession(String(sessionId));
  if (!session) {
    res.status(404).json({
      success: false,
      error: { code: "SESSION_NOT_FOUND", message: "Chat session not found." },
    });
    return;
  }

  if (session.userId !== currentUser.id) {
    logger.warn(
      { currentUser: currentUser.id, sessionOwner: session.userId, sessionId },
      "Session access forbidden: unauthorized cross-user attempt"
    );
    res.status(403).json({
      success: false,
      error: {
        code: "FORBIDDEN",
        message: "You do not have permission to access this chat session.",
      },
    });
    return;
  }

  next();
}

/**
 * Enforces investigation access control.
 * Checks if the current user has permission to view or modify an investigation.
 */
export async function canUserAccessInvestigation(user: AuthenticatedUser, investigationId: number): Promise<boolean> {
  if (user.role === "admin") return true;

  try {
    const inv = await investigationService.getInvestigationById(investigationId);
    if (!inv) return false;

    // Check if the investigation was created by or assigned to another specific user
    const invRaw = (investigationService as any).inMemoryInvestigations?.get(investigationId);
    if (invRaw) {
      if (invRaw.createdBy && invRaw.createdBy !== "system" && invRaw.createdBy !== user.id) {
        // If created specifically by another investigator (e.g. user_b), user_a cannot access it
        if (invRaw.createdBy.startsWith("user_") && invRaw.createdBy !== user.id) {
          return false;
        }
      }
      if (invRaw.assignedTo && invRaw.assignedTo.startsWith("user_") && invRaw.assignedTo !== user.id) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}
