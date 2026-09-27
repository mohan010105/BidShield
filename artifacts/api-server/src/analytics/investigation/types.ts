export type InvestigationStatus = "OPEN" | "IN_REVIEW" | "WATCHLIST" | "CLOSED";
export type InvestigationPriority = "HIGH" | "MEDIUM" | "LOW";

export interface InvestigationItem {
  id: number;
  tenderId: number;
  tenderNumber: string;
  title: string;
  organization: string;
  department: string;
  category: string;
  location: string;
  state: string;
  tenderDate: string;
  estimatedValue: number;
  contractValue: number | null;
  status: InvestigationStatus;
  priority: InvestigationPriority;
  assignedTo: string;
  isWatchlisted: boolean;
  overallScore: number | null;
  screeningLevel: string;
  availableIndicatorCount: number;
  totalIndicatorCount: number;
  evidenceCount: number;
  topIndicator?: {
    indicator: string;
    label: string;
    score: number;
  };
  notesCount: number;
  lastAnalyzed: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InvestigationQueueItem {
  tenderId: number;
  tenderNumber: string;
  title: string;
  organization: string;
  department: string;
  category: string;
  estimatedValue: number;
  tenderDate: string;
  overallScore: number | null;
  screeningLevel: string;
  evidenceCount: number;
  topIndicator: {
    indicator: string;
    label: string;
    score: number;
  } | null;
  investigationId: number | null;
  investigationStatus: InvestigationStatus | null;
  hasActiveInvestigation: boolean;
  priority: InvestigationPriority;
  requiresReview: boolean;
}

export interface InvestigationNoteItem {
  id: number;
  investigationId: number;
  userId: string;
  userName: string;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvestigationActivityItem {
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

export interface BidComparisonItem {
  companyId: number;
  companyName: string;
  canonicalName: string;
  bidAmount: number;
  rank: number;
  isWinner: boolean;
  differenceFromWinner: number;
  relativeDifferencePct: number;
  technicalScore: number | null;
  financialScore: number | null;
  submissionDate: string | null;
  sourceRowId?: string | null;
}

export interface ParticipatingCompanyHistory {
  companyId: number;
  canonicalName: string;
  normalizedName: string;
  address: string | null;
  state: string | null;
  registrationNumber: string | null;
  tendersParticipated: number;
  wins: number;
  losses: number;
  winRate: number;
  screeningLevel: string;
  historicalIndicators: {
    rotationScore: number | null;
    networkScore: number | null;
    neatLossScore: number | null;
    pricePositioningCount: number;
  };
  relationshipsCount: number;
}

export interface CoParticipationSummary {
  companyAId: number;
  companyAName: string;
  companyBId: number;
  companyBName: string;
  sharedTenderCount: number;
  participationFrequency: number;
  status: string;
  firstObservedDate?: string;
  latestObservedDate?: string;
}

export interface InvestigationNetworkSubgraph {
  nodes: Array<{
    id: string;
    type: "tender" | "company";
    label: string;
    isCurrentTender?: boolean;
    isWinner?: boolean;
    screeningLevel?: string;
  }>;
  edges: Array<{
    source: string;
    target: string;
    label?: string;
    isAward?: boolean;
  }>;
  pairs: CoParticipationSummary[];
  recurringGroups: Array<{
    groupSize: number;
    companyNames: string[];
    sharedTenderCount: number;
    tenders: Array<{ tenderId: number; tenderNumber: string; title: string }>;
  }>;
}

export interface InvestigationDataLineage {
  datasetName: string;
  importBatchId: number | null;
  importFilename: string;
  source: string;
  importedDate: string;
  totalCorpusTenders: number;
  tendersInBatch: number;
  lineageChain: Array<{
    stage: string;
    description: string;
    status: string;
    timestamp: string;
  }>;
}

export interface InvestigationDetailResult {
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
  tender: {
    id: number;
    tenderNumber: string;
    title: string;
    department: string;
    organization: string;
    category: string;
    location: string;
    state: string;
    tenderDate: string;
    closingDate: string;
    estimatedValue: number;
    contractValue: number | null;
    status: string;
    winnerId: number | null;
    winnerName: string | null;
    bidderCount: number;
  };
  combinedScreening: {
    overallScore: number | null;
    overallStatus: string;
    screeningLevel: string;
    availableIndicatorCount: number;
    totalIndicatorCount: number;
    indicators: Record<string, any>;
    topIndicators: Array<{ indicator: string; label: string; score: number; contribution: number }>;
    evidenceSummary: string;
    methodologyVersion: string;
    disclaimer: string;
    calculatedAt: string;
  };
  evidenceTimeline: Array<{
    id: number;
    date: string;
    indicatorType: string;
    description: string;
    metric: string;
    observedValue: string | null;
    expectedValue: string | null;
    severity: string;
    confidence: number;
    sampleSize?: number;
    methodologyVersion: string;
    sourceTenderIds?: number[];
  }>;
  bids: BidComparisonItem[];
  participatingCompanies: ParticipatingCompanyHistory[];
  network: InvestigationNetworkSubgraph;
  notesList: InvestigationNoteItem[];
  activities: InvestigationActivityItem[];
  lineage: InvestigationDataLineage;
}

export interface InvestigationDashboardSummary {
  totalTenders: number;
  tendersAnalyzed: number;
  tendersRequiringReview: number;
  openInvestigations: number;
  inReviewInvestigations: number;
  watchlistInvestigations: number;
  closedInvestigations: number;
  totalInvestigations: number;
  totalEvidenceCount: number;
  screeningLevelDistribution: {
    low: number;
    moderate: number;
    elevated: number;
    high: number;
    insufficient: number;
  };
  indicatorDistribution: Record<string, { available: number; elevated: number }>;
  recentInvestigations: InvestigationItem[];
  recentActivities: InvestigationActivityItem[];
}
