import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { detectCoverBid } from "../screens/cover_bid/detector";
import { NormalizedTenderInput } from "../common/comparable";
import { ComparisonScope } from "../common/types";

const mockScope: ComparisonScope = {
  category: "Civil Works",
  organization: "Karnataka Infrastructure Authority",
  department: "Public Works",
  geography: "Karnataka (Bengaluru)",
  valueRange: "₹10.0 L – ₹15.0 L",
  startDate: "2025-01-01",
  endDate: "2025-06-01",
  comparableTenderCount: 5,
};

function createTenderWithBids(
  id: number,
  bids: Array<{ companyId: number; companyName: string; bidAmount: number; isWinner: boolean }>
): NormalizedTenderInput {
  const winBid = bids.find((b) => b.isWinner) ?? bids[0];
  return {
    id,
    tenderNumber: `CW-2025-${String(id).padStart(3, "0")}`,
    title: `Civil Works Package ${id}`,
    organization: "Karnataka Infrastructure Authority",
    department: "Public Works",
    category: "Civil Works",
    location: "Bengaluru",
    state: "Karnataka",
    tenderDate: `2025-0${id}-15`,
    closingDate: `2025-0${id}-25`,
    estimatedValue: winBid.bidAmount,
    contractValue: winBid.bidAmount,
    winner: winBid.companyName,
    bids: bids.map((b, idx) => ({
      companyId: b.companyId,
      companyName: b.companyName,
      bidAmount: b.bidAmount,
      rank: b.isWinner ? 1 : idx + 2,
      isWinner: b.isWinner,
      differenceFromWinner: b.isWinner ? 0 : Math.round(((b.bidAmount - winBid.bidAmount) / winBid.bidAmount) * 1000) / 10,
    })),
  };
}

describe("Cover-Bid / Suspicious Bid-Position Screening Engine", () => {
  it("detects repeated proximity pattern across historical comparable tenders", () => {
    // Historical comparable tenders where Company B repeatedly bids ~8% above winner
    const comp1 = createTenderWithBids(1, [
      { companyId: 1, companyName: "Company A", bidAmount: 1000000, isWinner: true },
      { companyId: 2, companyName: "Company B", bidAmount: 1081000, isWinner: false }, // +8.1%
      { companyId: 3, companyName: "Company C", bidAmount: 1083000, isWinner: false }, // +8.3%
    ]);
    const comp2 = createTenderWithBids(2, [
      { companyId: 4, companyName: "Company D", bidAmount: 2000000, isWinner: true },
      { companyId: 2, companyName: "Company B", bidAmount: 2160000, isWinner: false }, // +8.0%
      { companyId: 3, companyName: "Company C", bidAmount: 2164000, isWinner: false }, // +8.2%
    ]);
    const comp3 = createTenderWithBids(3, [
      { companyId: 1, companyName: "Company A", bidAmount: 1500000, isWinner: true },
      { companyId: 2, companyName: "Company B", bidAmount: 1620000, isWinner: false }, // +8.0%
      { companyId: 3, companyName: "Company C", bidAmount: 1626000, isWinner: false }, // +8.4%
    ]);

    // Current target tender: Company B bids +8.0% and Company C bids +8.2%
    const target = createTenderWithBids(4, [
      { companyId: 1, companyName: "Company A", bidAmount: 1000000, isWinner: true },
      { companyId: 2, companyName: "Company B", bidAmount: 1080000, isWinner: false }, // +8.0%
      { companyId: 3, companyName: "Company C", bidAmount: 1082000, isWinner: false }, // +8.2%
      { companyId: 5, companyName: "Company E", bidAmount: 1085000, isWinner: false }, // +8.5%
    ]);

    const comparableList = [comp1, comp2, comp3, target];
    const result = detectCoverBid(target, comparableList, mockScope);

    assert.equal(result.indicator.indicatorType, "COVER_BID");
    assert(result.indicator.score !== null && result.indicator.score >= 65, `Score was ${result.indicator.score}`);
    assert(result.indicator.status === "ELEVATED INDICATOR" || result.indicator.status === "HIGH INDICATOR");
    assert(result.metrics.flaggedCompanies.includes("Company B"));
    assert.equal(result.metrics.medianRelativeDistance, 8.2);

    // Check evidence traceability
    assert(result.evidence.length >= 2);
    const coBEvidence = result.evidence.find((e) => e.description.includes("Company B"));
    assert(coBEvidence, "Evidence should exist for Company B repeated positioning");
    assert(coBEvidence.description.includes("+8.0%"));
    assert(coBEvidence.description.includes("repeated bid-positioning pattern"));
    assert(!coBEvidence.description.toLowerCase().includes("fraud"));
    assert(!coBEvidence.description.toLowerCase().includes("collusion"));
  });

  it("handles insufficient bid count safely", () => {
    const singleBidTender = createTenderWithBids(1, [
      { companyId: 1, companyName: "Company A", bidAmount: 1000000, isWinner: true },
    ]);

    const result = detectCoverBid(singleBidTender, [singleBidTender], mockScope);
    assert.equal(result.indicator.status, "INSUFFICIENT_DATA");
    assert.equal(result.indicator.score, null);
    assert(result.indicator.summary.includes("Insufficient bids"));
  });
});
