/**
 * BidShield Entity Resolution — Types & Interfaces
 * Phase 19: Entity Resolution Repair, Accuracy & Validation
 */

export type ResolutionStatus =
  | "AUTO_MATCHED"
  | "REVIEW_REQUIRED"
  | "CONFIRMED"
  | "REJECTED"
  | "UNRESOLVED";

export type ResolutionOutcome = "AUTO_MATCH" | "REVIEW_REQUIRED" | "NO_MATCH";

export type LegalForm =
  | "PVT_LTD"
  | "LTD"
  | "LLP"
  | "INC"
  | "CORP"
  | "CO"
  | "ENTERPRISES"
  | "HOLDINGS"
  | "PARTNERSHIP"
  | "PROPRIETORSHIP"
  | "UNKNOWN";

export interface NormalizedCompanyData {
  originalName: string;
  normalizedName: string;
  coreName: string;
  legalForm: LegalForm;
  tokens: string[];
  gstin: string | null;
  registrationNumber: string | null;
  originalAddress?: string | null;
  normalizedAddress?: string | null;
  city?: string | null;
  state?: string | null;
  pinCode?: string | null;
}

export interface MatchSignals {
  gstinMatch: boolean | null; // true = match, false = conflict, null = missing
  registrationMatch: boolean | null; // true = match, false = conflict, null = missing
  nameSimilarity: number; // 0 - 100
  coreNameSimilarity: number; // 0 - 100
  addressSimilarity: number | null; // 0 - 100 or null
  pinCodeMatch: boolean | null;
  cityStateMatch: boolean | null;
  legalFormCompatible: boolean;
  reasons: string[];
  flags: string[];
}

export interface MatchScoreResult {
  score: number; // 0 - 100
  confidence: number; // 0 - 100
  outcome: ResolutionOutcome;
  signals: MatchSignals;
  explanation: string;
}

export interface EntityMatchCandidate {
  companyId: number;
  canonicalName: string;
  normalizedName: string;
  gstin?: string | null;
  registrationNumber?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  aliases: string[];
}

export interface EntityMatchRecord {
  id: number;
  sourceName: string;
  originalName?: string;
  normalizedSourceName: string;
  suggestedCompany: string | null;
  candidateCompanyId: number | null;
  confidence: number;
  score: number;
  status: ResolutionStatus;
  outcome: ResolutionOutcome;
  nameSimilarity: number;
  addressSimilarity: number | null;
  source: string;
  gstin?: string | null;
  registrationNumber?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  matchSignals?: MatchSignals;
  reasons: string[];
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  reviewReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DuplicateCanonicalCandidate {
  id: number;
  companyAId: number;
  companyAName: string;
  companyAGstin?: string | null;
  companyAReg?: string | null;
  companyAAddress?: string | null;
  companyBId: number;
  companyBName: string;
  companyBGstin?: string | null;
  companyBReg?: string | null;
  companyBAddress?: string | null;
  similarityScore: number;
  confidence: number;
  status: "PENDING_REVIEW" | "MERGED" | "DISMISSED";
  matchingSignals: string[];
  reasons: string[];
  recommendedAction: "MERGE" | "MANUAL_REVIEW" | "KEEP_SEPARATE";
  detectedAt: string;
}

export interface EntityResolutionStats {
  totalSourceRecords: number;
  canonicalCompanies: number;
  automaticMatches: number;
  manualMatches: number;
  reviewRequired: number;
  noMatch: number;
  potentialDuplicates: number;
  unresolvedRecords: number;
  matchPercentage: number;
  aliasCount: number;
}
