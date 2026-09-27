import { AnalyticsEvidence } from "../../common/types";
import { CoverBidMetricsResult } from "./metrics";
import { ComparisonScope } from "../../common/types";

let nextEvidenceId = 2000;

export function generateCoverBidEvidence(
  metrics: CoverBidMetricsResult,
  scope: ComparisonScope,
  coverBidScore: number | null,
  supportingTenderIds: number[]
): AnalyticsEvidence[] {
  const evidence: AnalyticsEvidence[] = [];

  if (metrics.bidCount < 2 || coverBidScore === null) {
    evidence.push({
      id: nextEvidenceId++,
      indicatorType: "COVER_BID",
      description: "Insufficient bid count in this tender to assess relative bid positioning.",
      metric: "Tender bid count",
      observedValue: `${metrics.bidCount} bid recorded`,
      expectedValue: "≥ 2 bids required for relative spread evaluation",
      confidence: 0.2,
      severity: "Informational",
      supportingTenderIds,
    });
    return evidence;
  }

  // 1. Evidence for each bidder exhibiting repeated historical positioning
  metrics.bidPositions
    .filter((pos) => !pos.isWinner && pos.isRepeatedProximity && pos.historicalMedianDistancePct !== null)
    .forEach((pos) => {
      const stdText = pos.historicalStdDevDistancePct !== null ? ` (std dev: ${pos.historicalStdDevDistancePct.toFixed(1)}%)` : "";
      evidence.push({
        id: nextEvidenceId++,
        indicatorType: "COVER_BID",
        description: `${pos.companyName} submitted a bid +${pos.relativeDistancePct.toFixed(1)}% above the winning bid. Across ${pos.historicalComparableObservations} comparable tenders in ${scope.category}, its median relative distance from the winner is +${pos.historicalMedianDistancePct?.toFixed(1)}%${stdText}, showing a repeated bid-positioning pattern that warrants review.`,
        metric: "Historical relative bid distance consistency",
        observedValue: `Current: +${pos.relativeDistancePct.toFixed(1)}% (Historical median: +${pos.historicalMedianDistancePct?.toFixed(1)}%)`,
        expectedValue: "Variable pricing spread across competitive tenders",
        confidence: Math.min(0.95, 0.55 + pos.historicalComparableObservations * 0.05),
        severity: coverBidScore >= 65 ? "Review suggested" : "Informational",
        supportingTenderIds,
      });
    });

  // 2. Evidence for tight losing-bid clustering / spread anomaly
  if (metrics.currentRelativeDistances.length >= 2 && metrics.clusteringStdDev <= 1.5) {
    const minDelta = Math.min(...metrics.currentRelativeDistances).toFixed(1);
    const maxDelta = Math.max(...metrics.currentRelativeDistances).toFixed(1);
    evidence.push({
      id: nextEvidenceId++,
      indicatorType: "COVER_BID",
      description: `Losing bids in this tender are clustered in a narrow band (+${minDelta}% to +${maxDelta}% above winning bid, standard deviation: ${metrics.clusteringStdDev.toFixed(2)}%), presenting a tightly grouped positioning pattern.`,
      metric: "Losing bid spread and clustering standard deviation",
      observedValue: `Spread: ${metrics.bidSpreadPct.toFixed(1)}%, Std Dev: ${metrics.clusteringStdDev.toFixed(2)}%`,
      expectedValue: "Normal dispersed competitive price distribution",
      confidence: Math.min(0.9, 0.5 + (2.0 - metrics.clusteringStdDev) * 0.25),
      severity: metrics.clusteringStdDev <= 0.8 ? "Review suggested" : "Informational",
      supportingTenderIds,
    });
  }

  // 3. Fallback baseline evidence if no flagged repeated patterns
  if (evidence.length === 0) {
    evidence.push({
      id: nextEvidenceId++,
      indicatorType: "COVER_BID",
      description: `Observed bid spread across ${metrics.bidCount} bidders shows typical dispersed positioning (+${metrics.meanRelativeDistance.toFixed(1)}% average distance from winner; spread: ${metrics.bidSpreadPct.toFixed(1)}%).`,
      metric: "Average relative bid distance from winner",
      observedValue: `+${metrics.meanRelativeDistance.toFixed(1)}% (Spread: ${metrics.bidSpreadPct.toFixed(1)}%)`,
      expectedValue: "Competitive market dispersion",
      confidence: 0.65,
      severity: "Informational",
      supportingTenderIds,
    });
  }

  return evidence;
}
