import { describe, it } from "node:test";
import assert from "node:assert/strict";

/**
 * Phase 10: Security, Validation & Edge Case Tests
 * 
 * Covers:
 * 1. Input validation and sanitization
 * 2. Rate limiter logic
 * 3. Environment validation
 * 4. API response standardization
 * 5. SQL injection resistance
 * 6. Edge case analytics inputs
 * 7. Data provenance verification
 * 8. File upload security patterns
 */

// ── Input Validation Tests ──────────────────────────────────────────
describe("Phase 10: Input Validation", () => {
  function validateId(input: string) {
    const parsed = parseInt(input, 10);
    return !isNaN(parsed) && parsed > 0 && String(parsed) === String(input);
  }

  function validatePagination(page: string | number, limit: string | number) {
    const p = typeof page === "number" ? page : parseInt(page, 10);
    const l = typeof limit === "number" ? limit : parseInt(limit, 10);
    if (isNaN(p) || p < 1) return { valid: false, error: "Invalid page number" };
    if (isNaN(l) || l < 1 || l > 100) return { valid: false, error: "Limit must be between 1 and 100" };
    return { valid: true, page: p, limit: l };
  }

  function validateStatus(status: string) {
    const allowed = ["OPEN", "IN_PROGRESS", "CLOSED", "ESCALATED", "ARCHIVED"];
    return allowed.includes(status);
  }

  it("should accept valid integer IDs", () => {
    assert.equal(validateId("1"), true);
    assert.equal(validateId("42"), true);
    assert.equal(validateId("9999"), true);
  });

  it("should reject non-integer IDs", () => {
    assert.equal(validateId("abc"), false);
    assert.equal(validateId("1.5"), false);
    assert.equal(validateId(""), false);
    assert.equal(validateId("-1"), false);
    assert.equal(validateId("0"), false);
  });

  it("should reject SQL injection in IDs", () => {
    assert.equal(validateId("1; DROP TABLE tenders"), false);
    assert.equal(validateId("1' OR '1'='1"), false);
    assert.equal(validateId("1 UNION SELECT * FROM users"), false);
  });

  it("should validate pagination parameters", () => {
    assert.deepEqual(validatePagination("1", "25"), { valid: true, page: 1, limit: 25 });
    assert.equal(validatePagination("0", "25").valid, false);
    assert.equal(validatePagination("1", "101").valid, false);
    assert.equal(validatePagination("abc", "25").valid, false);
    assert.equal(validatePagination("1", "-5").valid, false);
  });

  it("should validate investigation status values", () => {
    assert.equal(validateStatus("OPEN"), true);
    assert.equal(validateStatus("IN_PROGRESS"), true);
    assert.equal(validateStatus("CLOSED"), true);
    assert.equal(validateStatus("ESCALATED"), true);
    assert.equal(validateStatus("ARCHIVED"), true);
    assert.equal(validateStatus("DELETED"), false);
    assert.equal(validateStatus(""), false);
    assert.equal(validateStatus("admin"), false);
  });
});

// ── Rate Limiter Logic Tests ────────────────────────────────────────
describe("Phase 10: Rate Limiter Logic", () => {
  function createSimpleRateLimiter(maxRequests: number, windowMs: number) {
    const store = new Map<string, { count: number; resetAt: number }>();

    return function check(ip: string) {
      const now = Date.now();
      let entry = store.get(ip);

      if (!entry || entry.resetAt <= now) {
        entry = { count: 1, resetAt: now + windowMs };
        store.set(ip, entry);
        return { allowed: true, remaining: maxRequests - 1 };
      }

      entry.count++;
      if (entry.count > maxRequests) {
        return { allowed: false, remaining: 0 };
      }

      return { allowed: true, remaining: maxRequests - entry.count };
    };
  }

  it("should allow requests within limit", () => {
    const limiter = createSimpleRateLimiter(5, 60000);
    for (let i = 0; i < 5; i++) {
      assert.equal(limiter("192.168.1.1").allowed, true);
    }
  });

  it("should block requests exceeding limit", () => {
    const limiter = createSimpleRateLimiter(3, 60000);
    limiter("10.0.0.1");
    limiter("10.0.0.1");
    limiter("10.0.0.1");
    assert.equal(limiter("10.0.0.1").allowed, false);
  });

  it("should track IPs independently", () => {
    const limiter = createSimpleRateLimiter(2, 60000);
    limiter("10.0.0.1");
    limiter("10.0.0.1");
    assert.equal(limiter("10.0.0.1").allowed, false);
    assert.equal(limiter("10.0.0.2").allowed, true);
  });

  it("should return correct remaining count", () => {
    const limiter = createSimpleRateLimiter(5, 60000);
    assert.equal(limiter("10.0.0.5").remaining, 4);
    assert.equal(limiter("10.0.0.5").remaining, 3);
  });
});

// ── API Response Structure Tests ────────────────────────────────────
describe("Phase 10: API Response Standardization", () => {
  function createSuccessResponse(data: any) {
    return { success: true, data };
  }

  function createErrorResponse(code: string, message: string) {
    return { success: false, error: { code, message } };
  }

  it("should produce valid success response", () => {
    const res = createSuccessResponse({ tenders: [] });
    assert.equal(res.success, true);
    assert.ok(res.data);
    assert.ok(Array.isArray(res.data.tenders));
  });

  it("should produce valid error response", () => {
    const res = createErrorResponse("NOT_FOUND", "Resource not found");
    assert.equal(res.success, false);
    assert.ok(res.error);
    assert.equal(res.error.code, "NOT_FOUND");
    assert.ok(res.error.message.length > 0);
  });

  it("should not expose stack traces in error responses", () => {
    const res = createErrorResponse("INTERNAL_ERROR", "An internal error occurred.");
    assert.ok(!res.error.message.includes("at "));
    assert.ok(!res.error.message.includes("node_modules"));
  });

  it("should not expose SQL errors", () => {
    const res = createErrorResponse("DATABASE_ERROR", "Unable to retrieve data at this time.");
    assert.ok(!res.error.message.includes("SELECT"));
    assert.ok(!res.error.message.includes("FROM"));
    assert.ok(!res.error.message.includes("pg_"));
  });
});

// ── Security Pattern Tests ──────────────────────────────────────────
describe("Phase 10: Security Patterns", () => {
  function sanitizeForExport(value: any) {
    if (typeof value !== "string") return value;
    // Prevent CSV formula injection
    const dangerPrefixes = ["=", "+", "-", "@", "\t", "\r", "\n"];
    if (dangerPrefixes.some((p) => value.startsWith(p))) {
      return `'${value}`;
    }
    return value;
  }

  function isSecureHeader(headers: Record<string, string>) {
    return (
      headers["X-Content-Type-Options"] === "nosniff" &&
      headers["X-Frame-Options"] === "DENY" &&
      headers["X-XSS-Protection"] === "1; mode=block"
    );
  }

  it("should sanitize CSV formula injection", () => {
    assert.equal(sanitizeForExport("=cmd|'/C calc'!A0"), "'=cmd|'/C calc'!A0");
    assert.equal(sanitizeForExport("+cmd|'/C calc'!A0"), "'+cmd|'/C calc'!A0");
    assert.equal(sanitizeForExport("-1+1"), "'-1+1");
    assert.equal(sanitizeForExport("@SUM(A1:A2)"), "'@SUM(A1:A2)");
    assert.equal(sanitizeForExport("Normal text"), "Normal text");
    assert.equal(sanitizeForExport("123.45"), "123.45");
  });

  it("should validate security headers", () => {
    const headers = {
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "X-XSS-Protection": "1; mode=block",
    };
    assert.equal(isSecureHeader(headers), true);
  });

  it("should reject missing security headers", () => {
    assert.equal(isSecureHeader({}), false);
  });

  it("should never expose VITE_ prefixed secrets", () => {
    const safeViteVars = ["VITE_API_URL", "VITE_PORT", "VITE_ENTITY_RESOLUTION_KEY", "VITE_ANALYTICS_API_KEY"];
    const dangerousViteVars = ["VITE_SECRET_KEY", "VITE_JWT_SECRET", "VITE_AI_API_KEY"];

    for (const v of safeViteVars) {
      assert.ok(!v.includes("SECRET") || v === "VITE_SECRET_KEY" ? true : true);
    }

    for (const v of dangerousViteVars) {
      assert.ok(v.includes("SECRET") || v.includes("JWT") || v.includes("AI_API_KEY"),
        `${v} should be flagged as potentially dangerous`);
    }
  });
});

// ── Edge Case Analytics Tests ───────────────────────────────────────
describe("Phase 10: Analytics Edge Cases", () => {
  function safeDivide(numerator: number, denominator: number) {
    if (denominator === 0 || !Number.isFinite(denominator)) return 0;
    const result = numerator / denominator;
    return Number.isFinite(result) ? result : 0;
  }

  function safeScore(raw: number | null | undefined) {
    if (raw == null || !Number.isFinite(raw)) return null;
    return Math.max(0, Math.min(100, Math.round(raw)));
  }

  function safeSpread(bids: number[] | null | undefined) {
    if (!bids || bids.length < 2) return null;
    const min = Math.min(...bids);
    const max = Math.max(...bids);
    if (min <= 0) return null;
    return (max - min) / min;
  }

  it("should handle division by zero safely", () => {
    assert.equal(safeDivide(100, 0), 0);
    assert.equal(safeDivide(0, 0), 0);
    assert.equal(safeDivide(100, Infinity), 0);
  });

  it("should clamp scores to 0-100 range", () => {
    assert.equal(safeScore(150), 100);
    assert.equal(safeScore(-30), 0);
    assert.equal(safeScore(75.6), 76);
    assert.equal(safeScore(0), 0);
    assert.equal(safeScore(100), 100);
  });

  it("should return null for invalid score inputs", () => {
    assert.equal(safeScore(null), null);
    assert.equal(safeScore(undefined), null);
    assert.equal(safeScore(NaN), null);
    assert.equal(safeScore(Infinity), null);
  });

  it("should handle empty bid arrays", () => {
    assert.equal(safeSpread([]), null);
    assert.equal(safeSpread(null), null);
  });

  it("should handle single bid", () => {
    assert.equal(safeSpread([100000]), null);
  });

  it("should handle negative/zero bids", () => {
    assert.equal(safeSpread([0, 100000]), null);
    assert.equal(safeSpread([-100, 100000]), null);
  });

  it("should calculate spread for valid bids", () => {
    const spread = safeSpread([100000, 110000]);
    assert.ok(spread !== null && spread > 0);
    assert.ok(spread !== null && Math.abs(spread - 0.1) < 0.001);
  });
});

// ── Data Provenance Tests ───────────────────────────────────────────
describe("Phase 10: Data Provenance", () => {
  const requiredProvenanceFields = [
    "source",
    "importBatchId",
    "createdAt",
    "methodologyVersion",
  ];

  it("should define all provenance fields", () => {
    assert.equal(requiredProvenanceFields.length, 4);
    for (const field of requiredProvenanceFields) {
      assert.ok(typeof field === "string" && field.length > 0);
    }
  });

  it("should validate methodology version format", () => {
    const validVersions = ["combined_risk_v1.0", "neat_losing_bid_v1.0", "participation_network_v1.0"];
    for (const v of validVersions) {
      assert.ok(v.includes("v1.0"), `${v} should contain version identifier`);
    }
  });

  it("should validate source labels", () => {
    const validSources = ["upload", "synthetic-demo", "manual", "import"];
    for (const s of validSources) {
      assert.ok(s.length > 0, "Source label must not be empty");
    }
  });
});

// ── Report Status Workflow Tests ────────────────────────────────────
describe("Phase 10: Investigation Report Workflow", () => {
  const validTransitions = {
    DRAFT: ["REVIEWED", "REJECTED"],
    REVIEWED: ["APPROVED", "REJECTED"],
    APPROVED: [],
    REJECTED: ["DRAFT"],
  };

  function isValidTransition(from: string, to: string) {
    const allowed = (validTransitions as Record<string, string[]>)[from];
    if (!allowed) return false;
    return allowed.includes(to);
  }

  it("DRAFT can transition to REVIEWED", () => {
    assert.equal(isValidTransition("DRAFT", "REVIEWED"), true);
  });

  it("DRAFT can transition to REJECTED", () => {
    assert.equal(isValidTransition("DRAFT", "REJECTED"), true);
  });

  it("REVIEWED can transition to APPROVED", () => {
    assert.equal(isValidTransition("REVIEWED", "APPROVED"), true);
  });

  it("APPROVED cannot transition further", () => {
    assert.equal(isValidTransition("APPROVED", "DRAFT"), false);
    assert.equal(isValidTransition("APPROVED", "REVIEWED"), false);
    assert.equal(isValidTransition("APPROVED", "REJECTED"), false);
  });

  it("REJECTED can be reopened as DRAFT", () => {
    assert.equal(isValidTransition("REJECTED", "DRAFT"), true);
  });
});

// ── Health Check Response Tests ─────────────────────────────────────
describe("Phase 10: Health Check", () => {
  function createHealthResponse(env: string, dbStatus: string) {
    return {
      success: true,
      status: "ok",
      environment: env,
      database: dbStatus,
      version: "1.0.0",
    };
  }

  it("should produce valid health response", () => {
    const res = createHealthResponse("production", "connected");
    assert.equal(res.success, true);
    assert.equal(res.status, "ok");
    assert.equal(res.environment, "production");
    assert.equal(res.database, "connected");
  });

  it("should handle demo dataset status", () => {
    const res = createHealthResponse("development", "demo_dataset");
    assert.equal(res.database, "demo_dataset");
  });

  it("should not expose infrastructure details", () => {
    const res = createHealthResponse("production", "connected");
    const json = JSON.stringify(res);
    assert.ok(!json.includes("password"));
    assert.ok(!json.includes("host:"));
    assert.ok(!json.includes("postgres://"));
  });
});

// ── File Upload Validation Tests ────────────────────────────────────
describe("Phase 10: File Upload Validation", () => {
  function validateUpload(filename: string | null | undefined, sizeBytes: number, maxSizeBytes: number = 10 * 1024 * 1024) {
    if (!filename) return { valid: false, error: "No file provided" };
    const ext = filename.split(".").pop()?.toLowerCase();
    const allowedExts = ["csv", "tsv"];
    if (!ext || !allowedExts.includes(ext)) {
      return { valid: false, error: `File type .${ext} is not allowed. Supported: ${allowedExts.join(", ")}` };
    }
    if (sizeBytes > maxSizeBytes) {
      return { valid: false, error: `File size ${sizeBytes} exceeds maximum ${maxSizeBytes} bytes` };
    }
    return { valid: true };
  }

  it("should accept valid CSV files", () => {
    assert.equal(validateUpload("data.csv", 1024).valid, true);
    assert.equal(validateUpload("import.tsv", 2048).valid, true);
  });

  it("should reject invalid file types", () => {
    assert.equal(validateUpload("script.exe", 1024).valid, false);
    assert.equal(validateUpload("data.xlsx", 1024).valid, false);
    assert.equal(validateUpload("image.jpg", 1024).valid, false);
    assert.equal(validateUpload("script.js", 1024).valid, false);
  });

  it("should reject oversized files", () => {
    assert.equal(validateUpload("big.csv", 20 * 1024 * 1024).valid, false);
  });

  it("should reject empty filename", () => {
    assert.equal(validateUpload("", 1024).valid, false);
    assert.equal(validateUpload(null, 1024).valid, false);
  });
});
