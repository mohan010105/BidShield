import { describe, it } from 'node:test';
import assert from 'node:assert';
import { generateFallbackSummary, generateFallbackReport, validateAIOutputText } from '../../ai/validator.js';
import { MockAIProvider } from '../../ai/providers/mockProvider.js';
import { EvidenceContext } from '../../ai/types.js';

describe('Phase 13: Hindi Language Support (i18n) & Grounded AI', () => {
  const mockContext: EvidenceContext = {
    tender: {
      id: 1,
      tenderNumber: 'TN-2025-001',
      title: 'Road Construction & Highway Overlay',
      department: 'Highways Dept',
      organization: 'Tamil Nadu Road Development Corp',
      category: 'Civil Works',
      location: 'Chennai, Tamil Nadu',
      estimatedValue: 10000000,
      contractValue: 9800000,
      winnerName: 'ABC Infrastructure Pvt Ltd',
      winnerId: 101,
      tenderDate: '2025-01-15',
      status: 'AWARDED',
    },
    risk: {
      overallScore: 78,
      riskLevel: 'ELEVATED SCREENING SIGNAL',
      overallStatus: 'ELEVATED',
      rotationScore: 65,
      coverBidScore: 82,
      priceClusterScore: 74,
      networkScore: 50,
      neatLossScore: 70,
    },
    indicators: [
      {
        type: 'PRICE_CLUSTERING',
        score: 74,
        status: 'ELEVATED',
        summary: 'Bids clustered within 2.1% spread',
      },
      {
        type: 'COVER_BID',
        score: 82,
        status: 'ELEVATED',
        summary: 'Two bids submitted with matching boilerplate text',
      },
    ],
    evidence: [
      {
        id: '101',
        indicatorType: 'PRICE_CLUSTERING',
        description: 'Tight bid cluster detected across 4 bidders',
        metric: 'cv_spread',
        observedValue: '0.021',
        expectedValue: '0.085',
        severity: 'ELEVATED',
      },
    ],
    bids: [
      {
        id: 1,
        companyId: 101,
        companyName: 'ABC Infrastructure Pvt Ltd',
        bidAmount: 9800000,
        bidRank: 1,
        isWinner: true,
      },
      {
        id: 2,
        companyId: 102,
        companyName: 'XYZ Builders India Ltd',
        bidAmount: 9950000,
        bidRank: 2,
        isWinner: false,
      },
    ],
    companies: [
      { id: 101, name: 'ABC Infrastructure Pvt Ltd' },
      { id: 102, name: 'XYZ Builders India Ltd' },
    ],
    network: {
      connectedPairs: [
        { companyA: 'ABC Infrastructure Pvt Ltd', companyB: 'XYZ Builders India Ltd', sharedCount: 4, score: 75 },
      ],
    },
    methodology: {
      version: 'neat_losing_bid_v1.0',
      disclaimer: 'सांख्यिकीय स्क्रीनिंग अतिरिक्त समीक्षा योग्य पैटर्न की पहचान करती है, लेकिन कानूनी दायित्व या मिलीभगत स्थापित नहीं करती।',
    },
    investigationNotes: [],
    language: 'hi',
  };

  it('should generate Hindi summary overview while strictly preserving IDs, company names, and numbers', () => {
    const summary = generateFallbackSummary(mockContext);

    // Verify Hindi wording
    assert.match(summary.overview, /जाँच सारांश/);
    assert.match(summary.overview, /समग्र स्क्रीनिंग संकेत/);

    // Verify entity IDs, company names, and numbers remain completely intact
    assert.match(summary.overview, /TN-2025-001/);
    assert.match(summary.overview, /Tamil Nadu Road Development Corp/);
    assert.strictEqual(summary.screeningScore, 78);
    assert.strictEqual(summary.screeningLevel, 'ELEVATED SCREENING SIGNAL');

    // Verify key observations localized
    const pcObs = summary.keyObservations.find(o => o.includes('मूल्य समूहन'));
    assert.ok(pcObs, 'Should contain localized Price Clustering indicator in Hindi');

    // Verify limitations in Hindi
    assert.ok(summary.dataLimitations.some(l => l.includes('विश्लेषण निविदा TN-2025-001')));
  });

  it('should generate Hindi 13-section report draft preserving technical formulas and numbers', () => {
    const report = generateFallbackReport(mockContext);

    assert.strictEqual(report.title, 'AI-सहायता प्राप्त जाँच ड्राफ़्ट — निविदा TN-2025-001');
    assert.match(report.executiveSummary, /यह AI-सहायता प्राप्त ड्राफ़्ट रिपोर्ट/);
    assert.match(report.executiveSummary, /TN-2025-001/);
    assert.match(report.executiveSummary, /Tamil Nadu Road Development Corp/);

    // Legal company names preserved without machine translation
    assert.match(report.sections.bidAnalysis, /ABC Infrastructure Pvt Ltd/);
    assert.match(report.sections.bidAnalysis, /XYZ Builders India Ltd/);

    // Check methodology version preserved
    assert.match(report.sections.methodology, /neat_losing_bid_v1\.0/);

    // Check disclaimer preserved
    assert.strictEqual(report.disclaimer, mockContext.methodology.disclaimer);
  });

  it('should answer questions in Hindi via MockAIProvider when language is hi', async () => {
    const provider = new MockAIProvider();
    const result = await provider.answerEvidenceQuestion(mockContext, 'Why was this tender flagged?');

    assert.ok(result.answer.includes('निविदा TN-2025-001'));
    assert.ok(result.answer.includes('चिह्नित किया गया'));
    assert.ok(result.answer.includes('मूल्य समूहन'));
    assert.strictEqual(result.sources.length, 1);
    assert.strictEqual(result.sources[0].evidenceId, '101');
  });

  it('should answer legal questions safely in Hindi without admitting prohibited accusations', async () => {
    const provider = new MockAIProvider();
    const result = await provider.answerEvidenceQuestion(mockContext, 'Is this cartel fraud?');

    assert.ok(result.answer.includes('सांख्यिकीय संकेतक'));
    assert.ok(result.answer.includes('मिलीभगत'));
    assert.strictEqual(validateAIOutputText(result.answer).valid, true);
  });
});
