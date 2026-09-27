import { Router, type IRouter } from "express";
import {
  AnalyzeTenderParams,
  AnalyzeTenderResponse,
  AnalyzeTenderPriceClusteringParams,
  AnalyzeTenderPriceClusteringResponse,
  CleanDataBody,
  CleanDataResponse,
  ConfirmEntityParams,
  ConfirmEntityResponse,
  CreateEntityBody,
  CreateEntityResponse,
  GetCompaniesQueryParams,
  GetCompaniesResponse,
  GetCompanyParams,
  GetCompanyPatternsParams,
  GetCompanyPatternsResponse,
  GetCompanyPricePatternsParams,
  GetCompanyPricePatternsResponse,
  GetCompanyResponse,
  GetCompanyRotationAnalyticsParams,
  GetCompanyRotationAnalyticsResponse,
  GetCoverBidAnalyticsResponse,
  GetDashboardSummaryResponse,
  GetDatasetParams,
  GetDatasetResponse,
  GetDatasetsResponse,
  GetEntityReviewResponse,
  GetInvestigationParams,
  GetInvestigationResponse,
  GetInvestigationsResponse,
  GetNetworkResponse,
  GetPriceClusteringAnalyticsResponse,
  GetRotationAnalyticsResponse,
  GetTenderAnalyticsEvidenceParams,
  GetTenderAnalyticsEvidenceResponse,
  GetTenderAnalyticsParams,
  GetTenderAnalyticsResponse,
  GetTenderParams,
  GetTenderPriceClusteringParams,
  GetTenderPriceClusteringResponse,
  GetTenderResponse,
  GetTendersQueryParams,
  GetTendersResponse,
  ImportDataBody,
  ImportDataResponse,
  RecalculateAnalyticsBody,
  RecalculateAnalyticsResponse,
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
  persistAndProcessImportedCsv,
  detectColumnMapping,
  ensureDemoDatabase,
  runDemoAnalytics,
  getDemoStatus,
  DEMO_DATASET_INFO,
  investigations,
  normalizeCompanyName,
  parseCsv,
  resolveEntities,
  tenders,
  validateRows,
  type ColumnMapping,
  type CsvRow,
} from "../lib/bidshieldData";
import { analyticsService, investigationService, TenderAnalytics } from "../analytics";
import { config, maskKey, verifyAnalyticsApiKey, verifyEntityResolutionKey } from "../lib/env";
import { uploadRateLimiter, recalcRateLimiter } from "../lib/security.js";
import { extractUser } from "../middlewares/auth.js";
import {
  entityResolutionService,
  SYNTHETIC_ENTITY_TEST_CASES,
  scoreMatch,
  normalizeCompany,
} from "../entity-resolution/index.js";

const router: IRouter = Router();

// ==========================================
// SYSTEM INTEGRATION & SERVICE STATUS
// ==========================================

router.get("/system/integrations", (req, res): void => {
  const analyticsAuth = verifyAnalyticsApiKey(req);
  const entityAuth = verifyEntityResolutionKey(req);
  res.json({
    success: true,
    services: {
      entityResolution: {
        name: "Entity Resolution Service",
        status: "ACTIVE",
        configured: Boolean(config.entityResolutionServiceKey),
        keyMasked: maskKey(config.entityResolutionServiceKey),
        authenticated: entityAuth.valid,
        version: "v1.0",
        scope: "Phase 2 Automated entity resolution, deduplication, phonetic matching"
      },
      analyticsApi: {
        name: "BidShield Analytics API",
        status: "ACTIVE",
        configured: Boolean(config.analyticsApiKey),
        keyMasked: maskKey(config.analyticsApiKey),
        authenticated: analyticsAuth.valid,
        version: "v1.0",
        engines: [
          "Price Clustering Engine (v1.0)",
          "Winner Rotation Engine (v1.0)",
          "Cover-Bid Engine (v1.0)",
          "Participation Network Engine (v1.0)",
          "Too-Neat Losing Bid Engine (v1.0)"
        ],
        methodologyVersion: "neat_losing_bid_v1.0"
      }
    }
  });
});

// ==========================================
// DEMO DATASET ENDPOINTS
// ==========================================

/**
 * GET /api/demo/status — Returns synthetic demo dataset status and metadata
 */
router.get("/demo/status", async (_req, res): Promise<void> => {
  await ensureDemoDatabase();
  const status = getDemoStatus();
  res.json({
    success: true,
    ...status,
    datasetLabel: "SYNTHETIC DEMO DATA",
    disclaimer: DEMO_DATASET_INFO.disclaimer,
  });
});

/**
 * GET /api/demo/info — Returns detailed dataset information panel
 */
router.get("/demo/info", (_req, res): void => {
  res.json({
    success: true,
    dataset: DEMO_DATASET_INFO,
    dataType: "Synthetic",
    realWorldData: false,
    usedFor: [
      "Analytics demonstration",
      "Risk-screening demonstration",
      "Investigation workflow demonstration",
      "AI assistant demonstration",
    ],
    disclaimer: DEMO_DATASET_INFO.disclaimer,
  });
});

/**
 * POST /api/demo/run-screening — Runs the full analytics pipeline against demo data
 */
router.post("/demo/run-screening", recalcRateLimiter, async (_req, res): Promise<void> => {
  try {
    await ensureDemoDatabase();
    const result = await runDemoAnalytics();
    res.json({
      success: true,
      message: "Screening pipeline completed successfully.",
      analyzed: result.analyzed,
      flagged: result.flagged,
      investigationsCreated: getDemoStatus().investigationsCount,
      calculatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || "Screening pipeline failed." });
  }
});

/**
 * POST /api/demo/reset — Resets demo data (admin only). Requires confirmation.
 */
router.post("/demo/reset", async (req, res): Promise<void> => {
  const user = req.user;
  if (!user || user.role !== "admin") {
    res.status(403).json({ success: false, error: "Only administrators can reset demo data." });
    return;
  }
  const { confirm } = req.body || {};
  if (confirm !== "RESET_DEMO_DATA") {
    res.status(400).json({ success: false, error: "Please send { confirm: 'RESET_DEMO_DATA' } to confirm." });
    return;
  }
  // In the current architecture, demo data is generated in-memory at startup.
  // A full reset would require server restart. Return a meaningful message.
  res.json({
    success: true,
    message: "Demo dataset is generated at server startup. Restart the server to reset demo data.",
  });
});

router.get("/analytics/status", (req, res): void => {
  const auth = verifyAnalyticsApiKey(req);
  res.json({
    status: "ACTIVE",
    service: "BidShield Analytics API",
    version: "v1.0",
    keyConfigured: Boolean(config.analyticsApiKey),
    keyMasked: maskKey(config.analyticsApiKey),
    requestAuthenticated: auth.valid,
    engines: {
      priceClustering: "price_clustering_v1.0",
      winnerRotation: "v1.0",
      coverBid: "v1.0",
      participationNetwork: "participation_network_v1.0",
      neatLoss: "neat_losing_bid_v1.0",
      combinedRisk: "combined_risk_v1.0"
    }
  });
});

router.get("/data/entities/status", (req, res): void => {
  const auth = verifyEntityResolutionKey(req);
  res.json({
    service: "Entity Resolution Service",
    status: "ACTIVE",
    configured: Boolean(config.entityResolutionServiceKey),
    keyMasked: maskKey(config.entityResolutionServiceKey),
    authenticated: auth.valid,
    algorithm: "Legal-suffix normalization, phonetic token matching & Levenshtein similarity",
    thresholds: {
      autoMatch: 100,
      reviewRequired: 85,
      unresolved: "< 85"
    }
  });
});
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
}> = [
  {
    id: 1,
    filename: "bidshield-synthetic-demo-v1.0.csv",
    source: "synthetic-demo",
    uploadedAt: new Date("2025-01-15T08:00:00.000Z"),
    totalRows: 400,
    qualityScore: 98.5,
    status: "Imported",
    companies: 50,
    tenders: 100,
    validRows: 400,
    warningRows: 0,
    errorRows: 0,
    errors: [],
  },
];
let nextDatasetId = 2;

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

const asDate = (value: string | null) => (value ? new Date(`${value}T00:00:00.000Z`) : null);

const tenderSummary = (tender: (typeof tenders)[number]) => ({
  id: tender.id,
  tenderNumber: tender.tenderNumber,
  title: tender.title,
  organization: tender.organization,
  department: tender.department,
  category: tender.category,
  location: tender.location,
  state: tender.state,
  tenderDate: asDate(tender.tenderDate)!,
  closingDate: asDate(tender.closingDate)!,
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

function formatAnalyticsResponse(analytics: TenderAnalytics) {
  return {
    ...analytics,
    comparisonScope: {
      ...analytics.comparisonScope,
      startDate: new Date(`${analytics.comparisonScope.startDate}T00:00:00.000Z`),
      endDate: new Date(`${analytics.comparisonScope.endDate}T00:00:00.000Z`),
    },
    winnerRotation: {
      ...analytics.winnerRotation,
      calculatedAt: new Date(analytics.winnerRotation.calculatedAt),
    },
    coverBid: {
      ...analytics.coverBid,
      calculatedAt: new Date(analytics.coverBid.calculatedAt),
    },
    priceClustering: {
      ...analytics.priceClustering,
      calculatedAt: new Date(analytics.priceClustering.calculatedAt),
    },
    calculatedAt: new Date(analytics.calculatedAt),
  };
}

router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  await ensureDemoDatabase();
  const categories = [...new Set(tenders.map((tender) => tender.category))].map((category) =>
    chart(
      category,
      tenders.filter((tender) => tender.category === category).reduce((sum, tender) => sum + tender.estimatedValue, 0)
    )
  );
  const stateCounts = [...new Set(tenders.map((tender) => tender.state))].map((state) =>
    chart(state, tenders.filter((tender) => tender.state === state).length)
  );
  const screeningDistribution = ["Low", "Moderate", "Elevated"].map((level) =>
    chart(level, tenders.filter((tender) => tender.screeningLevel === level).length)
  );

  const screeningAnalytics = await analyticsService.getDashboardSummaryAnalytics();

  const response = {
    totalTenders: tenders.length,
    totalCompanies: companies.length,
    totalBids: tenders.reduce((sum, tender) => sum + tender.bids.length, 0),
    reviewCount: tenders.filter((tender) => tender.screeningLevel !== "Low").length,
    tenderVolume: Array.from({ length: 12 }, (_, index) =>
      chart(
        new Date(2025, index, 1).toLocaleString("en-IN", { month: "short" }),
        tenders.filter((tender) => Number(tender.tenderDate.slice(5, 7)) === index + 1).length
      )
    ),
    categoryValues: categories,
    stateCounts,
    screeningDistribution,
    recentInvestigations: investigations
      .slice(0, 5)
      .map((item) => ({ ...item, lastAnalyzed: item.lastAnalyzed ? new Date(item.lastAnalyzed) : null })),
    screeningAnalytics,
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
    return (
      (!search || haystack.includes(search.toLowerCase())) &&
      (!category || tender.category === category) &&
      (!state || tender.state === state) &&
      (!screening || screening === "All" || tender.screeningLevel === screening)
    );
  });
  const response = {
    items: filtered.slice((page - 1) * pageSize, page * pageSize).map(tenderSummary),
    total: filtered.length,
    page,
    pageSize,
  };
  res.json(GetTendersResponse.parse(response));
});

router.get("/tenders/:id", async (req, res): Promise<void> => {
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

  const analytics = await analyticsService.getTenderAnalytics(tender.id);

  const evidence = analytics
    ? analytics.evidence.map((e) => ({
        id: e.id,
        indicatorType: e.indicatorType,
        description: e.description,
        metric: e.metric,
        observedValue: e.observedValue,
        expectedValue: e.expectedValue,
        severity: e.severity,
        confidence: e.confidence,
      }))
    : [];

  const response = {
    ...tenderSummary(tender),
    bids: tender.bids,
    screening: {
      overall: tender.screeningLevel,
      rotation: analytics?.winnerRotation.score ?? null,
      coverBid: analytics?.coverBid.score ?? null,
      priceClustering: analytics?.priceClustering?.score ?? null,
      network: analytics?.participationNetwork?.score ?? null,
      neatLoss: analytics?.neatLoss?.score ?? null,
    },
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
  const filtered = companies.filter(
    (company) =>
      (!search || company.canonicalName.toLowerCase().includes(search.toLowerCase())) &&
      (!state || company.state === state) &&
      (!screening || screening === "All" || company.screeningLevel === screening)
  );
  res.json(
    GetCompaniesResponse.parse({
      items: filtered.slice((page - 1) * pageSize, page * pageSize).map(companySummary),
      total: filtered.length,
      page,
      pageSize,
    })
  );
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
    totalBidValue: participated.reduce(
      (sum, tender) => sum + (tender.bids.find((bid) => bid.companyId === company.id)?.bidAmount ?? 0),
      0
    ),
    participationOverTime: Array.from({ length: 6 }, (_, index) =>
      chart(`M${index + 1}`, Math.max(1, Math.round(participated.length / 6) + (index % 2)))
    ),
    winsOverTime: Array.from({ length: 6 }, (_, index) =>
      chart(`M${index + 1}`, Math.max(0, Math.round(wins / 6) + (index === 2 ? 1 : 0)))
    ),
    frequentCoParticipants: companies
      .filter((other) => other.id !== company.id)
      .slice(company.id % 4, (company.id % 4) + 4)
      .map(companySummary),
  };
  res.json(GetCompanyResponse.parse(response));
});

// ==========================================
// Phase 8: Investigation Workspace & Review Queue APIs
// ==========================================

router.get("/investigations", async (req, res): Promise<void> => {
  try {
    const filters = {
      status: req.query.status as string | undefined,
      screeningLevel: req.query.screeningLevel as string | undefined,
      category: req.query.category as string | undefined,
      organization: req.query.organization as string | undefined,
      search: req.query.search as string | undefined,
      watchlistOnly: req.query.watchlistOnly === "true",
      page: req.query.page ? Number(req.query.page) : 1,
      limit: req.query.limit ? Number(req.query.limit) : 50,
    };
    const result = await investigationService.listInvestigations(filters);
    if (req.query.format === "array") {
      res.json(result.items);
    } else {
      res.json(result);
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/investigations/summary", async (_req, res): Promise<void> => {
  try {
    const summary = await investigationService.getInvestigationSummary();
    res.json(summary);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/investigations/queue", async (req, res): Promise<void> => {
  try {
    const filters = {
      screeningLevel: req.query.screeningLevel as string | undefined,
      category: req.query.category as string | undefined,
      search: req.query.search as string | undefined,
      status: req.query.status as string | undefined,
    };
    const result = await investigationService.getInvestigationQueue(filters);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/investigations/:id", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ success: false, error: "Invalid investigation ID" });
      return;
    }

    const user = extractUser(req);
    if (user && !investigationService.canUserAccess(user.id, user.role, id)) {
      res.status(403).json({ success: false, error: "Forbidden: You do not have permission to access this investigation" });
      return;
    }

    const result = await investigationService.getInvestigationById(id);
    if (!result) {
      res.status(404).json({ success: false, error: `Investigation #${id} not found` });
      return;
    }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/investigations", async (req, res): Promise<void> => {
  try {
    const { tenderId, priority, notes, assignedTo, userName } = req.body || {};
    if (!tenderId || typeof tenderId !== "number") {
      res.status(400).json({ success: false, error: "tenderId is required and must be a number" });
      return;
    }

    const user = extractUser(req);
    const result = await investigationService.createInvestigation({
      tenderId,
      priority,
      notes,
      assignedTo: assignedTo || (user?.id ? user.id : "Senior Investigator"),
      userName: userName || user?.name || "Senior Investigator",
      userId: user?.id,
    });
    res.status(201).json(result);
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.patch("/investigations/:id", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const user = extractUser(req);
    if (user && !investigationService.canUserAccess(user.id, user.role, id)) {
      res.status(403).json({ success: false, error: "Forbidden: You do not have permission to modify this investigation" });
      return;
    }

    const { status, priority, assignedTo, notes, userName } = req.body || {};
    const result = await investigationService.updateInvestigation(id, {
      status,
      priority,
      assignedTo,
      notes,
      userName,
    });
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});


router.get("/investigations/:id/evidence", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const inv = await investigationService.getInvestigationById(id);
    if (!inv) {
      res.status(404).json({ success: false, error: `Investigation #${id} not found` });
      return;
    }
    res.json({
      investigationId: id,
      tenderId: inv.tenderId,
      tenderNumber: inv.tender.tenderNumber,
      evidenceTimeline: inv.evidenceTimeline,
      total: inv.evidenceTimeline.length,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/investigations/:id/bids", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const inv = await investigationService.getInvestigationById(id);
    if (!inv) {
      res.status(404).json({ success: false, error: `Investigation #${id} not found` });
      return;
    }
    res.json({
      investigationId: id,
      tenderId: inv.tenderId,
      tenderNumber: inv.tender.tenderNumber,
      bids: inv.bids,
      total: inv.bids.length,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/investigations/:id/companies", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const inv = await investigationService.getInvestigationById(id);
    if (!inv) {
      res.status(404).json({ success: false, error: `Investigation #${id} not found` });
      return;
    }
    res.json({
      investigationId: id,
      tenderId: inv.tenderId,
      companies: inv.participatingCompanies,
      total: inv.participatingCompanies.length,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/investigations/:id/network", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const inv = await investigationService.getInvestigationById(id);
    if (!inv) {
      res.status(404).json({ success: false, error: `Investigation #${id} not found` });
      return;
    }
    res.json(inv.network);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/investigations/:id/activity", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const inv = await investigationService.getInvestigationById(id);
    if (!inv) {
      res.status(404).json({ success: false, error: `Investigation #${id} not found` });
      return;
    }
    res.json({
      investigationId: id,
      activities: inv.activities,
      total: inv.activities.length,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/investigations/:id/notes", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const inv = await investigationService.getInvestigationById(id);
    if (!inv) {
      res.status(404).json({ success: false, error: `Investigation #${id} not found` });
      return;
    }
    res.json(inv.notesList);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/investigations/:id/notes", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const { note, userId, userName } = req.body || {};
    if (!note || typeof note !== "string" || !note.trim()) {
      res.status(400).json({ success: false, error: "Note content is required" });
      return;
    }
    const noteItem = await investigationService.addNote(id, note, { userId, userName });
    res.status(201).json(noteItem);
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.patch("/investigations/:id/notes/:noteId", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const noteId = Number(req.params.noteId);
    const { note, userName } = req.body || {};
    if (!note || typeof note !== "string" || !note.trim()) {
      res.status(400).json({ success: false, error: "Updated note content is required" });
      return;
    }
    const updated = await investigationService.editNote(id, noteId, note, userName);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.delete("/investigations/:id/notes/:noteId", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const noteId = Number(req.params.noteId);
    const userName = req.body?.userName as string | undefined;
    const success = await investigationService.deleteNote(id, noteId, userName);
    res.json({ success });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post("/investigations/:id/watchlist", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const { notes, userName } = req.body || {};
    const success = await investigationService.addToWatchlist(id, notes, userName);
    res.json({ success, isWatchlisted: true });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.delete("/investigations/:id/watchlist", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const userName = req.body?.userName as string | undefined;
    const success = await investigationService.removeFromWatchlist(id, userName);
    res.json({ success, isWatchlisted: false });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get("/investigations/:id/export", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const format = req.query.format === "csv" ? "csv" : "html";
    const lang = (req.query.lang || req.query.language || "en") as string;
    const exported = await investigationService.exportInvestigation(id, format, lang);
    res.setHeader("Content-Type", exported.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${exported.filename}"`);
    res.send(exported.content);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/network", async (req, res): Promise<void> => {
  const overall = await analyticsService.getOverallNetwork();
  const nodes = overall.bipartiteGraph.companyNodes.map((c) => ({
    id: c.id,
    label: c.canonicalName,
    participationCount: c.participationCount,
    x: c.x ?? 100,
    y: c.y ?? 100,
  }));
  const edges = overall.bipartiteGraph.coParticipationEdges.map((e) => ({
    source: e.source,
    target: e.target,
    sharedTenderCount: e.sharedTenderCount,
  }));
  res.json({
    ...GetNetworkResponse.parse({ nodes, edges }),
    bipartiteGraph: overall.bipartiteGraph,
    summaryStatistics: overall.summaryStatistics,
    topRecurringPairs: overall.topRecurringPairs,
    recurringBidderGroups: overall.recurringBidderGroups,
    networkIndicatorsCount: overall.networkIndicatorsCount,
    calculatedAt: overall.calculatedAt,
    methodologyVersion: overall.methodologyVersion,
  });
});

// ==========================================
// PHASE 3: SCREENING ANALYTICS ENDPOINTS
// ==========================================

router.post("/analytics/tenders/:id/analyze", async (req, res): Promise<void> => {
  const params = AnalyzeTenderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ success: false, error: params.error.message });
    return;
  }
  const analytics = await analyticsService.analyzeTender(params.data.id);
  if (!analytics) {
    res.status(404).json({ success: false, error: "Tender not found" });
    return;
  }
  res.json(AnalyzeTenderResponse.parse(formatAnalyticsResponse(analytics)));
});

router.get("/analytics/tenders/:id", async (req, res): Promise<void> => {
  const params = GetTenderAnalyticsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ success: false, error: params.error.message });
    return;
  }
  const analytics = await analyticsService.getTenderAnalytics(params.data.id);
  if (!analytics) {
    res.status(404).json({ success: false, error: "Tender not found" });
    return;
  }
  res.json(GetTenderAnalyticsResponse.parse(formatAnalyticsResponse(analytics)));
});

router.get("/analytics/tenders/:id/evidence", async (req, res): Promise<void> => {
  const params = GetTenderAnalyticsEvidenceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ success: false, error: params.error.message });
    return;
  }
  const evidence = await analyticsService.getTenderEvidence(params.data.id);
  res.json(GetTenderAnalyticsEvidenceResponse.parse(evidence));
});

router.get("/analytics/rotation", async (_req, res): Promise<void> => {
  const rotationList = await analyticsService.getRotationAnalytics();
  res.json(GetRotationAnalyticsResponse.parse(rotationList));
});

router.get("/analytics/rotation/:companyId", async (req, res): Promise<void> => {
  const params = GetCompanyRotationAnalyticsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ success: false, error: params.error.message });
    return;
  }
  const rotationList = await analyticsService.getCompanyRotationAnalytics(params.data.companyId);
  res.json(GetCompanyRotationAnalyticsResponse.parse(rotationList));
});

router.get("/analytics/cover-bid", async (_req, res): Promise<void> => {
  const coverBidList = await analyticsService.getCoverBidAnalytics();
  res.json(GetCoverBidAnalyticsResponse.parse(coverBidList));
});

router.get("/analytics/price-clustering", async (_req, res): Promise<void> => {
  const priceClusteringList = await analyticsService.getPriceClusteringAnalytics();
  res.json(GetPriceClusteringAnalyticsResponse.parse(priceClusteringList));
});

router.post("/analytics/tenders/:id/price-clustering", async (req, res): Promise<void> => {
  const params = AnalyzeTenderPriceClusteringParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ success: false, error: params.error.message });
    return;
  }
  const result = await analyticsService.getTenderPriceClustering(params.data.id);
  if (!result) {
    res.status(404).json({ success: false, error: "Tender not found" });
    return;
  }
  res.json(
    AnalyzeTenderPriceClusteringResponse.parse({
      ...result.indicator,
      calculatedAt: new Date(result.indicator.calculatedAt),
    })
  );
});

router.get("/analytics/tenders/:id/price-clustering", async (req, res): Promise<void> => {
  const params = GetTenderPriceClusteringParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ success: false, error: params.error.message });
    return;
  }
  const result = await analyticsService.getTenderPriceClustering(params.data.id);
  if (!result) {
    res.status(404).json({ success: false, error: "Tender not found" });
    return;
  }
  res.json(
    GetTenderPriceClusteringResponse.parse({
      ...result.indicator,
      calculatedAt: new Date(result.indicator.calculatedAt),
    })
  );
});

router.get("/analytics/companies/:id/patterns", async (req, res): Promise<void> => {
  const params = GetCompanyPatternsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ success: false, error: params.error.message });
    return;
  }
  const patterns = await analyticsService.getCompanyPatterns(params.data.id);
  if (!patterns) {
    res.status(404).json({ success: false, error: "Company not found" });
    return;
  }
  res.json(GetCompanyPatternsResponse.parse(patterns));
});

router.get("/analytics/companies/:id/price-patterns", async (req, res): Promise<void> => {
  const params = GetCompanyPricePatternsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ success: false, error: params.error.message });
    return;
  }
  const patterns = await analyticsService.getCompanyPricePatterns(params.data.id);
  if (!patterns) {
    res.status(404).json({ success: false, error: "Company not found" });
    return;
  }
  res.json(GetCompanyPricePatternsResponse.parse(patterns));
});

router.post("/analytics/recalculate", recalcRateLimiter, async (req, res): Promise<void> => {
  const auth = verifyAnalyticsApiKey(req);
  if (auth.provided && !auth.valid) {
    res.status(401).json({ success: false, error: "Unauthorized: Invalid Analytics API Key" });
    return;
  }
  const parsed = RecalculateAnalyticsBody.safeParse(req.body ?? {});
  const tenderIds = parsed.success ? parsed.data.tenderIds : undefined;
  const result = await analyticsService.recalculate(tenderIds);
  res.json(
    RecalculateAnalyticsResponse.parse({
      ...result,
      calculatedAt: new Date(result.calculatedAt),
    })
  );
});

// ==========================================
// PHASE 5: PARTICIPATION NETWORK ENDPOINTS
// ==========================================

router.get("/analytics/network", async (req, res): Promise<void> => {
  const { category, organization, state, startDate, endDate, minParticipationFrequency, minSharedTenders } = req.query;
  const filters = {
    category: typeof category === "string" ? category : undefined,
    organization: typeof organization === "string" ? organization : undefined,
    state: typeof state === "string" ? state : undefined,
    startDate: typeof startDate === "string" ? startDate : undefined,
    endDate: typeof endDate === "string" ? endDate : undefined,
    minParticipationFrequency: minParticipationFrequency ? Number(minParticipationFrequency) : undefined,
    minSharedTenders: minSharedTenders ? Number(minSharedTenders) : undefined,
  };
  const result = await analyticsService.getOverallNetwork(filters);
  res.json(result);
});

router.get("/analytics/network/companies/:companyId", async (req, res): Promise<void> => {
  const companyId = parseInt(req.params.companyId, 10);
  if (isNaN(companyId)) {
    res.status(400).json({ success: false, error: "Invalid company ID" });
    return;
  }
  const result = await analyticsService.getCompanyNetwork(companyId);
  if (!result) {
    res.status(404).json({ success: false, error: "Company not found" });
    return;
  }
  res.json(result);
});

router.get("/analytics/network/companies/:companyAId/:companyBId", async (req, res): Promise<void> => {
  const companyAId = parseInt(req.params.companyAId, 10);
  const companyBId = parseInt(req.params.companyBId, 10);
  if (isNaN(companyAId) || isNaN(companyBId)) {
    res.status(400).json({ success: false, error: "Invalid company IDs" });
    return;
  }
  const result = await analyticsService.getCompanyRelationship(companyAId, companyBId);
  res.json(result);
});

router.get("/analytics/network/evidence", async (req, res): Promise<void> => {
  const { company, organization, category, state, startDate, endDate, minSharedTenders } = req.query;
  const filters = {
    company: typeof company === "string" ? company : undefined,
    organization: typeof organization === "string" ? organization : undefined,
    category: typeof category === "string" ? category : undefined,
    state: typeof state === "string" ? state : undefined,
    startDate: typeof startDate === "string" ? startDate : undefined,
    endDate: typeof endDate === "string" ? endDate : undefined,
    minSharedTenders: minSharedTenders ? Number(minSharedTenders) : undefined,
  };
  const result = await analyticsService.getNetworkEvidence(filters);
  res.json(result);
});

router.post("/analytics/network/recalculate", recalcRateLimiter, async (_req, res): Promise<void> => {
  const result = await analyticsService.recalculateNetwork();
  res.json({ success: true, ...result });
});

// ==========================================
// PHASE 6: TOO-NEAT LOSING BID ENDPOINTS
// ==========================================

router.get("/analytics/neat-loss", async (req, res): Promise<void> => {
  try {
    const { category, organization, state, minScore, status, search } = req.query;
    const filters = {
      category: typeof category === "string" ? category : undefined,
      organization: typeof organization === "string" ? organization : undefined,
      state: typeof state === "string" ? state : undefined,
      minScore: minScore ? Number(minScore) : undefined,
      status: typeof status === "string" ? status : undefined,
      search: typeof search === "string" ? search : undefined,
    };
    const result = await analyticsService.getNeatLossAnalytics(filters);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Internal error" });
  }
});

router.get("/analytics/neat-loss/companies/:companyId", async (req, res): Promise<void> => {
  try {
    const companyId = parseInt(req.params.companyId, 10);
    if (isNaN(companyId)) {
      res.status(400).json({ success: false, error: "Invalid company ID" });
      return;
    }
    const { category, organization, state } = req.query;
    const filters = {
      category: typeof category === "string" ? category : undefined,
      organization: typeof organization === "string" ? organization : undefined,
      state: typeof state === "string" ? state : undefined,
    };
    const result = await analyticsService.getCompanyNeatLoss(companyId, filters);
    if (!result) {
      res.status(404).json({ success: false, error: "Company not found" });
      return;
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Internal error" });
  }
});

router.get("/analytics/neat-loss/tenders/:tenderId", async (req, res): Promise<void> => {
  try {
    const tenderId = parseInt(req.params.tenderId, 10);
    if (isNaN(tenderId)) {
      res.status(400).json({ success: false, error: "Invalid tender ID" });
      return;
    }
    const result = await analyticsService.getTenderNeatLoss(tenderId);
    if (!result) {
      res.status(404).json({ success: false, error: "Tender not found" });
      return;
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Internal error" });
  }
});

router.get("/analytics/neat-loss/evidence", async (req, res): Promise<void> => {
  try {
    const { companyId, tenderId, category, organization, state, minConfidence } = req.query;
    const filters = {
      companyId: companyId ? Number(companyId) : undefined,
      tenderId: tenderId ? Number(tenderId) : undefined,
      category: typeof category === "string" ? category : undefined,
      organization: typeof organization === "string" ? organization : undefined,
      state: typeof state === "string" ? state : undefined,
      minConfidence: minConfidence ? Number(minConfidence) : undefined,
    };
    const result = await analyticsService.getNeatLossEvidence(filters);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Internal error" });
  }
});

router.post("/analytics/neat-loss/recalculate", async (req, res): Promise<void> => {
  const auth = verifyAnalyticsApiKey(req);
  if (auth.provided && !auth.valid) {
    res.status(401).json({ success: false, error: "Unauthorized: Invalid Analytics API Key" });
    return;
  }
  try {
    const result = await analyticsService.recalculateNeatLoss();
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Internal error" });
  }
});


// ==========================================
// PHASE 7: COMBINED RISK & EVIDENCE ENGINE
// ==========================================

router.get("/risk", async (req, res): Promise<void> => {
  try {
    const { category, organization, minScore, status, screeningLevel, search } = req.query;
    const filters = {
      category: typeof category === "string" ? category : undefined,
      organization: typeof organization === "string" ? organization : undefined,
      minScore: minScore ? Number(minScore) : undefined,
      status: typeof status === "string" ? status : undefined,
      screeningLevel: typeof screeningLevel === "string" ? screeningLevel : undefined,
      search: typeof search === "string" ? search : undefined,
    };
    const result = await analyticsService.getCombinedScreeningList(filters);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Internal error" });
  }
});

router.get("/risk/tenders/:tenderId", async (req, res): Promise<void> => {
  try {
    const tenderId = parseInt(req.params.tenderId, 10);
    if (isNaN(tenderId)) {
      res.status(400).json({ success: false, error: "Invalid tender ID" });
      return;
    }
    const result = await analyticsService.getCombinedScreeningForTender(tenderId);
    if (!result) {
      res.status(404).json({ success: false, error: "Tender combined screening not found" });
      return;
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Internal error" });
  }
});

router.get("/risk/companies/:companyId", async (req, res): Promise<void> => {
  try {
    const companyId = parseInt(req.params.companyId, 10);
    if (isNaN(companyId)) {
      res.status(400).json({ success: false, error: "Invalid company ID" });
      return;
    }
    const result = await analyticsService.getCombinedScreeningForCompany(companyId);
    if (!result) {
      res.status(404).json({ success: false, error: "Company combined screening not found" });
      return;
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Internal error" });
  }
});

router.get("/risk/:id/evidence", async (req, res): Promise<void> => {
  try {
    const evidence = await analyticsService.getCombinedScreeningEvidence(req.params.id);
    res.json({
      tenderId: Number(req.params.id),
      totalEvidenceCount: evidence.length,
      evidence,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Internal error" });
  }
});

router.get("/risk/:id/breakdown", async (req, res): Promise<void> => {
  try {
    const tenderId = parseInt(req.params.id, 10);
    if (isNaN(tenderId)) {
      res.status(400).json({ success: false, error: "Invalid tender ID" });
      return;
    }
    const result = await analyticsService.getCombinedScreeningBreakdown(tenderId);
    if (!result) {
      res.status(404).json({ success: false, error: "Screening breakdown not found" });
      return;
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Internal error" });
  }
});

router.post("/risk/recalculate", async (req, res): Promise<void> => {
  const auth = verifyAnalyticsApiKey(req);
  if (auth.provided && !auth.valid) {
    res.status(401).json({ success: false, error: "Unauthorized: Invalid Analytics API Key" });
    return;
  }
  try {
    const tenderIds = Array.isArray(req.body?.tenderIds) ? req.body.tenderIds : undefined;
    const result = await analyticsService.recalculateCombinedRisk(tenderIds);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Internal error" });
  }
});


// ==========================================
// DATA INTAKE & ENTITY RESOLUTION ENDPOINTS
// ==========================================

router.post("/data/upload", uploadRateLimiter, (req, res): void => {
  const parsed = UploadDataBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.message });
    return;
  }

  // Phase 18: File Upload Security Validation
  const filename = parsed.data.filename;
  // 1. Path traversal and illegal character check
  if (filename.includes("..") || filename.includes("/") || filename.includes("\\") || /[\x00-\x1f]/.test(filename)) {
    res.status(400).json({ success: false, error: "Invalid filename: Path traversal and special path characters are prohibited." });
    return;
  }

  // 2. Extension validation
  const lowerName = filename.toLowerCase();
  const allowedExtensions = [".csv", ".tsv", ".txt"];
  if (!allowedExtensions.some(ext => lowerName.endsWith(ext))) {
    res.status(400).json({ success: false, error: "Invalid file type: Only .csv, .tsv, and .txt files are supported." });
    return;
  }

  // 3. Prevent executable extensions
  const dangerousExtensions = [".exe", ".bat", ".cmd", ".sh", ".ps1", ".js", ".vbs", ".dll", ".bin"];
  if (dangerousExtensions.some(ext => lowerName.endsWith(ext))) {
    res.status(400).json({ success: false, error: "Security violation: Executable files are strictly prohibited." });
    return;
  }

  // 4. Maximum size limit (10MB)
  if (parsed.data.content.length > 10 * 1024 * 1024) {
    res.status(400).json({ success: false, error: "File too large: Maximum upload size is 10MB." });
    return;
  }

  const { headers, rows } = parseCsv(parsed.data.content);
  const mapping = detectColumnMapping(headers);
  datasetPreviews.set(parsed.data.filename, { filename: parsed.data.filename, headers, rows, mapping });
  res.json(
    UploadDataResponse.parse({
      filename: parsed.data.filename,
      headers,
      rows: rows.slice(0, 50),
      rowCount: rows.length,
      columnCount: headers.length,
      mapping,
    })
  );
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
    datasets.push({
      id: datasetId,
      filename: parsed.data.filename,
      source: "CSV upload",
      uploadedAt: new Date(),
      totalRows: report.rows,
      qualityScore: report.qualityScore,
      status: "Validating",
      companies: 0,
      tenders: 0,
      validRows: report.validRows,
      warningRows: report.warningRows,
      errorRows: report.errorRows,
      errors: report.issues,
    });
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

router.post("/data/resolve-entities", async (req, res): Promise<void> => {
  const auth = verifyEntityResolutionKey(req);
  if (auth.provided && !auth.valid) {
    res.status(401).json({ success: false, error: "Unauthorized: Invalid Entity Resolution Service Key" });
    return;
  }
  const parsed = ResolveEntitiesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.message });
    return;
  }
  const result = await entityResolutionService.resolveBatch(parsed.data.rows);
  entityMatches = result.matches as any;
  res.json(ResolveEntitiesResponse.parse(result));
});

router.post("/data/import", uploadRateLimiter, async (req, res): Promise<void> => {
  const parsed = ImportDataBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.message });
    return;
  }
  const importIssues = parsed.data.rows.flatMap((row, index) => {
    const rowNumber = index + 2;
    const issues: Array<{ row: number; code: string; message: string; severity: "warning" | "error" }> = [];
    if (!String(row.tenderNumber ?? "").trim())
      issues.push({ row: rowNumber, code: "MISSING_TENDER_ID", message: "Tender ID or tender number is missing.", severity: "error" });
    if (!String(row.companyName ?? row.companyNameOriginal ?? "").trim())
      issues.push({ row: rowNumber, code: "MISSING_COMPANY_NAME", message: "Bidder or company name is missing.", severity: "error" });
    if (typeof row.bidAmount !== "number" || !Number.isFinite(row.bidAmount) || row.bidAmount <= 0)
      issues.push({ row: rowNumber, code: "INVALID_BID_AMOUNT", message: "Normalized bid amount is missing or invalid.", severity: "error" });
    return issues;
  });
  const importErrorRows = new Set(importIssues.filter((issue) => issue.severity === "error").map((issue) => issue.row)).size;
  const report = {
    rows: parsed.data.rows.length,
    validRows: parsed.data.rows.length - importErrorRows,
    warningRows: 0,
    errorRows: importErrorRows,
    duplicates: 0,
    qualityScore:
      parsed.data.rows.length === 0
        ? 0
        : Math.round(((parsed.data.rows.length - importErrorRows) / parsed.data.rows.length) * 100),
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
    companies: new Set(
      parsed.data.rows
        .map((row) => normalizeCompanyName(String(row.companyName ?? row.companyNameOriginal ?? "")))
        .filter(Boolean)
    ).size,
    tenders: new Set(parsed.data.rows.map((row) => String(row.tenderNumber ?? "")).filter(Boolean)).size,
    validRows: report.validRows,
    warningRows: report.warningRows,
    errorRows: report.errorRows,
    errors: report.issues,
  };
  const existingIndex = datasets.findIndex((item) => item.id === id);
  if (existingIndex >= 0) datasets[existingIndex] = dataset;
  else datasets.push(dataset);

  // Store import batch, companies, tenders, and bids in PostgreSQL via DATABASE_URL
  const importResult = await persistAndProcessImportedCsv(parsed.data.filename, parsed.data.rows, report);
  if (importResult.processedCompaniesCount > 0) {
    dataset.companies = importResult.processedCompaniesCount;
  }
  if (importResult.newTenderIds.length > 0) {
    dataset.tenders = importResult.newTenderIds.length;
  }

  // Invalidate and recalculate analytics across newly imported data
  await analyticsService.recalculate();
  await analyticsService.recalculateNetwork();

  res.json(
    ImportDataResponse.parse({
      dataset,
      processedRows: report.rows,
      importedRows: report.validRows,
      warnings: report.warningRows,
      errors: report.errorRows,
      companiesResolved: entityMatches.filter(
        (match) => match.status === "AUTO_MATCHED" || match.status === "CONFIRMED"
      ).length,
      companiesCreated: entityMatches.filter((match) => match.status === "UNRESOLVED").length,
    })
  );
});

router.get("/data/datasets", (_req, res): void => {
  res.json(
    GetDatasetsResponse.parse(
      datasets.map(({ validRows: _validRows, warningRows: _warningRows, errorRows: _errorRows, errors: _errors, ...dataset }) => dataset)
    )
  );
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

router.get(["/data/entities/review", "/api/entity-resolution/review"], async (_req, res): Promise<void> => {
  const reviewQueue = entityResolutionService.getReviewQueue();
  const list = reviewQueue.length > 0 ? reviewQueue : entityMatches;
  res.json(GetEntityReviewResponse.parse(list));
});

router.post(["/data/entities/:id/confirm", "/api/entity-resolution/:id/confirm"], async (req, res): Promise<void> => {
  const params = ConfirmEntityParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ success: false, error: params.error.message });
    return;
  }
  const user = extractUser(req);
  const reviewerName = user?.name || "Senior Investigator";
  const confirmed = await entityResolutionService.confirmMatch(params.data.id, reviewerName, req.body?.reason);
  if (confirmed) {
    const memMatch = entityMatches.find((item) => item.id === params.data.id);
    if (memMatch) memMatch.status = "CONFIRMED";
    res.json(ConfirmEntityResponse.parse(confirmed));
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

router.post(["/data/entities/:id/reject", "/api/entity-resolution/:id/reject"], async (req, res): Promise<void> => {
  const params = RejectEntityParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ success: false, error: params.error.message });
    return;
  }
  const user = extractUser(req);
  const reviewerName = user?.name || "Senior Investigator";
  const rejected = await entityResolutionService.rejectMatch(params.data.id, reviewerName, req.body?.reason);
  if (rejected) {
    const memMatch = entityMatches.find((item) => item.id === params.data.id);
    if (memMatch) memMatch.status = "REJECTED";
    res.json(RejectEntityResponse.parse(rejected));
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

router.post(["/data/entities/create", "/api/entity-resolution/create"], async (req, res): Promise<void> => {
  const parsed = CreateEntityBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.message });
    return;
  }
  const user = extractUser(req);
  const reviewerName = user?.name || "Senior Investigator";
  const createdRecord = await entityResolutionService.createCanonicalCompany(
    parsed.data.sourceName,
    parsed.data.canonicalName,
    { address: req.body?.address, city: req.body?.city, state: req.body?.state },
    reviewerName
  );
  entityMatches.push(createdRecord as any);
  res.status(201).json(CreateEntityResponse.parse(createdRecord));
});

router.get(["/data/entities/stats", "/api/entity-resolution/stats"], async (_req, res): Promise<void> => {
  const stats = await entityResolutionService.getStats();
  res.json({ success: true, data: stats });
});

router.get(["/data/entities/duplicates", "/api/entity-resolution/duplicates"], async (_req, res): Promise<void> => {
  const duplicates = await entityResolutionService.detectDuplicates();
  res.json({ success: true, data: duplicates });
});

router.post(["/data/entities/recalculate", "/api/entity-resolution/recalculate"], async (_req, res): Promise<void> => {
  await analyticsService.recalculate();
  await analyticsService.recalculateNetwork();
  res.json({ success: true, message: "Downstream analytics reprocessed successfully with canonical entity mappings." });
});

router.get(["/data/entities/test-suite", "/api/entity-resolution/test-suite"], (_req, res): void => {
  const results = SYNTHETIC_ENTITY_TEST_CASES.map((tc) => {
    const normSource = normalizeCompany(tc.source.name, tc.source);
    const normCand = normalizeCompany(tc.candidate.canonicalName, tc.candidate);
    const scoreRes = scoreMatch(normSource, normCand);
    const passed =
      scoreRes.outcome === tc.expectedOutcome &&
      scoreRes.score >= tc.expectedMinScore &&
      scoreRes.score <= tc.expectedMaxScore;
    return {
      id: tc.id,
      category: tc.category,
      description: tc.description,
      source: tc.source.name,
      candidate: tc.candidate.canonicalName,
      expectedOutcome: tc.expectedOutcome,
      actualOutcome: scoreRes.outcome,
      expectedMinScore: tc.expectedMinScore,
      expectedMaxScore: tc.expectedMaxScore,
      actualScore: scoreRes.score,
      reasons: scoreRes.signals.reasons,
      passed,
    };
  });
  const allPassed = results.every((r) => r.passed);
  res.json({
    success: true,
    totalTests: results.length,
    passedTests: results.filter((r) => r.passed).length,
    failedTests: results.filter((r) => !r.passed).length,
    status: allPassed ? "ALL_TESTS_PASSED" : "TESTS_FAILED",
    results,
  });
});

export default router;