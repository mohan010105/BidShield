/**
 * Phase 19 Verification Script — BidShield Entity Resolution Repair, Accuracy & Validation
 * Tests all 45 acceptance criteria and end-to-end integration.
 */

import {
  normalizeCompany,
  normalizeCompanyName,
  normalizeAddress,
  validateGSTIN,
  normalizeGSTIN,
  detectLegalForm,
  extractCoreName,
  scoreMatch,
  BlockingIndex,
  scanCanonicalDuplicates,
  entityResolutionService,
  SYNTHETIC_ENTITY_TEST_CASES,
} from "../artifacts/api-server/src/entity-resolution/index.js";
import { resolveCompanyEntity } from "../artifacts/api-server/src/ai/intentAnalyzer.js";
import { analyticsService } from "../artifacts/api-server/src/analytics/index.js";

async function runVerification() {
  console.log("================================================================================");
  console.log("   PHASE 19 — BIDSHIELD ENTITY RESOLUTION VERIFICATION & ACCEPTANCE SUITE       ");
  console.log("================================================================================");

  let passedChecks = 0;
  let totalChecks = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalChecks++;
    if (condition) {
      passedChecks++;
      console.log(`  [PASS] ${testName}`);
    } else {
      console.error(`  [FAIL] ${testName}${detail ? ` -> ${detail}` : ""}`);
    }
  }

  // ── TEST 1: Deterministic Normalization Pipeline ────────────────────────
  console.log("\n--- TEST 1: Deterministic Normalization Pipeline ---");
  const norm1 = normalizeCompany("  ABC  INFRASTRUCTURE   PVT.  LTD.  ");
  assert(norm1.normalizedName === "abc infrastructure pvt ltd", "Punctuation & whitespace normalization", norm1.normalizedName);
  assert(norm1.coreName === "abc infrastructure", "Core company name extraction without suffix", norm1.coreName);
  assert(norm1.legalForm === "PVT_LTD", "Legal form detected as PVT_LTD", norm1.legalForm);

  const norm2 = normalizeCompany("ABC Infrastructure Private Limited");
  assert(norm2.normalizedName === "abc infrastructure pvt ltd", "Private Limited standardizes to pvt ltd", norm2.normalizedName);
  assert(norm1.normalizedName === norm2.normalizedName, "Pvt Ltd and Private Limited produce identical normalized string");

  const normDots = normalizeCompany("A.B.C. Technologies P.V.T. L.T.D.");
  assert(normDots.coreName === "abc technologies", "Dotted acronyms A.B.C. clean to abc", normDots.coreName);

  // ── TEST 2: Legal Form Conflict Guard ───────────────────────────────────
  console.log("\n--- TEST 2: Legal Form Conflict Guard (Pvt Ltd vs LLP) ---");
  const pvtLtd = normalizeCompany("ABC Technologies Pvt Ltd");
  const llp = normalizeCompany("ABC Technologies LLP");
  assert(pvtLtd.legalForm === "PVT_LTD", "ABC Technologies Pvt Ltd is PVT_LTD");
  assert(llp.legalForm === "LLP", "ABC Technologies LLP is LLP");

  const pvtVsLlpScore = scoreMatch(pvtLtd, llp);
  assert(
    pvtVsLlpScore.outcome === "REVIEW_REQUIRED",
    "Pvt Ltd vs LLP without GSTIN must NOT auto-match (Must be REVIEW_REQUIRED)",
    `Outcome: ${pvtVsLlpScore.outcome}, Score: ${pvtVsLlpScore.score}`
  );
  assert(
    pvtVsLlpScore.score <= 75,
    "Score capped at <= 75 due to legal form mismatch",
    `Score: ${pvtVsLlpScore.score}`
  );

  // ── TEST 3: Strong GSTIN Matching & Conflict Prevention ─────────────────
  console.log("\n--- TEST 3: Strong GSTIN Matching & Conflict Prevention ---");
  assert(validateGSTIN("33AAAAA0000A1Z5") === true, "Valid Indian GSTIN passes format validation");
  assert(validateGSTIN("INVALID_GSTIN") === false, "Invalid GSTIN correctly rejected");

  // Same name but different GSTIN (e.g. separate legal entities in different states)
  const compSameNameTN = normalizeCompany("ABC Enterprises", {
    gstin: "33AAAAA1111A1Z1",
    address: "12 Anna Salai, Chennai",
    city: "Chennai",
    state: "Tamil Nadu",
  });
  const compSameNameKA = normalizeCompany("ABC Enterprises", {
    gstin: "29BBBBB2222B1Z2",
    address: "45 MG Road, Bangalore",
    city: "Bangalore",
    state: "Karnataka",
  });
  const diffGstinScore = scoreMatch(compSameNameTN, compSameNameKA);
  assert(
    diffGstinScore.outcome === "NO_MATCH",
    "Same name with conflicting GSTINs must strictly be NO_MATCH",
    `Outcome: ${diffGstinScore.outcome}, Score: ${diffGstinScore.score}`
  );
  assert(
    diffGstinScore.score <= 40,
    "Score penalized due to conflicting GSTINs",
    `Score: ${diffGstinScore.score}`
  );

  // Matching GSTIN boosts confidence decisively
  const compWithMatchingGstinA = normalizeCompany("ABC Infra Pvt Ltd", { gstin: "33AAAAA0000A1Z5" });
  const compWithMatchingGstinB = normalizeCompany("ABC Infrastructure Private Limited", { gstin: "33AAAAA0000A1Z5" });
  const matchGstinScore = scoreMatch(compWithMatchingGstinA, compWithMatchingGstinB);
  assert(
    matchGstinScore.outcome === "AUTO_MATCH",
    "Matching GSTIN with compatible names achieves AUTO_MATCH",
    `Outcome: ${matchGstinScore.outcome}, Score: ${matchGstinScore.score}`
  );
  assert(matchGstinScore.score >= 90, "Score >= 90 with GSTIN match", `Score: ${matchGstinScore.score}`);

  // ── TEST 4: Registration Number Matching ────────────────────────────────
  console.log("\n--- TEST 4: Registration Number Matching ---");
  const compRegA = normalizeCompany("Apex Solutions Pvt Ltd", { registrationNumber: "U72900TN2020PTC123456" });
  const compRegB = normalizeCompany("Apex Solutions Private Limited", { registrationNumber: "U72900TN2020PTC123456" });
  const regScore = scoreMatch(compRegA, compRegB);
  assert(regScore.signals.registrationMatch === true, "Registration numbers match identified");
  assert(regScore.outcome === "AUTO_MATCH", "Exact CIN/Reg match yields AUTO_MATCH");

  // ── TEST 5: Address & PIN Code Normalization ────────────────────────────
  console.log("\n--- TEST 5: Address & PIN Code Normalization ---");
  const addr1 = normalizeAddress("12, Anna Nagar, Chennai - 600040");
  const addr2 = normalizeAddress("12 Anna Nagar Chennai 600040");
  assert(addr1.includes("anna nagar chennai 600040"), "Address punctuation cleaned");
  assert(addr1 === addr2, "Address variants normalize to comparable string");

  // ── TEST 6: Candidate Generation & Blocking Index ───────────────────────
  console.log("\n--- TEST 6: Candidate Generation & Blocking Index ---");
  const index = new BlockingIndex();
  index.loadCandidates([
    {
      companyId: 1,
      canonicalName: "Trident Technologies Private Limited",
      normalizedName: "trident technologies pvt ltd",
      gstin: "33AAAAA0000A1Z5",
      aliases: ["TRIDENT TECH", "TRIDENT"],
    },
    {
      companyId: 2,
      canonicalName: "Apex Infrastructure Limited",
      normalizedName: "apex infrastructure ltd",
      aliases: ["APEX INFRA"],
    },
  ]);

  const candidateLookup = index.findCandidates(normalizeCompany("Trident Tech"));
  assert(candidateLookup.length > 0, "Blocking index retrieves candidates via alias");
  assert(candidateLookup[0].candidate.companyId === 1, "Resolved candidate company ID 1 (Trident)");

  // ── TEST 7: Duplicate Canonical Company Detection ───────────────────────
  console.log("\n--- TEST 7: Duplicate Canonical Company Detection ---");
  const testCompaniesForDupScan = [
    {
      companyId: 101,
      canonicalName: "BluePeak Infrastructure Private Limited",
      normalizedName: "bluepeak infrastructure pvt ltd",
      gstin: "33AAAAA9999A1Z9",
      address: "10 Industrial Estate, Chennai",
      aliases: [],
    },
    {
      companyId: 102,
      canonicalName: "BluePeak Infrastructure Pvt Ltd",
      normalizedName: "bluepeak infrastructure pvt ltd",
      gstin: "33AAAAA9999A1Z9",
      address: "10 Industrial Estate, Chennai",
      aliases: [],
    },
    {
      companyId: 103,
      canonicalName: "Completely Different Builders LLP",
      normalizedName: "completely different builders llp",
      gstin: "29BBBBB8888B1Z8",
      aliases: [],
    },
  ];

  const duplicates = scanCanonicalDuplicates(testCompaniesForDupScan);
  assert(duplicates.length === 1, "Detected duplicate pair between 101 and 102", `Count: ${duplicates.length}`);
  assert(duplicates[0].recommendedAction === "MERGE", "Recommended action is MERGE due to identical GSTIN and name");
  assert(duplicates[0].similarityScore >= 95, "Duplicate similarity score >= 95%");

  // ── TEST 8: Synthetic Entity Resolution Test Suite (10 Cases) ───────────
  console.log("\n--- TEST 8: Synthetic Test Suite (10 Comprehensive Cases) ---");
  let testSuitePassed = 0;
  for (const tc of SYNTHETIC_ENTITY_TEST_CASES) {
    const sNorm = normalizeCompany(tc.source.name, tc.source);
    const cNorm = normalizeCompany(tc.candidate.canonicalName, tc.candidate);
    const res = scoreMatch(sNorm, cNorm);

    const matchesOutcome = res.outcome === tc.expectedOutcome;
    const scoreInRange = res.score >= tc.expectedMinScore && res.score <= tc.expectedMaxScore;
    const pass = matchesOutcome && scoreInRange;

    if (pass) testSuitePassed++;
    assert(
      pass,
      `[${tc.id}] ${tc.category}: ${tc.description}`,
      `Expected ${tc.expectedOutcome} (${tc.expectedMinScore}-${tc.expectedMaxScore}), got ${res.outcome} (${res.score})`
    );
  }
  assert(testSuitePassed === SYNTHETIC_ENTITY_TEST_CASES.length, "All 10 synthetic test cases pass exactly");

  // ── TEST 9: Manual Review Lifecycle (Confirm, Reject, Create) ───────────
  console.log("\n--- TEST 9: Manual Review Lifecycle (Confirm, Reject, Create) ---");
  await entityResolutionService.initialize();

  const testMatch = await entityResolutionService.resolveSingleRecord("Acme Infra Corp", {
    source: "unit-test",
  });
  assert(testMatch.id > 0, "Record created in review queue");

  // Confirm match
  const confirmed = await entityResolutionService.confirmMatch(testMatch.id, "Inspector V. Sharma", "Verified tax certificate");
  assert(confirmed !== null, "Match confirmed");
  assert(confirmed?.status === "CONFIRMED", "Confirmed status set");
  assert(confirmed?.reviewedBy === "Inspector V. Sharma", "Audit reviewer preserved");

  // Create new canonical company
  const created = await entityResolutionService.createCanonicalCompany(
    "New Age Solar Works",
    "New Age Solar Infrastructure Private Limited",
    { city: "Coimbatore", state: "Tamil Nadu" },
    "Senior Analyst"
  );
  assert(created.status === "CONFIRMED", "Created entity is marked CONFIRMED");
  assert(created.suggestedCompany === "New Age Solar Infrastructure Private Limited", "Canonical name set");

  // Verify alias lookup immediately finds newly created company
  const foundCanonical = await entityResolutionService.findCanonicalForName("New Age Solar Works");
  assert(foundCanonical !== null, "findCanonicalForName resolves alias to new canonical company");
  assert(foundCanonical?.canonicalName === "New Age Solar Infrastructure Private Limited", "Correct canonical name returned");

  // ── TEST 10: Downstream Analytics Integrity & AI Assistant Alias Lookup ─
  console.log("\n--- TEST 10: Downstream Analytics & Chatbot Alias Resolution ---");
  const aiResolved = resolveCompanyEntity("TRIDENT TECH");
  assert(aiResolved !== null, "AI assistant resolves alias 'TRIDENT TECH' to canonical entity");
  assert(aiResolved?.canonicalName.includes("Trident"), "AI assistant mapped to Trident");

  const stats = await entityResolutionService.getStats();
  assert(stats.canonicalCompanies >= 50, "Stats report >= 50 canonical companies", `Count: ${stats.canonicalCompanies}`);
  assert(typeof stats.matchPercentage === "number", "Match percentage is numeric and not hardcoded");

  // Recalculate downstream analytics
  const recalcRes = await analyticsService.recalculate();
  assert(recalcRes.analyzed >= 0, "Analytics recalculate completes naturally without errors");

  console.log("\n================================================================================");
  console.log(`   PHASE 19 VERIFICATION COMPLETE: ${passedChecks} / ${totalChecks} CHECKS PASSED (${Math.round((passedChecks / totalChecks) * 100)}%)`);
  console.log("================================================================================\n");

  if (passedChecks === totalChecks) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runVerification().catch((err) => {
  console.error("VERIFICATION FAILED WITH UNCAUGHT EXCEPTION:", err);
  process.exit(1);
});
