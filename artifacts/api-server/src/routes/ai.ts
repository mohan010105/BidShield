import { Router, Request, Response } from "express";
import { AIService } from "../ai/service.js";
import { getAIProvider } from "../ai/providerFactory.js";
import { sanitizeUserInput } from "../ai/validator.js";
import { aiRateLimiter } from "../lib/security.js";
import { requireAuth } from "../middlewares/auth.js";

export const aiRouter = Router();

/**
 * GET /api/ai/health
 * Returns AI subsystem status and active provider
 */
aiRouter.get("/health", (req: Request, res: Response) => {
  const provider = getAIProvider();
  return res.json({
    success: true,
    data: {
      status: "available",
      provider: provider.name,
      model: provider.model,
      groundedOnly: true,
      timestamp: new Date().toISOString(),
    },
  });
});

function parseId(param: string | string[]): number {
  const idStr = Array.isArray(param) ? param[0] : param;
  return parseInt(idStr, 10);
}

/**
 * POST /api/ai/investigations/:id/summary
 * Generates structured investigation summary
 */
aiRouter.post("/investigations/:id/summary", requireAuth, aiRateLimiter, async (req: Request, res: Response) => {
  try {
    const investigationId = parseId(req.params.id);
    if (isNaN(investigationId)) {
      return res.status(400).json({
        success: false,
        error: { code: "INVALID_ID", message: "Invalid investigation ID" },
      });
    }

    const language = (req.body?.language || req.query?.language || "en") as string;
    const summary = await AIService.generateSummary(investigationId, language);
    return res.json({ success: true, data: summary });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: {
        code: "AI_GENERATION_ERROR",
        message: "AI assistance is temporarily unavailable. The underlying statistical screening and evidence remain available.",
      },
    });
  }
});

/**
 * POST /api/ai/investigations/:id/report
 * Generates structured 13-section investigation report draft
 */
aiRouter.post("/investigations/:id/report", requireAuth, aiRateLimiter, async (req: Request, res: Response) => {
  try {
    const investigationId = parseId(req.params.id);
    if (isNaN(investigationId)) {
      return res.status(400).json({
        success: false,
        error: { code: "INVALID_ID", message: "Invalid investigation ID" },
      });
    }

    const language = (req.body?.language || req.query?.language || "en") as string;
    const { report, reportId } = await AIService.generateReport(investigationId, language);
    return res.json({ success: true, data: { report, reportId } });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: {
        code: "AI_GENERATION_ERROR",
        message: "AI assistance is temporarily unavailable. The underlying statistical screening and evidence remain available.",
      },
    });
  }
});

/**
 * POST /api/ai/investigations/:id/chat
 * Answers evidence-grounded question
 */
aiRouter.post("/investigations/:id/chat", requireAuth, aiRateLimiter, async (req: Request, res: Response) => {
  try {
    const investigationId = parseId(req.params.id);
    if (isNaN(investigationId)) {
      return res.status(400).json({
        success: false,
        error: { code: "INVALID_ID", message: "Invalid investigation ID" },
      });
    }

    const { question } = req.body;
    if (!question || typeof question !== "string") {
      return res.status(400).json({
        success: false,
        error: { code: "MISSING_QUESTION", message: "Question string is required in request body" },
      });
    }

    if (question.length > 2000) {
      return res.status(400).json({
        success: false,
        error: { code: "QUESTION_TOO_LONG", message: "Question must be 2000 characters or fewer" },
      });
    }

    const language = (req.body?.language || req.query?.language || "en") as string;
    const cleanQuestion = sanitizeUserInput(question);
    const response = await AIService.answerQuestion(investigationId, cleanQuestion, language);
    return res.json({ success: true, data: response });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: {
        code: "AI_CHAT_ERROR",
        message: "AI assistance is temporarily unavailable. The underlying statistical screening and evidence remain available.",
      },
    });
  }
});

/**
 * GET /api/ai/investigations/:id/reports
 * Fetches stored reports and stale status
 */
aiRouter.get("/investigations/:id/reports", async (req: Request, res: Response) => {
  try {
    const investigationId = parseId(req.params.id);
    if (isNaN(investigationId)) {
      return res.status(400).json({
        success: false,
        error: { code: "INVALID_ID", message: "Invalid investigation ID" },
      });
    }

    const reports = await AIService.getSavedReports(investigationId);
    return res.json({ success: true, data: { reports } });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: { code: "DATABASE_ERROR", message: "Unable to retrieve reports at this time." },
    });
  }
});

/**
 * PATCH /api/ai/investigations/:id/reports/:reportId
 * Updates human review status (DRAFT | REVIEWED | APPROVED | REJECTED) or human edited content
 */
aiRouter.patch("/investigations/:id/reports/:reportId", requireAuth, async (req: Request, res: Response) => {
  try {
    const reportId = parseId(req.params.reportId);
    if (isNaN(reportId)) {
      return res.status(400).json({
        success: false,
        error: { code: "INVALID_ID", message: "Invalid report ID" },
      });
    }

    const { status, humanEditedContent } = req.body;
    if (status && !["DRAFT", "REVIEWED", "APPROVED", "REJECTED"].includes(status)) {
      return res.status(400).json({
        success: false,
        error: { code: "INVALID_STATUS", message: "Status must be one of: DRAFT, REVIEWED, APPROVED, REJECTED" },
      });
    }

    const success = await AIService.updateReportStatus(reportId, status, humanEditedContent);
    if (!success) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Report not found or update failed" },
      });
    }

    return res.json({ success: true, data: { reportId, status } });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: { code: "UPDATE_ERROR", message: "Unable to update report at this time." },
    });
  }
});
