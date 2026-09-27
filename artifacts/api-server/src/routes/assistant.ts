import { Router, Request, Response } from "express";
import { OpenAIAssistantService } from "../ai/openaiAssistantService.js";
import { ChatStore } from "../ai/chatStore.js";
import { UsageStore } from "../ai/usageStore.js";
import { aiRateLimiter } from "../lib/security.js";
import { investigationService } from "../analytics/index.js";
import { requireAuth, requireSessionOwnership, canUserAccessInvestigation } from "../middlewares/auth.js";

export const assistantRouter = Router();

const ALLOWED_LANGUAGES = new Set(["en-IN", "ta-IN", "hi-IN", "en", "ta", "hi"]);
const ALLOWED_CONTEXT_TYPES = new Set(["tender", "company", "investigation", "network", "general"]);

/**
 * GET /api/assistant/usage
 * Telemetry endpoint for token consumption, latency, and estimated cost monitoring
 */
assistantRouter.get("/usage", requireAuth, async (_req: Request, res: Response) => {
  try {
    const summary = UsageStore.getSummary();
    return res.json({ success: true, usage: summary });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: { message: "Failed to retrieve usage telemetry." } });
  }
});

/**
 * POST /api/assistant/chat
 * Primary conversation endpoint with OpenAI tool calling, prompt injection defense, and session isolation
 */
assistantRouter.post("/chat", requireAuth, aiRateLimiter, async (req: Request, res: Response) => {
  try {
    const currentUser = req.user!;
    const { message, sessionId, context, language } = req.body || {};

    // 1. Message Validation
    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({
        success: false,
        error: { code: "INVALID_MESSAGE", message: "Message string is required." },
      });
    }

    if (message.length > 3000) {
      return res.status(400).json({
        success: false,
        error: { code: "MESSAGE_TOO_LONG", message: "Message cannot exceed 3000 characters." },
      });
    }

    // 2. Language Validation
    if (language && typeof language === "string" && !ALLOWED_LANGUAGES.has(language)) {
      return res.status(400).json({
        success: false,
        error: { code: "INVALID_LANGUAGE", message: "Language must be one of: en-IN, ta-IN, hi-IN." },
      });
    }

    // 3. Context Validation
    if (context && typeof context === "object") {
      if (context.type && !ALLOWED_CONTEXT_TYPES.has(context.type)) {
        return res.status(400).json({
          success: false,
          error: { code: "INVALID_CONTEXT_TYPE", message: "Invalid context type provided." },
        });
      }

      // 4. Investigation Authorization Check (Pre-LLM)
      if (context.type === "investigation" && context.id) {
        const invId = Number(context.id);
        const authorized = await canUserAccessInvestigation(currentUser, invId);
        if (!authorized) {
          return res.status(403).json({
            success: false,
            error: {
              code: "FORBIDDEN",
              message: `You do not have permission to access investigation #${invId}.`,
            },
          });
        }
      }
    }

    // 5. Session Isolation Check
    if (sessionId && typeof sessionId === "string") {
      const existingSession = await ChatStore.getSession(sessionId);
      if (existingSession && existingSession.userId !== currentUser.id && currentUser.role !== "admin") {
        return res.status(403).json({
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "You do not have permission to access this chat session.",
          },
        });
      }
    }

    console.log(`[CHAT REQUEST]\nuser: ${currentUser.id} (${currentUser.name})\nsessionId: ${sessionId || "new"}\nmessage: ${message.trim()}\ncontext: ${JSON.stringify(context || {})}\nlanguage: ${language || "en-IN"}`);

    const result = await OpenAIAssistantService.chat({
      message: message.trim(),
      sessionId: typeof sessionId === "string" ? sessionId : undefined,
      context: typeof context === "object" ? context : undefined,
      language: typeof language === "string" ? language : undefined,
      userId: currentUser.id,
    });

    return res.json(result);
  } catch (error: any) {
    console.error("[Assistant Route] Error processing chat:", error.message);
    return res.status(500).json({
      success: false,
      error: {
        code: "ASSISTANT_ERROR",
        message: "AI assistance is temporarily unavailable. You can continue reviewing the verified BidShield data.",
      },
    });
  }
});

/**
 * POST /api/assistant/save-finding
 * Save a useful chatbot finding as an official AI-assisted note in an investigation
 */
assistantRouter.post("/save-finding", requireAuth, async (req: Request, res: Response) => {
  try {
    const currentUser = req.user!;
    const { investigationId, sourceQuestion, assistantResponse, evidenceIds } = req.body || {};
    const invId = Number(investigationId) || 1;

    // Check investigation authorization
    const authorized = await canUserAccessInvestigation(currentUser, invId);
    if (!authorized) {
      return res.status(403).json({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: `You do not have permission to modify investigation #${invId}.`,
        },
      });
    }

    if (!assistantResponse || typeof assistantResponse !== "string" || !assistantResponse.trim()) {
      return res.status(400).json({
        success: false,
        error: { code: "INVALID_NOTE", message: "assistantResponse content is required." },
      });
    }

    const cleanEvidence = Array.isArray(evidenceIds) ? evidenceIds.filter(Boolean) : [];
    const noteText = `[AI-Assisted Investigation Note]
Question: "${sourceQuestion || "Investigative Analysis"}"
Logged: ${new Date().toISOString()}
Author: ${currentUser.name} (${currentUser.id})
Referenced Evidence: ${cleanEvidence.length > 0 ? cleanEvidence.join(", ") : "None"}

${assistantResponse.trim()}

---
Note: This is an AI-assisted investigative note summarizing verified BidShield screening data. It does not constitute official judicial evidence.`;

    const noteItem = await investigationService.addNote(invId, noteText, {
      userId: currentUser.id,
      userName: currentUser.name,
    });

    return res.status(201).json({
      success: true,
      note: noteItem,
      message: "Chat finding successfully saved as an AI-assisted investigation note.",
    });
  } catch (error: any) {
    console.error("[Assistant Route] Error saving finding:", error.message);
    return res.status(500).json({
      success: false,
      error: { message: error.message || "Failed to save finding to investigation." },
    });
  }
});

/**
 * GET /api/assistant/sessions
 * List recent conversation sessions strictly scoped to current authenticated user
 */
assistantRouter.get("/sessions", requireAuth, async (req: Request, res: Response) => {
  try {
    const currentUser = req.user!;
    const sessions = await ChatStore.getSessions(currentUser.id);
    return res.json({ success: true, sessions });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: { message: "Failed to list sessions." } });
  }
});

/**
 * POST /api/assistant/sessions
 * Create a new conversation session associated with the current authenticated user
 */
assistantRouter.post("/sessions", requireAuth, async (req: Request, res: Response) => {
  try {
    const currentUser = req.user!;
    const { title, contextType, contextId, language } = req.body || {};

    if (contextType && !ALLOWED_CONTEXT_TYPES.has(contextType)) {
      return res.status(400).json({
        success: false,
        error: { code: "INVALID_CONTEXT_TYPE", message: "Invalid context type provided." },
      });
    }

    const session = await ChatStore.createSession({
      title,
      contextType,
      contextId,
      language,
      userId: currentUser.id,
    });
    return res.json({ success: true, session });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: { message: "Failed to create session." } });
  }
});

/**
 * GET /api/assistant/sessions/:id
 * Retrieve session messages with strict ownership verification
 */
assistantRouter.get("/sessions/:id", requireAuth, requireSessionOwnership, async (req: Request, res: Response) => {
  try {
    const sessionId = String(req.params.id);
    const session = await ChatStore.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ success: false, error: { message: "Session not found." } });
    }

    const messages = await ChatStore.getMessages(sessionId);
    return res.json({ success: true, session, messages });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: { message: "Failed to load session." } });
  }
});

/**
 * DELETE /api/assistant/sessions/:id
 * Remove a session and its message history with strict ownership verification
 */
assistantRouter.delete("/sessions/:id", requireAuth, requireSessionOwnership, async (req: Request, res: Response) => {
  try {
    const sessionId = String(req.params.id);
    await ChatStore.deleteSession(sessionId);
    return res.json({ success: true, message: "Session deleted." });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: { message: "Failed to delete session." } });
  }
});
