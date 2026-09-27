export type ScreeningStatus =
  | "LOW INDICATOR"
  | "LOW_INDICATOR"
  | "MODERATE INDICATOR"
  | "ELEVATED INDICATOR"
  | "HIGH INDICATOR"
  | "INSUFFICIENT_DATA";

export type IndicatorMetric = {
  key: string;
  label: string;
  value: number;
  formatted: string;
};

export type ComparisonScope = {
  category: string;
  organization: string;
  department: string;
  geography: string;
  valueRange: string;
  startDate: string;
  endDate: string;
  comparableTenderCount: number;
};

export type AnalyticsEvidence = {
  id: number;
  indicatorType: string;
  description: string;
  metric: string;
  observedValue: string | null;
  expectedValue: string | null;
  confidence: number;
  severity: string;
  supportingTenderIds: number[];
  companyId?: number;
  tenderId?: number;
  methodologyVersion?: string;
};

export type AnalyticsIndicator = {
  indicatorType: string;
  score: number | null;
  status: ScreeningStatus;
  methodologyVersion: string;
  calculatedAt: string;
  sampleSize: number;
  threshold: number;
  confidence: number;
  summary: string;
  metrics: IndicatorMetric[];
  evidenceCount: number;
};

export type TenderAnalytics = {
  tenderId: number;
  tenderNumber: string;
  comparisonScope: ComparisonScope;
  winnerRotation: AnalyticsIndicator;
  coverBid: AnalyticsIndicator;
  priceClustering: AnalyticsIndicator;
  participationNetwork?: AnalyticsIndicator;
  neatLoss?: AnalyticsIndicator;
  combinedRisk?: any;
  evidence: AnalyticsEvidence[];
  calculatedAt: string;
};

export type RotationListItem = {
  tenderId: number;
  tenderNumber: string;
  score: number | null;
  status: string;
  sampleSize: number;
  winner: string | null;
  comparisonGroup: string;
  winnerSequence: string[];
};

export type RotationList = {
  items: RotationListItem[];
  total: number;
};

export type CoverBidListItem = {
  tenderId: number;
  tenderNumber: string;
  score: number | null;
  status: string;
  sampleSize: number;
  comparisonGroup: string;
  flaggedCompanies: string[];
  medianRelativeDistance: number;
  currentRelativeDistances: number[];
};

export type CoverBidList = {
  items: CoverBidListItem[];
  total: number;
};

export type PriceClusteringListItem = {
  tenderId: number;
  tenderNumber: string;
  score: number | null;
  status: string;
  sampleSize: number;
  comparisonGroup: string;
  coefficientOfVariation: number;
  bidSpreadPct: number;
  cvPercentile: number | null;
  historicalMedianCV: number | null;
  comparableTendersCount: number;
};

export type PriceClusteringList = {
  items: PriceClusteringListItem[];
  total: number;
};

export type CompanyPatterns = {
  companyId: number;
  companyName: string;
  participationCount: number;
  wins: number;
  losses: number;
  winRate: number;
  averageBidDistance: number | null;
  medianBidDistance: number | null;
  comparableTenderCount: number;
  repeatedParticipantGroups: number;
  winnerTransitions: string[];
  bidDistanceHistory: { label: string; value: number }[];
  rotationIndicators: RotationListItem[];
  coverBidIndicators: CoverBidListItem[];
  priceClusteringIndicators?: PriceClusteringListItem[];
  neatLossIndicators?: NeatLossListItem[];
};

export type NeatLossListItem = {
  companyId: number;
  companyName: string;
  canonicalId: string;
  score: number | null;
  status: ScreeningStatus;
  sampleSize: number;
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
  meanRelativeGapPct: number | null;
  medianRelativeGapPct: number | null;
  relativeGapStdDev: number | null;
  relativeGapCv: number | null;
  minRelativeGapPct: number | null;
  maxRelativeGapPct: number | null;
  narrowMarginObservationsCount: number;
  repeatedRankCount: number;
  repeatedBidderGroupCount: number;
  comparisonGroup: string;
};

export type NeatLossList = {
  items: NeatLossListItem[];
  total: number;
};

export type ScreeningAnalyticsSummary = {
  tendersAnalyzed: number;
  rotationIndicators: number;
  coverBidIndicators: number;
  priceClusteringIndicators: number;
  neatLossIndicators?: number;
  companiesRequiringReview: number;
  evidenceRecords: number;
  winnerDistribution: { label: string; value: number }[];
  winnerTransitions: { label: string; value: number }[];
  bidDistanceDistribution: { label: string; value: number }[];
  cvDistribution: { label: string; value: number }[];
  indicatorsOverTime: { label: string; value: number }[];
  networkIndicators?: number;
  recurringPairs?: Array<{ companyA: string; companyB: string; sharedTenders: number; frequencyPct: number }>;
};

