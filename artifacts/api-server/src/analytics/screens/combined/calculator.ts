import { AnalyticsEvidence, AnalyticsIndicator } from "../../common/types";
import { defaultScreenerConfig, ScreenerConfig } from "../../scoring/config";
import {
  CombinedScreeningLevel,
  CombinedScreeningResult,
  EvidenceBreakdown,
  IndicatorContribution,
  IndicatorStatus,
  IndicatorType,
  StrongestIndicator,
} from "./types";

export const INDICATOR_LABELS: Record<IndicatorType, string> = {
  WINNER_ROTATION: "Winner Rotation",
  COVER_BID: "Cover-Bid Screening",
  PRICE_CLUSTERING: "Price Clustering",
  PARTICIPATION_NETWORK: "Participation Network",
  NEAT_LOSS: "Too-Neat Losing Bid",
};

/**
 * Calculates evidence counts by indicator and by severity.
 */
export function calculateEvidenceBreakdown(evidence: AnalyticsEvidence[]): EvidenceBreakdown {
  const breakdown: EvidenceBreakdown = {
    totalCount: evidence.length,
    byIndicator: {
      rotation: 0,
      coverBid: 0,
      priceClustering: 0,
      network: 0,
      neatLoss: 0,
    },
    bySeverity: {
      high: 0,
      medium: 0,
      low: 0,
      informational: 0,
    },
  };

  for (const ev of evidence) {
    const it = (ev.indicatorType || "").toUpperCase();
    if (it.includes("ROTATION")) {
      breakdown.byIndicator.rotation++;
    } else if (it.includes("COVER") || it.includes("PROXIMITY")) {
      breakdown.byIndicator.coverBid++;
    } else if (it.includes("PRICE") || it.includes("CLUSTER")) {
      breakdown.byIndicator.priceClustering++;
    } else if (it.includes("NETWORK") || it.includes("PAIR") || it.includes("GROUP")) {
      breakdown.byIndicator.network++;
    } else if (it.includes("NEAT") || it.includes("LOSS") || it.includes("RUNNER")) {
      breakdown.byIndicator.neatLoss++;
    }

    const sev = (ev.severity || "").toUpperCase();
    if (sev === "HIGH") {
      breakdown.bySeverity.high++;
    } else if (sev === "MEDIUM" || sev === "MODERATE") {
      breakdown.bySeverity.medium++;
    } else if (sev === "LOW") {
      breakdown.bySeverity.low++;
    } else {
      breakdown.bySeverity.informational++;
    }
  }

  return breakdown;
}

/**
 * Generates an explainable, deterministic evidence summary without LLM hallucinations.
 */
export function generateDeterministicSummary(
  availableCount: number,
  totalCount: number,
  topIndicators: StrongestIndicator[],
  insufficientNames: string[],
  evidenceBreakdown: EvidenceBreakdown,
  overallScore: number | null
): string {
  if (availableCount < 2) {
    return `Insufficient independent statistical indicators were available (${availableCount} of ${totalCount}). At least 2 independent indicators with sufficient historical data are required to evaluate a combined screening score.`;
  }

  const parts: string[] = [];

  parts.push(
    `${availableCount} of ${totalCount} independent statistical indicators were available for evaluation.`
  );

  if (topIndicators.length > 0) {
    const topStr = topIndicators
      .slice(0, 2)
      .map((t) => `${t.label.toLowerCase()} (score: ${t.score.toFixed(0)}/100)`)
      .join(" and ");
    parts.push(`The strongest screening signals were observed in ${topStr}.`);
  }

  if (topIndicators.length > 2) {
    parts.push(
      `Additional supporting patterns were observed in ${topIndicators[2].label.toLowerCase()} (score: ${topIndicators[2].score.toFixed(0)}/100).`
    );
  }

  if (insufficientNames.length > 0) {
    parts.push(
      `${insufficientNames.join(" and ")} had insufficient comparable observations to evaluate.`
    );
  }

  if (evidenceBreakdown.totalCount > 0) {
    parts.push(
      `A total of ${evidenceBreakdown.totalCount} evidence record${evidenceBreakdown.totalCount === 1 ? "" : "s"} (${evidenceBreakdown.bySeverity.high} high, ${evidenceBreakdown.bySeverity.medium} medium) supported this screening review.`
    );
  }

  return parts.join(" ");
}

/**
 * Maps an overall numeric score into an explainable screening level.
 */
export function getCombinedScreeningLevel(
  score: number | null,
  config: ScreenerConfig = defaultScreenerConfig
): CombinedScreeningLevel {
  if (score === null || Number.isNaN(score)) {
    return "INSUFFICIENT DATA";
  }

  const levels = config.combinedRisk?.levels ?? {
    lowMax: 24.99,
    moderateMax: 49.99,
    elevatedMax: 74.99,
    highMin: 75.0,
  };

  if (score < levels.lowMax) return "LOW SCREENING SIGNAL";
  if (score <= levels.moderateMax) return "MODERATE SCREENING SIGNAL";
  if (score <= levels.elevatedMax) return "ELEVATED SCREENING SIGNAL";
  return "HIGH SCREENING SIGNAL";
}

/**
 * Combines 5 independent screening detectors into a transparent, re-weighted overall score.
 */
export function calculateCombinedScreening(
  tenderInfo: {
    tenderId: number;
    tenderNumber: string;
    title?: string;
    organization?: string;
    category?: string;
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
): CombinedScreeningResult {
  const baseWeights = config.combinedRisk?.weights ?? {
    rotation: 0.20,
    coverBid: 0.20,
    priceClustering: 0.20,
    network: 0.20,
    neatLoss: 0.20,
  };

  const minRequired = config.combinedRisk?.minIndependentIndicators ?? 2;
  const methodologyVersion = config.combinedRiskMethodologyVersion ?? "combined_risk_v1.0";

  // Build raw contribution items
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
      renormalizedWeight: 0, // set below
      contributionScore: 0,  // set below
      sampleSize,
      evidenceCount: evCount,
    };
  }

  let overallScore: number | null = null;
  let overallStatus: "EVALUATED" | "INSUFFICIENT_DATA" = "INSUFFICIENT_DATA";

  // Minimum data requirement check: >= minRequired valid independent indicators
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

  // Top indicators sorted by score descending
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
    tenderId: tenderInfo.tenderId,
    tenderNumber: tenderInfo.tenderNumber,
    title: tenderInfo.title,
    organization: tenderInfo.organization,
    category: tenderInfo.category,
    overallScore,
    overallStatus,
    screeningLevel,
    availableIndicatorCount: availableCount,
    totalIndicatorCount: indicatorConfigs.length,
    indicators: contributions,
    topIndicators,
    evidenceSummary,
    evidenceBreakdown,
    evidence,
    methodologyVersion,
    calculatedAt: new Date().toISOString(),
  };
}
