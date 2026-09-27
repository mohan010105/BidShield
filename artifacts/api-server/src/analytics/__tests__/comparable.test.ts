import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { findComparableTenders, calculateTenderSimilarity, NormalizedTenderInput } from "../common/comparable";

describe("Comparable Tenders Engine", () => {
  const tenderA: NormalizedTenderInput = {
    id: 1,
    tenderNumber: "TN-ELEC-001",
    title: "Supply of 11kV Distribution Transformers",
    organization: "Tamil Nadu Procurement Cell",
    department: "Energy Department",
    category: "Electrical Equipment",
    location: "Chennai",
    state: "Tamil Nadu",
    tenderDate: "2025-02-01",
    closingDate: "2025-02-28",
    estimatedValue: 5000000, // ₹50 Lakhs
    contractValue: 5000000,
    winner: "Aster Technologies",
    bids: [],
  };

  const similarTender: NormalizedTenderInput = {
    id: 2,
    tenderNumber: "TN-ELEC-002",
    title: "Supply of Substation Switchgear",
    organization: "Tamil Nadu Procurement Cell",
    department: "Energy Department",
    category: "Electrical Equipment",
    location: "Coimbatore",
    state: "Tamil Nadu",
    tenderDate: "2025-03-01",
    closingDate: "2025-03-28",
    estimatedValue: 6500000, // ₹65 Lakhs
    contractValue: 6500000,
    winner: "Bharat Infrastructure",
    bids: [],
  };

  const unrelatedTender: NormalizedTenderInput = {
    id: 3,
    tenderNumber: "GJ-ROAD-999",
    title: "Four-Lane Highway Construction Project",
    organization: "Gujarat Road Infrastructure Development Corp",
    department: "Highway Authority",
    category: "Road Construction",
    location: "Ahmedabad",
    state: "Gujarat",
    tenderDate: "2025-01-01",
    closingDate: "2025-02-01",
    estimatedValue: 150000000, // ₹15 Crore (30x larger scale)
    contractValue: 150000000,
    winner: "Western Heavy Infra",
    bids: [],
  };

  it("calculates high similarity for tenders in the same category, organization, and value scale", () => {
    const sim = calculateTenderSimilarity(tenderA, similarTender);
    assert(sim >= 0.75, `Expected high similarity, got ${sim}`);
  });

  it("calculates low similarity for unrelated category, distant region, and mismatched financial scale", () => {
    const sim = calculateTenderSimilarity(tenderA, unrelatedTender);
    assert(sim < 0.35, `Expected low similarity, got ${sim}`);
  });

  it("findComparableTenders isolates comparable tenders and excludes unrelated ones", () => {
    const population = [tenderA, similarTender, unrelatedTender];
    const { comparableTenders, scope } = findComparableTenders(tenderA, population);

    assert(comparableTenders.some((t) => t.id === tenderA.id));
    assert(comparableTenders.some((t) => t.id === similarTender.id));
    assert(!comparableTenders.some((t) => t.id === unrelatedTender.id), "Unrelated tender should be excluded from comparable group");

    assert.equal(scope.category, "Electrical Equipment");
    assert.equal(scope.organization, "Tamil Nadu Procurement Cell");
    assert.equal(scope.comparableTenderCount, 2);
  });
});
