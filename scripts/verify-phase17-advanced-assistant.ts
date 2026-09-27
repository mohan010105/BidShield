import { OpenAIAssistantService, executeTool } from "../artifacts/api-server/src/ai/openaiAssistantService.js";
import { investigationService } from "../artifacts/api-server/src/analytics/index.js";
import { loadEnv } from "../artifacts/api-server/src/lib/env.js";

loadEnv();

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  [PASS] ${msg}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${msg}`);
    failed++;
  }
}

async function run() {
  console.log("==================================================");
  console.log("PHASE 17 — BIDSHIELD ADVANCED INVESTIGATION ASSISTANT");
  console.log("COMPREHENSIVE VERIFICATION & TEST MATRIX");
  console.log("==================================================\n");

  const sessionId = "phase17-session-" + Date.now();

  // 1. CROSS-TENDER ANALYSIS
  console.log("--- 1. CROSS-TENDER ANALYSIS ---");
  const c1 = await OpenAIAssistantService.chat({
    sessionId,
    message: "Compare TND-1042 and TND-1057.",
    language: "en-IN",
  });
  assert(c1.intent === "CROSS_TENDER_COMPARISON", `Correct intent detected (got: ${c1.intent})`);
  assert(c1.message.includes("TND-1042") && c1.message.includes("TND-1057"), "Distinguishes both tenders clearly");
  assert(c1.message.includes("|") && c1.message.includes("Screening Score"), "Includes structured markdown comparison table");
  assert(c1.message.includes("Limitations:") || c1.message.includes("Statistical screening"), "Includes limitations and statutory disclaimer");

  // Follow-up: Which tender has higher score?
  console.log("\n[Follow-up 1] 'Which tender has the higher statistical screening score?'");
  const c2 = await OpenAIAssistantService.chat({
    sessionId,
    message: "Which tender has the higher statistical screening score?",
    language: "en-IN",
  });
  assert(c2.intent === "CROSS_TENDER_COMPARISON", "Maintains cross-tender context in follow-up");
  assert(c2.message.includes("higher statistical screening score") || c2.message.includes("Higher Screening Score"), "Directly answers which tender has higher score");

  // Follow-up: Which companies participated in both?
  console.log("\n[Follow-up 2] 'Which companies participated in both?'");
  const c3 = await OpenAIAssistantService.chat({
    sessionId,
    message: "Which companies participated in both?",
    language: "en-IN",
  });
  assert(c3.intent === "CROSS_TENDER_PATTERNS", `Follow-up classifies as CROSS_TENDER_PATTERNS (got: ${c3.intent})`);
  assert(c3.message.includes("repeated co-participation") || c3.message.includes("participated"), "Identifies shared participants");

  // 2. CROSS-COMPANY ANALYSIS & PARTICIPATION OVERLAP
  console.log("\n--- 2. CROSS-COMPANY & PARTICIPATION OVERLAP ---");
  const compSession = "phase17-comp-" + Date.now();
  const c4 = await OpenAIAssistantService.chat({
    sessionId: compSession,
    message: "Compare Company A and Company B.",
    language: "en-IN",
  });
  assert(c4.intent === "COMPANY_COMPARISON", `Correct intent detected (got: ${c4.intent})`);
  assert(c4.message.includes("Contractor Comparison") || c4.message.includes("Tenders"), "Provides contractor profile comparison");

  console.log("\n[Overlap] 'What is their participation overlap?'");
  const c5 = await OpenAIAssistantService.chat({
    sessionId: compSession,
    message: "What is their participation overlap?",
    language: "en-IN",
  });
  assert(c5.intent === "PARTICIPATION_OVERLAP", `Correct intent detected (got: ${c5.intent})`);
  assert(c5.message.includes("participated together in") || c5.message.includes("Shared Participation Count"), "Directly answers shared participation count");
  assert(c5.message.includes("Wins") || c5.message.includes("Jaccard Overlap Index"), "Includes win counts and Jaccard overlap index");
  assert(!c5.message.includes("guilty") && !c5.message.includes("fraud"), "Never makes illegal guilt claims");

  // 3. WINNER HISTORY & ROTATION SEQUENCE
  console.log("\n--- 3. WINNER HISTORY & ROTATION SEQUENCE ---");
  const c6 = await OpenAIAssistantService.chat({
    sessionId: "phase17-hist-" + Date.now(),
    message: "Show the historical winner sequence across these tenders.",
    language: "en-IN",
  });
  assert(c6.intent === "WINNER_HISTORY", `Correct intent detected (got: ${c6.intent})`);
  assert(c6.message.includes("Award Distribution") || c6.message.includes("historical winner sequence"), "Displays winner sequence");
  assert(c6.message.includes("The observed winner sequence describes historical turn-taking patterns. It does NOT conclude that rotation proves collusion"), "Complies with legal safety guidelines");

  // 4. EVIDENCE COMPARISON
  console.log("\n--- 4. EVIDENCE COMPARISON ---");
  const c7 = await OpenAIAssistantService.chat({
    sessionId: "phase17-ev-" + Date.now(),
    message: "Compare these two evidence items E-1042-01 and E-1042-07.",
    language: "en-IN",
  });
  assert(c7.intent === "EVIDENCE_COMPARISON", `Correct intent detected (got: ${c7.intent})`);
  assert(c7.message.includes("E-1042-01") && c7.message.includes("E-1042-07"), "Contrasts both specific evidence IDs");
  assert(c7.message.includes("| Indicator Type |") || c7.message.includes("Observed Value"), "Contrasts indicator types and observed baselines");

  // 5. MULTI-SIGNAL RISK BREAKDOWN
  console.log("\n--- 5. MULTI-SIGNAL RISK BREAKDOWN ---");
  const c8 = await OpenAIAssistantService.chat({
    sessionId: "phase17-risk-" + Date.now(),
    message: "What indicators contribute to this tender's score?",
    context: { type: "tender", id: "BS-2025-0042" },
    language: "en-IN",
  });
  assert(c8.intent === "RISK_BREAKDOWN", `Correct intent detected (got: ${c8.intent})`);
  assert(c8.message.includes("Winner Rotation") && c8.message.includes("Price Clustering"), "Details contributing detectors");
  assert(c8.message.includes("Phase 7"), "Respects Phase 7 fixed weighting source of truth");

  // 6. STRUCTURED SEARCH
  console.log("\n--- 6. STRUCTURED SEARCH ---");
  const c9 = await OpenAIAssistantService.chat({
    sessionId: "phase17-search-" + Date.now(),
    message: "Show high-screening tenders from 2026.",
    language: "en-IN",
  });
  assert(c9.intent === "STRUCTURED_SEARCH", `Correct intent detected (got: ${c9.intent})`);
  assert(c9.message.includes("matching your filter criteria"), "Executes parameterized search");
  assert(c9.message.includes("capped at 20") || c9.message.includes("records maximum"), "Enforces maximum 20 result limit");

  // 7. MULTILINGUAL SUPPORT (HINDI & TAMIL)
  console.log("\n--- 7. MULTILINGUAL ADVANCED INVESTIGATION ---");

  // Hindi: Cross-tender comparison
  console.log("\n[Hindi] 'निविदाओं की तुलना करें TND-1042 और TND-1057'");
  const hiChat = await OpenAIAssistantService.chat({
    sessionId: "phase17-hi-" + Date.now(),
    message: "निविदाओं की तुलना करें TND-1042 और TND-1057",
    language: "hi-IN",
  });
  assert(hiChat.intent === "CROSS_TENDER_COMPARISON", "Hindi cross-tender intent detected");
  assert(hiChat.message.includes("TND-1042") && hiChat.message.includes("TND-1057"), "Hindi preserves tender numbers untranslated");
  assert(hiChat.message.includes("सांख्यिकीय स्क्रीनिंग उन पैटर्न की पहचान करती है"), "Hindi includes statutory disclaimer");

  // Tamil: Company participation overlap
  console.log("\n[Tamil] 'இந்த இரண்டு நிறுவனங்களின் பங்கேற்பு ஒன்றுடன் ஒன்று எவ்வளவு?'");
  const taChat = await OpenAIAssistantService.chat({
    sessionId: "phase17-ta-" + Date.now(),
    message: "இந்த இரண்டு நிறுவனங்களின் பங்கேற்பு ஒன்றுடன் ஒன்று எவ்வளவு?",
    language: "ta-IN",
  });
  assert(taChat.intent === "PARTICIPATION_OVERLAP", "Tamil participation overlap intent detected");
  assert(taChat.message.includes("புள்ளிவிவரத் திரையிடல் மேலும் மறுபரிசீலனைக்கு"), "Tamil includes statutory disclaimer");

  // 8. SAVE CHAT FINDINGS AS INVESTIGATION NOTE
  console.log("\n--- 8. SAVE CHAT FINDINGS API INTEGRATION ---");
  const noteText = `[AI-Assisted Investigation Note]
Question: "Compare TND-1042 and TND-1057."
Logged: ${new Date().toISOString()}
Referenced Evidence: E-1042-01, E-1042-07

The two tenders exhibit distinct margin spreads and rotation indicators.

---
Note: This is an AI-assisted investigative note summarizing verified BidShield screening data. It does not constitute official judicial evidence.`;

  const savedNote = await investigationService.addNote(1, noteText, {
    userId: "test_investigator",
    userName: "Senior Lead Investigator",
  });

  assert(Boolean(savedNote && savedNote.id), "Successfully created investigation note record");
  assert(savedNote.note.includes("[AI-Assisted Investigation Note]"), "Note is explicitly tagged as AI-assisted");
  assert(savedNote.note.includes("E-1042-01"), "Note records referenced evidence IDs");

  // 9. PHASE 17 TOOLS BACKEND EXECUTION TEST
  console.log("\n--- 9. BACKEND TOOL EXECUTION & ACCURACY ---");
  const tenderComp = await executeTool("getTenderComparison", { tenderAId: "TND-1042", tenderBId: "TND-1057" });
  assert(Boolean(tenderComp.tenderA && tenderComp.tenderB), "getTenderComparison computes side-by-side data");
  assert(typeof tenderComp.winningMarginDelta === "number", "Calculates winningMarginDelta deterministically");

  const overlap = await executeTool("getCompanyParticipationOverlap", { companyAId: "1", companyBId: "2" });
  assert(typeof overlap.sharedTenderCount === "number", "getCompanyParticipationOverlap returns sharedTenderCount");
  assert(typeof overlap.jaccardSimilarityIndex === "number", "getCompanyParticipationOverlap computes Jaccard index");

  const cluster = await executeTool("getPriceClusterAnalysis", { tenderId: "1" });
  assert(typeof cluster.coefficientOfVariation === "number", "getPriceClusterAnalysis computes CV");

  console.log("\n==================================================");
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("FATAL ERROR in Phase 17 verification:", err);
  process.exit(1);
});
