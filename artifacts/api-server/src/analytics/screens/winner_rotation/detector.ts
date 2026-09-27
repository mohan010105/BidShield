import { AnalyticsEvidence, AnalyticsIndicator, ComparisonScope } from "../../common/types";
import { NormalizedTenderInput } from "../../common/comparable";
import { ScreenerConfig, defaultScreenerConfig } from "../../scoring/config";
import { computeSampleConfidence, normalizeScore, scoreToScreeningStatus } from "../../scoring/indicators";
import { calculateRotationMetrics, WinnerRotationMetricsResult } from "./metrics";
import { generateRotationEvidence } from "./evidence";

export interface WinnerRotationDetectionResult {
  indicator: AnalyticsIndicator;
  metrics: WinnerRotationMetricsResult;
  evidence: AnalyticsEvidence[];
}

export function detectWinnerRotation(
  targetTender: NormalizedTenderInput,
  comparableTenders: NormalizedTenderInput[],
  scope: ComparisonScope,
  config: ScreenerConfig = defaultScreenerConfig
): WinnerRotationDetectionResult {
  const metrics = calculateRotationMetrics(comparableTenders);
  const minRequired = config.sampleRequirements.minRotationComparableTenders;
  const isInsufficient = metrics.sampleSize < minRequired;

  const supportingTenderIds = comparableTenders.map((t) => t.id);

  if (isInsufficient) {
    const indicator: AnalyticsIndicator = {
      indicatorType: "WINNER_ROTATION",
      score: null,
      status: "INSUFFICIENT_DATA",
      methodologyVersion: config.methodologyVersion,
      calculatedAt: new Date().toISOString(),
      sampleSize: metrics.sampleSize,
      threshold: config.winnerRotation.reviewThreshold,
      confidence: 0.2,
      summary: `Insufficient historical data in comparable scope (${metrics.sampleSize} tender${metrics.sampleSize === 1 ? "" : "s"} found; minimum ${minRequired} required for rotation analysis).`,
      metrics: [
        { key: "sample_size", label: "Comparable tenders", value: metrics.sampleSize, formatted: `${metrics.sampleSize} / min ${minRequired}` },
        { key: "alternation_frequency", label: "Alternation rate", value: 0, formatted: "N/A" },
        { key: "repeated_group_rate", label: "Repeated group rate", value: 0, formatted: "N/A" },
        { key: "winner_transition_pattern", label: "Transition index", value: 0, formatted: "N/A" },
      ],
      evidenceCount: 1,
    };

    const evidence = generateRotationEvidence(metrics, scope, null, supportingTenderIds);
    return { indicator, metrics, evidence };
  }

  const weights = config.winnerRotation;
  const rawWeightedScore =
    (metrics.alternationFrequency * weights.alternationFrequencyWeight +
    metrics.winnerTransitionPattern * weights.winnerTransitionPatternWeight +
    metrics.repeatedGroupRate * weights.repeatedGroupRateWeight +
    metrics.winnerConcentration * weights.winnerConcentrationWeight +
    metrics.sequenceRegularity * weights.sequenceRegularityWeight) *
    (metrics.alternationFrequency < 0.6 ? Math.max(0.3, metrics.alternationFrequency * 1.4) : 1.0);

  const score = normalizeScore(rawWeightedScore);
  const status = scoreToScreeningStatus(score, false, config);
  const confidence = computeSampleConfidence(metrics.sampleSize, minRequired, 10);

  const evidence = generateRotationEvidence(metrics, scope, score, supportingTenderIds);

  const summary =
    status === "HIGH INDICATOR" || status === "ELEVATED INDICATOR"
      ? `Elevated winner alternation pattern observed across ${metrics.sampleSize} comparable tenders with ${metrics.recurringBidders.length} recurring firms.`
      : status === "MODERATE INDICATOR"
      ? `Moderate turn-taking characteristics observed across ${metrics.sampleSize} comparable tenders.`
      : `Bidding sequence shows low rotation indicators within baseline expectation across ${metrics.sampleSize} comparable tenders.`;

  const indicator: AnalyticsIndicator = {
    indicatorType: "WINNER_ROTATION",
    score,
    status,
    methodologyVersion: config.methodologyVersion,
    calculatedAt: new Date().toISOString(),
    sampleSize: metrics.sampleSize,
    threshold: weights.reviewThreshold,
    confidence,
    summary,
    metrics: [
      { key: "winner_concentration", label: "Winner concentration index", value: metrics.winnerConcentration, formatted: metrics.winnerConcentration.toFixed(2) },
      { key: "alternation_frequency", label: "Alternation frequency", value: metrics.alternationFrequency, formatted: `${Math.round(metrics.alternationFrequency * 100)}%` },
      { key: "repeated_group_rate", label: "Repeated participant rate", value: metrics.repeatedGroupRate, formatted: `${Math.round(metrics.repeatedGroupRate * 100)}%` },
      { key: "winner_transition_pattern", label: "Transition pattern index", value: metrics.winnerTransitionPattern, formatted: metrics.winnerTransitionPattern.toFixed(2) },
      { key: "sequence_regularity", label: "Sequence regularity", value: metrics.sequenceRegularity, formatted: `${Math.round(metrics.sequenceRegularity * 100)}%` },
    ],
    evidenceCount: evidence.length,
  };

  return { indicator, metrics, evidence };
}
