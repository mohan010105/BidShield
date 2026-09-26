import { Router, type IRouter } from "express";
import {
  CleanDataBody,
  CleanDataResponse,
  ConfirmEntityParams,
  ConfirmEntityResponse,
  CreateEntityBody,
  CreateEntityResponse,
  GetCompaniesQueryParams,
  GetCompaniesResponse,
  GetCompanyParams,
  GetCompanyResponse,
  GetDashboardSummaryResponse,
  GetDatasetParams,
  GetDatasetResponse,
  GetDatasetsResponse,
  GetEntityReviewResponse,
  GetInvestigationParams,
  GetInvestigationResponse,
  GetInvestigationsResponse,
  GetNetworkResponse,
  GetTenderParams,
  GetTenderResponse,
  GetTendersQueryParams,
  GetTendersResponse,
  ImportDataBody,
  ImportDataResponse,
  RejectEntityParams,
  RejectEntityResponse,
  ResolveEntitiesBody,
  ResolveEntitiesResponse,
  UploadDataBody,
  UploadDataResponse,
  ValidateDataBody,
  ValidateDataResponse,
} from "@workspace/api-zod";
import {
  cleanRows,
  companies,
  createImportBatch,
  detectColumnMapping,
  ensureDemoDatabase,
  investigations,
  normalizeCompanyName,
  parseCsv,
  resolveEntities,
  tenders,
  validateRows,
  type ColumnMapping,
  type CsvRow,
} from "../lib/bidshieldData";

const router: IRouter = Router();
const datasetPreviews = new Map<string, { filename: string; headers: string[]; rows: CsvRow[]; mapping: ColumnMapping }>();
const datasetReports = new Map<number, ReturnType<typeof validateRows>>();
const datasets: Array<{
  id: number;
  filename: string;
  source: string;
  uploadedAt: Date;
  totalRows: number;
  qualityScore: number;
  status: "Uploaded" | "Validating" | "Ready" | "Imported" | "Failed";
  companies: number;
  tenders: number;
  validRows: number;
  warningRows: number;
  errorRows: number;
  errors: ReturnType<typeof validateRows>["issues"];
}> = [];
let nextDatasetId = 1;
type EntityMatchState = {
  id: number;
  sourceName: string;
  suggestedCompany: string | null;
  confidence: number;
  status: "AUTO_MATCHED" | "REVIEW_REQUIRED" | "CONFIRMED" | "REJECTED" | "UNRESOLVED";
  nameSimilarity: number;
  addressSimilarity: number | null;
  source: string;
};

let entityMatches: EntityMatchState[] = resolveEntities([
  { companyNameOriginal: "ABC Technologies Pvt Ltd" },
  { companyNameOriginal: "Global Engineering Limited" },
  { companyNameOriginal: "ABC Trading Company" },
]).matches;

const asDate = (value: string | null) => value ? new Date(`${value}T00:00:00.000Z`) : null;
const tenderSummary = (tender: (typeof tenders)[number]) => ({
  id: tender.id,
  tenderNumber: tender.tenderNumber,
  title: tender.title,
  organization: tender.organization,
  department: tender.department,
  category: tender.category,
  location: tender.location,
  state: tender.state,
  tenderDate: asDate(tender.tenderDate),
  closingDate: asDate(tender.closingDate),
  estimatedValue: tender.estimatedValue,
  contractValue: tender.contractValue,
  bidderCount: tender.bidderCount,
  winner: tender.winner,
  screeningLevel: tender.screeningLevel,
  indicatorCount: tender.indicatorCount,
});
const companySummary = (company: (typeof companies)[number]) => ({
  id: company.id,
  canonicalName: company.canonicalName,
  normalizedName: company.normalizedName,
  address: company.address,
  state: company.state,
  tendersParticipated: company.tendersParticipated,
  wins: company.wins,
  winRate: company.tendersParticipated ? company.wins / company.tendersParticipated : 0,
  coParticipants: company.coParticipants,
  screeningLevel: company.screeningLevel,
});

function chart(label: string, value: number) {
  return { label, value };
}

router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  await ensureDemoDatabase();
  const categories = [...new Set(tenders.map((tender) => tender.category))].map((category) => chart(category, tenders.filter((tender) => tender.category === category).reduce((sum, tender) => sum + tender.estimatedValue, 0)));
  const stateCounts = [...new Set(tenders.map((tender) => tender.state))].map((state) => chart(state, tenders.filter((tender) => tender.state === state).length));
  const screeningDistribution = ["Low", "Moderate", "Elevated"].map((level) => chart(level, tenders.filter((tender) => tender.screeningLevel === level).length));
  const response = {
    totalTenders: tenders.length,
    totalCompanies: companies.length,
    totalBids: tenders.reduce((sum, tender) => sum + tender.bids.length, 0),
    reviewCount: tenders.filter((tender) => tender.screeningLevel !== "Low").length,
    tenderVolume: Array.from({ length: 12 }, (_, index) => chart(new Date(2025, index, 1).toLocaleString("en-IN", { month: "short" }), tenders.filter((tender) => Number(tender.tenderDate.slice(5, 7)) === index + 1).length)),
    categoryValues: categories,
    stateCounts,
    screeningDistribution,
    recentInvestigations: investigations.slice(0, 5).map((item) => ({ ...item, lastAnalyzed: item.lastAnalyzed ? new Date(item.lastAnalyzed) : null })),
  };
  res.json(GetDashboardSummaryResponse.parse(response));
});

router.get("/tenders", (req, res): void => {
  const parsed = GetTendersQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.message });
    return;
  }
  const { search, category, state, screening, page, pageSize } = parsed.data;
  const filtered = tenders.filter((tender) => {
    const haystack = `${tender.tenderNumber} ${tender.title} ${tender.organization}`.toLowerCase();
    return (!search || haystack.includes(search.toLowerCase())) &&
      (!category || tender.category === category) &&
      (!state || tender.state === state) &&
      (!screening || screening === "All" || tender.screeningLevel === screening);
  });
  const response = { items: filtered.slice((page - 1) * pageSize, page * pageSize).map(tenderSummary), total: filtered.length, page, pageSize };
  res.json(GetTendersResponse.parse(response));
});

router.get("/tenders/:id", (req, res): void => {
  const params = GetTenderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ success: false, error: params.error.message });
    return;
  }
  const tender = tenders.find((item) => item.id === params.data.id);
  if (!tender) {
    res.status(404).json({ success: false, error: "Tender not found" });
    return;
  }
  const evidence = tender.screeningLevel === "Low" ? [] : [{
    id: tender.id,
    indicatorType: "Observed participation pattern",
    description: "The tender has a repeated participation pattern that may be useful for investigator review.",
    metric: "Bidder participation history",
    observedValue: `${tender.bidderCount} bidders`,
    expectedValue: "Context varies by category and market",
    severity: tender.screeningLevel === "Elevated" ? "Review" : "Informational",
    confidence: tender.screeningLevel === "Elevated" ? 0.72 : 0.54,
  }];
  const response = {
    ...tenderSummary(tender),
    bids: tender.bids,
    screening: { overall: tender.screeningLevel, rotation: null, coverBid: null, priceClustering: null, network: null, neatLoss: null },
    evidence,
  };
  res.json(GetTenderResponse.parse(response));
});

router.get("/companies", (req, res): void => {
  const parsed = GetCompaniesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.message });
    return;
  }
  const { search, state, screening, page, pageSize } = parsed.data;
  const filtered = companies.filter((company) =>
    (!search || company.canonicalName.toLowerCase().includes(search.toLowerCase())) &&
    (!state || company.state === state) &&
    (!screening || screening === "All" || company.screeningLevel === screening),
  );
  res.json(GetCompaniesResponse.parse({ items: filtered.slice((page - 1) * pageSize, page * pageSize).map(companySummary), total: filtered.length, page, pageSize }));
});

router.get("/companies/:id", (req, res): void => {
  const params = GetCompanyParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ success: false, error: params.error.message });
    return;
  }
  const company = companies.find((item) => item.id === params.data.id);
  if (!company) {
    res.status(404).json({ success: false, error: "Company not found" });
    return;
  }
  const participated = tenders.filter((tender) => tender.bids.some((bid) => bid.companyId === company.id));
  const wins = participated.filter((tender) => tender.winner === company.canonicalName).length;
  const response = {
    ...companySummary(company),
    aliases: company.aliases,
    gstin: null,
    registrationNumber: `REG-${String(company.id).padStart(5, "0")}`,
    losses: Math.max(0, participated.length - wins),
    totalBidValue: participated.reduce((sum, tender) => sum + (tender.bids.find((bid) => bid.companyId === company.id)?.bidAmount ?? 0), 0),
    participationOverTime: Array.from({ length: 6 }, (_, index) => chart(`M${index + 1}`, Math.max(1, Math.round(participated.length / 6) + (index % 2)))),
    winsOverTime: Array.from({ length: 6 }, (_, index) => chart(`M${index + 1}`, Math.max(0, Math.round(wins / 6) + (index === 2 ? 1 : 0)))),
    frequentCoParticipants: companies.filter((other) => other.id !== company.id).slice(company.id % 4, (company.id % 4) + 4).map(companySummary),
  };
  res.json(GetCompanyResponse.parse(response));
});

router.get("/investigations", (_req, res): void => {
  res.json(GetInvestigationsResponse.parse(investigations.map((item) => ({ ...item, lastAnalyzed: item.lastAnalyzed ? new Date(item.lastAnalyzed) : null }))));
});

router.get("/investigations/:id", (req, res): void => {
  const params = GetInvestigationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ success: false, error: params.error.message });
    return;
  }
  const investigation = investigations.find((item) => item.id === params.data.id);
  if (!investigation) {
    res.status(404).json({ success: false, error: "Investigation not found" });
    return;
  }
  const tender = tenders.find((item) => item.id === investigation.tenderId)!;
  const response = {
    ...investigation,
    lastAnalyzed: investigation.lastAnalyzed ? new Date(investigation.lastAnalyzed) : null,
    tender: { ...tenderSummary(tender), bids: tender.bids, screening: { overall: tender.screeningLevel, rotation: null, coverBid: null, priceClustering: null, network: null, neatLoss: null }, evidence: [] },
    notes: null,
    relationships: [],
  };
  res.json(GetInvestigationResponse.parse(response));
});

router.get("/network", (_req, res): void => {
  const nodes = companies.slice(0, 18).map((company, index) => ({ id: company.id, label: company.canonicalName, participationCount: company.tendersParticipated, x: 120 + (index % 6) * 150, y: 110 + Math.floor(index / 6) * 145 }));
  const edges = Array.from({ length: 24 }, (_, index) => ({ source: nodes[index % nodes.length].id, target: nodes[(index * 3 + 4) % nodes.length].id, sharedTenderCount: 2 + (index % 7) })).filter((edge) => edge.source !== edge.target);
  res.json(GetNetworkResponse.parse({ nodes, edges }));
});

router.post("/data/upload", (req, res): void => {
  const parsed = UploadDataBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.message });
    return;
  }
  const { headers, rows } = parseCsv(parsed.data.content);
  const mapping = detectColumnMapping(headers);
  datasetPreviews.set(parsed.data.filename, { filename: parsed.data.filename, headers, rows, mapping });
  res.json(UploadDataResponse.parse({ filename: parsed.data.filename, headers, rows: rows.slice(0, 50), rowCount: rows.length, columnCount: headers.length, mapping }));
});

router.post("/data/validate", async (req, res): Promise<void> => {
  const parsed = ValidateDataBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.message });
    return;
  }
  const report = validateRows(parsed.data.rows, parsed.data.mapping);
  const datasetId = datasets.find((dataset) => dataset.filename === parsed.data.filename)?.id ?? nextDatasetId++;
  if (!datasets.some((dataset) => dataset.id === datasetId)) {
    datasets.push({ id: datasetId, filename: parsed.data.filename, source: "CSV upload", uploadedAt: new Date(), totalRows: report.rows, qualityScore: report.qualityScore, status: "Validating", companies: 0, tenders: 0, validRows: report.validRows, warningRows: report.warningRows, errorRows: report.errorRows, errors: report.issues });
  }
  datasetReports.set(datasetId, report);
  await createImportBatch(parsed.data.filename, report);
  res.json(ValidateDataResponse.parse(report));
});

router.post("/data/clean", (req, res): void => {
  const parsed = CleanDataBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.message });
    return;
  }
  res.json(CleanDataResponse.parse(cleanRows(parsed.data.rows, parsed.data.mapping)));
});

router.post("/data/resolve-entities", (req, res): void => {
  const parsed = ResolveEntitiesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.message });
    return;
  }
  const result = resolveEntities(parsed.data.rows);
  entityMatches = result.matches;
  res.json(ResolveEntitiesResponse.parse(result));
});

router.post("/data/import", async (req, res): Promise<void> => {
  const parsed = ImportDataBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.message });
    return;
  }
  const importIssues = parsed.data.rows.flatMap((row, index) => {
    const rowNumber = index + 2;
    const issues: Array<{ row: number; code: string; message: string; severity: "warning" | "error" }> = [];
    if (!String(row.tenderNumber ?? "").trim()) issues.push({ row: rowNumber, code: "MISSING_TENDER_ID", message: "Tender ID or tender number is missing.", severity: "error" });
    if (!String(row.companyName ?? row.companyNameOriginal ?? "").trim()) issues.push({ row: rowNumber, code: "MISSING_COMPANY_NAME", message: "Bidder or company name is missing.", severity: "error" });
    if (typeof row.bidAmount !== "number" || !Number.isFinite(row.bidAmount) || row.bidAmount <= 0) issues.push({ row: rowNumber, code: "INVALID_BID_AMOUNT", message: "Normalized bid amount is missing or invalid.", severity: "error" });
    return issues;
  });
  const importErrorRows = new Set(importIssues.filter((issue) => issue.severity === "error").map((issue) => issue.row)).size;
  const report = {
    rows: parsed.data.rows.length,
    validRows: parsed.data.rows.length - importErrorRows,
    warningRows: 0,
    errorRows: importErrorRows,
    duplicates: 0,
    qualityScore: parsed.data.rows.length === 0 ? 0 : Math.round(((parsed.data.rows.length - importErrorRows) / parsed.data.rows.length) * 100),
    issues: importIssues,
  };
  const id = datasets.find((dataset) => dataset.filename === parsed.data.filename)?.id ?? nextDatasetId++;
  const dataset = {
    id,
    filename: parsed.data.filename,
    source: "CSV upload",
    uploadedAt: new Date(),
    totalRows: parsed.data.rows.length,
    qualityScore: report.qualityScore,
    status: "Imported" as const,
    companies: new Set(parsed.data.rows.map((row) => normalizeCompanyName(String(row.companyName ?? row.companyNameOriginal ?? ""))).filter(Boolean)).size,
    tenders: new Set(parsed.data.rows.map((row) => String(row.tenderNumber ?? "")).filter(Boolean)).size,
    validRows: report.validRows,
    warningRows: report.warningRows,
    errorRows: report.errorRows,
    errors: report.issues,
  };
  const existingIndex = datasets.findIndex((item) => item.id === id);
  if (existingIndex >= 0) datasets[existingIndex] = dataset;
  else datasets.push(dataset);
  const batchId = await createImportBatch(parsed.data.filename, report);
  void batchId;
  res.json(ImportDataResponse.parse({ dataset, processedRows: report.rows, importedRows: report.validRows, warnings: report.warningRows, errors: report.errorRows, companiesResolved: entityMatches.filter((match) => match.status === "AUTO_MATCHED" || match.status === "CONFIRMED").length, companiesCreated: entityMatches.filter((match) => match.status === "UNRESOLVED").length }));
});

router.get("/data/datasets", (_req, res): void => {
  res.json(GetDatasetsResponse.parse(datasets.map(({ validRows: _validRows, warningRows: _warningRows, errorRows: _errorRows, errors: _errors, ...dataset }) => dataset)));
});

router.get("/data/datasets/:id", (req, res): void => {
  const params = GetDatasetParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ success: false, error: params.error.message });
    return;
  }
  const dataset = datasets.find((item) => item.id === params.data.id);
  if (!dataset) {
    res.status(404).json({ success: false, error: "Dataset not found" });
    return;
  }
  res.json(GetDatasetResponse.parse(dataset));
});

router.get("/data/entities/review", (_req, res): void => {
  res.json(GetEntityReviewResponse.parse(entityMatches));
});

router.post("/data/entities/:id/confirm", (req, res): void => {
  const params = ConfirmEntityParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ success: false, error: params.error.message });
    return;
  }
  const match = entityMatches.find((item) => item.id === params.data.id);
  if (!match) {
    res.status(404).json({ success: false, error: "Entity match not found" });
    return;
  }
  match.status = "CONFIRMED";
  res.json(ConfirmEntityResponse.parse(match));
});

router.post("/data/entities/:id/reject", (req, res): void => {
  const params = RejectEntityParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ success: false, error: params.error.message });
    return;
  }
  const match = entityMatches.find((item) => item.id === params.data.id);
  if (!match) {
    res.status(404).json({ success: false, error: "Entity match not found" });
    return;
  }
  match.status = "REJECTED";
  res.json(RejectEntityResponse.parse(match));
});

router.post("/data/entities/create", (req, res): void => {
  const parsed = CreateEntityBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.message });
    return;
  }
  const match = { id: entityMatches.length + 1, sourceName: parsed.data.sourceName, suggestedCompany: parsed.data.canonicalName, confidence: 100, status: "CONFIRMED" as const, nameSimilarity: 100, addressSimilarity: null, source: "manual" };
  entityMatches.push(match);
  res.status(201).json(CreateEntityResponse.parse(match));
});

export default router;