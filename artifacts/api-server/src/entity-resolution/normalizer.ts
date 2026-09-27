/**
 * BidShield Entity Resolution — Deterministic Normalization Pipeline
 * Phase 19: Comprehensive string, suffix, identifier, and address normalizer.
 */

import { LegalForm, NormalizedCompanyData } from "./types.js";

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const PIN_CODE_REGEX = /\b([1-9][0-9]{5})\b/;

// Standard abbreviation expansions for company names
const WORD_EXPANSIONS: Record<string, string> = {
  "infra": "infrastructure",
  "tech": "technologies",
  "techno": "technologies",
  "eng": "engineering",
  "engg": "engineering",
  "const": "construction",
  "constn": "construction",
  "mfg": "manufacturing",
  "corp": "corporation",
  "co": "company",
  "assoc": "associates",
  "soln": "solutions",
  "solns": "solutions",
  "intl": "international",
  "ind": "industries",
  "inds": "industries",
  "syst": "systems",
  "sys": "systems",
  "ent": "enterprises",
  "dev": "developers",
};

// City canonical aliases (Tamil Nadu, Karnataka, Maharashtra, etc.)
const CITY_ALIASES: Record<string, string> = {
  "bengaluru": "bangalore",
  "chennai city": "chennai",
  "madras": "chennai",
  "mumbai city": "mumbai",
  "bombay": "mumbai",
  "kolkata": "calcutta",
  "new delhi": "delhi",
};

/**
 * Trims and collapses multiple spaces into a single space.
 */
export function collapseWhitespace(str: string): string {
  return (str || "").trim().replace(/\s+/g, " ");
}

/**
 * Basic unicode cleaning and punctuation normalization.
 */
export function cleanPunctuationAndSymbols(str: string): string {
  if (!str) return "";
  return str
    .normalize("NFKC") // Unicode canonical decomposition & composition
    .replace(/[&]/g, " and ")
    .replace(/[@]/g, " at ")
    .replace(/[+]/g, " plus ")
    .replace(/['’"“”«»`]/g, "") // Remove quotation marks
    .replace(/[()[\]{}:;*#_]/g, " ") // Replace brackets, semicolons, hashes with space
    .replace(/\\/g, "/")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normalizes acronyms with dots like "P.V.T." -> "pvt", "L.T.D." -> "ltd", "A.B.C." -> "abc", "Pvt." -> "pvt".
 */
export function normalizeAcronymDots(str: string): string {
  return str
    .replace(/([a-zA-Z])\.(?=[a-zA-Z]|\s|$)/g, "$1")
    .replace(/\s+/g, " ");
}

/**
 * Validates whether a string is a formally valid Indian GSTIN.
 */
export function validateGSTIN(gstin?: string | null): boolean {
  if (!gstin) return false;
  const clean = gstin.trim().toUpperCase().replace(/[\s-]/g, "");
  return GSTIN_REGEX.test(clean);
}

/**
 * Cleans and standardizes a GSTIN. Returns null if invalid or blank.
 */
export function normalizeGSTIN(gstin?: string | null): string | null {
  if (!gstin) return null;
  const clean = gstin.trim().toUpperCase().replace(/[\s-]/g, "");
  return GSTIN_REGEX.test(clean) ? clean : null;
}

/**
 * Cleans and standardizes a Corporate Identification Number (CIN) or registration number.
 */
export function normalizeRegistrationNumber(reg?: string | null): string | null {
  if (!reg) return null;
  const clean = reg.trim().toUpperCase().replace(/[\s-.]/g, "");
  return clean.length >= 4 ? clean : null;
}

/**
 * Detects the legal entity form from a company name string and returns standardized form.
 */
export function detectLegalForm(name: string): { form: LegalForm; cleanSuffix: string } {
  const cleaned = cleanPunctuationAndSymbols(name).toLowerCase();
  const withoutDots = normalizeAcronymDots(cleaned);
  const lower = ` ${collapseWhitespace(withoutDots.replace(/[.,/\\-]/g, " "))} `;

  if (
    lower.includes(" private limited ") ||
    lower.includes(" pvt limited ") ||
    lower.includes(" private ltd ") ||
    lower.includes(" pvt ltd ") ||
    lower.includes(" pvtltd ")
  ) {
    return { form: "PVT_LTD", cleanSuffix: "pvt ltd" };
  }

  if (
    lower.includes(" limited liability partnership ") ||
    lower.includes(" llp ") ||
    lower.includes(" l l p ")
  ) {
    return { form: "LLP", cleanSuffix: "llp" };
  }

  if (
    lower.includes(" limited ") ||
    lower.includes(" ltd ") ||
    lower.includes(" l t d ")
  ) {
    return { form: "LTD", cleanSuffix: "ltd" };
  }

  if (lower.includes(" incorporated ") || lower.includes(" inc ") || lower.includes(" incorp ")) {
    return { form: "INC", cleanSuffix: "inc" };
  }

  if (lower.includes(" corporation ") || lower.includes(" corp ")) {
    return { form: "CORP", cleanSuffix: "corp" };
  }

  if (lower.includes(" partnership ") || lower.includes(" and partners ")) {
    return { form: "PARTNERSHIP", cleanSuffix: "partnership" };
  }

  if (lower.includes(" proprietorship ") || lower.includes(" prop ")) {
    return { form: "PROPRIETORSHIP", cleanSuffix: "proprietorship" };
  }

  if (lower.includes(" enterprises ") || lower.includes(" enterprise ")) {
    return { form: "ENTERPRISES", cleanSuffix: "enterprises" };
  }

  if (lower.includes(" holdings ") || lower.includes(" holding ")) {
    return { form: "HOLDINGS", cleanSuffix: "holdings" };
  }

  if (lower.includes(" company ") || lower.includes(" co ")) {
    return { form: "CO", cleanSuffix: "co" };
  }

  return { form: "UNKNOWN", cleanSuffix: "" };
}

/**
 * Extracts the core name of the company by safely removing detected legal suffixes.
 */
export function extractCoreName(name: string): string {
  let cleaned = cleanPunctuationAndSymbols(name).toLowerCase();
  cleaned = normalizeAcronymDots(cleaned);
  cleaned = cleaned.replace(/[.,/\\-]/g, " ");
  let withPads = ` ${collapseWhitespace(cleaned)} `;

  // Strip legal suffixes
  const suffixPatterns = [
    /\b(private limited|private ltd|pvt limited|pvt ltd|pvtltd)\b/g,
    /\b(limited liability partnership|llp)\b/g,
    /\b(limited|ltd)\b/g,
    /\b(incorporated|inc|incorp)\b/g,
    /\b(corporation|corp)\b/g,
    /\b(enterprises|enterprise)\b/g,
    /\b(company|co)\b/g,
  ];

  for (const pattern of suffixPatterns) {
    withPads = withPads.replace(pattern, " ");
  }

  const collapsed = collapseWhitespace(withPads);

  // Expand standard common abbreviations
  const tokens = collapsed.split(" ").filter(Boolean).map((token) => {
    return WORD_EXPANSIONS[token] || token;
  });

  return tokens.join(" ").trim();
}

/**
 * Deterministic Company Normalization Pipeline.
 * Preserves legal identity distinction while standardizing formatting.
 *
 * Example:
 * "ABC Infrastructure Pvt. Ltd." ->
 *  normalizedName: "abc infrastructure pvt ltd"
 *  coreName: "abc infrastructure"
 *  legalForm: "PVT_LTD"
 */
export function normalizeCompany(
  rawName: string,
  extra?: {
    gstin?: string | null;
    registrationNumber?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
  }
): NormalizedCompanyData {
  const originalName = String(rawName || "").trim();
  const cleaned = cleanPunctuationAndSymbols(originalName);
  const withoutDots = normalizeAcronymDots(cleaned);
  const { form: legalForm, cleanSuffix } = detectLegalForm(withoutDots);
  const coreName = extractCoreName(originalName);

  // Full normalized representation keeps standardized legal suffix if present
  const normalizedName = cleanSuffix ? `${coreName} ${cleanSuffix}`.trim() : coreName;
  const tokens = coreName.split(" ").filter(Boolean);

  const gstin = normalizeGSTIN(extra?.gstin);
  const registrationNumber = normalizeRegistrationNumber(extra?.registrationNumber);
  const originalAddress = extra?.address ? String(extra.address).trim() : null;
  const normalizedAddress = originalAddress ? normalizeAddress(originalAddress) : null;
  const pinCode = originalAddress ? extractPinCode(originalAddress) : null;
  const city = extra?.city ? normalizeCity(extra.city) : null;
  const state = extra?.state ? normalizeState(extra.state) : null;

  return {
    originalName,
    normalizedName,
    coreName,
    legalForm,
    tokens,
    gstin,
    registrationNumber,
    originalAddress,
    normalizedAddress,
    city,
    state,
    pinCode,
  };
}

/**
 * Backward-compatible single-string company name normalizer.
 */
export function normalizeCompanyName(value: string): string {
  if (!value) return "";
  return normalizeCompany(value).normalizedName;
}

/**
 * Standardizes physical addresses for comparison.
 */
export function normalizeAddress(value: string): string {
  if (!value) return "";
  let cleaned = cleanPunctuationAndSymbols(value).toLowerCase();

  // Standardize common road/street/building abbreviations
  cleaned = cleaned
    .replace(/\b(street|str|st\.)\b/g, "st")
    .replace(/\b(road|rd\.)\b/g, "rd")
    .replace(/\b(avenue|ave\.)\b/g, "ave")
    .replace(/\b(lane|ln\.)\b/g, "ln")
    .replace(/\b(nagar|ngr)\b/g, "nagar")
    .replace(/\b(industrial area|indl area|ind area)\b/g, "ind area")
    .replace(/\b(industrial estate|indl estate|ind estate)\b/g, "ind estate")
    .replace(/\b(plot no|plot number|door no|no\.)\b/g, "no")
    .replace(/\b(building|bldg)\b/g, "bldg")
    .replace(/\b(floor|flr)\b/g, "flr")
    .replace(/\b(sector|sec)\b/g, "sec")
    .replace(/\b(block|blk)\b/g, "blk")
    .replace(/[.,/\\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned;
}

/**
 * Extracts a 6-digit Indian PIN code from an address string.
 */
export function extractPinCode(address: string): string | null {
  if (!address) return null;
  const match = address.match(PIN_CODE_REGEX);
  return match ? match[1] : null;
}

/**
 * Normalizes city names and aliases.
 */
export function normalizeCity(city: string): string {
  if (!city) return "";
  const cleaned = cleanPunctuationAndSymbols(city).toLowerCase().trim();
  return CITY_ALIASES[cleaned] || cleaned;
}

/**
 * Normalizes state names.
 */
export function normalizeState(state: string): string {
  if (!state) return "";
  return cleanPunctuationAndSymbols(state).toLowerCase().trim();
}
