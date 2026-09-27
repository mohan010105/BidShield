/**
 * Statistical utility functions for deterministic procurement screening.
 */

export function round(value: number, decimals: number = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  const sum = values.reduce((acc, v) => acc + v, 0);
  return sum / values.length;
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 !== 0) {
    return sorted[mid];
  }
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

export function variance(values: number[], sample: boolean = false): number {
  if (values.length <= (sample ? 1 : 0)) return 0;
  const avg = mean(values);
  const sumOfSquares = values.reduce((acc, v) => acc + Math.pow(v - avg, 2), 0);
  const divisor = sample ? values.length - 1 : values.length;
  return sumOfSquares / divisor;
}

export function stdDev(values: number[], sample: boolean = false): number {
  return Math.sqrt(variance(values, sample));
}

/**
 * Calculates normalized Herfindahl-Hirschman Index (HHI) for win or bid shares.
 * Returns a value between 0 (maximally dispersed) and 1 (100% concentrated).
 */
export function herfindahlIndex(shares: number[]): number {
  const total = shares.reduce((acc, s) => acc + s, 0);
  if (total === 0 || shares.length <= 1) return 1;
  const proportions = shares.map((s) => s / total);
  const rawHHI = proportions.reduce((acc, p) => acc + Math.pow(p, 2), 0);
  const n = shares.length;
  // Normalize so 1/n maps to 0 and 1 maps to 1
  const minHHI = 1 / n;
  if (n === 1 || minHHI >= 1) return 1;
  return Math.max(0, Math.min(1, (rawHHI - minHHI) / (1 - minHHI)));
}

/**
 * Shannon Entropy normalized to [0, 1].
 * 1 = maximally equal/uniform distribution, 0 = completely deterministic single state.
 */
export function normalizedEntropy(counts: number[]): number {
  const total = counts.reduce((acc, c) => acc + c, 0);
  if (total === 0 || counts.length <= 1) return 0;
  const positive = counts.filter((c) => c > 0);
  if (positive.length <= 1) return 0;
  const ent = positive.reduce((acc, c) => {
    const p = c / total;
    return acc - p * Math.log2(p);
  }, 0);
  const maxEnt = Math.log2(counts.length);
  return maxEnt > 0 ? ent / maxEnt : 0;
}

/**
 * Jaccard similarity between two arrays/sets of IDs.
 */
export function jaccardSimilarity<T>(setA: T[] | Set<T>, setB: T[] | Set<T>): number {
  const a = new Set(setA);
  const b = new Set(setB);
  if (a.size === 0 && b.size === 0) return 1;
  let intersectionSize = 0;
  for (const item of a) {
    if (b.has(item)) intersectionSize++;
  }
  const unionSize = a.size + b.size - intersectionSize;
  return unionSize > 0 ? intersectionSize / unionSize : 0;
}

/**
 * Relative distance of a losing bid relative to winning bid:
 * (bidAmount - winningBidAmount) / winningBidAmount (expressed as percentage: e.g. 8.1 for +8.1%)
 */
export function relativeBidDistance(bidAmount: number, winningBidAmount: number): number {
  if (winningBidAmount <= 0) return 0;
  return round(((bidAmount - winningBidAmount) / winningBidAmount) * 100, 2);
}

/**
 * Coefficient of Variation (CV) = standard deviation / mean.
 * If mean is 0 or values <= 1, returns 0.
 */
export function coefficientOfVariation(values: number[], sample: boolean = false): number {
  const avg = mean(values);
  if (avg <= 0 || values.length <= 1) return 0;
  const sd = stdDev(values, sample);
  return round(sd / avg, 4);
}

/**
 * Calculates empirical percentile rank (0 to 100) of a value within a reference population.
 * Uses standard mid-rank percentile definition:
 * (count(x < value) + 0.5 * count(x === value)) / population.length * 100
 */
export function percentileRank(value: number, population: number[]): number {
  if (population.length === 0) return 50;
  let strictlyLess = 0;
  let equal = 0;
  for (const v of population) {
    if (v < value) strictlyLess++;
    else if (v === value) equal++;
  }
  const rank = ((strictlyLess + 0.5 * equal) / population.length) * 100;
  return round(rank, 1);
}

/**
 * Inter-bid distances between adjacent sorted bids.
 */
export function interBidDistances(bids: number[]): number[] {
  if (bids.length < 2) return [];
  const sorted = [...bids].sort((a, b) => a - b);
  const diffs: number[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    diffs.push(round(sorted[i + 1] - sorted[i], 2));
  }
  return diffs;
}

/**
 * Spread calculation: max - min and normalized spread percentage relative to min (or winner).
 */
export function bidSpread(bids: number[]): { absolute: number; normalizedPct: number } {
  if (bids.length === 0) return { absolute: 0, normalizedPct: 0 };
  const min = Math.min(...bids);
  const max = Math.max(...bids);
  const absolute = round(max - min, 2);
  const normalizedPct = min > 0 ? round(((max - min) / min) * 100, 2) : 0;
  return { absolute, normalizedPct };
}

