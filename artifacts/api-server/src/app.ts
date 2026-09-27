import express, { type Express } from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { validateEnvironment } from "./lib/envValidator";
import {
  securityHeaders,
  corsConfig,
  sanitizedErrorHandler,
  generalRateLimiter,
} from "./lib/security";
import { authenticateUser } from "./middlewares/auth";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Phase 10 Step 4: Validate environment at startup
validateEnvironment();

const app: Express = express();

// Phase 10 Step 17: Security headers
app.use(securityHeaders);

// Structured request logging
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
    // Don't log health check spam
    autoLogging: {
      ignore: (req) => {
        const url = (req as any).url || "";
        return url === "/api/health" || url === "/api/healthz";
      },
    },
  }),
);

// Phase 10 Step 17: CORS with proper configuration
app.use(cors(corsConfig()));

// Phase 10 Step 11: Request size limits
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Phase 18: Global user extraction — populates req.user when auth headers present
app.use(authenticateUser);

// Phase 10 Step 16: General rate limiting
app.use("/api", generalRateLimiter);

// Mount routes
app.use("/api", router);

// Phase 10 Step 33: Production static asset serving & SPA routing
const staticCandidates = [
  path.resolve(process.cwd(), "artifacts/bidshield/dist/public"),
  path.resolve(process.cwd(), "../bidshield/dist/public"),
  path.resolve(__dirname, "../../bidshield/dist/public"),
];
const staticDir = staticCandidates.find((dir) => fs.existsSync(dir));
if (staticDir) {
  app.use(express.static(staticDir));
  app.use((req, res, next) => {
    if (req.method === "GET" && !req.url.startsWith("/api")) {
      return res.sendFile(path.join(staticDir, "index.html"));
    }
    next();
  });
}

// Phase 10 Step 10: Sanitized error handler (must be last)
app.use(sanitizedErrorHandler);

export default app;
