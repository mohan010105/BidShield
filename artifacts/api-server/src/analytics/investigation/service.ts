import {
  BidComparisonItem,
  CoParticipationSummary,
  InvestigationActivityItem,
  InvestigationDashboardSummary,
  InvestigationDataLineage,
  InvestigationDetailResult,
  InvestigationItem,
  InvestigationNoteItem,
  InvestigationNetworkSubgraph,
  InvestigationPriority,
  InvestigationQueueItem,
  InvestigationStatus,
  ParticipatingCompanyHistory,
} from "./types";
import { analyticsService } from "../service";
import { companies, DemoTender, tenders } from "../../lib/bidshieldData";
import { db, investigationsTable, investigationNotesTable, investigationActivityTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";

interface StoredInvestigationRecord {
  id: number;
  tenderId: number;
  status: InvestigationStatus;
  priority: InvestigationPriority;
  assignedTo: string;
  title: string;
  notes: string | null;
  isWatchlisted: boolean;
  watchlistNotes: string | null;
  createdBy: string;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface StoredNoteRecord {
  id: number;
  investigationId: number;
  userId: string;
  userName: string;
  note: string;
  createdAt: string;
  updatedAt: string;
}

interface StoredActivityRecord {
  id: number;
  investigationId: number;
  userId: string;
  userName: string;
  action: string;
  previousValue: string | null;
  newValue: string | null;
  metadata: string | null;
  createdAt: string;
}

export class InvestigationService {
  private inMemoryInvestigations: Map<number, StoredInvestigationRecord> = new Map();
  private inMemoryNotes: Map<number, StoredNoteRecord[]> = new Map();
  private inMemoryActivities: Map<number, StoredActivityRecord[]> = new Map();
  private nextInvestigationId = 1;
  private nextNoteId = 1;
  private nextActivityId = 1;
  private initialized = false;

  constructor() {
    this.seedInitialWorkspaces();
  }

  /**
   * Initializes pre-populated investigation records for elevated/flagged tenders.
   */
  private seedInitialWorkspaces(): void {
    if (this.initialized) return;

    // Filter tenders with elevated or moderate screening signal from the demo corpus
    const flagged = tenders.filter(
      (t) => t.screeningLevel === "Elevated" || t.screeningLevel === "Moderate"
    );

    const initialTenders = flagged.slice(0, 16);

    initialTenders.forEach((tender, idx) => {
      const invId = idx + 1;
      const status: InvestigationStatus =
        idx % 4 === 0 ? "IN_REVIEW" : idx % 4 === 1 ? "OPEN" : idx % 4 === 2 ? "WATCHLIST" : "CLOSED";
      const priority: InvestigationPriority =
        tender.screeningLevel === "Elevated" ? "HIGH" : idx % 2 === 0 ? "MEDIUM" : "LOW";
      const isWatchlisted = status === "WATCHLIST" || idx === 3;

      const record: StoredInvestigationRecord = {
        id: invId,
        tenderId: tender.id,
        status,
        priority,
        assignedTo: idx % 2 === 0 ? "R. Sharma (Senior Investigator)" : "A. Verma (Procurement Auditor)",
        title: `Investigation: ${tender.tenderNumber} - ${tender.title}`,
        notes: `Initial review opened based on ${tender.screeningLevel} statistical screening signal observed in procurement data.`,
        isWatchlisted,
        watchlistNotes: isWatchlisted ? "Marked for longitudinal co-bidding cohort follow-up." : null,
        createdBy: "system",
        closedAt: status === "CLOSED" ? "2026-09-20T14:30:00.000Z" : null,
        createdAt: `2026-09-${String((idx % 15) + 10).padStart(2, "0")}T09:00:00.000Z`,
        updatedAt: new Date().toISOString(),
      };

      this.inMemoryInvestigations.set(invId, record);
      if (invId >= this.nextInvestigationId) {
        this.nextInvestigationId = invId + 1;
      }

      // Initial notes
      const notesList: StoredNoteRecord[] = [
        {
          id: this.nextNoteId++,
          investigationId: invId,
          userId: "investigator_1",
          userName: "Senior Investigator",
          note: `Procurement package ${tender.tenderNumber} exhibited elevated statistical indicators during automated screening. Prioritized for evidence assessment.`,
          createdAt: `2026-09-${String((idx % 15) + 10).padStart(2, "0")}T09:15:00.000Z`,
          updatedAt: `2026-09-${String((idx % 15) + 10).padStart(2, "0")}T09:15:00.000Z`,
        },
      ];
      if (status === "IN_REVIEW" || status === "WATCHLIST") {
        notesList.push({
          id: this.nextNoteId++,
          investigationId: invId,
          userId: "investigator_2",
          userName: "Procurement Auditor",
          note: "Reviewed price distribution and bidder margins. Comparing observed patterns against historical awards in comparable regional categories.",
          createdAt: `2026-09-${String((idx % 15) + 12).padStart(2, "0")}T11:45:00.000Z`,
          updatedAt: `2026-09-${String((idx % 15) + 12).padStart(2, "0")}T11:45:00.000Z`,
        });
      }
      this.inMemoryNotes.set(invId, notesList);

      // Initial activities
      const acts: StoredActivityRecord[] = [
        {
          id: this.nextActivityId++,
          investigationId: invId,
          userId: "system",
          userName: "BidShield Screening Engine",
          action: "INVESTIGATION_CREATED",
          previousValue: null,
          newValue: status,
          metadata: JSON.stringify({ tenderNumber: tender.tenderNumber, initialPriority: priority }),
          createdAt: record.createdAt,
        },
      ];
      if (status !== "OPEN") {
        acts.push({
          id: this.nextActivityId++,
          investigationId: invId,
          userId: "investigator_1",
          userName: "Senior Investigator",
          action: "STATUS_CHANGED",
          previousValue: "OPEN",
          newValue: status,
          metadata: JSON.stringify({ reason: "Initiated detailed evidence examination" }),
          createdAt: `2026-09-${String((idx % 15) + 11).padStart(2, "0")}T10:00:00.000Z`,
        });
      }
      if (isWatchlisted) {
        acts.push({
          id: this.nextActivityId++,
          investigationId: invId,
          userId: "investigator_1",
          userName: "Senior Investigator",
          action: "WATCHLIST_ADDED",
          previousValue: null,
          newValue: "WATCHLIST",
          metadata: JSON.stringify({ notes: record.watchlistNotes }),
          createdAt: `2026-09-${String((idx % 15) + 12).padStart(2, "0")}T12:00:00.000Z`,
        });
      }
      this.inMemoryActivities.set(invId, acts);
    });

    this.initialized = true;
  }

  /**
   * List investigations with comprehensive filters and metadata.
   */
  public async listInvestigations(filters?: {
    status?: string;
    screeningLevel?: string;
    category?: string;
    organization?: string;
    search?: string;
    watchlistOnly?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{
    items: InvestigationItem[];
    total: number;
    page: number;
    pageSize: number;
    summary: {
      total: number;
      open: number;
      inReview: number;
      watchlist: number;
      closed: number;
    };
  }> {
    const allRecords = Array.from(this.inMemoryInvestigations.values());

    // Compute status counts across all investigations
    const summary = {
      total: allRecords.length,
      open: allRecords.filter((r) => r.status === "OPEN").length,
      inReview: allRecords.filter((r) => r.status === "IN_REVIEW").length,
      watchlist: allRecords.filter((r) => r.isWatchlisted || r.status === "WATCHLIST").length,
      closed: allRecords.filter((r) => r.status === "CLOSED").length,
    };

    let filtered = allRecords;

    if (filters?.status && filters.status !== "ALL") {
      const targetStatus = filters.status.toUpperCase();
      if (targetStatus === "WATCHLIST") {
        filtered = filtered.filter((r) => r.isWatchlisted || r.status === "WATCHLIST");
      } else {
        filtered = filtered.filter((r) => r.status === targetStatus);
      }
    }

    if (filters?.watchlistOnly) {
      filtered = filtered.filter((r) => r.isWatchlisted || r.status === "WATCHLIST");
    }

    // Attach combined screening information to each record
    const enrichedItems: InvestigationItem[] = [];

    for (const record of filtered) {
      const tender = tenders.find((t) => t.id === record.tenderId);
      if (!tender) continue;

      if (filters?.category && tender.category !== filters.category) continue;
      if (filters?.organization && tender.organization !== filters.organization) continue;

      if (filters?.search) {
        const q = filters.search.toLowerCase();
        const matchesTender =
          tender.tenderNumber.toLowerCase().includes(q) ||
          tender.title.toLowerCase().includes(q) ||
          tender.organization.toLowerCase().includes(q) ||
          tender.department.toLowerCase().includes(q) ||
          tender.bids.some((b) => b.companyName.toLowerCase().includes(q));
        if (!matchesTender) continue;
      }

      // Fetch Phase 7 combined risk score for this tender
      const combinedRes = await analyticsService.getCombinedScreeningForTender(tender.id);

      if (filters?.screeningLevel && filters.screeningLevel !== "ALL") {
        const levelMatches = combinedRes?.screeningLevel
          ? combinedRes.screeningLevel.toUpperCase().includes(filters.screeningLevel.toUpperCase())
          : tender.screeningLevel.toUpperCase() === filters.screeningLevel.toUpperCase();
        if (!levelMatches) continue;
      }

      const notes = this.inMemoryNotes.get(record.id) ?? [];

      enrichedItems.push({
        id: record.id,
        tenderId: tender.id,
        tenderNumber: tender.tenderNumber,
        title: tender.title,
        organization: tender.organization,
        department: tender.department,
        category: tender.category,
        location: tender.location,
        state: tender.state,
        tenderDate: tender.tenderDate,
        estimatedValue: tender.estimatedValue,
        contractValue: tender.contractValue,
        status: record.status,
        priority: record.priority,
        assignedTo: record.assignedTo,
        isWatchlisted: record.isWatchlisted,
        overallScore: combinedRes?.overallScore ?? null,
        screeningLevel: combinedRes?.screeningLevel ?? tender.screeningLevel,
        availableIndicatorCount: combinedRes?.availableIndicatorCount ?? 0,
        totalIndicatorCount: combinedRes?.totalIndicatorCount ?? 5,
        evidenceCount: combinedRes?.evidenceBreakdown?.totalCount ?? (tender as any).evidence?.length ?? 0,
        topIndicator: combinedRes?.topIndicators?.[0]
          ? {
              indicator: combinedRes.topIndicators[0].indicator,
              label: combinedRes.topIndicators[0].label,
              score: combinedRes.topIndicators[0].score,
            }
          : undefined,
        notesCount: notes.length,
        lastAnalyzed: combinedRes?.calculatedAt ?? tender.tenderDate,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      });
    }

    // Sort by priority (HIGH first), then overallScore descending
    enrichedItems.sort((a, b) => {
      const prioWeight = { HIGH: 3, MEDIUM: 2, LOW: 1 };
      const diffPrio = prioWeight[b.priority] - prioWeight[a.priority];
      if (diffPrio !== 0) return diffPrio;
      return (b.overallScore ?? 0) - (a.overallScore ?? 0);
    });

    const page = Math.max(1, filters?.page ?? 1);
    const pageSize = Math.max(1, Math.min(100, filters?.limit ?? 25));
    const start = (page - 1) * pageSize;
    const paginated = enrichedItems.slice(start, start + pageSize);

    return {
      items: paginated,
      total: enrichedItems.length,
      page,
      pageSize,
      summary,
    };
  }

  /**
   * Investigation Review Queue: Prioritized list of tenders requiring review.
   */
  public async getInvestigationQueue(filters?: {
    screeningLevel?: string;
    category?: string;
    search?: string;
    status?: string;
  }): Promise<{
    items: InvestigationQueueItem[];
    total: number;
    summary: {
      totalRequiringReview: number;
      activeInvestigations: number;
      unassignedTenders: number;
    };
  }> {
    const queueItems: InvestigationQueueItem[] = [];

    // Map existing investigations by tenderId
    const existingByTender = new Map<number, StoredInvestigationRecord>();
    for (const inv of this.inMemoryInvestigations.values()) {
      existingByTender.set(inv.tenderId, inv);
    }

    for (const tender of tenders) {
      const combinedRes = await analyticsService.getCombinedScreeningForTender(tender.id);
      const existingInv = existingByTender.get(tender.id);

      const score = combinedRes?.overallScore ?? 0;
      const isElevated = (score >= 50) || tender.screeningLevel === "Elevated";
      const isModerate = (score >= 25) || tender.screeningLevel === "Moderate";
      const requiresReview = isElevated || isModerate;

      if (filters?.screeningLevel && filters.screeningLevel !== "ALL") {
        const matches = combinedRes?.screeningLevel
          ? combinedRes.screeningLevel.toUpperCase().includes(filters.screeningLevel.toUpperCase())
          : tender.screeningLevel.toUpperCase() === filters.screeningLevel.toUpperCase();
        if (!matches) continue;
      }

      if (filters?.category && tender.category !== filters.category) continue;

      if (filters?.search) {
        const q = filters.search.toLowerCase();
        const matchesSearch =
          tender.tenderNumber.toLowerCase().includes(q) ||
          tender.title.toLowerCase().includes(q) ||
          tender.organization.toLowerCase().includes(q) ||
          tender.department.toLowerCase().includes(q);
        if (!matchesSearch) continue;
      }

      const priority: InvestigationPriority =
        score >= 70 || tender.screeningLevel === "Elevated"
          ? "HIGH"
          : score >= 40 || tender.screeningLevel === "Moderate"
          ? "MEDIUM"
          : "LOW";

      const topInd = combinedRes?.topIndicators?.[0]
        ? {
            indicator: combinedRes.topIndicators[0].indicator,
            label: combinedRes.topIndicators[0].label,
            score: combinedRes.topIndicators[0].score,
          }
        : null;

      queueItems.push({
        tenderId: tender.id,
        tenderNumber: tender.tenderNumber,
        title: tender.title,
        organization: tender.organization,
        department: tender.department,
        category: tender.category,
        estimatedValue: tender.estimatedValue,
        tenderDate: tender.tenderDate,
        overallScore: combinedRes?.overallScore ?? null,
        screeningLevel: combinedRes?.screeningLevel ?? tender.screeningLevel,
        evidenceCount: combinedRes?.evidenceBreakdown?.totalCount ?? (tender as any).evidence?.length ?? 0,
        topIndicator: topInd,
        investigationId: existingInv?.id ?? null,
        investigationStatus: existingInv?.status ?? null,
        hasActiveInvestigation: Boolean(existingInv && existingInv.status !== "CLOSED"),
        priority,
        requiresReview,
      });
    }

    // Sort: Unassigned requiring review first, then by score descending
    queueItems.sort((a, b) => {
      if (a.hasActiveInvestigation !== b.hasActiveInvestigation) {
        return a.hasActiveInvestigation ? 1 : -1;
      }
      return (b.overallScore ?? 0) - (a.overallScore ?? 0);
    });

    const summary = {
      totalRequiringReview: queueItems.filter((q) => q.requiresReview).length,
      activeInvestigations: queueItems.filter((q) => q.hasActiveInvestigation).length,
      unassignedTenders: queueItems.filter((q) => q.requiresReview && !q.hasActiveInvestigation).length,
    };

    return {
      items: queueItems,
      total: queueItems.length,
      summary,
    };
  }

  /**
   * Advanced Dashboard Summary for investigators.
   */
  public async getInvestigationSummary(): Promise<InvestigationDashboardSummary> {
    const listResult = await this.listInvestigations({ limit: 10 });
    const queueResult = await this.getInvestigationQueue();

    // Screening level counts across all tenders
    const distribution = {
      low: 0,
      moderate: 0,
      elevated: 0,
      high: 0,
      insufficient: 0,
    };

    let totalEvidenceCount = 0;
    const indicatorCounts: Record<string, { available: number; elevated: number }> = {
      WINNER_ROTATION: { available: 0, elevated: 0 },
      COVER_BID: { available: 0, elevated: 0 },
      PRICE_CLUSTERING: { available: 0, elevated: 0 },
      PARTICIPATION_NETWORK: { available: 0, elevated: 0 },
      NEAT_LOSS: { available: 0, elevated: 0 },
    };

    for (const tender of tenders) {
      const res = await analyticsService.getCombinedScreeningForTender(tender.id);
      if (res) {
        const lvl = res.screeningLevel.toUpperCase();
        if (lvl.includes("HIGH")) distribution.high++;
        else if (lvl.includes("ELEVATED")) distribution.elevated++;
        else if (lvl.includes("MODERATE")) distribution.moderate++;
        else if (lvl.includes("LOW")) distribution.low++;
        else distribution.insufficient++;

        totalEvidenceCount += res.evidenceBreakdown?.totalCount ?? 0;

        for (const [key, ind] of Object.entries(res.indicators)) {
          if (indicatorCounts[key]) {
            if (ind.status === "AVAILABLE") {
              indicatorCounts[key].available++;
              if ((ind.rawScore ?? 0) >= 50) {
                indicatorCounts[key].elevated++;
              }
            }
          }
        }
      }
    }

    // Collect recent activities across all investigations
    const allActivities: StoredActivityRecord[] = [];
    for (const acts of this.inMemoryActivities.values()) {
      allActivities.push(...acts);
    }
    allActivities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return {
      totalTenders: tenders.length,
      tendersAnalyzed: tenders.length,
      tendersRequiringReview: queueResult.summary.totalRequiringReview,
      openInvestigations: listResult.summary.open,
      inReviewInvestigations: listResult.summary.inReview,
      watchlistInvestigations: listResult.summary.watchlist,
      closedInvestigations: listResult.summary.closed,
      totalInvestigations: listResult.summary.total,
      totalEvidenceCount,
      screeningLevelDistribution: distribution,
      indicatorDistribution: indicatorCounts,
      recentInvestigations: listResult.items.slice(0, 5),
      recentActivities: allActivities.slice(0, 10),
    };
  }

  /**
   * Get full details for an investigation workspace.
   */
  public async getInvestigationById(id: number): Promise<InvestigationDetailResult | null> {
    const record = this.inMemoryInvestigations.get(id);
    if (!record) return null;

    const tender = tenders.find((t) => t.id === record.tenderId);
    if (!tender) return null;

    // Combined screening results from Phase 7
    const combinedRes = await analyticsService.getCombinedScreeningForTender(tender.id);
    const tenderAnalytics = await analyticsService.getTenderAnalytics(tender.id);

    // Bid comparison items
    const bids: BidComparisonItem[] = tender.bids.map((b) => {
      const winningBid = tender.bids.find((w) => w.isWinner)?.bidAmount ?? Math.min(...tender.bids.map((x) => x.bidAmount));
      const diff = b.bidAmount - winningBid;
      const relDiff = winningBid > 0 ? (diff / winningBid) * 100 : 0;
      const comp = companies.find((c) => c.id === b.companyId);

      return {
        companyId: b.companyId,
        companyName: b.companyName,
        canonicalName: comp?.canonicalName ?? b.companyName,
        bidAmount: b.bidAmount,
        rank: b.rank,
        isWinner: b.isWinner,
        differenceFromWinner: diff,
        relativeDifferencePct: Math.round(relDiff * 100) / 100,
        technicalScore: (b as any).technicalScore ?? null,
        financialScore: (b as any).financialScore ?? null,
        submissionDate: (b as any).submissionDate ?? tender.tenderDate,
      };
    });

    // Participating companies historical stats
    const participatingCompanies: ParticipatingCompanyHistory[] = [];
    for (const b of tender.bids) {
      const comp = companies.find((c) => c.id === b.companyId);
      if (!comp) continue;

      const netAnalysis = await analyticsService.getCompanyNetwork(comp.id);
      const neatAnalysis = await analyticsService.getCompanyNeatLoss(comp.id);
      const pricePatterns = await analyticsService.getCompanyPricePatterns(comp.id);

      const losses = Math.max(0, comp.tendersParticipated - comp.wins);
      const winRate = comp.tendersParticipated > 0 ? (comp.wins / comp.tendersParticipated) * 100 : 0;

      participatingCompanies.push({
        companyId: comp.id,
        canonicalName: comp.canonicalName,
        normalizedName: comp.normalizedName,
        address: comp.address,
        state: comp.state,
        registrationNumber: (comp as any).registrationNumber ?? null,
        tendersParticipated: comp.tendersParticipated,
        wins: comp.wins,
        losses,
        winRate,
        screeningLevel: comp.screeningLevel,
        historicalIndicators: {
          rotationScore: null,
          networkScore: netAnalysis?.indicator?.score ?? null,
          neatLossScore: neatAnalysis?.metrics?.score ?? null,
          pricePositioningCount: pricePatterns?.repeatedPositioningCount ?? 0,
        },
        relationshipsCount: comp.coParticipants,
      });
    }

    // Network subgraph for tender participants
    const network = await this.buildInvestigationNetworkSubgraph(tender);

    // Evidence timeline
    const allEvidence = combinedRes ? await analyticsService.getCombinedScreeningEvidence(tender.id) : [];
    const timeline = allEvidence.map((ev) => ({
      id: ev.id,
      date: tender.tenderDate,
      indicatorType: ev.indicatorType,
      description: ev.description,
      metric: ev.metric,
      observedValue: ev.observedValue ?? null,
      expectedValue: ev.expectedValue ?? null,
      severity: ev.severity,
      confidence: ev.confidence,
      methodologyVersion: (ev as any).methodologyVersion ?? "v1.0",
      sourceTenderIds: ev.supportingTenderIds ?? [tender.id],
    }));

    // Notes and activities
    const notesList = this.inMemoryNotes.get(record.id) ?? [];
    const activities = this.inMemoryActivities.get(record.id) ?? [];

    // Lineage details (Phase 2 integration)
    const lineage: InvestigationDataLineage = {
      datasetName: "Standard Public Procurement Dataset (KPP)",
      importBatchId: 1,
      importFilename: "procurement_corpus_karnataka_2025.csv",
      source: "synthetic-demo",
      importedDate: "2025-01-15T08:00:00.000Z",
      totalCorpusTenders: tenders.length,
      tendersInBatch: tenders.length,
      lineageChain: [
        {
          stage: "Ingestion & Validation",
          description: "Raw procurement table ingestion, RFC 4180 parsing, and schema validation.",
          status: "PASSED",
          timestamp: "2025-01-15T08:02:11.000Z",
        },
        {
          stage: "Entity Resolution",
          description: "Levenshtein distance clustering, token sorting, and canonical entity deduplication.",
          status: "RESOLVED",
          timestamp: "2025-01-15T08:05:43.000Z",
        },
        {
          stage: "Statistical Screening Engines",
          description: "Execution of Winner Rotation, Cover-Bid, Price Clustering, Network, and Too-Neat Loss detectors.",
          status: "COMPLETED",
          timestamp: combinedRes?.calculatedAt ?? tender.tenderDate,
        },
        {
          stage: "Combined Risk Synthesizer",
          description: "Normalized multi-detector weighted aggregation (combined_risk_v1.0).",
          status: "SYNTHESIZED",
          timestamp: combinedRes?.calculatedAt ?? tender.tenderDate,
        },
      ],
    };

    const winnerBid = tender.bids.find((b) => b.isWinner);

    return {
      id: record.id,
      tenderId: tender.id,
      status: record.status,
      priority: record.priority,
      assignedTo: record.assignedTo,
      title: record.title,
      notes: record.notes,
      isWatchlisted: record.isWatchlisted,
      watchlistNotes: record.watchlistNotes,
      createdBy: record.createdBy,
      closedAt: record.closedAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      tender: {
        id: tender.id,
        tenderNumber: tender.tenderNumber,
        title: tender.title,
        department: tender.department,
        organization: tender.organization,
        category: tender.category,
        location: tender.location,
        state: tender.state,
        tenderDate: tender.tenderDate,
        closingDate: tender.closingDate,
        estimatedValue: tender.estimatedValue,
        contractValue: tender.contractValue,
        status: (tender as any).status ?? "Open",
        winnerId: winnerBid?.companyId ?? null,
        winnerName: winnerBid?.companyName ?? null,
        bidderCount: tender.bids.length,
      },
      combinedScreening: {
        overallScore: combinedRes?.overallScore ?? null,
        overallStatus: combinedRes?.overallStatus ?? "INSUFFICIENT_DATA",
        screeningLevel: combinedRes?.screeningLevel ?? tender.screeningLevel,
        availableIndicatorCount: combinedRes?.availableIndicatorCount ?? 0,
        totalIndicatorCount: combinedRes?.totalIndicatorCount ?? 5,
        indicators: combinedRes?.indicators ?? {},
        topIndicators: combinedRes?.topIndicators ?? [],
        evidenceSummary: combinedRes?.evidenceSummary ?? "Statistical screening evaluation complete.",
        methodologyVersion: combinedRes?.methodologyVersion ?? "combined_risk_v1.0",
        disclaimer:
          "Statistical screening identifies patterns that may warrant further review. It does NOT establish collusion, wrongdoing, or legal liability.",
        calculatedAt: combinedRes?.calculatedAt ?? tender.tenderDate,
      },
      evidenceTimeline: timeline,
      bids,
      participatingCompanies,
      network,
      notesList,
      activities,
      lineage,
    };
  }

  /**
   * Helper to build the network subgraph for a specific tender's bidders.
   */
  private async buildInvestigationNetworkSubgraph(tender: DemoTender): Promise<InvestigationNetworkSubgraph> {
    const bidderIds = new Set(tender.bids.map((b) => b.companyId));
    const nodes: InvestigationNetworkSubgraph["nodes"] = [
      {
        id: `tender-${tender.id}`,
        type: "tender",
        label: `${tender.tenderNumber}`,
        isCurrentTender: true,
      },
    ];

    tender.bids.forEach((b) => {
      const comp = companies.find((c) => c.id === b.companyId);
      nodes.push({
        id: `company-${b.companyId}`,
        type: "company",
        label: comp?.canonicalName ?? b.companyName,
        isWinner: b.isWinner,
        screeningLevel: comp?.screeningLevel,
      });
    });

    const edges: InvestigationNetworkSubgraph["edges"] = tender.bids.map((b) => ({
      source: `company-${b.companyId}`,
      target: `tender-${tender.id}`,
      label: b.isWinner ? "Awarded Winner" : "Submitted Bid",
      isAward: b.isWinner,
    }));

    // Find recurring pairs among bidders
    const allNormalized = analyticsService.getNormalizedTenders();
    const companyEntities = analyticsService.getCompanyEntities();
    const pairs: CoParticipationSummary[] = [];

    const bidderList = Array.from(bidderIds);
    for (let i = 0; i < bidderList.length; i++) {
      for (let j = i + 1; j < bidderList.length; j++) {
        const cA = bidderList[i];
        const cB = bidderList[j];
        const rel = await analyticsService.getCompanyRelationship(cA, cB);
        if (rel && rel.sharedTenderCount > 0) {
          pairs.push({
            companyAId: rel.companyAId,
            companyAName: rel.companyAName,
            companyBId: rel.companyBId,
            companyBName: rel.companyBName,
            sharedTenderCount: rel.sharedTenderCount,
            participationFrequency: rel.participationFrequency,
            status: rel.status,
            firstObservedDate: rel.startDate ?? undefined,
            latestObservedDate: rel.endDate ?? undefined,
          });
        }
      }
    }

    // Identify recurring cohorts involving this tender's bidders
    const recurringGroups = await this.findBidderRecurringGroups(tender);

    return {
      nodes,
      edges,
      pairs,
      recurringGroups,
    };
  }

  private async findBidderRecurringGroups(tender: DemoTender): Promise<InvestigationNetworkSubgraph["recurringGroups"]> {
    const bidderNames = new Set(tender.bids.map((b) => b.companyName));
    const allNetwork = await analyticsService.getOverallNetwork();
    const matchingGroups = allNetwork.recurringBidderGroups.filter((g) =>
      g.companyNames.filter((name) => bidderNames.has(name)).length >= 2
    );

    return matchingGroups.slice(0, 5).map((g) => ({
      groupSize: g.companyIds.length,
      companyNames: g.companyNames,
      sharedTenderCount: g.sharedTenderCount,
      tenders: g.sharedTenderIds.map((id: number, idx: number) => ({
        tenderId: id,
        tenderNumber: g.sharedTenderNumbers[idx] ?? `BS-${id}`,
        title: "Procurement Package",
      })),
    }));
  }

  /**
   * Create a new investigation workspace for a tender.
   */
  public async createInvestigation(input: {
    tenderId: number;
    priority?: InvestigationPriority;
    notes?: string;
    assignedTo?: string;
    userName?: string;
    userId?: string;
  }): Promise<InvestigationDetailResult> {
    // Check if an investigation already exists for this tender
    for (const inv of this.inMemoryInvestigations.values()) {
      if (inv.tenderId === input.tenderId) {
        const full = await this.getInvestigationById(inv.id);
        if (full) return full;
      }
    }

    const tender = tenders.find((t) => t.id === input.tenderId);
    if (!tender) {
      throw new Error(`Tender #${input.tenderId} not found`);
    }

    const invId = this.nextInvestigationId++;
    const priority: InvestigationPriority = input.priority ?? (tender.screeningLevel === "Elevated" ? "HIGH" : "MEDIUM");
    const assignedTo = input.assignedTo ?? "Senior Investigator";
    const createdBy = input.userId || input.userName || "Senior Investigator";

    const record: StoredInvestigationRecord = {
      id: invId,
      tenderId: tender.id,
      status: "OPEN",
      priority,
      assignedTo,
      title: `Investigation: ${tender.tenderNumber} - ${tender.title}`,
      notes: input.notes ?? `Investigation workspace created for ${tender.tenderNumber}.`,
      isWatchlisted: false,
      watchlistNotes: null,
      createdBy,
      closedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.inMemoryInvestigations.set(invId, record);


    // Initial note if provided
    const notes: StoredNoteRecord[] = [];
    if (input.notes) {
      notes.push({
        id: this.nextNoteId++,
        investigationId: invId,
        userId: "investigator_1",
        userName: input.userName ?? "Senior Investigator",
        note: input.notes,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    this.inMemoryNotes.set(invId, notes);

    // Initial activity
    const acts: StoredActivityRecord[] = [
      {
        id: this.nextActivityId++,
        investigationId: invId,
        userId: "investigator_1",
        userName: input.userName ?? "Senior Investigator",
        action: "INVESTIGATION_CREATED",
        previousValue: null,
        newValue: "OPEN",
        metadata: JSON.stringify({ priority, assignedTo }),
        createdAt: new Date().toISOString(),
      },
    ];
    this.inMemoryActivities.set(invId, acts);

    const full = await this.getInvestigationById(invId);
    return full!;
  }

  /**
   * Phase 18: Resource authorization check
   * Checks whether the given user is authorized to access an investigation.
   */
  public canUserAccess(userId: string = "investigator_1", userRole: string = "investigator", invId: number): boolean {
    if (userRole === "admin") return true;
    const inv = this.inMemoryInvestigations.get(invId);
    if (!inv) return true; // Let 404 handler deal with missing

    // If assigned specifically to another private user
    if (inv.assignedTo && inv.assignedTo.startsWith("user_") && inv.assignedTo !== userId) {
      return false;
    }

    // If created privately by another user
    if (inv.createdBy && inv.createdBy.startsWith("user_") && inv.createdBy !== userId) {
      return false;
    }

    return true;
  }


  /**
   * Update an investigation (status, priority, assignedTo, notes).
   */
  public async updateInvestigation(
    id: number,
    input: {
      status?: InvestigationStatus;
      priority?: InvestigationPriority;
      assignedTo?: string;
      notes?: string;
      userName?: string;
    }
  ): Promise<InvestigationDetailResult> {
    const record = this.inMemoryInvestigations.get(id);
    if (!record) {
      throw new Error(`Investigation #${id} not found`);
    }

    const previousStatus = record.status;
    const previousPriority = record.priority;

    if (input.status && input.status !== record.status) {
      record.status = input.status;
      if (input.status === "CLOSED") {
        record.closedAt = new Date().toISOString();
      } else {
        record.closedAt = null;
      }

      this.logActivity(id, {
        action: "STATUS_CHANGED",
        previousValue: previousStatus,
        newValue: input.status,
        userName: input.userName ?? "Senior Investigator",
      });
    }

    if (input.priority && input.priority !== record.priority) {
      record.priority = input.priority;
      this.logActivity(id, {
        action: "PRIORITY_UPDATED",
        previousValue: previousPriority,
        newValue: input.priority,
        userName: input.userName ?? "Senior Investigator",
      });
    }

    if (input.assignedTo && input.assignedTo !== record.assignedTo) {
      record.assignedTo = input.assignedTo;
    }

    if (input.notes !== undefined) {
      record.notes = input.notes;
    }

    record.updatedAt = new Date().toISOString();
    const full = await this.getInvestigationById(id);
    return full!;
  }

  /**
   * Add a note to an investigation.
   */
  public async addNote(
    investigationId: number,
    noteText: string,
    user?: { userId?: string; userName?: string }
  ): Promise<InvestigationNoteItem> {
    const record = this.inMemoryInvestigations.get(investigationId);
    if (!record) {
      throw new Error(`Investigation #${investigationId} not found`);
    }

    const noteItem: StoredNoteRecord = {
      id: this.nextNoteId++,
      investigationId,
      userId: user?.userId ?? "investigator_1",
      userName: user?.userName ?? "Senior Investigator",
      note: noteText.trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const notes = this.inMemoryNotes.get(investigationId) ?? [];
    notes.unshift(noteItem);
    this.inMemoryNotes.set(investigationId, notes);

    this.logActivity(investigationId, {
      action: "NOTE_ADDED",
      previousValue: null,
      newValue: noteText.slice(0, 60),
      userName: user?.userName ?? "Senior Investigator",
    });

    record.updatedAt = new Date().toISOString();
    return noteItem;
  }

  /**
   * Edit an existing note.
   */
  public async editNote(
    investigationId: number,
    noteId: number,
    newText: string,
    userName?: string
  ): Promise<InvestigationNoteItem> {
    const notes = this.inMemoryNotes.get(investigationId) ?? [];
    const target = notes.find((n) => n.id === noteId);
    if (!target) {
      throw new Error(`Note #${noteId} not found`);
    }

    const prev = target.note;
    target.note = newText.trim();
    target.updatedAt = new Date().toISOString();

    this.logActivity(investigationId, {
      action: "NOTE_EDITED",
      previousValue: prev.slice(0, 40),
      newValue: newText.slice(0, 40),
      userName: userName ?? target.userName,
    });

    return target;
  }

  /**
   * Delete a note.
   */
  public async deleteNote(investigationId: number, noteId: number, userName?: string): Promise<boolean> {
    const notes = this.inMemoryNotes.get(investigationId) ?? [];
    const index = notes.findIndex((n) => n.id === noteId);
    if (index === -1) return false;

    const removed = notes.splice(index, 1)[0];
    this.inMemoryNotes.set(investigationId, notes);

    this.logActivity(investigationId, {
      action: "NOTE_DELETED",
      previousValue: removed.note.slice(0, 40),
      newValue: null,
      userName: userName ?? "Senior Investigator",
    });

    return true;
  }

  /**
   * Add to watchlist.
   */
  public async addToWatchlist(investigationId: number, notes?: string, userName?: string): Promise<boolean> {
    const record = this.inMemoryInvestigations.get(investigationId);
    if (!record) return false;

    record.isWatchlisted = true;
    if (notes) record.watchlistNotes = notes;
    if (record.status === "OPEN") {
      record.status = "WATCHLIST";
    }
    record.updatedAt = new Date().toISOString();

    this.logActivity(investigationId, {
      action: "WATCHLIST_ADDED",
      previousValue: null,
      newValue: "WATCHLIST",
      metadata: notes ? JSON.stringify({ notes }) : null,
      userName: userName ?? "Senior Investigator",
    });

    return true;
  }

  /**
   * Remove from watchlist.
   */
  public async removeFromWatchlist(investigationId: number, userName?: string): Promise<boolean> {
    const record = this.inMemoryInvestigations.get(investigationId);
    if (!record) return false;

    record.isWatchlisted = false;
    record.watchlistNotes = null;
    if (record.status === "WATCHLIST") {
      record.status = "IN_REVIEW";
    }
    record.updatedAt = new Date().toISOString();

    this.logActivity(investigationId, {
      action: "WATCHLIST_REMOVED",
      previousValue: "WATCHLIST",
      newValue: record.status,
      userName: userName ?? "Senior Investigator",
    });

    return true;
  }

  /**
   * Helper to log an activity.
   */
  private logActivity(
    investigationId: number,
    item: {
      action: string;
      previousValue?: string | null;
      newValue?: string | null;
      metadata?: string | null;
      userId?: string;
      userName?: string;
    }
  ): void {
    const acts = this.inMemoryActivities.get(investigationId) ?? [];
    const actRecord: StoredActivityRecord = {
      id: this.nextActivityId++,
      investigationId,
      userId: item.userId ?? "investigator_1",
      userName: item.userName ?? "Senior Investigator",
      action: item.action,
      previousValue: item.previousValue ?? null,
      newValue: item.newValue ?? null,
      metadata: item.metadata ?? null,
      createdAt: new Date().toISOString(),
    };
    acts.unshift(actRecord);
    this.inMemoryActivities.set(investigationId, acts);
  }

  /**
   * Export investigation report (printable HTML or CSV).
   */
  public async exportInvestigation(
    id: number,
    format: "html" | "csv" = "html",
    lang: string = "en"
  ): Promise<{ contentType: string; filename: string; content: string }> {
    const inv = await this.getInvestigationById(id);
    if (!inv) {
      throw new Error(`Investigation #${id} not found`);
    }

    const isTamil = lang === "ta" || lang === "tamil";
    const isHindi = lang === "hi" || lang === "hindi";

    this.logActivity(id, {
      action: "REPORT_EXPORTED",
      previousValue: null,
      newValue: format.toUpperCase(),
      userName: isTamil ? "மூத்த புலனாய்வாளர்" : isHindi ? "वरिष्ठ जाँचकर्ता" : "Senior Investigator",
    });

    if (format === "csv") {
      // Export tabular bid comparison CSV with UTF-8 BOM for perfect Excel / Sheet unicode rendering
      const headerTitle = isHindi
        ? "BidShield जाँच सारांश रिपोर्ट"
        : isTamil
        ? "BidShield புலனாய்வு சுருக்க அறிக்கை"
        : "BidShield Investigation Summary Report";

      const rows = [
        [headerTitle, `Tender: ${inv.tender.tenderNumber}`, `Status: ${inv.status}`],
        [],
        [isHindi ? "निविदा संख्या" : isTamil ? "டெண்டர் எண்" : "Tender Number", inv.tender.tenderNumber],
        [isHindi ? "निविदा शीर्षक" : isTamil ? "டெண்டர் தலைப்பு" : "Tender Title", `"${inv.tender.title.replaceAll('"', '""')}"`],
        [isHindi ? "संगठन" : isTamil ? "அமைப்பு" : "Organization", `"${inv.tender.organization.replaceAll('"', '""')}"`],
        [isHindi ? "श्रेणी" : isTamil ? "வகை" : "Category", inv.tender.category],
        [isHindi ? "निविदा तिथि" : isTamil ? "டெண்டர் தேதி" : "Tender Date", inv.tender.tenderDate],
        [isHindi ? "समग्र स्क्रीनिंग स्कोर" : isTamil ? "ஒட்டுமொத்த திரையிடல் மதிப்பெண்" : "Overall Screening Score", String(inv.combinedScreening.overallScore ?? "Insufficient Data")],
        [isHindi ? "स्क्रीनिंग स्तर" : isTamil ? "திரையிடல் நிலை" : "Screening Level", inv.combinedScreening.screeningLevel],
        [],
        [isHindi ? "बोली तुलना रजिस्टर (BID COMPARISON REGISTER)" : isTamil ? "ஏல ஒப்பீட்டு பதிவேடு (BID COMPARISON REGISTER)" : "BID COMPARISON REGISTER"],
        [
          isHindi ? "क्रम (Rank)" : isTamil ? "தரம் (Rank)" : "Rank",
          isHindi ? "कंपनी का नाम" : isTamil ? "நிறுவன பெயர்" : "Company Name",
          "Bid Amount (INR)",
          isHindi ? "विजेता" : isTamil ? "வெற்றியாளர்" : "Winner",
          "Diff From Winner",
          "Relative Diff %",
          "Technical Score",
          "Financial Score",
        ],
        ...inv.bids.map((b) => [
          String(b.rank),
          `"${b.companyName.replaceAll('"', '""')}"`,
          String(b.bidAmount),
          b.isWinner ? "YES" : "NO",
          String(b.differenceFromWinner),
          `${b.relativeDifferencePct}%`,
          b.technicalScore !== null ? String(b.technicalScore) : "—",
          b.financialScore !== null ? String(b.financialScore) : "—",
        ]),
        [],
        [isHindi ? "साक्ष्य रजिस्टर (TRACEABLE EVIDENCE REGISTER)" : isTamil ? "ஆதார பதிவேடு (TRACEABLE EVIDENCE REGISTER)" : "TRACEABLE EVIDENCE REGISTER"],
        ["Indicator", "Severity", "Confidence", "Metric", "Observed Value", "Expected Benchmark", "Description"],
        ...inv.evidenceTimeline.map((e) => [
          e.indicatorType,
          e.severity,
          `${Math.round(e.confidence * 100)}%`,
          `"${e.metric.replaceAll('"', '""')}"`,
          `"${String(e.observedValue ?? '—').replaceAll('"', '""')}"`,
          `"${String(e.expectedValue ?? '—').replaceAll('"', '""')}"`,
          `"${e.description.replaceAll('"', '""')}"`,
        ]),
        [],
        [isHindi ? "जाँचकर्ता नोट्स (INVESTIGATION NOTES)" : isTamil ? "புலனாய்வாளர் குறிப்புகள் (INVESTIGATION NOTES)" : "INVESTIGATION NOTES"],
        ["Date", "Author", "Note"],
        ...inv.notesList.map((n) => [
          n.createdAt,
          `"${n.userName}"`,
          `"${n.note.replaceAll('"', '""')}"`,
        ]),
        [],
        [isHindi ? "कानूनी अस्वीकरण (LEGAL DISCLAIMER)" : isTamil ? "சட்ட மறுப்புரை (LEGAL DISCLAIMER)" : "LEGAL DISCLAIMER"],
        [
          isHindi
            ? '"सांख्यिकीय स्क्रीनिंग अतिरिक्त समीक्षा योग्य पैटर्न की पहचान करती है, लेकिन कानूनी दायित्व या मिलीभगत स्थापित नहीं करती।"'
            : isTamil
            ? '"புள்ளிவிவரத் திரையிடல் மேலும் மறுபரிசீலனைக்கு உட்படக்கூடிய வடிவங்களை மட்டுமே அடையாளம் காட்டுகிறது. இது கூட்டுச்சதி, முறைகேடு அல்லது சட்டப்பூர்வ பொறுப்பை நிறுவவில்லை."'
            : '"Statistical screening identifies patterns that may warrant further review. It does NOT establish collusion, wrongdoing, fraud, cartel membership, criminal activity, or legal liability."',
        ],
      ];

      const csvContent = "\uFEFF" + rows.map((r) => r.join(",")).join("\n");
      return {
        contentType: "text/csv; charset=utf-8",
        filename: `BidShield_Investigation_${inv.tender.tenderNumber}_${lang}.csv`,
        content: csvContent,
      };
    }

    // Professional HTML printable report with full Unicode Indic typography
    const pageLang = isHindi ? "hi" : isTamil ? "ta" : "en";
    const brandTitle = isHindi
      ? "BidShield · जाँच केस डोज़ियर"
      : isTamil
      ? "BidShield · புலனாய்வு வழக்கு ஆவணம்"
      : "BidShield · Investigation Case Dossier";

    const disclaimerText = isHindi
      ? "सांख्यिकीय स्क्रीनिंग अतिरिक्त समीक्षा योग्य पैटर्न की पहचान करती है, लेकिन कानूनी दायित्व या मिलीभगत स्थापित नहीं करती। देखे गए बोली पैटर्न खरीद लेखा परीक्षकों और जाँचकर्ताओं की सहायता के लिए सांख्यिकीय संकेत हैं।"
      : isTamil
      ? "புள்ளிவிவரத் திரையிடல் மேலும் மறுபரிசீலனைக்கு உட்படக்கூடிய வடிவங்களை மட்டுமே அடையாளம் காட்டுகிறது. இது கூட்டுச்சதி, முறைகேடு அல்லது சட்டப்பூர்வ பொறுப்பை நிறுவவில்லை. கண்டறியப்பட்ட ஏல வடிவங்கள் கூடுதல் ஆய்வுக்கு முன்னுரிமை அளிக்க மட்டுமே உதவும்."
      : "Statistical screening identifies patterns that may warrant further review. It does not establish collusion, wrongdoing, or legal liability. Observed bidding patterns represent descriptive statistical screening flags designed to assist procurement auditors and investigators in prioritizing reviews.";

    const html = `<!DOCTYPE html>
<html lang="${pageLang}">
<head>
  <meta charset="UTF-8">
  <title>${brandTitle} - ${inv.tender.tenderNumber}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Nirmala UI', 'Lohit Devanagari', 'Lohit Tamil', 'Noto Sans Devanagari', 'Noto Sans Tamil', Helvetica, Arial, sans-serif;
      color: #0f172a;
      margin: 40px;
      font-size: 13px;
      line-height: 1.5;
    }
    .header { border-bottom: 2px solid #0284c7; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-start; }
    .brand { font-size: 22px; font-weight: 800; color: #0284c7; letter-spacing: -0.5px; }
    .brand-sub { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin-top: 2px; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 4px; font-weight: bold; font-size: 11px; text-transform: uppercase; }
    .badge-elevated { background: #fef3c7; color: #b45309; }
    .badge-high { background: #ffe4e6; color: #e11d48; }
    .badge-moderate { background: #e0f2fe; color: #0369a1; }
    .badge-low { background: #dcfce7; color: #15803d; }
    .section { margin-bottom: 28px; }
    .section-title { font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #334155; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 12px; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px; }
    .kpi-title { font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase; }
    .kpi-value { font-size: 20px; font-weight: 800; color: #0f172a; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
    th { text-align: left; padding: 8px 10px; background: #f1f5f9; color: #475569; font-weight: 600; border-bottom: 1px solid #cbd5e1; }
    td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; }
    .text-right { text-align: right; }
    .winner-row { background: #f0fdf4; font-weight: 600; }
    .disclaimer-box { background: #f8fafc; border: 1px solid #cbd5e1; border-left: 4px solid #0284c7; padding: 12px 16px; border-radius: 4px; margin-top: 30px; font-size: 11px; color: #475569; line-height: 1.6; }
    @media print { body { margin: 15mm; } .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">${brandTitle}</div>
      <div class="brand-sub">PS-09-S1 — Evidence-Driven Procurement Screening & Investigation Platform · Team SYNOVATE</div>
      <div style="margin-top: 8px; font-size: 12px; color: #475569;">Case Dossier: <strong>${inv.tender.tenderNumber}</strong> · Case Ref: INV-${String(inv.id).padStart(4, "0")}</div>
    </div>
    <div style="text-align: right;">
      <span class="badge ${inv.combinedScreening.screeningLevel.includes("ELEVATED") ? "badge-elevated" : inv.combinedScreening.screeningLevel.includes("HIGH") ? "badge-high" : "badge-moderate"}">
        ${inv.combinedScreening.screeningLevel}
      </span>
      <div style="font-size: 11px; color: #64748b; margin-top: 6px;">Status: <strong>${inv.status}</strong> · Generated: ${new Date().toLocaleDateString(isHindi ? "hi-IN" : isTamil ? "ta-IN" : "en-IN")}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">1. Procurement Overview & Screening Metrics</div>
    <div class="grid-2">
      <div class="card">
        <div class="kpi-title">Procurement Title</div>
        <div style="font-weight: 600; margin-top: 2px;">${inv.tender.title}</div>
        <div style="margin-top: 8px; font-size: 11px; color: #64748b;">
          Organization: <strong>${inv.tender.organization}</strong> (${inv.tender.department})<br/>
          Category: <strong>${inv.tender.category}</strong> · Location: <strong>${inv.tender.location}, ${inv.tender.state}</strong><br/>
          Awarded Winner: <strong>${inv.tender.winnerName ?? "Not recorded"}</strong>
        </div>
      </div>
      <div class="card">
        <div class="kpi-title">Combined Screening Score</div>
        <div class="kpi-value">${inv.combinedScreening.overallScore !== null ? `${inv.combinedScreening.overallScore}/100` : "INSUFFICIENT DATA"}</div>
        <div style="margin-top: 4px; font-size: 11px; color: #64748b;">
          Available Indicators: <strong>${inv.combinedScreening.availableIndicatorCount} of ${inv.combinedScreening.totalIndicatorCount}</strong><br/>
          Total Traceable Evidence Records: <strong>${inv.evidenceTimeline.length} items</strong><br/>
          Estimated Value: <strong>₹${inv.tender.estimatedValue.toLocaleString("en-IN")}</strong>
        </div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">2. Multi-Indicator Contribution Breakdown (combined_risk_v1.0)</div>
    <table>
      <thead>
        <tr>
          <th>Indicator</th>
          <th>Status</th>
          <th class="text-right">Raw Score</th>
          <th class="text-right">Effective Weight</th>
          <th class="text-right">Contribution</th>
        </tr>
      </thead>
      <tbody>
        ${Object.values(inv.combinedScreening.indicators)
          .map(
            (ind: any) => `
          <tr>
            <td><strong>${ind.label}</strong></td>
            <td>${ind.status === "AVAILABLE" ? "Available" : "Insufficient Data"}</td>
            <td class="text-right">${ind.rawScore !== null ? `${ind.rawScore}/100` : "—"}</td>
            <td class="text-right">${Math.round((ind.renormalizedWeight ?? 0) * 100)}%</td>
            <td class="text-right"><strong>${ind.status === "AVAILABLE" ? `+${(ind.contributionScore ?? 0).toFixed(1)} pts` : "—"}</strong></td>
          </tr>
        `
          )
          .join("")}
      </tbody>
    </table>
    <div style="margin-top: 10px; font-size: 11px; color: #475569; background: #f8fafc; padding: 10px; border-radius: 4px; border: 1px solid #e2e8f0;">
      <strong>Deterministic Evidence Summary:</strong> ${inv.combinedScreening.evidenceSummary}
    </div>
  </div>

  <div class="section">
    <div class="section-title">3. Bid Comparison Register</div>
    <table>
      <thead>
        <tr>
          <th>Rank</th>
          <th>Participating Company</th>
          <th class="text-right">Bid Amount (INR)</th>
          <th class="text-right">Diff vs Winner</th>
          <th class="text-right">Rel. Difference</th>
          <th>Outcome</th>
        </tr>
      </thead>
      <tbody>
        ${inv.bids
          .map(
            (b) => `
          <tr class="${b.isWinner ? "winner-row" : ""}">
            <td><strong>#${b.rank}</strong></td>
            <td>${b.companyName}</td>
            <td class="text-right font-mono">₹${b.bidAmount.toLocaleString("en-IN")}</td>
            <td class="text-right">${b.differenceFromWinner === 0 ? "Winning Offer" : `+₹${b.differenceFromWinner.toLocaleString("en-IN")}`}</td>
            <td class="text-right">${b.relativeDifferencePct === 0 ? "0.0%" : `+${b.relativeDifferencePct.toFixed(2)}%`}</td>
            <td><strong>${b.isWinner ? "Awarded" : "Submitted"}</strong></td>
          </tr>
        `
          )
          .join("")}
      </tbody>
    </table>
  </div>

  <div class="section">
    <div class="section-title">4. Traceable Evidence Register (${inv.evidenceTimeline.length} Records)</div>
    <table>
      <thead>
        <tr>
          <th>Indicator</th>
          <th>Severity</th>
          <th>Metric</th>
          <th>Observed Value</th>
          <th>Expected Value</th>
          <th>Description</th>
        </tr>
      </thead>
      <tbody>
        ${inv.evidenceTimeline
          .map(
            (e) => `
          <tr>
            <td><strong>${e.indicatorType}</strong></td>
            <td><span class="badge ${e.severity.toUpperCase() === "HIGH" ? "badge-high" : e.severity.toUpperCase() === "MODERATE" ? "badge-elevated" : "badge-low"}">${e.severity}</span></td>
            <td>${e.metric}</td>
            <td><strong>${e.observedValue ?? "—"}</strong></td>
            <td>${e.expectedValue ?? "—"}</td>
            <td>${e.description}</td>
          </tr>
        `
          )
          .join("")}
      </tbody>
    </table>
  </div>

  ${
    inv.notesList.length > 0
      ? `
  <div class="section">
    <div class="section-title">5. Investigator Case Notes (${inv.notesList.length})</div>
    ${inv.notesList
      .map(
        (n) => `
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 10px 14px; margin-bottom: 8px;">
        <div style="display: flex; justify-content: space-between; font-size: 11px; color: #64748b; margin-bottom: 4px;">
          <span><strong>${n.userName}</strong></span>
          <span>${new Date(n.createdAt).toLocaleString("en-IN")}</span>
        </div>
        <div>${n.note}</div>
      </div>
    `
      )
      .join("")}
  </div>
  `
      : ""
  }

  <div class="disclaimer-box">
    <strong>${isHindi ? "अनिवार्य विश्लेषणात्मक एवं कानूनी सूचना:" : isTamil ? "கட்டாய பகுப்பாய்வு மற்றும் சட்ட அறிவிப்பு:" : "Mandatory Analytical & Legal Notice:"}</strong><br/>
    ${disclaimerText}
  </div>
</body>
</html>`;

    return {
      contentType: "text/html; charset=utf-8",
      filename: `BidShield_Investigation_${inv.tender.tenderNumber}_${lang}.html`,
      content: html,
    };
  }
}

export const investigationService = new InvestigationService();
