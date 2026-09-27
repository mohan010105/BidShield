import { NormalizedTenderInput } from "../../common/comparable";
import { defaultScreenerConfig, ScreenerConfig } from "../../scoring/config";
import {
  BipartiteGraph,
  CoParticipationEdge,
  CoParticipationPair,
  CompanyNode,
  ParticipationEdge,
  RecurringBidderGroup,
  TenderNode,
} from "./types";

export interface CompanyEntityInput {
  id: number;
  canonicalName: string;
  normalizedName: string;
  state?: string;
  screeningLevel?: string;
  aliases?: string[];
}

/**
 * Builds the bipartite graph of canonical companies and tenders with participation edges.
 * Resolves entities strictly through canonical IDs.
 */
export function buildParticipationGraph(
  tenders: NormalizedTenderInput[],
  companies: CompanyEntityInput[],
  _config: ScreenerConfig = defaultScreenerConfig
): BipartiteGraph {
  const companyMap = new Map<number, CompanyEntityInput>();
  companies.forEach((c) => companyMap.set(c.id, c));

  // Count company participation and wins across given tenders
  const participationCount = new Map<number, number>();
  const winCount = new Map<number, number>();
  const connectedTenderSet = new Map<number, Set<number>>();

  tenders.forEach((tender) => {
    tender.bids.forEach((bid) => {
      const cid = bid.companyId;
      participationCount.set(cid, (participationCount.get(cid) ?? 0) + 1);
      if (bid.isWinner) {
        winCount.set(cid, (winCount.get(cid) ?? 0) + 1);
      }
      if (!connectedTenderSet.has(cid)) {
        connectedTenderSet.set(cid, new Set());
      }
      connectedTenderSet.get(cid)!.add(tender.id);
    });
  });

  // Unique company nodes
  const activeCompanyIds = Array.from(connectedTenderSet.keys()).sort((a, b) => a - b);
  const companyNodes: CompanyNode[] = activeCompanyIds.map((cid, idx) => {
    const meta = companyMap.get(cid);
    const pCount = participationCount.get(cid) ?? 0;
    const wins = winCount.get(cid) ?? 0;
    const degree = connectedTenderSet.get(cid)?.size ?? 0;
    const losses = Math.max(0, degree - wins);
    const winRate = degree > 0 ? wins / degree : 0;
    const canonicalName = meta?.canonicalName ?? `Company ${cid}`;

    // Layout coordinates in a deterministic grid/arc for visualization
    const colCount = Math.max(1, Math.min(8, Math.ceil(Math.sqrt(activeCompanyIds.length))));
    const row = Math.floor(idx / colCount);
    const col = idx % colCount;
    const x = 80 + col * 130;
    const y = 80 + row * 110;

    return {
      id: cid,
      canonicalId: `CMP-${String(cid).padStart(3, "0")}`,
      label: canonicalName,
      canonicalName,
      normalizedName: meta?.normalizedName ?? canonicalName.toLowerCase(),
      nodeType: "company",
      participationCount: pCount,
      wins,
      losses,
      degree,
      winRate,
      screeningLevel: meta?.screeningLevel ?? "Low",
      state: meta?.state,
      x,
      y,
    };
  });

  // Tender nodes
  const tenderNodes: TenderNode[] = tenders.map((tender, idx) => {
    const colCount = Math.max(1, Math.min(8, Math.ceil(Math.sqrt(tenders.length))));
    const row = Math.floor(idx / colCount);
    const col = idx % colCount;
    const x = 140 + col * 130;
    const y = 500 + row * 110;

    return {
      id: tender.id,
      canonicalId: `TND-${String(tender.id).padStart(3, "0")}`,
      tenderNumber: tender.tenderNumber,
      label: tender.tenderNumber,
      title: tender.title,
      nodeType: "tender",
      category: tender.category,
      organization: tender.organization,
      department: tender.department,
      location: tender.location,
      state: tender.state,
      estimatedValue: tender.estimatedValue,
      contractValue: tender.contractValue,
      tenderDate: tender.tenderDate,
      winner: tender.winner,
      bidderCount: tender.bids.length,
      x,
      y,
    };
  });

  // Participation edges: Company -> Tender
  const edges: ParticipationEdge[] = [];
  tenders.forEach((tender) => {
    tender.bids.forEach((bid) => {
      edges.push({
        id: `E-${bid.companyId}-${tender.id}`,
        source: bid.companyId,
        target: tender.id,
        edgeType: "participation",
        companyId: bid.companyId,
        tenderId: tender.id,
        companyName: bid.companyName,
        tenderNumber: tender.tenderNumber,
        isWinner: bid.isWinner,
        bidRank: bid.rank,
        bidAmount: bid.bidAmount,
      });
    });
  });

  // Projected co-participation edges between companies
  const pairTenders = new Map<string, number[]>();
  tenders.forEach((tender) => {
    const cids = Array.from(new Set(tender.bids.map((b) => b.companyId))).sort((a, b) => a - b);
    for (let i = 0; i < cids.length; i++) {
      for (let j = i + 1; j < cids.length; j++) {
        const key = `${cids[i]}:${cids[j]}`;
        if (!pairTenders.has(key)) {
          pairTenders.set(key, []);
        }
        pairTenders.get(key)!.push(tender.id);
      }
    }
  });

  const coParticipationEdges: CoParticipationEdge[] = [];
  pairTenders.forEach((tenderIds, key) => {
    const [c1, c2] = key.split(":").map(Number);
    const p1 = participationCount.get(c1) ?? 1;
    const p2 = participationCount.get(c2) ?? 1;
    const freq = tenderIds.length / Math.min(p1, p2);

    coParticipationEdges.push({
      id: `PAIR-${c1}-${c2}`,
      source: c1,
      target: c2,
      edgeType: "co_participation",
      sharedTenderCount: tenderIds.length,
      participationFrequency: Math.min(1, freq),
    });
  });

  return {
    companyNodes,
    tenderNodes,
    allNodes: [...companyNodes, ...tenderNodes],
    edges,
    coParticipationEdges,
  };
}

/**
 * Calculates co-participation pairs and metrics between all company pairs across given tenders.
 */
export function calculateCoParticipationPairs(
  tenders: NormalizedTenderInput[],
  companies: CompanyEntityInput[],
  config: ScreenerConfig = defaultScreenerConfig
): CoParticipationPair[] {
  const companyMap = new Map<number, CompanyEntityInput>();
  companies.forEach((c) => companyMap.set(c.id, c));

  const tenderMap = new Map<number, NormalizedTenderInput>();
  tenders.forEach((t) => tenderMap.set(t.id, t));

  // Tenders per company
  const companyTenders = new Map<number, Set<number>>();
  tenders.forEach((t) => {
    t.bids.forEach((b) => {
      if (!companyTenders.has(b.companyId)) {
        companyTenders.set(b.companyId, new Set());
      }
      companyTenders.get(b.companyId)!.add(t.id);
    });
  });

  // Track shared tenders for each pair
  const pairTenders = new Map<string, number[]>();
  tenders.forEach((tender) => {
    const cids = Array.from(new Set(tender.bids.map((b) => b.companyId))).sort((a, b) => a - b);
    for (let i = 0; i < cids.length; i++) {
      for (let j = i + 1; j < cids.length; j++) {
        const key = `${cids[i]}:${cids[j]}`;
        if (!pairTenders.has(key)) {
          pairTenders.set(key, []);
        }
        pairTenders.get(key)!.push(tender.id);
      }
    }
  });

  const pairs: CoParticipationPair[] = [];

  pairTenders.forEach((sharedIds, key) => {
    const [c1, c2] = key.split(":").map(Number);
    const compA = companyMap.get(c1);
    const compB = companyMap.get(c2);
    const tA = companyTenders.get(c1) ?? new Set();
    const tB = companyTenders.get(c2) ?? new Set();

    const sharedTenderObjects = sharedIds
      .map((tid) => tenderMap.get(tid))
      .filter((t): t is NormalizedTenderInput => Boolean(t))
      .sort((a, b) => a.tenderDate.localeCompare(b.tenderDate));

    const sharedCount = sharedTenderObjects.length;
    const minT = Math.min(tA.size, tB.size);
    const unionSize = new Set([...Array.from(tA), ...Array.from(tB)]).size;

    const overlapFreq = minT > 0 ? sharedCount / minT : 0;
    const jaccardFreq = unionSize > 0 ? sharedCount / unionSize : 0;

    const orgs = Array.from(new Set(sharedTenderObjects.map((t) => t.organization)));
    const categories = Array.from(new Set(sharedTenderObjects.map((t) => t.category)));
    const startDate = sharedTenderObjects.length > 0 ? sharedTenderObjects[0].tenderDate : null;
    const endDate = sharedTenderObjects.length > 0 ? sharedTenderObjects[sharedTenderObjects.length - 1].tenderDate : null;

    // Check multi-attribute alignment
    const sameOrgCount = sharedTenderObjects.filter((t) => t.organization === sharedTenderObjects[0]?.organization).length;
    const orgHomogeneity = sharedCount > 0 ? sameOrgCount / sharedCount : 0;

    // Score calculation
    let networkScore: number | null = null;
    let status: CoParticipationPair["status"] = "LOW_INDICATOR";

    if (sharedCount >= 2 && minT >= 2) {
      // 0 - 100 deterministic scoring
      const freqScore = Math.min(35, overlapFreq * 35);
      const recurrenceScore = Math.min(30, (sharedCount / 5) * 30);
      const multiAttrScore = Math.min(20, (orgHomogeneity * 10) + (categories.length === 1 ? 10 : 5));
      const jaccardScore = Math.min(15, jaccardFreq * 15);

      const raw = Math.round(freqScore + recurrenceScore + multiAttrScore + jaccardScore);
      networkScore = Math.min(100, Math.max(0, raw));

      if (networkScore >= 80) status = "HIGH INDICATOR";
      else if (networkScore >= 60) status = "ELEVATED INDICATOR";
      else if (networkScore >= 30) status = "MODERATE INDICATOR";
      else status = "LOW INDICATOR";
    } else {
      status = "LOW_INDICATOR";
    }

    pairs.push({
      companyAId: c1,
      companyAName: compA?.canonicalName ?? `Company ${c1}`,
      companyACanonicalId: `CMP-${String(c1).padStart(3, "0")}`,
      companyBId: c2,
      companyBName: compB?.canonicalName ?? `Company ${c2}`,
      companyBCanonicalId: `CMP-${String(c2).padStart(3, "0")}`,
      sharedTenderCount: sharedCount,
      comparableTenderCount: tenders.length,
      participationFrequency: overlapFreq,
      jaccardFrequency: jaccardFreq,
      sharedTenderIds: sharedTenderObjects.map((t) => t.id),
      sharedTenderNumbers: sharedTenderObjects.map((t) => t.tenderNumber),
      organizations: orgs,
      categories,
      startDate,
      endDate,
      networkScore,
      status,
      evidence: [],
    });
  });

  pairs.sort((a, b) => b.sharedTenderCount - a.sharedTenderCount || (b.networkScore ?? 0) - (a.networkScore ?? 0));
  return pairs;
}

/**
 * Identifies recurring combinations of 3 or more companies appearing together across tenders.
 */
export function identifyRecurringBidderGroups(
  tenders: NormalizedTenderInput[],
  companies: CompanyEntityInput[],
  minGroupSize: number = 3,
  minSharedTenders: number = 2
): RecurringBidderGroup[] {
  const companyMap = new Map<number, CompanyEntityInput>();
  companies.forEach((c) => companyMap.set(c.id, c));

  const tenderMap = new Map<number, NormalizedTenderInput>();
  tenders.forEach((t) => tenderMap.set(t.id, t));

  // Map each tender to set of participating company IDs
  const tenderBidderSets = tenders.map((t) => ({
    tenderId: t.id,
    tenderNumber: t.tenderNumber,
    companyIds: Array.from(new Set(t.bids.map((b) => b.companyId))).sort((a, b) => a - b),
  }));

  // Track subsets of size minGroupSize
  const subsetTenders = new Map<string, number[]>();

  tenderBidderSets.forEach(({ tenderId, companyIds }) => {
    if (companyIds.length < minGroupSize) return;

    // Generate subsets of size minGroupSize
    const n = companyIds.length;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        for (let k = j + 1; k < n; k++) {
          const subset = [companyIds[i], companyIds[j], companyIds[k]];
          const key = subset.join(":");
          if (!subsetTenders.has(key)) {
            subsetTenders.set(key, []);
          }
          subsetTenders.get(key)!.push(tenderId);
        }
      }
    }
  });

  const recurringGroups: RecurringBidderGroup[] = [];

  subsetTenders.forEach((sharedTenderIds, key) => {
    if (sharedTenderIds.length >= minSharedTenders) {
      const cids = key.split(":").map(Number);
      const compNames = cids.map((id) => companyMap.get(id)?.canonicalName ?? `Company ${id}`);
      const canonicalIds = cids.map((id) => `CMP-${String(id).padStart(3, "0")}`);

      const sharedTenderObjects = sharedTenderIds
        .map((tid) => tenderMap.get(tid))
        .filter((t): t is NormalizedTenderInput => Boolean(t));

      const orgs = Array.from(new Set(sharedTenderObjects.map((t) => t.organization)));
      const categories = Array.from(new Set(sharedTenderObjects.map((t) => t.category)));
      const freqPct = tenders.length > 0 ? (sharedTenderIds.length / tenders.length) * 100 : 0;

      recurringGroups.push({
        groupId: `GRP-${key}`,
        companyIds: cids,
        companyNames: compNames,
        canonicalIds,
        sharedTenderCount: sharedTenderIds.length,
        sharedTenderIds,
        sharedTenderNumbers: sharedTenderObjects.map((t) => t.tenderNumber),
        organizations: orgs,
        categories,
        frequencyPct: Math.round(freqPct * 10) / 10,
      });
    }
  });

  recurringGroups.sort((a, b) => b.sharedTenderCount - a.sharedTenderCount);
  return recurringGroups;
}

/**
 * Calculates market share / participation concentration (Herfindahl-Hirschman Index and Top-3 share)
 * within a comparable tender population.
 */
export function calculateParticipationConcentration(tenders: NormalizedTenderInput[]): {
  totalBids: number;
  top3SharePct: number;
  hhi: number;
  isHighConcentration: boolean;
} {
  const companyBidCounts = new Map<number, number>();
  let totalBids = 0;

  tenders.forEach((t) => {
    t.bids.forEach((b) => {
      companyBidCounts.set(b.companyId, (companyBidCounts.get(b.companyId) ?? 0) + 1);
      totalBids++;
    });
  });

  if (totalBids === 0) {
    return { totalBids: 0, top3SharePct: 0, hhi: 0, isHighConcentration: false };
  }

  const sortedShares = Array.from(companyBidCounts.values())
    .map((count) => count / totalBids)
    .sort((a, b) => b - a);

  const top3Share = sortedShares.slice(0, 3).reduce((sum, share) => sum + share, 0);
  const hhi = sortedShares.reduce((sum, share) => sum + Math.pow(share * 100, 2), 0);

  return {
    totalBids,
    top3SharePct: Math.round(top3Share * 1000) / 10,
    hhi: Math.round(hhi),
    isHighConcentration: top3Share >= 0.55 || hhi >= 2500,
  };
}
