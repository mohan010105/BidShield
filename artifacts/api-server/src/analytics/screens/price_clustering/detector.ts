import { AnalyticsEvidence, AnalyticsIndicator, ComparisonScope } from "../../common/types";
import { NormalizedTenderInput } from "../../common/comparable";
import { defaultScreenerConfig, ScreenerConfig } from "../../scoring/config";
import { computeSampleConfidence, normalizeScore, scoreToScreeningStatus } from "../../scoring/indicators";
import { calculatePriceClusteringMetrics, PriceClusteringMetricsResult } from "./metrics";
import { generatePriceClusteringEvidence } from "./evidence";

export interface PriceClusteringDetectionResult {
  indicator: AnalyticsIndicator;
  metrics: PriceClusteringMetricsResult;
  evidence: AnalyticsEvidence[];
}

export function detectPriceClustering(
  targetTender: NormalizedTenderInput,
  comparableTenders: NormalizedTenderInput[],
  scope: ComparisonScope,
  config: ScreenerConfig = defaultScreenerConfig
): PriceClusteringDetectionResult {
  const metrics = calculatePriceClusteringMetrics(targetTender, comparableTenders, config);
  const minRequiredBids = config.sampleRequirements.minBidsForPriceClustering;
  const minRequiredComparable = config.sampleRequirements.minComparableForPriceClustering;
  const supportingTenderIds = comparableTenders.map((t) => t.id);

  if (metrics.isInsufficientData) {
    const indicator: AnalyticsIndicator = {
      indicatorType: "PRICE_CLUSTERING",
      score: null,
      status: "INSUFFICIENT_DATA",
      methodologyVersion: config.priceClusteringMethodologyVersion,
      calculatedAt: new Date().toISOString(),
      sampleSize: metrics.bidCount,
      threshold: config.priceClustering.reviewThreshold,
      confidence: 0.2,
      summary:
        metrics.insufficientReason ??
        `Insufficient data to calculate price clustering screening for tender ${targetTender.tenderNumber}.`,
      metrics: [
        {
          key: "bid_count",
          label: "Recorded bids",
          value: metrics.bidCount,
          formatted: `${metrics.bidCount} / min ${minRequiredBids}`,
        },
        {
          key: "comparable_tenders",
          label: "Comparable tenders",
          value: metrics.comparableTenderCount,
          formatted: `${metrics.comparableTenderCount} / min ${minRequiredComparable}`,
        },
        {
          key: "coefficient_of_variation",
          label: "Coefficient of variation",
          value: 0,
          formatted: "N/A",
        },
        {
          key: "bid_spread",
          label: "Bid spread",
          value: 0,
          formatted: "N/A",
        },
      ],
      evidenceCount: 1,
    };

    const evidence = generatePriceClusteringEvidence(metrics, scope, null, supportingTenderIds);
    return { indicator, metrics, evidence };
  }

  const weights = config.priceClustering;
  const rawWeightedScore =
    metrics.tenderConcentrationScore * weights.tenderConcentrationWeight +
    metrics.historicalComparisonScore * weights.historicalComparisonWeight +
    metrics.percentileDeviationScore * weights.percentileDeviationWeight +
    metrics.relativeDistanceScore * weights.relativeDistanceWeight +
    metrics.repeatedPositioningScore * weights.repeatedPositioningWeight;

  const score = normalizeScore(rawWeightedScore);
  const status = scoreToScreeningStatus(score, false, config);
  const confidence = computeSampleConfidence(metrics.bidCount, minRequiredBids, 6);

  const evidence = generatePriceClusteringEvidence(metrics, scope, score, supportingTenderIds);

  const cvFormatted = metrics.coefficientOfVariation.toFixed(4);
  const histCvFormatted = metrics.historicalMedianCV !== null ? metrics.historicalMedianCV.toFixed(4) : "N/A";
  const pctFormatted = metrics.cvPercentile !== null ? `${metrics.cvPercentile.toFixed(0)}th percentile` : "N/A";
  const spreadFormatted = `${metrics.normalizedSpreadPct.toFixed(1)}%`;

  const summary =
    status === "HIGH INDICATOR" || status === "ELEVATED INDICATOR"
      ? `Elevated price clustering pattern observed: Bid prices show tight concentration (CV: ${cvFormatted}, ${pctFormatted}) with a ${spreadFormatted} bid spread across ${metrics.bidCount} bids, compared to historical median CV of ${histCvFormatted} (${metrics.comparableTenderCount} comparable tenders).`
      : status === "MODERATE INDICATOR"
      ? `Moderate price clustering pattern observed: Bid dispersion is ${spreadFormatted} spread (CV: ${cvFormatted}, ${pctFormatted}) across ${metrics.bidCount} bids.`
      : `Submitted bids demonstrate typical competitive price dispersion (CV: ${cvFormatted}, ${pctFormatted}, ${spreadFormatted} spread across ${metrics.bidCount} bids).`;

  const indicator: AnalyticsIndicator = {
    indicatorType: "PRICE_CLUSTERING",
    score,
    status,
    methodologyVersion: config.priceClusteringMethodologyVersion,
    calculatedAt: new Date().toISOString(),
    sampleSize: metrics.bidCount,
    threshold: weights.reviewThreshold,
    confidence,
    summary,
    metrics: [
      {
        key: "coefficient_of_variation",
        label: "Coefficient of variation",
        value: metrics.coefficientOfVariation,
        formatted: cvFormatted,
      },
      {
        key: "bid_spread",
        label: "Normalized bid spread",
        value: metrics.normalizedSpreadPct,
        formatted: spreadFormatted,
      },
      {
        key: "cv_percentile",
        label: "Dispersion percentile rank",
        value: metrics.cvPercentile ?? 50,
        formatted: pctFormatted,
      },
      {
        key: "historical_median_cv",
        label: "Comparable median CV",
        value: metrics.historicalMedianCV ?? 0,
        formatted: histCvFormatted,
      },
      {
        key: "bid_count",
        label: "Analyzed bids",
        value: metrics.bidCount,
        formatted: `${metrics.bidCount} bids`,
      },
      {
        key: "comparable_tenders",
        label: "Comparable tenders baseline",
        value: metrics.comparableTenderCount,
        formatted: `${metrics.comparableTenderCount} tenders`,
      },
      ...(metrics.winningBidPctOfEstimate !== null
        ? [
            {
              key: "winning_bid_pct_estimate",
              label: "Awarded % of estimated value",
              value: metrics.winningBidPctOfEstimate,
              formatted: `${metrics.winningBidPctOfEstimate.toFixed(1)}%`,
            },
          ]
        : []),
    ],
    evidenceCount: evidence.length,
  };

  return { indicator, metrics, evidence };
}
