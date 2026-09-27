import {
  bidsTable,
  checkDatabaseConnection,
  companiesTable,
  db,
  evidenceTable,
  importBatchesTable,
  investigationReportsTable,
  riskScoresTable,
  tenderParticipantsTable,
  tendersTable,
} from "@workspace/db";
import { asc, count, eq } from "drizzle-orm";
import {
  normalizeCompany as entityNormalizeCompany,
  normalizeCompanyName as entityNormalizeName,
  normalizeAddress as entityNormalizeAddr,
} from "../entity-resolution/normalizer.js";
import { scoreMatch } from "../entity-resolution/matcher.js";

export type ScreeningLevel = "Low" | "Moderate" | "Elevated" | "Not yet analyzed";

export type DemoCompany = {
  id: number;
  canonicalName: string;
  normalizedName: string;
  address: string;
  state: string;
  aliases: string[];
  tendersParticipated: number;
  wins: number;
  coParticipants: number;
  screeningLevel: ScreeningLevel;
};

export type DemoBid = {
  companyId: number;
  companyName: string;
  bidAmount: number;
  rank: number;
  isWinner: boolean;
  differenceFromWinner: number;
};

export type DemoTender = {
  id: number;
  tenderNumber: string;
  title: string;
  organization: string;
  department: string;
  category: string;
  location: string;
  state: string;
  tenderDate: string;
  closingDate: string;
  estimatedValue: number;
  contractValue: number | null;
  bidderCount: number;
  winner: string | null;
  screeningLevel: ScreeningLevel;
  indicatorCount: number;
  bids: DemoBid[];
};

export type DemoInvestigation = {
  id: number;
  tenderId: number;
  tenderNumber: string;
  title: string;
  screeningLevel: ScreeningLevel;
  indicatorCount: number;
  lastAnalyzed: string | null;
  status: "New" | "Under Review" | "Reviewed";
};

export type CsvRow = Record<string, string>;
export type ColumnMapping = Record<string, string | null>;

const states = ["Karnataka", "Maharashtra", "Delhi", "Tamil Nadu", "Telangana", "Gujarat", "Rajasthan", "Kerala"];
const categories = ["Civil Works", "IT Services", "Medical Supplies", "Transport", "Electrical", "Consulting"];
const departments = ["Public Works", "Health & Family Welfare", "Urban Development", "Education", "Information Technology"];
const organizations = ["Karnataka Infrastructure Authority", "National Health Mission", "Delhi Civic Works", "Tamil Nadu Procurement Cell", "Telangana Digital Services"];
const companyRoots = [
  "Aster", "Bharat", "Civic", "Dakshin", "Eastern", "Frontier", "Global", "Horizon", "Indus", "Jupiter",
  "Kaveri", "Lotus", "Metro", "Narmada", "Orion", "Pioneer", "Quantum", "Radian", "Saffron", "Trident",
  "United", "Vertex", "Western", "Zenith", "Aranya", "BluePeak", "Crescent", "Deccan", "Evergreen", "Falcon",
  "Granite", "Helios", "Integra", "Janus", "Krishna", "Lumina", "Mosaic", "Navya", "Oakline", "Pragati",
  "Redwood", "Sigma", "Terra", "Uday", "Vistara", "Willow", "Xylon", "Yuva", "Zed", "Apex",
];

const normalizeSpaces = (value: string) => value.trim().replace(/\s+/g, " ");

export function normalizeCompanyName(value: string): string {
  return entityNormalizeName(value);
}

export function normalizeAddress(value: string): string {
  return entityNormalizeAddr(value);
}

export function parseBidAmount(value: string): number | null {
  const raw = value.trim().toLowerCase().replace(/[₹,\s]/g, "");
  if (!raw || raw.startsWith("-")) return null;
  const match = raw.match(/^([0-9]+(?:\.[0-9]+)?)(lakh|lac|l|crore|cr|m|k)?$/);
  if (!match) return null;
  const amount = Number(match[1]);
  const multiplier = match[2];
  if (!Number.isFinite(amount)) return null;
  if (multiplier === "lakh" || multiplier === "lac" || multiplier === "l") return amount * 100000;
  if (multiplier === "crore" || multiplier === "cr") return amount * 10000000;
  if (multiplier === "m") return amount * 1000000;
  if (multiplier === "k") return amount * 1000;
  return amount;
}

export function parseDateValue(value: string): string | null {
  const raw = value.trim();
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return isValidDateParts(Number(iso[1]), Number(iso[2]), Number(iso[3])) ? raw : null;
  const dmy = raw.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
  if (dmy) return isValidDateParts(Number(dmy[3]), Number(dmy[2]), Number(dmy[1])) ? `${dmy[3]}-${dmy[2]}-${dmy[1]}` : null;
  const named = raw.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})$/);
  if (named) {
    const month = new Date(`${named[2]} 1, ${named[3]}`).getMonth() + 1;
    if (month > 0) return `${named[3]}-${String(month).padStart(2, "0")}-${String(Number(named[1])).padStart(2, "0")}`;
  }
  return null;
}

function isValidDateParts(year: number, month: number, day: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function normalizeWinner(value: string): boolean | null {
  const normalized = value.trim().toLowerCase();
  if (["yes", "winner", "won", "true", "1"].includes(normalized)) return true;
  if (["no", "lost", "false", "0"].includes(normalized)) return false;
  return null;
}

const mappingAliases: Record<string, string[]> = {
  tenderNumber: ["tender id", "tender number", "tender reference", "tender no", "reference number"],
  tenderTitle: ["tender title", "title", "tender description", "description"],
  organization: ["organization", "organisation", "procuring entity", "authority"],
  department: ["department", "dept"],
  category: ["category", "procurement category", "type"],
  location: ["location", "city", "place"],
  state: ["state", "province"],
  tenderDate: ["tender date", "publish date", "published on", "date"],
  closingDate: ["closing date", "close date", "submission deadline", "deadline"],
  estimatedValue: ["estimated value", "estimate", "tender value"],
  contractValue: ["contract value", "awarded value", "award value"],
  companyName: ["bidder name", "bidder", "company name", "company", "vendor name", "vendor"],
  bidAmount: ["bid amount", "bid value", "quoted amount", "offer amount", "bid"],
  bidRank: ["bid rank", "rank", "position"],
  isWinner: ["winner", "winning bid", "is winner", "won"],
  technicalScore: ["technical score", "technical"],
  financialScore: ["financial score", "financial"],
  submissionDate: ["submission date", "submitted on"],
};

export function detectColumnMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  for (const header of headers) {
    const normalized = header.trim().toLowerCase().replace(/[_-]/g, " ");
    const match = Object.entries(mappingAliases).find(([, aliases]) => aliases.includes(normalized));
    mapping[header] = match?.[0] ?? null;
  }
  return mapping;
}

export function parseCsv(content: string): { headers: string[]; rows: CsvRow[] } {
  const lines = content.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  const parseLine = (line: string): string[] => {
    const values: string[] = [];
    let current = "";
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else if (char === '"') {
        quoted = !quoted;
      } else if (char === "," && !quoted) {
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    return values;
  };
  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const values = parseLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
  return { headers, rows };
}

export function validateRows(rows: CsvRow[], mapping: ColumnMapping) {
  const fieldFor = (field: string) => Object.entries(mapping).find(([, value]) => value === field)?.[0];
  const tenderKey = fieldFor("tenderNumber");
  const companyKey = fieldFor("companyName");
  const amountKey = fieldFor("bidAmount");
  const tenderDateKey = fieldFor("tenderDate");
  const closingDateKey = fieldFor("closingDate");
  const winnerKey = fieldFor("isWinner");
  const rankKey = fieldFor("bidRank");
  const issues: { row: number; code: string; message: string; severity: "warning" | "error" }[] = [];
  const seen = new Set<string>();
  let validRows = 0;
  let warningRows = 0;
  const errorRows = new Set<number>();
  const warningRowSet = new Set<number>();
  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const tender = tenderKey ? row[tenderKey] : "";
    const company = companyKey ? row[companyKey] : "";
    const amount = amountKey ? row[amountKey] : "";
    if (!tender && !company && !amount) {
      issues.push({ row: rowNumber, code: "EMPTY_ROW", message: "The row contains no values.", severity: "warning" });
      warningRowSet.add(rowNumber);
      return;
    }
    if (!tender) {
      issues.push({ row: rowNumber, code: "MISSING_TENDER_ID", message: "Tender ID or tender number is missing.", severity: "error" });
      errorRows.add(rowNumber);
    }
    if (!company) {
      issues.push({ row: rowNumber, code: "MISSING_COMPANY_NAME", message: "Bidder or company name is missing.", severity: "error" });
      errorRows.add(rowNumber);
    }
    const parsedAmount = parseBidAmount(amount ?? "");
    if (amount && parsedAmount === null) {
      issues.push({ row: rowNumber, code: "INVALID_BID_AMOUNT", message: "Bid amount could not be confidently parsed.", severity: "error" });
      errorRows.add(rowNumber);
    } else if (!amount) {
      issues.push({ row: rowNumber, code: "MISSING_BID_AMOUNT", message: "Bid amount is missing.", severity: "error" });
      errorRows.add(rowNumber);
    }
    for (const [key, code, message] of [
      [tenderDateKey, "INVALID_TENDER_DATE", "Tender date is not a supported or valid date."],
      [closingDateKey, "INVALID_CLOSING_DATE", "Closing date is not a supported or valid date."],
    ] as const) {
      const value = key ? row[key] : "";
      if (value && !parseDateValue(value)) {
        issues.push({ row: rowNumber, code, message, severity: "error" });
        errorRows.add(rowNumber);
      }
    }
    if (winnerKey && row[winnerKey] && normalizeWinner(row[winnerKey]) === null) {
      issues.push({ row: rowNumber, code: "INCONSISTENT_WINNER", message: "Winner value should be Yes/No, Winner/Lost, or a supported boolean value.", severity: "warning" });
      warningRowSet.add(rowNumber);
    }
    if (rankKey && row[rankKey]) {
      const rank = Number(row[rankKey]);
      if (!Number.isInteger(rank) || rank < 1) {
        issues.push({ row: rowNumber, code: "IMPOSSIBLE_RANK", message: "Bid rank must be a positive whole number.", severity: "warning" });
        warningRowSet.add(rowNumber);
      }
    }
    const duplicateKey = `${tender}|${company}|${amount}`;
    if (seen.has(duplicateKey)) {
      issues.push({ row: rowNumber, code: "DUPLICATE_ROW", message: "This row repeats an earlier tender, bidder, and amount.", severity: "warning" });
      warningRowSet.add(rowNumber);
    }
    seen.add(duplicateKey);
    if (errorRows.has(rowNumber)) return;
    validRows += 1;
  });
  warningRows = warningRowSet.size;
  const errorCount = errorRows.size;
  const qualityScore = rows.length === 0 ? 0 : Math.max(0, Math.round(((rows.length - errorCount - warningRows * 0.4) / rows.length) * 100));
  return { rows: rows.length, validRows, warningRows, errorRows: errorCount, duplicates: issues.filter((issue) => issue.code === "DUPLICATE_ROW").length, qualityScore, issues };
}

export function cleanRows(rows: CsvRow[], mapping: ColumnMapping) {
  const mapped = (row: CsvRow, field: string) => {
    const key = Object.entries(mapping).find(([, value]) => value === field)?.[0];
    return key ? row[key] ?? "" : "";
  };
  const cleaned = rows.map((row, index) => ({
    sourceRowId: String(index + 2),
    tenderNumberOriginal: mapped(row, "tenderNumber"),
    tenderNumber: normalizeSpaces(mapped(row, "tenderNumber")),
    tenderTitle: normalizeSpaces(mapped(row, "tenderTitle")),
    organization: normalizeSpaces(mapped(row, "organization")),
    department: normalizeSpaces(mapped(row, "department")),
    category: normalizeSpaces(mapped(row, "category")),
    location: normalizeSpaces(mapped(row, "location")),
    state: normalizeSpaces(mapped(row, "state")),
    tenderDateOriginal: mapped(row, "tenderDate"),
    tenderDate: parseDateValue(mapped(row, "tenderDate")),
    closingDateOriginal: mapped(row, "closingDate"),
    closingDate: parseDateValue(mapped(row, "closingDate")),
    companyNameOriginal: mapped(row, "companyName"),
    companyName: normalizeCompanyName(mapped(row, "companyName")),
    bidAmountOriginal: mapped(row, "bidAmount"),
    bidAmount: parseBidAmount(mapped(row, "bidAmount")),
    isWinnerOriginal: mapped(row, "isWinner"),
    isWinner: normalizeWinner(mapped(row, "isWinner")),
  }));
  return { rows: cleaned, previewRows: cleaned.slice(0, 20), normalizationNotes: ["Original source values are preserved alongside normalized fields.", "Company names use conservative legal-suffix normalization.", "Unparseable amounts and dates remain flagged for review."] };
}

export function resolveEntities(rows: Array<Record<string, unknown>>) {
  const matches = new Map<string, { id: number; sourceName: string; suggestedCompany: string | null; confidence: number; status: "AUTO_MATCHED" | "REVIEW_REQUIRED" | "UNRESOLVED"; nameSimilarity: number; addressSimilarity: number | null; source: string }>();
  for (const row of rows) {
    const sourceName = String(row.companyNameOriginal ?? row.companyName ?? "").trim();
    if (!sourceName || matches.has(sourceName)) continue;

    const gstin = String(row.gstin ?? row.gstinOriginal ?? "").trim() || null;
    const reg = String(row.registrationNumber ?? row.cin ?? "").trim() || null;
    const address = String(row.address ?? row.location ?? "").trim() || null;
    const city = String(row.city ?? row.location ?? "").trim() || null;
    const state = String(row.state ?? "").trim() || null;

    const normSource = entityNormalizeCompany(sourceName, { gstin, registrationNumber: reg, address, city, state });

    let bestCandidate: DemoCompany | null = null;
    let bestScore = -1;
    let bestOutcome = "NO_MATCH";
    let bestNameSim = 0;
    let bestAddrSim: number | null = null;

    for (const c of companies) {
      const normCand = entityNormalizeCompany(c.canonicalName, { address: c.address, state: c.state });
      const scoreRes = scoreMatch(normSource, normCand);
      if (scoreRes.score > bestScore) {
        bestScore = scoreRes.score;
        bestCandidate = c;
        bestOutcome = scoreRes.outcome;
        bestNameSim = scoreRes.signals.nameSimilarity;
        bestAddrSim = scoreRes.signals.addressSimilarity;
      }
    }

    let status: "AUTO_MATCHED" | "REVIEW_REQUIRED" | "UNRESOLVED" = "UNRESOLVED";
    if (bestOutcome === "AUTO_MATCH") status = "AUTO_MATCHED";
    else if (bestOutcome === "REVIEW_REQUIRED") status = "REVIEW_REQUIRED";

    matches.set(sourceName, {
      id: matches.size + 1,
      sourceName,
      suggestedCompany: bestCandidate?.canonicalName ?? null,
      confidence: Math.max(0, bestScore),
      status,
      nameSimilarity: bestNameSim,
      addressSimilarity: bestAddrSim,
      source: "upload",
    });
  }
  const list = [...matches.values()];
  return {
    matches: list,
    resolvedCount: list.filter((match) => match.status === "AUTO_MATCHED").length,
    reviewCount: list.filter((match) => match.status === "REVIEW_REQUIRED").length,
    unresolvedCount: list.filter((match) => match.status === "UNRESOLVED").length,
  };
}

export const companies: DemoCompany[] = companyRoots.map((root, index) => ({
  id: index + 1,
  canonicalName: `${root} ${index % 3 === 0 ? "Infrastructure" : index % 3 === 1 ? "Technologies" : "Engineering"}`,
  normalizedName: normalizeCompanyName(`${root} ${index % 3 === 0 ? "Infrastructure" : index % 3 === 1 ? "Technologies" : "Engineering"}`),
  address: `${10 + index}, ${states[index % states.length]} Industrial Estate`,
  state: states[index % states.length],
  aliases: index < 3 ? [`${root.toUpperCase()} ${index % 2 ? "TECHNOLOGIES PVT LTD" : "INFRASTRUCTURE LTD"}`] : [],
  tendersParticipated: 0,
  wins: 0,
  coParticipants: 0,
  screeningLevel: "Low" as ScreeningLevel,
}));

/**
 * SYNTHETIC DEMO DATA — Tender Generation
 *
 * This dataset is synthetic and created only for demonstration/testing.
 * It does not represent real companies, tenders, or procurement events.
 *
 * Pattern groups embedded in the data:
 *  A) Normal competitive tenders (indices 0-39)
 *  B) Winner rotation cluster (indices 40-54): 3 companies take turns winning
 *  C) Price clustering group (indices 55-69): very tight bid spreads (<2%)
 *  D) Repeated participant network (indices 70-84): same 5-company group appears
 *  E) Cover-bid / neat-loss patterns (indices 85-99): one bidder always just above winner
 */

// Define synthetic pattern groups
const ROTATION_COMPANIES = [0, 1, 2]; // Company IDs 1,2,3 rotate wins
const CLUSTER_COMPANIES = [10, 11, 12, 13]; // Tight pricing group
const NETWORK_GROUP = [20, 21, 22, 23, 24]; // Always appear together
const COVER_BID_COMPANIES = [30, 31, 32, 33]; // Cover-bid patterns

// Seeded PRNG for deterministic but varied results
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return x - Math.floor(x);
}

export const tenders: DemoTender[] = Array.from({ length: 100 }, (_, index) => {
  const month = String((index % 12) + 1).padStart(2, "0");
  const day = String(((index * 3) % 24) + 1).padStart(2, "0");
  const tenderDate = `2025-${month}-${day}`;
  const category = categories[index % categories.length];
  const estimatedValue = 1500000 + Math.round(seededRandom(index * 17) * 13000000);

  let bidderIds: number[];
  let winnerIndex: number;

  if (index >= 40 && index < 55) {
    // GROUP B: Winner rotation — 3 companies rotate wins sequentially
    const rotIdx = (index - 40) % 3;
    bidderIds = [...ROTATION_COMPANIES, (index * 2 + 5) % companies.length];
    // Remove duplicates
    bidderIds = [...new Set(bidderIds)].slice(0, 4);
    winnerIndex = bidderIds[rotIdx];
  } else if (index >= 55 && index < 70) {
    // GROUP C: Price clustering — very tight bid spreads
    bidderIds = [...CLUSTER_COMPANIES];
    winnerIndex = bidderIds[0]; // First company always wins
  } else if (index >= 70 && index < 85) {
    // GROUP D: Repeated participant network — same group always appears together
    bidderIds = [...NETWORK_GROUP].slice(0, 4 + (index % 2));
    winnerIndex = bidderIds[index % bidderIds.length];
  } else if (index >= 85 && index < 100) {
    // GROUP E: Cover-bid / neat-loss — one company always narrowly loses
    bidderIds = [...COVER_BID_COMPANIES];
    winnerIndex = bidderIds[0]; // Company 31 always wins
  } else {
    // GROUP A: Normal competitive bidding
    bidderIds = [
      index % companies.length,
      (index * 3 + 7) % companies.length,
      (index * 5 + 13) % companies.length,
      (index * 7 + 19) % companies.length,
    ];
    bidderIds = [...new Set(bidderIds)].slice(0, 4);
    // Vary winner among different bidders
    winnerIndex = bidderIds[Math.floor(seededRandom(index * 31) * bidderIds.length)];
  }

  const bids = bidderIds.map((companyIndex, bidIndex) => {
    let bidAmount: number;

    if (index >= 55 && index < 70) {
      // Price clustering: all bids within 1.5% of estimated value
      const spread = 0.003 * (bidIndex + 1) + seededRandom(index * 100 + bidIndex) * 0.005;
      bidAmount = estimatedValue * (0.96 + spread);
    } else if (index >= 85 && index < 100) {
      // Cover-bid: losing bids are just 0.5-2% above winner
      if (companyIndex === winnerIndex) {
        bidAmount = estimatedValue * (0.92 + seededRandom(index * 7) * 0.04);
      } else {
        const margin = 0.005 + seededRandom(index * 100 + bidIndex) * 0.015;
        bidAmount = estimatedValue * (0.92 + seededRandom(index * 7) * 0.04) * (1 + margin);
      }
    } else {
      // Normal: varied spread (5-20%)
      const baseDiscount = 0.05 + seededRandom(index * 11 + bidIndex * 37) * 0.15;
      bidAmount = estimatedValue * (1 - baseDiscount + bidIndex * 0.03);
    }

    return {
      companyId: companyIndex + 1,
      companyName: companies[companyIndex].canonicalName,
      bidAmount: Math.round(bidAmount),
      rank: bidIndex + 1,
      isWinner: companyIndex === winnerIndex,
      differenceFromWinner: 0,
    };
  });

  // Sort bids by amount ascending and assign ranks
  bids.sort((a, b) => a.bidAmount - b.bidAmount);
  bids.forEach((bid, i) => { bid.rank = i + 1; });

  // Ensure the winner has the lowest bid (L1)
  const winnerBid = bids.find(b => b.isWinner);
  if (winnerBid && winnerBid.rank !== 1) {
    // Swap: make winner's bid the lowest
    const lowestBid = bids[0];
    const winnerAmount = winnerBid.bidAmount;
    winnerBid.bidAmount = lowestBid.bidAmount;
    lowestBid.bidAmount = winnerAmount;
    bids.sort((a, b) => a.bidAmount - b.bidAmount);
    bids.forEach((bid, i) => { bid.rank = i + 1; });
  }

  const winningBidAmount = bids.find(b => b.isWinner)?.bidAmount ?? bids[0].bidAmount;
  bids.forEach(bid => { bid.differenceFromWinner = Math.max(0, bid.bidAmount - winningBidAmount); });

  // Update company statistics
  bidderIds.forEach(cid => {
    if (companies[cid]) {
      companies[cid].tendersParticipated++;
      if (cid === winnerIndex) companies[cid].wins++;
    }
  });

  // Screening level will be determined by the analytics engine, set "Not yet analyzed" initially
  return {
    id: index + 1,
    tenderNumber: `TND-DEMO-${String(index + 1).padStart(3, "0")}`,
    title: `${category} procurement package ${index + 1}`,
    organization: organizations[index % organizations.length],
    department: departments[index % departments.length],
    category,
    location: `${["Bengaluru", "Mumbai", "New Delhi", "Chennai", "Hyderabad"][index % 5]} District`,
    state: states[index % states.length],
    tenderDate,
    closingDate: `2025-${month}-${String(Math.min(28, Number(day) + 10)).padStart(2, "0")}`,
    estimatedValue,
    contractValue: Math.round(winningBidAmount),
    bidderCount: bids.length,
    winner: companies[winnerIndex].canonicalName,
    screeningLevel: "Not yet analyzed" as ScreeningLevel,
    indicatorCount: 0,
    bids,
  };
});

// Update co-participant counts
companies.forEach((company, idx) => {
  const coParticipantSet = new Set<number>();
  tenders.forEach(t => {
    if (t.bids.some(b => b.companyId === idx + 1)) {
      t.bids.forEach(b => { if (b.companyId !== idx + 1) coParticipantSet.add(b.companyId); });
    }
  });
  company.coParticipants = coParticipantSet.size;
});

export const investigations: DemoInvestigation[] = [];

/** Demo dataset metadata */
export const DEMO_DATASET_INFO = {
  name: "BidShield Synthetic Demo Dataset",
  version: "1.0.0",
  source: "synthetic-demo",
  purpose: "Demonstration and testing of BidShield analytical pipeline",
  disclaimer: "This synthetic dataset is designed to demonstrate BidShield's analytical workflow. It does not represent actual procurement activity or allegations against real organizations.",
  totalCompanies: companies.length,
  totalTenders: tenders.length,
  totalBids: tenders.reduce((sum, t) => sum + t.bids.length, 0),
  patternGroups: [
    { name: "Normal Competitive", range: "TND-DEMO-001 to TND-DEMO-040", count: 40 },
    { name: "Winner Rotation Pattern", range: "TND-DEMO-041 to TND-DEMO-055", count: 15 },
    { name: "Price Clustering Pattern", range: "TND-DEMO-056 to TND-DEMO-070", count: 15 },
    { name: "Repeated Network Pattern", range: "TND-DEMO-071 to TND-DEMO-085", count: 15 },
    { name: "Cover-Bid / Neat-Loss Pattern", range: "TND-DEMO-086 to TND-DEMO-100", count: 15 },
  ],
};

let demoSeeded = false;
let demoAnalyticsRun = false;

export function getDemoStatus() {
  return {
    seeded: demoSeeded,
    analyticsRun: demoAnalyticsRun,
    dataset: DEMO_DATASET_INFO,
    companiesCount: companies.length,
    tendersCount: tenders.length,
    bidsCount: tenders.reduce((sum, t) => sum + t.bids.length, 0),
    investigationsCount: investigations.length,
  };
}

export async function ensureDemoDatabase(): Promise<void> {
  if (demoSeeded) {
    if (!demoAnalyticsRun) {
      await runDemoAnalytics().catch(() => {});
    }
    return;
  }

  try {
    const [tenderCount] = await db.select({ value: count() }).from(tendersTable);
    if (Number(tenderCount?.value ?? 0) > 0) {
      demoSeeded = true;
      return;
    }

    // 1. Create demo import batch
    const [batch] = await db.insert(importBatchesTable).values({
      filename: "bidshield-synthetic-demo-v1.0.csv",
      source: "synthetic-demo",
      totalRows: tenders.reduce((sum, t) => sum + t.bids.length, 0),
      validRows: tenders.reduce((sum, t) => sum + t.bids.length, 0),
      warningRows: 0,
      errorRows: 0,
      status: "Imported",
      qualityScore: "98",
    }).returning();
    const batchId = batch?.id ?? null;

    // 2. Insert companies
    let storedCompanies = await db.select({ id: companiesTable.id, normalizedName: companiesTable.normalizedName }).from(companiesTable).orderBy(asc(companiesTable.id));
    const [companyCount] = await db.select({ value: count() }).from(companiesTable);
    if (Number(companyCount?.value ?? 0) === 0) {
      storedCompanies = await db.insert(companiesTable).values(companies.map(company => ({
        canonicalName: company.canonicalName,
        normalizedName: company.normalizedName,
        address: company.address,
        normalizedAddress: normalizeAddress(company.address),
        state: company.state,
      }))).returning({ id: companiesTable.id, normalizedName: companiesTable.normalizedName });
    }
    const companyIds = new Map(storedCompanies.map(c => [c.normalizedName, c.id]));
    const companyIdFor = (companyId: number) => companyIds.get(companies[companyId - 1]?.normalizedName) ?? companyId;

    // 3. Insert tenders
    const storedTenders = await db.insert(tendersTable).values(tenders.map(tender => ({
      tenderNumber: tender.tenderNumber,
      title: tender.title,
      department: tender.department,
      organization: tender.organization,
      category: tender.category,
      location: tender.location,
      state: tender.state,
      tenderDate: tender.tenderDate,
      closingDate: tender.closingDate,
      estimatedValue: String(tender.estimatedValue),
      contractValue: tender.contractValue === null ? null : String(tender.contractValue),
      winnerId: tender.winner ? companyIdFor(companies.find(c => c.canonicalName === tender.winner)?.id ?? 1) : null,
      status: "Completed",
      source: "synthetic-demo",
    }))).returning({ id: tendersTable.id });

    // 4. Insert bids
    const bidRows = tenders.flatMap((tender, tenderIndex) => tender.bids.map(bid => ({
      tenderId: storedTenders[tenderIndex].id,
      companyId: companyIdFor(bid.companyId),
      bidAmount: String(bid.bidAmount),
      bidRank: bid.rank,
      isWinner: bid.isWinner,
      submissionDate: tender.tenderDate,
      sourceRowId: `demo-${tender.id}-${bid.companyId}`,
      originalCompanyName: bid.companyName,
      normalizedCompanyName: normalizeCompanyName(bid.companyName),
      importBatchId: batchId,
    })));
    await db.insert(bidsTable).values(bidRows);

    // 5. Insert tender participants
    await db.insert(tenderParticipantsTable).values(bidRows.map(bid => ({
      tenderId: bid.tenderId,
      companyId: bid.companyId,
      participated: true,
    })));

    demoSeeded = true;
    if (!demoAnalyticsRun) {
      await runDemoAnalytics().catch(() => {});
    }

    // NOTE: Risk scores and evidence are NOT inserted here.
    // They will be calculated by the analytics engine via runDemoAnalytics().
    // This ensures all screening results flow through the production pipeline.
  } catch {
    // The API still serves the synthetic demo store if a local database is not yet pushed.
  }
}

/**
 * Runs the full BidShield screening pipeline against the demo dataset.
 * Called after seeding, or when the user clicks "Run Screening".
 * Updates in-memory tender screening levels from engine-calculated results.
 */
export async function runDemoAnalytics(): Promise<{ analyzed: number; flagged: number }> {
  // Lazy import to avoid circular dependency
  const { analyticsService } = await import("../analytics/index.js");
  const result = await analyticsService.recalculateCombinedRisk();

  // Update in-memory tender screening levels from analytics results
  for (const tender of tenders) {
    const analytics = await analyticsService.getTenderAnalytics(tender.id);
    if (analytics?.combinedRisk) {
      const score = analytics.combinedRisk.overallScore ?? 0;
      tender.screeningLevel = score >= 60 ? "Elevated" : score >= 35 ? "Moderate" : "Low";
      tender.indicatorCount = analytics.combinedRisk.availableIndicatorCount ?? 0;
    }
  }

  // Rebuild investigations from flagged tenders
  investigations.length = 0;
  const flaggedTenders = tenders.filter(t => t.screeningLevel !== "Low");
  flaggedTenders.slice(0, 20).forEach((tender, index) => {
    investigations.push({
      id: index + 1,
      tenderId: tender.id,
      tenderNumber: tender.tenderNumber,
      title: tender.title,
      screeningLevel: tender.screeningLevel,
      indicatorCount: tender.indicatorCount,
      lastAnalyzed: new Date().toISOString(),
      status: index % 3 === 0 ? "New" : index % 3 === 1 ? "Under Review" : "Reviewed",
    });
  });

  // Update company screening levels
  const companyScores = new Map<number, number[]>();
  for (const tender of tenders) {
    const analytics = await analyticsService.getTenderAnalytics(tender.id);
    if (analytics?.combinedRisk?.overallScore) {
      for (const bid of tender.bids) {
        if (!companyScores.has(bid.companyId)) companyScores.set(bid.companyId, []);
        companyScores.get(bid.companyId)!.push(analytics.combinedRisk.overallScore);
      }
    }
  }
  for (const [companyId, scores] of companyScores) {
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const company = companies.find(c => c.id === companyId);
    if (company) {
      company.screeningLevel = avg >= 60 ? "Elevated" : avg >= 35 ? "Moderate" : "Low";
    }
  }

  demoAnalyticsRun = true;
  return { analyzed: result.analyzed, flagged: result.elevatedSignalsCount };
}

export async function createImportBatch(filename: string, report: { rows: number; validRows: number; warningRows: number; errorRows: number; qualityScore: number }) {
  try {
    const [batch] = await db.insert(importBatchesTable).values({
      filename,
      totalRows: report.rows,
      validRows: report.validRows,
      warningRows: report.warningRows,
      errorRows: report.errorRows,
      qualityScore: String(report.qualityScore),
      status: report.errorRows > 0 ? "Validating" : "Ready",
    }).returning();
    return batch?.id ?? null;
  } catch {
    return null;
  }
}

export async function persistAndProcessImportedCsv(
  filename: string,
  rows: Array<Record<string, unknown>>,
  report: { rows: number; validRows: number; warningRows: number; errorRows: number; qualityScore: number }
) {
  const isDbAvailable = await checkDatabaseConnection();
  let batchId: number | null = null;
  if (isDbAvailable) {
    batchId = await createImportBatch(filename, report);
  }

  const newTenderIds: number[] = [];
  const processedCompanies = new Set<string>();

  const validRows = rows.filter((row) => {
    const tenderNum = String(row.tenderNumber ?? row.tenderNumberOriginal ?? "").trim();
    const compName = String(row.companyName ?? row.companyNameOriginal ?? "").trim();
    const amount = typeof row.bidAmount === "number" ? row.bidAmount : parseBidAmount(String(row.bidAmountOriginal ?? ""));
    return Boolean(tenderNum && compName && amount && amount > 0);
  });

  const tendersMap = new Map<string, Array<Record<string, unknown>>>();
  for (const row of validRows) {
    const tenderNum = String(row.tenderNumber ?? row.tenderNumberOriginal ?? "").trim();
    if (!tendersMap.has(tenderNum)) {
      tendersMap.set(tenderNum, []);
    }
    tendersMap.get(tenderNum)!.push(row);
  }

  for (const [tenderNum, tenderBids] of tendersMap.entries()) {
    const parsedBids = tenderBids.map((row) => {
      const canonical = String(row.companyNameOriginal ?? row.companyName ?? "Unknown Vendor").trim();
      const normalized = normalizeCompanyName(canonical);
      const amount = typeof row.bidAmount === "number" ? row.bidAmount : (parseBidAmount(String(row.bidAmountOriginal ?? "")) || 0);
      const isWinner = Boolean(row.isWinner);
      const sourceRowId = String(row.sourceRowId ?? "");
      return { row, canonical, normalized, amount, isWinner, sourceRowId };
    }).sort((a, b) => a.amount - b.amount);

    const winningIndex = parsedBids.findIndex((b) => b.isWinner);
    const effectiveWinnerIdx = winningIndex >= 0 ? winningIndex : 0;
    parsedBids.forEach((b, idx) => {
      b.isWinner = idx === effectiveWinnerIdx;
    });

    const winningBidAmount = parsedBids[effectiveWinnerIdx]?.amount || parsedBids[0]?.amount || 0;
    const firstRow = parsedBids[0]?.row || {};

    const category = String(firstRow.category || "General Works");
    const organization = String(firstRow.organization || "Public Procurement Authority");
    const department = String(firstRow.department || "Procurement Directorate");
    const location = String(firstRow.location || "Central District");
    const state = String(firstRow.state || "National");
    const tenderDate = String(firstRow.tenderDate || new Date().toISOString().slice(0, 10));
    const closingDate = String(firstRow.closingDate || new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10));
    const title = String(firstRow.tenderTitle || firstRow.title || `${category} Package ${tenderNum}`);
    const estimatedValue = Number(firstRow.estimatedValue) || Math.round(winningBidAmount * 1.05);

    const companyIdMap = new Map<string, number>();
    for (const b of parsedBids) {
      // 1. Check known aliases and canonical mappings via entity resolution service
      let matchedCandidate = await entityResolutionService.findCanonicalForName(b.canonical);
      let comp = matchedCandidate ? companies.find((c) => c.id === matchedCandidate!.companyId) : null;

      // 2. If not found via direct alias, check normalized match in companies list
      if (!comp) {
        comp = companies.find((c) => c.normalizedName === b.normalized || c.canonicalName.toLowerCase() === b.canonical.toLowerCase());
      }

      // 3. If still not found, check via entity resolution
      if (!comp) {
        const matchRecord = await entityResolutionService.resolveSingleRecord(b.canonical, {
          address: `${location}, ${state} Industrial Area`,
          city: location,
          state,
          source: "CSV import",
        });

        if (matchRecord.status === "AUTO_MATCHED" && matchRecord.candidateCompanyId) {
          comp = companies.find((c) => c.id === matchRecord.candidateCompanyId) || null;
          if (comp) {
            await entityResolutionService.addAlias(comp.id, b.canonical, "auto_import", matchRecord.confidence, "CSV import");
          }
        }
      }

      if (!comp) {
        const newCompId = companies.length + 1;
        comp = {
          id: newCompId,
          canonicalName: b.canonical,
          normalizedName: b.normalized,
          address: `${location}, ${state} Industrial Area`,
          state,
          aliases: [b.canonical, b.canonical.toUpperCase()],
          tendersParticipated: 1,
          wins: b.isWinner ? 1 : 0,
          coParticipants: parsedBids.length - 1,
          screeningLevel: "Low",
        };
        companies.push(comp);

        if (isDbAvailable) {
          try {
            const [inserted] = await db.insert(companiesTable).values({
              canonicalName: comp.canonicalName,
              normalizedName: comp.normalizedName,
              address: comp.address,
              normalizedAddress: normalizeAddress(comp.address),
              state: comp.state,
            }).returning({ id: companiesTable.id });
            if (inserted?.id) {
              comp.id = inserted.id;
            }
          } catch {
            // Graceful fallback
          }
        }

        await entityResolutionService.addAlias(comp.id, b.canonical, "canonical", 100, "CSV import");
      } else {
        comp.tendersParticipated += 1;
        if (b.isWinner) comp.wins += 1;
      }
      companyIdMap.set(b.normalized, comp.id);
      processedCompanies.add(comp.normalizedName);
    }

    const demoBids: DemoBid[] = parsedBids.map((b, idx) => ({
      companyId: companyIdMap.get(b.normalized) || (idx + 1),
      companyName: b.canonical,
      bidAmount: b.amount,
      rank: idx + 1,
      isWinner: b.isWinner,
      differenceFromWinner: Math.max(0, b.amount - winningBidAmount),
    }));

    let existingTender = tenders.find((t) => t.tenderNumber === tenderNum);
    let tenderId: number;

    if (existingTender) {
      existingTender.bids = demoBids;
      existingTender.bidderCount = demoBids.length;
      existingTender.contractValue = Math.round(winningBidAmount);
      existingTender.winner = parsedBids[effectiveWinnerIdx]?.canonical || null;
      tenderId = existingTender.id;
    } else {
      tenderId = tenders.length + 1;
      const newTender: DemoTender = {
        id: tenderId,
        tenderNumber: tenderNum,
        title,
        organization,
        department,
        category,
        location,
        state,
        tenderDate,
        closingDate,
        estimatedValue,
        contractValue: Math.round(winningBidAmount),
        bidderCount: demoBids.length,
        winner: parsedBids[effectiveWinnerIdx]?.canonical || null,
        screeningLevel: "Low",
        indicatorCount: 0,
        bids: demoBids,
      };
      tenders.push(newTender);
      newTenderIds.push(tenderId);

      if (isDbAvailable) {
        try {
          const [insertedTender] = await db.insert(tendersTable).values({
            tenderNumber: newTender.tenderNumber,
            title: newTender.title,
            department: newTender.department,
            organization: newTender.organization,
            category: newTender.category,
            location: newTender.location,
            state: newTender.state,
            tenderDate: newTender.tenderDate,
            closingDate: newTender.closingDate,
            estimatedValue: String(newTender.estimatedValue),
            contractValue: String(newTender.contractValue),
            winnerId: companyIdMap.get(parsedBids[effectiveWinnerIdx]?.normalized || ""),
            status: "Completed",
            source: "CSV upload",
          }).returning({ id: tendersTable.id });

          const dbTenderId = insertedTender?.id ?? tenderId;

          await db.insert(bidsTable).values(
            demoBids.map((b) => ({
              tenderId: dbTenderId,
              companyId: b.companyId,
              bidAmount: String(b.bidAmount),
              bidRank: b.rank,
              isWinner: b.isWinner,
              submissionDate: tenderDate,
              sourceRowId: `csv-${dbTenderId}-${b.companyId}`,
              originalCompanyName: b.companyName,
              normalizedCompanyName: normalizeCompanyName(b.companyName),
              importBatchId: batchId,
            }))
          );

          await db.insert(tenderParticipantsTable).values(
            demoBids.map((b) => ({
              tenderId: dbTenderId,
              companyId: b.companyId,
              participated: true,
            }))
          );
        } catch {
          // Graceful fallback
        }
      }
    }
  }

  return {
    batchId,
    newTenderIds,
    processedCompaniesCount: processedCompanies.size,
  };
}