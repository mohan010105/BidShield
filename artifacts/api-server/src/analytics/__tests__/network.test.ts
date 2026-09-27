import test from "node:test";
import assert from "node:assert/strict";
import {
  buildParticipationGraph,
  calculateCoParticipationPairs,
  identifyRecurringBidderGroups,
  calculateParticipationConcentration,
  detectParticipationNetwork,
  detectCompanyNetwork,
  detectPairRelationship,
  CompanyEntityInput,
} from "../index";
import { NormalizedTenderInput } from "../common/comparable";
import { defaultScreenerConfig } from "../scoring/config";

const mockCompanies: CompanyEntityInput[] = [
  { id: 1, canonicalName: "Company A Infra", normalizedName: "company a infra", state: "Karnataka", aliases: ["Comp A Pvt Ltd", "A Infra Corp"] },
  { id: 2, canonicalName: "Company B Tech", normalizedName: "company b tech", state: "Karnataka", aliases: ["B Technologies"] },
  { id: 3, canonicalName: "Company C Eng", normalizedName: "company c eng", state: "Karnataka", aliases: [] },
  { id: 4, canonicalName: "Company D Global", normalizedName: "company d global", state: "Maharashtra", aliases: [] },
  { id: 5, canonicalName: "Company E Solutions", normalizedName: "company e solutions", state: "Delhi", aliases: [] },
];

function createMockTender(
  id: number,
  tenderNumber: string,
  bids: Array<{ companyId: number; companyName: string; bidAmount: number; isWinner?: boolean }>,
  options?: Partial<NormalizedTenderInput>
): NormalizedTenderInput {
  return {
    id,
    tenderNumber,
    title: options?.title ?? `Procurement Package ${id}`,
    organization: options?.organization ?? "Karnataka Works",
    department: options?.department ?? "Public Works",
    category: options?.category ?? "Civil Works",
    location: options?.location ?? "Bengaluru",
    state: options?.state ?? "Karnataka",
    tenderDate: options?.tenderDate ?? `2025-01-${String(id).padStart(2, "0")}`,
    closingDate: options?.closingDate ?? `2025-01-${String(id + 10).padStart(2, "0")}`,
    estimatedValue: options?.estimatedValue ?? 5000000,
    contractValue: options?.contractValue ?? 4800000,
    winner: bids.find((b) => b.isWinner)?.companyName ?? bids[0].companyName,
    bids: bids.map((b, idx) => ({
      companyId: b.companyId,
      companyName: b.companyName,
      bidAmount: b.bidAmount,
      rank: idx + 1,
      isWinner: b.isWinner ?? idx === 0,
      differenceFromWinner: 0,
    })),
  };
}

test("Participation Network Analysis Engine (Phase 5)", async (t) => {
  await t.test("Test Case 1: Shared tender count when A and B participate in T1 and T2", () => {
    const t1 = createMockTender(1, "T1", [
      { companyId: 1, companyName: "Company A Infra", bidAmount: 100 },
      { companyId: 2, companyName: "Company B Tech", bidAmount: 105 },
    ]);
    const t2 = createMockTender(2, "T2", [
      { companyId: 1, companyName: "Company A Infra", bidAmount: 200 },
      { companyId: 2, companyName: "Company B Tech", bidAmount: 204 },
    ]);

    const pairs = calculateCoParticipationPairs([t1, t2], mockCompanies);
    const pairAB = pairs.find(
      (p) => (p.companyAId === 1 && p.companyBId === 2) || (p.companyAId === 2 && p.companyBId === 1)
    );

    assert.ok(pairAB, "Pair A-B should be identified");
    assert.equal(pairAB.sharedTenderCount, 2, "Expected shared_tender_count = 2 for A and B in T1 and T2");
    assert.equal(pairAB.participationFrequency, 1.0, "Frequency should be 100%");
  });

  await t.test("Test Case 2: Shared tender count when A participates in T1 and B participates in T2", () => {
    const t1 = createMockTender(1, "T1", [
      { companyId: 1, companyName: "Company A Infra", bidAmount: 100 },
      { companyId: 3, companyName: "Company C Eng", bidAmount: 105 },
    ]);
    const t2 = createMockTender(2, "T2", [
      { companyId: 2, companyName: "Company B Tech", bidAmount: 200 },
      { companyId: 3, companyName: "Company C Eng", bidAmount: 205 },
    ]);

    const pairs = calculateCoParticipationPairs([t1, t2], mockCompanies);
    const pairAB = pairs.find(
      (p) => (p.companyAId === 1 && p.companyBId === 2) || (p.companyAId === 2 && p.companyBId === 1)
    );

    assert.equal(pairAB, undefined, "Pair A-B should not have co-participation (shared_tender_count = 0)");

    // Test via detectPairRelationship
    const directRel = detectPairRelationship(1, 2, [t1, t2], mockCompanies);
    assert.equal(directRel.sharedTenderCount, 0, "detectPairRelationship should return shared_tender_count = 0");
  });

  await t.test("Test Case 3: Three companies repeatedly participate together -> recurring group detected", () => {
    const t1 = createMockTender(1, "T1", [
      { companyId: 1, companyName: "Company A Infra", bidAmount: 100 },
      { companyId: 2, companyName: "Company B Tech", bidAmount: 102 },
      { companyId: 3, companyName: "Company C Eng", bidAmount: 104 },
    ]);
    const t2 = createMockTender(2, "T2", [
      { companyId: 1, companyName: "Company A Infra", bidAmount: 200 },
      { companyId: 2, companyName: "Company B Tech", bidAmount: 202 },
      { companyId: 3, companyName: "Company C Eng", bidAmount: 204 },
    ]);
    const t3 = createMockTender(3, "T3", [
      { companyId: 1, companyName: "Company A Infra", bidAmount: 300 },
      { companyId: 2, companyName: "Company B Tech", bidAmount: 302 },
      { companyId: 3, companyName: "Company C Eng", bidAmount: 304 },
    ]);

    const groups = identifyRecurringBidderGroups([t1, t2, t3], mockCompanies, 3, 2);
    assert.ok(groups.length >= 1, "At least one recurring bidder group should be detected");

    const groupABC = groups.find((g) =>
      [1, 2, 3].every((id) => g.companyIds.includes(id))
    );
    assert.ok(groupABC, "Group {1, 2, 3} must be detected");
    assert.equal(groupABC.sharedTenderCount, 3, "Group should appear across all 3 tenders");
    assert.deepEqual(groupABC.sharedTenderIds, [1, 2, 3], "Supporting tender IDs must match");
  });

  await t.test("Test Case 4: Insufficient tender history produces INSUFFICIENT_DATA", () => {
    const t1 = createMockTender(1, "T1", [
      { companyId: 1, companyName: "Company A Infra", bidAmount: 100 },
      { companyId: 2, companyName: "Company B Tech", bidAmount: 105 },
    ]);

    // Only 1 tender total -> insufficient history
    const scope = {
      category: "Civil Works",
      organization: "Karnataka Works",
      department: "Public Works",
      geography: "Karnataka",
      valueRange: "Standard",
      startDate: "2025-01-01",
      endDate: "2025-01-01",
      comparableTenderCount: 0,
    };

    const result = detectParticipationNetwork(t1, [], scope, mockCompanies, defaultScreenerConfig);
    assert.equal(result.indicator.status, "INSUFFICIENT_DATA", "Should return INSUFFICIENT_DATA status");
    assert.equal(result.indicator.score, null, "Score should be null when data is insufficient");
    assert.match(result.indicator.summary, /Insufficient data/i, "Summary should explain insufficient data reason");

    // Single company test
    const companyRes = detectCompanyNetwork(1, [t1], mockCompanies, defaultScreenerConfig);
    assert.equal(companyRes.indicator.status, "INSUFFICIENT_DATA", "Company network should return INSUFFICIENT_DATA");
    assert.equal(companyRes.indicator.score, null, "Company network score should be null");
  });

  await t.test("Test Case 5: Different aliases resolve to one canonical company (no duplicate nodes)", () => {
    // Both bids submitted under different aliases or original names, but both have canonical companyId = 1
    const t1 = createMockTender(1, "T1", [
      { companyId: 1, companyName: "Comp A Pvt Ltd", bidAmount: 100 }, // Alias of Company 1
      { companyId: 2, companyName: "Company B Tech", bidAmount: 105 },
    ]);
    const t2 = createMockTender(2, "T2", [
      { companyId: 1, companyName: "A Infra Corp", bidAmount: 200 }, // Another alias of Company 1
      { companyId: 2, companyName: "B Technologies", bidAmount: 205 }, // Alias of Company 2
    ]);

    const graph = buildParticipationGraph([t1, t2], mockCompanies);

    // Verify company nodes
    const comp1Nodes = graph.companyNodes.filter((n) => n.id === 1);
    assert.equal(comp1Nodes.length, 1, "Expected exactly one company node for Company 1 despite alias variations");
    assert.equal(comp1Nodes[0].canonicalName, "Company A Infra", "Should use canonical name");
    assert.equal(comp1Nodes[0].degree, 2, "Company 1 should be connected to both tenders");

    const comp2Nodes = graph.companyNodes.filter((n) => n.id === 2);
    assert.equal(comp2Nodes.length, 1, "Expected exactly one company node for Company 2");

    // Verify total unique company nodes in graph
    assert.equal(graph.companyNodes.length, 2, "Total company nodes should be 2");
    assert.equal(graph.tenderNodes.length, 2, "Total tender nodes should be 2");
  });

  await t.test("Bipartite graph structure and participation degree metrics", () => {
    const t1 = createMockTender(1, "T1", [
      { companyId: 1, companyName: "Company A Infra", bidAmount: 100, isWinner: true },
      { companyId: 2, companyName: "Company B Tech", bidAmount: 105 },
    ]);
    const t2 = createMockTender(2, "T2", [
      { companyId: 1, companyName: "Company A Infra", bidAmount: 200, isWinner: false },
      { companyId: 3, companyName: "Company C Eng", bidAmount: 195, isWinner: true },
    ]);

    const graph = buildParticipationGraph([t1, t2], mockCompanies);

    const nodeA = graph.companyNodes.find((n) => n.id === 1)!;
    assert.equal(nodeA.participationCount, 2);
    assert.equal(nodeA.wins, 1);
    assert.equal(nodeA.losses, 1);
    assert.equal(nodeA.degree, 2);
    assert.equal(nodeA.winRate, 0.5);

    // Verify edges
    assert.equal(graph.edges.length, 4, "Should have 4 participation edges");
    const winEdges = graph.edges.filter((e) => e.isWinner);
    assert.equal(winEdges.length, 2, "Should have 2 winning edges");
  });

  await t.test("Deterministic network score calculation and traceable evidence generation", () => {
    // Generate 6 tenders where Company A and Company B participate together
    const tenders: NormalizedTenderInput[] = [];
    for (let i = 1; i <= 6; i++) {
      tenders.push(
        createMockTender(i, `TND-${i}`, [
          { companyId: 1, companyName: "Company A Infra", bidAmount: 100 * i, isWinner: i % 2 === 1 },
          { companyId: 2, companyName: "Company B Tech", bidAmount: 102 * i, isWinner: i % 2 === 0 },
          { companyId: 3, companyName: "Company C Eng", bidAmount: 108 * i },
        ])
      );
    }

    const scope = {
      category: "Civil Works",
      organization: "Karnataka Works",
      department: "Public Works",
      geography: "Karnataka",
      valueRange: "Standard",
      startDate: "2025-01-01",
      endDate: "2025-01-06",
      comparableTenderCount: 5,
    };

    const result = detectParticipationNetwork(tenders[5], tenders.slice(0, 5), scope, mockCompanies);

    assert.ok(result.indicator.score !== null, "Score must not be null");
    assert.ok(result.indicator.score >= 50, "Expected elevated/moderate score for 6 shared tenders");
    assert.ok(result.indicator.score <= 100, "Score must be <= 100");
    assert.ok(["MODERATE INDICATOR", "ELEVATED INDICATOR", "HIGH INDICATOR"].includes(result.indicator.status));

    // Verify traceable evidence
    assert.ok(result.evidence.length >= 1, "Evidence must be generated");
    const evidenceItem = result.evidence[0];
    assert.equal(evidenceItem.indicatorType, "PARTICIPATION_NETWORK", "Indicator type must be PARTICIPATION_NETWORK");
    assert.ok(evidenceItem.supportingTenderIds.length > 0, "Supporting tender IDs must be populated");
    assert.match(evidenceItem.description, /observed/i, "Evidence must use careful observed phrasing");
    assert.doesNotMatch(evidenceItem.description, /cartel|collusion|guilty|fraud/i, "Evidence must not use forbidden words");
  });

  await t.test("Market concentration calculation (HHI and Top-3 share)", () => {
    const t1 = createMockTender(1, "T1", [
      { companyId: 1, companyName: "Company A Infra", bidAmount: 100 },
      { companyId: 2, companyName: "Company B Tech", bidAmount: 102 },
      { companyId: 3, companyName: "Company C Eng", bidAmount: 104 },
    ]);
    const t2 = createMockTender(2, "T2", [
      { companyId: 1, companyName: "Company A Infra", bidAmount: 200 },
      { companyId: 2, companyName: "Company B Tech", bidAmount: 202 },
      { companyId: 3, companyName: "Company C Eng", bidAmount: 204 },
    ]);

    const conc = calculateParticipationConcentration([t1, t2]);
    assert.equal(conc.totalBids, 6);
    assert.equal(conc.top3SharePct, 100);
    assert.equal(conc.isHighConcentration, true);
  });
});
