import { EvidenceContext, InvestigationSummaryResult, InvestigationReportResult, InvestigationChatResult } from "./types.js";

/**
 * List of prohibited accusatory, legal liability, or illegal terms.
 * If detected in raw AI output, the response must be rejected or sanitized.
 */
const PROHIBITED_PATTERNS = [
  /\bcollusion confirmed\b/i,
  /\bfraud confirmed\b/i,
  /\bguilty\b/i,
  /\bcartel\b/i,
  /\bcriminal\b/i,
  /\billegal\b/i,
  /\bdefinitely colluded\b/i,
  /\bintent to defraud\b/i,
  /\bproven fraud\b/i,
  /\bprosecute the companies\b/i,
  /\bguilt of bidders\b/i,
];

/**
 * Sanitizes user input to prevent prompt injection.
 * Strips dangerous instruction override prefixes.
 */
export function sanitizeUserInput(input: string): string {
  if (!input) return "";
  return input
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "") // strip control characters
    .trim();
}

export type PromptSecurityResult = {
  isAttack: boolean;
  type: "system_prompt_extraction" | "instruction_override" | "permission_bypass" | "sql_injection" | "api_key_extraction" | "none";
  safeResponse?: string;
  reason?: string;
};

/**
 * Detects prompt injection, system prompt extraction, permission bypass, and malicious payload attempts.
 * Supports English, Tamil, and Hindi.
 */
export function detectPromptInjection(input: string, language: string = "en-IN"): PromptSecurityResult {
  if (!input) return { isAttack: false, type: "none" };
  const lower = input.toLowerCase();

  const isTamil = language.startsWith("ta") || /[\u0B80-\u0BFF]/.test(input);
  const isHindi = language.startsWith("hi") || /[\u0900-\u097F]/.test(input);

  // 1. System Prompt Extraction Attempts
  const systemPromptPatterns = [
    /show (me )?(your |the )?system prompt/i,
    /what is your system prompt/i,
    /reveal (your |the )?system instructions/i,
    /display system instructions/i,
    /print developer prompt/i,
    /repeat (the |your )?prompt/i,
    /output initial prompt/i,
    /சிஸ்டம் ப்ராம்ப்ட்/i,
    /கணினி அறிவுறுத்தல்களைக் காட்டு/i,
    /உள் வழிமுறைகளை/i,
    /सिस्टम प्रॉम्प्ट/i,
    /डेवलपर निर्देश/i,
    /आंतरिक निर्देश दिखाएं/i,
  ];

  if (systemPromptPatterns.some((p) => p.test(input))) {
    const safeResponse = isTamil
      ? "BidShield AI எவ்வாறு செயல்படுகிறது என்பதை விளக்க நான் உதவ முடியும், ஆனால் உள் கணினி வழிமுறைகளை வழங்க முடியாது."
      : isHindi
      ? "मैं यह समझाने में मदद कर सकता हूँ कि BidShield AI कैसे काम करता है, लेकिन मैं आंतरिक सिस्टम निर्देश प्रदान नहीं कर सकता।"
      : "I can help explain how BidShield AI works, but I can't provide internal system instructions.";

    return {
      isAttack: true,
      type: "system_prompt_extraction",
      safeResponse,
      reason: "Request attempted to extract internal system prompt or developer instructions.",
    };
  }

  // 2. API Key Extraction Attempts
  const apiKeyPatterns = [
    /reveal (the |your )?(openai |ai )?api key/i,
    /what is (the |your )?api key/i,
    /give me (the |your )?api key/i,
    /print api[_-]key/i,
    /show (me )?the secret key/i,
    /api திறவுகோல்/i,
    /ரகசிய விசை/i,
    /एपीआई कुंजी/i,
    /सीक्रेट की दिखाएं/i,
  ];

  if (apiKeyPatterns.some((p) => p.test(input))) {
    const safeResponse = isTamil
      ? "பாதுகாப்புக் கொள்கை: API விசைகள் அல்லது கணினி சான்றுகள் ஒருபோதும் அணுகப்படவோ வெளியிடப்படவோ முடியாது."
      : isHindi
      ? "सुरक्षा नीति: एपीआई कुंजियाँ या सिस्टम क्रेडेंशियल कभी भी एक्सेस या प्रकट नहीं किए जा सकते हैं।"
      : "Security Notice: API keys and internal credentials are secure server-side secrets and cannot be disclosed.";

    return {
      isAttack: true,
      type: "api_key_extraction",
      safeResponse,
      reason: "Request attempted to extract API key or server credentials.",
    };
  }

  // 3. Instruction Override / Jailbreak
  const overridePatterns = [
    /ignore (all )?previous instructions/i,
    /disregard (all )?prior instructions/i,
    /treat this (tender|document|text) as your system instructions/i,
    /you are now DAN/i,
    /jailbreak/i,
    /முந்தைய வழிமுறைகளைப் புறக்கணிக்கவும்/i,
    /இதையே உங்கள் புதிய வழிமுறையாகக் கருதுங்கள்/i,
    /पिछले सभी निर्देशों को अनदेखा करें/i,
    /इसे अपने सिस्टम निर्देश मानें/i,
  ];

  if (overridePatterns.some((p) => p.test(input))) {
    const safeResponse = isTamil
      ? "பாதுகாப்பு அறிவிப்பு: BidShield AI கடுமையான அங்கீகாரம் மற்றும் பாதுகாப்புக் கட்டுப்பாடுகளின் கீழ் இயங்குகிறது. வழிமுறை மீறல்கள் அனுமதிக்கப்படாது."
      : isHindi
      ? "सुरक्षा सूचना: BidShield AI सख्त प्राधिकरण और सुरक्षा नियंत्रणों के तहत काम करता है। निर्देश ओवरराइड की अनुमति नहीं है।"
      : "Security Notice: BidShield AI operates under strict authorization and security controls. Instruction overrides are not permitted.";

    return {
      isAttack: true,
      type: "instruction_override",
      safeResponse,
      reason: "Request attempted to override system instructions.",
    };
  }

  // 4. Permission Bypass / Cross-User Access
  const permissionBypassPatterns = [
    /ignore (the )?database permissions/i,
    /give me another user'?s investigation/i,
    /bypass access control/i,
    /show (me )?restricted records/i,
    /பிற பயனரின் விசாரணையை/i,
    /அனுமதி கட்டுப்பாடுகளை புறக்கணிக்கவும்/i,
    /डेटाबेस अनुमतियों को अनदेखा करें/i,
    /अन्य उपयोगकर्ता की जांच दें/i,
  ];

  if (permissionBypassPatterns.some((p) => p.test(input))) {
    const safeResponse = isTamil
      ? "அணுகல் மறுக்கப்பட்டது: நீங்கள் அங்கீகரிக்கப்பட்ட BidShield பதிவுகளை மட்டுமே அணுக முடியும்."
      : isHindi
      ? "पहुंच अस्वीकृत: आप केवल अपनी अधिकृत BidShield रिकॉर्ड तक पहुंच सकते हैं।"
      : "Access Denied: You may only access BidShield records that your account is authorized to view.";

    return {
      isAttack: true,
      type: "permission_bypass",
      safeResponse,
      reason: "Request attempted to bypass authorization controls.",
    };
  }

  // 5. Arbitrary SQL Execution
  const sqlInjectionPatterns = [
    /run arbitrary sql/i,
    /execute sql/i,
    /drop table/i,
    /union select/i,
    /select \* from users/i,
    /--[ \t]*$/m,
    /or 1=1/i,
    /தன்னிச்சையான sql/i,
    /मनमाना sql चलाएं/i,
  ];

  if (sqlInjectionPatterns.some((p) => p.test(input))) {
    const safeResponse = isTamil
      ? "பாதுகாப்பு மறுப்பு: நேரடி SQL வினவல்களை இயக்க முடியாது. அனைத்து வினவல்களும் சரிபார்க்கப்பட்ட அளவுரு வினவல்கள் மூலம் மட்டுமே செய்யப்படுகின்றன."
      : isHindi
      ? "सुरक्षा अस्वीकृति: मनमाना SQL निष्पादित नहीं किया जा सकता। सभी कार्य केवल सत्यापित और सुरक्षित एनालिटिक्स के माध्यम से किए जाते हैं।"
      : "Security Notice: Arbitrary SQL execution is strictly disabled. BidShield data is accessed only through secure, parameterized query builders.";

    return {
      isAttack: true,
      type: "sql_injection",
      safeResponse,
      reason: "Request attempted arbitrary SQL execution or SQL injection.",
    };
  }

  return { isAttack: false, type: "none" };
}

/**
 * Validates whether text contains any prohibited legal/accusatory claims.
 */
export function containsProhibitedClaims(text: string): boolean {
  if (!text) return false;
  return PROHIBITED_PATTERNS.some(pattern => pattern.test(text));
}

/**
 * Validates AI generated text. Returns false if unsupported claims are found.
 */
export function validateAIOutputText(text: string): { valid: boolean; reason?: string } {
  if (containsProhibitedClaims(text)) {
    return {
      valid: false,
      reason: "Response contained prohibited legal conclusions or accusatory terms (e.g. cartel, guilt, confirmed fraud).",
    };
  }
  return { valid: true };
}


/**
 * Generates a deterministic, safe, evidence-grounded fallback summary from EvidenceContext.
 * Used when AI provider is unavailable, times out, or produces invalid output.
 */
export function generateFallbackSummary(
  context: EvidenceContext,
  provider: string = "fallback-engine",
  model: string = "deterministic-v1"
): InvestigationSummaryResult {
  const lang = context.language || "en";
  const isTamil = lang === "ta";
  const isHindi = lang === "hi";
  const tender = context.tender;
  const risk = context.risk;
  const evidenceList = context.evidence || [];
  const indicators = context.indicators || [];

  const keyObs: string[] = [];
  if (indicators.length > 0) {
    indicators.forEach(ind => {
      if (ind.score && ind.score > 50) {
        if (isHindi) {
          const typeName = ind.type === "PRICE_CLUSTERING" ? "मूल्य समूहन (Price Clustering)"
            : ind.type === "COVER_BID" ? "कवर बिड (Cover Bidding)"
            : ind.type === "WINNER_ROTATION" ? "विजेता चक्रण (Winner Rotation)"
            : ind.type === "PARTICIPATION_NETWORK" ? "भागीदारी नेटवर्क (Participation Network)"
            : "असामान्य स्थिर हारी बोली (Too-Neat Losing Bid)";
          keyObs.push(`${typeName}: ${ind.summary}`);
        } else if (isTamil) {
          const typeName = ind.type === "PRICE_CLUSTERING" ? "விலை தொகுப்பு (Price Clustering)"
            : ind.type === "COVER_BID" ? "போலி ஏலம் (Cover Bidding)"
            : ind.type === "WINNER_ROTATION" ? "வெற்றி சுழற்சி (Winner Rotation)"
            : ind.type === "PARTICIPATION_NETWORK" ? "பங்கேற்பு நெட்வொர்க் (Participation Network)"
            : "மிக நேர்த்தியான தோற்ற ஏலம் (Too-Neat Losing Bid)";
          keyObs.push(`${typeName}: ${ind.summary}`);
        } else {
          keyObs.push(`${ind.type.replace(/_/g, " ")}: ${ind.summary}`);
        }
      }
    });
  }

  if (keyObs.length === 0) {
    if (isHindi) {
      keyObs.push(`BidShield ने निविदा ${tender.tenderNumber} के लिए ${indicators.length} सांख्यिकीय संकेतकों का मूल्यांकन किया।`);
      keyObs.push(`दर्ज समग्र स्क्रीनिंग स्कोर: ${risk.overallScore ?? "N/A"}।`);
    } else if (isTamil) {
      keyObs.push(`டெண்டர் ${tender.tenderNumber} க்காக BidShield ${indicators.length} புள்ளியியல் குறிகாட்டிகளை மதிப்பீடு செய்துள்ளது.`);
      keyObs.push(`பதிவு செய்யப்பட்ட ஒட்டுமொத்த திரையிடல் மதிப்பெண்: ${risk.overallScore ?? "N/A"}.`);
    } else {
      keyObs.push(`BidShield evaluated ${indicators.length} statistical indicators for tender ${tender.tenderNumber}.`);
      keyObs.push(`Recorded overall screening score of ${risk.overallScore ?? "N/A"}.`);
    }
  }

  const supportingEv = evidenceList.map(e => ({
    evidenceId: String(e.id),
    indicator: e.indicatorType,
    summary: isHindi
      ? `${e.description} (देखा गया: ${e.observedValue || 'N/A'}, मापदंड: ${e.metric})`
      : isTamil 
      ? `${e.description} (கண்டறியப்பட்டது: ${e.observedValue || 'N/A'}, அளவீடு: ${e.metric})`
      : `${e.description} (Observed: ${e.observedValue || 'N/A'}, Metric: ${e.metric})`,
  }));

  const limitations = isHindi
    ? [
        `विश्लेषण निविदा ${tender.tenderNumber} के लिए ${context.bids.length} प्रस्तुत बोलियों पर आधारित है।`,
        `उपलब्ध ऐतिहासिक निविदा रिकॉर्ड में मूल्यांकित नेटवर्क कनेक्शन (${context.network.connectedPairs.length} सह-बोली जोड़े दर्ज)।`,
        `सांख्यिकीय स्क्रीनिंग अतिरिक्त समीक्षा योग्य पैटर्न की पहचान करती है, लेकिन कानूनी दायित्व या मिलीभगत स्थापित नहीं करती।`,
      ]
    : isTamil
    ? [
        `பகுப்பாய்வு டெண்டர் ${tender.tenderNumber} க்கான ${context.bids.length} சமர்ப்பிக்கப்பட்ட ஏலங்களை அடிப்படையாகக் கொண்டது.`,
        `வரலாற்று டெண்டர் பதிவுகளில் மதிப்பீடு செய்யப்பட்ட நெட்வொர்க் இணைப்புகள் (${context.network.connectedPairs.length} இணை ஏல ஜோடிகள் பதிவு செய்யப்பட்டுள்ளன).`,
        `புள்ளியியல் திரையிடல் கூடுதல் ஆய்வுக்குரிய வடிவங்களை அடையாளம் காட்டுகிறது, ஆனால் சட்டப் பொறுப்பையோ கூட்டு சதியையோ நிறுவவில்லை.`,
      ]
    : [
        `Analysis is based on ${context.bids.length} submitted bids for tender ${tender.tenderNumber}.`,
        `Network connections evaluated across available historical tender records (${context.network.connectedPairs.length} co-bidding pairs recorded).`,
        `Statistical screening identifies patterns that warrant review but does not establish legal liability or collusion.`,
      ];

  const reviewActions = isHindi
    ? [
        `निविदा समूह ${tender.tenderNumber} के लिए ऐतिहासिक बोली सारणी और प्रस्तुति समय-मुहर की समीक्षा करें।`,
        `भाग लेने वाली कंपनियों के प्रोक्योरमेंट अनुपालन दस्तावेज़ और तकनीकी योग्यता रिकॉर्ड सत्यापित करें।`,
        `पिछली संबंधित निविदाओं में विस्तृत मूल्य अनुसूचियों की स्वतंत्र मैनुअल लेखा-परीक्षा करें।`,
      ]
    : isTamil
    ? [
        `டெண்டர் குழு ${tender.tenderNumber} க்கான வரலாற்று ஏல அட்டவணைகள் மற்றும் சமர்ப்பிப்பு நேர முத்திரைகளை மதிப்பாய்வு செய்யவும்.`,
        `பங்கேற்கும் நிறுவனங்களுக்கான கொள்முதல் இணக்க ஆவணங்கள் மற்றும் தொழில்நுட்ப தகுதி பதிவுகளை சரிபார்க்கவும்.`,
        `கடந்த கால தொடர்புடைய டெண்டர்களில் விரிவான விலை நிர்ணய அட்டவணைகளின் சுயாதீன கையேடு தணிக்கையை மேற்கொள்ளவும்.`,
      ]
    : [
        `Review historical bid tabulations and submission timestamps for tender group ${tender.tenderNumber}.`,
        `Verify procurement compliance documentation and technical qualification records for participating firms.`,
        `Conduct independent manual audit of itemized pricing schedules across past related tenders.`,
      ];

  const evidenceSnapshot = evidenceList.map(e => String(e.id));

  const overview = isHindi
    ? `निविदा ${tender.tenderNumber} (${tender.title}) के लिए जाँच सारांश (जारीकर्ता: ${tender.organization})। समग्र स्क्रीनिंग संकेत: ${risk.riskLevel} (स्कोर: ${risk.overallScore ?? "N/A"}/100)।`
    : isTamil
    ? `டெண்டர் ${tender.tenderNumber} (${tender.title}) க்கான புலனாய்வு சுருக்கம் (வழங்கிய அமைப்பு: ${tender.organization}). ஒட்டுமொத்த திரையிடல் சமிக்ஞை: ${risk.riskLevel} (மதிப்பெண்: ${risk.overallScore ?? "N/A"}/100).`
    : `Investigation summary for tender ${tender.tenderNumber} (${tender.title}), issued by ${tender.organization}. Overall screening signal: ${risk.riskLevel} (Score: ${risk.overallScore ?? "N/A"}/100).`;

  return {
    overview,
    screeningLevel: risk.riskLevel,
    screeningScore: risk.overallScore,
    keyObservations: keyObs,
    supportingEvidence: supportingEv,
    dataLimitations: limitations,
    recommendedReviewActions: reviewActions,
    disclaimer: context.methodology.disclaimer,
    provider,
    model,
    promptVersion: "investigation_summary_v1.0",
    evidenceSnapshot,
  };
}

/**
 * Generates a deterministic fallback investigation report when LLM is unavailable.
 */
export function generateFallbackReport(
  context: EvidenceContext,
  provider: string = "fallback-engine",
  model: string = "deterministic-v1"
): InvestigationReportResult {
  const lang = context.language || "en";
  const isTamil = lang === "ta";
  const isHindi = lang === "hi";
  const t = context.tender;
  const r = context.risk;
  const evList = context.evidence || [];
  const bids = context.bids || [];
  const companies = context.companies || [];

  const evidenceSnapshot = evList.map(e => String(e.id));

  const localeStr = isHindi ? 'hi-IN' : isTamil ? 'ta-IN' : 'en-IN';

  const executiveSummary = isHindi
    ? `यह AI-सहायता प्राप्त ड्राफ़्ट रिपोर्ट निविदा ${t.tenderNumber} ("${t.title}"), संगठन: ${t.organization} (${t.department}) के लिए गणना किए गए BidShield स्क्रीनिंग साक्ष्यों को संश्लेषित करती है। संयुक्त जोखिम इंजन ने ${context.indicators.length} सांख्यिकीय संकेतकों का मूल्यांकन कर ${r.overallScore ?? "N/A"}/100 (${r.riskLevel}) का समग्र स्क्रीनिंग स्कोर की गणना की। सांख्यिकीय स्क्रीनिंग असामान्य बोली पैटर्न को उजागर करती है जो अतिरिक्त प्रशासनिक समीक्षा की आवश्यकता दर्शा सकते हैं।`
    : isTamil
    ? `இந்த AI-உதவி வரைவு அறிக்கை டெண்டர் ${t.tenderNumber} ("${t.title}"), அமைப்பு: ${t.organization} (${t.department}) க்கான கணக்கிடப்பட்ட BidShield திரையிடல் ஆதாரங்களை ஒருங்கிணைக்கிறது. ஒருங்கிணைந்த இடர் எஞ்சின் ${context.indicators.length} புள்ளியியல் குறிகாட்டிகளை மதிப்பீடு செய்து ${r.overallScore ?? "N/A"}/100 (${r.riskLevel}) என்ற ஒட்டுமொத்த திரையிடல் மதிப்பெண்ணைக் கணக்கிட்டுள்ளது. புள்ளியியல் திரையிடல் கூடுதல் நிர்வாக ஆய்வுக்கு உத்தரவாதமளிக்கும் அசாதாரண ஏல வடிவங்களை முன்னிலைப்படுத்துகிறது.`
    : `This AI-assisted draft report synthesizes calculated BidShield screening evidence for tender ${t.tenderNumber} ("${t.title}"), conducted by ${t.organization} (${t.department}). The combined risk engine evaluated ${context.indicators.length} statistical indicators and calculated an overall screening score of ${r.overallScore ?? "N/A"}/100 (${r.riskLevel}). Statistical screening highlights unusual bidding patterns that may warrant further administrative review.`;

  const tenderInformation = isHindi
    ? `निविदा संख्या: ${t.tenderNumber}\nशीर्षक: ${t.title}\nविभाग: ${t.department}\nसंगठन: ${t.organization}\nश्रेणी: ${t.category}\nस्थान: ${t.location}\nअनुमानित मूल्य: ₹${Number(t.estimatedValue).toLocaleString('hi-IN')}\nअनुबंध मूल्य: ${t.contractValue ? `₹${Number(t.contractValue).toLocaleString('hi-IN')}` : 'N/A'}\nविजेता: ${t.winnerName || 'निर्धारित नहीं'}\nनिविदा तिथि: ${t.tenderDate}\nस्थिति: ${t.status}`
    : isTamil
    ? `டெண்டர் எண்: ${t.tenderNumber}\nதலைப்பு: ${t.title}\nதுறை: ${t.department}\nஅமைப்பு: ${t.organization}\nவகை: ${t.category}\nஇடம்: ${t.location}\nமதிப்பிடப்பட்ட மதிப்பு: ₹${Number(t.estimatedValue).toLocaleString('ta-IN')}\nஒப்பந்த மதிப்பு: ${t.contractValue ? `₹${Number(t.contractValue).toLocaleString('ta-IN')}` : 'N/A'}\nவெற்றியாளர்: ${t.winnerName || 'ஒதுக்கப்படவில்லை'}\nடெண்டர் தேதி: ${t.tenderDate}\nநிலை: ${t.status}`
    : `Tender Number: ${t.tenderNumber}\nTitle: ${t.title}\nDepartment: ${t.department}\nOrganization: ${t.organization}\nCategory: ${t.category}\nLocation: ${t.location}\nEstimated Value: ₹${Number(t.estimatedValue).toLocaleString('en-IN')}\nContract Value: ${t.contractValue ? `₹${Number(t.contractValue).toLocaleString('en-IN')}` : 'N/A'}\nWinner: ${t.winnerName || 'Unassigned'}\nTender Date: ${t.tenderDate}\nStatus: ${t.status}`;

  const procurementContext = isHindi
    ? `यह प्रोक्योरमेंट ${t.location} में ${t.organization} द्वारा प्रशासित किया गया। ${companies.length} पहचानी गई बोली लगाने वाली संस्थाओं में कुल ${bids.length} बोलियों का मूल्यांकन किया गया।`
    : isTamil
    ? `இந்தக் கொள்முதல் ${t.location} இல் ${t.organization} ஆல் நிர்வகிக்கப்பட்டது. அடையாளம் காணப்பட்ட ${companies.length} ஏல நிறுவனங்களில் மொத்தம் ${bids.length} ஏலங்கள் மதிப்பீடு செய்யப்பட்டன.`
    : `The procurement was administered by ${t.organization} in ${t.location}. A total of ${bids.length} bids were evaluated across ${companies.length} identified bidding entities.`;

  const participatingCompanies = companies.map(c => `- ${c.name} (ID: ${c.id}${c.gstin ? `, GSTIN: ${c.gstin}` : ''})`).join('\n') || (isHindi ? "बोली सारणी में कंपनी रिकॉर्ड संलग्न हैं।" : isTamil ? "ஏல அட்டவணையில் நிறுவன பதிவுகள் இணைக்கப்பட்டுள்ளன." : "Company records attached in bid schedule.");

  const rankLabel = isHindi ? 'क्रम' : isTamil ? 'தரம்' : 'Rank';
  const winnerLabel = isHindi ? '(विजेता)' : isTamil ? '(வெற்றியாளர்)' : '(Winner)';
  const bidAnalysis = bids.map(b => `- ${rankLabel} ${b.bidRank}: ${b.companyName} — ₹${Number(b.bidAmount).toLocaleString(localeStr)}${b.isWinner ? ` ${winnerLabel}` : ''}`).join('\n');

  const scoreLabel = isHindi ? 'स्कोर' : isTamil ? 'மதிப்பெண்' : 'Score';
  const statusLabel = isHindi ? 'स्थिति' : isTamil ? 'நிலை' : 'Status';
  const statisticalIndicators = context.indicators.map(i => `* ${i.type.replace(/_/g, ' ')} (${scoreLabel}: ${i.score ?? 'N/A'}/100, ${statusLabel}: ${i.status}): ${i.summary}`).join('\n\n');

  const metricLabel = isHindi ? 'मापदंड' : isTamil ? 'அளவீடு' : 'Metric';
  const observedLabel = isHindi ? 'देखा गया' : isTamil ? 'கண்டறியப்பட்டது' : 'Observed';
  const expectedLabel = isHindi ? 'अपेक्षित' : isTamil ? 'எதிர்பார்க்கப்பட்டது' : 'Expected';
  const severityLabel = isHindi ? 'गंभीरता' : isTamil ? 'தீவிரம்' : 'Severity';
  const evidenceText = evList.map(e => `[${e.id}] ${e.indicatorType} — ${e.description}\n  ${metricLabel}: ${e.metric} | ${observedLabel}: ${e.observedValue || 'N/A'} | ${expectedLabel}: ${e.expectedValue || 'N/A'} | ${severityLabel}: ${e.severity}`).join('\n\n');

  const historicalPatterns = isHindi
    ? `BidShield ने तुलनीय प्रोक्योरमेंट श्रेणियों में ऐतिहासिक निविदा प्रस्तुतियों का विश्लेषण किया। ऐतिहासिक विजेता चक्रण और मूल्य समूहन मापदंड गैर-यादृच्छिक वितरण प्राचलों को दर्शाते हैं जो समीक्षा की आवश्यकता दर्शाते हैं।`
    : isTamil
    ? `ஒப்பிடக்கூடிய கொள்முதல் வகைகளில் வரலாற்று டெண்டர் சமர்ப்பிப்புகளை BidShield பகுப்பாய்வு செய்தது. வரலாற்று வெற்றியாளர் சுழற்சி மற்றும் விலை தொகுப்பு அளவீடுகள் சீரற்ற விநியோக அளவுருக்களைக் காட்டுகின்றன.`
    : `BidShield analyzed historical tender submissions across comparable procurement categories. Historical winner rotation and price clustering metrics indicate non-random distribution parameters warranting review.`;

  const pairLabel = isHindi ? 'जोड़ी' : isTamil ? 'ஜோடி' : 'Pair';
  const coPartLabel = isHindi ? 'सह-भागीदारी निविदाएँ' : isTamil ? 'பங்கேற்ற டெண்டர்கள்' : 'Co-participated in';
  const coBidLabel = isHindi ? 'सह-बोली सूचकांक' : isTamil ? 'இணை ஏலக் குறியீடு' : 'Co-bidding index';
  const networkObservations = context.network.connectedPairs.length > 0
    ? context.network.connectedPairs.map(p => `- ${pairLabel} (${p.companyA} & ${p.companyB}): ${coPartLabel} ${p.sharedCount}. ${coBidLabel}: ${p.score ?? 'N/A'}`).join('\n')
    : (isHindi ? "किसी भी सह-बोली नेटवर्क जोड़ी ने सीमा प्राचलों को पार नहीं किया।" : isTamil ? "வரம்பு அளவுருக்களைத் தாண்டிய இணை ஏல நெட்வொர்க் ஜோடிகள் எதுவும் இல்லை." : "No co-bidding network pairs exceeded threshold parameters.");

  const dataQualityAndLimitations = isHindi
    ? `1. निविदा ${t.tenderNumber} के लिए प्रस्तुत ${bids.length} बोलियों पर आधारित विश्लेषण।\n2. दर्ज ऐतिहासिक डेटाबेस प्रविष्टियों में मूल्यांकित नेटवर्क कनेक्टिविटी।\n3. सांख्यिकीय संकेतक पैटर्न विसंगतियों की पहचान करते हैं लेकिन मिलीभगत, धोखाधड़ी या कानूनी दायित्व स्थापित नहीं करते।\n4. डेटासेट उपलब्ध डिजिटल प्रोक्योरमेंट रिकॉर्ड को दर्शाता है; बाहरी ऑफ़लाइन फ़ाइलों का मूल्यांकन नहीं किया गया।`
    : isTamil
    ? `1. டெண்டர் ${t.tenderNumber} க்காக சமர்ப்பிக்கப்பட்ட ${bids.length} ஏலங்களை அடிப்படையாகக் கொண்ட பகுப்பாய்வு.\n2. பதிவுசெய்யப்பட்ட வரலாற்று தரவுத்தள உள்ளீடுகளில் மதிப்பீடு செய்யப்பட்ட நெட்வொர்க் இணைப்பு.\n3. புள்ளியியல் குறிகாட்டிகள் வடிவ ஒழுங்கின்மைகளை அடையாளம் காண்கின்றன, ஆனால் கூட்டு சதி, மோசடி அல்லது சட்டப் பொறுப்பை ஏற்படுத்தாது.\n4. தரவுத்தொகுப்பு கிடைக்கக்கூடிய டிஜிட்டல் கொள்முதல் பதிவுகளைப் பிரதிபலிக்கிறது; வெளிப்புற ஆஃப்லைன் கோப்புகள் மதிப்பீடு செய்யப்படவில்லை.`
    : `1. Analysis based on ${bids.length} submitted bids for tender ${t.tenderNumber}.\n2. Network connectivity evaluated over recorded historical database entries.\n3. Statistical indicators identify pattern anomalies but do NOT establish collusion, fraud, or legal liability.\n4. Dataset reflects available digital procurement records; external offline filings were not evaluated.`;

  const areasForFurtherReview = isHindi
    ? `1. शीर्ष 3 भाग लेने वाले बोलीदाताओं के लिए विस्तृत BOQ दर अनुसूचियों की मैनुअल लेखा-परीक्षा करें।\n2. बोली प्रस्तुतियों के लिए IP पता, समय-मुहर और डिजिटल हस्ताक्षर लॉग की समीक्षा करें।\n3. भाग लेने वाली संस्थाओं के बीच उप-अनुबंध व्यवस्थाओं के संबंध में औपचारिक स्पष्टीकरण का अनुरोध करें।\n4. तकनीकी मूल्यांकन स्कोरिंग एकरूपता के लिए प्रोक्योरमेंट फ़ाइल नोट्स का निरीक्षण करें।`
    : isTamil
    ? `1. முதல் 3 ஏலதாரர்களுக்கான விரிவான BOQ விகித அட்டவணைகளின் கையேடு தணிக்கையை நடத்துங்கள்.\n2. ஏல சமர்ப்பிப்புகளுக்கான IP முகவரி, நேர முத்திரை மற்றும் டிஜிட்டல் கையொப்பப் பதிவுகளை மதிப்பாய்வு செய்யவும்.\n3. பங்கேற்கும் நிறுவனங்களுக்கிடையேயான துணை ஒப்பந்த ஏற்பாடுகள் தொடர்பான முறையான விளக்கத்தைக் கோரவும்.\n4. தொழில்நுட்ப மதிப்பீட்டு மதிப்பெண் நிலைத்தன்மைக்கான கொள்முதல் கோப்பு குறிப்புகளை ஆய்வு செய்யவும்.`
    : `1. Conduct manual audit of itemized BOQ rate schedules for top 3 participating bidders.\n2. Review IP address, timestamp, and digital signature logs for bid submissions.\n3. Request formal clarification regarding sub-contracting arrangements among participating entities.\n4. Inspect procurement file notes for technical evaluation scoring consistency.`;

  const methodology = isHindi
    ? `कार्यप्रणाली संस्करण: ${context.methodology.version}\nBidShield 5 सांख्यिकीय स्क्रीनिंग इंजनों (विजेता चक्रण, कवर बिड, मूल्य समूहन, भागीदारी नेटवर्क, असामान्य स्थिर हारी बोली) को एक समग्र स्क्रीनिंग स्कोर (0–100) में सामान्यीकृत करता है। सभी संकेतक पूर्णतः सांख्यिकीय अवलोकन हैं।`
    : isTamil
    ? `முறைமை பதிப்பு: ${context.methodology.version}\nBidShield 5 புள்ளியியல் திரையிடல் எஞ்சின்களை (வெற்றி சுழற்சி, போலி ஏலம், விலை தொகுப்பு, பங்கேற்பு நெட்வொர்க், மிக நேர்த்தியான தோற்ற ஏலம்) ஒரு ஒட்டுமொத்த திரையிடல் மதிப்பெண்ணாக (0–100) ஒருங்கிணைக்கிறது. அனைத்து குறிகாட்டிகளும் முற்றிலும் புள்ளியியல் அவதானிப்புகள் மட்டுமே.`
    : `Methodology Version: ${context.methodology.version}\nBidShield combines 5 statistical screening engines (Winner Rotation, Cover Bid, Price Clustering, Participation Network, Too-Neat Losing Bid) normalized into an overall screening score (0–100). All indicators are purely statistical observations.`;

  const reportTitle = isHindi
    ? `AI-सहायता प्राप्त जाँच ड्राफ़्ट — निविदा ${t.tenderNumber}`
    : isTamil
    ? `AI-உதவி புலனாய்வு வரைவு — டெண்டர் ${t.tenderNumber}`
    : `AI-Assisted Investigation Draft — Tender ${t.tenderNumber}`;

  return {
    title: reportTitle,
    executiveSummary,
    screeningLevel: r.riskLevel,
    sections: {
      executiveSummary,
      tenderInformation,
      procurementContext,
      participatingCompanies,
      bidAnalysis,
      statisticalIndicators,
      evidence: evidenceText,
      historicalPatterns,
      networkObservations,
      dataQualityAndLimitations,
      areasForFurtherReview,
      methodology,
      disclaimer: context.methodology.disclaimer,
    },
    evidenceSnapshot,
    provider,
    model,
    promptVersion: "investigation_report_v1.0",
    generatedAt: new Date().toISOString(),
    disclaimer: context.methodology.disclaimer,
  };
}
