import { AIProvider, EvidenceContext, InvestigationSummaryResult, InvestigationReportResult, InvestigationChatResult } from "../types.js";
import { generateFallbackSummary, generateFallbackReport, sanitizeUserInput, validateAIOutputText } from "../validator.js";

export class MockAIProvider implements AIProvider {
  name = "mock";
  model = "mock-grounded-v1";

  async generateInvestigationSummary(context: EvidenceContext): Promise<InvestigationSummaryResult> {
    const summary = generateFallbackSummary(context, this.name, this.model);
    
    // Ensure structured summary adheres strictly to schema & safety checks
    const val = validateAIOutputText(summary.overview);
    if (!val.valid) {
      throw new Error(`Mock AI output validation failed: ${val.reason}`);
    }

    return summary;
  }

  async generateInvestigationReport(context: EvidenceContext): Promise<InvestigationReportResult> {
    const report = generateFallbackReport(context, this.name, this.model);

    const val = validateAIOutputText(report.executiveSummary);
    if (!val.valid) {
      throw new Error(`Mock AI report validation failed: ${val.reason}`);
    }

    return report;
  }

  async answerEvidenceQuestion(context: EvidenceContext, question: string): Promise<InvestigationChatResult> {
    const cleanQ = sanitizeUserInput(question);
    const qLower = cleanQ.toLowerCase();
    const tender = context.tender;
    const risk = context.risk;
    const evList = context.evidence || [];

    const lang = context.language || "en";
    const isTamil = lang === "ta";
    const isHindi = lang === "hi";
    let answer = "";
    let sources: Array<{ evidenceId?: string; indicator?: string; description: string }> = [];

    if (qLower.includes("collud") || qLower.includes("fraud") || qLower.includes("guilty") || qLower.includes("cartel")) {
      answer = isHindi
        ? "उपलब्ध BidShield स्क्रीनिंग डेटा में सांख्यिकीय संकेतक हैं जो अतिरिक्त समीक्षा की आवश्यकता दर्शा सकते हैं, लेकिन स्क्रीनिंग परिणाम मिलीभगत, धोखाधड़ी या कानूनी दायित्व स्थापित नहीं करते। सभी निष्कर्ष वस्तुनिष्ठ सांख्यिकीय पैटर्न को दर्शाते हैं।"
        : isTamil
        ? "கிடைக்கக்கூடிய BidShield திரையிடல் தரவு கூடுதல் ஆய்வுக்குரிய புள்ளியியல் குறிகாட்டிகளைக் கொண்டுள்ளது, ஆனால் திரையிடல் முடிவுகள் கூட்டு சதி, மோசடி அல்லது சட்டப் பொறுப்பை உறுதிப்படுத்தாது. அனைத்து கண்டுபிடிப்புகளும் புறநிலை புள்ளியியல் வடிவங்களை மட்டுமே பிரதிபலிக்கின்றன."
        : "The available BidShield screening data contains statistical indicators that may warrant further review, but the screening results do not establish collusion, fraud, or legal liability. All findings reflect objective statistical patterns.";
      sources = evList.map(e => ({
        evidenceId: String(e.id),
        indicator: e.indicatorType,
        description: e.description,
      }));
    } else if (qLower.includes("flag") || qLower.includes("why")) {
      answer = isHindi
        ? `निविदा ${tender.tenderNumber} को समग्र स्क्रीनिंग स्तर "${risk.riskLevel}" (स्कोर: ${risk.overallScore ?? 'N/A'}/100) के साथ चिह्नित किया गया। इस स्कोर को प्रभावित करने वाले प्रमुख संकेतक मूल्य समूहन (${risk.priceClusterScore ?? 'N/A'}) और कवर बिडिंग (${risk.coverBidScore ?? 'N/A'}) हैं।`
        : isTamil
        ? `டெண்டர் ${tender.tenderNumber} ஒட்டுமொத்த திரையிடல் நிலை "${risk.riskLevel}" (மதிப்பெண்: ${risk.overallScore ?? 'N/A'}/100) உடன் கொடியிடப்பட்டது. இந்த மதிப்பெண்ணை இயக்கிய முதன்மை குறிகாட்டிகள் விலை தொகுப்பு (${risk.priceClusterScore ?? 'N/A'}) மற்றும் போலி ஏலம் (${risk.coverBidScore ?? 'N/A'}) ஆகும்.`
        : `Tender ${tender.tenderNumber} was flagged with an overall screening level of "${risk.riskLevel}" (Score: ${risk.overallScore ?? 'N/A'}/100). The primary indicators driving this score were Price Clustering (${risk.priceClusterScore ?? 'N/A'}) and Cover Bidding (${risk.coverBidScore ?? 'N/A'}).`;
      sources = evList.slice(0, 2).map(e => ({
        evidenceId: String(e.id),
        indicator: e.indicatorType,
        description: isHindi
          ? `${e.description} (देखा गया मान: ${e.observedValue || 'N/A'})`
          : isTamil
          ? `${e.description} (கண்டறியப்பட்ட அளவீடு: ${e.observedValue || 'N/A'})`
          : `${e.description} (Observed metric: ${e.observedValue || 'N/A'})`,
      }));
    } else if (qLower.includes("price") || qLower.includes("cluster")) {
      const pcEv = evList.find(e => e.indicatorType === "PRICE_CLUSTERING") || evList[0];
      answer = isHindi
        ? `BidShield के मूल्य समूहन विश्लेषण ने पात्र बोलियों में 2.1% सापेक्ष बोली प्रसार दर्ज किया है। यह संकीर्ण मूल्य वितरण प्रतिस्पर्धी वित्तीय बोलियों के बीच उच्च निकटता को इंगित करता है।`
        : isTamil
        ? `BidShield இன் விலை தொகுப்பு பகுப்பாய்வு தகுதியான ஏலங்களில் 2.1% ஒப்பீட்டு ஏல பரவலைப் பதிவு செய்துள்ளது. இந்த குறுகிய விலை விநியோகம் போட்டி நிதி ஏலங்களுக்கிடையேயான அதிக நெருக்கத்தைக் குறிக்கிறது.`
        : `BidShield's price-clustering analysis recorded a relative bid spread of 2.1% across eligible bids. This narrow price distribution indicates high closeness between competing financial bids.`;
      if (pcEv) {
        sources.push({
          evidenceId: String(pcEv.id),
          indicator: pcEv.indicatorType,
          description: pcEv.description,
        });
      }
    } else if (qLower.includes("limitation") || qLower.includes("sample")) {
      answer = isHindi
        ? `निविदा ${tender.tenderNumber} के लिए विश्लेषण ${context.bids.length} प्रस्तुत बोलियों और ${context.network.connectedPairs.length > 0 ? '7' : 'उपलब्ध'} निविदाओं में ऐतिहासिक तुलनाओं पर आधारित है। सीमाओं में नमूना आकार की सीमा और ऑफ़लाइन प्रोक्योरमेंट फ़ाइल तक पहुँच का अभाव शामिल है।`
        : isTamil
        ? `டெண்டர் ${tender.tenderNumber} க்கான பகுப்பாய்வு ${context.bids.length} சமர்ப்பிக்கப்பட்ட ஏலங்கள் மற்றும் ${context.network.connectedPairs.length > 0 ? '7' : 'கிடைக்கக்கூடிய'} டெண்டர்களில் வரலாற்று ஒப்பீடுகளை அடிப்படையாகக் கொண்டது. வரம்புகளில் மாதிரி அளவு மற்றும் ஆஃப்லைன் கொள்முதல் கோப்பு அணுகல் இல்லாமை ஆகியவை அடங்கும்.`
        : `The analysis for tender ${tender.tenderNumber} is based on ${context.bids.length} submitted bids and historical comparisons across ${context.network.connectedPairs.length > 0 ? '7' : 'available'} tenders. Limitations include sample size boundaries and lack of offline procurement file access.`;
    } else if (qLower.includes("score") || qLower.includes("explain")) {
      answer = isHindi
        ? `समग्र स्क्रीनिंग स्कोर ${risk.overallScore ?? 'N/A'}/100 पाँच सांख्यिकीय संकेतकों के संयुक्त भारित संश्लेषण को दर्शाता है: विजेता चक्रण (${risk.rotationScore ?? 'N/A'}), कवर बिड (${risk.coverBidScore ?? 'N/A'}), मूल्य समूहन (${risk.priceClusterScore ?? 'N/A'}), भागीदारी नेटवर्क (${risk.networkScore ?? 'N/A'}), और असामान्य स्थिर हारी बोली (${risk.neatLossScore ?? 'N/A'})।`
        : isTamil
        ? `ஒட்டுமொத்த திரையிடல் மதிப்பெண் ${risk.overallScore ?? 'N/A'}/100 என்பது 5 புள்ளியியல் குறிகாட்டிகளின் ஒருங்கிணைந்த எடையிடப்பட்ட தொகுப்பைப் பிரதிபலிக்கிறது: வெற்றி சுழற்சி (${risk.rotationScore ?? 'N/A'}), போலி ஏலம் (${risk.coverBidScore ?? 'N/A'}), விலை தொகுப்பு (${risk.priceClusterScore ?? 'N/A'}), பங்கேற்பு நெட்வொர்க் (${risk.networkScore ?? 'N/A'}), மற்றும் மிக நேர்த்தியான தோற்ற ஏலம் (${risk.neatLossScore ?? 'N/A'}).`
        : `The overall screening score of ${risk.overallScore ?? 'N/A'}/100 reflects a combined weighted synthesis of 5 statistical indicators: Winner Rotation (${risk.rotationScore ?? 'N/A'}), Cover Bids (${risk.coverBidScore ?? 'N/A'}), Price Clustering (${risk.priceClusterScore ?? 'N/A'}), Participation Network (${risk.networkScore ?? 'N/A'}), and Too-Neat Losses (${risk.neatLossScore ?? 'N/A'}).`;
    } else {
      answer = isHindi
        ? `निविदा ${tender.tenderNumber} के लिए BidShield के रिकॉर्ड के अनुसार, ${context.bids.length} बोलियों का मूल्यांकन किया गया। समग्र स्क्रीनिंग स्कोर: ${risk.overallScore ?? 'N/A'}/100 (${risk.riskLevel})। विस्तृत निरीक्षण हेतु कार्यक्षेत्र में ${evList.length} साक्ष्य रिकॉर्ड उपलब्ध हैं।`
        : isTamil
        ? `டெண்டர் ${tender.tenderNumber} க்கான BidShield பதிவுகளின்படி, ${context.bids.length} ஏலங்கள் மதிப்பீடு செய்யப்பட்டன. ஒட்டுமொத்த திரையிடல் மதிப்பெண்: ${risk.overallScore ?? 'N/A'}/100 (${risk.riskLevel}). விரிவான ஆய்வுக்கு பணியிடத்தில் ${evList.length} ஆதாரப் பதிவுகள் கிடைக்கின்றன.`
        : `Based on BidShield's records for tender ${tender.tenderNumber}, ${context.bids.length} bids were evaluated. Overall screening score: ${risk.overallScore ?? 'N/A'}/100 (${risk.riskLevel}). Supporting evidence records (${evList.length}) are available for detailed inspection in the workspace.`;
      sources = evList.slice(0, 3).map(e => ({
        evidenceId: String(e.id),
        indicator: e.indicatorType,
        description: e.description,
      }));
    }

    const val = validateAIOutputText(answer);
    if (!val.valid) {
      answer = "The available BidShield screening data contains statistical indicators that may warrant further review, but the screening results do not establish collusion, fraud, or legal liability.";
    }

    return {
      answer,
      sources,
      disclaimer: context.methodology.disclaimer,
      provider: this.name,
      model: this.model,
      promptVersion: "investigation_chat_v1.0",
    };
  }
}
