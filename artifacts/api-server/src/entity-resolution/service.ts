/**
 * BidShield Entity Resolution Service
 * Phase 19: Complete Entity Resolution Management, Lineage & Downstream Integration.
 */

import {
  bidsTable,
  checkDatabaseConnection,
  companiesTable,
  companyAliasesTable,
  db,
  entityMatchesTable,
  tendersTable,
  tenderParticipantsTable,
} from "@workspace/db";
import { eq, or, sql } from "drizzle-orm";
import {
  DuplicateCanonicalCandidate,
  EntityMatchCandidate,
  EntityMatchRecord,
  EntityResolutionStats,
  NormalizedCompanyData,
  ResolutionOutcome,
  ResolutionStatus,
} from "./types.js";
import { normalizeCompany, normalizeCompanyName } from "./normalizer.js";
import { scoreMatch } from "./matcher.js";
import { BlockingIndex } from "./blocking.js";
import { scanCanonicalDuplicates } from "./duplicateDetector.js";
import { companies as demoCompanies, tenders as demoTenders } from "../lib/bidshieldData.js";

export class EntityResolutionService {
  private static instance: EntityResolutionService;
  private blockingIndex = new BlockingIndex();
  private inMemoryMatches: EntityMatchRecord[] = [];
  private inMemoryAliases: Array<{
    id: number;
    companyId: number;
    aliasName: string;
    normalizedAlias: string;
    aliasType: string;
    confidence: number;
    status: string;
    source: string;
  }> = [];
  private initialized = false;

  private constructor() {}

  public static getInstance(): EntityResolutionService {
    if (!EntityResolutionService.instance) {
      EntityResolutionService.instance = new EntityResolutionService();
    }
    return EntityResolutionService.instance;
  }

  /**
   * Initializes the candidate blocking index from database or demo companies.
   */
  public async initialize(): Promise<void> {
    const candidates = await this.getAllCandidates();
    this.blockingIndex.loadCandidates(candidates);
    this.initialized = true;
  }

  /**
   * Retrieves all candidate canonical companies (from DB if available, else demo data).
   */
  public async getAllCandidates(): Promise<EntityMatchCandidate[]> {
    const isDb = await checkDatabaseConnection().catch(() => false);
    if (isDb) {
      try {
        const dbCompanies = await db.select().from(companiesTable);
        const dbAliases = await db.select().from(companyAliasesTable);

        const aliasMap = new Map<number, string[]>();
        for (const a of dbAliases) {
          if (!aliasMap.has(a.companyId)) aliasMap.set(a.companyId, []);
          aliasMap.get(a.companyId)!.push(a.aliasName);
        }

        return dbCompanies.map((c) => ({
          companyId: c.id,
          canonicalName: c.canonicalName,
          normalizedName: c.normalizedName,
          gstin: c.gstin || null,
          registrationNumber: c.registrationNumber || null,
          address: c.address || null,
          city: c.city || null,
          state: c.state || null,
          aliases: aliasMap.get(c.id) || [],
        }));
      } catch {
        // Fallback below
      }
    }

    // In-memory demo companies fallback
    return demoCompanies.map((c) => {
      const memoryAliases = this.inMemoryAliases
        .filter((a) => a.companyId === c.id)
        .map((a) => a.aliasName);
      return {
        companyId: c.id,
        canonicalName: c.canonicalName,
        normalizedName: c.normalizedName,
        gstin: (c as any).gstin || `33AAAA${String(c.id).padStart(4, "0")}A1Z${c.id % 9}`,
        registrationNumber: (c as any).registrationNumber || `U72900TN2020PTC${String(c.id).padStart(6, "0")}`,
        address: c.address,
        city: (c as any).city || "Chennai",
        state: c.state,
        aliases: Array.from(new Set([...(c.aliases || []), ...memoryAliases])),
      };
    });
  }

  /**
   * Resolves a single procurement source company against canonical companies.
   */
  public async resolveSingleRecord(
    sourceName: string,
    extra?: {
      gstin?: string | null;
      registrationNumber?: string | null;
      address?: string | null;
      city?: string | null;
      state?: string | null;
      source?: string;
    }
  ): Promise<EntityMatchRecord> {
    if (!this.initialized) {
      await this.initialize();
    }

    const normSource = normalizeCompany(sourceName, extra);

    // Check existing confirmed aliases first (O(1) direct alias resolution)
    const directCanonical = await this.findCanonicalForName(sourceName);
    if (directCanonical) {
      return {
        id: this.inMemoryMatches.length + 1,
        sourceName,
        originalName: sourceName,
        normalizedSourceName: normSource.normalizedName,
        suggestedCompany: directCanonical.canonicalName,
        candidateCompanyId: directCanonical.companyId,
        confidence: 100,
        score: 100,
        status: "AUTO_MATCHED",
        outcome: "AUTO_MATCH",
        nameSimilarity: 100,
        addressSimilarity: null,
        source: extra?.source || "upload",
        gstin: normSource.gstin,
        registrationNumber: normSource.registrationNumber,
        address: normSource.originalAddress,
        city: normSource.city,
        state: normSource.state,
        reasons: [`✓ Exact match via confirmed alias pointing to ${directCanonical.canonicalName}`],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    // Candidate Generation via Blocking Index
    const candidates = this.blockingIndex.findCandidates(normSource, 15);

    let bestCandidate: EntityMatchCandidate | null = null;
    let bestScore = -1;
    let bestResult: any = null;

    for (const { candidate, normalized } of candidates) {
      const matchResult = scoreMatch(normSource, normalized);
      if (matchResult.score > bestScore) {
        bestScore = matchResult.score;
        bestCandidate = candidate;
        bestResult = matchResult;
      }
    }

    // Determine Status
    let status: ResolutionStatus = "UNRESOLVED";
    let outcome: ResolutionOutcome = "NO_MATCH";

    if (bestResult) {
      outcome = bestResult.outcome;
      if (outcome === "AUTO_MATCH") {
        status = "AUTO_MATCHED";
      } else if (outcome === "REVIEW_REQUIRED") {
        status = "REVIEW_REQUIRED";
      } else {
        status = "UNRESOLVED";
      }
    }

    const record: EntityMatchRecord = {
      id: this.inMemoryMatches.length + 1,
      sourceName,
      originalName: sourceName,
      normalizedSourceName: normSource.normalizedName,
      suggestedCompany: bestCandidate?.canonicalName || null,
      candidateCompanyId: bestCandidate?.companyId || null,
      confidence: bestScore >= 0 ? bestScore : 0,
      score: bestScore >= 0 ? bestScore : 0,
      status,
      outcome,
      nameSimilarity: bestResult?.signals.nameSimilarity || 0,
      addressSimilarity: bestResult?.signals.addressSimilarity ?? null,
      source: extra?.source || "upload",
      gstin: normSource.gstin,
      registrationNumber: normSource.registrationNumber,
      address: normSource.originalAddress,
      city: normSource.city,
      state: normSource.state,
      matchSignals: bestResult?.signals,
      reasons: bestResult?.signals.reasons || ["No compatible canonical company candidate found."],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Store in-memory and in DB if available
    this.inMemoryMatches.push(record);

    return record;
  }

  /**
   * Resolves a batch of procurement rows (e.g. from CSV upload or import pipeline).
   */
  public async resolveBatch(rows: Array<Record<string, unknown>>) {
    if (!this.initialized) {
      await this.initialize();
    }

    const seenNames = new Map<string, EntityMatchRecord>();

    for (const row of rows) {
      const sourceName = String(
        row.companyNameOriginal ?? row.companyName ?? row.vendorName ?? ""
      ).trim();
      if (!sourceName || seenNames.has(sourceName)) continue;

      const gstin = String(row.gstin ?? row.gstinOriginal ?? row.taxId ?? "").trim() || null;
      const reg = String(row.registrationNumber ?? row.cin ?? row.companyReg ?? "").trim() || null;
      const address = String(row.address ?? row.location ?? "").trim() || null;
      const city = String(row.city ?? row.location ?? "").trim() || null;
      const state = String(row.state ?? "").trim() || null;

      const match = await this.resolveSingleRecord(sourceName, {
        gstin,
        registrationNumber: reg,
        address,
        city,
        state,
        source: "upload",
      });

      seenNames.set(sourceName, match);
    }

    const list = Array.from(seenNames.values());
    return {
      matches: list,
      resolvedCount: list.filter((m) => m.status === "AUTO_MATCHED").length,
      reviewCount: list.filter((m) => m.status === "REVIEW_REQUIRED").length,
      unresolvedCount: list.filter((m) => m.status === "UNRESOLVED").length,
    };
  }

  /**
   * Confirms an entity match, adding it as an alias and relinking downstream bids.
   */
  public async confirmMatch(matchId: number, reviewer = "Senior Investigator", reason = "Confirmed via manual review"): Promise<EntityMatchRecord | null> {
    const match = this.inMemoryMatches.find((m) => m.id === matchId);
    if (!match) return null;

    match.status = "CONFIRMED";
    match.reviewedBy = reviewer;
    match.reviewedAt = new Date().toISOString();
    match.reviewReason = reason;

    if (match.candidateCompanyId && match.sourceName) {
      // 1. Add Alias
      await this.addAlias(
        match.candidateCompanyId,
        match.sourceName,
        "manual_confirmed",
        match.confidence,
        "manual_review"
      );

      // 2. Relink downstream bids from sourceName to candidateCompanyId
      await this.relinkBidsForSource(match.sourceName, match.candidateCompanyId);

      // 3. Trigger Analytics Recalculation
      await this.triggerDownstreamAnalyticsRecalculation();
    }

    return match;
  }

  /**
   * Rejects an entity match, ensuring records are NOT merged.
   */
  public async rejectMatch(matchId: number, reviewer = "Senior Investigator", reason = "Rejected via manual review"): Promise<EntityMatchRecord | null> {
    const match = this.inMemoryMatches.find((m) => m.id === matchId);
    if (!match) return null;

    match.status = "REJECTED";
    match.reviewedBy = reviewer;
    match.reviewedAt = new Date().toISOString();
    match.reviewReason = reason;

    return match;
  }

  /**
   * Creates a new canonical company for an unresolved source entity.
   */
  public async createCanonicalCompany(
    sourceName: string,
    canonicalName: string,
    details?: {
      address?: string | null;
      city?: string | null;
      state?: string | null;
      gstin?: string | null;
      registrationNumber?: string | null;
    },
    reviewer = "Senior Investigator"
  ): Promise<EntityMatchRecord> {
    const norm = normalizeCompany(canonicalName, details);
    const newId = demoCompanies.length + 1;

    const newCompany = {
      id: newId,
      canonicalName: canonicalName.trim(),
      normalizedName: norm.normalizedName,
      address: details?.address || "Industrial Area",
      state: details?.state || "National",
      city: details?.city || "Chennai",
      gstin: norm.gstin || null,
      registrationNumber: norm.registrationNumber || null,
      aliases: [sourceName.trim(), canonicalName.trim().toUpperCase()],
      tendersParticipated: 0,
      wins: 0,
      coParticipants: 0,
      screeningLevel: "Low" as const,
    };

    demoCompanies.push(newCompany as any);

    // Save to Database if available
    const isDb = await checkDatabaseConnection().catch(() => false);
    if (isDb) {
      try {
        const [inserted] = await db
          .insert(companiesTable)
          .values({
            canonicalName: newCompany.canonicalName,
            normalizedName: newCompany.normalizedName,
            address: newCompany.address,
            normalizedAddress: norm.normalizedAddress,
            city: newCompany.city,
            state: newCompany.state,
            gstin: newCompany.gstin,
            registrationNumber: newCompany.registrationNumber,
          })
          .returning({ id: companiesTable.id });

        if (inserted?.id) {
          newCompany.id = inserted.id;
        }
      } catch {
        // Fallback
      }
    }

    // Add sourceName as confirmed alias
    await this.addAlias(newCompany.id, sourceName, "source", 100, "manual_create");

    // Relink any bids with sourceName to this new company
    await this.relinkBidsForSource(sourceName, newCompany.id);

    // Re-index blocking index
    this.blockingIndex.addCandidate({
      companyId: newCompany.id,
      canonicalName: newCompany.canonicalName,
      normalizedName: newCompany.normalizedName,
      gstin: newCompany.gstin,
      registrationNumber: newCompany.registrationNumber,
      address: newCompany.address,
      city: newCompany.city,
      state: newCompany.state,
      aliases: newCompany.aliases,
    });

    const matchRecord: EntityMatchRecord = {
      id: this.inMemoryMatches.length + 1,
      sourceName,
      originalName: sourceName,
      normalizedSourceName: normalizeCompanyName(sourceName),
      suggestedCompany: newCompany.canonicalName,
      candidateCompanyId: newCompany.id,
      confidence: 100,
      score: 100,
      status: "CONFIRMED",
      outcome: "AUTO_MATCH",
      nameSimilarity: 100,
      addressSimilarity: null,
      source: "manual",
      gstin: norm.gstin,
      registrationNumber: norm.registrationNumber,
      reasons: [`Created new canonical company by ${reviewer}`],
      reviewedBy: reviewer,
      reviewedAt: new Date().toISOString(),
      reviewReason: "Created new canonical company",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.inMemoryMatches.push(matchRecord);

    // Recalculate downstream analytics
    await this.triggerDownstreamAnalyticsRecalculation();

    return matchRecord;
  }

  /**
   * Adds an alias to a canonical company.
   */
  public async addAlias(
    companyId: number,
    aliasName: string,
    aliasType = "source",
    confidence = 100,
    source = "manual"
  ): Promise<void> {
    const normalizedAlias = normalizeCompanyName(aliasName);
    const existing = this.inMemoryAliases.find(
      (a) => a.companyId === companyId && a.normalizedAlias === normalizedAlias
    );

    if (!existing) {
      this.inMemoryAliases.push({
        id: this.inMemoryAliases.length + 1,
        companyId,
        aliasName: aliasName.trim(),
        normalizedAlias,
        aliasType,
        confidence,
        status: "CONFIRMED",
        source,
      });

      // Update demoCompany aliases array
      const comp = demoCompanies.find((c) => c.id === companyId);
      if (comp && !comp.aliases.includes(aliasName.trim())) {
        comp.aliases.push(aliasName.trim());
      }
    }

    // Persist to DB if connected
    const isDb = await checkDatabaseConnection().catch(() => false);
    if (isDb) {
      try {
        await db.insert(companyAliasesTable).values({
          companyId,
          aliasName: aliasName.trim(),
          normalizedAlias,
          aliasType,
          confidence: String(confidence / 100),
          status: "CONFIRMED",
          source,
        });
      } catch {
        // Fallback
      }
    }
  }

  /**
   * Resolves a name or alias to its canonical company.
   * Useful for CSV import and Chatbot.
   */
  public async findCanonicalForName(name: string): Promise<EntityMatchCandidate | null> {
    if (!name) return null;
    const cleanNorm = normalizeCompanyName(name);

    // 1. Check in-memory aliases
    const matchedAlias = this.inMemoryAliases.find(
      (a) => a.normalizedAlias === cleanNorm || a.aliasName.toLowerCase() === name.toLowerCase()
    );
    if (matchedAlias) {
      const comp = demoCompanies.find((c) => c.id === matchedAlias.companyId);
      if (comp) {
        return {
          companyId: comp.id,
          canonicalName: comp.canonicalName,
          normalizedName: comp.normalizedName,
          address: comp.address,
          state: comp.state,
          aliases: comp.aliases,
        };
      }
    }

    // 2. Check canonical companies
    const directComp = demoCompanies.find(
      (c) => c.normalizedName === cleanNorm || c.canonicalName.toLowerCase() === name.toLowerCase()
    );
    if (directComp) {
      return {
        companyId: directComp.id,
        canonicalName: directComp.canonicalName,
        normalizedName: directComp.normalizedName,
        address: directComp.address,
        state: directComp.state,
        aliases: directComp.aliases,
      };
    }

    // 3. Check DB if available
    const isDb = await checkDatabaseConnection().catch(() => false);
    if (isDb) {
      try {
        const [aliasMatch] = await db
          .select()
          .from(companyAliasesTable)
          .where(eq(companyAliasesTable.normalizedAlias, cleanNorm))
          .limit(1);

        if (aliasMatch) {
          const [comp] = await db
            .select()
            .from(companiesTable)
            .where(eq(companiesTable.id, aliasMatch.companyId))
            .limit(1);

          if (comp) {
            return {
              companyId: comp.id,
              canonicalName: comp.canonicalName,
              normalizedName: comp.normalizedName,
              address: comp.address,
              city: comp.city,
              state: comp.state,
              aliases: [aliasMatch.aliasName],
            };
          }
        }
      } catch {
        // Ignore
      }
    }

    return null;
  }

  /**
   * Relinks any bids referencing a source name to a canonical company ID.
   */
  private async relinkBidsForSource(sourceName: string, canonicalCompanyId: number) {
    const normSource = normalizeCompanyName(sourceName);
    const comp = demoCompanies.find((c) => c.id === canonicalCompanyId);

    // Update in-memory tenders & bids
    for (const tender of demoTenders) {
      for (const bid of tender.bids) {
        if (
          normalizeCompanyName(bid.companyName) === normSource ||
          bid.companyName.toLowerCase() === sourceName.toLowerCase()
        ) {
          bid.companyId = canonicalCompanyId;
          if (comp) {
            bid.companyName = comp.canonicalName;
          }
        }
      }
      if (
        tender.winner &&
        (normalizeCompanyName(tender.winner) === normSource ||
          tender.winner.toLowerCase() === sourceName.toLowerCase())
      ) {
        tender.winner = comp ? comp.canonicalName : tender.winner;
      }
    }

    // Update DB if connected
    const isDb = await checkDatabaseConnection().catch(() => false);
    if (isDb) {
      try {
        await db
          .update(bidsTable)
          .set({ companyId: canonicalCompanyId })
          .where(
            or(
              eq(bidsTable.normalizedCompanyName, normSource),
              eq(bidsTable.originalCompanyName, sourceName)
            )
          );

        await db
          .update(tenderParticipantsTable)
          .set({ companyId: canonicalCompanyId })
          .where(eq(tenderParticipantsTable.companyId, canonicalCompanyId));
      } catch {
        // Ignore
      }
    }
  }

  /**
   * Scans for duplicate canonical companies.
   */
  public async detectDuplicates(): Promise<DuplicateCanonicalCandidate[]> {
    const candidates = await this.getAllCandidates();
    return scanCanonicalDuplicates(candidates);
  }

  /**
   * Retrieves review queue matches.
   */
  public getReviewQueue(): EntityMatchRecord[] {
    return this.inMemoryMatches.filter(
      (m) => m.status === "REVIEW_REQUIRED" || m.status === "UNRESOLVED"
    );
  }

  /**
   * Retrieves all matches.
   */
  public getAllMatches(): EntityMatchRecord[] {
    return this.inMemoryMatches;
  }

  /**
   * Returns comprehensive statistics.
   */
  public async getStats(): Promise<EntityResolutionStats> {
    const candidates = await this.getAllCandidates();
    const matches = this.inMemoryMatches;
    const duplicates = await this.detectDuplicates();

    const totalSourceRecords = matches.length;
    const canonicalCompanies = candidates.length;
    const automaticMatches = matches.filter((m) => m.status === "AUTO_MATCHED").length;
    const manualMatches = matches.filter((m) => m.status === "CONFIRMED").length;
    const reviewRequired = matches.filter((m) => m.status === "REVIEW_REQUIRED").length;
    const noMatch = matches.filter((m) => m.status === "UNRESOLVED" || m.status === "REJECTED").length;
    const unresolvedRecords = matches.filter((m) => m.status === "UNRESOLVED").length;
    const aliasCount = this.inMemoryAliases.length + candidates.reduce((s, c) => s + c.aliases.length, 0);

    const matchPercentage =
      totalSourceRecords > 0
        ? Math.round(((automaticMatches + manualMatches) / totalSourceRecords) * 100)
        : 100;

    return {
      totalSourceRecords,
      canonicalCompanies,
      automaticMatches,
      manualMatches,
      reviewRequired,
      noMatch,
      potentialDuplicates: duplicates.length,
      unresolvedRecords,
      matchPercentage,
      aliasCount,
    };
  }

  private async triggerDownstreamAnalyticsRecalculation(): Promise<void> {
    try {
      const { analyticsService } = await import("../analytics/index.js");
      await analyticsService.recalculate().catch(() => {});
      await analyticsService.recalculateNetwork().catch(() => {});
    } catch {
      // Graceful fallback
    }
  }
}

export const entityResolutionService = EntityResolutionService.getInstance();
