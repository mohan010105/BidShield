import test, { describe } from "node:test";
import assert from "node:assert/strict";
import {
  extractCompanyLosingObservations,
  calculateCompanyNeatLossMetrics,
} from "../screens/neat_loss/metrics";
import { detectCompanyNeatLoss, detectTenderNeatLoss } from "../screens/neat_loss/detector";
import { generateNeatLossEvidence } from "../screens/neat_loss/evidence";
import { NormalizedTenderInput } from "../common/comparable";
import { ComparisonScope } from "../common/types";

const mockScope: ComparisonScope = {
  category: "Road Construction",
  organization: "State Highway Authority",
  department: "Infrastructure",
  geography: "Karnataka",
  valueRange: "₹10.0 L – ₹25.0 L",
  startDate: "2025-01-01",
  endDate: "2025-06-01",
  comparableTenderCount: 6,
};

function createTender(
  id: number,
  title: string,
  bids: Array<{ companyId: number; companyName: string; bidAmount: number; isWinner: boolean; rank?: number }>
): NormalizedTenderInput {
  const winBid = bids.find((b) => b.isWinner);
  const winAmount = winBid ? winBid.bidAmount : 0;
  return {
    id,
    tenderNumber: `TDR-2025-${String(id).padStart(3, "0")}`,
    title,
    organization: "State Highway Authority",
    department: "Infrastructure",
    category: "Road Construction",
    location: "Bengaluru",
    state: "Karnataka",
    tenderDate: `2025-0${Math.min(id, 9)}-10`,
    closingDate: `2025-0${Math.min(id, 9)}-20`,
    estimatedValue: winAmount,
    contractValue: winAmount,
    winner: winBid ? winBid.companyName : "None",
    bids: bids.map((b, idx) => ({
      companyId: b.companyId,
      companyName: b.companyName,
      bidAmount: b.bidAmount,
      rank: b.rank ?? (b.isWinner ? 1 : idx + 2),
      isWinner: b.isWinner,
      differenceFromWinner:
        winAmount > 0 && !b.isWinner
          ? Math.round(((b.bidAmount - winAmount) / winAmount) * 1000) / 10
          : 0,
    })),
  };
}

describe("Too-Neat Losing Bid Analysis Engine (Phase 6)", () => {
  // Test 1: Relative gap calculation
  test("Test 1: calculates exact winning-bid gap and relative percentage gap", () => {
    const tenders: NormalizedTenderInput[] = [
      createTender(1, "Tender 1", [
        { companyId: 10, companyName: "Winner Co", bidAmount: 100000, isWinner: true, rank: 1 },
        { companyId: 20, companyName: "ABC Corp", bidAmount: 100500, isWinner: false, rank: 2 },
      ]),
    ];

    const { losingObservations } = extractCompanyLosingObservations(20, tenders);
    assert.equal(losingObservations.length, 1);
    assert.equal(losingObservations[0].winningBidAmount, 100000);
    assert.equal(losingObservations[0].bidAmount, 100500);
    assert.equal(losingObservations[0].gapAmount, 500);
    assert.equal(losingObservations[0].relativeGapPct, 0.5); // (500 / 100000) * 100 = 0.5%
    assert.equal(losingObservations[0].bidRank, 2);
  });

  // Test 2: Loss rate and win rate calculation
  test("Test 2: calculates correct win rate and loss rate across participations", () => {
    const tenders: NormalizedTenderInput[] = [
      // 1 win
      createTender(1, "Tender 1", [
        { companyId: 20, companyName: "ABC Corp", bidAmount: 100000, isWinner: true, rank: 1 },
        { companyId: 30, companyName: "Other Co", bidAmount: 105000, isWinner: false, rank: 2 },
      ]),
      // 5 losses
      createTender(2, "Tender 2", [
        { companyId: 10, companyName: "Winner Co", bidAmount: 100000, isWinner: true, rank: 1 },
        { companyId: 20, companyName: "ABC Corp", bidAmount: 100500, isWinner: false, rank: 2 },
      ]),
      createTender(3, "Tender 3", [
        { companyId: 10, companyName: "Winner Co", bidAmount: 120000, isWinner: true, rank: 1 },
        { companyId: 20, companyName: "ABC Corp", bidAmount: 120600, isWinner: false, rank: 2 },
      ]),
      createTender(4, "Tender 4", [
        { companyId: 10, companyName: "Winner Co", bidAmount: 90000, isWinner: true, rank: 1 },
        { companyId: 20, companyName: "ABC Corp", bidAmount: 90450, isWinner: false, rank: 2 },
      ]),
      createTender(5, "Tender 5", [
        { companyId: 10, companyName: "Winner Co", bidAmount: 150000, isWinner: true, rank: 1 },
        { companyId: 20, companyName: "ABC Corp", bidAmount: 150750, isWinner: false, rank: 2 },
      ]),
      createTender(6, "Tender 6", [
        { companyId: 10, companyName: "Winner Co", bidAmount: 200000, isWinner: true, rank: 1 },
        { companyId: 20, companyName: "ABC Corp", bidAmount: 201000, isWinner: false, rank: 2 },
      ]),
    ];

    const metrics = calculateCompanyNeatLossMetrics(
      20,
      "ABC Corp",
      "CANON_ABC",
      tenders,
      undefined,
      "State Highway Authority / Road Construction"
    );
    assert.equal(metrics.participationCount, 6);
    assert.equal(metrics.winCount, 1);
    assert.equal(metrics.lossCount, 5);
    assert.equal(metrics.winRate, 0.1667); // 1/6 = 0.1667
    assert.equal(metrics.lossRate, 0.8333); // 5/6 = 0.8333
  });

  // Test 3: Bid rank statistics (mean, median, stddev, min, max, mode)
  test("Test 3: accurately computes rank statistics", () => {
    const tenders: NormalizedTenderInput[] = [
      createTender(1, "T1", [
        { companyId: 1, companyName: "W", bidAmount: 1000, isWinner: true, rank: 1 },
        { companyId: 20, companyName: "ABC Corp", bidAmount: 1050, isWinner: false, rank: 2 },
      ]),
      createTender(2, "T2", [
        { companyId: 1, companyName: "W", bidAmount: 1000, isWinner: true, rank: 1 },
        { companyId: 20, companyName: "ABC Corp", bidAmount: 1050, isWinner: false, rank: 2 },
      ]),
      createTender(3, "T3", [
        { companyId: 1, companyName: "W", bidAmount: 1000, isWinner: true, rank: 1 },
        { companyId: 20, companyName: "ABC Corp", bidAmount: 1050, isWinner: false, rank: 2 },
      ]),
      createTender(4, "T4", [
        { companyId: 1, companyName: "W", bidAmount: 1000, isWinner: true, rank: 1 },
        { companyId: 20, companyName: "ABC Corp", bidAmount: 1050, isWinner: false, rank: 2 },
      ]),
      createTender(5, "T5", [
        { companyId: 1, companyName: "W", bidAmount: 1000, isWinner: true, rank: 1 },
        { companyId: 20, companyName: "ABC Corp", bidAmount: 1050, isWinner: false, rank: 3 },
      ]),
    ];

    const metrics = calculateCompanyNeatLossMetrics(20, "ABC Corp", "CANON_ABC", tenders);
    assert.equal(metrics.minBidRank, 2);
    assert.equal(metrics.maxBidRank, 3);
    assert.equal(metrics.medianBidRank, 2);
    assert.equal(metrics.meanBidRank, 2.2); // (2+2+2+2+3)/5 = 2.2
    assert.equal(metrics.mostFrequentRank, 2); // Mode is rank 2 (4 of 5)
    assert.equal(metrics.mostFrequentRankCount, 4);
    assert.ok(metrics.rankStdDev !== null && metrics.rankStdDev < 1.0);
  });

  // Test 4 & 5: Relative-gap standard deviation and Coefficient of Variation (CV)
  test("Test 4 & 5: accurately calculates stdDev and CV for deterministic test fixture", () => {
    // Deterministic test fixture from prompt:
    // T1: Winner = 100000, ABC = 100500 -> 0.5%
    // T2: Winner = 120000, ABC = 120600 -> 0.5%
    // T3: Winner = 90000,  ABC = 90450  -> 0.5%
    // T4: Winner = 150000, ABC = 150750 -> 0.5%
    // T5: Winner = 200000, ABC = 201000 -> 0.5%
    const tenders: NormalizedTenderInput[] = [
      createTender(1, "T1", [
        { companyId: 1, companyName: "W", bidAmount: 100000, isWinner: true, rank: 1 },
        { companyId: 20, companyName: "ABC Corp", bidAmount: 100500, isWinner: false, rank: 2 },
      ]),
      createTender(2, "T2", [
        { companyId: 1, companyName: "W", bidAmount: 120000, isWinner: true, rank: 1 },
        { companyId: 20, companyName: "ABC Corp", bidAmount: 120600, isWinner: false, rank: 2 },
      ]),
      createTender(3, "T3", [
        { companyId: 1, companyName: "W", bidAmount: 90000, isWinner: true, rank: 1 },
        { companyId: 20, companyName: "ABC Corp", bidAmount: 90450, isWinner: false, rank: 2 },
      ]),
      createTender(4, "T4", [
        { companyId: 1, companyName: "W", bidAmount: 150000, isWinner: true, rank: 1 },
        { companyId: 20, companyName: "ABC Corp", bidAmount: 150750, isWinner: false, rank: 2 },
      ]),
      createTender(5, "T5", [
        { companyId: 1, companyName: "W", bidAmount: 200000, isWinner: true, rank: 1 },
        { companyId: 20, companyName: "ABC Corp", bidAmount: 201000, isWinner: false, rank: 2 },
      ]),
    ];

    const metrics = calculateCompanyNeatLossMetrics(20, "ABC Corp", "CANON_ABC", tenders);
    assert.equal(metrics.sampleSize, 5);
    assert.equal(metrics.meanRelativeGapPct, 0.5);
    assert.equal(metrics.medianRelativeGapPct, 0.5);
    assert.equal(metrics.relativeGapStdDev, 0); // All exactly 0.50%
    assert.equal(metrics.relativeGapCv, 0);
    assert.equal(metrics.minRelativeGapPct, 0.5);
    assert.equal(metrics.maxRelativeGapPct, 0.5);
  });

  // Test 6: Minimum sample-size handling (< 5 observations produces INSUFFICIENT_DATA)
  test("Test 6: safely sets status to INSUFFICIENT_DATA when sample size < 5", () => {
    const tenders: NormalizedTenderInput[] = [
      createTender(1, "T1", [
        { companyId: 1, companyName: "W", bidAmount: 100000, isWinner: true, rank: 1 },
        { companyId: 20, companyName: "ABC Corp", bidAmount: 100500, isWinner: false, rank: 2 },
      ]),
      createTender(2, "T2", [
        { companyId: 1, companyName: "W", bidAmount: 120000, isWinner: true, rank: 1 },
        { companyId: 20, companyName: "ABC Corp", bidAmount: 120600, isWinner: false, rank: 2 },
      ]),
      createTender(3, "T3", [
        { companyId: 1, companyName: "W", bidAmount: 90000, isWinner: true, rank: 1 },
        { companyId: 20, companyName: "ABC Corp", bidAmount: 90450, isWinner: false, rank: 2 },
      ]),
    ];

    const metrics = calculateCompanyNeatLossMetrics(20, "ABC Corp", "CANON_ABC", tenders);
    assert.equal(metrics.sampleSize, 3);
    assert.equal(metrics.status, "INSUFFICIENT_DATA");
    assert.equal(metrics.score, null);
    assert.ok(metrics.insufficientReason?.includes("3 / 5") || metrics.insufficientReason?.includes("3 observed"));
  });

  // Test 7: Zero or negative winning bid handling
  test("Test 7: gracefully ignores tenders with zero or negative winning bids", () => {
    const tenders: NormalizedTenderInput[] = [
      createTender(1, "T1", [
        { companyId: 1, companyName: "W", bidAmount: 0, isWinner: true, rank: 1 },
        { companyId: 20, companyName: "ABC Corp", bidAmount: 100500, isWinner: false, rank: 2 },
      ]),
      createTender(2, "T2", [
        { companyId: 1, companyName: "W", bidAmount: -500, isWinner: true, rank: 1 },
        { companyId: 20, companyName: "ABC Corp", bidAmount: 100500, isWinner: false, rank: 2 },
      ]),
    ];

    const { losingObservations } = extractCompanyLosingObservations(20, tenders);
    assert.equal(losingObservations.length, 0); // Both invalid winning bids ignored
  });

  // Test 8: Missing or non-positive losing bid amount handling
  test("Test 8: gracefully ignores bids with null, zero, or negative bid amounts", () => {
    const tenders: NormalizedTenderInput[] = [
      createTender(1, "T1", [
        { companyId: 1, companyName: "W", bidAmount: 100000, isWinner: true, rank: 1 },
        { companyId: 20, companyName: "ABC Corp", bidAmount: 0, isWinner: false, rank: 2 },
      ]),
      createTender(2, "T2", [
        { companyId: 1, companyName: "W", bidAmount: 100000, isWinner: true, rank: 1 },
        { companyId: 20, companyName: "ABC Corp", bidAmount: -100, isWinner: false, rank: 2 },
      ]),
    ];

    const { losingObservations } = extractCompanyLosingObservations(20, tenders);
    assert.equal(losingObservations.length, 0);
  });

  // Test 9: Missing winner handling
  test("Test 9: ignores tender when no winning bid exists", () => {
    const tenders: NormalizedTenderInput[] = [
      createTender(1, "T1", [
        { companyId: 20, companyName: "ABC Corp", bidAmount: 100500, isWinner: false, rank: 2 },
        { companyId: 30, companyName: "XYZ Corp", bidAmount: 102000, isWinner: false, rank: 3 },
      ]),
    ];

    const { losingObservations } = extractCompanyLosingObservations(20, tenders);
    assert.equal(losingObservations.length, 0);
  });

  // Test 10: Duplicate bid handling (takes lowest valid bid or single entry)
  test("Test 10: handles duplicate bids without double-counting", () => {
    const tenders: NormalizedTenderInput[] = [
      createTender(1, "T1", [
        { companyId: 1, companyName: "W", bidAmount: 100000, isWinner: true, rank: 1 },
        { companyId: 20, companyName: "ABC Corp", bidAmount: 100500, isWinner: false, rank: 2 },
        { companyId: 20, companyName: "ABC Corp", bidAmount: 100700, isWinner: false, rank: 3 },
      ]),
    ];

    const { losingObservations } = extractCompanyLosingObservations(20, tenders);
    assert.equal(losingObservations.length, 1);
    assert.equal(losingObservations[0].bidAmount, 100500);
  });

  // Test 11 & 12: Multiple companies and comparison groups
  test("Test 11 & 12: analyzes multiple companies independently with comparison groups", () => {
    const tenders: NormalizedTenderInput[] = [
      createTender(1, "T1", [
        { companyId: 1, companyName: "Winner Co", bidAmount: 100000, isWinner: true, rank: 1 },
        { companyId: 20, companyName: "Company A", bidAmount: 100500, isWinner: false, rank: 2 },
        { companyId: 30, companyName: "Company B", bidAmount: 110000, isWinner: false, rank: 3 },
      ]),
      createTender(2, "T2", [
        { companyId: 1, companyName: "Winner Co", bidAmount: 120000, isWinner: true, rank: 1 },
        { companyId: 20, companyName: "Company A", bidAmount: 120600, isWinner: false, rank: 2 },
        { companyId: 30, companyName: "Company B", bidAmount: 135000, isWinner: false, rank: 3 },
      ]),
      createTender(3, "T3", [
        { companyId: 1, companyName: "Winner Co", bidAmount: 90000, isWinner: true, rank: 1 },
        { companyId: 20, companyName: "Company A", bidAmount: 90450, isWinner: false, rank: 2 },
        { companyId: 30, companyName: "Company B", bidAmount: 102000, isWinner: false, rank: 3 },
      ]),
      createTender(4, "T4", [
        { companyId: 1, companyName: "Winner Co", bidAmount: 150000, isWinner: true, rank: 1 },
        { companyId: 20, companyName: "Company A", bidAmount: 150750, isWinner: false, rank: 2 },
        { companyId: 30, companyName: "Company B", bidAmount: 170000, isWinner: false, rank: 3 },
      ]),
      createTender(5, "T5", [
        { companyId: 1, companyName: "Winner Co", bidAmount: 200000, isWinner: true, rank: 1 },
        { companyId: 20, companyName: "Company A", bidAmount: 201000, isWinner: false, rank: 2 },
        { companyId: 30, companyName: "Company B", bidAmount: 228000, isWinner: false, rank: 3 },
      ]),
    ];

    const metricsA = calculateCompanyNeatLossMetrics(
      20,
      "Company A",
      "CANON_A",
      tenders,
      undefined,
      "State Highway / Road Construction"
    );
    const metricsB = calculateCompanyNeatLossMetrics(
      30,
      "Company B",
      "CANON_B",
      tenders,
      undefined,
      "State Highway / Road Construction"
    );

    assert.equal(metricsA.comparisonGroup, "State Highway / Road Construction");
    assert.equal(metricsB.comparisonGroup, "State Highway / Road Construction");

    // Company A has extremely tight 0.5% relative gap -> zero CV
    assert.equal(metricsA.meanRelativeGapPct, 0.5);
    assert.equal(metricsA.relativeGapCv, 0);

    // Company B has ~10-14% relative gap -> wider gap
    assert.ok(metricsB.meanRelativeGapPct !== null && metricsB.meanRelativeGapPct > 10);
  });

  // Test 13: Deterministic score calculation and interpretation ranges
  test("Test 13: calculates deterministic neat_loss_score in 0-100 range", () => {
    // 6 tenders with repetitive rank 2, 0.4% margin, 100% loss rate
    const tenders: NormalizedTenderInput[] = [
      createTender(1, "T1", [
        { companyId: 1, companyName: "W", bidAmount: 1000000, isWinner: true, rank: 1 },
        { companyId: 20, companyName: "ABC", bidAmount: 1004000, isWinner: false, rank: 2 }, // 0.40%
      ]),
      createTender(2, "T2", [
        { companyId: 1, companyName: "W", bidAmount: 1200000, isWinner: true, rank: 1 },
        { companyId: 20, companyName: "ABC", bidAmount: 1205000, isWinner: false, rank: 2 }, // 0.42%
      ]),
      createTender(3, "T3", [
        { companyId: 1, companyName: "W", bidAmount: 950000, isWinner: true, rank: 1 },
        { companyId: 20, companyName: "ABC", bidAmount: 954000, isWinner: false, rank: 2 }, // 0.42%
      ]),
      createTender(4, "T4", [
        { companyId: 1, companyName: "W", bidAmount: 1100000, isWinner: true, rank: 1 },
        { companyId: 20, companyName: "ABC", bidAmount: 1104500, isWinner: false, rank: 2 }, // 0.41%
      ]),
      createTender(5, "T5", [
        { companyId: 1, companyName: "W", bidAmount: 1300000, isWinner: true, rank: 1 },
        { companyId: 20, companyName: "ABC", bidAmount: 1305200, isWinner: false, rank: 2 }, // 0.40%
      ]),
      createTender(6, "T6", [
        { companyId: 1, companyName: "W", bidAmount: 1050000, isWinner: true, rank: 1 },
        { companyId: 20, companyName: "ABC", bidAmount: 1054300, isWinner: false, rank: 2 }, // 0.41%
      ]),
    ];

    const metrics = calculateCompanyNeatLossMetrics(20, "ABC", "CANON_ABC", tenders);
    assert.ok(metrics.status === "ELEVATED INDICATOR" || metrics.status === "HIGH INDICATOR");
    assert.ok(metrics.score !== null);
    assert.ok(metrics.score >= 70, `Expected elevated score >= 70, got ${metrics.score}`);
    assert.equal(metrics.methodologyVersion, "neat_losing_bid_v1.0");
  });

  // Test 14: Traceable NEAT_LOSS evidence generation
  test("Test 14: generates traceable NEAT_LOSS evidence with factual, non-accusatory language", () => {
    const tenders: NormalizedTenderInput[] = [
      createTender(1, "T1", [
        { companyId: 1, companyName: "W", bidAmount: 1000000, isWinner: true, rank: 1 },
        { companyId: 20, companyName: "ABC Corp", bidAmount: 1004000, isWinner: false, rank: 2 },
      ]),
      createTender(2, "T2", [
        { companyId: 1, companyName: "W", bidAmount: 1200000, isWinner: true, rank: 1 },
        { companyId: 20, companyName: "ABC Corp", bidAmount: 1205000, isWinner: false, rank: 2 },
      ]),
      createTender(3, "T3", [
        { companyId: 1, companyName: "W", bidAmount: 950000, isWinner: true, rank: 1 },
        { companyId: 20, companyName: "ABC Corp", bidAmount: 954000, isWinner: false, rank: 2 },
      ]),
      createTender(4, "T4", [
        { companyId: 1, companyName: "W", bidAmount: 1100000, isWinner: true, rank: 1 },
        { companyId: 20, companyName: "ABC Corp", bidAmount: 1104500, isWinner: false, rank: 2 },
      ]),
      createTender(5, "T5", [
        { companyId: 1, companyName: "W", bidAmount: 1300000, isWinner: true, rank: 1 },
        { companyId: 20, companyName: "ABC Corp", bidAmount: 1305200, isWinner: false, rank: 2 },
      ]),
    ];

    const metrics = calculateCompanyNeatLossMetrics(20, "ABC Corp", "CANON_ABC", tenders);
    const evidence = generateNeatLossEvidence(metrics, tenders[0].id);

    assert.ok(evidence.length >= 1);
    const primary = evidence[0];
    assert.equal(primary.indicatorType, "NEAT_LOSS");
    assert.equal(primary.companyId, 20);
    assert.equal(primary.methodologyVersion, "neat_losing_bid_v1.0");
    // Ensure factual phrasing, no forbidden words
    const desc = primary.description.toLowerCase();
    assert.ok(!desc.includes("fraud confirmed"), "Should not contain 'fraud confirmed'");
    assert.ok(!desc.includes("cartel confirmed"), "Should not contain 'cartel confirmed'");
    assert.ok(!desc.includes("collusion proven"), "Should not contain 'collusion proven'");
    assert.ok(!desc.includes("guilty"), "Should not contain 'guilty'");
    assert.ok(desc.includes("participated in 5") || desc.includes("5 comparable"));
  });

  // Test 15: Tender contributor analysis
  test("Test 15: detectTenderNeatLoss returns contributor metrics for bidders in target tender", () => {
    const targetTender = createTender(5, "Target Package", [
      { companyId: 1, companyName: "Winner Co", bidAmount: 1000000, isWinner: true, rank: 1 },
      { companyId: 20, companyName: "RunnerUp Co", bidAmount: 1004500, isWinner: false, rank: 2 },
    ]);

    const historical: NormalizedTenderInput[] = [
      createTender(1, "Hist 1", [
        { companyId: 1, companyName: "Winner Co", bidAmount: 1000000, isWinner: true, rank: 1 },
        { companyId: 20, companyName: "RunnerUp Co", bidAmount: 1004000, isWinner: false, rank: 2 },
      ]),
      createTender(2, "Hist 2", [
        { companyId: 1, companyName: "Winner Co", bidAmount: 1200000, isWinner: true, rank: 1 },
        { companyId: 20, companyName: "RunnerUp Co", bidAmount: 1205000, isWinner: false, rank: 2 },
      ]),
      createTender(3, "Hist 3", [
        { companyId: 1, companyName: "Winner Co", bidAmount: 950000, isWinner: true, rank: 1 },
        { companyId: 20, companyName: "RunnerUp Co", bidAmount: 954000, isWinner: false, rank: 2 },
      ]),
      createTender(4, "Hist 4", [
        { companyId: 1, companyName: "Winner Co", bidAmount: 1100000, isWinner: true, rank: 1 },
        { companyId: 20, companyName: "RunnerUp Co", bidAmount: 1104500, isWinner: false, rank: 2 },
      ]),
      targetTender,
    ];

    const result = detectTenderNeatLoss(targetTender, historical, mockScope);
    assert.equal(result.tenderId, 5);
    assert.equal(result.contributingBidders.length, 1); // RunnerUp Co is a contributor
    assert.equal(result.contributingBidders[0].companyId, 20);
    assert.equal(result.contributingBidders[0].bidRank, 2);
    assert.ok(result.indicator.score !== null);
    assert.equal(result.indicator.methodologyVersion, "neat_losing_bid_v1.0");
  });

  // Test 16: Company detector integration
  test("Test 16: detectCompanyNeatLoss creates complete result structure", () => {
    const tenders: NormalizedTenderInput[] = [
      createTender(1, "T1", [
        { companyId: 1, companyName: "W", bidAmount: 1000000, isWinner: true, rank: 1 },
        { companyId: 20, companyName: "ABC", bidAmount: 1004000, isWinner: false, rank: 2 },
      ]),
      createTender(2, "T2", [
        { companyId: 1, companyName: "W", bidAmount: 1200000, isWinner: true, rank: 1 },
        { companyId: 20, companyName: "ABC", bidAmount: 1205000, isWinner: false, rank: 2 },
      ]),
      createTender(3, "T3", [
        { companyId: 1, companyName: "W", bidAmount: 950000, isWinner: true, rank: 1 },
        { companyId: 20, companyName: "ABC", bidAmount: 954000, isWinner: false, rank: 2 },
      ]),
      createTender(4, "T4", [
        { companyId: 1, companyName: "W", bidAmount: 1100000, isWinner: true, rank: 1 },
        { companyId: 20, companyName: "ABC", bidAmount: 1104500, isWinner: false, rank: 2 },
      ]),
      createTender(5, "T5", [
        { companyId: 1, companyName: "W", bidAmount: 1300000, isWinner: true, rank: 1 },
        { companyId: 20, companyName: "ABC", bidAmount: 1305200, isWinner: false, rank: 2 },
      ]),
    ];

    const result = detectCompanyNeatLoss(20, "ABC", "CANON_ABC", tenders);
    assert.equal(result.metrics.companyId, 20);
    assert.equal(result.metrics.companyName, "ABC");
    assert.equal(result.metrics.observations.length, 5);
    assert.equal(result.metrics.participationCount, 5);
    assert.equal(result.metrics.lossCount, 5);
    assert.ok(result.metrics.status === "ELEVATED INDICATOR" || result.metrics.status === "HIGH INDICATOR");
    assert.ok(result.metrics.score !== null && result.metrics.score > 0);
  });
});
