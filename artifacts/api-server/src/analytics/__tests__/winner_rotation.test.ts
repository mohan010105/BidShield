import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { detectWinnerRotation } from "../screens/winner_rotation/detector";
import { NormalizedTenderInput } from "../common/comparable";
import { ComparisonScope } from "../common/types";
import { defaultScreenerConfig } from "../scoring/config";

const mockScope: ComparisonScope = {
  category: "Electrical Equipment",
  organization: "Tamil Nadu Procurement Cell",
  department: "Energy Department",
  geography: "Tamil Nadu (Chennai)",
  valueRange: "₹50.0 L – ₹60.0 L",
  startDate: "2025-01-01",
  endDate: "2025-06-01",
  comparableTenderCount: 6,
};

function createTender(
  id: number,
  tenderDate: string,
  winnerId: number,
  participants: number[]
): NormalizedTenderInput {
  const companyNames: Record<number, string> = {
    1: "Company A",
    2: "Company B",
    3: "Company C",
    4: "Company D",
  };

  const bids = participants.map((cid, idx) => ({
    companyId: cid,
    companyName: companyNames[cid] ?? `Company ${cid}`,
    bidAmount: cid === winnerId ? 5000000 : 5000000 + (idx + 1) * 200000,
    rank: cid === winnerId ? 1 : idx + 2,
    isWinner: cid === winnerId,
    differenceFromWinner: cid === winnerId ? 0 : (idx + 1) * 4.0,
  }));

  return {
    id,
    tenderNumber: `T-2025-${String(id).padStart(3, "0")}`,
    title: `Electrical Tender ${id}`,
    organization: "Tamil Nadu Procurement Cell",
    department: "Energy Department",
    category: "Electrical Equipment",
    location: "Chennai",
    state: "Tamil Nadu",
    tenderDate,
    closingDate: tenderDate,
    estimatedValue: 5000000,
    contractValue: 5000000,
    winner: companyNames[winnerId],
    bids,
  };
}

describe("Winner Rotation Screening Engine", () => {
  it("detects elevated rotation indicators for cyclical turn-taking (A -> B -> C -> A -> B -> C)", () => {
    const participants = [1, 2, 3];
    const sequence = [
      createTender(1, "2025-01-10", 1, participants), // A wins
      createTender(2, "2025-02-10", 2, participants), // B wins
      createTender(3, "2025-03-10", 3, participants), // C wins
      createTender(4, "2025-04-10", 1, participants), // A wins
      createTender(5, "2025-05-10", 2, participants), // B wins
      createTender(6, "2025-06-10", 3, participants), // C wins
    ];

    const targetTender = sequence[5];
    const result = detectWinnerRotation(targetTender, sequence, mockScope);

    assert.equal(result.indicator.indicatorType, "WINNER_ROTATION");
    assert(result.indicator.score !== null && result.indicator.score >= 70, `Score was ${result.indicator.score}`);
    assert(result.indicator.status === "ELEVATED INDICATOR" || result.indicator.status === "HIGH INDICATOR");
    assert.equal(result.metrics.alternationFrequency, 1.0); // 100% of transitions switch winner
    assert.equal(result.metrics.winnerTransitionPattern, 1.0); // all switches between recurring members
    assert.equal(result.metrics.repeatedGroupRate, 1.0); // identical cohort

    // Verify neutral phrasing in evidence
    assert(result.evidence.length > 0);
    result.evidence.forEach((ev) => {
      assert(!ev.description.toLowerCase().includes("fraud"));
      assert(!ev.description.toLowerCase().includes("collusion"));
      assert(!ev.description.toLowerCase().includes("corrupt"));
      assert(!ev.description.toLowerCase().includes("guilty"));
    });
  });

  it("yields low rotation indicator for incumbent domination (A -> A -> A -> B -> A)", () => {
    const participants = [1, 2, 3];
    const sequence = [
      createTender(1, "2025-01-10", 1, participants), // A wins
      createTender(2, "2025-02-10", 1, participants), // A wins
      createTender(3, "2025-03-10", 1, participants), // A wins
      createTender(4, "2025-04-10", 2, participants), // B wins
      createTender(5, "2025-05-10", 1, participants), // A wins
    ];

    const targetTender = sequence[4];
    const result = detectWinnerRotation(targetTender, sequence, mockScope);

    assert(result.indicator.score !== null && result.indicator.score < 50, `Score was ${result.indicator.score}`);
    assert(result.indicator.status === "LOW INDICATOR" || result.indicator.status === "MODERATE INDICATOR");
    assert(result.metrics.alternationFrequency <= 0.5);
  });

  it("safely handles insufficient data when fewer than minimum comparable tenders exist", () => {
    const sequence = [
      createTender(1, "2025-01-10", 1, [1, 2]),
      createTender(2, "2025-02-10", 2, [1, 2]),
    ];

    const targetTender = sequence[1];
    const result = detectWinnerRotation(targetTender, sequence, { ...mockScope, comparableTenderCount: 2 });

    assert.equal(result.indicator.status, "INSUFFICIENT_DATA");
    assert.equal(result.indicator.score, null);
    assert(result.indicator.summary.includes("Insufficient"));
    assert.equal(result.evidence[0].severity, "Informational");
  });
});
