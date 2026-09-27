import { NormalizedTenderInput } from "../../common/comparable";
import { coefficientOfVariation, mean, median, round, stdDev } from "../../common/statistics";
import { defaultScreenerConfig, ScreenerConfig } from "../../scoring/config";
import { CompanyNeatLossMetrics, LosingBidObservation } from "./types";
import { ScreeningStatus } from "../../common/types";

/**
 * Extracts and cleans chronologically sorted losing bid observations for a canonical company.
 */
export function extractCompanyLosingObservations(
  companyId: number,
  allTenders: NormalizedTenderInput[],
  filterScope?: { category?: string; organization?: string }
): {
  allParticipatedTenders: NormalizedTenderInput[];
  losingObservations: LosingBidObservation[];
  wonTenders: NormalizedTenderInput[];
} {
  let relevantTenders = allTenders.filter((t) =>
    t.bids.some((b) => b.companyId === companyId)
  );

  if (filterScope?.category) {
    relevantTenders = relevantTenders.filter((t) => t.category === filterScope.category);
  }
  if (filterScope?.organization) {
    relevantTenders = relevantTenders.filter((t) => t.organization === filterScope.organization);
  }

  // Chronologically sort
  const sortedTenders = [...relevantTenders].sort((a, b) =>
    a.tenderDate.localeCompare(b.tenderDate)
  );

  const losingObservations: LosingBidObservation[] = [];
  const wonTenders: NormalizedTenderInput[] = [];

  for (const tender of sortedTenders) {
    // Find valid winning bid
    const winBid =
      tender.bids.find((b) => b.isWinner && b.bidAmount > 0) ??
      (tender.bids.length > 0 && tender.bids.some((b) => b.bidAmount > 0)
        ? tender.bids.filter((b) => b.bidAmount > 0).reduce((min, b) => (b.bidAmount < min.bidAmount ? b : min))
        : null);

    const myBid = tender.bids.find((b) => b.companyId === companyId && b.bidAmount > 0);

    // Safeguard: ignore missing or non-positive bids
    if (!winBid || !myBid || winBid.bidAmount <= 0 || myBid.bidAmount <= 0) {
      continue;
    }

    const isWinner = myBid.isWinner || myBid.companyId === winBid.companyId;

    if (isWinner) {
      wonTenders.push(tender);
      continue;
    }

    const gapAmount = round(myBid.bidAmount - winBid.bidAmount, 2);
    // Relative gap: (losing - winning) / winning * 100
    const relativeGapPct = round(((myBid.bidAmount - winBid.bidAmount) / winBid.bidAmount) * 100, 4);

    const coBidders = tender.bids
      .filter((b) => b.companyId !== companyId && b.companyId > 0)
      .map((b) => b.companyId);

    losingObservations.push({
      tenderId: tender.id,
      tenderNumber: tender.tenderNumber,
      title: tender.title,
      tenderDate: tender.tenderDate,
      category: tender.category,
      organization: tender.organization,
      department: tender.department,
      estimatedValue: tender.estimatedValue,
      bidAmount: myBid.bidAmount,
      winningBidAmount: winBid.bidAmount,
      gapAmount,
      relativeGapPct,
      bidRank: myBid.rank > 0 ? myBid.rank : 2,
      isWinner: false,
      bidderCount: tender.bids.length,
      winnerCompanyId: winBid.companyId,
      winnerCompanyName: winBid.companyName,
      coBidders,
    });
  }

  return {
    allParticipatedTenders: sortedTenders,
    losingObservations,
    wonTenders,
  };
}

/**
 * Calculates comprehensive deterministic metrics for too-neat losing bids.
 */
export function calculateCompanyNeatLossMetrics(
  companyId: number,
  companyName: string,
  canonicalId: string,
  allTenders: NormalizedTenderInput[],
  config: ScreenerConfig = defaultScreenerConfig,
  comparisonGroup: string = "All Comparable Procurements",
  filterScope?: { category?: string; organization?: string }
): CompanyNeatLossMetrics {
  const { allParticipatedTenders, losingObservations, wonTenders } =
    extractCompanyLosingObservations(companyId, allTenders, filterScope);

  const participationCount = allParticipatedTenders.length;
  const winCount = wonTenders.length;
  const lossCount = losingObservations.length;
  const sampleSize = lossCount;

  const winRate = round(winCount / Math.max(1, participationCount), 4);
  const lossRate = round(lossCount / Math.max(1, participationCount), 4);

  const minObservations = config.sampleRequirements?.minNeatLossObservations ?? 5;
  const preferredObservations = config.sampleRequirements?.preferredNeatLossObservations ?? 8;

  // Handle Insufficient Data (< minObservations comparable losing records)
  if (lossCount < minObservations) {
    return {
      companyId,
      companyName,
      canonicalId,
      comparisonGroup,
      participationCount,
      winCount,
      lossCount,
      winRate,
      lossRate,
      meanBidRank: 0,
      medianBidRank: 0,
      rankStdDev: 0,
      minBidRank: 0,
      maxBidRank: 0,
      mostFrequentRank: 0,
      mostFrequentRankCount: 0,
      meanRelativeGapPct: null,
      medianRelativeGapPct: null,
      relativeGapStdDev: null,
      relativeGapCv: null,
      minRelativeGapPct: null,
      maxRelativeGapPct: null,
      narrowMarginObservationsCount: 0,
      repeatedRankCount: 0,
      repeatedBidderGroupCount: 0,
      sampleSize,
      isInsufficientData: true,
      insufficientReason: `Insufficient comparable historical observations (${lossCount} observed, minimum ${minObservations} required to reliably evaluate losing-bid consistency).`,
      subScores: {
        lossRateScore: 0,
        gapConsistencyScore: 0,
        rankRepetitionScore: 0,
        nearWinnerScore: 0,
        groupRepetitionScore: 0,
      },
      score: null,
      status: "INSUFFICIENT_DATA",
      methodologyVersion: config.neatLossMethodologyVersion,
      observations: losingObservations,
    };
  }

  // 1. Bid Rank Statistics
  const ranks = losingObservations.map((o) => o.bidRank);
  const meanBidRank = round(mean(ranks), 2);
  const medianBidRank = round(median(ranks), 1);
  const rankStdDev = round(stdDev(ranks, ranks.length > 1), 2);
  const minBidRank = Math.min(...ranks);
  const maxBidRank = Math.max(...ranks);

  // Find most frequent rank (mode)
  const rankFreqMap = new Map<number, number>();
  for (const r of ranks) {
    rankFreqMap.set(r, (rankFreqMap.get(r) ?? 0) + 1);
  }
  let mostFrequentRank = ranks[0];
  let mostFrequentRankCount = 0;
  for (const [r, count] of rankFreqMap.entries()) {
    if (count > mostFrequentRankCount) {
      mostFrequentRank = r;
      mostFrequentRankCount = count;
    }
  }
  const repeatedRankCount = mostFrequentRankCount;

  // 2. Relative Gap Statistics
  const gaps = losingObservations.map((o) => o.relativeGapPct);
  const meanRelativeGapPct = round(mean(gaps), 3);
  const medianRelativeGapPct = round(median(gaps), 3);
  const relativeGapStdDev = round(stdDev(gaps, gaps.length > 1), 3);
  const relativeGapCv = round(coefficientOfVariation(gaps, gaps.length > 1), 4);
  const minRelativeGapPct = round(Math.min(...gaps), 3);
  const maxRelativeGapPct = round(Math.max(...gaps), 3);

  // 3. Narrow Margin & Repetition Analysis
  const narrowThreshold = config.neatLoss.narrowMarginPctThreshold; // default 2.5%
  // Count observations where gap is <= narrowThreshold and within 1.0% of median gap
  const narrowMarginObservationsCount = losingObservations.filter(
    (o) => o.relativeGapPct <= narrowThreshold && Math.abs(o.relativeGapPct - medianRelativeGapPct) <= 1.0
  ).length;

  // 4. Repeated Bidder Group Occurrence
  // Check how frequently the same co-bidders appear across the losing observations
  const coBidderFreq = new Map<number, number>();
  for (const obs of losingObservations) {
    for (const peerId of obs.coBidders) {
      coBidderFreq.set(peerId, (coBidderFreq.get(peerId) ?? 0) + 1);
    }
  }
  // Co-bidders appearing in 3 or more of these losing tenders
  const repeatedBidderGroupCount = Array.from(coBidderFreq.values()).filter((c) => c >= 3).length;

  // 5. Deterministic Sub-scores Calculation (0-100 each)
  // A. Loss rate score
  let lossRateScore = 0;
  if (lossRate >= 0.95) lossRateScore = 100;
  else if (lossRate >= 0.85) lossRateScore = 80;
  else if (lossRate >= 0.75) lossRateScore = 60;
  else if (lossRate >= 0.60) lossRateScore = 40;
  else lossRateScore = Math.round(lossRate * 50);

  // B. Gap consistency score (Lower CV = higher consistency)
  let gapConsistencyScore = 0;
  if (relativeGapCv <= 0.05) gapConsistencyScore = 100;
  else if (relativeGapCv <= 0.10) gapConsistencyScore = 90;
  else if (relativeGapCv <= 0.15) gapConsistencyScore = 80;
  else if (relativeGapCv <= 0.25) gapConsistencyScore = 60;
  else if (relativeGapCv <= 0.40) gapConsistencyScore = 40;
  else if (relativeGapCv <= 0.60) gapConsistencyScore = 20;
  else gapConsistencyScore = 5;

  // C. Rank repetition score
  const rankRepetitionRatio = mostFrequentRankCount / lossCount;
  let rankRepetitionScore = 0;
  if (rankRepetitionRatio >= 0.80) rankRepetitionScore = 100;
  else if (rankRepetitionRatio >= 0.65) rankRepetitionScore = 80;
  else if (rankRepetitionRatio >= 0.50) rankRepetitionScore = 60;
  else if (rankRepetitionRatio >= 0.35) rankRepetitionScore = 35;
  else rankRepetitionScore = 15;

  // Bonus for repeated rank 2 (near winner)
  if (mostFrequentRank === 2 && rankRepetitionRatio >= 0.50) {
    rankRepetitionScore = Math.min(100, rankRepetitionScore + 10);
  }

  // D. Near-winner position score
  let nearWinnerScore = 0;
  if (medianRelativeGapPct <= 1.0 && relativeGapStdDev <= 0.6) {
    nearWinnerScore = 100;
  } else if (medianRelativeGapPct <= 2.0 && relativeGapStdDev <= 1.2) {
    nearWinnerScore = 80;
  } else if (medianRelativeGapPct <= 3.5 && relativeGapStdDev <= 2.0) {
    nearWinnerScore = 60;
  } else if (medianRelativeGapPct <= 5.0) {
    nearWinnerScore = 40;
  } else {
    nearWinnerScore = 15;
  }

  // E. Group repetition score
  let groupRepetitionScore = 0;
  if (repeatedBidderGroupCount >= 4) groupRepetitionScore = 100;
  else if (repeatedBidderGroupCount >= 3) groupRepetitionScore = 80;
  else if (repeatedBidderGroupCount >= 2) groupRepetitionScore = 60;
  else if (repeatedBidderGroupCount >= 1) groupRepetitionScore = 35;
  else groupRepetitionScore = 10;

  // 6. Weighted Final Score
  const weights = config.neatLoss;
  const rawWeightedScore =
    lossRateScore * weights.lossRateWeight +
    gapConsistencyScore * weights.gapConsistencyWeight +
    rankRepetitionScore * weights.rankRepetitionWeight +
    nearWinnerScore * weights.nearWinnerWeight +
    groupRepetitionScore * weights.groupRepetitionWeight;

  // Confidence scaling for small sample sizes between min (5) and preferred (8)
  const sampleConfidence = Math.min(1.0, lossCount / preferredObservations);
  const finalScore = Math.max(0, Math.min(100, Math.round(rawWeightedScore * sampleConfidence)));

  // Status mapping
  let status: ScreeningStatus = "LOW INDICATOR";
  if (finalScore >= 75) status = "HIGH INDICATOR";
  else if (finalScore >= 50) status = "ELEVATED INDICATOR";
  else if (finalScore >= 25) status = "MODERATE INDICATOR";

  return {
    companyId,
    companyName,
    canonicalId,
    comparisonGroup,
    participationCount,
    winCount,
    lossCount,
    winRate,
    lossRate,
    meanBidRank,
    medianBidRank,
    rankStdDev,
    minBidRank,
    maxBidRank,
    mostFrequentRank,
    mostFrequentRankCount,
    meanRelativeGapPct,
    medianRelativeGapPct,
    relativeGapStdDev,
    relativeGapCv,
    minRelativeGapPct,
    maxRelativeGapPct,
    narrowMarginObservationsCount,
    repeatedRankCount,
    repeatedBidderGroupCount,
    sampleSize,
    isInsufficientData: false,
    subScores: {
      lossRateScore,
      gapConsistencyScore,
      rankRepetitionScore,
      nearWinnerScore,
      groupRepetitionScore,
    },
    score: finalScore,
    status,
    methodologyVersion: config.neatLossMethodologyVersion,
    observations: losingObservations,
  };
}
