import { NormalizedTenderInput } from "../common/comparable";
import { mean, median, relativeBidDistance, round, stdDev } from "../common/statistics";

export interface CompanyPricePatternObservation {
  tenderId: number;
  tenderNumber: string;
  tenderDate: string;
  category: string;
  bidAmount: number;
  winningBid: number;
  relativeDistancePct: number;
  isWinner: boolean;
  isRepeatedPosition: boolean;
}

export interface CompanyPricePatternsResult {
  companyId: number;
  companyName: string;
  comparableBidsCount: number;
  winningBidsCount: number;
  losingBidsCount: number;
  averageRelativeDistance: number | null;
  medianRelativeDistance: number | null;
  stdDevRelativeDistance: number | null;
  repeatedPositioningCount: number;
  bidPositionHistory: Array<{
    label: string;
    value: number;
    bidAmount: number;
    winningBid: number;
    isWinner: boolean;
  }>;
  positioningDistribution: Array<{
    label: string;
    value: number;
  }>;
  observations: CompanyPricePatternObservation[];
}

export function calculateCompanyPricePatterns(
  companyId: number,
  companyName: string,
  allTenders: NormalizedTenderInput[]
): CompanyPricePatternsResult {
  const participatedTenders = allTenders.filter((t) =>
    t.bids.some((b) => b.companyId === companyId)
  );

  const observations: CompanyPricePatternObservation[] = [];
  const losingDeltas: number[] = [];
  let winningCount = 0;

  // Chronologically sort participated tenders
  const sortedTenders = [...participatedTenders].sort((a, b) =>
    a.tenderDate.localeCompare(b.tenderDate)
  );

  sortedTenders.forEach((tender) => {
    const winBid =
      tender.bids.find((b) => b.isWinner) ??
      (tender.bids.length > 0 ? tender.bids.reduce((min, b) => (b.bidAmount < min.bidAmount ? b : min)) : null);
    const myBid = tender.bids.find((b) => b.companyId === companyId);

    if (winBid && myBid && winBid.bidAmount > 0 && myBid.bidAmount > 0) {
      const isWinner = myBid.companyId === winBid.companyId;
      if (isWinner) {
        winningCount++;
        observations.push({
          tenderId: tender.id,
          tenderNumber: tender.tenderNumber,
          tenderDate: tender.tenderDate,
          category: tender.category,
          bidAmount: myBid.bidAmount,
          winningBid: winBid.bidAmount,
          relativeDistancePct: 0,
          isWinner: true,
          isRepeatedPosition: false,
        });
      } else {
        const delta = relativeBidDistance(myBid.bidAmount, winBid.bidAmount);
        losingDeltas.push(delta);
        observations.push({
          tenderId: tender.id,
          tenderNumber: tender.tenderNumber,
          tenderDate: tender.tenderDate,
          category: tender.category,
          bidAmount: myBid.bidAmount,
          winningBid: winBid.bidAmount,
          relativeDistancePct: delta,
          isWinner: false,
          isRepeatedPosition: false, // will update after median calculated
        });
      }
    }
  });

  const losingBidsCount = losingDeltas.length;
  const averageRelativeDistance = losingBidsCount > 0 ? round(mean(losingDeltas), 2) : null;
  const medianRelativeDistance = losingBidsCount > 0 ? round(median(losingDeltas), 2) : null;
  const stdDevRelativeDistance = losingBidsCount >= 2 ? round(stdDev(losingDeltas, true), 2) : null;

  let repeatedPositioningCount = 0;
  if (medianRelativeDistance !== null) {
    observations.forEach((obs) => {
      if (!obs.isWinner && Math.abs(obs.relativeDistancePct - medianRelativeDistance) <= 1.2) {
        obs.isRepeatedPosition = true;
        repeatedPositioningCount++;
      }
    });
  }

  // Distribution bins
  const distributionBins = {
    "0-2% (Very Tight)": 0,
    "2-5% (Tight)": 0,
    "5-10% (Moderate)": 0,
    ">10% (Wide)": 0,
  };

  losingDeltas.forEach((d) => {
    if (d <= 2.0) distributionBins["0-2% (Very Tight)"]++;
    else if (d <= 5.0) distributionBins["2-5% (Tight)"]++;
    else if (d <= 10.0) distributionBins["5-10% (Moderate)"]++;
    else distributionBins[">10% (Wide)"]++;
  });

  const positioningDistribution = Object.entries(distributionBins).map(([label, value]) => ({
    label,
    value,
  }));

  const bidPositionHistory = observations.slice(-12).map((obs) => ({
    label: obs.tenderNumber.replace("BS-2025-", "T-"),
    value: obs.relativeDistancePct,
    bidAmount: obs.bidAmount,
    winningBid: obs.winningBid,
    isWinner: obs.isWinner,
  }));

  return {
    companyId,
    companyName,
    comparableBidsCount: observations.length,
    winningBidsCount: winningCount,
    losingBidsCount,
    averageRelativeDistance,
    medianRelativeDistance,
    stdDevRelativeDistance,
    repeatedPositioningCount,
    bidPositionHistory,
    positioningDistribution,
    observations,
  };
}
