import {
  bidsTable,
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
  return normalizeSpaces(value)
    .toLowerCase()
    .replace(/[.,/\\-]/g, " ")
    .replace(/\b(private limited|private ltd|pvt limited|pvt ltd|limited|ltd|llp|incorporated|inc|corporation|company)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeAddress(value: string): string {
  return normalizeSpaces(value)
    .toLowerCase()
    .replace(/[.,/\\-]/g, " ")
    .replace(/\broad\b/g, "rd")
    .replace(/\bstreet\b/g, "st")
    .replace(/\s+/g, " ")
    .trim();
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
    const normalized = normalizeCompanyName(sourceName);
    const exact = companies.find((company) => company.normalizedName === normalized);
    const candidate = exact ?? companies.find((company) => normalized.length > 4 && (company.normalizedName.includes(normalized) || normalized.includes(company.normalizedName)));
    const nameSimilarity = exact ? 100 : candidate ? 88 : normalized.length > 10 ? 64 : 42;
    const status = exact ? "AUTO_MATCHED" : candidate && nameSimilarity >= 85 ? "REVIEW_REQUIRED" : "UNRESOLVED";
    matches.set(sourceName, { id: matches.size + 1, sourceName, suggestedCompany: candidate?.canonicalName ?? null, confidence: nameSimilarity, status, nameSimilarity, addressSimilarity: null, source: "upload" });
  }
  const list = [...matches.values()];
  return { matches: list, resolvedCount: list.filter((match) => match.status === "AUTO_MATCHED").length, reviewCount: list.filter((match) => match.status === "REVIEW_REQUIRED").length, unresolvedCount: list.filter((match) => match.status === "UNRESOLVED").length };
}

export const companies: DemoCompany[] = companyRoots.map((root, index) => ({
  id: index + 1,
  canonicalName: `${root} ${index % 3 === 0 ? "Infrastructure" : index % 3 === 1 ? "Technologies" : "Engineering"}`,
  normalizedName: normalizeCompanyName(`${root} ${index % 3 === 0 ? "Infrastructure" : index % 3 === 1 ? "Technologies" : "Engineering"}`),
  address: `${10 + index}, ${states[index % states.length]} Industrial Estate`,
  state: states[index % states.length],
  aliases: index < 3 ? [`${root.toUpperCase()} ${index % 2 ? "TECHNOLOGIES PVT LTD" : "INFRASTRUCTURE LTD"}`] : [],
  tendersParticipated: 18 + (index * 7) % 44,
  wins: 3 + (index * 5) % 18,
  coParticipants: 4 + (index * 3) % 22,
  screeningLevel: index % 11 === 0 ? "Elevated" : index % 4 === 0 ? "Moderate" : "Low",
}));

export const tenders: DemoTender[] = Array.from({ length: 100 }, (_, index) => {
  const month = String((index % 12) + 1).padStart(2, "0");
  const day = String((index % 24) + 1).padStart(2, "0");
  const tenderDate = `2025-${month}-${day}`;
  const category = categories[index % categories.length];
  const estimatedValue = 1200000 + ((index * 731000) % 14500000);
  const bidderIds = [index % companies.length, (index * 3 + 7) % companies.length, (index * 5 + 13) % companies.length, (index * 7 + 19) % companies.length];
  const winnerIndex = index % 9 === 0 ? bidderIds[1] : bidderIds[0];
  const bids = bidderIds.map((companyIndex, bidIndex) => {
    const bid = estimatedValue * (1 - bidIndex * 0.025 + ((index + bidIndex) % 4) * 0.006);
    return { companyId: companyIndex + 1, companyName: companies[companyIndex].canonicalName, bidAmount: Math.round(bid), rank: bidIndex + 1, isWinner: companyIndex === winnerIndex, differenceFromWinner: 0 };
  });
  const winningBid = bids.find((bid) => bid.isWinner)?.bidAmount ?? bids[0].bidAmount;
  bids.forEach((bid) => { bid.differenceFromWinner = Math.max(0, bid.bidAmount - winningBid); });
  const screeningLevel: ScreeningLevel = index % 13 === 0 ? "Elevated" : index % 5 === 0 ? "Moderate" : "Low";
  return {
    id: index + 1,
    tenderNumber: `BS-${2025}-${String(index + 1).padStart(4, "0")}`,
    title: `${category} procurement package ${index + 1}`,
    organization: organizations[index % organizations.length],
    department: departments[index % departments.length],
    category,
    location: `${["Bengaluru", "Mumbai", "New Delhi", "Chennai", "Hyderabad"][index % 5]} District`,
    state: states[index % states.length],
    tenderDate,
    closingDate: `2025-${month}-${String(Math.min(28, Number(day) + 10)).padStart(2, "0")}`,
    estimatedValue,
    contractValue: Math.round(winningBid),
    bidderCount: bids.length,
    winner: companies[winnerIndex].canonicalName,
    screeningLevel,
    indicatorCount: screeningLevel === "Elevated" ? 3 : screeningLevel === "Moderate" ? 1 : 0,
    bids,
  };
});

export const investigations: DemoInvestigation[] = tenders.filter((tender) => tender.screeningLevel !== "Low").slice(0, 12).map((tender, index) => ({
  id: index + 1,
  tenderId: tender.id,
  tenderNumber: tender.tenderNumber,
  title: tender.title,
  screeningLevel: tender.screeningLevel,
  indicatorCount: tender.indicatorCount,
  lastAnalyzed: `2025-${String((index % 9) + 1).padStart(2, "0")}-18T10:00:00.000Z`,
  status: index % 3 === 0 ? "New" : index % 3 === 1 ? "Under Review" : "Reviewed",
}));

export async function ensureDemoDatabase(): Promise<void> {
  try {
    const [companyCount, tenderCount] = await Promise.all([
      db.select({ value: count() }).from(companiesTable),
      db.select({ value: count() }).from(tendersTable),
    ]);
    if (Number(tenderCount[0]?.value ?? 0) > 0) return;
    let storedCompanies = await db.select({ id: companiesTable.id, normalizedName: companiesTable.normalizedName }).from(companiesTable).orderBy(asc(companiesTable.id));
    if (Number(companyCount[0]?.value ?? 0) === 0) {
      storedCompanies = await db.insert(companiesTable).values(companies.map((company) => ({
        canonicalName: company.canonicalName,
        normalizedName: company.normalizedName,
        address: company.address,
        normalizedAddress: normalizeAddress(company.address),
        state: company.state,
      }))).returning({ id: companiesTable.id, normalizedName: companiesTable.normalizedName });
    }
    const companyIds = new Map(storedCompanies.map((company) => [company.normalizedName, company.id]));
    const companyIdFor = (companyId: number) => companyIds.get(companies[companyId - 1].normalizedName) ?? companyId;
    const storedTenders = await db.insert(tendersTable).values(tenders.map((tender) => ({
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
      winnerId: tender.winner ? companyIdFor(companies.find((company) => company.canonicalName === tender.winner)?.id ?? 1) : null,
      status: "Completed",
      source: "synthetic-demo",
    }))).returning({ id: tendersTable.id });
    const bidRows = tenders.flatMap((tender, tenderIndex) => tender.bids.map((bid) => ({
      tenderId: storedTenders[tenderIndex].id,
      companyId: companyIdFor(bid.companyId),
      bidAmount: String(bid.bidAmount),
      bidRank: bid.rank,
      isWinner: bid.isWinner,
      submissionDate: tender.tenderDate,
      sourceRowId: `demo-${tender.id}-${bid.companyId}`,
      originalCompanyName: bid.companyName,
      normalizedCompanyName: normalizeCompanyName(bid.companyName),
    })));
    await db.insert(bidsTable).values(bidRows);
    await db.insert(tenderParticipantsTable).values(bidRows.map((bid) => ({ tenderId: bid.tenderId, companyId: bid.companyId, participated: true })));
    const storedRiskScores = await db.insert(riskScoresTable).values(tenders.filter((tender) => tender.screeningLevel !== "Low").map((tender) => ({
      tenderId: storedTenders[tender.id - 1].id,
      overallScore: tender.screeningLevel === "Elevated" ? "72" : "48",
      riskLevel: tender.screeningLevel,
    }))).returning({ id: riskScoresTable.id, tenderId: riskScoresTable.tenderId });
    await db.insert(evidenceTable).values(storedRiskScores.map((risk) => ({
      riskScoreId: risk.id,
      indicatorType: "Observed participation pattern",
      description: "Synthetic demo evidence placeholder for future screening engines.",
      metric: "Participation history",
      observedValue: "Demo value",
      expectedValue: "Context dependent",
      confidence: "0.5",
      severity: "Informational",
    })));
    await db.insert(investigationReportsTable).values(investigations.map((investigation) => ({
      tenderId: storedTenders[investigation.tenderId - 1].id,
      screeningLevel: investigation.screeningLevel,
      generatedSummary: "Synthetic demo investigation record. This is not a finding of wrongdoing.",
    })));
  } catch {
    // The API still serves the synthetic demo store if a local database is not yet pushed.
  }
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