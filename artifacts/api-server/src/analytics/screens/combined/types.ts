import { AnalyticsEvidence } from "../../common/types";

export type IndicatorType =
  | "WINNER_ROTATION"
  | "COVER_BID"
  | "PRICE_CLUSTERING"
  | "PARTICIPATION_NETWORK"
  | "NEAT_LOSS";

export type IndicatorStatus = "AVAILABLE" | "INSUFFICIENT_DATA" | "NOT_APPLICABLE" | "ERROR";

export type CombinedScreeningLevel =
  | "LOW SCREENING SIGNAL"
  | "MODERATE SCREENING SIGNAL"
  | "ELEVATED SCREENING SIGNAL"
  | "HIGH SCREENING SIGNAL"
  | "INSUFFICIENT DATA";

export interface IndicatorContribution {
  indicator: IndicatorType;
  label: string;
  rawScore: number | null;
  status: IndicatorStatus;
  statusReason?: string;
  baseWeight: number;         // e.g. 0.20 (20%)
  renormalizedWeight: number; // e.g. 0.25 (25%) if 4 available
  contributionScore: number;  // rawScore * renormalizedWeight (0 if null)
  sampleSize: number;
  evidenceCount: number;
}

export interface StrongestIndicator {
  indicator: IndicatorType;
  label: string;
  score: number;
  contribution: number;
}

export interface EvidenceBreakdown {
  totalCount: number;
  byIndicator: {
    rotation: number;
    coverBid: number;
    priceClustering: number;
    network: number;
    neatLoss: number;
  };
  bySeverity: {
    high: number;
    medium: number;
    low: number;
    informational: number;
  };
}

export interface CombinedScreeningResult {
  id?: number;
  tenderId: number;
  tenderNumber: string;
  title?: string;
  organization?: string;
  category?: string;
  overallScore: number | null;
  overallStatus: "EVALUATED" | "INSUFFICIENT_DATA";
  screeningLevel: CombinedScreeningLevel;
  availableIndicatorCount: number;
  totalIndicatorCount: number;
  indicators: Record<IndicatorType, IndicatorContribution>;
  topIndicators: StrongestIndicator[];
  evidenceSummary: string;
  evidenceBreakdown: EvidenceBreakdown;
  evidence: AnalyticsEvidence[];
  methodologyVersion: string;
  calculatedAt: string;
}

export interface CompanyCombinedScreeningResult {
  companyId: number;
  companyName: string;
  canonicalId: string;
  overallScore: number | null;
  overallStatus: "EVALUATED" | "INSUFFICIENT_DATA";
  screeningLevel: CombinedScreeningLevel;
  availableIndicatorCount: number;
  totalIndicatorCount: number;
  tendersAnalyzed: number;
  indicators: Record<IndicatorType, IndicatorContribution>;
  topIndicators: StrongestIndicator[];
  evidenceSummary: string;
  evidenceBreakdown: EvidenceBreakdown;
  evidence: AnalyticsEvidence[];
  methodologyVersion: string;
  calculatedAt: string;
}

export interface CombinedScreeningListItem {
  id: number;
  tenderId: number;
  tenderNumber: string;
  title: string;
  organization: string;
  category: string;
  estimatedValue: number;
  tenderDate: string;
  overallScore: number | null;
  overallStatus: "EVALUATED" | "INSUFFICIENT_DATA";
  screeningLevel: CombinedScreeningLevel;
  availableIndicatorCount: number;
  totalEvidenceCount: number;
  topIndicators: StrongestIndicator[];
  calculatedAt: string;
}

export interface CombinedScreeningSummary {
  totalTendersAnalyzed: number;
  tendersWithSufficientEvidence: number;
  tendersRequiringReview: number;
  averageScreeningScore: number;
  totalEvidenceRecords: number;
  indicatorAvailability: Record<IndicatorType, { available: number; insufficient: number }>;
  levelDistribution: {
    low: number;
    moderate: number;
    elevated: number;
    high: number;
    insufficient: number;
  };
}
