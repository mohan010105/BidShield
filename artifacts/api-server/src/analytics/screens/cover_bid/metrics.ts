import { NormalizedTenderInput } from "../../common/comparable";
import {
  mean,
  median,
  relativeBidDistance,
  round,
  stdDev,
} from "../../common/statistics";
import { ScreenerConfig, defaultScreenerConfig } from "../../scoring/config";

export interface BidPositioningDetail {
  companyId: number;
  companyName: string;
  bidAmount: number;
  rank: number;
  isWinner: boolean;
  relativeDistancePct: number;
  historicalComparableObservations: number;
  historicalMedianDistancePct: number | null;
  historicalStdDevDistancePct: number | null;
  isRepeatedProximity: boolean;
  proximityDeltaPct: number | null;
}

export interface CoverBidMetricsResult {
  tenderId: number;
  bidCount: number;
  winningBidAmount: number;
  winningCompany: string | null;
  bidPositions: BidPositionDetail[];
  currentRelativeDistances: number[];
  medianRelativeDistance: number;
  meanRelativeDistance: number;
  bidSpreadPct: number;
  clusteringStdDev: number;
  flaggedCompanies: string[];
  historicalProximityScore: number;
  tightClusteringScore: number;
  consistentDeltaScore: number;
  spreadAnomalyScore: number;
}

export type BidPositionDetail = BidPositioningDetail;

/**
 * Computes cover-bid metrics examining relative distances, spread, clustering,
 * and historical positioning consistency for each bidder across comparable tenders.
 */
export function calculateCoverBidMetrics(
  targetTender: NormalizedTenderInput,
  comparableTenders: NormalizedTenderInput[],
  config: ScreenerConfig = defaultScreenerConfig
): CoverBidMetricsResult {
  const bids = targetTender.bids;
  const bidCount = bids.length;

  const winBid = bids.find((b) => b.isWinner) ?? (bids.length > 0 ? bids.reduce((min, b) => b.bidAmount < min.bidAmount ? b : min) : null);
  const winningBidAmount = winBid?.bidAmount ?? 0;
  const winningCompany = winBid?.companyName ?? targetTender.winner;

  if (bidCount < 2 || winningBidAmount <= 0) {
    return {
      tenderId: targetTender.id,
      bidCount,
      winningBidAmount,
      winningCompany,
      bidPositions: [],
      currentRelativeDistances: [],
      medianRelativeDistance: 0,
      meanRelativeDistance: 0,
      bidSpreadPct: 0,
      clusteringStdDev: 0,
      flaggedCompanies: [],
      historicalProximityScore: 0,
      tightClusteringScore: 0,
      consistentDeltaScore: 0,
      spreadAnomalyScore: 0,
    };
  }

  // Pre-calculate historical losing bid relative distances for each company across comparable tenders
  const historicalLosingDeltas = new Map<number, number[]>();

  comparableTenders.forEach((compTender) => {
    if (compTender.id === targetTender.id) return; // exclude current tender from historical baseline
    const compWinner = compTender.bids.find((b) => b.isWinner) ?? (compTender.bids.length > 0 ? compTender.bids.reduce((min, b) => b.bidAmount < min.bidAmount ? b : min) : null);
    if (!compWinner || compWinner.bidAmount <= 0) return;

    compTender.bids.forEach((b) => {
      if (b.companyId === compWinner.companyId) return; // only track losing bids
      const delta = relativeBidDistance(b.bidAmount, compWinner.bidAmount);
      if (delta >= 0 && Number.isFinite(delta)) {
        const existing = historicalLosingDeltas.get(b.companyId) ?? [];
        existing.push(delta);
        historicalLosingDeltas.set(b.companyId, existing);
      }
    });
  });

  const losingBids = bids.filter((b) => b.companyId !== winBid?.companyId);
  const currentRelativeDistances: number[] = [];
  const flaggedCompanies: string[] = [];
  let sumProximityMatches = 0;
  let sumConsistencyScores = 0;

  const bidPositions: BidPositionDetail[] = bids.map((bid) => {
    const isWinner = bid.companyId === winBid?.companyId;
    const relDistance = isWinner ? 0 : relativeBidDistance(bid.bidAmount, winningBidAmount);
    if (!isWinner) {
      currentRelativeDistances.push(relDistance);
    }

    const histDeltas = historicalLosingDeltas.get(bid.companyId) ?? [];
    const histObsCount = histDeltas.length;
    const histMedian = histObsCount > 0 ? round(median(histDeltas), 2) : null;
    const histStd = histObsCount >= 2 ? round(stdDev(histDeltas), 2) : null;

    let isRepeated = false;
    let proximityDelta: number | null = null;

    if (!isWinner && histMedian !== null && histObsCount >= config.sampleRequirements.minCoverBidHistoricalTenders) {
      proximityDelta = round(Math.abs(relDistance - histMedian), 2);
      // Repeated proximity if current delta is within tolerance (e.g. ±1.5%) of historical median
      if (proximityDelta <= config.coverBid.repeatedDeltaTolerancePct) {
        isRepeated = true;
        flaggedCompanies.push(bid.companyName);
        sumProximityMatches++;
        // Consistency score higher if historical variance is low
        const histVariancePenalty = histStd !== null ? Math.min(1.0, histStd / 4.0) : 0.5;
        sumConsistencyScores += Math.max(0.2, 1.0 - histVariancePenalty);
      }
    }

    return {
      companyId: bid.companyId,
      companyName: bid.companyName,
      bidAmount: bid.bidAmount,
      rank: bid.rank,
      isWinner,
      relativeDistancePct: relDistance,
      historicalComparableObservations: histObsCount,
      historicalMedianDistancePct: histMedian,
      historicalStdDevDistancePct: histStd,
      isRepeatedProximity: isRepeated,
      proximityDeltaPct: proximityDelta,
    };
  });

  const medianRelativeDistance = currentRelativeDistances.length > 0 ? round(median(currentRelativeDistances), 2) : 0;
  const meanRelativeDistance = currentRelativeDistances.length > 0 ? round(mean(currentRelativeDistances), 2) : 0;
  const minDistance = currentRelativeDistances.length > 0 ? Math.min(...currentRelativeDistances) : 0;
  const maxDistance = currentRelativeDistances.length > 0 ? Math.max(...currentRelativeDistances) : 0;
  const bidSpreadPct = round(maxDistance - minDistance, 2);
  const clusteringStdDev = currentRelativeDistances.length >= 2 ? round(stdDev(currentRelativeDistances), 2) : 0;

  // 1. Historical Proximity Score: fraction of losing bidders showing repeated historical delta
  const historicalProximityScore = losingBids.length > 0 ? Math.min(1.0, sumProximityMatches / losingBids.length) : 0;

  // 2. Consistent Delta Score: average consistency of repeated proximity bidders
  const consistentDeltaScore = sumProximityMatches > 0 ? Math.min(1.0, sumConsistencyScores / sumProximityMatches) : 0;

  // 3. Tight Clustering Score: losing bids clustered in a narrow band (e.g., standard deviation < 1.5%)
  let tightClusteringScore = 0;
  if (currentRelativeDistances.length >= 2) {
    if (clusteringStdDev < 0.8) tightClusteringScore = 1.0;
    else if (clusteringStdDev < 1.5) tightClusteringScore = 0.8;
    else if (clusteringStdDev < 2.5) tightClusteringScore = 0.5;
    else if (clusteringStdDev < 4.0) tightClusteringScore = 0.25;
  }

  // 4. Spread Anomaly: substantial margin gap between winner and losing cluster (e.g., min losing bid is > 5% above winner while losing bids are clustered within 2%)
  let spreadAnomalyScore = 0;
  if (minDistance >= 4.0 && bidSpreadPct <= 3.0 && currentRelativeDistances.length >= 2) {
    spreadAnomalyScore = 0.85;
  } else if (minDistance >= 3.0 && bidSpreadPct <= 4.0 && currentRelativeDistances.length >= 2) {
    spreadAnomalyScore = 0.6;
  } else if (currentRelativeDistances.length >= 2 && bidSpreadPct <= 2.0) {
    spreadAnomalyScore = 0.4;
  }

  return {
    tenderId: targetTender.id,
    bidCount,
    winningBidAmount,
    winningCompany,
    bidPositions,
    currentRelativeDistances,
    medianRelativeDistance,
    meanRelativeDistance,
    bidSpreadPct,
    clusteringStdDev,
    flaggedCompanies: [...new Set(flaggedCompanies)],
    historicalProximityScore: round(historicalProximityScore, 3),
    tightClusteringScore: round(tightClusteringScore, 3),
    consistentDeltaScore: round(consistentDeltaScore, 3),
    spreadAnomalyScore: round(spreadAnomalyScore, 3),
  };
}
