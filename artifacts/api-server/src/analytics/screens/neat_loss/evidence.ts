import { AnalyticsEvidence } from "../../common/types";
import { CompanyNeatLossMetrics } from "./types";

let evidenceCounter = 60000;

export function generateNeatLossEvidence(
  metrics: CompanyNeatLossMetrics,
  targetTenderId?: number
): AnalyticsEvidence[] {
  const evidence: AnalyticsEvidence[] = [];
  const supportingTenderIds = metrics.observations.map((o) => o.tenderId);

  if (metrics.isInsufficientData) {
    evidence.push({
      id: evidenceCounter++,
      indicatorType: "NEAT_LOSS",
      companyId: metrics.companyId,
      tenderId: targetTenderId,
      methodologyVersion: metrics.methodologyVersion,
      description: `Insufficient data: ${metrics.companyName} has only ${metrics.sampleSize} comparable losing observations recorded (minimum 5 required for statistical losing-bid analysis).`,
      metric: "Sample size adequacy",
      observedValue: `${metrics.sampleSize} observations`,
      expectedValue: "Minimum 5 comparable losing observations",
      confidence: 0.2,
      severity: "Low",
      supportingTenderIds,
    });
    return evidence;
  }

  const lossPct = Math.round(metrics.lossRate * 100);
  const cvVal = metrics.relativeGapCv !== null ? metrics.relativeGapCv.toFixed(4) : "N/A";
  const medianGapVal = metrics.medianRelativeGapPct !== null ? `+${metrics.medianRelativeGapPct.toFixed(2)}%` : "N/A";
  const stdDevVal = metrics.relativeGapStdDev !== null ? `±${metrics.relativeGapStdDev.toFixed(2)}%` : "N/A";

  // Evidence 1: Primary Relative Gap Consistency
  if (metrics.relativeGapCv !== null && metrics.relativeGapCv <= 0.25) {
    const isElevated = metrics.relativeGapCv <= 0.15;
    evidence.push({
      id: evidenceCounter++,
      indicatorType: "NEAT_LOSS",
      companyId: metrics.companyId,
      tenderId: targetTenderId,
      methodologyVersion: metrics.methodologyVersion,
      description: `Observed pattern: ${metrics.companyName} participated in ${metrics.participationCount} comparable tenders and lost ${metrics.lossCount} (${lossPct}% loss rate). In ${metrics.sampleSize} comparable losing observations, its relative losing-bid gap remained within an unusually narrow range (median ${medianGapVal}, std dev ${stdDevVal}, CV ${cvVal}) above the winning bid. Why flagged: The observed gap variation is statistically low relative to baseline competitive procurement dispersion. Interpretation: This is a statistical screening signal that may warrant further review. It does not establish collusion or wrongdoing.`,
      metric: "Relative losing-bid gap consistency",
      observedValue: `CV: ${cvVal}, Median Gap: ${medianGapVal} (across ${metrics.sampleSize} tenders)`,
      expectedValue: "Baseline competitive CV > 0.25 across comparable tenders",
      confidence: Math.min(0.9, 0.5 + (metrics.sampleSize / 20)),
      severity: isElevated ? "Elevated" : "Moderate",
      supportingTenderIds,
    });
  }

  // Evidence 2: Repeated Bid Rank (e.g. Repeated Rank 2 / runner-up)
  if (metrics.repeatedRankCount >= 4 && (metrics.repeatedRankCount / metrics.lossCount) >= 0.50) {
    const repPct = Math.round((metrics.repeatedRankCount / metrics.lossCount) * 100);
    evidence.push({
      id: evidenceCounter++,
      indicatorType: "NEAT_LOSS",
      companyId: metrics.companyId,
      tenderId: targetTenderId,
      methodologyVersion: metrics.methodologyVersion,
      description: `Observed rank pattern: ${metrics.companyName} finished at Rank ${metrics.mostFrequentRank} in ${metrics.repeatedRankCount} of ${metrics.lossCount} comparable losing tenders (${repPct}% rank consistency). Why flagged: Unusually repeated runner-up or fixed position bidding behavior observed across comparable tenders within ${metrics.comparisonGroup}. Interpretation: Consistent positioning can arise legitimately from standardized cost models, but warrants observational screening review.`,
      metric: "Bid rank repetition",
      observedValue: `Rank ${metrics.mostFrequentRank} in ${metrics.repeatedRankCount}/${metrics.lossCount} tenders (${repPct}%)`,
      expectedValue: "Dispersed rank distribution across competitive tenders",
      confidence: Math.min(0.85, 0.5 + (metrics.repeatedRankCount / 15)),
      severity: repPct >= 70 ? "Elevated" : "Moderate",
      supportingTenderIds,
    });
  }

  // Evidence 3: High Participation with Persistent Loss Rate
  if (metrics.participationCount >= 6 && metrics.lossRate >= 0.85) {
    evidence.push({
      id: evidenceCounter++,
      indicatorType: "NEAT_LOSS",
      companyId: metrics.companyId,
      tenderId: targetTenderId,
      methodologyVersion: metrics.methodologyVersion,
      description: `Observed participation structure: ${metrics.companyName} exhibited high participation frequency (${metrics.participationCount} tenders) with persistent losing outcome (${metrics.lossCount} losses, ${lossPct}% loss rate) in ${metrics.comparisonGroup}. Note: High participation with infrequent awards is common in competitive bidding and is evaluated in conjunction with bid-gap stability.`,
      metric: "Participation vs win rate",
      observedValue: `${metrics.lossCount} losses in ${metrics.participationCount} tenders (${lossPct}% loss rate)`,
      expectedValue: "Normal competitive participation with variable win-loss distribution",
      confidence: 0.65,
      severity: metrics.lossRate >= 0.90 ? "Moderate" : "Low",
      supportingTenderIds,
    });
  }

  // Evidence 4: Tender-specific contribution (if target tender provided)
  if (targetTenderId) {
    const currentObs = metrics.observations.find((o) => o.tenderId === targetTenderId);
    if (currentObs) {
      evidence.push({
        id: evidenceCounter++,
        indicatorType: "NEAT_LOSS",
        companyId: metrics.companyId,
        tenderId: targetTenderId,
        methodologyVersion: metrics.methodologyVersion,
        description: `Tender contribution: In tender ${currentObs.tenderNumber}, ${metrics.companyName} submitted a losing bid of ₹${currentObs.bidAmount.toLocaleString("en-IN")} (gap: +${currentObs.relativeGapPct.toFixed(2)}% above winner, Rank ${currentObs.bidRank}), consistent with its historical median gap of ${medianGapVal}.`,
        metric: "Tender-level losing-bid alignment",
        observedValue: `Gap: +${currentObs.relativeGapPct.toFixed(2)}%, Rank: ${currentObs.bidRank}`,
        expectedValue: `Historical median gap: ${medianGapVal}`,
        confidence: 0.75,
        severity: "Informational",
        supportingTenderIds: [targetTenderId],
      });
    }
  }

  // Fallback baseline evidence if no specific elevated condition triggered
  if (evidence.length === 0) {
    evidence.push({
      id: evidenceCounter++,
      indicatorType: "NEAT_LOSS",
      companyId: metrics.companyId,
      tenderId: targetTenderId,
      methodologyVersion: metrics.methodologyVersion,
      description: `Observed losing-bid pattern for ${metrics.companyName}: Evaluated ${metrics.sampleSize} comparable losing bids in ${metrics.comparisonGroup}. Relative bid gaps show normal dispersion (median ${medianGapVal}, CV ${cvVal}) with no elevated consistency signals observed.`,
      metric: "Relative losing-bid gap consistency",
      observedValue: `CV: ${cvVal}, Median Gap: ${medianGapVal}`,
      expectedValue: "Baseline competitive CV > 0.25",
      confidence: 0.5,
      severity: "Low",
      supportingTenderIds,
    });
  }

  return evidence;
}
