import { AnalyticsEvidence, AnalyticsIndicator } from "../../common/types";
import { defaultScreenerConfig, ScreenerConfig } from "../../scoring/config";
import {
  calculateEvidenceBreakdown,
  generateDeterministicSummary,
  getCombinedScreeningLevel,
  INDICATOR_LABELS,
} from "./calculator";
import {
  CompanyCombinedScreeningResult,
  IndicatorContribution,
  IndicatorStatus,
  IndicatorType,
  StrongestIndicator,
} from "./types";

/**
 * Combines 5 independent screening detectors for an individual company across comparable tenders.
 */
export function calculateCompanyCombinedScreening(
  companyInfo: {
    companyId: number;
    companyName: string;
    canonicalId: string;
    tendersAnalyzed?: number;
  },
  indicatorsInput: {
    rotation?: AnalyticsIndicator;
    coverBid?: AnalyticsIndicator;
    priceClustering?: AnalyticsIndicator;
    network?: AnalyticsIndicator;
    neatLoss?: AnalyticsIndicator;
  },
  evidence: AnalyticsEvidence[] = [],
  config: ScreenerConfig = defaultScreenerConfig
): CompanyCombinedScreeningResult {
  const baseWeights = config.combinedRisk?.weights ?? {
    rotation: 0.20,
    coverBid: 0.20,
    priceClustering: 0.20,
    network: 0.20,
    neatLoss: 0.20,
  };

  const minRequired = config.combinedRisk?.minIndependentIndicators ?? 2;
  const methodologyVersion = config.combinedRiskMethodologyVersion ?? "combined_risk_v1.0";

  const indicatorConfigs: Array<{
    type: IndicatorType;
    indicator?: AnalyticsIndicator;
    baseWeight: number;
  }> = [
    { type: "WINNER_ROTATION", indicator: indicatorsInput.rotation, baseWeight: baseWeights.rotation },
    { type: "COVER_BID", indicator: indicatorsInput.coverBid, baseWeight: baseWeights.coverBid },
    { type: "PRICE_CLUSTERING", indicator: indicatorsInput.priceClustering, baseWeight: baseWeights.priceClustering },
    { type: "PARTICIPATION_NETWORK", indicator: indicatorsInput.network, baseWeight: baseWeights.network },
    { type: "NEAT_LOSS", indicator: indicatorsInput.neatLoss, baseWeight: baseWeights.neatLoss },
  ];

  const contributions: Record<IndicatorType, IndicatorContribution> = {} as any;
  let availableWeightSum = 0;
  let availableCount = 0;
  const insufficientNames: string[] = [];

  for (const cfg of indicatorConfigs) {
    const ind = cfg.indicator;
    const isAvailable =
      Boolean(ind) &&
      ind?.score !== null &&
      ind?.score !== undefined &&
      Number.isFinite(ind.score) &&
      ind.status !== "INSUFFICIENT_DATA";

    let status: IndicatorStatus = "INSUFFICIENT_DATA";
    let statusReason: string | undefined = "Insufficient historical comparable observations";
    let rawScore: number | null = null;
    let sampleSize = ind?.sampleSize ?? 0;
    let evCount = ind?.evidenceCount ?? 0;

    if (isAvailable && ind?.score !== null) {
      status = "AVAILABLE";
      statusReason = undefined;
      rawScore = Math.max(0, Math.min(100, Math.round(ind.score * 100) / 100));
      availableWeightSum += cfg.baseWeight;
      availableCount++;
    } else {
      insufficientNames.push(INDICATOR_LABELS[cfg.type]);
    }

    contributions[cfg.type] = {
      indicator: cfg.type,
      label: INDICATOR_LABELS[cfg.type],
      rawScore,
      status,
      statusReason,
      baseWeight: cfg.baseWeight,
      renormalizedWeight: 0,
      contributionScore: 0,
      sampleSize,
      evidenceCount: evCount,
    };
  }

  let overallScore: number | null = null;
  let overallStatus: "EVALUATED" | "INSUFFICIENT_DATA" = "INSUFFICIENT_DATA";

  if (availableCount >= minRequired && availableWeightSum > 0) {
    overallStatus = "EVALUATED";
    let weightedSum = 0;

    for (const type of Object.keys(contributions) as IndicatorType[]) {
      const c = contributions[type];
      if (c.status === "AVAILABLE" && c.rawScore !== null) {
        c.renormalizedWeight = Math.round((c.baseWeight / availableWeightSum) * 10000) / 10000;
        c.contributionScore = Math.round(c.rawScore * c.renormalizedWeight * 100) / 100;
        weightedSum += c.contributionScore;
      }
    }

    overallScore = Math.max(0, Math.min(100, Math.round(weightedSum * 100) / 100));
  }

  const screeningLevel = getCombinedScreeningLevel(overallScore, config);

  const topIndicators: StrongestIndicator[] = (Object.keys(contributions) as IndicatorType[])
    .filter((t) => contributions[t].status === "AVAILABLE" && contributions[t].rawScore !== null)
    .map((t) => ({
      indicator: t,
      label: contributions[t].label,
      score: contributions[t].rawScore!,
      contribution: contributions[t].contributionScore,
    }))
    .sort((a, b) => b.score - a.score);

  const evidenceBreakdown = calculateEvidenceBreakdown(evidence);
  const evidenceSummary = generateDeterministicSummary(
    availableCount,
    indicatorConfigs.length,
    topIndicators,
    insufficientNames,
    evidenceBreakdown,
    overallScore
  );

  return {
    companyId: companyInfo.companyId,
    companyName: companyInfo.companyName,
    canonicalId: companyInfo.canonicalId,
    overallScore,
    overallStatus,
    screeningLevel,
    availableIndicatorCount: availableCount,
    totalIndicatorCount: indicatorConfigs.length,
    tendersAnalyzed: companyInfo.tendersAnalyzed ?? 0,
    indicators: contributions,
    topIndicators,
    evidenceSummary,
    evidenceBreakdown,
    evidence,
    methodologyVersion,
    calculatedAt: new Date().toISOString(),
  };
}
