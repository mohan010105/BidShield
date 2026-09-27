import { describe, test } from "node:test";
import assert from "node:assert";
import {
  calculateCombinedScreening,
  calculateEvidenceBreakdown,
  generateDeterministicSummary,
  getCombinedScreeningLevel,
  INDICATOR_LABELS,
} from "../screens/combined/calculator";
import { calculateCompanyCombinedScreening } from "../screens/combined/companyCombined";
import { AnalyticsEvidence, AnalyticsIndicator } from "../common/types";
import { analyticsService } from "../service";

function createMockIndicator(
  type: string,
  score: number | null,
  status: "LOW INDICATOR" | "MODERATE INDICATOR" | "ELEVATED INDICATOR" | "HIGH INDICATOR" | "INSUFFICIENT_DATA" = "MODERATE INDICATOR"
): AnalyticsIndicator {
  return {
    indicatorType: type,
    score,
    status,
    methodologyVersion: "v1.0",
    calculatedAt: new Date().toISOString(),
    sampleSize: score !== null ? 10 : 1,
    threshold: 60,
    confidence: score !== null ? 0.85 : 0.2,
    summary: score !== null ? `Evaluation score: ${score}` : "Insufficient sample size",
    metrics: [],
    evidenceCount: score !== null ? 2 : 0,
  };
}

describe("Combined Risk & Evidence Engine (Phase 7)", () => {
  const mockTender = {
    tenderId: 101,
    tenderNumber: "BS-2025-0101",
    title: "Healthcare Medical Equipment Procurement",
    organization: "National Health Authority",
    category: "Medical Equipment",
  };

  test("Test 1: Equal 20% weighting across all 5 independent indicators (matching Step 7 spec)", () => {
    // Exactly matches Step 7 prompt example:
    // Rotation: 72 (14.4), Cover Bid: 65 (13.0), Price Clustering: 81 (16.2), Network: 58 (11.6), Neat Loss: 70 (14.0) -> Overall: 69.2
    const indicators = {
      rotation: createMockIndicator("WINNER_ROTATION", 72, "MODERATE INDICATOR"),
      coverBid: createMockIndicator("COVER_BID", 65, "MODERATE INDICATOR"),
      priceClustering: createMockIndicator("PRICE_CLUSTERING", 81, "HIGH INDICATOR"),
      network: createMockIndicator("PARTICIPATION_NETWORK", 58, "MODERATE INDICATOR"),
      neatLoss: createMockIndicator("NEAT_LOSS", 70, "MODERATE INDICATOR"),
    };

    const result = calculateCombinedScreening(mockTender, indicators);

    assert.strictEqual(result.overallStatus, "EVALUATED");
    assert.strictEqual(result.availableIndicatorCount, 5);
    assert.strictEqual(result.totalIndicatorCount, 5);
    assert.strictEqual(result.overallScore, 69.2);
    assert.strictEqual(result.screeningLevel, "ELEVATED SCREENING SIGNAL");

    // Verify individual contributions
    assert.strictEqual(result.indicators.WINNER_ROTATION.contributionScore, 14.4);
    assert.strictEqual(result.indicators.COVER_BID.contributionScore, 13);
    assert.strictEqual(result.indicators.PRICE_CLUSTERING.contributionScore, 16.2);
    assert.strictEqual(result.indicators.PARTICIPATION_NETWORK.contributionScore, 11.6);
    assert.strictEqual(result.indicators.NEAT_LOSS.contributionScore, 14);

    // Sum of contributions must equal overallScore
    const sumContrib = Object.values(result.indicators).reduce((sum, c) => sum + c.contributionScore, 0);
    assert.strictEqual(Math.round(sumContrib * 10) / 10, result.overallScore);
  });

  test("Test 2: Dynamic weight renormalization when 1 indicator has INSUFFICIENT_DATA (matching Step 4 spec)", () => {
    // 4 available indicators: base weight = 0.80, renormalized weight = 0.25 (25% each)
    const indicators = {
      rotation: createMockIndicator("WINNER_ROTATION", 80),
      coverBid: createMockIndicator("COVER_BID", 60),
      priceClustering: createMockIndicator("PRICE_CLUSTERING", 40),
      network: createMockIndicator("PARTICIPATION_NETWORK", null, "INSUFFICIENT_DATA"),
      neatLoss: createMockIndicator("NEAT_LOSS", 60),
    };

    const result = calculateCombinedScreening(mockTender, indicators);

    assert.strictEqual(result.overallStatus, "EVALUATED");
    assert.strictEqual(result.availableIndicatorCount, 4);
    assert.strictEqual(result.indicators.PARTICIPATION_NETWORK.status, "INSUFFICIENT_DATA");
    assert.strictEqual(result.indicators.PARTICIPATION_NETWORK.rawScore, null);
    assert.strictEqual(result.indicators.PARTICIPATION_NETWORK.contributionScore, 0);

    // Renormalized weight should be 0.25 for each available indicator
    assert.strictEqual(result.indicators.WINNER_ROTATION.renormalizedWeight, 0.25);
    assert.strictEqual(result.indicators.COVER_BID.renormalizedWeight, 0.25);
    assert.strictEqual(result.indicators.PRICE_CLUSTERING.renormalizedWeight, 0.25);
    assert.strictEqual(result.indicators.NEAT_LOSS.renormalizedWeight, 0.25);

    // (80*0.25) + (60*0.25) + (40*0.25) + (60*0.25) = 20 + 15 + 10 + 15 = 60
    assert.strictEqual(result.overallScore, 60);
    assert.strictEqual(result.screeningLevel, "ELEVATED SCREENING SIGNAL");
  });

  test("Test 3: Dynamic weight renormalization when 3 indicators are available", () => {
    // 3 available: 0.20 base weights, available sum = 0.60, each gets 1/3 ~ 0.3333 weight
    const indicators = {
      rotation: createMockIndicator("WINNER_ROTATION", 90),
      coverBid: createMockIndicator("COVER_BID", null, "INSUFFICIENT_DATA"),
      priceClustering: createMockIndicator("PRICE_CLUSTERING", 60),
      network: createMockIndicator("PARTICIPATION_NETWORK", null, "INSUFFICIENT_DATA"),
      neatLoss: createMockIndicator("NEAT_LOSS", 30),
    };

    const result = calculateCombinedScreening(mockTender, indicators);

    assert.strictEqual(result.overallStatus, "EVALUATED");
    assert.strictEqual(result.availableIndicatorCount, 3);
    // (90 + 60 + 30) / 3 = 60
    assert.strictEqual(result.overallScore, 60);
  });

  test("Test 4: Minimum data requirement safeguard (fewer than 2 indicators -> INSUFFICIENT_DATA)", () => {
    // Only 1 indicator available -> MUST NOT manufacture a score
    const indicators = {
      rotation: createMockIndicator("WINNER_ROTATION", 85),
      coverBid: createMockIndicator("COVER_BID", null, "INSUFFICIENT_DATA"),
      priceClustering: createMockIndicator("PRICE_CLUSTERING", null, "INSUFFICIENT_DATA"),
      network: createMockIndicator("PARTICIPATION_NETWORK", null, "INSUFFICIENT_DATA"),
      neatLoss: createMockIndicator("NEAT_LOSS", null, "INSUFFICIENT_DATA"),
    };

    const result = calculateCombinedScreening(mockTender, indicators);

    assert.strictEqual(result.overallStatus, "INSUFFICIENT_DATA");
    assert.strictEqual(result.overallScore, null);
    assert.strictEqual(result.screeningLevel, "INSUFFICIENT DATA");
    assert.strictEqual(result.availableIndicatorCount, 1);
    assert.ok(result.evidenceSummary.includes("Insufficient independent statistical indicators"));
    assert.ok(result.evidenceSummary.includes("At least 2 independent indicators"));
  });

  test("Test 5: Zero available indicators produces INSUFFICIENT_DATA and null score", () => {
    const indicators = {};
    const result = calculateCombinedScreening(mockTender, indicators);

    assert.strictEqual(result.overallStatus, "INSUFFICIENT_DATA");
    assert.strictEqual(result.overallScore, null);
    assert.strictEqual(result.screeningLevel, "INSUFFICIENT DATA");
    assert.strictEqual(result.availableIndicatorCount, 0);
  });

  test("Test 6: Screening level classification ranges (Step 6)", () => {
    assert.strictEqual(getCombinedScreeningLevel(0), "LOW SCREENING SIGNAL");
    assert.strictEqual(getCombinedScreeningLevel(24.9), "LOW SCREENING SIGNAL");
    assert.strictEqual(getCombinedScreeningLevel(25), "MODERATE SCREENING SIGNAL");
    assert.strictEqual(getCombinedScreeningLevel(49.9), "MODERATE SCREENING SIGNAL");
    assert.strictEqual(getCombinedScreeningLevel(50), "ELEVATED SCREENING SIGNAL");
    assert.strictEqual(getCombinedScreeningLevel(74.9), "ELEVATED SCREENING SIGNAL");
    assert.strictEqual(getCombinedScreeningLevel(75), "HIGH SCREENING SIGNAL");
    assert.strictEqual(getCombinedScreeningLevel(100), "HIGH SCREENING SIGNAL");
    assert.strictEqual(getCombinedScreeningLevel(null), "INSUFFICIENT DATA");
  });

  test("Test 7: Top indicators ranking (Step 10)", () => {
    const indicators = {
      rotation: createMockIndicator("WINNER_ROTATION", 50),
      coverBid: createMockIndicator("COVER_BID", 92),
      priceClustering: createMockIndicator("PRICE_CLUSTERING", 85),
      network: createMockIndicator("PARTICIPATION_NETWORK", 40),
      neatLoss: createMockIndicator("NEAT_LOSS", 75),
    };

    const result = calculateCombinedScreening(mockTender, indicators);

    assert.strictEqual(result.topIndicators.length, 5);
    assert.strictEqual(result.topIndicators[0].indicator, "COVER_BID");
    assert.strictEqual(result.topIndicators[0].score, 92);
    assert.strictEqual(result.topIndicators[1].indicator, "PRICE_CLUSTERING");
    assert.strictEqual(result.topIndicators[1].score, 85);
    assert.strictEqual(result.topIndicators[2].indicator, "NEAT_LOSS");
    assert.strictEqual(result.topIndicators[2].score, 75);
  });

  test("Test 8: Traceable evidence aggregation and breakdown calculation (Step 8 & 11)", () => {
    const mockEvidence: AnalyticsEvidence[] = [
      {
        id: 1,
        indicatorType: "WINNER_ROTATION",
        description: "Observed cyclical winning pattern",
        metric: "Cyclical rotation index",
        observedValue: "0.85",
        expectedValue: "0.20",
        confidence: 0.9,
        severity: "HIGH",
        supportingTenderIds: [101, 102],
      },
      {
        id: 2,
        indicatorType: "COVER_BID_PROXIMITY",
        description: "Losing bid placed at consistent markup",
        metric: "Relative bid delta",
        observedValue: "8.5%",
        expectedValue: "1.5%",
        confidence: 0.8,
        severity: "MEDIUM",
        supportingTenderIds: [101],
      },
      {
        id: 3,
        indicatorType: "PRICE_CLUSTERING",
        description: "Extremely low bid price coefficient of variation",
        metric: "CV percentile",
        observedValue: "0.4%",
        expectedValue: "3.2%",
        confidence: 0.85,
        severity: "HIGH",
        supportingTenderIds: [101],
      },
      {
        id: 4,
        indicatorType: "PARTICIPATION_NETWORK_PAIR",
        description: "Frequent co-bidding partnership observed",
        metric: "Shared tender count",
        observedValue: "5 tenders",
        expectedValue: "1 tender",
        confidence: 0.75,
        severity: "LOW",
        supportingTenderIds: [101],
      },
      {
        id: 5,
        indicatorType: "NEAT_LOSS_STABILITY",
        description: "Losing bidder exhibited invariant 2nd place position",
        metric: "Rank stability standard deviation",
        observedValue: "0.0",
        expectedValue: "1.2",
        confidence: 0.88,
        severity: "MEDIUM",
        supportingTenderIds: [101],
      },
    ];

    const breakdown = calculateEvidenceBreakdown(mockEvidence);

    assert.strictEqual(breakdown.totalCount, 5);
    assert.strictEqual(breakdown.byIndicator.rotation, 1);
    assert.strictEqual(breakdown.byIndicator.coverBid, 1);
    assert.strictEqual(breakdown.byIndicator.priceClustering, 1);
    assert.strictEqual(breakdown.byIndicator.network, 1);
    assert.strictEqual(breakdown.byIndicator.neatLoss, 1);
    assert.strictEqual(breakdown.bySeverity.high, 2);
    assert.strictEqual(breakdown.bySeverity.medium, 2);
    assert.strictEqual(breakdown.bySeverity.low, 1);
  });

  test("Test 9: Deterministic evidence summary uses strict, non-accusatory language (Step 9)", () => {
    const indicators = {
      rotation: createMockIndicator("WINNER_ROTATION", 82),
      coverBid: createMockIndicator("COVER_BID", 78),
      priceClustering: createMockIndicator("PRICE_CLUSTERING", 65),
      network: createMockIndicator("PARTICIPATION_NETWORK", null, "INSUFFICIENT_DATA"),
      neatLoss: createMockIndicator("NEAT_LOSS", 50),
    };

    const mockEvidence: AnalyticsEvidence[] = [
      {
        id: 1,
        indicatorType: "WINNER_ROTATION",
        description: "Observed cyclical pattern",
        metric: "Rotation index",
        observedValue: "0.82",
        expectedValue: null,
        confidence: 0.8,
        severity: "HIGH",
        supportingTenderIds: [101],
      },
    ];

    const result = calculateCombinedScreening(mockTender, indicators, mockEvidence);
    const summary = result.evidenceSummary;

    // Must be factual and explain indicators
    assert.ok(summary.includes("4 of 5 independent statistical indicators were available"));
    assert.ok(summary.includes("Participation Network had insufficient comparable observations"));

    // Strictly forbidden words
    const forbidden = ["collusion", "fraud", "guilty", "cartel", "rigging", "wrongdoing", "criminal"];
    for (const term of forbidden) {
      assert.strictEqual(
        summary.toLowerCase().includes(term),
        false,
        `Summary must not contain forbidden accusatory word: "${term}"`
      );
    }
  });

  test("Test 10: Company combined screening calculation", () => {
    const mockCompany = {
      companyId: 5,
      companyName: "Apex Medical Supplies Ltd",
      canonicalId: "CMP-005",
      tendersAnalyzed: 8,
    };

    const indicators = {
      rotation: createMockIndicator("WINNER_ROTATION", 65),
      coverBid: createMockIndicator("COVER_BID", 70),
      priceClustering: createMockIndicator("PRICE_CLUSTERING", 55),
      network: createMockIndicator("PARTICIPATION_NETWORK", 60),
      neatLoss: createMockIndicator("NEAT_LOSS", 80),
    };

    const result = calculateCompanyCombinedScreening(mockCompany, indicators);

    assert.strictEqual(result.companyId, 5);
    assert.strictEqual(result.overallStatus, "EVALUATED");
    assert.strictEqual(result.availableIndicatorCount, 5);
    // (65 + 70 + 55 + 60 + 80) * 0.20 = 330 * 0.20 = 66
    assert.strictEqual(result.overallScore, 66);
    assert.strictEqual(result.screeningLevel, "ELEVATED SCREENING SIGNAL");
    assert.strictEqual(result.methodologyVersion, "combined_risk_v1.0");
  });

  test("Test 11: AnalyticsService getCombinedScreeningForTender and getCombinedScreeningList integration", async () => {
    const listResult = await analyticsService.getCombinedScreeningList();

    assert.ok(listResult.items.length > 0);
    assert.ok(listResult.summary.totalTendersAnalyzed > 0);
    assert.ok(listResult.summary.tendersWithSufficientEvidence > 0);
    assert.ok(typeof listResult.summary.averageScreeningScore === "number");

    // Check first item structure
    const first = listResult.items[0];
    assert.ok(first.tenderId > 0);
    assert.ok(first.tenderNumber.length > 0);
    assert.ok(first.screeningLevel.length > 0);

    // Single tender combined screening check
    const tenderCombined = await analyticsService.getCombinedScreeningForTender(first.tenderId);
    assert.ok(tenderCombined !== null);
    assert.strictEqual(tenderCombined?.tenderId, first.tenderId);
    assert.strictEqual(tenderCombined?.methodologyVersion, "combined_risk_v1.0");
    assert.ok(tenderCombined?.indicators.WINNER_ROTATION);
    assert.ok(tenderCombined?.indicators.COVER_BID);
    assert.ok(tenderCombined?.indicators.PRICE_CLUSTERING);
    assert.ok(tenderCombined?.indicators.PARTICIPATION_NETWORK);
    assert.ok(tenderCombined?.indicators.NEAT_LOSS);
  });
});
