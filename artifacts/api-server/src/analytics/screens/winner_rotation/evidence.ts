import { AnalyticsEvidence } from "../../common/types";
import { WinnerRotationMetricsResult } from "./metrics";
import { ComparisonScope } from "../../common/types";

let nextEvidenceId = 1000;

export function generateRotationEvidence(
  metrics: WinnerRotationMetricsResult,
  scope: ComparisonScope,
  rotationScore: number | null,
  supportingTenderIds: number[]
): AnalyticsEvidence[] {
  const evidence: AnalyticsEvidence[] = [];

  if (metrics.sampleSize < 3 || rotationScore === null) {
    evidence.push({
      id: nextEvidenceId++,
      indicatorType: "WINNER_ROTATION",
      description: "Limited historical baseline in the selected comparison group. Sample size is insufficient to establish a meaningful rotation pattern.",
      metric: "Comparable tender sample size",
      observedValue: `${metrics.sampleSize} tenders observed`,
      expectedValue: "≥ 3 comparable tenders required",
      confidence: 0.2,
      severity: "Informational",
      supportingTenderIds,
    });
    return evidence;
  }

  const alternationPct = Math.round(metrics.alternationFrequency * 100);
  const transitionPct = Math.round(metrics.winnerTransitionPattern * 100);
  const groupOverlapPct = Math.round(metrics.repeatedGroupRate * 100);
  const recurringNames = metrics.recurringBidders.slice(0, 4).map((b) => b.companyName).join(", ");

  // Evidence 1: Alternation frequency among comparable tenders
  if (metrics.alternationCount > 0) {
    evidence.push({
      id: nextEvidenceId++,
      indicatorType: "WINNER_ROTATION",
      description: `Within the selected comparison group (${scope.category} / ${scope.organization}), ${metrics.recurringBidders.length} recurring companies participated across ${metrics.sampleSize} tenders. Wins alternated between distinct bidders in ${metrics.alternationCount} of ${metrics.totalTransitions} observed transitions (${alternationPct}% alternation rate).`,
      metric: "Alternation frequency across comparable sequence",
      observedValue: `${metrics.alternationCount} / ${metrics.totalTransitions} transitions (${alternationPct}%)`,
      expectedValue: "Baseline varies by market competitiveness",
      confidence: Math.min(0.95, 0.5 + metrics.sampleSize * 0.04),
      severity: rotationScore >= 65 ? "Elevated review" : "Informational",
      supportingTenderIds,
    });
  }

  // Evidence 2: Recurring participant cohort
  if (metrics.recurringBidders.length >= 2 && metrics.repeatedGroupRate > 0.3) {
    evidence.push({
      id: nextEvidenceId++,
      indicatorType: "WINNER_ROTATION",
      description: `A recurring cohort of bidders (${recurringNames}) appeared together across multiple comparable tenders with an average cohort overlap rate of ${groupOverlapPct}%.`,
      metric: "Recurring participant set overlap",
      observedValue: `${groupOverlapPct}% average cohort overlap (${metrics.recurringBidders.length} recurring firms)`,
      expectedValue: "Open competitive participation baseline",
      confidence: Math.min(0.9, 0.45 + metrics.repeatedGroupRate * 0.5),
      severity: metrics.repeatedGroupRate >= 0.6 ? "Moderate indicator" : "Informational",
      supportingTenderIds,
    });
  }

  // Evidence 3: Transition & regularity structure
  if (metrics.sequenceRegularity > 0.4 || metrics.winnerTransitionPattern > 0.5) {
    evidence.push({
      id: nextEvidenceId++,
      indicatorType: "WINNER_ROTATION",
      description: `Observed winner sequence shows structured transitions among recurring bidders (${transitionPct}% recurring transition rate) with sequence regularity of ${Math.round(metrics.sequenceRegularity * 100)}%.`,
      metric: "Winner transition regularity",
      observedValue: `Transition index: ${metrics.winnerTransitionPattern.toFixed(2)}, Regularity: ${(metrics.sequenceRegularity * 100).toFixed(0)}%`,
      expectedValue: "Unstructured competitive distribution",
      confidence: Math.min(0.9, 0.5 + metrics.sequenceRegularity * 0.4),
      severity: rotationScore >= 65 ? "Elevated review" : "Informational",
      supportingTenderIds,
    });
  }

  return evidence;
}
