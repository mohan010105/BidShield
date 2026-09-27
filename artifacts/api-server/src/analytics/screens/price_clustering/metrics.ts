import { NormalizedTenderInput } from "../../common/comparable";
import {
  bidSpread,
  coefficientOfVariation,
  interBidDistances,
  mean,
  median,
  percentileRank,
  relativeBidDistance,
  round,
  stdDev,
} from "../../common/statistics";
import { defaultScreenerConfig, ScreenerConfig } from "../../scoring/config";

export interface BidItemMetric {
  companyId: number;
  companyName: string;
  bidAmount: number;
  rank: number;
  isWinner: boolean;
  relativeDistancePct: number;
  relativeToEstimatePct: number | null;
}

export interface PriceClusteringMetricsResult {
  tenderId: number;
  tenderNumber: string;
  bidCount: number;
  winningBidAmount: number;
  winningCompany: string | null;
  estimatedValue: number;
  winningBidPctOfEstimate: number | null;
  minBid: number;
  maxBid: number;
  meanBid: number;
  medianBid: number;
  stdDevBid: number;
  coefficientOfVariation: number;
  bidSpreadAmount: number;
  normalizedSpreadPct: number;
  interBidGaps: number[];
  medianInterBidGap: number;
  bidItems: BidItemMetric[];

  // Comparable Baseline
  comparableTenderCount: number;
  comparableCVs: number[];
  comparableSpreadsPct: number[];
  historicalMedianCV: number | null;
  historicalMeanCV: number | null;
  historicalMedianSpreadPct: number | null;
  cvPercentile: number | null;
  spreadPercentile: number | null;

  // Sub-Indicator Scores (0.0 - 1.0)
  tenderConcentrationScore: number;
  historicalComparisonScore: number;
  percentileDeviationScore: number;
  relativeDistanceScore: number;
  repeatedPositioningScore: number;

  // Sample Requirements & Validity
  isInsufficientBids: boolean;
  isInsufficientComparable: boolean;
  isInsufficientData: boolean;
  insufficientReason: string | null;
}

/**
 * Calculates deterministic price clustering and dispersion metrics for a target tender
 * against a multi-attribute comparable tender population.
 */
export function calculatePriceClusteringMetrics(
  targetTender: NormalizedTenderInput,
  comparableTenders: NormalizedTenderInput[],
  config: ScreenerConfig = defaultScreenerConfig
): PriceClusteringMetricsResult {
  const bids = targetTender.bids;
  const bidCount = bids.length;
  const minRequiredBids = config.sampleRequirements.minBidsForPriceClustering;
  const minRequiredComparable = config.sampleRequirements.minComparableForPriceClustering;

  const winBid =
    bids.find((b) => b.isWinner) ??
    (bids.length > 0 ? bids.reduce((min, b) => (b.bidAmount < min.bidAmount ? b : min)) : null);
  const winningBidAmount = winBid?.bidAmount ?? 0;
  const winningCompany = winBid?.companyName ?? targetTender.winner;
  const estimatedValue = targetTender.estimatedValue;

  const isInsufficientBids = bidCount < minRequiredBids;
  const numericBids = bids.map((b) => b.bidAmount).filter((amt) => typeof amt === "number" && amt > 0 && Number.isFinite(amt));

  // If bids missing or less than minimum
  if (isInsufficientBids || numericBids.length < 2 || winningBidAmount <= 0) {
    const reason = `Only ${bidCount} bid(s) available for tender ${targetTender.tenderNumber}. At least ${minRequiredBids} bids are required for this screening.`;
    return {
      tenderId: targetTender.id,
      tenderNumber: targetTender.tenderNumber,
      bidCount,
      winningBidAmount,
      winningCompany,
      estimatedValue,
      winningBidPctOfEstimate: null,
      minBid: numericBids.length > 0 ? Math.min(...numericBids) : 0,
      maxBid: numericBids.length > 0 ? Math.max(...numericBids) : 0,
      meanBid: mean(numericBids),
      medianBid: median(numericBids),
      stdDevBid: 0,
      coefficientOfVariation: 0,
      bidSpreadAmount: 0,
      normalizedSpreadPct: 0,
      interBidGaps: [],
      medianInterBidGap: 0,
      bidItems: [],
      comparableTenderCount: 0,
      comparableCVs: [],
      comparableSpreadsPct: [],
      historicalMedianCV: null,
      historicalMeanCV: null,
      historicalMedianSpreadPct: null,
      cvPercentile: null,
      spreadPercentile: null,
      tenderConcentrationScore: 0,
      historicalComparisonScore: 0,
      percentileDeviationScore: 0,
      relativeDistanceScore: 0,
      repeatedPositioningScore: 0,
      isInsufficientBids: true,
      isInsufficientComparable: false,
      isInsufficientData: true,
      insufficientReason: reason,
    };
  }

  // Tender-Level Statistics
  const minBid = Math.min(...numericBids);
  const maxBid = Math.max(...numericBids);
  const meanBid = round(mean(numericBids), 2);
  const medianBid = round(median(numericBids), 2);
  const stdDevBid = round(stdDev(numericBids, true), 2);
  const coefficientOfVariation = round(stdDevBid / meanBid, 4);
  const spread = bidSpread(numericBids);
  const bidSpreadAmount = spread.absolute;
  const normalizedSpreadPct = round(((maxBid - minBid) / winningBidAmount) * 100, 2);
  const interBidGaps = interBidDistances(numericBids);
  const medianInterBidGap = interBidGaps.length > 0 ? round(median(interBidGaps), 2) : 0;
  const winningBidPctOfEstimate = estimatedValue > 0 ? round((winningBidAmount / estimatedValue) * 100, 2) : null;

  const bidItems: BidItemMetric[] = bids.map((b) => ({
    companyId: b.companyId,
    companyName: b.companyName,
    bidAmount: b.bidAmount,
    rank: b.rank,
    isWinner: b.companyId === winBid?.companyId,
    relativeDistancePct: b.companyId === winBid?.companyId ? 0 : relativeBidDistance(b.bidAmount, winningBidAmount),
    relativeToEstimatePct: estimatedValue > 0 ? round((b.bidAmount / estimatedValue) * 100, 2) : null,
  }));

  // Comparable Baseline Evaluation
  const comparableCVs: number[] = [];
  const comparableSpreadsPct: number[] = [];
  const historicalLosingDeltas = new Map<number, number[]>();

  comparableTenders.forEach((compTender) => {
    const compNumericBids = compTender.bids
      .map((b) => b.bidAmount)
      .filter((amt) => typeof amt === "number" && amt > 0 && Number.isFinite(amt));

    if (compNumericBids.length >= 2) {
      const compMean = mean(compNumericBids);
      const compStd = stdDev(compNumericBids, true);
      if (compMean > 0) {
        const compCV = round(compStd / compMean, 4);
        comparableCVs.push(compCV);
      }
      const compSpread = bidSpread(compNumericBids);
      comparableSpreadsPct.push(compSpread.normalizedPct);
    }

    if (compTender.id !== targetTender.id) {
      const compWinner =
        compTender.bids.find((b) => b.isWinner) ??
        (compTender.bids.length > 0 ? compTender.bids.reduce((min, b) => (b.bidAmount < min.bidAmount ? b : min)) : null);
      if (compWinner && compWinner.bidAmount > 0) {
        compTender.bids.forEach((b) => {
          if (b.companyId !== compWinner.companyId) {
            const delta = relativeBidDistance(b.bidAmount, compWinner.bidAmount);
            if (delta >= 0 && Number.isFinite(delta)) {
              const list = historicalLosingDeltas.get(b.companyId) ?? [];
              list.push(delta);
              historicalLosingDeltas.set(b.companyId, list);
            }
          }
        });
      }
    }
  });

  const validComparableTenders = comparableTenders.filter((t) => t.bids.length >= 2);
  const comparableTenderCount = validComparableTenders.length;
  const isInsufficientComparable = comparableTenderCount < minRequiredComparable;

  if (isInsufficientComparable) {
    const reason = `Only ${comparableTenderCount} comparable tender(s) found. At least ${minRequiredComparable} comparable tenders are required for this screening.`;

    return {
      tenderId: targetTender.id,
      tenderNumber: targetTender.tenderNumber,
      bidCount,
      winningBidAmount,
      winningCompany,
      estimatedValue,
      winningBidPctOfEstimate,
      minBid,
      maxBid,
      meanBid,
      medianBid,
      stdDevBid,
      coefficientOfVariation,
      bidSpreadAmount,
      normalizedSpreadPct,
      interBidGaps,
      medianInterBidGap,
      bidItems,
      comparableTenderCount,
      comparableCVs,
      comparableSpreadsPct,
      historicalMedianCV: comparableCVs.length > 0 ? round(median(comparableCVs), 4) : null,
      historicalMeanCV: comparableCVs.length > 0 ? round(mean(comparableCVs), 4) : null,
      historicalMedianSpreadPct: comparableSpreadsPct.length > 0 ? round(median(comparableSpreadsPct), 2) : null,
      cvPercentile: null,
      spreadPercentile: null,
      tenderConcentrationScore: 0,
      historicalComparisonScore: 0,
      percentileDeviationScore: 0,
      relativeDistanceScore: 0,
      repeatedPositioningScore: 0,
      isInsufficientBids: false,
      isInsufficientComparable: true,
      isInsufficientData: true,
      insufficientReason: reason,
    };
  }

  // Calculate Historical Baseline Metrics
  const historicalMedianCV = round(median(comparableCVs), 4);
  const historicalMeanCV = round(mean(comparableCVs), 4);
  const historicalMedianSpreadPct = round(median(comparableSpreadsPct), 2);
  const cvPercentile = round(percentileRank(coefficientOfVariation, comparableCVs), 1);
  const spreadPercentile = round(percentileRank(normalizedSpreadPct, comparableSpreadsPct), 1);

  // 1. Tender-Level Concentration Sub-Score (0 - 1.0)
  // Low CV means tight price concentration
  let tenderConcentrationScore = 0;
  if (coefficientOfVariation < 0.005) tenderConcentrationScore = 1.0;
  else if (coefficientOfVariation < 0.009) tenderConcentrationScore = 0.85;
  else if (coefficientOfVariation < 0.015) tenderConcentrationScore = 0.65;
  else if (coefficientOfVariation < 0.025) tenderConcentrationScore = 0.40;
  else if (coefficientOfVariation < 0.040) tenderConcentrationScore = 0.20;
  else tenderConcentrationScore = 0.05;

  if (normalizedSpreadPct < 1.5) {
    tenderConcentrationScore = Math.min(1.0, tenderConcentrationScore + 0.15);
  }

  // 2. Historical Baseline Comparison Sub-Score (0 - 1.0)
  // Ratio of current tender CV to median comparable tender CV
  let historicalComparisonScore = 0;
  if (historicalMedianCV > 0) {
    const cvRatio = coefficientOfVariation / historicalMedianCV;
    if (cvRatio <= 0.25) historicalComparisonScore = 1.0;
    else if (cvRatio <= 0.45) historicalComparisonScore = 0.85;
    else if (cvRatio <= 0.70) historicalComparisonScore = 0.65;
    else if (cvRatio <= 0.90) historicalComparisonScore = 0.45;
    else if (cvRatio <= 1.15) historicalComparisonScore = 0.20;
    else historicalComparisonScore = 0.05;
  }

  // 3. Percentile Deviation Sub-Score (0 - 1.0)
  // Lower percentile position = tighter concentration relative to population
  let percentileDeviationScore = 0;
  if (cvPercentile <= 5.0) percentileDeviationScore = 1.0;
  else if (cvPercentile <= 10.0) percentileDeviationScore = 0.85;
  else if (cvPercentile <= 20.0) percentileDeviationScore = 0.65;
  else if (cvPercentile <= 35.0) percentileDeviationScore = 0.45;
  else if (cvPercentile <= 50.0) percentileDeviationScore = 0.25;
  else percentileDeviationScore = 0.05;

  // 4. Relative Distance & Inter-Bid Gap Concentration Sub-Score (0 - 1.0)
  const losingBids = bidItems.filter((b) => !b.isWinner);
  const losingDistances = losingBids.map((b) => b.relativeDistancePct);
  let relativeDistanceScore = 0;
  if (losingDistances.length >= 2) {
    const losingStd = stdDev(losingDistances, true);
    if (losingStd < 0.6) relativeDistanceScore = 0.95;
    else if (losingStd < 1.2) relativeDistanceScore = 0.75;
    else if (losingStd < 2.0) relativeDistanceScore = 0.50;
    else if (losingStd < 3.5) relativeDistanceScore = 0.25;
    else relativeDistanceScore = 0.10;
  } else if (normalizedSpreadPct < 2.0) {
    relativeDistanceScore = 0.65;
  }

  // 5. Repeated Positioning Sub-Score (0 - 1.0)
  let repeatedProximityMatches = 0;
  losingBids.forEach((b) => {
    const histDeltas = historicalLosingDeltas.get(b.companyId) ?? [];
    if (histDeltas.length >= 2) {
      const histMedian = median(histDeltas);
      if (Math.abs(b.relativeDistancePct - histMedian) <= 1.0) {
        repeatedProximityMatches++;
      }
    }
  });
  const repeatedPositioningScore =
    losingBids.length > 0 ? Math.min(1.0, repeatedProximityMatches / losingBids.length) : 0;

  return {
    tenderId: targetTender.id,
    tenderNumber: targetTender.tenderNumber,
    bidCount,
    winningBidAmount,
    winningCompany,
    estimatedValue,
    winningBidPctOfEstimate,
    minBid,
    maxBid,
    meanBid,
    medianBid,
    stdDevBid,
    coefficientOfVariation,
    bidSpreadAmount,
    normalizedSpreadPct,
    interBidGaps,
    medianInterBidGap,
    bidItems,
    comparableTenderCount,
    comparableCVs,
    comparableSpreadsPct,
    historicalMedianCV,
    historicalMeanCV,
    historicalMedianSpreadPct,
    cvPercentile,
    spreadPercentile,
    tenderConcentrationScore: round(tenderConcentrationScore, 3),
    historicalComparisonScore: round(historicalComparisonScore, 3),
    percentileDeviationScore: round(percentileDeviationScore, 3),
    relativeDistanceScore: round(relativeDistanceScore, 3),
    repeatedPositioningScore: round(repeatedPositioningScore, 3),
    isInsufficientBids: false,
    isInsufficientComparable: false,
    isInsufficientData: false,
    insufficientReason: null,
  };
}
