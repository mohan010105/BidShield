import {
  AnalyticsEvidence,
  AnalyticsIndicator,
  CompanyPatterns,
  CoverBidList,
  CoverBidListItem,
  PriceClusteringList,
  PriceClusteringListItem,
  RotationList,
  RotationListItem,
  ScreeningAnalyticsSummary,
  TenderAnalytics,
} from "./common/types";
import { findComparableTenders, NormalizedTenderInput } from "./common/comparable";
import { detectWinnerRotation } from "./screens/winner_rotation/detector";
import { detectCoverBid } from "./screens/cover_bid/detector";
import { detectPriceClustering, PriceClusteringDetectionResult } from "./screens/price_clustering/detector";
import { calculateCompanyPatterns } from "./history/company_patterns";
import { calculateCompanyPricePatterns, CompanyPricePatternsResult } from "./history/company_price_patterns";
import { defaultScreenerConfig, ScreenerConfig } from "./scoring/config";
import { companies, DemoTender, tenders } from "../lib/bidshieldData";
import {
  db,
  evidenceTable,
  neatLossMetricsTable,
  networkRelationshipsTable,
  riskScoresTable,
  screenerResultsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  BipartiteGraph,
  calculateCoParticipationPairs,
  CompanyEntityInput,
  CompanyNetworkAnalysis,
  CoParticipationPair,
  detectCompanyNetwork,
  detectPairRelationship,
  detectParticipationNetwork,
  generateGroupEvidence,
  generatePairEvidence,
  identifyRecurringBidderGroups,
  OverallNetworkAnalytics,
  buildParticipationGraph,
} from "./screens/network";
import {
  detectCompanyNeatLoss,
  detectTenderNeatLoss,
  calculateCompanyNeatLossMetrics,
  CompanyNeatLossMetrics,
  NeatLossDetectionResult,
  TenderNeatLossAnalysis,
  OverallNeatLossSummary,
  generateNeatLossEvidence,
} from "./screens/neat_loss";
import {
  calculateCombinedScreening,
  calculateCompanyCombinedScreening,
  CombinedScreeningListItem,
  CombinedScreeningResult,
  CombinedScreeningSummary,
  CompanyCombinedScreeningResult,
  EvidenceBreakdown,
  IndicatorContribution,
  StrongestIndicator,
} from "./screens/combined";
import { scoreToScreeningStatus } from "./scoring/indicators";

export class AnalyticsService {
  private config: ScreenerConfig;
  private cache = new Map<number, TenderAnalytics>();

  constructor(config: ScreenerConfig = defaultScreenerConfig) {
    this.config = config;
  }

  public getNormalizedTenders(): NormalizedTenderInput[] {
    return tenders.map((t) => ({
      id: t.id,
      tenderNumber: t.tenderNumber,
      title: t.title,
      organization: t.organization,
      department: t.department,
      category: t.category,
      location: t.location,
      state: t.state,
      tenderDate: t.tenderDate,
      closingDate: t.closingDate,
      estimatedValue: t.estimatedValue,
      contractValue: t.contractValue,
      winner: t.winner,
      bids: t.bids.map((b) => ({
        companyId: b.companyId,
        companyName: b.companyName,
        bidAmount: b.bidAmount,
        rank: b.rank,
        isWinner: b.isWinner,
        differenceFromWinner: b.differenceFromWinner,
      })),
    }));
  }

  public getCompanyEntities(): CompanyEntityInput[] {
    return companies.map((c) => ({
      id: c.id,
      canonicalName: c.canonicalName,
      normalizedName: c.normalizedName,
      state: c.state,
      screeningLevel: c.screeningLevel,
      aliases: c.aliases,
    }));
  }

  /**
   * Run screening analysis for a single tender against the comparable tender population.
   */
  public async analyzeTender(tenderId: number): Promise<TenderAnalytics | null> {
    const allTenders = this.getNormalizedTenders();
    const target = allTenders.find((t) => t.id === tenderId);
    if (!target) return null;

    const { comparableTenders, scope } = findComparableTenders(target, allTenders, this.config);
    const rotResult = detectWinnerRotation(target, comparableTenders, scope, this.config);
    const covResult = detectCoverBid(target, comparableTenders, scope, this.config);
    const pcResult = detectPriceClustering(target, comparableTenders, scope, this.config);
    const netResult = detectParticipationNetwork(target, comparableTenders, scope, this.getCompanyEntities(), this.config);
    const neatLossResult = detectTenderNeatLoss(target, allTenders, this.config);

    const evidence: AnalyticsEvidence[] = [
      ...rotResult.evidence,
      ...covResult.evidence,
      ...pcResult.evidence,
      ...netResult.evidence,
      ...neatLossResult.evidence,
    ];

    const combinedRisk = calculateCombinedScreening(
      {
        tenderId: target.id,
        tenderNumber: target.tenderNumber,
        title: target.title,
        organization: target.organization,
        category: target.category,
      },
      {
        rotation: rotResult.indicator,
        coverBid: covResult.indicator,
        priceClustering: pcResult.indicator,
        network: netResult.indicator,
        neatLoss: neatLossResult.indicator,
      },
      evidence,
      this.config
    );

    const result: TenderAnalytics = {
      tenderId: target.id,
      tenderNumber: target.tenderNumber,
      comparisonScope: scope,
      winnerRotation: rotResult.indicator,
      coverBid: covResult.indicator,
      priceClustering: pcResult.indicator,
      participationNetwork: netResult.indicator,
      neatLoss: neatLossResult.indicator,
      combinedRisk,
      evidence,
      calculatedAt: new Date().toISOString(),
    };

    // Cache the result
    this.cache.set(tenderId, result);

    // Synchronize to DB if available
    try {
      await this.persistScreeningResult(result);
    } catch {
      // Graceful fallback to memory
    }

    return result;
  }

  /**
   * Returns cached or freshly computed analytics for a tender.
   */
  public async getTenderAnalytics(tenderId: number): Promise<TenderAnalytics | null> {
    if (this.cache.has(tenderId)) {
      return this.cache.get(tenderId)!;
    }
    return this.analyzeTender(tenderId);
  }

  /**
   * Returns traceable screening evidence for a single tender.
   */
  public async getTenderEvidence(tenderId: number): Promise<AnalyticsEvidence[]> {
    const analytics = await this.getTenderAnalytics(tenderId);
    return analytics ? analytics.evidence : [];
  }

  /**
   * Returns standalone price clustering detection result for a tender.
   */
  public async getTenderPriceClustering(tenderId: number): Promise<PriceClusteringDetectionResult | null> {
    const allTenders = this.getNormalizedTenders();
    const target = allTenders.find((t) => t.id === tenderId);
    if (!target) return null;

    const { comparableTenders, scope } = findComparableTenders(target, allTenders, this.config);
    return detectPriceClustering(target, comparableTenders, scope, this.config);
  }

  /**
   * Returns list of all price clustering screening indicators across the corpus.
   */
  public async getPriceClusteringAnalytics(): Promise<PriceClusteringList> {
    const allTenders = this.getNormalizedTenders();
    const items: PriceClusteringListItem[] = [];

    for (const target of allTenders) {
      const analytics = await this.getTenderAnalytics(target.id);
      if (analytics && analytics.priceClustering.score !== null && analytics.priceClustering.score >= 30) {
        const { comparableTenders, scope } = findComparableTenders(target, allTenders, this.config);
        const pc = detectPriceClustering(target, comparableTenders, scope, this.config);

        items.push({
          tenderId: target.id,
          tenderNumber: target.tenderNumber,
          score: analytics.priceClustering.score,
          status: analytics.priceClustering.status,
          sampleSize: analytics.priceClustering.sampleSize,
          comparisonGroup: `${scope.category} · ${scope.organization}`,
          coefficientOfVariation: pc.metrics.coefficientOfVariation,
          bidSpreadPct: pc.metrics.normalizedSpreadPct,
          cvPercentile: pc.metrics.cvPercentile,
          historicalMedianCV: pc.metrics.historicalMedianCV,
          comparableTendersCount: pc.metrics.comparableTenderCount,
        });
      }
    }

    items.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    return { items, total: items.length };
  }

  /**
   * Returns list of all winner rotation indicators across the corpus.
   */
  public async getRotationAnalytics(): Promise<RotationList> {
    const allTenders = this.getNormalizedTenders();
    const items: RotationListItem[] = [];

    for (const target of allTenders) {
      const analytics = await this.getTenderAnalytics(target.id);
      if (analytics && analytics.winnerRotation.score !== null && analytics.winnerRotation.score >= 30) {
        const { comparableTenders, scope } = findComparableTenders(target, allTenders, this.config);
        const rot = detectWinnerRotation(target, comparableTenders, scope, this.config);

        items.push({
          tenderId: target.id,
          tenderNumber: target.tenderNumber,
          score: analytics.winnerRotation.score,
          status: analytics.winnerRotation.status,
          sampleSize: analytics.winnerRotation.sampleSize,
          winner: target.winner,
          comparisonGroup: `${scope.category} · ${scope.organization}`,
          winnerSequence: rot.metrics.winnerSequence.map((w) => w.winnerName ?? "Unknown").slice(0, 6),
        });
      }
    }

    items.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    return { items, total: items.length };
  }

  /**
   * Returns winner rotation indicators involving a specific company.
   */
  public async getCompanyRotationAnalytics(companyId: number): Promise<RotationList> {
    const all = await this.getRotationAnalytics();
    const targetCompany = companies.find((c) => c.id === companyId);
    if (!targetCompany) return { items: [], total: 0 };

    const filtered = all.items.filter((item) =>
      item.winner === targetCompany.canonicalName ||
      item.winnerSequence.includes(targetCompany.canonicalName)
    );

    return { items: filtered, total: filtered.length };
  }

  /**
   * Returns list of all cover-bid indicators across the corpus.
   */
  public async getCoverBidAnalytics(): Promise<CoverBidList> {
    const allTenders = this.getNormalizedTenders();
    const items: CoverBidListItem[] = [];

    for (const target of allTenders) {
      const analytics = await this.getTenderAnalytics(target.id);
      if (analytics && analytics.coverBid.score !== null && analytics.coverBid.score >= 30) {
        const { comparableTenders, scope } = findComparableTenders(target, allTenders, this.config);
        const cov = detectCoverBid(target, comparableTenders, scope, this.config);

        items.push({
          tenderId: target.id,
          tenderNumber: target.tenderNumber,
          score: analytics.coverBid.score,
          status: analytics.coverBid.status,
          sampleSize: analytics.coverBid.sampleSize,
          comparisonGroup: `${scope.category} · ${scope.organization}`,
          flaggedCompanies: cov.metrics.flaggedCompanies,
          medianRelativeDistance: cov.metrics.medianRelativeDistance,
          currentRelativeDistances: cov.metrics.currentRelativeDistances,
        });
      }
    }

    items.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    return { items, total: items.length };
  }

  /**
   * Returns comprehensive historical patterns for a company.
   */
  public async getCompanyPatterns(companyId: number): Promise<CompanyPatterns | null> {
    const company = companies.find((c) => c.id === companyId);
    if (!company) return null;

    const allTenders = this.getNormalizedTenders();
    return calculateCompanyPatterns(companyId, company.canonicalName, allTenders);
  }

  /**
   * Returns historical price positioning patterns and metrics for a company.
   */
  public async getCompanyPricePatterns(companyId: number): Promise<CompanyPricePatternsResult | null> {
    const company = companies.find((c) => c.id === companyId);
    if (!company) return null;

    const allTenders = this.getNormalizedTenders();
    return calculateCompanyPricePatterns(companyId, company.canonicalName, allTenders);
  }

  /**
   * Recalculates analytics for all or specified tenders.
   */
  public async recalculate(tenderIds?: number[]): Promise<{
    analyzed: number;
    skipped: number;
    methodologyVersion: string;
    calculatedAt: string;
  }> {
    const allTenders = this.getNormalizedTenders();
    const targets = tenderIds && tenderIds.length > 0
      ? allTenders.filter((t) => tenderIds.includes(t.id))
      : allTenders;

    let analyzed = 0;
    this.cache.clear();

    for (const target of targets) {
      await this.analyzeTender(target.id);
      analyzed++;
    }

    return {
      analyzed,
      skipped: allTenders.length - analyzed,
      methodologyVersion: this.config.methodologyVersion,
      calculatedAt: new Date().toISOString(),
    };
  }

  /**
   * Aggregates screening analytics summary for the dashboard.
   */
  public async getDashboardSummaryAnalytics(): Promise<ScreeningAnalyticsSummary> {
    const allTenders = this.getNormalizedTenders();
    let rotationIndicators = 0;
    let coverBidIndicators = 0;
    let priceClusteringIndicators = 0;
    let evidenceRecords = 0;
    const flaggedCompanySet = new Set<string>();

    const winnerCounts = new Map<string, number>();
    const transitionCounts = new Map<string, number>();
    const distanceBins = { "0-3%": 0, "3-6%": 0, "6-10%": 0, "10%+": 0 };
    const cvBins = { "< 1% (Tight)": 0, "1-2% (Moderate)": 0, "2-4% (Standard)": 0, "> 4% (Dispersed)": 0 };
    const monthlyIndicators = Array.from({ length: 12 }, (_, i) => ({
      label: new Date(2025, i, 1).toLocaleString("en-IN", { month: "short" }),
      value: 0,
    }));

    for (const t of allTenders) {
      const analytics = await this.getTenderAnalytics(t.id);
      if (!analytics) continue;

      evidenceRecords += analytics.evidence.length;

      if (analytics.winnerRotation.score !== null && analytics.winnerRotation.score >= 50) {
        rotationIndicators++;
      }
      if (analytics.coverBid.score !== null && analytics.coverBid.score >= 50) {
        coverBidIndicators++;
        const { comparableTenders, scope } = findComparableTenders(t, allTenders, this.config);
        const cov = detectCoverBid(t, comparableTenders, scope, this.config);
        cov.metrics.flaggedCompanies.forEach((c) => flaggedCompanySet.add(c));
      }
      if (analytics.priceClustering.score !== null && analytics.priceClustering.score >= 50) {
        priceClusteringIndicators++;
      }

      if (
        (analytics.winnerRotation.score ?? 0) >= 50 ||
        (analytics.coverBid.score ?? 0) >= 50 ||
        (analytics.priceClustering.score ?? 0) >= 50
      ) {
        const month = parseInt(t.tenderDate.slice(5, 7), 10) - 1;
        if (month >= 0 && month < 12) {
          monthlyIndicators[month].value++;
        }
      }

      // Track winner distribution
      if (t.winner) {
        winnerCounts.set(t.winner, (winnerCounts.get(t.winner) ?? 0) + 1);
      }

      // Track bid distance bins
      const winBid = t.bids.find((b) => b.isWinner) ?? (t.bids.length > 0 ? t.bids[0] : null);
      if (winBid && winBid.bidAmount > 0) {
        t.bids.forEach((b) => {
          if (b.companyId !== winBid.companyId) {
            const delta = (b.bidAmount - winBid.bidAmount) / winBid.bidAmount * 100;
            if (delta < 3) distanceBins["0-3%"]++;
            else if (delta < 6) distanceBins["3-6%"]++;
            else if (delta < 10) distanceBins["6-10%"]++;
            else distanceBins["10%+"]++;
          }
        });

        // Track CV distribution
        const validAmounts = t.bids.map((b) => b.bidAmount).filter((a) => a > 0);
        if (validAmounts.length >= 2) {
          const cvMetric = analytics.priceClustering.metrics.find((m) => m.key === "coefficient_of_variation")?.value ?? 0;
          if (cvMetric < 0.01) cvBins["< 1% (Tight)"]++;
          else if (cvMetric < 0.02) cvBins["1-2% (Moderate)"]++;
          else if (cvMetric < 0.04) cvBins["2-4% (Standard)"]++;
          else cvBins["> 4% (Dispersed)"]++;
        }
      }
    }

    // Top winners
    const winnerDistribution = Array.from(winnerCounts.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

    // Transitions summary
    const sortedTenders = [...allTenders].sort((a, b) => a.tenderDate.localeCompare(b.tenderDate));
    for (let i = 0; i < sortedTenders.length - 1; i++) {
      const w1 = sortedTenders[i].winner;
      const w2 = sortedTenders[i + 1].winner;
      if (w1 && w2 && w1 !== w2) {
        const key = `${w1.split(" ")[0]} → ${w2.split(" ")[0]}`;
        transitionCounts.set(key, (transitionCounts.get(key) ?? 0) + 1);
      }
    }

    const winnerTransitions = Array.from(transitionCounts.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

    const bidDistanceDistribution = [
      { label: "0-3% (Tight)", value: distanceBins["0-3%"] },
      { label: "3-6% (Moderate)", value: distanceBins["3-6%"] },
      { label: "6-10% (Elevated)", value: distanceBins["6-10%"] },
      { label: ">10% (Wide)", value: distanceBins["10%+"] },
    ];

    const cvDistribution = [
      { label: "< 1% (Tight)", value: cvBins["< 1% (Tight)"] },
      { label: "1-2% (Moderate)", value: cvBins["1-2% (Moderate)"] },
      { label: "2-4% (Standard)", value: cvBins["2-4% (Standard)"] },
      { label: "> 4% (Dispersed)", value: cvBins["> 4% (Dispersed)"] },
    ];

    const companyEntities = this.getCompanyEntities();
    const pairs = calculateCoParticipationPairs(allTenders, companyEntities, this.config);
    const topRecurringPairs = pairs.slice(0, 5).map((p) => ({
      companyA: p.companyAName,
      companyB: p.companyBName,
      sharedTenders: p.sharedTenderCount,
      frequencyPct: Math.round(p.participationFrequency * 100),
    }));
    const networkIndicators = pairs.filter((p) => p.status !== "LOW_INDICATOR").length;

    const neatLossIndicators = companyEntities.filter((c) => {
      const res = detectCompanyNeatLoss(c.id, c.canonicalName, `CMP-${String(c.id).padStart(3, "0")}`, allTenders, this.config);
      return res.metrics.status === "ELEVATED INDICATOR" || res.metrics.status === "HIGH INDICATOR";
    }).length;

    return {
      tendersAnalyzed: allTenders.length,
      rotationIndicators,
      coverBidIndicators,
      priceClusteringIndicators,
      neatLossIndicators,
      companiesRequiringReview: flaggedCompanySet.size || Math.round(companies.length * 0.15),
      evidenceRecords,
      winnerDistribution,
      winnerTransitions,
      bidDistanceDistribution,
      cvDistribution,
      indicatorsOverTime: monthlyIndicators,
      networkIndicators,
      recurringPairs: topRecurringPairs,
    };
  }

  private async persistScreeningResult(result: TenderAnalytics): Promise<void> {
    // Persist screener results
    await db.insert(screenerResultsTable).values([
      {
        tenderId: result.tenderId,
        indicatorType: "WINNER_ROTATION",
        score: result.winnerRotation.score !== null ? String(result.winnerRotation.score) : null,
        status: result.winnerRotation.status,
        methodologyVersion: result.winnerRotation.methodologyVersion,
        sampleSize: result.winnerRotation.sampleSize,
        threshold: String(result.winnerRotation.threshold),
        confidence: String(result.winnerRotation.confidence),
        summary: result.winnerRotation.summary,
        metricsPayload: JSON.stringify(result.winnerRotation.metrics),
      },
      {
        tenderId: result.tenderId,
        indicatorType: "COVER_BID",
        score: result.coverBid.score !== null ? String(result.coverBid.score) : null,
        status: result.coverBid.status,
        methodologyVersion: result.coverBid.methodologyVersion,
        sampleSize: result.coverBid.sampleSize,
        threshold: String(result.coverBid.threshold),
        confidence: String(result.coverBid.confidence),
        summary: result.coverBid.summary,
        metricsPayload: JSON.stringify(result.coverBid.metrics),
      },
      {
        tenderId: result.tenderId,
        indicatorType: "PRICE_CLUSTERING",
        score: result.priceClustering.score !== null ? String(result.priceClustering.score) : null,
        status: result.priceClustering.status,
        methodologyVersion: result.priceClustering.methodologyVersion,
        sampleSize: result.priceClustering.sampleSize,
        threshold: String(result.priceClustering.threshold),
        confidence: String(result.priceClustering.confidence),
        summary: result.priceClustering.summary,
        metricsPayload: JSON.stringify(result.priceClustering.metrics),
      },
      ...(result.participationNetwork
        ? [
            {
              tenderId: result.tenderId,
              indicatorType: "PARTICIPATION_NETWORK",
              score: result.participationNetwork.score !== null ? String(result.participationNetwork.score) : null,
              status: result.participationNetwork.status,
              methodologyVersion: result.participationNetwork.methodologyVersion,
              sampleSize: result.participationNetwork.sampleSize,
              threshold: String(result.participationNetwork.threshold),
              confidence: String(result.participationNetwork.confidence),
              summary: result.participationNetwork.summary,
              metricsPayload: JSON.stringify(result.participationNetwork.metrics),
            },
          ]
        : []),
      ...(result.neatLoss
        ? [
            {
              tenderId: result.tenderId,
              indicatorType: "NEAT_LOSS",
              score: result.neatLoss.score !== null ? String(result.neatLoss.score) : null,
              status: result.neatLoss.status,
              methodologyVersion: result.neatLoss.methodologyVersion,
              sampleSize: result.neatLoss.sampleSize,
              threshold: String(result.neatLoss.threshold),
              confidence: String(result.neatLoss.confidence),
              summary: result.neatLoss.summary,
              metricsPayload: JSON.stringify(result.neatLoss.metrics),
            },
          ]
        : []),
    ]);

    // Persist combined risk score record
    try {
      const inserted = await db
        .insert(riskScoresTable)
        .values({
          tenderId: result.tenderId,
          rotationScore: result.winnerRotation.score !== null ? String(result.winnerRotation.score) : null,
          coverBidScore: result.coverBid.score !== null ? String(result.coverBid.score) : null,
          priceClusterScore: result.priceClustering.score !== null ? String(result.priceClustering.score) : null,
          networkScore: result.participationNetwork?.score !== null ? String(result.participationNetwork?.score) : null,
          neatLossScore: result.neatLoss?.score !== null ? String(result.neatLoss?.score) : null,
          overallScore:
            result.combinedRisk?.overallScore !== null && result.combinedRisk?.overallScore !== undefined
              ? String(result.combinedRisk.overallScore)
              : null,
          overallStatus: result.combinedRisk?.overallStatus ?? "INSUFFICIENT_DATA",
          riskLevel: result.combinedRisk?.screeningLevel ?? "INSUFFICIENT DATA",
          availableIndicatorCount: result.combinedRisk?.availableIndicatorCount ?? 0,
          totalIndicatorCount: result.combinedRisk?.totalIndicatorCount ?? 5,
          evidenceCount: result.combinedRisk?.evidenceBreakdown?.totalCount ?? result.evidence.length,
          methodologyVersion: result.combinedRisk?.methodologyVersion ?? "combined_risk_v1.0",
          calculatedAt: new Date(result.calculatedAt || Date.now()),
        })
        .returning();

      if (inserted && inserted.length > 0 && result.evidence.length > 0) {
        const riskScoreId = inserted[0].id;
        const evidenceRows = result.evidence.slice(0, 50).map((ev) => ({
          riskScoreId,
          indicatorType: ev.indicatorType,
          description: ev.description,
          metric: ev.metric,
          observedValue: ev.observedValue,
          expectedValue: ev.expectedValue,
          confidence: String(ev.confidence),
          severity: ev.severity,
        }));
        await db.insert(evidenceTable).values(evidenceRows);
      }
    } catch {
      // In-memory fallback
    }
  }

  /**
   * Phase 5: Returns the complete bipartite graph, metrics, recurring pairs, and groups.
   */
  public async getOverallNetwork(filters?: {
    category?: string;
    organization?: string;
    state?: string;
    startDate?: string;
    endDate?: string;
    minParticipationFrequency?: number;
    minSharedTenders?: number;
  }): Promise<OverallNetworkAnalytics> {
    let tendersList = this.getNormalizedTenders();
    if (filters?.category) {
      tendersList = tendersList.filter((t) => t.category === filters.category);
    }
    if (filters?.organization) {
      tendersList = tendersList.filter((t) => t.organization === filters.organization);
    }
    if (filters?.state) {
      tendersList = tendersList.filter((t) => t.state === filters.state);
    }
    if (filters?.startDate) {
      tendersList = tendersList.filter((t) => t.tenderDate >= filters.startDate!);
    }
    if (filters?.endDate) {
      tendersList = tendersList.filter((t) => t.tenderDate <= filters.endDate!);
    }

    const companyEntities = this.getCompanyEntities();
    const graph = buildParticipationGraph(tendersList, companyEntities, this.config);
    const minShared = filters?.minSharedTenders ?? 2;
    const minFreq = filters?.minParticipationFrequency ?? 0;

    let pairs = calculateCoParticipationPairs(tendersList, companyEntities, this.config);
    if (minShared > 1) {
      pairs = pairs.filter((p) => p.sharedTenderCount >= minShared);
    }
    if (minFreq > 0) {
      pairs = pairs.filter((p) => p.participationFrequency >= minFreq);
    }

    const recurringBidderGroups = identifyRecurringBidderGroups(tendersList, companyEntities, 3, Math.max(2, minShared));

    const totalCompanies = graph.companyNodes.length;
    const totalTenders = graph.tenderNodes.length;
    const totalEdges = graph.edges.length;
    const totalPairs = pairs.length;
    const recurringPairsCount = pairs.filter((p) => p.sharedTenderCount >= minShared).length;

    const avgDegree =
      totalCompanies > 0
        ? Math.round((graph.companyNodes.reduce((sum, n) => sum + n.degree, 0) / totalCompanies) * 10) / 10
        : 0;

    const density =
      totalCompanies > 0 && totalTenders > 0
        ? Math.round((totalEdges / (totalCompanies * totalTenders)) * 1000) / 1000
        : 0;

    const indicatorsCount =
      pairs.filter((p) => p.status !== "LOW_INDICATOR").length + recurringBidderGroups.length;

    return {
      bipartiteGraph: {
        nodes: graph.allNodes,
        companyNodes: graph.companyNodes,
        tenderNodes: graph.tenderNodes,
        edges: graph.edges,
        coParticipationEdges: graph.coParticipationEdges,
      },
      summaryStatistics: {
        totalCompanies,
        totalTenders,
        totalParticipationEdges: totalEdges,
        totalCoParticipationPairs: totalPairs,
        recurringPairsCount,
        recurringGroupsCount: recurringBidderGroups.length,
        averageCompanyDegree: avgDegree,
        networkDensity: density,
      },
      topRecurringPairs: pairs.slice(0, 20),
      recurringBidderGroups: recurringBidderGroups.slice(0, 15),
      networkIndicatorsCount: indicatorsCount,
      calculatedAt: new Date().toISOString(),
      methodologyVersion: "participation_network_v1.0",
    };
  }

  /**
   * Phase 5: Detailed company network analysis.
   */
  public async getCompanyNetwork(companyId: number): Promise<CompanyNetworkAnalysis | null> {
    const company = companies.find((c) => c.id === companyId);
    if (!company) return null;
    const allTenders = this.getNormalizedTenders();
    const companyEntities = this.getCompanyEntities();
    return detectCompanyNetwork(companyId, allTenders, companyEntities, this.config);
  }

  /**
   * Phase 5: Detailed relationship between two companies.
   */
  public async getCompanyRelationship(companyAId: number, companyBId: number): Promise<CoParticipationPair> {
    const allTenders = this.getNormalizedTenders();
    const companyEntities = this.getCompanyEntities();
    return detectPairRelationship(companyAId, companyBId, allTenders, companyEntities, this.config);
  }

  /**
   * Phase 5: Queryable traceable network evidence.
   */
  public async getNetworkEvidence(filters?: {
    company?: string | number;
    organization?: string;
    category?: string;
    state?: string;
    startDate?: string;
    endDate?: string;
    minSharedTenders?: number;
  }): Promise<AnalyticsEvidence[]> {
    let tendersList = this.getNormalizedTenders();
    if (filters?.organization) {
      tendersList = tendersList.filter((t) => t.organization === filters.organization);
    }
    if (filters?.category) {
      tendersList = tendersList.filter((t) => t.category === filters.category);
    }
    if (filters?.state) {
      tendersList = tendersList.filter((t) => t.state === filters.state);
    }
    if (filters?.startDate) {
      tendersList = tendersList.filter((t) => t.tenderDate >= filters.startDate!);
    }
    if (filters?.endDate) {
      tendersList = tendersList.filter((t) => t.tenderDate <= filters.endDate!);
    }

    const companyEntities = this.getCompanyEntities();
    const minShared = filters?.minSharedTenders ?? 2;
    const pairs = calculateCoParticipationPairs(tendersList, companyEntities, this.config);
    const groups = identifyRecurringBidderGroups(tendersList, companyEntities, 3, minShared);

    const evidence: AnalyticsEvidence[] = [];

    let targetCompanyId: number | null = null;
    if (filters?.company) {
      const parsedId = Number(filters.company);
      if (!isNaN(parsedId)) {
        targetCompanyId = parsedId;
      } else {
        const found = companies.find((c) =>
          c.canonicalName.toLowerCase().includes(String(filters.company).toLowerCase())
        );
        if (found) targetCompanyId = found.id;
      }
    }

    pairs.forEach((pair) => {
      if (pair.sharedTenderCount >= minShared) {
        if (!targetCompanyId || pair.companyAId === targetCompanyId || pair.companyBId === targetCompanyId) {
          evidence.push(generatePairEvidence(pair));
        }
      }
    });

    groups.forEach((group) => {
      if (!targetCompanyId || group.companyIds.includes(targetCompanyId)) {
        evidence.push(generateGroupEvidence(group));
      }
    });

    return evidence;
  }

  /**
   * Phase 5: Recalculate network analytics from normalized records.
   */
  public async recalculateNetwork(): Promise<{
    analyzedCompanies: number;
    pairsAnalyzed: number;
    recurringGroupsDetected: number;
    methodologyVersion: string;
    calculatedAt: string;
  }> {
    const allTenders = this.getNormalizedTenders();
    const companyEntities = this.getCompanyEntities();
    const pairs = calculateCoParticipationPairs(allTenders, companyEntities, this.config);
    const groups = identifyRecurringBidderGroups(allTenders, companyEntities, 3, 2);

    try {
      for (const pair of pairs.filter((p) => p.sharedTenderCount >= 2)) {
        await db
          .insert(networkRelationshipsTable)
          .values({
            companyAId: pair.companyAId,
            companyBId: pair.companyBId,
            sharedTenderCount: pair.sharedTenderCount,
            comparableTenderCount: pair.comparableTenderCount,
            participationFrequency: String(pair.participationFrequency),
            networkScore: pair.networkScore !== null ? String(pair.networkScore) : null,
            status: pair.status,
            methodologyVersion: "participation_network_v1.0",
          })
          .onConflictDoNothing();
      }
    } catch {
      // In-memory fallback
    }

    return {
      analyzedCompanies: companyEntities.length,
      pairsAnalyzed: pairs.length,
      recurringGroupsDetected: groups.length,
      methodologyVersion: "participation_network_v1.0",
      calculatedAt: new Date().toISOString(),
    };
  }

  /**
   * Phase 6: Returns overall too-neat losing bid screening summary and top signals across companies.
   */
  public async getNeatLossAnalytics(filters?: {
    category?: string;
    organization?: string;
    minScore?: number;
    status?: string;
  }): Promise<OverallNeatLossSummary> {
    const allTenders = this.getNormalizedTenders();
    const companyEntities = this.getCompanyEntities();
    const metricsList: CompanyNeatLossMetrics[] = [];
    const allEvidence: AnalyticsEvidence[] = [];

    for (const company of companyEntities) {
      const canonicalId = `CMP-${String(company.id).padStart(3, "0")}`;
      const res = detectCompanyNeatLoss(
        company.id,
        company.canonicalName,
        canonicalId,
        allTenders,
        this.config,
        filters
      );
      metricsList.push(res.metrics);
      if (res.metrics.status !== "INSUFFICIENT_DATA" && (res.metrics.score ?? 0) >= 30) {
        allEvidence.push(...res.evidence);
      }
    }

    let filtered = metricsList;
    if (filters?.minScore !== undefined) {
      filtered = filtered.filter((m) => (m.score ?? 0) >= filters.minScore!);
    }
    if (filters?.status) {
      filtered = filtered.filter((m) => m.status === filters.status);
    }

    filtered.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

    const elevatedCompaniesCount = metricsList.filter(
      (m) => m.status === "ELEVATED INDICATOR" || m.status === "HIGH INDICATOR"
    ).length;
    const moderateCompaniesCount = metricsList.filter(
      (m) => m.status === "MODERATE INDICATOR"
    ).length;
    const insufficientDataCount = metricsList.filter(
      (m) => m.status === "INSUFFICIENT_DATA"
    ).length;

    return {
      totalCompaniesAnalyzed: companyEntities.length,
      elevatedCompaniesCount,
      moderateCompaniesCount,
      insufficientDataCount,
      topSignals: filtered.slice(0, 20),
      recentEvidence: allEvidence.slice(0, 25),
      methodologyVersion: this.config.neatLossMethodologyVersion,
      calculatedAt: new Date().toISOString(),
    };
  }

  /**
   * Phase 6: Returns detailed too-neat losing bid analysis for a single company.
   */
  public async getCompanyNeatLoss(
    companyId: number,
    filters?: { category?: string; organization?: string }
  ): Promise<NeatLossDetectionResult | null> {
    const company = companies.find((c) => c.id === companyId);
    if (!company) return null;
    const allTenders = this.getNormalizedTenders();
    const canonicalId = `CMP-${String(company.id).padStart(3, "0")}`;
    return detectCompanyNeatLoss(
      companyId,
      company.canonicalName,
      canonicalId,
      allTenders,
      this.config,
      filters
    );
  }

  /**
   * Phase 6: Returns losing-bid analysis for a tender and its participating bidders.
   */
  public async getTenderNeatLoss(tenderId: number): Promise<TenderNeatLossAnalysis | null> {
    const allTenders = this.getNormalizedTenders();
    const target = allTenders.find((t) => t.id === tenderId);
    if (!target) return null;
    return detectTenderNeatLoss(target, allTenders, this.config);
  }

  /**
   * Phase 6: Returns queryable traceable evidence generated by too-neat losing bid screening.
   */
  public async getNeatLossEvidence(filters?: {
    companyId?: number;
    category?: string;
    organization?: string;
    minScore?: number;
  }): Promise<AnalyticsEvidence[]> {
    const allTenders = this.getNormalizedTenders();
    const companyEntities = this.getCompanyEntities();
    const evidenceList: AnalyticsEvidence[] = [];

    const targetCompanies = filters?.companyId
      ? companyEntities.filter((c) => c.id === filters.companyId)
      : companyEntities;

    for (const comp of targetCompanies) {
      const canonicalId = `CMP-${String(comp.id).padStart(3, "0")}`;
      const res = detectCompanyNeatLoss(
        comp.id,
        comp.canonicalName,
        canonicalId,
        allTenders,
        this.config,
        filters
      );
      if (
        filters?.minScore === undefined ||
        (res.metrics.score ?? 0) >= filters.minScore
      ) {
        evidenceList.push(...res.evidence);
      }
    }

    return evidenceList;
  }

  /**
   * Phase 6: Recalculates too-neat losing bid metrics across normalized records and persists them.
   */
  public async recalculateNeatLoss(): Promise<{
    analyzedCompanies: number;
    elevatedSignalsDetected: number;
    methodologyVersion: string;
    calculatedAt: string;
  }> {
    const allTenders = this.getNormalizedTenders();
    const companyEntities = this.getCompanyEntities();
    let elevatedCount = 0;

    for (const comp of companyEntities) {
      const canonicalId = `CMP-${String(comp.id).padStart(3, "0")}`;
      const res = detectCompanyNeatLoss(
        comp.id,
        comp.canonicalName,
        canonicalId,
        allTenders,
        this.config
      );

      if (res.metrics.status === "ELEVATED INDICATOR" || res.metrics.status === "HIGH INDICATOR") {
        elevatedCount++;
      }

      try {
        await db
          .insert(neatLossMetricsTable)
          .values({
            companyId: comp.id,
            comparisonGroup: res.metrics.comparisonGroup,
            participationCount: res.metrics.participationCount,
            winCount: res.metrics.winCount,
            lossCount: res.metrics.lossCount,
            winRate: String(res.metrics.winRate),
            lossRate: String(res.metrics.lossRate),
            meanBidRank: String(res.metrics.meanBidRank),
            medianBidRank: String(res.metrics.medianBidRank),
            rankStdDev: String(res.metrics.rankStdDev),
            minBidRank: res.metrics.minBidRank,
            maxBidRank: res.metrics.maxBidRank,
            meanRelativeGap: res.metrics.meanRelativeGapPct !== null ? String(res.metrics.meanRelativeGapPct) : null,
            medianRelativeGap: res.metrics.medianRelativeGapPct !== null ? String(res.metrics.medianRelativeGapPct) : null,
            relativeGapStdDev: res.metrics.relativeGapStdDev !== null ? String(res.metrics.relativeGapStdDev) : null,
            relativeGapCv: res.metrics.relativeGapCv !== null ? String(res.metrics.relativeGapCv) : null,
            repeatedRankCount: res.metrics.repeatedRankCount,
            repeatedGroupCount: res.metrics.repeatedBidderGroupCount,
            sampleSize: res.metrics.sampleSize,
            score: res.metrics.score !== null ? String(res.metrics.score) : null,
            status: res.metrics.status,
            methodologyVersion: this.config.neatLossMethodologyVersion,
          })
          .onConflictDoNothing();
      } catch {
        // Fallback in memory
      }
    }

    return {
      analyzedCompanies: companyEntities.length,
      elevatedSignalsDetected: elevatedCount,
      methodologyVersion: this.config.neatLossMethodologyVersion,
      calculatedAt: new Date().toISOString(),
    };
  }

  /**
   * Phase 7: Returns the combined screening result for a single tender.
   */
  public async getCombinedScreeningForTender(tenderId: number): Promise<CombinedScreeningResult | null> {
    const analytics = await this.getTenderAnalytics(tenderId);
    return analytics?.combinedRisk ?? null;
  }

  /**
   * Phase 7: Returns list of combined screening evaluations across all tenders with summary metrics.
   */
  public async getCombinedScreeningList(filters?: {
    minScore?: number;
    screeningLevel?: string;
    status?: string;
    category?: string;
    organization?: string;
    search?: string;
  }): Promise<{
    items: CombinedScreeningListItem[];
    total: number;
    summary: CombinedScreeningSummary;
  }> {
    const allTenders = this.getNormalizedTenders();
    const rawItems: CombinedScreeningListItem[] = [];

    let totalEvidenceRecords = 0;
    let sufficientEvidenceCount = 0;
    let requiringReviewCount = 0;
    const scores: number[] = [];

    const availabilityMap: Record<
      "WINNER_ROTATION" | "COVER_BID" | "PRICE_CLUSTERING" | "PARTICIPATION_NETWORK" | "NEAT_LOSS",
      { available: number; insufficient: number }
    > = {
      WINNER_ROTATION: { available: 0, insufficient: 0 },
      COVER_BID: { available: 0, insufficient: 0 },
      PRICE_CLUSTERING: { available: 0, insufficient: 0 },
      PARTICIPATION_NETWORK: { available: 0, insufficient: 0 },
      NEAT_LOSS: { available: 0, insufficient: 0 },
    };

    const levelDist = {
      low: 0,
      moderate: 0,
      elevated: 0,
      high: 0,
      insufficient: 0,
    };

    for (const t of allTenders) {
      const analytics = await this.getTenderAnalytics(t.id);
      const combined = analytics?.combinedRisk;

      if (combined) {
        totalEvidenceRecords += combined.evidenceBreakdown?.totalCount ?? 0;

        if (combined.overallStatus === "EVALUATED") {
          sufficientEvidenceCount++;
          if (combined.overallScore !== null) {
            scores.push(combined.overallScore);
            if (combined.overallScore >= 50) {
              requiringReviewCount++;
            }
          }
        }

        // Indicator availability
        if (combined.indicators) {
          for (const key of Object.keys(availabilityMap) as (keyof typeof availabilityMap)[]) {
            if (combined.indicators[key]?.status === "AVAILABLE") {
              availabilityMap[key].available++;
            } else {
              availabilityMap[key].insufficient++;
            }
          }
        }

        // Level distribution
        if (combined.screeningLevel === "LOW SCREENING SIGNAL") levelDist.low++;
        else if (combined.screeningLevel === "MODERATE SCREENING SIGNAL") levelDist.moderate++;
        else if (combined.screeningLevel === "ELEVATED SCREENING SIGNAL") levelDist.elevated++;
        else if (combined.screeningLevel === "HIGH SCREENING SIGNAL") levelDist.high++;
        else levelDist.insufficient++;

        rawItems.push({
          id: t.id,
          tenderId: t.id,
          tenderNumber: t.tenderNumber,
          title: t.title ?? "",
          organization: t.organization,
          category: t.category,
          estimatedValue: t.estimatedValue,
          tenderDate: t.tenderDate,
          overallScore: combined.overallScore,
          overallStatus: combined.overallStatus,
          screeningLevel: combined.screeningLevel,
          availableIndicatorCount: combined.availableIndicatorCount,
          totalEvidenceCount: combined.evidenceBreakdown?.totalCount ?? 0,
          topIndicators: combined.topIndicators ?? [],
          calculatedAt: combined.calculatedAt,
        });
      }
    }

    const avgScore = scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : 0;

    const summary: CombinedScreeningSummary = {
      totalTendersAnalyzed: allTenders.length,
      tendersWithSufficientEvidence: sufficientEvidenceCount,
      tendersRequiringReview: requiringReviewCount,
      averageScreeningScore: avgScore,
      totalEvidenceRecords,
      indicatorAvailability: availabilityMap,
      levelDistribution: levelDist,
    };

    // Filter items
    let filtered = rawItems;
    if (filters?.minScore !== undefined) {
      filtered = filtered.filter((i) => i.overallScore !== null && i.overallScore >= filters.minScore!);
    }
    if (filters?.status) {
      filtered = filtered.filter((i) => i.overallStatus === filters.status);
    }
    if (filters?.screeningLevel) {
      filtered = filtered.filter((i) => i.screeningLevel === filters.screeningLevel);
    }
    if (filters?.category) {
      filtered = filtered.filter((i) => i.category.toLowerCase().includes(filters.category!.toLowerCase()));
    }
    if (filters?.organization) {
      filtered = filtered.filter((i) => i.organization.toLowerCase().includes(filters.organization!.toLowerCase()));
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      filtered = filtered.filter(
        (i) =>
          i.tenderNumber.toLowerCase().includes(q) ||
          i.title.toLowerCase().includes(q) ||
          i.organization.toLowerCase().includes(q) ||
          i.category.toLowerCase().includes(q)
      );
    }

    // Sort by overallScore desc (evaluated first, highest score first)
    filtered.sort((a, b) => {
      if (a.overallScore === null && b.overallScore === null) return 0;
      if (a.overallScore === null) return 1;
      if (b.overallScore === null) return -1;
      return b.overallScore - a.overallScore;
    });

    return {
      items: filtered,
      total: filtered.length,
      summary,
    };
  }

  /**
   * Phase 7: Returns combined screening profile and history for an individual company.
   */
  public async getCombinedScreeningForCompany(companyId: number): Promise<CompanyCombinedScreeningResult | null> {
    const company = companies.find((c) => c.id === companyId);
    if (!company) return null;

    const allTenders = this.getNormalizedTenders();
    const companyEntities = this.getCompanyEntities();
    const canonicalId = `CMP-${String(company.id).padStart(3, "0")}`;

    // 1. Participation Network indicator
    const netAnalysis = detectCompanyNetwork(companyId, allTenders, companyEntities, this.config);

    // 2. Too-Neat Loss indicator
    const neatLossAnalysis = detectCompanyNeatLoss(companyId, company.canonicalName, canonicalId, allTenders, this.config);

    // 3. Winner rotation indicator for company
    const companyTenders = allTenders.filter((t) => t.bids.some((b) => b.companyId === companyId));
    let rotationIndicator: AnalyticsIndicator;
    if (companyTenders.length < 2) {
      rotationIndicator = {
        indicatorType: "WINNER_ROTATION",
        score: null,
        status: "INSUFFICIENT_DATA",
        methodologyVersion: "winner_rotation_v1.0",
        calculatedAt: new Date().toISOString(),
        sampleSize: companyTenders.length,
        threshold: 60,
        confidence: 0,
        summary: `Insufficient historical comparable tenders (${companyTenders.length}) to evaluate company-level rotation pattern.`,
        metrics: [],
        evidenceCount: 0,
      };
    } else {
      const rotScores: number[] = [];
      for (const t of companyTenders) {
        const a = await this.getTenderAnalytics(t.id);
        if (a?.winnerRotation?.score !== null && a?.winnerRotation?.score !== undefined) {
          rotScores.push(a.winnerRotation.score);
        }
      }
      if (rotScores.length >= 2) {
        const avgRot = Math.round(rotScores.reduce((a, b) => a + b, 0) / rotScores.length);
        rotationIndicator = {
          indicatorType: "WINNER_ROTATION",
          score: avgRot,
          status: scoreToScreeningStatus(avgRot, false, this.config),
          methodologyVersion: "winner_rotation_v1.0",
          calculatedAt: new Date().toISOString(),
          sampleSize: rotScores.length,
          threshold: 60,
          confidence: 0.8,
          summary: `Average rotation score of ${avgRot} observed across ${rotScores.length} participated tenders.`,
          metrics: [{ key: "avg_rotation_score", label: "Average tender rotation score", value: avgRot, formatted: `${avgRot}/100` }],
          evidenceCount: 0,
        };
      } else {
        rotationIndicator = {
          indicatorType: "WINNER_ROTATION",
          score: null,
          status: "INSUFFICIENT_DATA",
          methodologyVersion: "winner_rotation_v1.0",
          calculatedAt: new Date().toISOString(),
          sampleSize: companyTenders.length,
          threshold: 60,
          confidence: 0,
          summary: "Insufficient rotation screening observations.",
          metrics: [],
          evidenceCount: 0,
        };
      }
    }

    // 4. Cover-bid indicator for company
    let coverBidIndicator: AnalyticsIndicator;
    if (companyTenders.length < 2) {
      coverBidIndicator = {
        indicatorType: "COVER_BID",
        score: null,
        status: "INSUFFICIENT_DATA",
        methodologyVersion: "cover_bid_v1.0",
        calculatedAt: new Date().toISOString(),
        sampleSize: companyTenders.length,
        threshold: 60,
        confidence: 0,
        summary: "Insufficient historical tenders to evaluate company-level cover bidding.",
        metrics: [],
        evidenceCount: 0,
      };
    } else {
      const covScores: number[] = [];
      for (const t of companyTenders) {
        const a = await this.getTenderAnalytics(t.id);
        if (a?.coverBid?.score !== null && a?.coverBid?.score !== undefined) {
          covScores.push(a.coverBid.score);
        }
      }
      if (covScores.length >= 2) {
        const avgCov = Math.round(covScores.reduce((a, b) => a + b, 0) / covScores.length);
        coverBidIndicator = {
          indicatorType: "COVER_BID",
          score: avgCov,
          status: scoreToScreeningStatus(avgCov, false, this.config),
          methodologyVersion: "cover_bid_v1.0",
          calculatedAt: new Date().toISOString(),
          sampleSize: covScores.length,
          threshold: 60,
          confidence: 0.8,
          summary: `Average cover-bid screening score of ${avgCov} observed across ${covScores.length} participated tenders.`,
          metrics: [{ key: "avg_cover_score", label: "Average tender cover-bid score", value: avgCov, formatted: `${avgCov}/100` }],
          evidenceCount: 0,
        };
      } else {
        coverBidIndicator = {
          indicatorType: "COVER_BID",
          score: null,
          status: "INSUFFICIENT_DATA",
          methodologyVersion: "cover_bid_v1.0",
          calculatedAt: new Date().toISOString(),
          sampleSize: companyTenders.length,
          threshold: 60,
          confidence: 0,
          summary: "Insufficient cover-bid screening observations.",
          metrics: [],
          evidenceCount: 0,
        };
      }
    }

    // 5. Price clustering indicator for company
    let priceClusterIndicator: AnalyticsIndicator;
    if (companyTenders.length < 2) {
      priceClusterIndicator = {
        indicatorType: "PRICE_CLUSTERING",
        score: null,
        status: "INSUFFICIENT_DATA",
        methodologyVersion: "price_clustering_v1.0",
        calculatedAt: new Date().toISOString(),
        sampleSize: companyTenders.length,
        threshold: 60,
        confidence: 0,
        summary: "Insufficient historical tenders to evaluate price clustering.",
        metrics: [],
        evidenceCount: 0,
      };
    } else {
      const pcScores: number[] = [];
      for (const t of companyTenders) {
        const a = await this.getTenderAnalytics(t.id);
        if (a?.priceClustering?.score !== null && a?.priceClustering?.score !== undefined) {
          pcScores.push(a.priceClustering.score);
        }
      }
      if (pcScores.length >= 2) {
        const avgPc = Math.round(pcScores.reduce((a, b) => a + b, 0) / pcScores.length);
        priceClusterIndicator = {
          indicatorType: "PRICE_CLUSTERING",
          score: avgPc,
          status: scoreToScreeningStatus(avgPc, false, this.config),
          methodologyVersion: "price_clustering_v1.0",
          calculatedAt: new Date().toISOString(),
          sampleSize: pcScores.length,
          threshold: 60,
          confidence: 0.8,
          summary: `Average price clustering score of ${avgPc} observed across ${pcScores.length} participated tenders.`,
          metrics: [{ key: "avg_pc_score", label: "Average tender price clustering score", value: avgPc, formatted: `${avgPc}/100` }],
          evidenceCount: 0,
        };
      } else {
        priceClusterIndicator = {
          indicatorType: "PRICE_CLUSTERING",
          score: null,
          status: "INSUFFICIENT_DATA",
          methodologyVersion: "price_clustering_v1.0",
          calculatedAt: new Date().toISOString(),
          sampleSize: companyTenders.length,
          threshold: 60,
          confidence: 0,
          summary: "Insufficient price clustering screening observations.",
          metrics: [],
          evidenceCount: 0,
        };
      }
    }

    const allEvidence: AnalyticsEvidence[] = [
      ...netAnalysis.evidence,
      ...neatLossAnalysis.evidence,
    ];

    return calculateCompanyCombinedScreening(
      {
        companyId: company.id,
        companyName: company.canonicalName,
        canonicalId,
        tendersAnalyzed: companyTenders.length,
      },
      {
        rotation: rotationIndicator,
        coverBid: coverBidIndicator,
        priceClustering: priceClusterIndicator,
        network: netAnalysis.indicator,
        neatLoss: neatLossAnalysis.indicator,
      },
      allEvidence,
      this.config
    );
  }

  /**
   * Phase 7: Returns all supporting evidence for a combined screening review.
   */
  public async getCombinedScreeningEvidence(id: number | string): Promise<AnalyticsEvidence[]> {
    const parsedId = Number(id);
    if (!isNaN(parsedId)) {
      const analytics = await this.getTenderAnalytics(parsedId);
      if (analytics) {
        return analytics.evidence;
      }
    }
    return [];
  }

  /**
   * Phase 7: Returns the complete indicator contribution breakdown for a tender.
   */
  public async getCombinedScreeningBreakdown(tenderId: number): Promise<{
    tenderId: number;
    tenderNumber: string;
    overallScore: number | null;
    overallStatus: string;
    screeningLevel: string;
    availableIndicatorCount: number;
    totalIndicatorCount: number;
    indicators: Record<string, IndicatorContribution>;
    topIndicators: StrongestIndicator[];
    evidenceSummary: string;
    evidenceBreakdown: EvidenceBreakdown;
    methodologyVersion: string;
    calculatedAt: string;
  } | null> {
    const analytics = await this.getTenderAnalytics(tenderId);
    if (!analytics || !analytics.combinedRisk) return null;

    const cr = analytics.combinedRisk;
    return {
      tenderId,
      tenderNumber: analytics.tenderNumber,
      overallScore: cr.overallScore,
      overallStatus: cr.overallStatus,
      screeningLevel: cr.screeningLevel,
      availableIndicatorCount: cr.availableIndicatorCount,
      totalIndicatorCount: cr.totalIndicatorCount,
      indicators: cr.indicators,
      topIndicators: cr.topIndicators,
      evidenceSummary: cr.evidenceSummary,
      evidenceBreakdown: cr.evidenceBreakdown,
      methodologyVersion: cr.methodologyVersion,
      calculatedAt: cr.calculatedAt,
    };
  }

  /**
   * Phase 7: Recalculates combined scores across all or specified tenders.
   */
  public async recalculateCombinedRisk(tenderIds?: number[]): Promise<{
    analyzed: number;
    sufficientEvidenceCount: number;
    elevatedSignalsCount: number;
    methodologyVersion: string;
    calculatedAt: string;
  }> {
    const allTenders = this.getNormalizedTenders();
    const targets =
      tenderIds && tenderIds.length > 0
        ? allTenders.filter((t) => tenderIds.includes(t.id))
        : allTenders;

    this.cache.clear();
    let sufficientCount = 0;
    let elevatedCount = 0;

    for (const target of targets) {
      const res = await this.analyzeTender(target.id);
      if (res?.combinedRisk?.overallStatus === "EVALUATED") {
        sufficientCount++;
        if ((res.combinedRisk.overallScore ?? 0) >= 50) {
          elevatedCount++;
        }
      }
    }

    return {
      analyzed: targets.length,
      sufficientEvidenceCount: sufficientCount,
      elevatedSignalsCount: elevatedCount,
      methodologyVersion: this.config.combinedRiskMethodologyVersion ?? "combined_risk_v1.0",
      calculatedAt: new Date().toISOString(),
    };
  }
}

export const analyticsService = new AnalyticsService();

