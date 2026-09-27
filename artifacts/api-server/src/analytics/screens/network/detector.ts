import { AnalyticsEvidence, AnalyticsIndicator, ComparisonScope, ScreeningStatus } from "../../common/types";
import { NormalizedTenderInput } from "../../common/comparable";
import { defaultScreenerConfig, ScreenerConfig } from "../../scoring/config";
import { computeSampleConfidence, normalizeScore, scoreToScreeningStatus } from "../../scoring/indicators";
import {
  calculateCoParticipationPairs,
  calculateParticipationConcentration,
  CompanyEntityInput,
  identifyRecurringBidderGroups,
} from "./metrics";
import { generateConcentrationEvidence, generateGroupEvidence, generatePairEvidence } from "./evidence";
import {
  CoParticipationPair,
  CompanyNetworkAnalysis,
  RecurringBidderGroup,
} from "./types";

export interface ParticipationNetworkDetectionResult {
  indicator: AnalyticsIndicator;
  pairs: CoParticipationPair[];
  recurringGroups: RecurringBidderGroup[];
  evidence: AnalyticsEvidence[];
}

/**
 * Detects participation network patterns for a target tender in the context of comparable tenders.
 */
export function detectParticipationNetwork(
  targetTender: NormalizedTenderInput,
  comparableTenders: NormalizedTenderInput[],
  scope: ComparisonScope,
  companies: CompanyEntityInput[],
  config: ScreenerConfig = defaultScreenerConfig
): ParticipationNetworkDetectionResult {
  const minRequiredComparable = config.sampleRequirements?.minRotationComparableTenders ?? 2;
  const minRequiredBids = 2;
  const targetBids = targetTender.bids;

  // Handle insufficient data
  if (targetBids.length < minRequiredBids || comparableTenders.length < minRequiredComparable) {
    const indicator: AnalyticsIndicator = {
      indicatorType: "PARTICIPATION_NETWORK",
      score: null,
      status: "INSUFFICIENT_DATA",
      methodologyVersion: "participation_network_v1.0",
      calculatedAt: new Date().toISOString(),
      sampleSize: targetBids.length,
      threshold: 60,
      confidence: 0.2,
      summary:
        targetBids.length < minRequiredBids
          ? `Insufficient data: Tender has only ${targetBids.length} bidder (minimum ${minRequiredBids} required for network analysis).`
          : `Insufficient data: Only ${comparableTenders.length} comparable tenders available (minimum ${minRequiredComparable} required for baseline network analysis).`,
      metrics: [
        {
          key: "target_bidders",
          label: "Participating bidders",
          value: targetBids.length,
          formatted: `${targetBids.length} / min ${minRequiredBids}`,
        },
        {
          key: "comparable_tenders",
          label: "Comparable tenders",
          value: comparableTenders.length,
          formatted: `${comparableTenders.length} / min ${minRequiredComparable}`,
        },
      ],
      evidenceCount: 0,
    };

    return { indicator, pairs: [], recurringGroups: [], evidence: [] };
  }

  // Population includes comparable tenders + target tender
  const population = [...comparableTenders.filter((t) => t.id !== targetTender.id), targetTender];
  const targetCompanyIds = new Set(targetBids.map((b) => b.companyId));

  // Compute pairs in this population
  const allPairs = calculateCoParticipationPairs(population, companies, config);
  const relevantPairs = allPairs.filter(
    (p) => targetCompanyIds.has(p.companyAId) && targetCompanyIds.has(p.companyBId)
  );

  // Compute recurring groups
  const allGroups = identifyRecurringBidderGroups(population, companies, 3, 2);
  const relevantGroups = allGroups.filter((g) =>
    g.companyIds.some((cid) => targetCompanyIds.has(cid))
  );

  // Participation concentration
  const concentration = calculateParticipationConcentration(population);

  // Max pair shared count & frequency among target companies
  const maxSharedTenders = relevantPairs.reduce((max, p) => Math.max(max, p.sharedTenderCount), 0);
  const maxFrequency = relevantPairs.reduce((max, p) => Math.max(max, p.participationFrequency), 0);

  // Deterministic scoring (0 - 100)
  // 1. Co-participation recurrence (35%)
  const coPartScore = Math.min(35, (maxSharedTenders / 4) * 35);
  // 2. Co-participation frequency (25%)
  const freqScore = Math.min(25, maxFrequency * 25);
  // 3. Persistent bidder group presence (20%)
  const groupScore = relevantGroups.length > 0 ? Math.min(20, relevantGroups[0].sharedTenderCount * 5) : 0;
  // 4. Market concentration (20%)
  const concScore = concentration.isHighConcentration ? Math.min(20, (concentration.top3SharePct / 80) * 20) : 5;

  const rawScore = Math.round(coPartScore + freqScore + groupScore + concScore);
  const score = normalizeScore(rawScore);
  const status = scoreToScreeningStatus(score, false, config);
  const confidence = computeSampleConfidence(targetBids.length, minRequiredBids, 6);

  // Evidence generation
  const evidence: AnalyticsEvidence[] = [];
  const scopeDesc = `${scope.category} · ${scope.organization}`;

  relevantPairs.slice(0, 3).forEach((p) => {
    if (p.sharedTenderCount >= 2) {
      evidence.push(generatePairEvidence(p, scopeDesc));
    }
  });

  relevantGroups.slice(0, 2).forEach((g) => {
    evidence.push(generateGroupEvidence(g, scopeDesc));
  });

  if (concentration.isHighConcentration) {
    evidence.push(
      generateConcentrationEvidence(
        concentration.top3SharePct,
        concentration.hhi,
        scope.category,
        scope.organization,
        population.map((t) => t.id)
      )
    );
  }

  const summary =
    status === "HIGH INDICATOR" || status === "ELEVATED INDICATOR"
      ? `Elevated network participation pattern observed: Bidders in tender ${targetTender.tenderNumber} exhibit recurring co-participation across ${maxSharedTenders} comparable tenders (${(maxFrequency * 100).toFixed(0)}% co-occurrence frequency). Requires further review against commercial context.`
      : status === "MODERATE INDICATOR"
      ? `Moderate participation recurrence observed: Select bidders have co-participated across ${maxSharedTenders} tenders in ${scope.category}.`
      : `Participating bidders show typical competitive rotation and open participation across ${comparableTenders.length} comparable tenders.`;

  const indicator: AnalyticsIndicator = {
    indicatorType: "PARTICIPATION_NETWORK",
    score,
    status,
    methodologyVersion: "participation_network_v1.0",
    calculatedAt: new Date().toISOString(),
    sampleSize: targetBids.length,
    threshold: 60,
    confidence,
    summary,
    metrics: [
      {
        key: "max_shared_tenders",
        label: "Max shared tenders between bidders",
        value: maxSharedTenders,
        formatted: `${maxSharedTenders} tenders`,
      },
      {
        key: "co_participation_frequency",
        label: "Max co-participation frequency",
        value: Math.round(maxFrequency * 100),
        formatted: `${(maxFrequency * 100).toFixed(1)}%`,
      },
      {
        key: "recurring_groups_detected",
        label: "Recurring bidder groups",
        value: relevantGroups.length,
        formatted: `${relevantGroups.length} groups`,
      },
      {
        key: "top3_concentration_share",
        label: "Top 3 bidder share in category",
        value: concentration.top3SharePct,
        formatted: `${concentration.top3SharePct}%`,
      },
    ],
    evidenceCount: evidence.length,
  };

  return { indicator, pairs: relevantPairs, recurringGroups: relevantGroups, evidence };
}

/**
 * Detailed network analysis for a single company.
 */
export function detectCompanyNetwork(
  companyId: number,
  allTenders: NormalizedTenderInput[],
  companies: CompanyEntityInput[],
  config: ScreenerConfig = defaultScreenerConfig
): CompanyNetworkAnalysis {
  const company = companies.find((c) => c.id === companyId);
  const companyName = company?.canonicalName ?? `Company ${companyId}`;
  const canonicalId = `CMP-${String(companyId).padStart(3, "0")}`;

  // Find all tenders this company participated in
  const participatedTenders = allTenders
    .filter((t) => t.bids.some((b) => b.companyId === companyId))
    .sort((a, b) => b.tenderDate.localeCompare(a.tenderDate));

  const wins = participatedTenders.filter((t) => t.winner === companyName).length;
  const participationCount = participatedTenders.length;
  const losses = Math.max(0, participationCount - wins);
  const degree = participationCount;

  const connectedTenders = participatedTenders.map((t) => {
    const bid = t.bids.find((b) => b.companyId === companyId)!;
    return {
      tenderId: t.id,
      tenderNumber: t.tenderNumber,
      title: t.title,
      organization: t.organization,
      category: t.category,
      tenderDate: t.tenderDate,
      bidRank: bid.rank,
      isWinner: bid.isWinner,
      bidAmount: bid.bidAmount,
    };
  });

  // Insufficient data case: if company has fewer than 2 tenders
  if (participationCount < 2) {
    const indicator: AnalyticsIndicator = {
      indicatorType: "PARTICIPATION_NETWORK",
      score: null,
      status: "INSUFFICIENT_DATA",
      methodologyVersion: "participation_network_v1.0",
      calculatedAt: new Date().toISOString(),
      sampleSize: participationCount,
      threshold: 60,
      confidence: 0.2,
      summary: `Insufficient data: Company ${companyName} has only participated in ${participationCount} tender (minimum 2 tenders required for participation network evaluation).`,
      metrics: [
        {
          key: "participation_count",
          label: "Tenders participated",
          value: participationCount,
          formatted: `${participationCount} / min 2`,
        },
      ],
      evidenceCount: 0,
    };

    return {
      companyId,
      canonicalId,
      companyName,
      participationCount,
      wins,
      losses,
      degree,
      connectedTenders,
      frequentCoParticipants: [],
      recurringGroups: [],
      indicator,
      evidence: [],
    };
  }

  // Calculate co-participants
  const allPairs = calculateCoParticipationPairs(allTenders, companies, config);
  const companyPairs = allPairs.filter((p) => p.companyAId === companyId || p.companyBId === companyId);

  const frequentCoParticipants = companyPairs
    .filter((p) => p.sharedTenderCount >= 2)
    .map((p) => {
      const isA = p.companyAId === companyId;
      const otherId = isA ? p.companyBId : p.companyAId;
      const otherName = isA ? p.companyBName : p.companyAName;
      const otherCanonical = isA ? p.companyBCanonicalId : p.companyACanonicalId;

      return {
        companyId: otherId,
        canonicalId: otherCanonical,
        companyName: otherName,
        sharedTenderCount: p.sharedTenderCount,
        participationFrequency: p.participationFrequency,
        commonCategories: p.categories,
        commonOrganizations: p.organizations,
      };
    })
    .sort((a, b) => b.sharedTenderCount - a.sharedTenderCount)
    .slice(0, 10);

  // Groups
  const allGroups = identifyRecurringBidderGroups(allTenders, companies, 3, 2);
  const companyGroups = allGroups
    .filter((g) => g.companyIds.includes(companyId))
    .slice(0, 5);

  // Evidence
  const evidence: AnalyticsEvidence[] = [];
  companyPairs.slice(0, 4).forEach((p) => {
    if (p.sharedTenderCount >= 2) {
      evidence.push(generatePairEvidence(p));
    }
  });
  companyGroups.slice(0, 2).forEach((g) => {
    evidence.push(generateGroupEvidence(g));
  });

  // Calculate company network score
  const maxShared = frequentCoParticipants.length > 0 ? frequentCoParticipants[0].sharedTenderCount : 0;
  const maxFreq = frequentCoParticipants.length > 0 ? frequentCoParticipants[0].participationFrequency : 0;

  const coPartScore = Math.min(35, (maxShared / 6) * 35);
  const freqScore = Math.min(25, maxFreq * 25);
  const groupScore = companyGroups.length > 0 ? Math.min(20, companyGroups.length * 7) : 0;
  const recurrenceScore = Math.min(20, (participationCount / 10) * 20);

  const rawScore = Math.round(coPartScore + freqScore + groupScore + recurrenceScore);
  const score = normalizeScore(rawScore);
  const status = scoreToScreeningStatus(score, false, config);
  const confidence = computeSampleConfidence(participationCount, 2, 8);

  const summary =
    status === "HIGH INDICATOR" || status === "ELEVATED INDICATOR"
      ? `Elevated network recurrence pattern: ${companyName} co-participates repeatedly with ${frequentCoParticipants.length} distinct bidders (top co-bidder shared ${maxShared} tenders). Observed pattern requires further commercial review.`
      : status === "MODERATE INDICATOR"
      ? `Moderate network recurrence pattern: ${companyName} frequently co-bids with regular peers in ${frequentCoParticipants.length} observed relationships.`
      : `Observed participation patterns for ${companyName} show broad, open market participation across ${participationCount} tenders.`;

  const indicator: AnalyticsIndicator = {
    indicatorType: "PARTICIPATION_NETWORK",
    score,
    status,
    methodologyVersion: "participation_network_v1.0",
    calculatedAt: new Date().toISOString(),
    sampleSize: participationCount,
    threshold: 60,
    confidence,
    summary,
    metrics: [
      {
        key: "participation_count",
        label: "Total tenders participated",
        value: participationCount,
        formatted: `${participationCount} tenders`,
      },
      {
        key: "win_rate",
        label: "Historical win rate",
        value: Math.round((wins / (participationCount || 1)) * 100),
        formatted: `${((wins / (participationCount || 1)) * 100).toFixed(1)}%`,
      },
      {
        key: "top_co_participant_shared",
        label: "Top co-participant shared tenders",
        value: maxShared,
        formatted: `${maxShared} tenders`,
      },
      {
        key: "recurring_groups_count",
        label: "Recurring bidder groups",
        value: companyGroups.length,
        formatted: `${companyGroups.length} groups`,
      },
    ],
    evidenceCount: evidence.length,
  };

  return {
    companyId,
    canonicalId,
    companyName,
    participationCount,
    wins,
    losses,
    degree,
    connectedTenders,
    frequentCoParticipants,
    recurringGroups: companyGroups,
    indicator,
    evidence,
  };
}

/**
 * Detailed relationship analysis between two specific companies.
 */
export function detectPairRelationship(
  companyAId: number,
  companyBId: number,
  allTenders: NormalizedTenderInput[],
  companies: CompanyEntityInput[],
  config: ScreenerConfig = defaultScreenerConfig
): CoParticipationPair {
  const [c1, c2] = companyAId < companyBId ? [companyAId, companyBId] : [companyBId, companyAId];
  const allPairs = calculateCoParticipationPairs(allTenders, companies, config);
  const found = allPairs.find((p) => p.companyAId === c1 && p.companyBId === c2);

  if (found) {
    if (found.evidence.length === 0 && found.sharedTenderCount > 0) {
      found.evidence = [generatePairEvidence(found)];
    }
    return found;
  }

  const compA = companies.find((c) => c.id === c1);
  const compB = companies.find((c) => c.id === c2);

  return {
    companyAId: c1,
    companyAName: compA?.canonicalName ?? `Company ${c1}`,
    companyACanonicalId: `CMP-${String(c1).padStart(3, "0")}`,
    companyBId: c2,
    companyBName: compB?.canonicalName ?? `Company ${c2}`,
    companyBCanonicalId: `CMP-${String(c2).padStart(3, "0")}`,
    sharedTenderCount: 0,
    comparableTenderCount: allTenders.length,
    participationFrequency: 0,
    jaccardFrequency: 0,
    sharedTenderIds: [],
    sharedTenderNumbers: [],
    organizations: [],
    categories: [],
    startDate: null,
    endDate: null,
    networkScore: 0,
    status: "LOW_INDICATOR",
    evidence: [],
  };
}
