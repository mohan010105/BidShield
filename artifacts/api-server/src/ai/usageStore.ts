/**
 * Phase 18: AI Usage & Cost Monitoring Store
 * 
 * Tracks OpenAI requests, token consumption, latency, and estimated cost.
 * Strictly avoids storing API keys or private conversational text.
 */

export interface AIUsageRecord {
  id: string;
  timestamp: string;
  userId: string;
  sessionId?: string;
  intent: string;
  model: string;
  source: "openai" | "deterministic" | "fallback";
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  durationMs: number;
  status: "success" | "error" | "rate_limited";
  estimatedCostUSD: number;
}

export interface AIUsageSummary {
  totalRequests: number;
  requestsBySource: {
    openai: number;
    deterministic: number;
    fallback: number;
  };
  requestsByUser: Record<string, number>;
  requestsByDay: Record<string, number>;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  estimatedCostUSD: number;
  failedRequests: number;
  averageResponseTimeMs: number;
}

// In-memory telemetry log (capped at 5000 items to prevent unbounded memory growth)
const usageLog: AIUsageRecord[] = [];
const MAX_LOG_SIZE = 5000;

// Pricing constants (USD per 1M tokens) - based on gpt-4o-mini
const PRICING_PER_MILLION = {
  "gpt-4o-mini": { input: 0.15, output: 0.60 },
  "gpt-4o": { input: 2.50, output: 10.00 },
  "default": { input: 0.15, output: 0.60 },
};

export class UsageStore {
  /**
   * Calculate estimated cost in USD based on model and token counts
   */
  static calculateCost(model: string, promptTokens: number, completionTokens: number): number {
    const rates = PRICING_PER_MILLION[model as keyof typeof PRICING_PER_MILLION] || PRICING_PER_MILLION["default"];
    const inputCost = (promptTokens / 1_000_000) * rates.input;
    const outputCost = (completionTokens / 1_000_000) * rates.output;
    return Number((inputCost + outputCost).toFixed(6));
  }

  /**
   * Record a completed AI or deterministic request
   */
  static record(entry: {
    userId?: string;
    sessionId?: string;
    intent: string;
    model: string;
    source: "openai" | "deterministic" | "fallback";
    promptTokens?: number;
    completionTokens?: number;
    durationMs: number;
    status: "success" | "error" | "rate_limited";
  }): AIUsageRecord {
    const promptTokens = entry.promptTokens || 0;
    const completionTokens = entry.completionTokens || 0;
    const totalTokens = promptTokens + completionTokens;
    const estimatedCostUSD = this.calculateCost(entry.model, promptTokens, completionTokens);

    const record: AIUsageRecord = {
      id: `ai-req-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      userId: entry.userId || "anonymous",
      sessionId: entry.sessionId,
      intent: entry.intent,
      model: entry.model,
      source: entry.source,
      promptTokens,
      completionTokens,
      totalTokens,
      durationMs: entry.durationMs,
      status: entry.status,
      estimatedCostUSD,
    };

    usageLog.push(record);
    if (usageLog.length > MAX_LOG_SIZE) {
      usageLog.shift();
    }

    return record;
  }

  /**
   * Return aggregated AI usage statistics
   */
  static getSummary(): AIUsageSummary {
    const summary: AIUsageSummary = {
      totalRequests: usageLog.length,
      requestsBySource: { openai: 0, deterministic: 0, fallback: 0 },
      requestsByUser: {},
      requestsByDay: {},
      totalTokens: 0,
      promptTokens: 0,
      completionTokens: 0,
      estimatedCostUSD: 0,
      failedRequests: 0,
      averageResponseTimeMs: 0,
    };

    let totalDuration = 0;

    for (const record of usageLog) {
      // By source
      if (record.source === "openai") summary.requestsBySource.openai++;
      else if (record.source === "deterministic") summary.requestsBySource.deterministic++;
      else summary.requestsBySource.fallback++;

      // By user
      summary.requestsByUser[record.userId] = (summary.requestsByUser[record.userId] || 0) + 1;

      // By day (YYYY-MM-DD)
      const day = record.timestamp.split("T")[0];
      summary.requestsByDay[day] = (summary.requestsByDay[day] || 0) + 1;

      // Tokens & costs
      summary.promptTokens += record.promptTokens;
      summary.completionTokens += record.completionTokens;
      summary.totalTokens += record.totalTokens;
      summary.estimatedCostUSD += record.estimatedCostUSD;

      // Failures
      if (record.status !== "success") {
        summary.failedRequests++;
      }

      totalDuration += record.durationMs;
    }

    summary.estimatedCostUSD = Number(summary.estimatedCostUSD.toFixed(4));
    summary.averageResponseTimeMs = usageLog.length > 0 ? Math.round(totalDuration / usageLog.length) : 0;

    return summary;
  }

  /**
   * Clear telemetry records (useful for testing)
   */
  static clear(): void {
    usageLog.length = 0;
  }
}
