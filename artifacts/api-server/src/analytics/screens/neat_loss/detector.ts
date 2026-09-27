import { AnalyticsIndicator, ComparisonScope, ScreeningStatus } from "../../common/types";
import { NormalizedTenderInput, findComparableTenders } from "../../common/comparable";
import { defaultScreenerConfig, ScreenerConfig } from "../../scoring/config";
import { computeSampleConfidence } from "../../scoring/indicators";
import { calculateCompanyNeatLossMetrics } from "./metrics";
import { generateNeatLossEvidence } from "./evidence";
import { NeatLossDetectionResult, TenderNeatLossAnalysis, TenderNeatLossContributor } from "./types";

/**
 * Detects too-neat losing bid patterns for a single company across comparable historical tenders.
 */
export function detectCompanyNeatLoss(
  companyId: number,
  companyName: string,
  canonicalId: string,
  allTenders: NormalizedTenderInput[],
  config: ScreenerConfig = defaultScreenerConfig,
  filterScope?: { category?: string; organization?: string }
): NeatLossDetectionResult {
  const comparisonGroupName = filterScope?.category
    ? `${filterScope.category}${filterScope.organization ? ` · ${filterScope.organization}` : ""}`
    : "All Comparable Procurements";

  const metrics = calculateCompanyNeatLossMetrics(
    companyId,
    companyName,
    canonicalId,
    allTenders,
    config,
    comparisonGroupName,
    filterScope
  );

  const evidence = generateNeatLossEvidence(metrics);
  const minRequired = config.sampleRequirements?.minNeatLossObservations ?? 5;
  const confidence = metrics.isInsufficientData
    ? 0.2
    : computeSampleConfidence(metrics.sampleSize, minRequired, 10);

  let summary = "";
  if (metrics.isInsufficientData) {
    summary = `Insufficient data: ${companyName} has only ${metrics.sampleSize} comparable losing observations (minimum ${minRequired} required for statistical analysis).`;
  } else if (metrics.status === "HIGH INDICATOR" || metrics.status === "ELEVATED INDICATOR") {
    summary = `Observed pattern: ${companyName} exhibits high losing-bid consistency across ${metrics.sampleSize} comparable tenders (loss rate: ${Math.round(metrics.lossRate * 100)}%, median gap: +${metrics.medianRelativeGapPct?.toFixed(2)}%, CV: ${metrics.relativeGapCv?.toFixed(4)}, most frequent rank: Rank ${metrics.mostFrequentRank} in ${metrics.repeatedRankCount} tenders). Requires further observational review.`;
  } else if (metrics.status === "MODERATE INDICATOR") {
    summary = `Observed pattern: ${companyName} shows moderate losing-bid recurrence across ${metrics.sampleSize} comparable tenders (median gap: +${metrics.medianRelativeGapPct?.toFixed(2)}%, CV: ${metrics.relativeGapCv?.toFixed(4)}). Within normal statistical monitoring bounds.`;
  } else {
    summary = `No anomalous losing-bid patterns observed for ${companyName} across ${metrics.sampleSize} comparable tenders. Relative bid distances show normal competitive dispersion.`;
  }

  const indicator: AnalyticsIndicator = {
    indicatorType: "NEAT_LOSS",
    score: metrics.score,
    status: metrics.status,
    methodologyVersion: config.neatLossMethodologyVersion,
    calculatedAt: new Date().toISOString(),
    sampleSize: metrics.sampleSize,
    threshold: config.neatLoss.reviewThreshold,
    confidence,
    summary,
    metrics: [
      {
        key: "loss_count",
        label: "Losing bids analyzed",
        value: metrics.lossCount,
        formatted: `${metrics.lossCount} bids (min ${minRequired})`,
      },
      {
        key: "loss_rate",
        label: "Historical loss rate",
        value: Math.round(metrics.lossRate * 100),
        formatted: `${Math.round(metrics.lossRate * 100)}%`,
      },
      {
        key: "median_relative_gap",
        label: "Median relative gap",
        value: metrics.medianRelativeGapPct ?? 0,
        formatted: metrics.medianRelativeGapPct !== null ? `+${metrics.medianRelativeGapPct.toFixed(2)}%` : "N/A",
      },
      {
        key: "relative_gap_cv",
        label: "Relative gap dispersion (CV)",
        value: metrics.relativeGapCv ?? 0,
        formatted: metrics.relativeGapCv !== null ? metrics.relativeGapCv.toFixed(4) : "N/A",
      },
      {
        key: "repeated_rank",
        label: "Most frequent rank",
        value: metrics.mostFrequentRank,
        formatted: `Rank ${metrics.mostFrequentRank} (${metrics.repeatedRankCount}x)`,
      },
    ],
    evidenceCount: evidence.length,
  };

  return { indicator, metrics, evidence };
}

/**
 * Evaluates whether participating bidders in a tender contribute to a historical too-neat losing bid pattern.
 */
export function detectTenderNeatLoss(
  targetTender: NormalizedTenderInput,
  allTenders: NormalizedTenderInput[],
  configOrScope?: ScreenerConfig | ComparisonScope,
  explicitConfig?: ScreenerConfig
): TenderNeatLossAnalysis {
  const config =
    explicitConfig ??
    (configOrScope && "neatLoss" in configOrScope
      ? (configOrScope as ScreenerConfig)
      : defaultScreenerConfig);
  const { comparableTenders } = findComparableTenders(targetTender, allTenders, config);
  const comparisonPopulation = [...comparableTenders.filter((t) => t.id !== targetTender.id), targetTender];

  const contributingBidders: TenderNeatLossContributor[] = [];
  const allEvidence = [];

  for (const bid of targetTender.bids) {
    if (bid.isWinner) continue;

    const companyResult = detectCompanyNeatLoss(
      bid.companyId,
      bid.companyName,
      `CMP-${String(bid.companyId).padStart(3, "0")}`,
      comparisonPopulation,
      config,
      { category: targetTender.category, organization: targetTender.organization }
    );

    const isContributor =
      (companyResult.metrics.status === "ELEVATED INDICATOR" ||
        companyResult.metrics.status === "HIGH INDICATOR") &&
      companyResult.metrics.medianRelativeGapPct !== null &&
      Math.abs(bid.differenceFromWinner - companyResult.metrics.medianRelativeGapPct) <= 2.0;

    let desc = "";
    if (isContributor) {
      desc = `${bid.companyName} submitted a bid +${bid.differenceFromWinner.toFixed(2)}% above winner (Rank ${bid.rank}), aligning with its historical narrow losing pattern (median +${companyResult.metrics.medianRelativeGapPct?.toFixed(2)}%, CV ${companyResult.metrics.relativeGapCv?.toFixed(4)} across ${companyResult.metrics.sampleSize} tenders).`;
    } else {
      desc = `${bid.companyName} submitted a bid +${bid.differenceFromWinner.toFixed(2)}% above winner (Rank ${bid.rank}).`;
    }

    contributingBidders.push({
      companyId: bid.companyId,
      companyName: bid.companyName,
      canonicalId: `CMP-${String(bid.companyId).padStart(3, "0")}`,
      bidRank: bid.rank,
      bidAmount: bid.bidAmount,
      relativeGapPct: bid.differenceFromWinner,
      companyScore: companyResult.metrics.score,
      companyStatus: companyResult.metrics.status,
      historicalLossRate: companyResult.metrics.lossRate,
      historicalMedianGap: companyResult.metrics.medianRelativeGapPct,
      historicalGapCv: companyResult.metrics.relativeGapCv,
      isPatternContributor: isContributor,
      description: desc,
    });

    if (isContributor) {
      const tenderEv = generateNeatLossEvidence(companyResult.metrics, targetTender.id);
      allEvidence.push(...tenderEv);
    }
  }

  // Derive tender-level indicator
  const elevatedContributors = contributingBidders.filter((b) => b.isPatternContributor);
  const maxScore = contributingBidders.reduce(
    (max, b) => Math.max(max, b.companyScore ?? 0),
    0
  );

  let status: ScreeningStatus = "LOW INDICATOR";
  if (elevatedContributors.length >= 2 || maxScore >= 75) status = "HIGH INDICATOR";
  else if (elevatedContributors.length >= 1 || maxScore >= 50) status = "ELEVATED INDICATOR";
  else if (maxScore >= 25) status = "MODERATE INDICATOR";

  const tenderIndicator: AnalyticsIndicator = {
    indicatorType: "NEAT_LOSS",
    score: maxScore > 0 ? maxScore : null,
    status,
    methodologyVersion: config.neatLossMethodologyVersion,
    calculatedAt: new Date().toISOString(),
    sampleSize: targetTender.bids.length,
    threshold: config.neatLoss.reviewThreshold,
    confidence: elevatedContributors.length > 0 ? 0.75 : 0.5,
    summary:
      elevatedContributors.length > 0
        ? `Observed ${elevatedContributors.length} bidder(s) exhibiting consistent historical losing-bid alignment in this procurement (${elevatedContributors.map((b) => b.companyName).join(", ")}). Statistical indicator for further review.`
        : "No participating bidders in this procurement exhibit elevated losing-bid consistency patterns.",
    metrics: [
      {
        key: "participating_bidders",
        label: "Participating bidders",
        value: targetTender.bids.length,
        formatted: `${targetTender.bids.length} bidders`,
      },
      {
        key: "pattern_contributors",
        label: "Bidders with neat-loss signals",
        value: elevatedContributors.length,
        formatted: `${elevatedContributors.length} bidders`,
      },
      {
        key: "max_neat_loss_score",
        label: "Highest bidder neat-loss score",
        value: maxScore,
        formatted: `${maxScore}/100`,
      },
    ],
    evidenceCount: allEvidence.length,
  };

  return {
    tenderId: targetTender.id,
    tenderNumber: targetTender.tenderNumber,
    participatingBiddersCount: targetTender.bids.length,
    contributingBidders,
    indicator: tenderIndicator,
    evidence: allEvidence,
  };
}
