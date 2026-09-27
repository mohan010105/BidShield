import { ComparisonScope } from "./types";
import { ScreenerConfig, defaultScreenerConfig } from "../scoring/config";
import { round } from "./statistics";

export interface NormalizedTenderInput {
  id: number;
  tenderNumber: string;
  title: string;
  organization: string;
  department: string;
  category: string;
  location: string;
  state: string;
  tenderDate: string;
  closingDate: string;
  estimatedValue: number;
  contractValue: number | null;
  winner: string | null;
  bids: Array<{
    companyId: number;
    companyName: string;
    bidAmount: number;
    rank: number;
    isWinner: boolean;
    differenceFromWinner: number;
  }>;
}

export interface ComparableResult {
  comparableTenders: NormalizedTenderInput[];
  scope: ComparisonScope;
  similarityScores: Map<number, number>;
}

function parseMonths(dateStr: string): number {
  const parts = dateStr.split("-").map(Number);
  if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return parts[0] * 12 + parts[1];
  }
  return 0;
}

function formatCurrencyShort(val: number): string {
  if (val >= 10000000) {
    return `₹${(val / 10000000).toFixed(2)} Cr`;
  }
  if (val >= 100000) {
    return `₹${(val / 100000).toFixed(2)} L`;
  }
  if (val >= 1000) {
    return `₹${(val / 1000).toFixed(1)} K`;
  }
  return `₹${val.toLocaleString("en-IN")}`;
}

/**
 * Calculates multi-attribute similarity between target tender and candidate tender.
 */
export function calculateTenderSimilarity(
  target: NormalizedTenderInput,
  candidate: NormalizedTenderInput,
  config: ScreenerConfig = defaultScreenerConfig
): number {
  if (target.id === candidate.id) return 1.0;

  const weights = config.comparable;
  let score = 0;

  // 1. Category match (Must be compatible domain)
  const targetCat = target.category.trim().toLowerCase();
  const candCat = candidate.category.trim().toLowerCase();
  if (targetCat === candCat) {
    score += weights.categoryWeight;
  } else if (targetCat.includes(candCat) || candCat.includes(targetCat)) {
    score += weights.categoryWeight * 0.6;
  }

  // 2. Organization match
  const targetOrg = target.organization.trim().toLowerCase();
  const candOrg = candidate.organization.trim().toLowerCase();
  if (targetOrg === candOrg) {
    score += weights.organizationWeight;
  } else {
    // Check partial organization match
    const targetWords = targetOrg.split(/\s+/);
    const candWords = candOrg.split(/\s+/);
    const shared = targetWords.filter((w) => w.length > 3 && candWords.includes(w)).length;
    if (shared >= 2) {
      score += weights.organizationWeight * 0.5;
    }
  }

  // 3. Department match
  const targetDept = target.department.trim().toLowerCase();
  const candDept = candidate.department.trim().toLowerCase();
  if (targetDept === candDept) {
    score += weights.departmentWeight;
  }

  // 4. State / Geography match
  const targetState = target.state.trim().toLowerCase();
  const candState = candidate.state.trim().toLowerCase();
  if (targetState === candState) {
    score += weights.stateWeight;
  }

  // 5. Value Range similarity (logarithmic scale difference)
  if (target.estimatedValue > 0 && candidate.estimatedValue > 0) {
    const logRatio = Math.abs(Math.log10(target.estimatedValue) - Math.log10(candidate.estimatedValue));
    const maxLogDiff = Math.log10(weights.maxValueRatio);
    const valueSim = Math.max(0, 1 - logRatio / maxLogDiff);
    score += weights.valueRangeWeight * valueSim;
  }

  // 6. Time window proximity
  const targetMonths = parseMonths(target.tenderDate);
  const candMonths = parseMonths(candidate.tenderDate);
  if (targetMonths > 0 && candMonths > 0) {
    const diff = Math.abs(targetMonths - candMonths);
    const timeSim = Math.max(0, 1 - diff / weights.maxTimeWindowMonths);
    score += weights.timeWindowWeight * timeSim;
  }

  return round(score, 4);
}

/**
 * Finds comparable tenders for a target tender from a population of tenders.
 * Avoids comparing unrelated tenders (different categories, mismatched scale, distant regions).
 */
export function findComparableTenders(
  target: NormalizedTenderInput,
  allTenders: NormalizedTenderInput[],
  config: ScreenerConfig = defaultScreenerConfig
): ComparableResult {
  const similarityScores = new Map<number, number>();

  const comparable = allTenders.filter((candidate) => {
    const sim = calculateTenderSimilarity(target, candidate, config);
    similarityScores.set(candidate.id, sim);
    return sim >= config.comparable.minSimilarityThreshold;
  });

  // Always include the target tender itself in the chronological sequence
  if (!comparable.some((t) => t.id === target.id)) {
    comparable.push(target);
    similarityScores.set(target.id, 1.0);
  }

  // Sort chronologically by tenderDate, then id
  comparable.sort((a, b) => {
    const dateComp = a.tenderDate.localeCompare(b.tenderDate);
    if (dateComp !== 0) return dateComp;
    return a.id - b.id;
  });

  // Compute summary values for ComparisonScope
  const values = comparable.map((t) => t.estimatedValue);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const dates = comparable.map((t) => t.tenderDate).filter(Boolean);
  const startDate = dates.length ? dates[0] : target.tenderDate;
  const endDate = dates.length ? dates[dates.length - 1] : target.tenderDate;

  const scope: ComparisonScope = {
    category: target.category,
    organization: target.organization,
    department: target.department,
    geography: target.state ? `${target.state} (${target.location})` : target.location,
    valueRange: `${formatCurrencyShort(minVal)} – ${formatCurrencyShort(maxVal)}`,
    startDate,
    endDate,
    comparableTenderCount: comparable.length,
  };

  return {
    comparableTenders: comparable,
    scope,
    similarityScores,
  };
}
