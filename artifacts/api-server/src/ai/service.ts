import { db, investigationReportsTable, investigationsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { buildEvidenceContext } from "./contextBuilder.js";
import { getAIProvider } from "./providerFactory.js";
import { EvidenceContext, InvestigationSummaryResult, InvestigationReportResult, InvestigationChatResult } from "./types.js";

export class AIService {
  /**
   * Generates or retrieves an AI investigation summary.
   */
  static async generateSummary(investigationId: number, language?: string): Promise<InvestigationSummaryResult> {
    const context = await buildEvidenceContext(investigationId, language);
    const provider = getAIProvider();
    const result = await provider.generateInvestigationSummary(context);

    // Save summary record in investigation_reports table
    try {
      await db.insert(investigationReportsTable).values({
        tenderId: context.tender.id,
        investigationId,
        reportType: "SUMMARY",
        status: "DRAFT",
        generatedContent: JSON.stringify(result),
        generatedSummary: result.overview,
        screeningLevel: result.screeningLevel,
        provider: result.provider,
        model: result.model,
        promptVersion: result.promptVersion,
        evidenceSnapshot: JSON.stringify(result.evidenceSnapshot),
        isStale: false,
      });
    } catch (e) {
      // Non-blocking log if DB unavailable
    }

    return result;
  }

  /**
   * Generates a comprehensive 13-section AI investigation draft report.
   */
  static async generateReport(investigationId: number, language?: string): Promise<{ report: InvestigationReportResult; reportId?: number }> {
    const context = await buildEvidenceContext(investigationId, language);
    const provider = getAIProvider();
    const result = await provider.generateInvestigationReport(context);

    let reportId: number | undefined = undefined;

    try {
      const [inserted] = await db.insert(investigationReportsTable).values({
        tenderId: context.tender.id,
        investigationId,
        reportType: "FULL_REPORT",
        status: "DRAFT",
        generatedContent: JSON.stringify(result),
        generatedSummary: result.executiveSummary,
        screeningLevel: result.screeningLevel,
        provider: result.provider,
        model: result.model,
        promptVersion: result.promptVersion,
        evidenceSnapshot: JSON.stringify(result.evidenceSnapshot),
        isStale: false,
      }).returning({ id: investigationReportsTable.id });

      if (inserted) {
        reportId = inserted.id;
      }
    } catch (e) {
      // Non-blocking
    }

    return { report: result, reportId };
  }

  /**
   * Answers a specific user question about an investigation context.
   */
  static async answerQuestion(investigationId: number, question: string, language?: string): Promise<InvestigationChatResult> {
    const context = await buildEvidenceContext(investigationId, language);
    const provider = getAIProvider();
    return await provider.answerEvidenceQuestion(context, question);
  }

  /**
   * Retrieves historical saved reports for an investigation.
   */
  static async getSavedReports(investigationId: number) {
    try {
      const reports = await db
        .select()
        .from(investigationReportsTable)
        .where(eq(investigationReportsTable.investigationId, investigationId))
        .orderBy(desc(investigationReportsTable.createdAt));

      const context = await buildEvidenceContext(investigationId);
      const currentSnapshot = JSON.stringify((context.evidence || []).map(e => String(e.id)));

      return reports.map(r => ({
        ...r,
        isStale: r.evidenceSnapshot ? r.evidenceSnapshot !== currentSnapshot : false,
      }));
    } catch (e) {
      return [];
    }
  }

  /**
   * Updates human review status and/or human edited content.
   */
  static async updateReportStatus(
    reportId: number,
    status: "DRAFT" | "REVIEWED" | "APPROVED" | "REJECTED",
    humanEditedContent?: string
  ) {
    try {
      const updatePayload: any = { status };
      if (humanEditedContent !== undefined) {
        updatePayload.humanEditedContent = humanEditedContent;
      }

      await db
        .update(investigationReportsTable)
        .set(updatePayload)
        .where(eq(investigationReportsTable.id, reportId));

      return true;
    } catch (e) {
      return false;
    }
  }
}
