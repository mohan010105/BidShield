/**
 * BidShield Entity Resolution — Duplicate Canonical Company Detection
 * Phase 19: Scans canonical companies for accidental duplicates and creates review candidates.
 */

import { DuplicateCanonicalCandidate, EntityMatchCandidate } from "./types.js";
import { normalizeCompany } from "./normalizer.js";
import { scoreMatch } from "./matcher.js";

/**
 * Scans a list of canonical companies to detect duplicate canonical entities.
 */
export function scanCanonicalDuplicates(companies: EntityMatchCandidate[]): DuplicateCanonicalCandidate[] {
  const duplicates: DuplicateCanonicalCandidate[] = [];
  const normalizedList = companies.map((c) => ({
    raw: c,
    norm: normalizeCompany(c.canonicalName, {
      gstin: c.gstin,
      registrationNumber: c.registrationNumber,
      address: c.address,
      city: c.city,
      state: c.state,
    }),
  }));

  let candidateIdSeq = 1;

  for (let i = 0; i < normalizedList.length; i++) {
    for (let j = i + 1; j < normalizedList.length; j++) {
      const compA = normalizedList[i];
      const compB = normalizedList[j];

      // Quick skip if completely different
      if (
        !compA.norm.gstin &&
        !compB.norm.gstin &&
        compA.norm.coreName[0] !== compB.norm.coreName[0] &&
        compA.raw.canonicalName[0] !== compB.raw.canonicalName[0]
      ) {
        continue;
      }

      const matchRes = scoreMatch(compA.norm, compB.norm);

      // Check if duplicate signal exists
      const isExactGstin = Boolean(compA.norm.gstin && compB.norm.gstin && compA.norm.gstin === compB.norm.gstin);
      const isExactReg = Boolean(compA.norm.registrationNumber && compB.norm.registrationNumber && compA.norm.registrationNumber === compB.norm.registrationNumber);
      const isExactNormalized = compA.norm.normalizedName === compB.norm.normalizedName;
      const isHighSimilarity = matchRes.score >= 80;

      if (isExactGstin || isExactReg || isExactNormalized || isHighSimilarity) {
        const matchingSignals: string[] = [];
        if (isExactGstin) matchingSignals.push("IDENTICAL_GSTIN");
        if (isExactReg) matchingSignals.push("IDENTICAL_REGISTRATION_NUMBER");
        if (isExactNormalized) matchingSignals.push("IDENTICAL_NORMALIZED_NAME");
        if (matchRes.signals.nameSimilarity >= 90) matchingSignals.push("HIGH_NAME_SIMILARITY");
        if (matchRes.signals.addressSimilarity && matchRes.signals.addressSimilarity >= 80) matchingSignals.push("HIGH_ADDRESS_SIMILARITY");

        let recommendedAction: "MERGE" | "MANUAL_REVIEW" | "KEEP_SEPARATE" = "MANUAL_REVIEW";
        if ((isExactGstin || isExactReg) && matchRes.signals.nameSimilarity >= 85) {
          recommendedAction = "MERGE";
        } else if (matchRes.signals.flags.includes("BLOCKED_BY_STRONG_IDENTIFIER_CONFLICT")) {
          recommendedAction = "KEEP_SEPARATE";
        }

        duplicates.push({
          id: candidateIdSeq++,
          companyAId: compA.raw.companyId,
          companyAName: compA.raw.canonicalName,
          companyAGstin: compA.raw.gstin || null,
          companyAReg: compA.raw.registrationNumber || null,
          companyAAddress: compA.raw.address || null,
          companyBId: compB.raw.companyId,
          companyBName: compB.raw.canonicalName,
          companyBGstin: compB.raw.gstin || null,
          companyBReg: compB.raw.registrationNumber || null,
          companyBAddress: compB.raw.address || null,
          similarityScore: matchRes.score,
          confidence: matchRes.confidence,
          status: "PENDING_REVIEW",
          matchingSignals,
          reasons: matchRes.signals.reasons,
          recommendedAction,
          detectedAt: new Date().toISOString(),
        });
      }
    }
  }

  // Sort by similarity score descending
  return duplicates.sort((a, b) => b.similarityScore - a.similarityScore);
}
