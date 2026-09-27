import { OpenAIAssistantService } from "../artifacts/api-server/src/ai/openaiAssistantService.js";
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
  console.log("PHASE 15.1 — QUESTION-AWARE CHATBOT VERIFICATION");
  console.log("==================================================\n");

  const sessionId = "test-session-" + Date.now();

  // Test 1: Q1 — Who won this tender?
  console.log("[TEST 1] Q1: Who won this tender?");
  const res1 = await OpenAIAssistantService.chat({
    sessionId,
    message: "Who won this tender?",
    context: { type: "tender", id: "BS-2025-0042" },
    language: "en-IN",
  });
  assert(res1.success, "Chat API succeeded");
  assert(
    res1.message.toLowerCase().includes("won tender") || res1.message.toLowerCase().includes("won"),
    "Directly identifies winning company and tender"
  );
  assert(res1.message.includes("₹"), "Includes formatted Indian Rupee bid amount");
  assert(!res1.message.includes("Overall Screening Score:"), "Does NOT output generic screening summary when asked who won");

  // Test 2: Q2 — Winning bid amount
  console.log("\n[TEST 2] Q2: What was the winning bid amount?");
  const res2 = await OpenAIAssistantService.chat({
    sessionId,
    message: "What was the winning bid amount?",
    context: { type: "tender", id: "BS-2025-0042" },
    language: "en-IN",
  });
  assert(res2.message.includes("₹"), "Directly states the winning bid amount");
  assert(res2.message.toLowerCase().includes("winning bid amount") || res2.message.toLowerCase().includes("contracted value"), "Focuses specifically on winning bid value");
  assert(res1.message !== res2.message, "Response for Q2 is distinctly different from Q1");

  // Test 3: Q3 — How many companies participated?
  console.log("\n[TEST 3] Q3: How many companies participated?");
  const res3 = await OpenAIAssistantService.chat({
    sessionId,
    message: "How many companies participated in this tender?",
    context: { type: "tender", id: "BS-2025-0042" },
    language: "en-IN",
  });
  assert(
    res3.message.toLowerCase().includes("participated") || res3.message.toLowerCase().includes("participating"),
    "Directly answers participant count"
  );
  assert(res3.message !== res1.message && res3.message !== res2.message, "Response for Q3 is unique");

  // Test 4: Q4 — Why was this tender flagged?
  console.log("\n[TEST 4] Q4: Why was this tender flagged?");
  const res4 = await OpenAIAssistantService.chat({
    sessionId,
    message: "Why was this tender flagged?",
    context: { type: "tender", id: "BS-2025-0042" },
    language: "en-IN",
  });
  assert(res4.message.includes("/100"), "Explains numerical screening score out of 100");
  assert(
    res4.message.toLowerCase().includes("winner rotation") || res4.message.toLowerCase().includes("price clustering"),
    "Breaks down contributing screening indicators"
  );
  assert(res4.message !== res1.message, "Response for Q4 is distinctly different from Q1");

  // Test 5: Q5 — Explain the winner rotation
  console.log("\n[TEST 5] Q5: Explain the winner rotation");
  const res5 = await OpenAIAssistantService.chat({
    sessionId,
    message: "Explain the winner rotation pattern for this tender",
    context: { type: "tender", id: "BS-2025-0042" },
    language: "en-IN",
  });
  assert(
    res5.message.toLowerCase().includes("winner rotation") || res5.message.toLowerCase().includes("turn-taking"),
    "Explains turn-taking cyclical sequences"
  );
  assert(res5.message !== res4.message, "Response for Q5 is distinct from general risk");

  // Test 6: Q6 — Explain the price clustering
  console.log("\n[TEST 6] Q6: Explain the price clustering");
  const res6 = await OpenAIAssistantService.chat({
    sessionId,
    message: "Explain the price clustering score",
    context: { type: "tender", id: "BS-2025-0042" },
    language: "en-IN",
  });
  assert(
    res6.message.toLowerCase().includes("price clustering") || res6.message.toLowerCase().includes("coefficient of variation"),
    "Explains price clustering and bid dispersion"
  );
  assert(res6.message !== res5.message, "Response for Q6 is distinct from winner rotation");

  // Test 7: Q7 — What evidence supports the score?
  console.log("\n[TEST 7] Q7: What evidence supports the score?");
  const res7 = await OpenAIAssistantService.chat({
    sessionId,
    message: "What evidence supports this score?",
    context: { type: "tender", id: "BS-2025-0042" },
    language: "en-IN",
  });
  assert(res7.message.includes("E-") || res7.message.toLowerCase().includes("evidence"), "References specific evidence records");

  // Test 8: Q8 — Compare the bids
  console.log("\n[TEST 8] Q8: Compare the bids");
  const res8 = await OpenAIAssistantService.chat({
    sessionId,
    message: "Compare the bids submitted for this tender",
    context: { type: "tender", id: "BS-2025-0042" },
    language: "en-IN",
  });
  assert(res8.message.includes("Rank 1") || res8.message.includes("L1"), "Provides structured comparative ranks for bids");

  // Test 9: Q10 — Recommended review actions
  console.log("\n[TEST 9] Q10: What should an investigator review next?");
  const res9 = await OpenAIAssistantService.chat({
    sessionId,
    message: "What should an investigator review next?",
    context: { type: "tender", id: "BS-2025-0042" },
    language: "en-IN",
  });
  assert(
    res9.message.toLowerCase().includes("audit") || res9.message.toLowerCase().includes("review") || res9.message.toLowerCase().includes("inspect"),
    "Provides actionable investigation review guidance"
  );

  // Test 10: Q11 — Legal Limitations / What does this score NOT mean?
  console.log("\n[TEST 10] Q11: What does this score NOT mean?");
  const res10 = await OpenAIAssistantService.chat({
    sessionId,
    message: "What does this score NOT mean? Does this prove collusion or guilt?",
    context: { type: "tender", id: "BS-2025-0042" },
    language: "en-IN",
  });
  assert(
    res10.message.toLowerCase().includes("not a finding") || res10.message.toLowerCase().includes("does not establish") || res10.message.toLowerCase().includes("not determine"),
    "Explicitly clarifies screening indicators do NOT determine guilt or collusion"
  );

  // Test 11: Multilingual Intent Continuity — Hindi & Tamil
  console.log("\n[TEST 11] Multilingual Specific Answers (Hindi & Tamil)");
  const resHiWinner = await OpenAIAssistantService.chat({
    sessionId,
    message: "इस निविदा को किसने जीता?",
    context: { type: "tender", id: "BS-2025-0042" },
    language: "hi-IN",
  });
  assert(resHiWinner.message.includes("जीत हासिल की") || resHiWinner.message.includes("विजेता बोली"), "Hindi response correctly answers winner inquiry");
  assert(resHiWinner.message.includes("₹"), "Hindi response includes uncorrupted INR amount");

  const resTaWinner = await OpenAIAssistantService.chat({
    sessionId,
    message: "இந்த டெண்டரை வென்ற நிறுவனம் எது?",
    context: { type: "tender", id: "BS-2025-0042" },
    language: "ta-IN",
  });
  assert(resTaWinner.message.includes("வென்றது") || resTaWinner.message.includes("வெற்றிபெற்ற"), "Tamil response correctly answers winner inquiry");
  assert(resTaWinner.message.includes("₹"), "Tamil response includes uncorrupted INR amount");

  // Test 12: Multiple Tenders — Switching between TND-1042 and TND-1057
  console.log("\n[TEST 12] Multiple Tenders: Switching context between TND-1042 and TND-1057");
  const resTender1 = await OpenAIAssistantService.chat({
    sessionId,
    message: "Why was TND-1042 flagged?",
    language: "en-IN",
  });
  const resTender2 = await OpenAIAssistantService.chat({
    sessionId,
    message: "Why was TND-1057 flagged?",
    language: "en-IN",
  });
  assert(resTender1.message.includes("TND-1042") || resTender1.message.includes("BS-2025-0042"), "First tender resolves 1042");
  assert(resTender2.message.includes("TND-1057") || resTender2.message.includes("BS-2025-0057"), "Second tender resolves 1057");
  assert(resTender1.message !== resTender2.message, "TND-1042 and TND-1057 produce distinctly different answers");

  // Test 13: Multiple Companies — Switching between Company A and Company B
  console.log("\n[TEST 13] Multiple Companies: Comparing and switching between contractors");
  const resComp1 = await OpenAIAssistantService.chat({
    sessionId,
    message: "Tell me about Aster Infrastructure",
    language: "en-IN",
  });
  const resComp2 = await OpenAIAssistantService.chat({
    sessionId,
    message: "Tell me about Bharat Technologies",
    language: "en-IN",
  });
  assert(resComp1.message.includes("Aster Infrastructure"), "First query retrieves Aster Infrastructure");
  assert(resComp2.message.includes("Bharat Technologies"), "Second query retrieves Bharat Technologies");
  assert(resComp1.message !== resComp2.message, "Aster and Bharat produce distinctly different company profiles");

  // Test 14: Ambiguous Question Handling
  console.log("\n[TEST 14] Ambiguous Question: 'Tell me about it'");
  const resAmbiguous = await OpenAIAssistantService.chat({
    sessionId,
    message: "Tell me about it",
    context: { type: "tender", id: "BS-2025-0042" },
    language: "en-IN",
  });
  assert(
    resAmbiguous.message.toLowerCase().includes("what would you like to know"),
    "Asks user for clarification with specific choices"
  );

  // Test 15: Greeting Handling
  console.log("\n[TEST 15] Greeting: 'Hello'");
  const resGreeting = await OpenAIAssistantService.chat({
    sessionId,
    message: "Hello",
    language: "en-IN",
  });
  assert(
    resGreeting.message.toLowerCase().includes("hello") || resGreeting.message.toLowerCase().includes("welcome"),
    "Returns polite welcoming greeting instead of generic analytical summary"
  );

  // Cleanup session
  await ChatStore.deleteSession(sessionId);

  console.log("\n==================================================");
  console.log(`PHASE 15.1 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((e) => {
  console.error("Test runner failed:", e);
  process.exit(1);
});
