import { AnalyticsEvidence, ComparisonScope } from "../../common/types";
import { PriceClusteringMetricsResult } from "./metrics";

export function generatePriceClusteringEvidence(
  metrics: PriceClusteringMetricsResult,
  scope: ComparisonScope,
  score: number | null,
  supportingTenderIds: number[]
): AnalyticsEvidence[] {
  const evidence: AnalyticsEvidence[] = [];
  let nextId = 1;

  if (metrics.isInsufficientData || score === null) {
    evidence.push({
      id: nextId++,
      indicatorType: "PRICE_CLUSTERING",
      description:
        metrics.insufficientReason ??
        `Insufficient data to compute price clustering indicators for tender ${metrics.tenderNumber}.`,
      metric: "Sample Size Adequacy",
      observedValue: `${metrics.bidCount} bids, ${metrics.comparableTenderCount} comparable tenders`,
      expectedValue: `Min 3 bids, min 5 comparable tenders`,
      confidence: 0.2,
      severity: "Informational",
      supportingTenderIds: supportingTenderIds.slice(0, 10),
    });
    return evidence;
  }

  const cv = metrics.coefficientOfVariation.toFixed(4);
  const histCv = metrics.historicalMedianCV !== null ? metrics.historicalMedianCV.toFixed(4) : "N/A";
  const pctRank = metrics.cvPercentile !== null ? `${metrics.cvPercentile.toFixed(0)}th percentile` : "N/A";
  const spreadPct = `${metrics.normalizedSpreadPct.toFixed(1)}%`;
  const histSpreadPct = metrics.historicalMedianSpreadPct !== null ? `${metrics.historicalMedianSpreadPct.toFixed(1)}%` : "N/A";

  const severity =
    score >= 80 ? "High" : score >= 60 ? "Elevated" : score >= 30 ? "Moderate" : "Informational";
  const confidence = metrics.bidCount >= 4 && metrics.comparableTenderCount >= 8 ? 0.9 : 0.75;

  // Evidence 1: Coefficient of Variation & Percentile Ranking
  evidence.push({
    id: nextId++,
    indicatorType: "PRICE_CLUSTERING",
    description: `Tender ${metrics.tenderNumber} exhibits an unusually concentrated bid coefficient of variation (CV = ${cv}) across ${metrics.bidCount} bids, ranking at the ${pctRank} against ${metrics.comparableTenderCount} comparable tenders (historical median CV = ${histCv}).`,
    metric: "Coefficient of Variation (CV)",
    observedValue: `${cv} (${pctRank})`,
    expectedValue: `${histCv} (comparable median)`,
    confidence,
    severity,
    supportingTenderIds: supportingTenderIds.slice(0, 10),
  });

  // Evidence 2: Normalized Bid Spread Dispersion
  evidence.push({
    id: nextId++,
    indicatorType: "PRICE_CLUSTERING",
    description: `The total bid price spread between highest and lowest offer is ${spreadPct} (₹${metrics.bidSpreadAmount.toLocaleString("en-IN")}), compared to a historical median spread of ${histSpreadPct} across comparable ${scope.category} tenders in ${scope.organization}.`,
    metric: "Normalized Bid Spread",
    observedValue: spreadPct,
    expectedValue: `${histSpreadPct} (comparable median spread)`,
    confidence,
    severity: metrics.normalizedSpreadPct < 2.0 ? severity : "Informational",
    supportingTenderIds: supportingTenderIds.slice(0, 10),
  });

  // Evidence 3: Relative distance & Inter-bid step uniformity (if tightly clustered)
  if (metrics.relativeDistanceScore >= 0.6) {
    evidence.push({
      id: nextId++,
      indicatorType: "PRICE_CLUSTERING",
      description: `Losing bids show concentrated relative positioning above the winning baseline with a median inter-bid gap of ₹${metrics.medianInterBidGap.toLocaleString("en-IN")}.`,
      metric: "Inter-Bid Step & Relative Distance",
      observedValue: `Median gap ₹${metrics.medianInterBidGap.toLocaleString("en-IN")}`,
      expectedValue: "Variable competitive intervals",
      confidence: 0.7,
      severity: "Moderate",
      supportingTenderIds: supportingTenderIds.slice(0, 5),
    });
  }

  // Evidence 4: Winning bid percentage of estimated value if available
  if (metrics.winningBidPctOfEstimate !== null) {
    evidence.push({
      id: nextId++,
      indicatorType: "PRICE_CLUSTERING",
      description: `Winning bid was awarded at ${metrics.winningBidPctOfEstimate.toFixed(1)}% of the official estimated value (₹${metrics.winningBidAmount.toLocaleString("en-IN")} vs estimated ₹${metrics.estimatedValue.toLocaleString("en-IN")}).`,
      metric: "Winning Bid to Estimate Ratio",
      observedValue: `${metrics.winningBidPctOfEstimate.toFixed(1)}% of estimate`,
      expectedValue: "Context dependent",
      confidence: 0.85,
      severity: "Informational",
      supportingTenderIds: [metrics.tenderId],
    });
  }

  return evidence;
}
