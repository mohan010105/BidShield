import { AnalyticsEvidence } from "../../common/types";
import { CoParticipationPair, RecurringBidderGroup } from "./types";

let nextEvidenceId = 50000;

export function generatePairEvidence(
  pair: CoParticipationPair,
  scopeDesc?: string
): AnalyticsEvidence {
  const freqPct = (pair.participationFrequency * 100).toFixed(1);
  const orgDesc = pair.organizations.length > 0 ? ` under ${pair.organizations.slice(0, 2).join(", ")}` : "";
  const catDesc = pair.categories.length > 0 ? ` (${pair.categories.slice(0, 2).join(", ")})` : "";

  const severity =
    pair.status === "HIGH INDICATOR" || pair.status === "ELEVATED INDICATOR"
      ? "Elevated"
      : pair.status === "MODERATE INDICATOR"
      ? "Moderate"
      : "Informational";

  const confidence = Math.min(0.95, Math.max(0.4, 0.4 + (pair.sharedTenderCount / 10) * 0.5));

  return {
    id: nextEvidenceId++,
    indicatorType: "PARTICIPATION_NETWORK",
    description: `Observed recurring participation pattern: ${pair.companyAName} and ${pair.companyBName} appeared together across ${pair.sharedTenderCount} comparable tenders${orgDesc}${catDesc}. This observed relationship requires further review against commercial context.`,
    metric: "Co-participation recurrence",
    observedValue: `${pair.sharedTenderCount} shared tenders (overlap frequency: ${freqPct}%)`,
    expectedValue: `Baseline co-occurrence <= 2 in ${scopeDesc ?? "comparable tenders"}`,
    confidence: Math.round(confidence * 100) / 100,
    severity,
    supportingTenderIds: pair.sharedTenderIds,
  };
}

export function generateGroupEvidence(
  group: RecurringBidderGroup,
  scopeDesc?: string
): AnalyticsEvidence {
  const compNames = group.companyNames.join(", ");
  const orgDesc = group.organizations.length > 0 ? ` within ${group.organizations.slice(0, 2).join(", ")}` : "";
  const catDesc = group.categories.length > 0 ? ` (${group.categories.slice(0, 2).join(", ")})` : "";

  const severity = group.sharedTenderCount >= 4 ? "Elevated" : "Moderate";
  const confidence = Math.min(0.95, 0.5 + (group.sharedTenderCount / 8) * 0.4);

  return {
    id: nextEvidenceId++,
    indicatorType: "PARTICIPATION_NETWORK",
    description: `Observed recurring bidder group: ${compNames} co-participated in ${group.sharedTenderCount} procurement packages${orgDesc}${catDesc}. Observed relationship warrants observational review.`,
    metric: "Recurring bidder group frequency",
    observedValue: `Group of ${group.companyIds.length} companies observed together across ${group.sharedTenderCount} tenders (${group.frequencyPct}% frequency)`,
    expectedValue: `Baseline group co-occurrence <= 1 in ${scopeDesc ?? "comparable tenders"}`,
    confidence: Math.round(confidence * 100) / 100,
    severity,
    supportingTenderIds: group.sharedTenderIds,
  };
}

export function generateConcentrationEvidence(
  top3SharePct: number,
  hhi: number,
  category: string,
  organization: string,
  supportingTenderIds: number[]
): AnalyticsEvidence {
  return {
    id: nextEvidenceId++,
    indicatorType: "PARTICIPATION_NETWORK",
    description: `Observed high participation concentration: The top 3 bidders account for ${top3SharePct}% of total bid submissions in ${category} (${organization}, HHI: ${hhi}). Potentially unusual network pattern for market entry review.`,
    metric: "Participation concentration share",
    observedValue: `Top 3 bidder share: ${top3SharePct}%, HHI: ${hhi}`,
    expectedValue: "Expected competitive distribution: Top 3 share < 45%, HHI < 1800",
    confidence: 0.78,
    severity: top3SharePct > 65 ? "Elevated" : "Moderate",
    supportingTenderIds,
  };
}
