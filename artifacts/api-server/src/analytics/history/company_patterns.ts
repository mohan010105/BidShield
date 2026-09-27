import { CompanyPatterns, CoverBidListItem, RotationListItem } from "../common/types";
import { NormalizedTenderInput } from "../common/comparable";
import { mean, median, relativeBidDistance, round } from "../common/statistics";
import { detectWinnerRotation } from "../screens/winner_rotation/detector";
import { detectCoverBid } from "../screens/cover_bid/detector";
import { findComparableTenders } from "../common/comparable";

/**
 * Calculates historical patterns for a single company across the procurement corpus.
 */
export function calculateCompanyPatterns(
  companyId: number,
  companyName: string,
  allTenders: NormalizedTenderInput[]
): CompanyPatterns {
  const participatedTenders = allTenders.filter((t) =>
    t.bids.some((b) => b.companyId === companyId)
  );

  const wins = participatedTenders.filter((t) => {
    const winBid = t.bids.find((b) => b.isWinner) ?? t.bids.find((b) => b.rank === 1);
    return winBid?.companyId === companyId;
  }).length;

  const participationCount = participatedTenders.length;
  const losses = Math.max(0, participationCount - wins);
  const winRate = participationCount > 0 ? round((wins / participationCount) * 100, 1) : 0;

  // Calculate losing bid distances
  const bidDistances: number[] = [];
  const bidDistanceHistory: { label: string; value: number }[] = [];

  participatedTenders.forEach((tender, index) => {
    const winBid = tender.bids.find((b) => b.isWinner) ?? tender.bids.find((b) => b.rank === 1);
    const myBid = tender.bids.find((b) => b.companyId === companyId);
    if (winBid && myBid && winBid.bidAmount > 0) {
      if (myBid.companyId !== winBid.companyId) {
        const delta = relativeBidDistance(myBid.bidAmount, winBid.bidAmount);
        bidDistances.push(delta);
        bidDistanceHistory.push({
          label: tender.tenderNumber.replace("BS-2025-", "T-"),
          value: round(delta, 1),
        });
      } else {
        bidDistanceHistory.push({
          label: tender.tenderNumber.replace("BS-2025-", "T-"),
          value: 0,
        });
      }
    }
  });

  const averageBidDistance = bidDistances.length > 0 ? round(mean(bidDistances), 1) : null;
  const medianBidDistance = bidDistances.length > 0 ? round(median(bidDistances), 1) : null;

  // Track winner transitions involving this company
  const transitionCounts = new Map<string, number>();
  // Also track recurring peer groups
  const peerCoOccurrence = new Map<number, number>();

  allTenders.forEach((t) => {
    if (t.bids.some((b) => b.companyId === companyId)) {
      t.bids.forEach((b) => {
        if (b.companyId !== companyId) {
          peerCoOccurrence.set(b.companyId, (peerCoOccurrence.get(b.companyId) ?? 0) + 1);
        }
      });
    }
  });

  const repeatedParticipantGroups = Array.from(peerCoOccurrence.values()).filter((c) => c >= 3).length;

  // Check chronological transitions in comparable groups
  const rotationIndicators: RotationListItem[] = [];
  const coverBidIndicators: CoverBidListItem[] = [];

  // Sort participated tenders chronologically
  const sortedParticipated = [...participatedTenders].sort((a, b) => a.tenderDate.localeCompare(b.tenderDate));

  for (let i = 0; i < sortedParticipated.length - 1; i++) {
    const tCurrent = sortedParticipated[i];
    const tNext = sortedParticipated[i + 1];
    const wCurrent = tCurrent.bids.find((b) => b.isWinner) ?? tCurrent.bids.find((b) => b.rank === 1);
    const wNext = tNext.bids.find((b) => b.isWinner) ?? tNext.bids.find((b) => b.rank === 1);

    if (wCurrent && wNext && wCurrent.companyId !== wNext.companyId) {
      if (wCurrent.companyId === companyId) {
        const key = `Preceded ${wNext.companyName}`;
        transitionCounts.set(key, (transitionCounts.get(key) ?? 0) + 1);
      } else if (wNext.companyId === companyId) {
        const key = `Succeeded ${wCurrent.companyName}`;
        transitionCounts.set(key, (transitionCounts.get(key) ?? 0) + 1);
      }
    }
  }

  const winnerTransitions = Array.from(transitionCounts.entries())
    .map(([key, count]) => `${key} (${count}x)`)
    .slice(0, 5);

  // Run screeners on participated tenders to gather company-level indicator summaries
  participatedTenders.forEach((target) => {
    const { comparableTenders, scope } = findComparableTenders(target, allTenders);
    const rot = detectWinnerRotation(target, comparableTenders, scope);
    const cov = detectCoverBid(target, comparableTenders, scope);

    if (rot.indicator.score !== null && rot.indicator.score >= 50) {
      rotationIndicators.push({
        tenderId: target.id,
        tenderNumber: target.tenderNumber,
        score: rot.indicator.score,
        status: rot.indicator.status,
        sampleSize: rot.metrics.sampleSize,
        winner: target.winner,
        comparisonGroup: `${scope.category} · ${scope.organization}`,
        winnerSequence: rot.metrics.winnerSequence.map((w) => w.winnerName ?? "Unknown").slice(0, 6),
      });
    }

    if (cov.indicator.score !== null && cov.indicator.score >= 50 && cov.metrics.flaggedCompanies.includes(companyName)) {
      coverBidIndicators.push({
        tenderId: target.id,
        tenderNumber: target.tenderNumber,
        score: cov.indicator.score,
        status: cov.indicator.status,
        sampleSize: cov.metrics.bidCount,
        comparisonGroup: `${scope.category} · ${scope.organization}`,
        flaggedCompanies: cov.metrics.flaggedCompanies,
        medianRelativeDistance: cov.metrics.medianRelativeDistance,
        currentRelativeDistances: cov.metrics.currentRelativeDistances,
      });
    }
  });

  return {
    companyId,
    companyName,
    participationCount,
    wins,
    losses,
    winRate,
    averageBidDistance,
    medianBidDistance,
    comparableTenderCount: participatedTenders.length,
    repeatedParticipantGroups,
    winnerTransitions,
    bidDistanceHistory: bidDistanceHistory.slice(-12),
    rotationIndicators: rotationIndicators.slice(0, 8),
    coverBidIndicators: coverBidIndicators.slice(0, 8),
  };
}
