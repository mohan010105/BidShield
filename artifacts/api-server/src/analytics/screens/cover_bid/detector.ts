import { AnalyticsEvidence, AnalyticsIndicator, ComparisonScope } from "../../common/types";
import { NormalizedTenderInput } from "../../common/comparable";
import { ScreenerConfig, defaultScreenerConfig } from "../../scoring/config";
import { computeSampleConfidence, normalizeScore, scoreToScreeningStatus } from "../../scoring/indicators";
import { calculateCoverBidMetrics, CoverBidMetricsResult } from "./metrics";
import { generateCoverBidEvidence } from "./evidence";

export interface CoverBidDetectionResult {
  indicator: AnalyticsIndicator;
  metrics: CoverBidMetricsResult;
  evidence: AnalyticsEvidence[];
}

export function detectCoverBid(
  targetTender: NormalizedTenderInput,
  comparableTenders: NormalizedTenderInput[],
  scope: ComparisonScope,
  config: ScreenerConfig = defaultScreenerConfig
): CoverBidDetectionResult {
  const metrics = calculateCoverBidMetrics(targetTender, comparableTenders, config);
  const minRequiredBids = config.sampleRequirements.minBidsPerTenderForScreening;
  const isInsufficient = metrics.bidCount < minRequiredBids;

  const supportingTenderIds = comparableTenders.map((t) => t.id);

  if (isInsufficient) {
    const indicator: AnalyticsIndicator = {
      indicatorType: "COVER_BID",
      score: null,
      status: "INSUFFICIENT_DATA",
      methodologyVersion: config.methodologyVersion,
      calculatedAt: new Date().toISOString(),
      sampleSize: metrics.bidCount,
      threshold: config.coverBid.reviewThreshold,
      confidence: 0.2,
      summary: `Insufficient bids recorded for tender ${targetTender.tenderNumber} (${metrics.bidCount} bid; minimum ${minRequiredBids} required).`,
      metrics: [
        { key: "bid_count", label: "Recorded bids", value: metrics.bidCount, formatted: `${metrics.bidCount} / min ${minRequiredBids}` },
        { key: "median_relative_distance", label: "Median distance from winner", value: 0, formatted: "N/A" },
        { key: "bid_spread", label: "Bid spread", value: 0, formatted: "N/A" },
        { key: "historical_proximity_score", label: "Historical proximity index", value: 0, formatted: "N/A" },
      ],
      evidenceCount: 1,
    };

    const evidence = generateCoverBidEvidence(metrics, scope, null, supportingTenderIds);
    return { indicator, metrics, evidence };
  }

  const weights = config.coverBid;
  const rawWeightedScore =
    metrics.historicalProximityScore * weights.historicalProximityWeight +
    metrics.tightClusteringScore * weights.tightClusteringWeight +
    metrics.consistentDeltaScore * weights.consistentDeltaWeight +
    metrics.spreadAnomalyScore * weights.spreadAnomalyWeight;

  const score = normalizeScore(rawWeightedScore);
  const status = scoreToScreeningStatus(score, false, config);
  const confidence = computeSampleConfidence(metrics.bidCount, minRequiredBids, 5);

  const evidence = generateCoverBidEvidence(metrics, scope, score, supportingTenderIds);

  const summary =
    status === "HIGH INDICATOR" || status === "ELEVATED INDICATOR"
      ? `Elevated bid positioning pattern observed: ${metrics.flaggedCompanies.length} bidder(s) show repeated relative distance consistency with tight clustering (+${metrics.medianRelativeDistance.toFixed(1)}% median delta).`
      : status === "MODERATE INDICATOR"
      ? `Moderate bid positioning pattern observed: cluster spread is ${metrics.bidSpreadPct.toFixed(1)}% with +${metrics.medianRelativeDistance.toFixed(1)}% median distance from winner.`
      : `Submitted bids show typical competitive dispersion (+${metrics.medianRelativeDistance.toFixed(1)}% median distance, ${metrics.bidSpreadPct.toFixed(1)}% spread).`;

  const indicator: AnalyticsIndicator = {
    indicatorType: "COVER_BID",
    score,
    status,
    methodologyVersion: config.methodologyVersion,
    calculatedAt: new Date().toISOString(),
    sampleSize: metrics.bidCount,
    threshold: weights.reviewThreshold,
    confidence,
    summary,
    metrics: [
      { key: "median_relative_distance", label: "Median relative distance", value: metrics.medianRelativeDistance, formatted: `+${metrics.medianRelativeDistance.toFixed(1)}%` },
      { key: "bid_spread", label: "Losing bid spread", value: metrics.bidSpreadPct, formatted: `${metrics.bidSpreadPct.toFixed(1)}%` },
      { key: "clustering_std_dev", label: "Position clustering std dev", value: metrics.clusteringStdDev, formatted: `${metrics.clusteringStdDev.toFixed(2)}%` },
      { key: "historical_proximity_score", label: "Historical proximity index", value: metrics.historicalProximityScore, formatted: metrics.historicalProximityScore.toFixed(2) },
      { key: "consistent_delta_score", label: "Delta consistency index", value: metrics.consistentDeltaScore, formatted: metrics.consistentDeltaScore.toFixed(2) },
    ],
    evidenceCount: evidence.length,
  };

  return { indicator, metrics, evidence };
}
