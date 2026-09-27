/**
 * BidShield Entity Resolution — Multi-Signal Matching & Scoring Engine
 * Phase 19: Explainable multi-signal entity matching with strict conflict prevention.
 */

import {
  MatchScoreResult,
  MatchSignals,
  NormalizedCompanyData,
  ResolutionOutcome,
} from "./types.js";

/**
 * Calculates standard Levenshtein distance between two strings.
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const row = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i++) {
    let prev = i;
    for (let j = 1; j <= b.length; j++) {
      const val = a[i - 1] === b[j - 1] ? row[j - 1] : Math.min(row[j - 1], prev, row[j]) + 1;
      row[j - 1] = prev;
      prev = val;
    }
    row[b.length] = prev;
  }

  return row[b.length];
}

/**
 * Levenshtein similarity ratio (0 - 100).
 */
export function levenshteinRatio(a: string, b: string): number {
  if (a === b) return 100;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 100;
  const dist = levenshteinDistance(a, b);
  return Math.max(0, Math.round(((maxLen - dist) / maxLen) * 100));
}

/**
 * Token Sort Ratio: Sorts tokens alphabetically to handle word order variations.
 * Example: "Infrastructure Private Limited, ABC" vs "ABC Infrastructure Private Limited"
 */
export function tokenSortRatio(a: string, b: string): number {
  const sortedA = a.split(/\s+/).filter(Boolean).sort().join(" ");
  const sortedB = b.split(/\s+/).filter(Boolean).sort().join(" ");
  return levenshteinRatio(sortedA, sortedB);
}

/**
 * Token Set Ratio: Computes similarity across intersection and set differences.
 * Example: "ABC Infrastructure" vs "ABC Infrastructure Technologies"
 */
export function tokenSetRatio(a: string, b: string): number {
  const tokensA = new Set(a.split(/\s+/).filter(Boolean));
  const tokensB = new Set(b.split(/\s+/).filter(Boolean));

  const intersection = new Set([...tokensA].filter((x) => tokensB.has(x)));
  const diffA = new Set([...tokensA].filter((x) => !tokensB.has(x)));
  const diffB = new Set([...tokensB].filter((x) => !tokensB.has(x)));

  const interStr = [...intersection].sort().join(" ");
  const diffAStr = [...diffA].sort().join(" ");
  const diffBStr = [...diffB].sort().join(" ");

  const baseA = interStr ? `${interStr} ${diffAStr}`.trim() : diffAStr;
  const baseB = interStr ? `${interStr} ${diffBStr}`.trim() : diffBStr;

  const r1 = levenshteinRatio(interStr, baseA);
  const r2 = levenshteinRatio(interStr, baseB);
  const r3 = levenshteinRatio(baseA, baseB);

  return Math.max(r1, r2, r3);
}

/**
 * Computes maximum fuzzy name similarity using combined token sort, set, and direct ratio.
 */
export function calculateNameSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 100;

  const direct = levenshteinRatio(a, b);
  const sorted = tokenSortRatio(a, b);
  const setSim = tokenSetRatio(a, b);

  return Math.max(direct, sorted, setSim);
}

/**
 * Checks whether two legal entity forms are compatible.
 * - PVT_LTD and LTD: moderately compatible (conversions happen).
 * - PVT_LTD and LLP: DIFFERENT legal entities under law (distinct registration acts).
 * - UNKNOWN matches anything.
 */
export function areLegalFormsCompatible(formA: string, formB: string): boolean {
  if (formA === "UNKNOWN" || formB === "UNKNOWN") return true;
  if (formA === formB) return true;
  // LTD vs PVT_LTD is allowed under scrutiny
  if ((formA === "PVT_LTD" && formB === "LTD") || (formA === "LTD" && formB === "PVT_LTD")) {
    return true;
  }
  // LLP vs PVT_LTD or CORP are separate legal entities
  return false;
}

/**
 * Multi-Signal Match Scoring Engine.
 *
 * Implements strict signal hierarchy:
 * 1. Strong Identifiers (GSTIN, Reg No)
 * 2. Name Similarity (Core & Normalized)
 * 3. Supporting Info (Address, PIN, City, State)
 *
 * Returns explainable score, confidence, outcome, signals, and reason list.
 */
export function scoreMatch(
  source: NormalizedCompanyData,
  candidate: NormalizedCompanyData
): MatchScoreResult {
  const reasons: string[] = [];
  const flags: string[] = [];

  let gstinMatch: boolean | null = null;
  let registrationMatch: boolean | null = null;
  let pinCodeMatch: boolean | null = null;
  let cityStateMatch: boolean | null = null;

  let totalScore = 0;

  // ── SIGNAL 1: GSTIN IDENTIFIER ──────────────────────────────────────────
  if (source.gstin && candidate.gstin) {
    if (source.gstin === candidate.gstin) {
      gstinMatch = true;
      reasons.push(`✓ GSTIN exact match (${source.gstin})`);
    } else {
      gstinMatch = false;
      flags.push("BLOCKED_BY_STRONG_IDENTIFIER_CONFLICT");
      reasons.push(`✗ GSTIN conflict: ${source.gstin} vs ${candidate.gstin}`);
    }
  }

  // ── SIGNAL 2: REGISTRATION NUMBER ───────────────────────────────────────
  if (source.registrationNumber && candidate.registrationNumber) {
    if (source.registrationNumber === candidate.registrationNumber) {
      registrationMatch = true;
      reasons.push(`✓ Registration Number exact match (${source.registrationNumber})`);
    } else {
      registrationMatch = false;
      flags.push("BLOCKED_BY_STRONG_IDENTIFIER_CONFLICT");
      reasons.push(`✗ Registration number conflict: ${source.registrationNumber} vs ${candidate.registrationNumber}`);
    }
  }

  // ── SIGNAL 3: NAME SIMILARITY ───────────────────────────────────────────
  const normalizedSim = calculateNameSimilarity(source.normalizedName, candidate.normalizedName);
  const coreSim = calculateNameSimilarity(source.coreName, candidate.coreName);
  const legalFormCompatible = areLegalFormsCompatible(source.legalForm, candidate.legalForm);

  if (!legalFormCompatible) {
    flags.push(`INCOMPATIBLE_LEGAL_FORM: ${source.legalForm} vs ${candidate.legalForm}`);
    reasons.push(`⚠ Legal form mismatch: ${source.legalForm} vs ${candidate.legalForm}`);
  }

  if (source.normalizedName === candidate.normalizedName) {
    totalScore += 90;
    reasons.push(`✓ Normalized company name exact match (100%)`);
  } else if (source.coreName === candidate.coreName) {
    if (legalFormCompatible) {
      totalScore += 85;
      reasons.push(`✓ Core company name exact match (${source.coreName}) with compatible suffixes`);
    } else {
      totalScore += 65;
      reasons.push(`⚠ Core company name matches (${source.coreName}) but legal suffixes differ`);
    }
  } else {
    const effectiveSim = Math.max(normalizedSim, coreSim);
    if (effectiveSim >= 90) {
      totalScore += 65;
      reasons.push(`✓ High name similarity: ${effectiveSim}%`);
    } else if (effectiveSim >= 75) {
      totalScore += 50;
      reasons.push(`✓ Moderate name similarity: ${effectiveSim}%`);
    } else if (effectiveSim >= 60) {
      totalScore += 35;
      reasons.push(`ℹ Low name similarity: ${effectiveSim}%`);
    } else {
      totalScore += Math.round(effectiveSim * 0.3);
      reasons.push(`✗ Poor name similarity: ${effectiveSim}%`);
    }
  }

  // ── SIGNAL 4: ADDRESS & LOCATION ────────────────────────────────────────
  let addressSim: number | null = null;
  if (source.normalizedAddress && candidate.normalizedAddress) {
    addressSim = calculateNameSimilarity(source.normalizedAddress, candidate.normalizedAddress);
    if (addressSim >= 80) {
      totalScore += 10;
      reasons.push(`✓ Address matches closely (${addressSim}%)`);
    } else if (addressSim >= 60) {
      totalScore += 5;
      reasons.push(`✓ Address partially matches (${addressSim}%)`);
    }
  }

  // PIN Code Comparison
  if (source.pinCode && candidate.pinCode) {
    if (source.pinCode === candidate.pinCode) {
      pinCodeMatch = true;
      totalScore += 5;
      reasons.push(`✓ Postal PIN code match (${source.pinCode})`);
    } else {
      pinCodeMatch = false;
      totalScore -= 10;
      reasons.push(`⚠ Different postal PIN codes: ${source.pinCode} vs ${candidate.pinCode}`);
    }
  }

  // City & State Comparison
  if (source.city && candidate.city) {
    if (source.city === candidate.city) {
      cityStateMatch = true;
      totalScore += 5;
      reasons.push(`✓ City match (${source.city})`);
    } else {
      cityStateMatch = false;
    }
  }

  // Boost for verified GSTIN or Reg match
  if (gstinMatch === true) {
    totalScore = Math.min(100, Math.max(totalScore, 85) + 15);
  }
  if (registrationMatch === true) {
    totalScore = Math.min(100, Math.max(totalScore, 85) + 10);
  }

  // ── CLAMP SCORE & APPLY SAFEGUARDS ──────────────────────────────────────
  let finalScore = Math.max(0, Math.min(100, totalScore));

  // SAFEGUARD A: Strong identifier conflicts STRICTLY force NO_MATCH
  if (gstinMatch === false || registrationMatch === false || flags.includes("BLOCKED_BY_STRONG_IDENTIFIER_CONFLICT")) {
    finalScore = 20;
  }

  // SAFEGUARD B: Legal form incompatibility caps score unless verified by matching GSTIN/Reg
  if (!legalFormCompatible && !gstinMatch && !registrationMatch) {
    finalScore = Math.min(finalScore, 75); // Never auto-match without proof
    flags.push("CAPPED_BY_LEGAL_FORM_MISMATCH");
  }

  // SAFEGUARD C: Very short or single-token names require higher proof
  if (source.tokens.length <= 1 && source.coreName.length <= 4 && !gstinMatch && !registrationMatch) {
    finalScore = Math.min(finalScore, 65);
    flags.push("SHORT_NAME_GUARD");
    reasons.push("ℹ Single-word or short acronym entity requires corroborating identifiers");
  }

  // ── DECISION THRESHOLDS ────────────────────────────────────────────────
  let outcome: ResolutionOutcome;
  if (finalScore >= 85 && !flags.includes("BLOCKED_BY_STRONG_IDENTIFIER_CONFLICT") && legalFormCompatible) {
    outcome = "AUTO_MATCH";
  } else if (finalScore >= 60 && !flags.includes("BLOCKED_BY_STRONG_IDENTIFIER_CONFLICT")) {
    outcome = "REVIEW_REQUIRED";
  } else {
    outcome = "NO_MATCH";
  }

  const confidence = finalScore;
  const signals: MatchSignals = {
    gstinMatch,
    registrationMatch,
    nameSimilarity: normalizedSim,
    coreNameSimilarity: coreSim,
    addressSimilarity: addressSim,
    pinCodeMatch,
    cityStateMatch,
    legalFormCompatible,
    reasons,
    flags,
  };

  const explanation = reasons.join(" • ");

  return {
    score: finalScore,
    confidence,
    outcome,
    signals,
    explanation,
  };
}
