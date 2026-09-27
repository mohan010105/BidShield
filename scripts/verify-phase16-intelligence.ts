import { OpenAIAssistantService, executeTool } from "../artifacts/api-server/src/ai/openaiAssistantService.js";
import { ChatStore } from "../artifacts/api-server/src/ai/chatStore.js";
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
  console.log("PHASE 16 — BIDSHIELD CHATBOT INTELLIGENCE & ACCURACY");
  console.log("COMPLETE 26-QUESTION TEST MATRIX & REGRESSION SUITE");
  console.log("==================================================\n");

  const sessionId = "phase16-session-" + Date.now();
  const tenderContext = { type: "tender", id: "BS-2025-0042" };

  // --- SECTION A: TENDER INQUIRIES (Questions 1 to 7) ---
  console.log("[CATEGORY 1: TENDER QUESTIONS (Q1-Q7)]");

  // Q1: Who won this tender?
  console.log("\n[Q1] 'Who won this tender?'");
  const q1 = await OpenAIAssistantService.chat({
    sessionId,
    message: "Who won this tender?",
    context: tenderContext,
    language: "en-IN",
  });
  assert(q1.intent === "TENDER_WINNER", `Correct intent detected (got: ${q1.intent})`);
  assert(q1.message.toLowerCase().includes("won tender"), "Answers winner directly first");
  assert(q1.message.includes("₹"), "Includes verified INR bid amount");
  assert(q1.source === "BidShield", "Metadata source is BidShield");

  // Q2: What was the winning bid?
  console.log("\n[Q2] 'What was the winning bid?'");
  const q2 = await OpenAIAssistantService.chat({
    sessionId,
    message: "What was the winning bid?",
    context: tenderContext,
    language: "en-IN",
  });
  assert(q2.intent === "TENDER_BID_AMOUNT", `Correct intent detected (got: ${q2.intent})`);
  assert(q2.message.includes("₹"), "Answers winning bid directly first");
  assert(q2.message !== q1.message, "Q2 response is distinct from Q1");

  // Q3: How many companies participated?
  console.log("\n[Q3] 'How many companies participated?'");
  const q3 = await OpenAIAssistantService.chat({
    sessionId,
    message: "How many companies participated?",
    context: tenderContext,
    language: "en-IN",
  });
  assert(q3.intent === "TENDER_BID_COUNT", `Correct intent detected (got: ${q3.intent})`);
  assert(q3.message.toLowerCase().includes("companies participated"), "States participant count directly first");

  // Q4: What were the submitted bids?
  console.log("\n[Q4] 'What were the submitted bids?'");
  const q4 = await OpenAIAssistantService.chat({
    sessionId,
    message: "What were the submitted bids?",
    context: tenderContext,
    language: "en-IN",
  });
  assert(q4.intent === "TENDER_BID_COMPARISON", `Correct intent detected (got: ${q4.intent})`);
  assert(q4.message.includes("Rank 1") || q4.message.includes("L1"), "Directly itemizes ranks and submitted bids");

  // Q5: Why was this tender flagged?
  console.log("\n[Q5] 'Why was this tender flagged?'");
  const q5 = await OpenAIAssistantService.chat({
    sessionId,
    message: "Why was this tender flagged?",
    context: tenderContext,
    language: "en-IN",
  });
  assert(q5.intent === "RISK_EXPLANATION", `Correct intent detected (got: ${q5.intent})`);
  assert(q5.message.includes("/100"), "Explains score out of 100");
  assert(q5.message.toLowerCase().includes("winner rotation"), "Explains contributing indicators");

  // Q6: What is the risk score?
  console.log("\n[Q6] 'What is the risk score?'");
  const q6 = await OpenAIAssistantService.chat({
    sessionId,
    message: "What is the risk score?",
    context: tenderContext,
    language: "en-IN",
  });
  assert(q6.intent === "RISK_SCORE", `Correct intent detected (got: ${q6.intent})`);
  assert(q6.message.toLowerCase().includes("overall risk score for tender"), "States overall score directly first");

  // Q7: What evidence supports the score?
  console.log("\n[Q7] 'What evidence supports the score?'");
  const q7 = await OpenAIAssistantService.chat({
    sessionId,
    message: "What evidence supports the score?",
    context: tenderContext,
    language: "en-IN",
  });
  assert(q7.intent === "EVIDENCE_EXPLANATION", `Correct intent detected (got: ${q7.intent})`);
  assert(q7.message.includes("E-") || q7.message.toLowerCase().includes("evidence"), "References evidence records");

  // --- SECTION B: ANALYTICS DETECTORS (Questions 8 to 12) ---
  console.log("\n[CATEGORY 2: ANALYTICS DETECTORS (Q8-Q12)]");

  // Q8: Explain winner rotation
  console.log("\n[Q8] 'Explain winner rotation.'");
  const q8 = await OpenAIAssistantService.chat({
    sessionId,
    message: "Explain winner rotation.",
    context: tenderContext,
    language: "en-IN",
  });
  assert(q8.intent === "WINNER_ROTATION", `Correct intent detected (got: ${q8.intent})`);
  assert(q8.message.toLowerCase().includes("winner rotation"), "Explains winner rotation indicator");

  // Q9: Explain cover-bid screening
  console.log("\n[Q9] 'Explain cover-bid screening.'");
  const q9 = await OpenAIAssistantService.chat({
    sessionId,
    message: "Explain cover-bid screening.",
    context: tenderContext,
    language: "en-IN",
  });
  assert(q9.intent === "COVER_BID", `Correct intent detected (got: ${q9.intent})`);
  assert(q9.message.toLowerCase().includes("cover-bid"), "Explains cover-bid indicator");

  // Q10: Explain price clustering
  console.log("\n[Q10] 'Explain price clustering.'");
  const q10 = await OpenAIAssistantService.chat({
    sessionId,
    message: "Explain price clustering.",
    context: tenderContext,
    language: "en-IN",
  });
  assert(q10.intent === "PRICE_CLUSTERING", `Correct intent detected (got: ${q10.intent})`);
  assert(q10.message.toLowerCase().includes("price clustering"), "Explains price clustering indicator");

  // Q11: Explain participation network
  console.log("\n[Q11] 'Explain participation network.'");
  const q11 = await OpenAIAssistantService.chat({
    sessionId,
    message: "Explain participation network.",
    context: tenderContext,
    language: "en-IN",
  });
  assert(q11.intent === "PARTICIPATION_NETWORK", `Correct intent detected (got: ${q11.intent})`);
  assert(q11.message.toLowerCase().includes("network"), "Explains participation network indicator");

  // Q12: Explain the neat-loss indicator
  console.log("\n[Q12] 'Explain the neat-loss indicator.'");
  const q12 = await OpenAIAssistantService.chat({
    sessionId,
    message: "Explain the neat-loss indicator.",
    context: tenderContext,
    language: "en-IN",
  });
  assert(q12.intent === "NEAT_LOSS", `Correct intent detected (got: ${q12.intent})`);
  assert(q12.message.toLowerCase().includes("neat"), "Explains too-neat loss indicator");

  // --- SECTION C: COMPANY INQUIRIES (Questions 13 to 16) ---
  console.log("\n[CATEGORY 3: COMPANY INQUIRIES (Q13-Q16)]");

  // Q13: Tell me about this company
  console.log("\n[Q13] 'Tell me about this company.'");
  const q13 = await OpenAIAssistantService.chat({
    sessionId,
    message: "Tell me about this company.",
    context: { type: "company", id: 1 },
    language: "en-IN",
  });
  assert(q13.intent === "COMPANY_OVERVIEW", `Correct intent detected (got: ${q13.intent})`);
  assert(q13.message.includes("Company Profile for"), "Provides company profile");

  // Q14: How many tenders did it participate in?
  console.log("\n[Q14] 'How many tenders did it participate in?'");
  const q14 = await OpenAIAssistantService.chat({
    sessionId,
    message: "How many tenders did it participate in?",
    language: "en-IN",
  });
  assert(q14.intent === "COMPANY_HISTORY", `Correct intent detected (got: ${q14.intent})`);
  assert(q14.message.includes("Tenders Participated:"), "Resolves pronoun 'it' to company and states count");

  // Q15: How many did it win?
  console.log("\n[Q15] 'How many did it win?'");
  const q15 = await OpenAIAssistantService.chat({
    sessionId,
    message: "How many did it win?",
    language: "en-IN",
  });
  assert(q15.intent === "COMPANY_HISTORY", `Correct intent detected (got: ${q15.intent})`);
  assert(q15.message.includes("Contracts Won:"), "Resolves pronoun 'it' and states wins directly");

  // Q16: Compare these two companies
  console.log("\n[Q16] 'Compare these two companies.'");
  const q16 = await OpenAIAssistantService.chat({
    sessionId,
    message: "Compare Aster Infrastructure and Bharat Technologies",
    language: "en-IN",
  });
  assert(q16.intent === "COMPANY_COMPARISON", `Correct intent detected (got: ${q16.intent})`);
  assert(q16.message.includes("Aster Infrastructure") && q16.message.includes("Bharat Technologies"), "Contrasts both named entities");

  // --- SECTION D: INVESTIGATION INQUIRIES (Questions 17 to 19) ---
  console.log("\n[CATEGORY 4: INVESTIGATION INQUIRIES (Q17-Q19)]");

  // Q17: Summarize this investigation
  console.log("\n[Q17] 'Summarize this investigation.'");
  const q17 = await OpenAIAssistantService.chat({
    sessionId,
    message: "Summarize this investigation.",
    context: { type: "investigation", id: 1 },
    language: "en-IN",
  });
  assert(q17.intent === "INVESTIGATION_SUMMARY", `Correct intent detected (got: ${q17.intent})`);
  assert(q17.message.includes("Investigation Summary"), "Outputs formal case summary");

  // Q18: What are the key observations?
  console.log("\n[Q18] 'What are the key observations?'");
  const q18 = await OpenAIAssistantService.chat({
    sessionId,
    message: "What are the key observations?",
    context: { type: "investigation", id: 1 },
    language: "en-IN",
  });
  assert(q18.intent === "INVESTIGATION_SUMMARY", `Correct intent detected (got: ${q18.intent})`);
  assert(q18.message.includes("Key Observations:"), "Highlights primary investigative findings");

  // Q19: What evidence should I review?
  console.log("\n[Q19] 'What evidence should I review?'");
  const q19 = await OpenAIAssistantService.chat({
    sessionId,
    message: "What evidence should I review next?",
    context: tenderContext,
    language: "en-IN",
  });
  assert(q19.intent === "INVESTIGATION_EVIDENCE", `Correct intent detected (got: ${q19.intent})`);
  assert(q19.message.toLowerCase().includes("review") || q19.message.toLowerCase().includes("audit"), "Provides actionable guidance");

  // --- SECTION E: METHODOLOGY & GENERAL (Questions 20 to 23) ---
  console.log("\n[CATEGORY 5: METHODOLOGY & GENERAL (Q20-Q23)]");

  // Q20: How does BidShield calculate the overall score?
  console.log("\n[Q20] 'How does BidShield calculate the overall score?'");
  const q20 = await OpenAIAssistantService.chat({
    sessionId,
    message: "How does BidShield calculate the overall score?",
    language: "en-IN",
  });
  assert(q20.intent === "METHODOLOGY", `Correct intent detected (got: ${q20.intent})`);
  assert(q20.message.includes("Calculation Methodology") || q20.message.includes("Score"), "Explains 5-screener aggregation");

  // Q21: What is BidShield?
  console.log("\n[Q21] 'What is BidShield?'");
  const q21 = await OpenAIAssistantService.chat({
    sessionId,
    message: "What is BidShield?",
    language: "en-IN",
  });
  assert(q21.intent === "GENERAL_BIDSHIELD", `Correct intent detected (got: ${q21.intent})`);
  assert(q21.message.includes("procurement analytics"), "Explains BidShield platform purpose");

  // Q22: What does statistical screening mean?
  console.log("\n[Q22] 'What does statistical screening mean?'");
  const q22 = await OpenAIAssistantService.chat({
    sessionId,
    message: "What does statistical screening mean?",
    language: "en-IN",
  });
  assert(q22.intent === "DATA_QUALITY", `Correct intent detected (got: ${q22.intent})`);
  assert(q22.message.includes("Statistical Screening"), "Explains screening methodology and boundaries");

  // Q23: Tell me about it (ambiguous)
  console.log("\n[Q23] 'Tell me about it' (Ambiguous prompt)");
  const q23 = await OpenAIAssistantService.chat({
    sessionId,
    message: "Tell me about it.",
    context: tenderContext,
    language: "en-IN",
  });
  assert(q23.intent === "CLARIFICATION_REQUIRED", `Correct intent detected (got: ${q23.intent})`);
  assert(q23.message.includes("What would you like to know"), "Asks user for clarification with specific options");

  // --- SECTION F: MULTILINGUAL IN-STREAM SWITCHING (Questions 24 to 26) ---
  console.log("\n[CATEGORY 6: MULTILINGUAL IN-STREAM SWITCHING (Q24-Q26)]");

  // Q24: Explain this in Hindi
  console.log("\n[Q24] 'Explain this in Hindi.'");
  const q24 = await OpenAIAssistantService.chat({
    sessionId,
    message: "Explain this in Hindi.",
    language: "en-IN", // Frontend had en-IN, message specifies Hindi
  });
  assert(q24.language === "hi-IN", `In-message switch recognized language as hi-IN (got: ${q24.language})`);
  assert(q24.message.includes("निविदा"), "Hindi explanation generated preserving active context");
  assert(q24.message.includes("सांख्यिकीय स्क्रीनिंग उन पैटर्न की पहचान करती है"), "Hindi statutory disclaimer included");

  // Q25: இதை தமிழில் விளக்கவும்.
  console.log("\n[Q25] 'இதை தமிழில் விளக்கவும்.'");
  const q25 = await OpenAIAssistantService.chat({
    sessionId,
    message: "இதை தமிழில் விளக்கவும்.",
    language: "en-IN",
  });
  assert(q25.language === "ta-IN", `In-message switch recognized language as ta-IN (got: ${q25.language})`);
  assert(q25.message.includes("டெண்டர்"), "Tamil explanation generated preserving active context");
  assert(q25.message.includes("புள்ளிவிவரத் திரையிடல் மேலும் மறுபரிசீலனைக்கு"), "Tamil statutory disclaimer included");

  // Q26: इसे हिंदी में समझाइए।
  console.log("\n[Q26] 'इसे हिंदी में समझाइए।'");
  const q26 = await OpenAIAssistantService.chat({
    sessionId,
    message: "इसे हिंदी में समझाइए।",
    language: "en-IN",
  });
  assert(q26.language === "hi-IN", `In-message switch recognized language as hi-IN (got: ${q26.language})`);
  assert(q26.message.includes("निविदा"), "Hindi explanation re-synthesized accurately");

  // --- SECTION G: FUNCTION / TOOL CALLING DISPATCH ---
  console.log("\n[CATEGORY 7: OPENAI FUNCTION DISPATCH TEST]");
  const toolWinner = await executeTool("getTenderWinner", { tenderId: "BS-2025-0042" });
  assert(Boolean(toolWinner.winnerName), `getTenderWinner returned winner: ${toolWinner.winnerName}`);

  const toolBids = await executeTool("getTenderBids", { tenderId: "BS-2025-0042" });
  assert(Array.isArray(toolBids.bids) && toolBids.bids.length > 0, `getTenderBids returned ${toolBids.bids.length} bids`);

  const toolRisk = await executeTool("getTenderRisk", { tenderId: "BS-2025-0042" });
  assert(typeof toolRisk.overallScore === "number", `getTenderRisk returned overallScore: ${toolRisk.overallScore}`);

  const toolCompanyHistory = await executeTool("getCompanyHistory", { companyId: 1 });
  assert(typeof toolCompanyHistory.wins === "number", `getCompanyHistory returned wins: ${toolCompanyHistory.wins}`);

  // Cleanup session
  await ChatStore.deleteSession(sessionId);

  console.log("\n==================================================");
  console.log(`PHASE 16 TEST MATRIX RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((e) => {
  console.error("Test runner failed:", e);
  process.exit(1);
});
