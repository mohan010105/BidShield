import { AnalyticsEvidence, AnalyticsIndicator, ScreeningStatus } from "../../common/types";

export interface LosingBidObservation {
  tenderId: number;
  tenderNumber: string;
  title: string;
  tenderDate: string;
  category: string;
  organization: string;
  department: string;
  estimatedValue: number;
  bidAmount: number;
  winningBidAmount: number;
  gapAmount: number;
  relativeGapPct: number;
  bidRank: number;
  isWinner: boolean;
  bidderCount: number;
  winnerCompanyId?: number;
  winnerCompanyName?: string;
  coBidders: number[];
}

export interface CompanyNeatLossMetrics {
  companyId: number;
  companyName: string;
  canonicalId: string;
  comparisonGroup: string;
  participationCount: number;
  winCount: number;
  lossCount: number;
  winRate: number;
  lossRate: number;
  meanBidRank: number;
  medianBidRank: number;
  rankStdDev: number;
  minBidRank: number;
  maxBidRank: number;
  mostFrequentRank: number;
  mostFrequentRankCount: number;
  meanRelativeGapPct: number | null;
  medianRelativeGapPct: number | null;
  relativeGapStdDev: number | null;
  relativeGapCv: number | null;
  minRelativeGapPct: number | null;
  maxRelativeGapPct: number | null;
  narrowMarginObservationsCount: number;
  repeatedRankCount: number;
  repeatedBidderGroupCount: number;
  sampleSize: number;
  isInsufficientData: boolean;
  insufficientReason?: string;
  subScores: {
    lossRateScore: number;
    gapConsistencyScore: number;
    rankRepetitionScore: number;
    nearWinnerScore: number;
    groupRepetitionScore: number;
  };
  score: number | null;
  status: ScreeningStatus;
  methodologyVersion: string;
  observations: LosingBidObservation[];
}

export interface NeatLossDetectionResult {
  indicator: AnalyticsIndicator;
  metrics: CompanyNeatLossMetrics;
  evidence: AnalyticsEvidence[];
}

export interface TenderNeatLossContributor {
  companyId: number;
  companyName: string;
  canonicalId: string;
  bidRank: number;
  bidAmount: number;
  relativeGapPct: number;
  companyScore: number | null;
  companyStatus: ScreeningStatus;
  historicalLossRate: number;
  historicalMedianGap: number | null;
  historicalGapCv: number | null;
  isPatternContributor: boolean;
  description: string;
}

export interface TenderNeatLossAnalysis {
  tenderId: number;
  tenderNumber: string;
  participatingBiddersCount: number;
  contributingBidders: TenderNeatLossContributor[];
  indicator: AnalyticsIndicator;
  evidence: AnalyticsEvidence[];
}

export interface OverallNeatLossSummary {
  totalCompaniesAnalyzed: number;
  elevatedCompaniesCount: number;
  moderateCompaniesCount: number;
  insufficientDataCount: number;
  topSignals: CompanyNeatLossMetrics[];
  recentEvidence: AnalyticsEvidence[];
  methodologyVersion: string;
  calculatedAt: string;
}
