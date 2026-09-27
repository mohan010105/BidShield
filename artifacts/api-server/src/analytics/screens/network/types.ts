import { AnalyticsEvidence, AnalyticsIndicator, ScreeningStatus } from "../../common/types";

export type NetworkNodeType = "company" | "tender";

export interface CompanyNode {
  id: number;
  canonicalId: string; // e.g. "CMP-001"
  label: string;
  canonicalName: string;
  normalizedName: string;
  nodeType: "company";
  participationCount: number;
  wins: number;
  losses: number;
  degree: number; // Number of unique connected tenders
  winRate: number;
  screeningLevel?: string;
  state?: string;
  x?: number;
  y?: number;
}

export interface TenderNode {
  id: number;
  canonicalId: string; // e.g. "TND-001"
  tenderNumber: string;
  label: string;
  title: string;
  nodeType: "tender";
  category: string;
  organization: string;
  department: string;
  location: string;
  state: string;
  estimatedValue: number;
  contractValue: number | null;
  tenderDate: string;
  winner: string | null;
  bidderCount: number;
  screeningLevel?: string;
  x?: number;
  y?: number;
}

export type NetworkNode = CompanyNode | TenderNode;

export interface ParticipationEdge {
  id: string; // e.g. "E-CMP-1-TND-10"
  source: number; // Company ID
  target: number; // Tender ID
  edgeType: "participation";
  companyId: number;
  tenderId: number;
  companyName: string;
  tenderNumber: string;
  isWinner: boolean;
  bidRank: number;
  bidAmount: number;
}

export interface CoParticipationEdge {
  id: string; // e.g. "PAIR-1-2"
  source: number; // Company A ID
  target: number; // Company B ID
  edgeType: "co_participation";
  sharedTenderCount: number;
  participationFrequency: number;
}

export interface BipartiteGraph {
  companyNodes: CompanyNode[];
  tenderNodes: TenderNode[];
  allNodes: NetworkNode[];
  edges: ParticipationEdge[];
  coParticipationEdges: CoParticipationEdge[];
}

export interface RecurringBidderGroup {
  groupId: string;
  companyIds: number[];
  companyNames: string[];
  canonicalIds: string[];
  sharedTenderCount: number;
  sharedTenderIds: number[];
  sharedTenderNumbers: string[];
  organizations: string[];
  categories: string[];
  frequencyPct: number;
}

export interface CoParticipationPair {
  companyAId: number;
  companyAName: string;
  companyACanonicalId: string;
  companyBId: number;
  companyBName: string;
  companyBCanonicalId: string;
  sharedTenderCount: number;
  comparableTenderCount: number;
  participationFrequency: number; // shared / min(tendersA, tendersB)
  jaccardFrequency: number;       // shared / union(tendersA, tendersB)
  sharedTenderIds: number[];
  sharedTenderNumbers: string[];
  organizations: string[];
  categories: string[];
  startDate: string | null;
  endDate: string | null;
  networkScore: number | null;
  status: ScreeningStatus;
  evidence: AnalyticsEvidence[];
}

export interface CompanyNetworkAnalysis {
  companyId: number;
  canonicalId: string;
  companyName: string;
  participationCount: number;
  wins: number;
  losses: number;
  degree: number;
  connectedTenders: Array<{
    tenderId: number;
    tenderNumber: string;
    title: string;
    organization: string;
    category: string;
    tenderDate: string;
    bidRank: number;
    isWinner: boolean;
    bidAmount: number;
  }>;
  frequentCoParticipants: Array<{
    companyId: number;
    canonicalId: string;
    companyName: string;
    sharedTenderCount: number;
    participationFrequency: number;
    commonCategories: string[];
    commonOrganizations: string[];
  }>;
  recurringGroups: RecurringBidderGroup[];
  indicator: AnalyticsIndicator;
  evidence: AnalyticsEvidence[];
}

export interface OverallNetworkAnalytics {
  bipartiteGraph: {
    nodes: NetworkNode[];
    companyNodes: CompanyNode[];
    tenderNodes: TenderNode[];
    edges: ParticipationEdge[];
    coParticipationEdges: CoParticipationEdge[];
  };
  summaryStatistics: {
    totalCompanies: number;
    totalTenders: number;
    totalParticipationEdges: number;
    totalCoParticipationPairs: number;
    recurringPairsCount: number; // pairs with shared >= minSharedTenders
    recurringGroupsCount: number;
    averageCompanyDegree: number;
    networkDensity: number;
  };
  topRecurringPairs: CoParticipationPair[];
  recurringBidderGroups: RecurringBidderGroup[];
  networkIndicatorsCount: number;
  calculatedAt: string;
  methodologyVersion: string;
}
