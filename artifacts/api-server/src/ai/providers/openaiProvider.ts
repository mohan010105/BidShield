import { AIProvider, EvidenceContext, InvestigationSummaryResult, InvestigationReportResult, InvestigationChatResult, SYSTEM_PROMPT } from "../types.js";
import { generateFallbackSummary, generateFallbackReport, sanitizeUserInput, validateAIOutputText } from "../validator.js";

export class OpenAICompatibleAIProvider implements AIProvider {
  name: string;
  model: string;
  private apiKey: string;
  private endpoint: string;

  constructor(apiKey: string, model?: string, endpoint?: string, providerName?: string) {
    this.name = providerName || "openai";
    this.model = model || "gpt-4o-mini";
    this.apiKey = apiKey;
    this.endpoint = endpoint || "https://api.openai.com/v1/chat/completions";
  }

  private async callLLM(messages: Array<{ role: string; content: string }>): Promise<string> {
    if (!this.apiKey) {
      throw new Error("Missing AI API key");
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 sec timeout

    try {
      const res = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: 0.2, // Low temperature for deterministic, factual outputs
          response_format: { type: "json_object" },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`AI API error status ${res.status}`);
      }

      const data = await res.json() as any;
      const content = data?.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error("Empty response from AI Provider");
      }
      return content;
    } catch (err: any) {
      clearTimeout(timeoutId);
      throw err;
    }
  }

  async generateInvestigationSummary(context: EvidenceContext): Promise<InvestigationSummaryResult> {
    try {
      const prompt = `
System Instruction:
${SYSTEM_PROMPT}

Data Context:
${JSON.stringify(context, null, 2)}

Task:
Generate a structured JSON investigation summary adhering to this JSON schema:
{
  "overview": string,
  "screeningLevel": string,
  "screeningScore": number,
  "keyObservations": string[],
  "supportingEvidence": [{"evidenceId": string, "indicator": string, "summary": string}],
  "dataLimitations": string[],
  "recommendedReviewActions": string[],
  "disclaimer": string
}
`.trim();

      const raw = await this.callLLM([{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: prompt }]);
      const parsed = JSON.parse(raw);

      // Validate output safety
      const val = validateAIOutputText(parsed.overview + " " + JSON.stringify(parsed.keyObservations));
      if (!val.valid) {
        return generateFallbackSummary(context, this.name, this.model);
      }

      const evidenceSnapshot = (context.evidence || []).map(e => String(e.id));

      return {
        overview: parsed.overview || `Investigation summary for tender ${context.tender.tenderNumber}.`,
        screeningLevel: parsed.screeningLevel || context.risk.riskLevel,
        screeningScore: parsed.screeningScore ?? context.risk.overallScore,
        keyObservations: Array.isArray(parsed.keyObservations) ? parsed.keyObservations : [],
        supportingEvidence: Array.isArray(parsed.supportingEvidence) ? parsed.supportingEvidence : [],
        dataLimitations: Array.isArray(parsed.dataLimitations) ? parsed.dataLimitations : [],
        recommendedReviewActions: Array.isArray(parsed.recommendedReviewActions) ? parsed.recommendedReviewActions : [],
        disclaimer: context.methodology.disclaimer,
        provider: this.name,
        model: this.model,
        promptVersion: "investigation_summary_v1.0",
        evidenceSnapshot,
      };
    } catch (e) {
      // Graceful fallback on API error or invalid JSON
      return generateFallbackSummary(context, this.name, this.model);
    }
  }

  async generateInvestigationReport(context: EvidenceContext): Promise<InvestigationReportResult> {
    try {
      const prompt = `
System Instruction:
${SYSTEM_PROMPT}

Data Context:
${JSON.stringify(context, null, 2)}

Task:
Generate a comprehensive 13-section structured draft report in JSON:
{
  "title": string,
  "executiveSummary": string,
  "sections": {
    "executiveSummary": string,
    "tenderInformation": string,
    "procurementContext": string,
    "participatingCompanies": string,
    "bidAnalysis": string,
    "statisticalIndicators": string,
    "evidence": string,
    "historicalPatterns": string,
    "networkObservations": string,
    "dataQualityAndLimitations": string,
    "areasForFurtherReview": string,
    "methodology": string,
    "disclaimer": string
  }
}
`.trim();

      const raw = await this.callLLM([{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: prompt }]);
      const parsed = JSON.parse(raw);

      const val = validateAIOutputText(JSON.stringify(parsed));
      if (!val.valid) {
        return generateFallbackReport(context, this.name, this.model);
      }

      const evidenceSnapshot = (context.evidence || []).map(e => String(e.id));

      return {
        title: parsed.title || `AI-Assisted Investigation Draft — Tender ${context.tender.tenderNumber}`,
        executiveSummary: parsed.executiveSummary || parsed.sections?.executiveSummary || "",
        screeningLevel: context.risk.riskLevel,
        sections: parsed.sections || generateFallbackReport(context, this.name, this.model).sections,
        evidenceSnapshot,
        provider: this.name,
        model: this.model,
        promptVersion: "investigation_report_v1.0",
        generatedAt: new Date().toISOString(),
        disclaimer: context.methodology.disclaimer,
      };
    } catch (e) {
      return generateFallbackReport(context, this.name, this.model);
    }
  }

  async answerEvidenceQuestion(context: EvidenceContext, question: string): Promise<InvestigationChatResult> {
    const cleanQ = sanitizeUserInput(question);

    try {
      const prompt = `
System Instruction:
${SYSTEM_PROMPT}

Context:
${JSON.stringify(context, null, 2)}

User Question:
${cleanQ}

Return JSON:
{
  "answer": string,
  "sources": [{"evidenceId": string, "indicator": string, "description": string}]
}
`.trim();

      const raw = await this.callLLM([{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: prompt }]);
      const parsed = JSON.parse(raw);

      const val = validateAIOutputText(parsed.answer);
      if (!val.valid) {
        return {
          answer: "The available data contains statistical indicators that may warrant further review, but the screening results do not establish collusion, fraud, or legal liability.",
          sources: (context.evidence || []).slice(0, 2).map(e => ({ evidenceId: String(e.id), indicator: e.indicatorType, description: e.description })),
          disclaimer: context.methodology.disclaimer,
          provider: this.name,
          model: this.model,
          promptVersion: "investigation_chat_v1.0",
        };
      }

      return {
        answer: parsed.answer,
        sources: Array.isArray(parsed.sources) ? parsed.sources : [],
        disclaimer: context.methodology.disclaimer,
        provider: this.name,
        model: this.model,
        promptVersion: "investigation_chat_v1.0",
      };
    } catch (e) {
      return {
        answer: `Based on BidShield's records for tender ${context.tender.tenderNumber}, ${context.bids.length} bids were evaluated. Overall screening score: ${context.risk.overallScore ?? 'N/A'}/100 (${context.risk.riskLevel}).`,
        sources: (context.evidence || []).slice(0, 2).map(e => ({ evidenceId: String(e.id), indicator: e.indicatorType, description: e.description })),
        disclaimer: context.methodology.disclaimer,
        provider: this.name,
        model: this.model,
        promptVersion: "investigation_chat_v1.0",
      };
    }
  }
}
