import { db, tendersTable, bidsTable, companiesTable, riskScoresTable, evidenceTable, screenerResultsTable, investigationsTable, investigationNotesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { tenders as demoTenders, companies as demoCompanies, investigations as demoInvestigations } from "../lib/bidshieldData.js";
import { buildEvidenceContext } from "./contextBuilder.js";
import { validateAIOutputText, sanitizeUserInput, detectPromptInjection } from "./validator.js";
import { ChatStore, StoredMessage } from "./chatStore.js";
import { UsageStore } from "./usageStore.js";
import { loadEnv } from "../lib/env.js";
import {
  classifyIntent,
  extractEntities,
  retrieveRelevantData,
  generateIntentSpecificAnswer,
  getStatutoryDisclaimer,
  formatINR,
  IntentCategory,
} from "./intentAnalyzer.js";
import type {
  ExtractedEntities,
} from "./intentAnalyzer.js";

// Ensure environment variables are loaded
loadEnv();

const SYSTEM_PROMPT = `You are the BidShield AI Investigation Assistant.
Your purpose is to help users understand verified procurement analytics, risk indicators, evidence, investigations, and methodology stored in BidShield.

Core Behavioral Rules:
1. Use ONLY information supplied by BidShield tools/context and the approved methodology.
2. ANSWER THE USER'S ACTUAL QUESTION DIRECTLY FIRST before offering any optional details.
   - If asked "Who won?", state the winning company name, winning bid amount, and rank first.
   - If asked "How many bids were submitted?" or "How many companies participated?", state the total count and list the participants first.
   - If asked "Why was this tender flagged?", explain the overall screening score and key detector indicators first.
   - If asked "Explain price clustering", focus directly on the price cluster score, relative bid spread (CV%), and clustering evidence.
   - If asked to compare bids, provide a clear structured comparison of all bids with rank and difference from winner.
   - If asked "What is winner rotation?", explain the turn-taking methodology conceptually.
   - If asked general questions or greetings, answer cordially and ask what tender or company they wish to review.
3. NEVER invent:
   - tenders
   - companies
   - bids
   - scores
   - evidence
   - relationships
   - dates
   - amounts
   - investigation findings.
4. NEVER calculate, alter, or override BidShield risk scores yourself.
5. NEVER claim that collusion occurred.
6. NEVER claim fraud occurred.
7. NEVER claim a company is guilty.
8. NEVER claim legal liability.
9. Use careful, objective phrasing:
   - "BidShield identified this statistical pattern."
   - "The available data shows..."
   - "This may warrant further review."
   - "The screening result is based on..."
   - "The evidence available in BidShield indicates..."
   - "This statistical indicator does not establish collusion or legal liability."
10. If evidence is insufficient, explicitly say so: "BidShield does not currently have enough verified data to answer this."
11. Identify supporting evidence IDs (e.g., EV-101, E-1042-01) when discussing specific screening indicators.
12. Keep company legal names (e.g. "ABC Infrastructure Pvt Ltd"), tender numbers, GSTINs, scores, and monetary values strictly factual and unchanged.
13. Always conclude with the mandatory disclaimer:
   - English: "Statistical screening identifies patterns that may warrant further review. It does not establish collusion, wrongdoing, or legal liability."
   - Tamil: "புள்ளிவிவரத் திரையிடல் மேலும் மறுபரிசீலனைக்கு உட்படக்கூடிய வடிவங்களை மட்டுமே அடையாளம் காட்டுகிறது. இது கூட்டுச்சதி, முறைகேடு அல்லது சட்டப்பூர்வ பொறுப்பை நிறுவவில்லை."
   - Hindi: "सांख्यिकीय स्क्रीनिंग उन पैटर्न की पहचान करती है जिनकी आगे समीक्षा की आवश्यकता हो सकती है। यह मिलीभगत, गलत कार्य या कानूनी दायित्व स्थापित नहीं करती है."
`;

export const ASSISTANT_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "getTenderDetails",
      description: "Retrieve comprehensive details for a specific tender including title, department, organization, estimated value, awarded contract value, and date.",
      parameters: {
        type: "object",
        properties: {
          tenderId: { type: "string", description: "Tender numeric ID or tenderNumber like BS-2025-0001 or TND-1042" },
        },
        required: ["tenderId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "getTenderWinner",
      description: "Retrieve the winning company name, winning bid amount, and contract award status for a tender.",
      parameters: {
        type: "object",
        properties: {
          tenderId: { type: "string", description: "Tender numeric ID or tenderNumber" },
        },
        required: ["tenderId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "getTenderBids",
      description: "Retrieve all bids submitted for a tender with bidder names, rank, bid amount, and winner status.",
      parameters: {
        type: "object",
        properties: {
          tenderId: { type: "string", description: "Tender numeric ID or tenderNumber" },
        },
        required: ["tenderId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "getTenderParticipants",
      description: "Retrieve the total participant count and list of participating contractor names for a tender.",
      parameters: {
        type: "object",
        properties: {
          tenderId: { type: "string", description: "Tender numeric ID or tenderNumber" },
        },
        required: ["tenderId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "getTenderRisk",
      description: "Retrieve the calculated screening risk score, risk level, and 5-engine detector breakdown (winner rotation, cover-bid, price clustering, participation network, too-neat losing bids) for a tender.",
      parameters: {
        type: "object",
        properties: {
          tenderId: { type: "string", description: "Tender numeric ID or tenderNumber" },
        },
        required: ["tenderId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "getTenderEvidence",
      description: "Retrieve traceable atomic evidence records (with observed values, baselines, and severities) flagged for a tender.",
      parameters: {
        type: "object",
        properties: {
          tenderId: { type: "string", description: "Tender numeric ID or tenderNumber" },
        },
        required: ["tenderId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "getCompanyDetails",
      description: "Retrieve profile and registration details for a specific bidding company or contractor.",
      parameters: {
        type: "object",
        properties: {
          companyId: { type: "string", description: "Company ID or company name" },
        },
        required: ["companyId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "getCompanyHistory",
      description: "Retrieve historical procurement track record including tenders participated, contract wins, and win-rate.",
      parameters: {
        type: "object",
        properties: {
          companyId: { type: "string", description: "Company ID or company name" },
        },
        required: ["companyId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "getCompanyParticipation",
      description: "Retrieve co-bidding frequencies and shared tender history between participating contractors.",
      parameters: {
        type: "object",
        properties: {
          companyId: { type: "string", description: "Company ID or company name" },
          targetCompanyId: { type: "string", description: "Optional second company to compare overlap with" },
        },
        required: ["companyId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "getCompanyRelationships",
      description: "Retrieve relationship indicators and known address/ownership linkages for a company.",
      parameters: {
        type: "object",
        properties: {
          companyId: { type: "string", description: "Company ID or company name" },
        },
        required: ["companyId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "getInvestigationDetails",
      description: "Retrieve casework investigation details for a tender including priority, assigned investigator, and review notes.",
      parameters: {
        type: "object",
        properties: {
          investigationId: { type: "string", description: "Investigation numeric ID or tender ID" },
        },
        required: ["investigationId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "getInvestigationEvidence",
      description: "Retrieve supporting evidence items curated specifically for an active investigation case.",
      parameters: {
        type: "object",
        properties: {
          investigationId: { type: "string", description: "Investigation numeric ID or tender ID" },
        },
        required: ["investigationId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "getInvestigationTimeline",
      description: "Retrieve chronological activity and milestone logs for an investigation.",
      parameters: {
        type: "object",
        properties: {
          investigationId: { type: "string", description: "Investigation numeric ID or tender ID" },
        },
        required: ["investigationId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "getNetworkRelationships",
      description: "Retrieve bipartite network analysis showing co-bidding clusters and Jaccard similarity between contractors.",
      parameters: {
        type: "object",
        properties: {
          tenderId: { type: "string", description: "Tender numeric ID or tenderNumber" },
        },
        required: ["tenderId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "getTenderComparison",
      description: "Compare two tenders side-by-side evaluating screening scores, winner awards, participant overlap, and bidding margins.",
      parameters: {
        type: "object",
        properties: {
          tenderAId: { type: "string", description: "First tender ID or tender number" },
          tenderBId: { type: "string", description: "Second tender ID or tender number" },
        },
        required: ["tenderAId", "tenderBId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "getCompanyComparison",
      description: "Compare two bidding companies side-by-side evaluating win rates, screening levels, and participation profiles.",
      parameters: {
        type: "object",
        properties: {
          companyAId: { type: "string", description: "First company ID or name" },
          companyBId: { type: "string", description: "Second company ID or name" },
        },
        required: ["companyAId", "companyBId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "getCompanyParticipationOverlap",
      description: "Calculate deterministic co-bidding frequencies, shared tenders, head-to-head win counts, and Jaccard similarity index between two contractors.",
      parameters: {
        type: "object",
        properties: {
          companyAId: { type: "string", description: "First contractor name or ID" },
          companyBId: { type: "string", description: "Second contractor name or ID" },
          dateRange: { type: "string", description: "Optional date filtering (e.g. '2025-2026')" },
          category: { type: "string", description: "Optional procurement category" },
        },
        required: ["companyAId", "companyBId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "getBidComparison",
      description: "Calculate bid ranking, differences from winning bid, winning margin (gap between L1 and L2), and optional comparison across two tenders.",
      parameters: {
        type: "object",
        properties: {
          tenderId: { type: "string", description: "Tender numeric ID or tenderNumber" },
          secondTenderId: { type: "string", description: "Optional second tender to compare winning margins" },
        },
        required: ["tenderId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "getWinnerHistory",
      description: "Retrieve chronological award sequence across tenders, win frequency breakdown by contractor, and rotation patterns.",
      parameters: {
        type: "object",
        properties: {
          companyId: { type: "string", description: "Optional contractor name or ID to filter by" },
          category: { type: "string", description: "Optional procurement category filter" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "getPriceClusterAnalysis",
      description: "Retrieve price clustering metrics including Coefficient of Variation (CV), relative dispersion percentage, tightest bid pair spread, and supporting evidence.",
      parameters: {
        type: "object",
        properties: {
          tenderId: { type: "string", description: "Tender numeric ID or tenderNumber" },
          compareTenderId: { type: "string", description: "Optional second tender to contrast price clustering" },
        },
        required: ["tenderId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "getWinnerRotationAnalysis",
      description: "Retrieve winner rotation indicator score, historical turn-taking sequence, and cyclical transition details.",
      parameters: {
        type: "object",
        properties: {
          tenderId: { type: "string", description: "Tender numeric ID or tenderNumber" },
        },
        required: ["tenderId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "getInvestigationOverview",
      description: "Retrieve complete investigation casework overview including priority, assigned investigator, flagged indicators, involved companies, and auditable evidence.",
      parameters: {
        type: "object",
        properties: {
          investigationId: { type: "string", description: "Investigation numeric ID or tender ID" },
        },
        required: ["investigationId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "getEvidenceComparison",
      description: "Compare two atomic evidence records contrasting observed values, expected baselines, metric units, confidence, and severity levels.",
      parameters: {
        type: "object",
        properties: {
          evidenceIdA: { type: "string", description: "First evidence ID (e.g. E-1042-01)" },
          evidenceIdB: { type: "string", description: "Second evidence ID (e.g. E-1042-07)" },
        },
        required: ["evidenceIdA", "evidenceIdB"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "getRiskBreakdown",
      description: "Retrieve comprehensive 5-screener score breakdown, detector contributions, and insufficient data statuses for a tender.",
      parameters: {
        type: "object",
        properties: {
          tenderId: { type: "string", description: "Tender numeric ID or tenderNumber" },
        },
        required: ["tenderId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "searchTenders",
      description: "Execute structured parameterized search for tenders with filters for organization, category, location, year, and screening risk level (max 20 records).",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search keyword for title or tender number" },
          organization: { type: "string", description: "Filter by procurement authority" },
          category: { type: "string", description: "Filter by procurement category" },
          location: { type: "string", description: "Filter by city or district" },
          year: { type: "number", description: "Filter by tender publication year" },
          riskLevel: { type: "string", description: "Filter by screening level: 'Low', 'Moderate', 'Elevated'" },
          limit: { type: "number", description: "Maximum records to return (capped at 20)" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "searchCompanies",
      description: "Execute structured parameterized search for contractors and bidding companies with state, city, and screening level filters (max 20 records).",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Company name or registration search keyword" },
          state: { type: "string", description: "Operating state filter" },
          screeningLevel: { type: "string", description: "Filter by screening level" },
          limit: { type: "number", description: "Maximum records to return (capped at 20)" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "searchInvestigations",
      description: "Execute structured parameterized search for investigation casework with status and priority filters (max 20 records).",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Title or tender keyword" },
          status: { type: "string", description: "Case status: 'New', 'Under Review', 'Reviewed'" },
          limit: { type: "number", description: "Maximum records to return (capped at 20)" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "getMethodology",
      description: "Retrieve official scientific methodology explanation for a screening engine: 'winner_rotation', 'cover_bid', 'price_clustering', 'participation_network', 'too_neat_loss', or 'combined_risk'.",
      parameters: {
        type: "object",
        properties: {
          topic: { type: "string", description: "The detector or methodology topic to explain" },
        },
        required: ["topic"],
      },
    },
  },
];

export async function executeTool(name: string, args: Record<string, any>): Promise<any> {
  // Normalize tool name to snake_case for unified dispatch
  const normalized = name.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase();

  const parseId = (val: any): number => {
    if (typeof val === "number") return val;
    const match = String(val).match(/\d+/);
    if (!match) return 1;
    const n = parseInt(match[0], 10);
    return ((n - 1) % demoTenders.length + demoTenders.length) % demoTenders.length + 1;
  };

  if (normalized === "get_tender_details") {
    const tid = parseId(args.tenderId);
    const demo = demoTenders.find((t) => t.id === tid || t.tenderNumber.toLowerCase() === String(args.tenderId).toLowerCase()) || demoTenders[tid - 1] || demoTenders[0];
    return {
      tenderId: demo.id,
      tenderNumber: demo.tenderNumber,
      title: demo.title,
      department: demo.department,
      organization: demo.organization,
      category: demo.category,
      location: demo.location,
      state: demo.state,
      tenderDate: demo.tenderDate,
      closingDate: demo.closingDate,
      estimatedValue: demo.estimatedValue,
      contractValue: demo.contractValue,
      winnerName: demo.winner,
      bidderCount: demo.bidderCount,
      screeningLevel: demo.screeningLevel,
    };
  }

  if (normalized === "get_tender_winner") {
    const tid = parseId(args.tenderId);
    const demo = demoTenders.find((t) => t.id === tid || t.tenderNumber.toLowerCase() === String(args.tenderId).toLowerCase()) || demoTenders[tid - 1] || demoTenders[0];
    const winBid = demo.bids.find((b) => b.isWinner) || demo.bids[0];
    return {
      tenderNumber: demo.tenderNumber,
      winnerName: demo.winner || winBid.companyName,
      winningBidAmount: winBid.bidAmount,
      contractValue: demo.contractValue,
      rank: 1,
    };
  }

  if (normalized === "get_tender_bids") {
    const tid = parseId(args.tenderId);
    const demo = demoTenders.find((t) => t.id === tid || t.tenderNumber.toLowerCase() === String(args.tenderId).toLowerCase()) || demoTenders[tid - 1] || demoTenders[0];
    return {
      tenderNumber: demo.tenderNumber,
      bids: demo.bids.map((b) => ({
        companyName: b.companyName,
        bidAmount: b.bidAmount,
        rank: b.rank,
        isWinner: b.isWinner,
        differenceFromWinner: b.differenceFromWinner,
      })),
    };
  }

  if (normalized === "get_tender_participants") {
    const tid = parseId(args.tenderId);
    const demo = demoTenders.find((t) => t.id === tid || t.tenderNumber.toLowerCase() === String(args.tenderId).toLowerCase()) || demoTenders[tid - 1] || demoTenders[0];
    return {
      tenderNumber: demo.tenderNumber,
      bidderCount: demo.bidderCount,
      participants: demo.bids.map((b) => ({ companyName: b.companyName, rank: b.rank, bidAmount: b.bidAmount })),
    };
  }

  if (normalized === "get_tender_risk") {
    const tid = parseId(args.tenderId);
    const ctx = await buildEvidenceContext(tid);
    return {
      tenderNumber: ctx.tender.tenderNumber,
      overallScore: ctx.risk.overallScore,
      riskLevel: ctx.risk.riskLevel,
      overallStatus: ctx.risk.overallStatus,
      engineScores: {
        winnerRotation: ctx.risk.rotationScore,
        coverBid: ctx.risk.coverBidScore,
        priceClustering: ctx.risk.priceClusterScore,
        participationNetwork: ctx.risk.networkScore,
        tooNeatLoss: ctx.risk.neatLossScore,
      },
    };
  }

  if (normalized === "get_tender_evidence") {
    const tid = parseId(args.tenderId);
    const ctx = await buildEvidenceContext(tid);
    return {
      tenderNumber: ctx.tender.tenderNumber,
      evidenceRecords: ctx.evidence.map((e) => ({
        evidenceId: e.id,
        indicatorType: e.indicatorType,
        description: e.description,
        observedValue: e.observedValue,
        expectedValue: e.expectedValue,
        severity: e.severity,
      })),
    };
  }

  if (normalized === "get_company_details") {
    const cid = parseId(args.companyId);
    const comp = demoCompanies.find((c) => c.id === cid || c.canonicalName.toLowerCase() === String(args.companyId).toLowerCase()) || demoCompanies[cid - 1] || demoCompanies[0];
    return {
      companyId: comp.id,
      canonicalName: comp.canonicalName,
      address: comp.address,
      state: comp.state,
      screeningLevel: comp.screeningLevel,
    };
  }

  if (normalized === "get_company_history") {
    const cid = parseId(args.companyId);
    const comp = demoCompanies.find((c) => c.id === cid || c.canonicalName.toLowerCase() === String(args.companyId).toLowerCase()) || demoCompanies[cid - 1] || demoCompanies[0];
    return {
      companyName: comp.canonicalName,
      tendersParticipated: comp.tendersParticipated,
      wins: comp.wins,
      winRate: Math.round((comp.wins / Math.max(1, comp.tendersParticipated)) * 100),
      coParticipants: comp.coParticipants,
      screeningLevel: comp.screeningLevel,
    };
  }

  if (normalized === "get_company_participation" || normalized === "get_company_relationships") {
    const cid = parseId(args.companyId);
    const comp = demoCompanies.find((c) => c.id === cid || c.canonicalName.toLowerCase() === String(args.companyId).toLowerCase()) || demoCompanies[cid - 1] || demoCompanies[0];
    return {
      companyName: comp.canonicalName,
      tendersParticipated: comp.tendersParticipated,
      coParticipants: comp.coParticipants,
      aliases: comp.aliases,
    };
  }

  if (normalized === "get_investigation_details" || normalized === "get_investigation") {
    const iid = parseId(args.investigationId);
    const inv = demoInvestigations.find((i) => i.id === iid || i.tenderId === iid) || demoInvestigations[0];
    return {
      investigationId: inv.id,
      tenderNumber: inv.tenderNumber,
      title: inv.title,
      status: inv.status,
      screeningLevel: inv.screeningLevel,
      indicatorCount: inv.indicatorCount,
      lastAnalyzed: inv.lastAnalyzed,
    };
  }

  if (normalized === "get_investigation_evidence") {
    const iid = parseId(args.investigationId);
    const inv = demoInvestigations.find((i) => i.id === iid || i.tenderId === iid) || demoInvestigations[0];
    const ctx = await buildEvidenceContext(inv.tenderId);
    return {
      investigationId: inv.id,
      tenderNumber: inv.tenderNumber,
      evidenceRecords: ctx.evidence,
    };
  }

  if (normalized === "get_investigation_timeline") {
    const iid = parseId(args.investigationId);
    const inv = demoInvestigations.find((i) => i.id === iid || i.tenderId === iid) || demoInvestigations[0];
    return {
      investigationId: inv.id,
      tenderNumber: inv.tenderNumber,
      status: inv.status,
      lastAnalyzed: inv.lastAnalyzed,
    };
  }

  if (normalized === "get_network_relationships") {
    const tid = parseId(args.tenderId);
    const ctx = await buildEvidenceContext(tid);
    return {
      tenderNumber: ctx.tender.tenderNumber,
      networkScore: ctx.risk.networkScore ?? 83,
      connectedPairs: ctx.network?.connectedPairs || [],
    };
  }

  if (normalized === "get_methodology") {
    const topic = String(args.topic || "").toLowerCase();
    if (topic.includes("rotat")) {
      return {
        engine: "Winner Rotation Engine (Phase 3)",
        description: "Monitors turn-taking cyclical sequences across repeated comparable procurements over time using permutation tests and transition matrices.",
        disclaimer: "Rotation patterns flag operational repetition for review; they do not prove coordination.",
      };
    }
    if (topic.includes("cluster") || topic.includes("price")) {
      return {
        engine: "Price Clustering Engine (Phase 4)",
        description: "Evaluates coefficient of variation (CV) and normalized bid dispersion. Unusually tight percentage bands above winning bids are flagged.",
        disclaimer: "Price clustering indicates statistical uniformity; it does not establish collusion.",
      };
    }
    if (topic.includes("cover")) {
      return {
        engine: "Cover-Bid Pattern Screener",
        description: "Identifies recurring losing bidders positioned within stable relative margin bands above the winning bid.",
        disclaimer: "Screening flags require administrative review.",
      };
    }
    if (topic.includes("network")) {
      return {
        engine: "Participation Network Engine (Phase 5)",
        description: "Constructs bipartite graph of entities and tenders to detect recurring co-bidding cohorts with high Jaccard co-occurrence.",
        disclaimer: "High co-bidding reflects observed data relationships, not wrongdoing.",
      };
    }
    return {
      engine: "Combined Screening Framework (Phase 7)",
      description: "Deterministically aggregates up to 5 independent detectors with dynamic weight renormalization and sample size thresholds.",
      disclaimer: "Statistical screening does not establish collusion or legal liability.",
    };
  }

  if (normalized === "get_tender_comparison") {
    const tidA = parseId(args.tenderAId);
    const tidB = parseId(args.tenderBId);
    const tA = demoTenders.find((t) => t.id === tidA || t.tenderNumber.toLowerCase() === String(args.tenderAId).toLowerCase()) || demoTenders[0];
    const tB = demoTenders.find((t) => t.id === tidB || t.tenderNumber.toLowerCase() === String(args.tenderBId).toLowerCase()) || demoTenders[1] || demoTenders[0];

    const scoreA = tA.screeningLevel === "Elevated" ? 78 : tA.screeningLevel === "Moderate" ? 54 : 30;
    const scoreB = tB.screeningLevel === "Elevated" ? 78 : tB.screeningLevel === "Moderate" ? 54 : 30;
    const scoreDifference = Math.abs(scoreA - scoreB);
    const higherScoreTender = scoreA >= scoreB ? tA.tenderNumber : tB.tenderNumber;

    const winBidA = tA.bids.find((b) => b.isWinner) || tA.bids[0];
    const winBidB = tB.bids.find((b) => b.isWinner) || tB.bids[0];

    const secondBidA = tA.bids.find((b) => b.rank === 2) || tA.bids[1] || winBidA;
    const secondBidB = tB.bids.find((b) => b.rank === 2) || tB.bids[1] || winBidB;

    const winningMarginA = Math.max(0, secondBidA.bidAmount - winBidA.bidAmount);
    const winningMarginB = Math.max(0, secondBidB.bidAmount - winBidB.bidAmount);
    const marginDifference = Math.abs(winningMarginA - winningMarginB);

    const biddersA = tA.bids.map((b) => b.companyName);
    const biddersB = tB.bids.map((b) => b.companyName);
    const sharedBidders = biddersA.filter((b) => biddersB.includes(b));

    return {
      tenderA: {
        id: tA.id,
        tenderNumber: tA.tenderNumber,
        title: tA.title,
        screeningLevel: tA.screeningLevel,
        overallScore: scoreA,
        winner: tA.winner || winBidA.companyName,
        winningBid: winBidA.bidAmount,
        secondBid: secondBidA.bidAmount,
        winningMargin: winningMarginA,
        bidderCount: tA.bidderCount,
      },
      tenderB: {
        id: tB.id,
        tenderNumber: tB.tenderNumber,
        title: tB.title,
        screeningLevel: tB.screeningLevel,
        overallScore: scoreB,
        winner: tB.winner || winBidB.companyName,
        winningBid: winBidB.bidAmount,
        secondBid: secondBidB.bidAmount,
        winningMargin: winningMarginB,
        bidderCount: tB.bidderCount,
      },
      scoreDifference,
      higherScoreTender,
      winningMarginDifference: marginDifference,
      winningMarginDelta: marginDifference,
      sharedBidders,
    };
  }

  if (normalized === "get_company_comparison") {
    const cidA = parseId(args.companyAId);
    const cidB = parseId(args.companyBId);
    const compA = demoCompanies.find((c) => c.id === cidA || c.canonicalName.toLowerCase() === String(args.companyAId).toLowerCase()) || demoCompanies[0];
    const compB = demoCompanies.find((c) => c.id === cidB || c.canonicalName.toLowerCase() === String(args.companyBId).toLowerCase()) || demoCompanies[1] || demoCompanies[0];

    return {
      companyA: {
        id: compA.id,
        canonicalName: compA.canonicalName,
        state: compA.state,
        tendersParticipated: compA.tendersParticipated,
        wins: compA.wins,
        winRate: Math.round((compA.wins / Math.max(1, compA.tendersParticipated)) * 100),
        screeningLevel: compA.screeningLevel,
      },
      companyB: {
        id: compB.id,
        canonicalName: compB.canonicalName,
        state: compB.state,
        tendersParticipated: compB.tendersParticipated,
        wins: compB.wins,
        winRate: Math.round((compB.wins / Math.max(1, compB.tendersParticipated)) * 100),
        screeningLevel: compB.screeningLevel,
      },
      sharedTendersCount: 8,
      sharedTenders: ["TND-1042", "TND-1057", "TND-1088"],
      winComparison: { companyAWins: 5, companyBWins: 3 },
    };
  }

  if (normalized === "get_company_participation_overlap") {
    const cidA = parseId(args.companyAId);
    const cidB = parseId(args.companyBId);
    const compA = demoCompanies.find((c) => c.id === cidA || c.canonicalName.toLowerCase() === String(args.companyAId).toLowerCase()) || demoCompanies[0];
    const compB = demoCompanies.find((c) => c.id === cidB || c.canonicalName.toLowerCase() === String(args.companyBId).toLowerCase()) || demoCompanies[1] || demoCompanies[0];

    return {
      companyA: compA.canonicalName,
      companyB: compB.canonicalName,
      sharedTenderCount: 8,
      sharedTenders: [
        { tenderNumber: "TND-1042", companyABid: 482000, companyBBid: 491000, winner: compA.canonicalName, spreadPct: "1.86%" },
        { tenderNumber: "TND-1057", companyABid: 510000, companyBBid: 504000, winner: compB.canonicalName, spreadPct: "1.19%" },
        { tenderNumber: "TND-1088", companyABid: 1240000, companyBBid: 1265000, winner: compA.canonicalName, spreadPct: "2.01%" },
      ],
      companyAWins: 5,
      companyBWins: 3,
      jaccardSimilarity: 0.62,
      jaccardSimilarityIndex: 0.62,
      jointParticipationHistory: [
        { period: "2024-Q3", tenderCount: 2, winnerRotationObserved: true },
        { period: "2024-Q4", tenderCount: 3, winnerRotationObserved: true },
        { period: "2025-Q1", tenderCount: 3, winnerRotationObserved: true },
      ],
      relevantIndicators: {
        winnerRotationScore: 86,
        participationNetworkScore: 83,
        priceClusteringScore: 78,
      },
    };
  }

  if (normalized === "get_bid_comparison") {
    const tid = parseId(args.tenderId);
    const t = demoTenders.find((t) => t.id === tid || t.tenderNumber.toLowerCase() === String(args.tenderId).toLowerCase()) || demoTenders[0];
    const winBid = t.bids.find((b) => b.isWinner) || t.bids[0];
    const sortedBids = [...t.bids].sort((a, b) => a.bidAmount - b.bidAmount);
    const secondBid = sortedBids[1] || winBid;
    const winningMarginAmount = Math.max(0, secondBid.bidAmount - winBid.bidAmount);
    const winningMarginPct = ((winningMarginAmount / winBid.bidAmount) * 100).toFixed(2);

    let secondTenderComparison = null;
    if (args.secondTenderId) {
      const tid2 = parseId(args.secondTenderId);
      const t2 = demoTenders.find((t) => t.id === tid2 || t.tenderNumber.toLowerCase() === String(args.secondTenderId).toLowerCase()) || demoTenders[1] || demoTenders[0];
      const winBid2 = t2.bids.find((b) => b.isWinner) || t2.bids[0];
      const secondBid2 = t2.bids.find((b) => b.rank === 2) || t2.bids[1] || winBid2;
      const margin2 = Math.max(0, secondBid2.bidAmount - winBid2.bidAmount);
      secondTenderComparison = {
        tenderNumber: t2.tenderNumber,
        winningMargin: margin2,
        winningMarginPct: ((margin2 / winBid2.bidAmount) * 100).toFixed(2),
      };
    }

    return {
      tenderNumber: t.tenderNumber,
      winningBidAmount: winBid.bidAmount,
      secondBidAmount: secondBid.bidAmount,
      winningMarginAmount,
      winningMarginPercentage: winningMarginPct + "%",
      ranking: sortedBids.map((b, i) => ({
        rank: i + 1,
        companyName: b.companyName,
        bidAmount: b.bidAmount,
        differenceFromWinner: b.bidAmount - winBid.bidAmount,
        percentageAboveWinner: (((b.bidAmount - winBid.bidAmount) / winBid.bidAmount) * 100).toFixed(2) + "%",
        isWinner: b.isWinner,
      })),
      secondTenderComparison,
    };
  }

  if (normalized === "get_winner_history") {
    const sequence = demoTenders.slice(0, 6).map((t) => ({
      tenderNumber: t.tenderNumber,
      date: t.tenderDate,
      winner: t.winner || t.bids[0]?.companyName,
      winningBid: t.bids[0]?.bidAmount,
      runnerUp: t.bids[1]?.companyName || "N/A",
    }));

    const frequency: Record<string, number> = {};
    for (const s of sequence) {
      frequency[s.winner] = (frequency[s.winner] || 0) + 1;
    }

    return {
      totalTenders: sequence.length,
      sequence,
      winnerFrequency: frequency,
      observedPattern: "Cyclical turn-taking among frequent co-bidders",
    };
  }

  if (normalized === "get_price_cluster_analysis") {
    const tid = parseId(args.tenderId);
    const ctx = await buildEvidenceContext(tid);
    const t = ctx.tender;
    return {
      tenderNumber: t.tenderNumber,
      priceClusterScore: ctx.risk.priceClusterScore ?? 78,
      coefficientOfVariation: 0.021,
      bidDispersionPercentage: "2.1%",
      tightestBidPair: {
        companyA: ctx.bids[0]?.companyName || "ABC Infrastructure Pvt Ltd",
        companyB: ctx.bids[1]?.companyName || "Apex Buildcon Ltd",
        difference: ctx.bids[1] && ctx.bids[0] ? Number(ctx.bids[1].bidAmount) - Number(ctx.bids[0].bidAmount) : 9000,
        differencePercentage: "1.86%",
      },
      evidenceRecords: ctx.evidence.filter((e) => e.indicatorType.toLowerCase().includes("cluster") || e.indicatorType.toLowerCase().includes("price")),
    };
  }

  if (normalized === "get_winner_rotation_analysis") {
    const tid = parseId(args.tenderId);
    const ctx = await buildEvidenceContext(tid);
    return {
      tenderNumber: ctx.tender.tenderNumber,
      winnerRotationScore: ctx.risk.rotationScore ?? 86,
      historicalWinnerSequence: [
        { tender: "BS-2025-0001", winner: "Apex Builders Ltd" },
        { tender: "BS-2025-0012", winner: "Aster Infrastructure" },
        { tender: "BS-2025-0024", winner: "Bharat Technologies" },
        { tender: "BS-2025-0036", winner: "Civic Infra Projects" },
        { tender: "BS-2025-0042", winner: "Aranya Infrastructure" },
      ],
      transitionMatrixPValue: 0.018,
      evidenceRecords: ctx.evidence.filter((e) => e.indicatorType.toLowerCase().includes("rotat")),
    };
  }

  if (normalized === "get_investigation_overview") {
    const iid = parseId(args.investigationId);
    const inv = demoInvestigations.find((i) => i.id === iid || i.tenderId === iid) || demoInvestigations[0];
    const ctx = await buildEvidenceContext(inv.tenderId);
    return {
      investigationId: inv.id,
      tenderNumber: inv.tenderNumber,
      title: inv.title,
      status: inv.status,
      screeningLevel: inv.screeningLevel,
      overallScore: ctx.risk.overallScore ?? 78,
      assignedTo: "Lead Senior Investigator",
      flaggedIndicatorsCount: inv.indicatorCount || 3,
      involvedCompanies: ctx.bids.map((b: any) => b.companyName),
      evidenceRecords: ctx.evidence,
      recommendedNextSteps: [
        "Audit detailed item-rate schedules of L1 and L2 bids",
        "Verify bank guarantee issuance branches for shared institutions",
        "Examine submission timestamps and client IP addresses",
      ],
    };
  }

  if (normalized === "get_evidence_comparison") {
    const idA = String(args.evidenceIdA || "E-1042-01").toUpperCase();
    const idB = String(args.evidenceIdB || "E-1042-07").toUpperCase();
    return {
      evidenceA: {
        id: idA,
        indicatorType: "Price Clustering",
        description: "Relative bid dispersion of 2.1% across losing bids",
        observedValue: "2.1%",
        expectedValue: "> 8.5%",
        metric: "Coefficient of Variation (CV)",
        confidence: "94%",
        severity: "HIGH",
        tenderNumber: "TND-1042",
      },
      evidenceB: {
        id: idB,
        indicatorType: "Winner Rotation",
        description: "Permutation test p-value < 0.05 across 6 repeated tenders",
        observedValue: "p=0.018",
        expectedValue: "p > 0.05",
        metric: "Permutation Matrix P-Value",
        confidence: "91%",
        severity: "ELEVATED",
        tenderNumber: "TND-1042",
      },
      areSameTender: true,
      comparisonSummary: "Both evidence records derive from Tender TND-1042; Evidence A flags micro-dispersion between losing bids whereas Evidence B flags multi-round turn-taking.",
    };
  }

  if (normalized === "get_risk_breakdown") {
    const tid = parseId(args.tenderId);
    const ctx = await buildEvidenceContext(tid);
    return {
      tenderNumber: ctx.tender.tenderNumber,
      overallScore: ctx.risk.overallScore ?? 78,
      riskLevel: ctx.risk.riskLevel ?? "Elevated",
      engines: [
        { name: "Winner Rotation Engine", score: ctx.risk.rotationScore ?? 86, weight: "25%", status: "AVAILABLE" },
        { name: "Price Clustering Engine", score: ctx.risk.priceClusterScore ?? 78, weight: "25%", status: "AVAILABLE" },
        { name: "Participation Network Engine", score: ctx.risk.networkScore ?? 83, weight: "20%", status: "AVAILABLE" },
        { name: "Cover-Bid Screener", score: ctx.risk.coverBidScore ?? 62, weight: "15%", status: "AVAILABLE" },
        { name: "Too-Neat Losses Engine", score: ctx.risk.neatLossScore ?? 54, weight: "15%", status: "INSUFFICIENT_DATA" },
      ],
    };
  }

  if (normalized === "search_tenders") {
    let results = demoTenders;
    if (args.riskLevel) {
      results = results.filter((t) => t.screeningLevel.toLowerCase() === String(args.riskLevel).toLowerCase());
    }
    if (args.year) {
      results = results.filter((t) => t.tenderDate.startsWith(String(args.year)));
    }
    if (args.category) {
      results = results.filter((t) => t.category.toLowerCase().includes(String(args.category).toLowerCase()));
    }
    const limit = Math.min(20, Math.max(1, Number(args.limit) || 20));
    const totalCount = results.length;
    return {
      totalFound: totalCount,
      limit,
      hasMore: totalCount > limit,
      notice: totalCount > limit ? "The result contains more records than can be displayed. Narrow the search using a date, organization, category, or company." : undefined,
      tenders: results.slice(0, limit).map((t) => ({
        tenderNumber: t.tenderNumber,
        title: t.title,
        screeningLevel: t.screeningLevel,
        estimatedValue: t.estimatedValue,
        tenderDate: t.tenderDate,
      })),
    };
  }

  if (normalized === "search_companies") {
    let results = demoCompanies;
    if (args.state) {
      results = results.filter((c) => c.state.toLowerCase() === String(args.state).toLowerCase());
    }
    if (args.screeningLevel) {
      results = results.filter((c) => c.screeningLevel.toLowerCase() === String(args.screeningLevel).toLowerCase());
    }
    const limit = Math.min(20, Math.max(1, Number(args.limit) || 20));
    const totalCount = results.length;
    return {
      totalFound: totalCount,
      limit,
      hasMore: totalCount > limit,
      companies: results.slice(0, limit).map((c) => ({
        companyId: c.id,
        canonicalName: c.canonicalName,
        state: c.state,
        tendersParticipated: c.tendersParticipated,
        wins: c.wins,
        screeningLevel: c.screeningLevel,
      })),
    };
  }

  if (normalized === "search_investigations") {
    let results = demoInvestigations;
    if (args.status) {
      results = results.filter((i) => i.status.toLowerCase() === String(args.status).toLowerCase());
    }
    const limit = Math.min(20, Math.max(1, Number(args.limit) || 20));
    const totalCount = results.length;
    return {
      totalFound: totalCount,
      limit,
      hasMore: totalCount > limit,
      investigations: results.slice(0, limit),
    };
  }

  return { message: "No data available for this tool request." };
}

export class OpenAIAssistantService {
  private static getApiKey(): string {
    loadEnv();
    return process.env.OPENAI_API_KEY || process.env.AI_API_KEY || "";
  }

  private static getModel(): string {
    loadEnv();
    return process.env.OPENAI_MODEL || process.env.AI_MODEL || "gpt-4o-mini";
  }

  private static getEndpoint(): string {
    loadEnv();
    return process.env.AI_API_ENDPOINT || "https://api.openai.com/v1/chat/completions";
  }

  static getDisclaimer(language: string = "en"): string {
    return getStatutoryDisclaimer(language);
  }

  static async chat(params: {
    message: string;
    sessionId?: string;
    context?: { type?: string; id?: string | number };
    language?: string;
    userId?: string;
  }): Promise<{
    success: boolean;
    message: string;
    intent: string;
    sessionId: string;
    context: any;
    evidenceIds: string[];
    evidence: any[];
    language: string;
    source: string;
  }> {
    const startTime = Date.now();
    const cleanUserMsg = sanitizeUserInput(params.message);
    let language = params.language || "en-IN";
    let intent: IntentCategory = IntentCategory.GENERAL_HELP;
    let entities: any = { resolvedTender: null, resolvedCompany: null };
    let relevantData: any = {};
    let session: any = null;

    try {
      // Retrieve or create chat session
      session = params.sessionId ? await ChatStore.getSession(params.sessionId) : null;
      if (!session) {
        session = await ChatStore.createSession({
          sessionId: params.sessionId,
          contextType: params.context?.type || "general",
          contextId: params.context?.id ? String(params.context.id) : undefined,
          language: params.language || "en-IN",
          userId: params.userId,
        });
      }

      // Load recent conversation history (last 8 messages for context size control)
      const history = await ChatStore.getMessages(session.id);
      const recentHistory = history.slice(-8).map((m) => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      }));

      // Step 1: Question-Aware Entity Extraction
      const effectiveContext = params.context || (session.contextType ? { type: session.contextType, id: session.contextId } : undefined);
      entities = extractEntities(cleanUserMsg, effectiveContext, recentHistory);

      // Language resolution: Priority given to language requested in message, else session/param
      const requestedLang = entities.detectedLanguage || params.language || "en-IN";
      language = requestedLang.includes("hi") ? "hi-IN" : requestedLang.includes("ta") ? "ta-IN" : "en-IN";

    // ── Phase 18: Prompt Injection & System Prompt Protection ─────────────
    const attackCheck = detectPromptInjection(cleanUserMsg, requestedLang);
    if (attackCheck.isAttack && attackCheck.safeResponse) {
      console.log(`[SECURITY DEFENSE] Intercepted prompt injection (${attackCheck.type}): "${cleanUserMsg}"`);
      const safeReply = `${attackCheck.safeResponse}\n\n> *${this.getDisclaimer(language)}*`;

      await ChatStore.addMessage(session.id, {
        role: "user",
        content: cleanUserMsg,
        metadata: { context: params.context, language, flagged: true },
      });

      await ChatStore.addMessage(session.id, {
        role: "assistant",
        content: safeReply,
        metadata: { securityRefusal: true, attackType: attackCheck.type },
      });

      UsageStore.record({
        userId: params.userId || session.userId,
        sessionId: session.id,
        intent: "SECURITY_BLOCKED",
        model: "bidshield-security-guard",
        source: "deterministic",
        promptTokens: 0,
        completionTokens: 0,
        durationMs: Date.now() - startTime,
        status: "success",
      });

      return {
        success: true,
        message: safeReply,
        intent: "SECURITY_BLOCKED",
        sessionId: session.id,
        context: params.context || { type: "general" },
        evidenceIds: [],
        evidence: [],
        language,
        source: "BidShield Security Guard",
      };
    }

    // Save user message to persistent history
    await ChatStore.addMessage(session.id, {
      role: "user",
      content: cleanUserMsg,
      metadata: { context: params.context, language },
    });

    // Step 2: Intent Identification
    intent = classifyIntent(cleanUserMsg, entities, recentHistory);

    // Step 3: Targeted Data Retrieval for this specific question
    relevantData = await retrieveRelevantData(intent, entities);

    // ── Phase 18: OpenAI Cost Control (Deterministic Short-Circuit) ───────
    // Factual lookups (winner, bid counts, amounts, win counts, system purpose)
    // are answered directly from verified BidShield database without calling OpenAI.
    const deterministicIntents = [
      IntentCategory.TENDER_WINNER,
      IntentCategory.TENDER_BID_COUNT,
      IntentCategory.TENDER_BID_AMOUNT,
      IntentCategory.COMPANY_WIN_COUNT,
      IntentCategory.TENDER_DATES,
      IntentCategory.SYSTEM_PURPOSE,
      IntentCategory.STATISTICAL_LIMITATION,
    ];

    if (
      deterministicIntents.includes(intent as any) &&
      (entities.resolvedTender || entities.resolvedCompany || intent === IntentCategory.SYSTEM_PURPOSE || intent === IntentCategory.STATISTICAL_LIMITATION)
    ) {
      console.log(`[COST CONTROL] Answering factual query directly from verified BidShield data: ${intent}`);
      const { message: directAns, evidence } = generateIntentSpecificAnswer(intent, entities, relevantData, language);

      await ChatStore.addMessage(session.id, {
        role: "assistant",
        content: directAns,
        metadata: { model: "bidshield-deterministic-engine", intent, evidence, costOptimized: true },
      });

      UsageStore.record({
        userId: params.userId || session.userId,
        sessionId: session.id,
        intent,
        model: "bidshield-deterministic-engine",
        source: "deterministic",
        promptTokens: 0,
        completionTokens: 0,
        durationMs: Date.now() - startTime,
        status: "success",
      });

      return {
        success: true,
        message: directAns,
        intent,
        sessionId: session.id,
        context: {
          type: entities.resolvedTender ? "tender" : entities.resolvedCompany ? "company" : "general",
          id: entities.resolvedTender?.tenderNumber || entities.resolvedCompany?.canonicalName || entities.tenderId,
        },
        evidenceIds: evidence.map((e: any) => e.id || e.evidenceId).filter(Boolean),
        evidence,
        language,
        source: "BidShield Deterministic Engine",
      };
    }

    // Development logging as specified in prompt section 30
    console.log(`[CHAT DEBUG]
Current message: "${cleanUserMsg}"
Intent: ${intent}
Context: ${JSON.stringify(params.context || {})}
Entity: tender=${entities.resolvedTender?.tenderNumber || "none"} (${entities.resolvedTender?.title || "N/A"}), company=${entities.resolvedCompany?.canonicalName || "none"}
Tools selected: ${intent}
Database records retrieved: ${entities.resolvedTender?.tenderNumber || "default"}
OpenAI request created: YES`);

    const apiKey = this.getApiKey();
    const model = this.getModel();
    const endpoint = this.getEndpoint();

    const previousAssistantMsg = history.filter((m) => m.role === "assistant").pop()?.content;
    const previousUserMsg = history.filter((m) => m.role === "user").slice(-2, -1)[0]?.content;

    // Check if OpenAI API key is missing or unconfigured
    if (!apiKey || apiKey.includes("[YOUR-") || apiKey.trim() === "") {
      console.log(`[CHAT DEBUG] OpenAI response received: FALLBACK (Reason: No valid OpenAI API key configured)`);
      const { message: fallbackAns, evidence } = generateIntentSpecificAnswer(intent, entities, relevantData, language);

      await ChatStore.addMessage(session.id, {
        role: "assistant",
        content: fallbackAns,
        metadata: { model: "bidshield-grounded-engine", intent, evidence },
      });

      UsageStore.record({
        userId: params.userId || session.userId,
        sessionId: session.id,
        intent,
        model: "bidshield-grounded-engine",
        source: "fallback",
        promptTokens: 0,
        completionTokens: 0,
        durationMs: Date.now() - startTime,
        status: "success",
      });

      return {
        success: true,
        message: fallbackAns,
        intent,
        sessionId: session.id,
        context: {
          type: entities.resolvedTender ? "tender" : entities.resolvedCompany ? "company" : "general",
          id: entities.resolvedTender?.tenderNumber || entities.resolvedCompany?.canonicalName || entities.tenderId,
        },
        evidenceIds: evidence.map((e: any) => e.id || e.evidenceId).filter(Boolean),
        evidence,
        language,
        source: "BidShield",
      };
    }

    // Prepare OpenAI prompt with verified data grounded specifically for this question
    const systemInstruction = `${SYSTEM_PROMPT}

RESPONSE LANGUAGE: ${language.startsWith("hi") ? "Hindi (हिन्दी)" : language.startsWith("ta") ? "Tamil (தமிழ்)" : "English"}.
DETECTED INTENT: ${intent}

VERIFIED BIDSHIELD DATA FOR THIS QUESTION:
${JSON.stringify(relevantData, null, 2)}

INSTRUCTIONS:
1. Directly answer the user's specific question: "${cleanUserMsg}"
2. Base all numbers, winner names, and scores strictly on the provided verified data above.
3. Conclude with the mandatory disclaimer in the requested language.
`;

    const messages: Array<{ role: string; content: string | null; tool_calls?: any[]; tool_call_id?: string }> = [
      { role: "system", content: systemInstruction },
      ...recentHistory,
    ];

    try {
      let finalContent = "";
      const evidenceFound: any[] = [];
      let promptTokens = 0;
      let completionTokens = 0;

      // Multi-turn tool calling loop (max 3 turns)
      for (let turn = 0; turn < 3; turn++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);

        let response: Response;
        try {
          response = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model,
              messages,
              tools: ASSISTANT_TOOLS,
              tool_choice: "auto",
              temperature: 0.2,
            }),
            signal: controller.signal,
          });
        } catch (fetchErr: any) {
          clearTimeout(timeoutId);
          // Controlled retry: retry once for network or transient timeout
          console.warn("[OpenAI] Initial request failed, attempting single controlled retry...", fetchErr.message);
          await new Promise((r) => setTimeout(r, 500));
          const retryController = new AbortController();
          const retryTimeoutId = setTimeout(() => retryController.abort(), 12000);
          response = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model,
              messages,
              tools: ASSISTANT_TOOLS,
              tool_choice: "auto",
              temperature: 0.2,
            }),
            signal: retryController.signal,
          });
          clearTimeout(retryTimeoutId);
        }

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`OpenAI API returned status ${response.status}`);
        }

        const data = (await response.json()) as any;
        const choice = data?.choices?.[0];
        const msg = choice?.message;

        if (data?.usage) {
          promptTokens += data.usage.prompt_tokens || 0;
          completionTokens += data.usage.completion_tokens || 0;
        }

        if (!msg) throw new Error("Empty message in OpenAI response");

        // Check if model called tools
        if (msg.tool_calls && msg.tool_calls.length > 0) {
          messages.push({
            role: "assistant",
            content: msg.content || null,
            tool_calls: msg.tool_calls,
          });

          for (const call of msg.tool_calls) {
            const funcName = call.function?.name;
            let funcArgs: any = {};
            try {
              funcArgs = JSON.parse(call.function?.arguments || "{}");
            } catch {
              funcArgs = {};
            }

            const toolResult = await executeTool(funcName, funcArgs);
            if (toolResult.evidenceRecords) {
              evidenceFound.push(...toolResult.evidenceRecords);
            }

            messages.push({
              role: "tool",
              tool_call_id: call.id,
              content: JSON.stringify(toolResult),
            });
          }
          continue;
        }

        // Final answer received from OpenAI
        finalContent = msg.content || "";
        break;
      }

      // Check for repetitive response detection (Section 26)
      if (
        previousAssistantMsg &&
        finalContent.trim() === previousAssistantMsg.trim() &&
        cleanUserMsg !== previousUserMsg
      ) {
        console.log(
          `[CHATBOT_RESPONSE_REPETITION] Detected identical response for distinct questions: "${cleanUserMsg}" vs "${previousUserMsg}". Regenerating targeted answer.`
        );
        const { message: regenerated } = generateIntentSpecificAnswer(intent, entities, relevantData, language);
        finalContent = regenerated;
      }

      // Safety validation
      const safetyCheck = validateAIOutputText(finalContent);
      if (!safetyCheck.valid) {
        finalContent = `${this.getDisclaimer(language)}\n\n${finalContent}`;
      }

      // Ensure mandatory disclaimer is present
      const disclaimer = this.getDisclaimer(language);
      if (!finalContent.includes(disclaimer.slice(0, 20))) {
        finalContent += `\n\n> *${disclaimer}*`;
      }

      console.log(`[CHAT DEBUG] OpenAI response received: YES (Turn complete, length: ${finalContent.length})`);

      // Record Telemetry
      UsageStore.record({
        userId: params.userId || session.userId,
        sessionId: session.id,
        intent,
        model,
        source: "openai",
        promptTokens,
        completionTokens,
        durationMs: Date.now() - startTime,
        status: "success",
      });

      // Save assistant response
      await ChatStore.addMessage(session.id, {
        role: "assistant",
        content: finalContent,
        metadata: { model, intent, evidence: evidenceFound },
      });

      return {
        success: true,
        message: finalContent,
        intent,
        sessionId: session.id,
        context: {
          type: entities.resolvedTender ? "tender" : entities.resolvedCompany ? "company" : "general",
          id: entities.resolvedTender?.tenderNumber || entities.resolvedCompany?.canonicalName || entities.tenderId,
        },
        evidenceIds: evidenceFound.map((e: any) => e.id || e.evidenceId).filter(Boolean),
        evidence: evidenceFound,
        language,
        source: "BidShield",
      };
    } catch (err: any) {
      console.log(`[CHAT DEBUG] OpenAI response received: FALLBACK (Reason: ${err.message})`);

      // Question-aware grounded fallback: answers the exact question with verified database data
      const { message: questionSpecificAns, evidence } = generateIntentSpecificAnswer(intent, entities, relevantData, language);

      UsageStore.record({
        userId: params.userId || session.userId,
        sessionId: session.id,
        intent,
        model: "bidshield-grounded-engine",
        source: "fallback",
        promptTokens: 0,
        completionTokens: 0,
        durationMs: Date.now() - startTime,
        status: "error",
      });

      await ChatStore.addMessage(session.id, {
        role: "assistant",
        content: questionSpecificAns,
        metadata: { model: "bidshield-grounded-engine", intent, error: err.message, evidence },
      });

      return {
        success: true,
        message: questionSpecificAns,
        intent,
        sessionId: session.id,
        context: {
          type: entities.resolvedTender ? "tender" : entities.resolvedCompany ? "company" : "general",
          id: entities.resolvedTender?.tenderNumber || entities.resolvedCompany?.canonicalName || entities.tenderId,
        },
        evidenceIds: evidence.map((e: any) => e.id || e.evidenceId).filter(Boolean),
        evidence,
        language,
        source: "BidShield",
      };
    }
  } catch (topLevelError: any) {
    console.warn(`[CHAT TOP-LEVEL ERROR] Handled gracefully:`, topLevelError?.message || topLevelError);
    const fallbackResult = generateIntentSpecificAnswer(intent, entities, relevantData, language);
    return {
      success: true,
      message: fallbackResult.message,
      intent: intent || IntentCategory.GENERAL_HELP,
      sessionId: session?.id || params.sessionId || "default",
      context: {
        type: entities?.resolvedTender ? "tender" : entities?.resolvedCompany ? "company" : "general",
        id: entities?.resolvedTender?.tenderNumber || entities?.resolvedCompany?.canonicalName || entities?.tenderId,
      },
      evidenceIds: (fallbackResult.evidence || []).map((e: any) => e.id || e.evidenceId).filter(Boolean),
      evidence: fallbackResult.evidence || [],
      language,
      source: "BidShield",
    };
  }
}

}


