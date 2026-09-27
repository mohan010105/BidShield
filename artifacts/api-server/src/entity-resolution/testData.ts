/**
 * BidShield Entity Resolution — Synthetic Test Dataset
 * Phase 19: Dedicated validation test suite covering all required match categories and edge cases.
 */

export interface EntityResolutionTestCase {
  id: string;
  category: string;
  description: string;
  source: {
    name: string;
    gstin?: string | null;
    registrationNumber?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
  };
  candidate: {
    canonicalName: string;
    gstin?: string | null;
    registrationNumber?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
  };
  expectedOutcome: "AUTO_MATCH" | "REVIEW_REQUIRED" | "NO_MATCH";
  expectedMinScore: number;
  expectedMaxScore: number;
  shouldMerge: boolean;
}

export const SYNTHETIC_ENTITY_TEST_CASES: EntityResolutionTestCase[] = [
  // 1. EXACT SAME
  {
    id: "TC-01",
    category: "EXACT_SAME",
    description: "Exact identical company names with identical GSTIN",
    source: {
      name: "ABC Infrastructure Pvt Ltd",
      gstin: "33AAAAA0000A1Z5",
      address: "12 Anna Nagar, Chennai",
      city: "Chennai",
      state: "Tamil Nadu",
    },
    candidate: {
      canonicalName: "ABC Infrastructure Pvt Ltd",
      gstin: "33AAAAA0000A1Z5",
      address: "12 Anna Nagar, Chennai",
      city: "Chennai",
      state: "Tamil Nadu",
    },
    expectedOutcome: "AUTO_MATCH",
    expectedMinScore: 90,
    expectedMaxScore: 100,
    shouldMerge: true,
  },

  // 2. CASE DIFFERENCE
  {
    id: "TC-02",
    category: "CASE_DIFFERENCE",
    description: "Uppercase vs lowercase company names with matching GSTIN",
    source: {
      name: "ABC INFRASTRUCTURE PVT LTD",
      gstin: "33AAAAA0000A1Z5",
      address: "12 ANNA NAGAR, CHENNAI",
      city: "CHENNAI",
      state: "TAMIL NADU",
    },
    candidate: {
      canonicalName: "abc infrastructure pvt ltd",
      gstin: "33AAAAA0000A1Z5",
      address: "12 Anna Nagar, Chennai",
      city: "Chennai",
      state: "Tamil Nadu",
    },
    expectedOutcome: "AUTO_MATCH",
    expectedMinScore: 90,
    expectedMaxScore: 100,
    shouldMerge: true,
  },

  // 3. PUNCTUATION DIFFERENCE
  {
    id: "TC-03",
    category: "PUNCTUATION",
    description: "Punctuation variants (dots in Pvt. Ltd., commas, hyphens)",
    source: {
      name: "ABC Infrastructure Pvt. Ltd.",
      address: "Plot-12, Sector-4, Guindy, Chennai - 600032",
      city: "Chennai",
      state: "Tamil Nadu",
    },
    candidate: {
      canonicalName: "ABC Infrastructure Pvt Ltd",
      address: "Plot 12 Sector 4 Guindy Chennai 600032",
      city: "Chennai",
      state: "Tamil Nadu",
    },
    expectedOutcome: "AUTO_MATCH",
    expectedMinScore: 85,
    expectedMaxScore: 100,
    shouldMerge: true,
  },

  // 4. LEGAL SUFFIX VARIATION
  {
    id: "TC-04",
    category: "LEGAL_SUFFIX",
    description: "Private Limited vs Pvt Ltd with compatible legal form",
    source: {
      name: "ABC Infrastructure Private Limited",
      address: "100 Mount Road, Chennai",
      city: "Chennai",
      state: "Tamil Nadu",
    },
    candidate: {
      canonicalName: "ABC Infrastructure Pvt Ltd",
      address: "100 Mount Rd, Chennai",
      city: "Chennai",
      state: "Tamil Nadu",
    },
    expectedOutcome: "AUTO_MATCH",
    expectedMinScore: 85,
    expectedMaxScore: 100,
    shouldMerge: true,
  },

  // 5. TYPO IN NAME
  {
    id: "TC-05",
    category: "TYPO",
    description: "Single-character typo ('Infrastucture' vs 'Infrastructure') with same address",
    source: {
      name: "ABC Infrastucture Pvt Ltd",
      address: "45 GST Road, Chennai",
      city: "Chennai",
      state: "Tamil Nadu",
    },
    candidate: {
      canonicalName: "ABC Infrastructure Pvt Ltd",
      address: "45 GST Rd, Chennai",
      city: "Chennai",
      state: "Tamil Nadu",
    },
    expectedOutcome: "REVIEW_REQUIRED",
    expectedMinScore: 65,
    expectedMaxScore: 84,
    shouldMerge: false, // Requires human confirmation
  },

  // 6. ABBREVIATION
  {
    id: "TC-06",
    category: "ABBREVIATION",
    description: "Common abbreviation ('Infra' vs 'Infrastructure')",
    source: {
      name: "ABC Infra Pvt Ltd",
      city: "Chennai",
      state: "Tamil Nadu",
    },
    candidate: {
      canonicalName: "ABC Infrastructure Pvt Ltd",
      city: "Chennai",
      state: "Tamil Nadu",
    },
    expectedOutcome: "AUTO_MATCH",
    expectedMinScore: 85,
    expectedMaxScore: 100,
    shouldMerge: true,
  },

  // 7. ADDRESS VARIATION
  {
    id: "TC-07",
    category: "ADDRESS_VARIATION",
    description: "Address formatting variation (PIN code, commas, Street vs St)",
    source: {
      name: "ABC Infrastructure Pvt Ltd",
      address: "12, Anna Nagar, Chennai - 600040",
      city: "Chennai",
      state: "Tamil Nadu",
    },
    candidate: {
      canonicalName: "ABC Infrastructure Pvt Ltd",
      address: "12 Anna Nagar Chennai 600040",
      city: "Chennai",
      state: "Tamil Nadu",
    },
    expectedOutcome: "AUTO_MATCH",
    expectedMinScore: 90,
    expectedMaxScore: 100,
    shouldMerge: true,
  },

  // 8. SAME NAME DIFFERENT ENTITY (CRITICAL SAFEGUARD)
  {
    id: "TC-08",
    category: "SAME_NAME_DIFFERENT_ENTITY",
    description: "Same name but conflicting GSTINs and different addresses (MUST NOT MERGE)",
    source: {
      name: "ABC Enterprises",
      gstin: "33AAAAA1111A1Z1", // Tamil Nadu
      address: "12 Anna Salai, Chennai",
      city: "Chennai",
      state: "Tamil Nadu",
    },
    candidate: {
      canonicalName: "ABC Enterprises",
      gstin: "29BBBBB2222B1Z2", // Karnataka
      address: "45 MG Road, Bangalore",
      city: "Bangalore",
      state: "Karnataka",
    },
    expectedOutcome: "NO_MATCH",
    expectedMinScore: 0,
    expectedMaxScore: 40,
    shouldMerge: false, // STRICTLY FORBIDDEN
  },

  // 9. LEGAL FORM MISMATCH (PVT LTD vs LLP)
  {
    id: "TC-09",
    category: "LEGAL_FORM_MISMATCH",
    description: "Pvt Ltd vs LLP without matching GSTIN (MUST NOT AUTO MERGE)",
    source: {
      name: "ABC Technologies Pvt Ltd",
      city: "Chennai",
      state: "Tamil Nadu",
    },
    candidate: {
      canonicalName: "ABC Technologies LLP",
      city: "Chennai",
      state: "Tamil Nadu",
    },
    expectedOutcome: "REVIEW_REQUIRED",
    expectedMinScore: 60,
    expectedMaxScore: 75,
    shouldMerge: false, // Flagged for review
  },

  // 10. UNICODE / MULTILINGUAL ENTITY
  {
    id: "TC-10",
    category: "MULTILINGUAL_UNICODE",
    description: "Tamil and Hindi company names without corruption",
    source: {
      name: "பாரதி இன்ஃப்ராஸ்ட்ரக்சர் பிரைவேட் லிமிடெட்",
      city: "Chennai",
      state: "Tamil Nadu",
    },
    candidate: {
      canonicalName: "பாரதி இன்ஃப்ராஸ்ட்ரக்சர் பிரைவேட் லிமிடெட்",
      city: "Chennai",
      state: "Tamil Nadu",
    },
    expectedOutcome: "AUTO_MATCH",
    expectedMinScore: 85,
    expectedMaxScore: 100,
    shouldMerge: true,
  },
];
