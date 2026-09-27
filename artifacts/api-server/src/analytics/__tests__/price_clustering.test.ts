import test, { describe } from "node:test";
import assert from "node:assert/strict";
import {
  bidSpread,
  coefficientOfVariation,
  interBidDistances,
  mean,
  median,
  percentileRank,
  relativeBidDistance,
  stdDev,
} from "../common/statistics";
import {
  calculatePriceClusteringMetrics,
} from "../screens/price_clustering/metrics";
import { detectPriceClustering } from "../screens/price_clustering/detector";
import { generatePriceClusteringEvidence } from "../screens/price_clustering/evidence";
import { calculateCompanyPricePatterns } from "../history/company_price_patterns";
import { ComparisonScope } from "../common/types";
import { NormalizedTenderInput } from "../common/comparable";
import { defaultScreenerConfig } from "../scoring/config";

const mockScope: ComparisonScope = {
  category: "Electrical Equipment",
  organization: "Department X",
  department: "Procurement Cell",
  geography: "Tamil Nadu (Chennai)",
  valueRange: "₹40 L – ₹60 L",
  startDate: "2025-01-01",
  endDate: "2025-12-31",
  comparableTenderCount: 10,
};

function makeMockTender(
  id: number,
  bidAmounts: number[],
  category = "Electrical Equipment",
  org = "Department X"
): NormalizedTenderInput {
  const minAmt = Math.min(...bidAmounts);
  return {
    id,
    tenderNumber: `TN-${String(1000 + id)}`,
    title: `${category} tender ${id}`,
    organization: org,
    department: "Procurement Cell",
    category,
    location: "Chennai",
    state: "Tamil Nadu",
    tenderDate: `2025-${String(Math.min(12, id)).padStart(2, "0")}-15`,
    closingDate: `2025-${String(Math.min(12, id)).padStart(2, "0")}-28`,
    estimatedValue: 1000000,
    contractValue: minAmt,
    winner: `Company 1`,
    bids: bidAmounts.map((amt, idx) => ({
      companyId: idx + 1,
      companyName: `Company ${idx + 1}`,
      bidAmount: amt,
      rank: idx + 1,
      isWinner: amt === minAmt,
      differenceFromWinner: amt - minAmt,
    })),
  };
}

describe("Price Clustering Screening Engine (Phase 4)", () => {
  test("Test 1: Calculates tender-level bid statistics accurately", () => {
    const bids = [100, 101, 102, 103];
    const m = mean(bids);
    const med = median(bids);
    const sd = stdDev(bids, true);
    const cv = coefficientOfVariation(bids, true);
    const spread = bidSpread(bids);

    assert.equal(m, 101.5);
    assert.equal(med, 101.5);
    assert.equal(spread.absolute, 3);
    assert.equal(spread.normalizedPct, 3); // (3 / 100) * 100
    assert.ok(sd > 1.29 && sd < 1.30); // sqrt(5/3) ≈ 1.29099
    assert.ok(cv > 0.012 && cv < 0.013); // 1.291 / 101.5 ≈ 0.0127
  });

  test("Test 2: Relative bid distance from winning bid", () => {
    const winnerBid = 1000000;
    const losingBid = 1080000;
    const delta = relativeBidDistance(losingBid, winnerBid);

    assert.equal(delta, 8.0); // Exactly +8.0%
  });

  test("Test 3: Tight price clustering produces lower dispersion and elevated indicator than wide dispersion", () => {
    // Current tight tender: ₹10,00,000, ₹10,05,000, ₹10,08,000, ₹10,10,000 (Spread 1.0%, CV ~ 0.0042)
    const tightTender = makeMockTender(1, [1000000, 1005000, 1008000, 1010000]);

    // Historical comparable population with typical spread (3% - 6% spread, CV ~ 0.015 - 0.025)
    const comparablePopulation = [
      tightTender,
      makeMockTender(2, [1000000, 1025000, 1040000, 1055000]),
      makeMockTender(3, [1000000, 1030000, 1050000, 1070000]),
      makeMockTender(4, [1000000, 1020000, 1045000, 1060000]),
      makeMockTender(5, [1000000, 1035000, 1055000, 1075000]),
      makeMockTender(6, [1000000, 1022000, 1048000, 1068000]),
    ];

    const tightResult = detectPriceClustering(tightTender, comparablePopulation, mockScope);

    assert.ok(tightResult.indicator.score !== null);
    assert.ok(tightResult.metrics.coefficientOfVariation < 0.006);
    assert.ok(tightResult.metrics.normalizedSpreadPct <= 1.0);
    assert.ok(tightResult.metrics.cvPercentile !== null && tightResult.metrics.cvPercentile <= 20);
    assert.ok(tightResult.indicator.score >= 60, `Expected score >= 60, got ${tightResult.indicator.score}`);
    assert.ok(
      tightResult.indicator.status === "ELEVATED INDICATOR" || tightResult.indicator.status === "HIGH INDICATOR"
    );

    // Compare with wide dispersion tender: ₹10,00,000, ₹11,00,000, ₹12,50,000, ₹14,00,000
    const wideTender = makeMockTender(1, [1000000, 1100000, 1250000, 1400000]);
    const wideResult = detectPriceClustering(wideTender, comparablePopulation, mockScope);

    assert.ok(wideResult.indicator.score !== null);
    assert.ok(wideResult.metrics.coefficientOfVariation > tightResult.metrics.coefficientOfVariation * 10);
    assert.ok(wideResult.indicator.score < tightResult.indicator.score);
    assert.equal(wideResult.indicator.status, "LOW INDICATOR");
  });

  test("Test 4: Safely handles insufficient bids requirement (< 3 bids)", () => {
    // Only 2 bids submitted
    const twoBidTender = makeMockTender(1, [1000000, 1005000]);
    const comparablePopulation = [
      twoBidTender,
      makeMockTender(2, [1000000, 1020000, 1040000]),
      makeMockTender(3, [1000000, 1030000, 1050000]),
      makeMockTender(4, [1000000, 1025000, 1045000]),
      makeMockTender(5, [1000000, 1035000, 1055000]),
    ];

    const result = detectPriceClustering(twoBidTender, comparablePopulation, mockScope);

    assert.equal(result.indicator.status, "INSUFFICIENT_DATA");
    assert.equal(result.indicator.score, null);
    assert.ok(result.metrics.isInsufficientBids);
    assert.ok(result.indicator.summary.includes("2 bid(s)"));
    assert.ok(result.indicator.summary.includes("At least 3 bids are required"));
  });

  test("Test 5: Safely handles insufficient comparable tenders requirement (< 5 comparable tenders)", () => {
    const targetTender = makeMockTender(1, [1000000, 1005000, 1010000]);
    // Only 2 comparable tenders in total
    const smallComparablePopulation = [
      targetTender,
      makeMockTender(2, [1000000, 1020000, 1040000]),
    ];

    const result = detectPriceClustering(targetTender, smallComparablePopulation, mockScope);

    assert.equal(result.indicator.status, "INSUFFICIENT_DATA");
    assert.equal(result.indicator.score, null);
    assert.ok(result.metrics.isInsufficientComparable);
    assert.ok(result.indicator.summary.includes("comparable tender(s) found"));
  });

  test("Test 6: Historical percentile rank calculation", () => {
    const distribution = [0.010, 0.015, 0.020, 0.025, 0.030, 0.035, 0.040, 0.045, 0.050, 0.060];
    
    // Value smaller than all elements
    const pLow = percentileRank(0.005, distribution);
    assert.equal(pLow, 0.0);

    // Value in middle
    const pMid = percentileRank(0.025, distribution);
    // 3 items strictly less (0.010, 0.015, 0.020), 1 equal (0.025) -> (3 + 0.5)/10 = 35%
    assert.equal(pMid, 35.0);

    // Value higher than all
    const pHigh = percentileRank(0.080, distribution);
    assert.equal(pHigh, 100.0);
  });

  test("Test 7: Generates traceable evidence records with exact metrics", () => {
    const targetTender = makeMockTender(1, [1000000, 1006000, 1008000, 1012000]);
    const comparablePopulation = [
      targetTender,
      makeMockTender(2, [1000000, 1025000, 1040000, 1060000]),
      makeMockTender(3, [1000000, 1030000, 1050000, 1070000]),
      makeMockTender(4, [1000000, 1020000, 1045000, 1065000]),
      makeMockTender(5, [1000000, 1035000, 1055000, 1075000]),
      makeMockTender(6, [1000000, 1022000, 1048000, 1068000]),
    ];

    const result = detectPriceClustering(targetTender, comparablePopulation, mockScope);

    assert.ok(result.evidence.length >= 2);
    const cvEvidence = result.evidence.find((e) => e.metric === "Coefficient of Variation (CV)");
    assert.ok(cvEvidence, "Must include CV evidence record");
    assert.equal(cvEvidence.indicatorType, "PRICE_CLUSTERING");
    assert.ok(cvEvidence.observedValue?.includes("percentile"));
    assert.ok(cvEvidence.expectedValue?.includes("comparable median"));

    const spreadEvidence = result.evidence.find((e) => e.metric === "Normalized Bid Spread");
    assert.ok(spreadEvidence, "Must include spread evidence record");
    assert.equal(spreadEvidence.indicatorType, "PRICE_CLUSTERING");
    assert.ok(spreadEvidence.observedValue?.includes("1.2%"));
  });

  test("Test 8: Company historical price positioning patterns", () => {
    const allTenders = [
      makeMockTender(1, [1000000, 1080000, 1150000]),
      makeMockTender(2, [1200000, 1296000, 1400000]), // Company 2 is at +8.0%
      makeMockTender(3, [900000, 972000, 1050000]),    // Company 2 is at +8.0%
      makeMockTender(4, [1500000, 1620000, 1800000]),  // Company 2 is at +8.0%
    ];

    const patterns = calculateCompanyPricePatterns(2, "Company 2", allTenders);

    assert.equal(patterns.companyId, 2);
    assert.equal(patterns.comparableBidsCount, 4);
    assert.equal(patterns.medianRelativeDistance, 8.0);
    assert.equal(patterns.averageRelativeDistance, 8.0);
    assert.equal(patterns.stdDevRelativeDistance, 0.0);
    assert.equal(patterns.repeatedPositioningCount, 4);
    assert.ok(patterns.positioningDistribution.length > 0);
  });
});
