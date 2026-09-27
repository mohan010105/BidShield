import { NormalizedTenderInput } from "../../common/comparable";
import {
  jaccardSimilarity,
  normalizedEntropy,
  round,
} from "../../common/statistics";

export interface WinnerRotationMetricsResult {
  sampleSize: number;
  winnerSequence: Array<{
    tenderId: number;
    tenderNumber: string;
    date: string;
    winnerId: number | null;
    winnerName: string | null;
    contractValue: number | null;
    participantCount: number;
  }>;
  recurringBidders: Array<{
    companyId: number;
    companyName: string;
    participationCount: number;
    wins: number;
  }>;
  alternationCount: number;
  totalTransitions: number;
  winnerConcentration: number;
  winnerTransitionPattern: number;
  alternationFrequency: number;
  repeatedGroupRate: number;
  sequenceRegularity: number;
}

/**
 * Calculates rotation metrics across a chronological sequence of comparable tenders.
 */
export function calculateRotationMetrics(
  comparableTenders: NormalizedTenderInput[]
): WinnerRotationMetricsResult {
  const sampleSize = comparableTenders.length;

  // Build winner sequence
  const winnerSequence = comparableTenders.map((tender) => {
    const winBid = tender.bids.find((b) => b.isWinner) ?? tender.bids.find((b) => b.rank === 1);
    return {
      tenderId: tender.id,
      tenderNumber: tender.tenderNumber,
      date: tender.tenderDate,
      winnerId: winBid ? winBid.companyId : null,
      winnerName: winBid ? winBid.companyName : tender.winner,
      contractValue: tender.contractValue ?? (winBid ? winBid.bidAmount : null),
      participantCount: tender.bids.length,
    };
  });

  // Track participation and wins for each company across the comparable set
  const companyParticipation = new Map<number, { name: string; participations: number; wins: number }>();

  comparableTenders.forEach((tender) => {
    const winBid = tender.bids.find((b) => b.isWinner) ?? tender.bids.find((b) => b.rank === 1);
    const winnerId = winBid?.companyId;

    tender.bids.forEach((bid) => {
      const existing = companyParticipation.get(bid.companyId) ?? {
        name: bid.companyName,
        participations: 0,
        wins: 0,
      };
      existing.participations++;
      if (winnerId === bid.companyId) {
        existing.wins++;
      }
      companyParticipation.set(bid.companyId, existing);
    });
  });

  const recurringBidders = Array.from(companyParticipation.entries())
    .map(([companyId, stats]) => ({
      companyId,
      companyName: stats.name,
      participationCount: stats.participations,
      wins: stats.wins,
    }))
    .filter((b) => b.participationCount >= 2)
    .sort((a, b) => b.participationCount - a.participationCount);

  if (sampleSize < 2) {
    return {
      sampleSize,
      winnerSequence,
      recurringBidders,
      alternationCount: 0,
      totalTransitions: 0,
      winnerConcentration: 0,
      winnerTransitionPattern: 0,
      alternationFrequency: 0,
      repeatedGroupRate: 0,
      sequenceRegularity: 0,
    };
  }

  // 1. Alternation Frequency & Transitions
  let alternationCount = 0;
  let recurringTransitions = 0;
  const totalTransitions = sampleSize - 1;

  const recurringCompanyIds = new Set(recurringBidders.map((b) => b.companyId));

  for (let i = 0; i < totalTransitions; i++) {
    const wCurrent = winnerSequence[i].winnerId;
    const wNext = winnerSequence[i + 1].winnerId;

    if (wCurrent !== null && wNext !== null && wCurrent !== wNext) {
      alternationCount++;
      if (recurringCompanyIds.has(wCurrent) && recurringCompanyIds.has(wNext)) {
        recurringTransitions++;
      }
    }
  }

  const alternationFrequency = totalTransitions > 0 ? alternationCount / totalTransitions : 0;
  const winnerTransitionPattern = totalTransitions > 0 ? recurringTransitions / totalTransitions : 0;

  // 2. Repeated Participant Set (Average Jaccard similarity across consecutive tenders)
  let sumJaccard = 0;
  for (let i = 0; i < totalTransitions; i++) {
    const setA = comparableTenders[i].bids.map((b) => b.companyId);
    const setB = comparableTenders[i + 1].bids.map((b) => b.companyId);
    sumJaccard += jaccardSimilarity(setA, setB);
  }
  const repeatedGroupRate = totalTransitions > 0 ? sumJaccard / totalTransitions : 0;

  // 3. Winner Concentration among recurring winners
  // High entropy + balanced win distribution among recurring firms indicates shared turn-taking rather than single monopoly
  const activeWinningCounts = recurringBidders.filter((b) => b.wins > 0).map((b) => b.wins);
  const totalWins = activeWinningCounts.reduce((a, b) => a + b, 0);
  const topWinShare = totalWins > 0 ? Math.max(...activeWinningCounts) / totalWins : 1;
  const balanceFactor = topWinShare > 0.5 ? Math.max(0, 1 - (topWinShare - 0.5) * 2) : 1.0;
  const entropy = normalizedEntropy(activeWinningCounts);
  const distinctWinnersCount = activeWinningCounts.length;
  const winnerConcentration = distinctWinnersCount >= 2 ? entropy * balanceFactor : 0;

  // 4. Sequence Regularity (Periodicity / Cyclical turn-taking detection)
  // Check if winner sequences match cyclical lags: W[i] == W[i+k] for k in 2, 3, 4
  let periodicityMatches = 0;
  let possiblePeriodChecks = 0;

  const winners = winnerSequence.map((w) => w.winnerId);
  for (let k = 2; k <= Math.min(4, Math.floor(sampleSize / 2)); k++) {
    for (let i = 0; i + k < sampleSize; i++) {
      possiblePeriodChecks++;
      if (winners[i] !== null && winners[i + k] !== null && winners[i] === winners[i + k] && winners[i] !== winners[i + 1]) {
        periodicityMatches++;
      }
    }
  }

  const sequenceRegularity = possiblePeriodChecks > 0 ? Math.min(1.0, (periodicityMatches / possiblePeriodChecks) * 1.5) : 0;

  return {
    sampleSize,
    winnerSequence,
    recurringBidders,
    alternationCount,
    totalTransitions,
    winnerConcentration: round(winnerConcentration, 3),
    winnerTransitionPattern: round(winnerTransitionPattern, 3),
    alternationFrequency: round(alternationFrequency, 3),
    repeatedGroupRate: round(repeatedGroupRate, 3),
    sequenceRegularity: round(sequenceRegularity, 3),
  };
}
