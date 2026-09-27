/**
 * BidShield Entity Resolution — Candidate Generation & Blocking
 * Phase 19: Efficient blocking indexes for high performance across large datasets.
 */

import { EntityMatchCandidate, NormalizedCompanyData } from "./types.js";
import { normalizeCompany } from "./normalizer.js";

export class BlockingIndex {
  private gstinIndex = new Map<string, number[]>();
  private regIndex = new Map<string, number[]>();
  private prefixIndex = new Map<string, number[]>();
  private tokenIndex = new Map<string, number[]>();
  private aliasIndex = new Map<string, number[]>();
  private candidateMap = new Map<number, EntityMatchCandidate>();
  private normalizedMap = new Map<number, NormalizedCompanyData>();

  /**
   * Clears the in-memory index.
   */
  clear() {
    this.gstinIndex.clear();
    this.regIndex.clear();
    this.prefixIndex.clear();
    this.tokenIndex.clear();
    this.aliasIndex.clear();
    this.candidateMap.clear();
    this.normalizedMap.clear();
  }

  /**
   * Adds or updates a candidate company in the blocking index.
   */
  addCandidate(candidate: EntityMatchCandidate) {
    this.candidateMap.set(candidate.companyId, candidate);

    const norm = normalizeCompany(candidate.canonicalName, {
      gstin: candidate.gstin,
      registrationNumber: candidate.registrationNumber,
      address: candidate.address,
      city: candidate.city,
      state: candidate.state,
    });
    this.normalizedMap.set(candidate.companyId, norm);

    const cid = candidate.companyId;

    // 1. GSTIN Block
    if (norm.gstin) {
      this.addToIndex(this.gstinIndex, norm.gstin, cid);
    }

    // 2. Registration Number Block
    if (norm.registrationNumber) {
      this.addToIndex(this.regIndex, norm.registrationNumber, cid);
    }

    // 3. Name Prefix Block (first 4 characters of core name)
    const prefix = norm.coreName.slice(0, 4).toLowerCase();
    if (prefix.length >= 2) {
      this.addToIndex(this.prefixIndex, prefix, cid);
    }

    // 4. Token Blocks (all tokens with length >= 3)
    for (const token of norm.tokens) {
      if (token.length >= 3) {
        this.addToIndex(this.tokenIndex, token.toLowerCase(), cid);
      }
    }

    // 5. Aliases Block
    for (const alias of candidate.aliases || []) {
      const normAlias = normalizeCompany(alias);
      this.addToIndex(this.aliasIndex, normAlias.normalizedName, cid);
      this.addToIndex(this.aliasIndex, normAlias.coreName, cid);
    }
  }

  /**
   * Bulk loads a list of candidate companies.
   */
  loadCandidates(candidates: EntityMatchCandidate[]) {
    this.clear();
    for (const candidate of candidates) {
      this.addCandidate(candidate);
    }
  }

  /**
   * Finds potential candidate companies for an incoming source record.
   * Generates candidate matches using the multi-channel blocking index.
   */
  findCandidates(source: NormalizedCompanyData, maxCandidates = 20): Array<{ candidate: EntityMatchCandidate; normalized: NormalizedCompanyData }> {
    const candidateIdSet = new Set<number>();

    // Channel 1: Exact GSTIN match (Highest Priority)
    if (source.gstin && this.gstinIndex.has(source.gstin)) {
      for (const id of this.gstinIndex.get(source.gstin)!) {
        candidateIdSet.add(id);
      }
    }

    // Channel 2: Exact Registration Number match
    if (source.registrationNumber && this.regIndex.has(source.registrationNumber)) {
      for (const id of this.regIndex.get(source.registrationNumber)!) {
        candidateIdSet.add(id);
      }
    }

    // Channel 3: Exact Alias match
    if (this.aliasIndex.has(source.normalizedName)) {
      for (const id of this.aliasIndex.get(source.normalizedName)!) {
        candidateIdSet.add(id);
      }
    }
    if (this.aliasIndex.has(source.coreName)) {
      for (const id of this.aliasIndex.get(source.coreName)!) {
        candidateIdSet.add(id);
      }
    }

    // Channel 4: Name Prefix Block
    const prefix = source.coreName.slice(0, 4).toLowerCase();
    if (prefix.length >= 2 && this.prefixIndex.has(prefix)) {
      for (const id of this.prefixIndex.get(prefix)!) {
        candidateIdSet.add(id);
      }
    }

    // Channel 5: Significant Tokens
    for (const token of source.tokens) {
      if (token.length >= 3 && this.tokenIndex.has(token.toLowerCase())) {
        for (const id of this.tokenIndex.get(token.toLowerCase())!) {
          candidateIdSet.add(id);
        }
      }
    }

    // If still no candidates found, fallback to checking all candidates if total count is small (< 100)
    if (candidateIdSet.size === 0 && this.candidateMap.size <= 100) {
      for (const id of this.candidateMap.keys()) {
        candidateIdSet.add(id);
      }
    }

    const results: Array<{ candidate: EntityMatchCandidate; normalized: NormalizedCompanyData }> = [];
    for (const id of candidateIdSet) {
      const candidate = this.candidateMap.get(id);
      const normalized = this.normalizedMap.get(id);
      if (candidate && normalized) {
        results.push({ candidate, normalized });
        if (results.length >= maxCandidates) break;
      }
    }

    return results;
  }

  private addToIndex(index: Map<string, number[]>, key: string, id: number) {
    if (!key) return;
    const existing = index.get(key) || [];
    if (!existing.includes(id)) {
      existing.push(id);
      index.set(key, existing);
    }
  }
}
