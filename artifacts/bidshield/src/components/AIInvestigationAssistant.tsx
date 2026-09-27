import React, { useState, useEffect } from 'react';
import { useTranslation } from '../i18n';
import {
  Sparkles,
  FileText,
  MessageSquare,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Edit3,
  Download,
  Send,
  HelpCircle,
  ExternalLink,
  Clock,
  ShieldAlert,
  X,
  Check,
  Eye,
  Info
} from 'lucide-react';

interface AIInvestigationAssistantProps {
  investigationId: number;
  tenderNumber: string;
}

interface SummaryData {
  overview: string;
  screeningLevel: string;
  screeningScore: number | null;
  keyObservations: string[];
  supportingEvidence: Array<{
    evidenceId: string;
    indicator: string;
    summary: string;
  }>;
  dataLimitations: string[];
  recommendedReviewActions: string[];
  disclaimer: string;
  provider: string;
  model: string;
  promptVersion: string;
  evidenceSnapshot: string[];
}

interface ReportData {
  title: string;
  executiveSummary: string;
  screeningLevel: string;
  sections: {
    executiveSummary: string;
    tenderInformation: string;
    procurementContext: string;
    participatingCompanies: string;
    bidAnalysis: string;
    statisticalIndicators: string;
    evidence: string;
    historicalPatterns: string;
    networkObservations: string;
    dataQualityAndLimitations: string;
    areasForFurtherReview: string;
    methodology: string;
    disclaimer: string;
  };
  evidenceSnapshot: string[];
  provider: string;
  model: string;
  promptVersion: string;
  generatedAt: string;
  disclaimer: string;
}

interface ChatMessage {
  sender: 'user' | 'ai';
  text: string;
  sources?: Array<{ evidenceId?: string; indicator?: string; description: string }>;
  timestamp: string;
}

export const AIInvestigationAssistant: React.FC<AIInvestigationAssistantProps> = ({
  investigationId,
  tenderNumber,
}) => {
  const { t, language, locale } = useTranslation();
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [report, setReport] = useState<ReportData | null>(null);
  const [reportId, setReportId] = useState<number | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const aiUnavailableMsg = language === 'hi'
    ? 'AI सहायता अस्थायी रूप से अनुपलब्ध है। अंतर्निहित सांख्यिकीय स्क्रीनिंग और साक्ष्य उपलब्ध हैं।'
    : language === 'ta'
    ? 'AI உதவி தற்காலிகமாக கிடைக்கவில்லை. புள்ளிவிவர ஆதாரங்கள் தொடர்ந்து கிடைக்கின்றன.'
    : 'AI assistance is temporarily unavailable. The underlying statistical screening and evidence remain available.';

  // Report Modal state
  const [showReportModal, setShowReportModal] = useState(false);
  const [reviewStatus, setReviewStatus] = useState<'DRAFT' | 'REVIEWED' | 'APPROVED' | 'REJECTED'>('DRAFT');
  const [isEditingReport, setIsEditingReport] = useState(false);
  const [editedExecSummary, setEditedExecSummary] = useState('');
  const [isStale, setIsStale] = useState(false);

  // Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [showSourcesForMsg, setShowSourcesForMsg] = useState<number | null>(null);

  // Fetch saved reports on mount
  useEffect(() => {
    fetchSavedReports();
  }, [investigationId]);

  const fetchSavedReports = async () => {
    try {
      const res = await fetch(`/api/ai/investigations/${investigationId}/reports`, {
        headers: {
          'x-user-id': 'investigator_1',
          'x-user-name': 'Senior Investigator',
        },
      });
      if (res.ok) {
        const json = await res.json();
        const payload = json.data || json;
        const reports = payload.reports || [];
        if (reports.length > 0) {
          const latest = reports[0];
          setReviewStatus(latest.status || 'DRAFT');
          setIsStale(latest.isStale || false);
          setReportId(latest.id);
          if (latest.generatedContent) {
            try {
              const parsed = JSON.parse(latest.generatedContent);
              if (latest.reportType === 'FULL_REPORT') {
                setReport(parsed);
              } else {
                setSummary(parsed);
              }
            } catch (e) {
              // ignore json parse error
            }
          }
        }
      }
    } catch (e) {
      // ignore
    }
  };

  const handleGenerateSummary = async () => {
    setLoadingSummary(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/ai/investigations/${investigationId}/summary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': 'investigator_1',
          'x-user-name': 'Senior Investigator',
        },
        body: JSON.stringify({ language }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error?.message || errData.message || 'AI service error');
      }
      const json = await res.json();
      setSummary(json.data || json);
    } catch (err: any) {
      setErrorMsg(err.message || aiUnavailableMsg);
    } finally {
      setLoadingSummary(false);
    }
  };

  const handleGenerateReport = async () => {
    setLoadingReport(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/ai/investigations/${investigationId}/report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': 'investigator_1',
          'x-user-name': 'Senior Investigator',
        },
        body: JSON.stringify({ language }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error?.message || errData.message || 'AI service error');
      }
      const json = await res.json();
      const payload = json.data || json;
      setReport(payload.report);
      if (payload.reportId) setReportId(payload.reportId);
      setEditedExecSummary(payload.report.executiveSummary);
      setShowReportModal(true);
      setIsStale(false);
    } catch (err: any) {
      setErrorMsg(err.message || aiUnavailableMsg);
    } finally {
      setLoadingReport(false);
    }
  };

  const handleSendChat = async (questionText?: string) => {
    const q = questionText || chatInput;
    if (!q.trim()) return;

    const userMsg: ChatMessage = {
      sender: 'user',
      text: q,
      timestamp: new Date().toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    if (!questionText) setChatInput('');
    setChatLoading(true);

    try {
      const res = await fetch(`/api/ai/investigations/${investigationId}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': 'investigator_1',
          'x-user-name': 'Senior Investigator',
        },
        body: JSON.stringify({ question: q, language }),
      });

      if (!res.ok) {
        throw new Error('Chat service unavailable');
      }

      const json = await res.json();
      const chatData = json.data || json;
      const aiMsg: ChatMessage = {
        sender: 'ai',
        text: chatData.answer,
        sources: chatData.sources,
        timestamp: new Date().toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }),
      };
      setChatMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      const errorMsgObj: ChatMessage = {
        sender: 'ai',
        text: aiUnavailableMsg,
        timestamp: new Date().toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }),
      };
      setChatMessages((prev) => [...prev, errorMsgObj]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleUpdateStatus = async (newStatus: 'DRAFT' | 'REVIEWED' | 'APPROVED' | 'REJECTED') => {
    setReviewStatus(newStatus);
    if (!reportId) return;
    try {
      await fetch(`/api/ai/investigations/${investigationId}/reports/${reportId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': 'investigator_1',
          'x-user-name': 'Senior Investigator',
        },
        body: JSON.stringify({ status: newStatus }),
      });
    } catch (e) {
      // ignore
    }
  };

  const handleSaveHumanEdit = async () => {
    if (!report) return;
    setIsEditingReport(false);
    const updatedReport = {
      ...report,
      executiveSummary: editedExecSummary,
      sections: {
        ...report.sections,
        executiveSummary: editedExecSummary,
      },
    };
    setReport(updatedReport);

    if (reportId) {
      try {
        await fetch(`/api/ai/investigations/${investigationId}/reports/${reportId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': 'investigator_1',
            'x-user-name': 'Senior Investigator',
          },
          body: JSON.stringify({
            status: reviewStatus,
            humanEditedContent: JSON.stringify(updatedReport),
          }),
        });
      } catch (e) {
        // ignore
      }
    }
  };

  const handleExportPDF = () => {
    window.open(`/api/investigations/${investigationId}/export?format=html&lang=${language}`, '_blank');
  };

  return (
    <div className="space-y-6 bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-xl shadow-2xl">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
            <Sparkles className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-bold text-slate-100">{t('ai.title')}</h3>
              <span className="px-2.5 py-0.5 text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full">
                {t('ai.assistantBadge')}
              </span>
            </div>
            <p className="text-sm text-slate-400">
              {language === 'hi'
                ? 'BidShield विश्लेषणात्मक डेटा पर आधारित साक्ष्य-आधारित ड्राफ़्ट, संरचित रिपोर्ट पैकेज तैयार करें और प्रश्न पूछें।'
                : language === 'ta'
                ? 'BidShield பகுப்பாய்வுத் தரவுகளின் அடிப்படையில் ஆதார அடிப்படையிலான வரைவுகள், அறிக்கைகள் மற்றும் விளக்கங்களைப் பெறுங்கள்.'
                : 'Generate evidence-based drafts, structured report packages, and ask questions grounded strictly in BidShield data.'}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleGenerateSummary}
            disabled={loadingSummary}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50"
          >
            {loadingSummary ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {t('ai.generateSummary')}
          </button>

          <button
            onClick={handleGenerateReport}
            disabled={loadingReport}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50"
          >
            {loadingReport ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            {t('ai.generateReport')}
          </button>

          {report && (
            <button
              onClick={() => setShowReportModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-sm font-medium transition-all"
            >
              <Eye className="w-4 h-4" />
              {language === 'hi' ? 'रिपोर्ट पूर्वावलोकन' : language === 'ta' ? 'அறிக்கை முன்னோட்டம்' : 'View Report Preview'}
            </button>
          )}
        </div>
      </div>

      {/* Error & Retry Alert */}
      {errorMsg && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-sm flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            onClick={handleGenerateSummary}
            className="px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 rounded-lg text-xs font-semibold transition"
          >
            {language === 'hi' ? 'पुनः प्रयास करें' : language === 'ta' ? 'மீண்டும் முயற்சி' : 'Retry'}
          </button>
        </div>
      )}

      {/* Stale Evidence Banner */}
      {isStale && (
        <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-300 text-sm flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 shrink-0 text-purple-400" />
            <span>
              {language === 'hi'
                ? 'इस रिपोर्ट के तैयार होने के बाद अंतर्निहित साक्ष्य बदल गए। ड्राफ़्ट को अपडेट करने के लिए पुनः जनरेट करें।'
                : language === 'ta'
                ? 'இந்த அறிக்கை உருவாக்கப்பட்ட பிறகு ஆதாரங்கள் மாறியுள்ளன. புதிய வரைவை உருவாக்கவும்.'
                : 'Analytics have changed since this draft was generated. Please regenerate to reflect the latest statistical evidence.'}
            </span>
          </div>
          <button
            onClick={handleGenerateSummary}
            className="px-3 py-1 bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 rounded-lg text-xs font-semibold transition"
          >
            {t('ai.regenerate')}
          </button>
        </div>
      )}

      {/* 2-Column AI Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Structured Summary */}
        <div className="lg:col-span-7 bg-slate-950/70 border border-slate-800/80 rounded-xl p-5">
          {summary ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {language === 'hi' ? 'AI-उत्पन्न सारांश ड्राफ़्ट' : language === 'ta' ? 'AI-உருவாக்கிய சுருக்க வரைவு' : 'AI-Generated Summary Draft'}
                </span>
                <span className="text-xs text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                  Model: {summary.model} ({summary.promptVersion})
                </span>
              </div>

              {/* Overview */}
              <div>
                <h4 className="text-sm font-semibold text-slate-200 mb-1">{t('ai.executiveOverview')}</h4>
                <p className="text-sm text-slate-300 leading-relaxed bg-slate-900/40 p-3 rounded-lg border border-slate-800/50">
                  {summary.overview}
                </p>
              </div>

              {/* Key Observations */}
              <div>
                <h4 className="text-sm font-semibold text-slate-200 mb-2">{t('ai.keyObservations')}</h4>
                <ul className="space-y-1.5">
                  {summary.keyObservations.map((obs, idx) => (
                    <li key={idx} className="text-xs text-slate-300 flex items-start gap-2 bg-slate-900/30 p-2 rounded border border-slate-800/40">
                      <span className="text-indigo-400 font-bold">•</span>
                      <span>{obs}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Supporting Evidence List */}
              {summary.supportingEvidence.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-200 mb-2">{t('ai.supportingEvidence')}</h4>
                  <div className="grid grid-cols-1 gap-2">
                    {summary.supportingEvidence.map((ev, idx) => (
                      <div key={idx} className="p-2.5 bg-slate-900/60 border border-slate-800 rounded-lg flex items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold text-indigo-400">{ev.evidenceId}</span>
                            <span className="text-xs font-semibold text-slate-300">{ev.indicator}</span>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">{ev.summary}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Data Limitations */}
              <div>
                <h4 className="text-sm font-semibold text-slate-200 mb-1">{t('ai.dataLimitations')}</h4>
                <ul className="list-disc list-inside text-xs text-slate-400 space-y-1">
                  {summary.dataLimitations.map((lim, idx) => (
                    <li key={idx}>{lim}</li>
                  ))}
                </ul>
              </div>

              {/* Review Considerations */}
              <div>
                <h4 className="text-sm font-semibold text-slate-200 mb-1">{t('ai.humanReviewAreas')}</h4>
                <ul className="list-disc list-inside text-xs text-slate-400 space-y-1">
                  {summary.recommendedReviewActions.map((act, idx) => (
                    <li key={idx}>{act}</li>
                  ))}
                </ul>
              </div>

              {/* Disclaimer */}
              <div className="p-3 bg-amber-500/5 border border-amber-500/15 rounded-lg text-xs text-amber-300/80 italic">
                <strong>{language === 'hi' ? 'अस्वीकरण:' : language === 'ta' ? 'பொறுப்புத் துறப்பு:' : 'Disclaimer:'}</strong> {summary.disclaimer}
              </div>
            </div>
          ) : (
            <div className="p-8 border border-dashed border-slate-800 rounded-xl text-center space-y-3 bg-slate-950/30">
              <Sparkles className="w-8 h-8 text-indigo-400/50 mx-auto" />
              <h4 className="text-sm font-medium text-slate-300">{language === 'hi' ? 'अभी तक कोई सारांश तैयार नहीं हुआ' : language === 'ta' ? 'சுருக்கம் இன்னும் உருவாக்கப்படவில்லை' : 'No Summary Generated Yet'}</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {language === 'hi'
                  ? 'BidShield एनालिटिक्स के आधार पर संरचित, साक्ष्य-आधारित जाँच अवलोकन तैयार करने के लिए "सारांश उत्पन्न करें" पर क्लिक करें।'
                  : language === 'ta'
                  ? 'BidShield புள்ளிவிவரங்களின் அடிப்படையில் ஆதார அடிப்படையிலான மேலோட்டத்தைப் பெற "சுருக்கம் உருவாக்கு" என்பதைக் கிளிக் செய்யவும்.'
                  : 'Click "Generate Summary" to produce a structured, evidence-grounded investigation overview based strictly on BidShield analytics.'}
              </p>
              <button
                onClick={handleGenerateSummary}
                disabled={loadingSummary}
                className="px-4 py-2 bg-indigo-600/80 hover:bg-indigo-600 text-white rounded-xl text-xs font-medium transition"
              >
                {loadingSummary ? (language === 'hi' ? 'उत्पन्न हो रहा है...' : language === 'ta' ? 'உருவாகிறது...' : 'Generating...') : t('ai.generateSummary')}
              </button>
            </div>
          )}
        </div>

        {/* Right Column: Interactive Evidence Assistant Chat */}
        <div className="lg:col-span-5 bg-slate-950/70 border border-slate-800/80 rounded-xl p-5 flex flex-col h-[520px]">
          <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3 mb-3">
            <MessageSquare className="w-4 h-4 text-indigo-400" />
            <h4 className="text-sm font-semibold text-slate-200">{t('ai.askQuestion')}</h4>
          </div>

          {/* Quick Preset Question Chips */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {[
              { text: t('ai.promptWhyFlagged'), query: 'Why was this tender flagged?' },
              { text: t('ai.promptIndicators'), query: 'Which indicators contributed most?' },
              { text: t('ai.promptPriceClustering'), query: 'Show evidence for price clustering' },
              { text: t('ai.promptLimitations'), query: 'What are the limitations?' },
            ].map((item, idx) => (
              <button
                key={idx}
                onClick={() => handleSendChat(item.text)}
                disabled={chatLoading}
                className="px-2.5 py-1 text-[11px] bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-full transition text-left"
              >
                {item.text}
              </button>
            ))}
          </div>

          {/* Chat Messages Feed */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
            {chatMessages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-500 text-center p-4">
                <div>
                  <HelpCircle className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p>{language === 'hi' ? 'वर्तमान निविदा स्क्रीनिंग रिकॉर्ड के आधार पर प्रश्न पूछें।' : language === 'ta' ? 'தற்போதைய டெண்டர் திரையிடல் பதிவுகளின் அடிப்படையில் கேள்விகளைக் கேளுங்கள்.' : 'Ask questions grounded in the current tender screening records.'}</p>
                </div>
              </div>
            ) : (
              chatMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] p-3 rounded-xl leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-indigo-600 text-white rounded-br-none'
                        : 'bg-slate-900 text-slate-200 border border-slate-800 rounded-bl-none'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.text}</p>

                    {/* Sources Badge */}
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-slate-800/80">
                        <button
                          onClick={() => setShowSourcesForMsg(showSourcesForMsg === idx ? null : idx)}
                          className="text-[10px] font-medium text-indigo-400 hover:underline flex items-center gap-1"
                        >
                          <Info className="w-3 h-3" />
                          {msg.sources.length} {t('ai.evidenceSourcesCited')}
                        </button>
                        {showSourcesForMsg === idx && (
                          <div className="mt-1 space-y-1 bg-slate-950/80 p-2 rounded border border-slate-800">
                            {msg.sources.map((src, sIdx) => (
                              <div key={sIdx} className="text-[10px] text-slate-300">
                                <span className="font-mono text-indigo-300 font-bold">{src.evidenceId || 'EV'}</span> — {src.description}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <span className="text-[9px] text-slate-500 mt-1 px-1">{msg.timestamp}</span>
                </div>
              ))
            )}
            {chatLoading && (
              <div className="flex items-center gap-2 text-slate-400 text-xs italic">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                {language === 'ta' ? 'ஆதாரங்கள் மீட்டெடுக்கப்படுகின்றன...' : language === 'hi' ? 'साक्ष्य प्राप्त किए जा रहे हैं...' : 'Retrieving grounded evidence...'}
              </div>
            )}
          </div>

          {/* Chat Input Field */}
          <div className="mt-3 pt-3 border-t border-slate-800/80 flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
              placeholder={t('ai.askPlaceholder')}
              className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition"
            />
            <button
              onClick={() => handleSendChat()}
              disabled={chatLoading || !chatInput.trim()}
              className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition disabled:opacity-40"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* FULL REPORT PREVIEW & HUMAN REVIEW MODAL */}
      {showReportModal && report && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="w-6 h-6 text-indigo-400" />
                <div>
                  <h3 className="text-lg font-bold text-slate-100">{report.title}</h3>
                  <span className="text-xs text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 font-medium">
                    {language === 'ta' ? 'AI-உதவி புலனாய்வு வரைவு' : language === 'hi' ? 'AI-सहायक जाँच ड्राफ़्ट' : 'AI-Assisted Investigation Draft'}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowReportModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Human Review Status Toolbar */}
            <div className="px-6 py-3 bg-slate-950/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-medium">
                  {language === 'ta' ? 'மனித மதிப்பாய்வு நிலை:' : language === 'hi' ? 'मानव समीक्षा स्थिति:' : 'Human Review Status:'}
                </span>
                <select
                  value={reviewStatus}
                  onChange={(e) => handleUpdateStatus(e.target.value as any)}
                  className="bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-2.5 py-1 font-semibold focus:outline-none"
                >
                  <option value="DRAFT">{language === 'ta' ? 'வரைவு (DRAFT)' : language === 'hi' ? 'ड्राफ़्ट (DRAFT)' : 'DRAFT'}</option>
                  <option value="REVIEWED">{language === 'ta' ? 'மறுபரிசீலிக்கப்பட்டது (REVIEWED)' : language === 'hi' ? 'समीक्षित (REVIEWED)' : 'REVIEWED'}</option>
                  <option value="APPROVED">{language === 'ta' ? 'ஒப்புதல் அளிக்கப்பட்டது (APPROVED)' : language === 'hi' ? 'स्वीकृत (APPROVED)' : 'APPROVED'}</option>
                  <option value="REJECTED">{language === 'ta' ? 'நிராகரிக்கப்பட்டது (REJECTED)' : language === 'hi' ? 'अस्वीकृत (REJECTED)' : 'REJECTED'}</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                {isEditingReport ? (
                  <button
                    onClick={handleSaveHumanEdit}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold transition"
                  >
                    <Check className="w-4 h-4" /> {language === 'ta' ? 'திருத்தத்தைச் சேமி' : language === 'hi' ? 'संपादित ड्राफ़्ट सहेजें' : 'Save Edit'}
                  </button>
                ) : (
                  <button
                    onClick={() => setIsEditingReport(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg font-semibold transition"
                  >
                    <Edit3 className="w-4 h-4" /> {language === 'ta' ? 'வரைவைத் திருத்து' : language === 'hi' ? 'ड्राफ़्ट संपादित करें' : 'Edit Draft'}
                  </button>
                )}

                <button
                  onClick={handleExportPDF}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold transition"
                >
                  <Download className="w-4 h-4" /> {language === 'ta' ? 'அறிக்கையை ஏற்றுமதி செய் (PDF)' : language === 'hi' ? 'रिपोर्ट निर्यात करें (PDF)' : 'Export Report (PDF)'}
                </button>
              </div>
            </div>

            {/* Modal Body: Structured 13-Section Report */}
            <div className="p-6 overflow-y-auto space-y-6 text-slate-300 text-sm leading-relaxed">
              {/* Executive Summary Section */}
              <div className="space-y-2">
                <h4 className="text-base font-bold text-indigo-400 border-b border-slate-800 pb-1">
                  1. {language === 'ta' ? 'நிர்வாக சுருக்கம் (Executive Summary)' : language === 'hi' ? 'कार्यकारी सारांश (Executive Summary)' : 'Executive Summary'}
                </h4>
                {isEditingReport ? (
                  <textarea
                    value={editedExecSummary}
                    onChange={(e) => setEditedExecSummary(e.target.value)}
                    rows={4}
                    className="w-full bg-slate-950 border border-indigo-500/50 rounded-lg p-3 text-sm text-slate-100 focus:outline-none"
                  />
                ) : (
                  <p className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">{report.sections.executiveSummary}</p>
                )}
              </div>

              {/* Tender Information */}
              <div className="space-y-2">
                <h4 className="text-base font-bold text-indigo-400 border-b border-slate-800 pb-1">
                  2. {language === 'ta' ? 'டெண்டர் தகவல்கள் (Tender Information)' : language === 'hi' ? 'निविदा जानकारी (Tender Information)' : 'Tender Information'}
                </h4>
                <pre className="whitespace-pre-wrap font-sans bg-slate-950/60 p-4 rounded-xl border border-slate-800 text-slate-300">
                  {report.sections.tenderInformation}
                </pre>
              </div>

              {/* Procurement Context */}
              <div className="space-y-2">
                <h4 className="text-base font-bold text-indigo-400 border-b border-slate-800 pb-1">
                  3. {language === 'ta' ? 'கொள்முதல் சூழல் (Procurement Context)' : language === 'hi' ? 'खरीद संदर्भ (Procurement Context)' : 'Procurement Context'}
                </h4>
                <p className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">{report.sections.procurementContext}</p>
              </div>

              {/* Participating Companies */}
              <div className="space-y-2">
                <h4 className="text-base font-bold text-indigo-400 border-b border-slate-800 pb-1">
                  4. {language === 'ta' ? 'பங்கேற்கும் நிறுவனங்கள் (Participating Companies)' : language === 'hi' ? 'भागीदार कम्पनियाँ (Participating Companies)' : 'Participating Companies'}
                </h4>
                <pre className="whitespace-pre-wrap font-sans bg-slate-950/60 p-4 rounded-xl border border-slate-800 text-slate-300">
                  {report.sections.participatingCompanies}
                </pre>
              </div>

              {/* Bid Analysis */}
              <div className="space-y-2">
                <h4 className="text-base font-bold text-indigo-400 border-b border-slate-800 pb-1">
                  5. {language === 'ta' ? 'ஏல பகுப்பாய்வு & அட்டவணை (Bid Analysis & Schedule)' : language === 'hi' ? 'बोली विश्लेषण एवं अनुसूची (Bid Analysis & Schedule)' : 'Bid Analysis & Schedule'}
                </h4>
                <pre className="whitespace-pre-wrap font-sans bg-slate-950/60 p-4 rounded-xl border border-slate-800 text-slate-300">
                  {report.sections.bidAnalysis}
                </pre>
              </div>

              {/* Statistical Indicators */}
              <div className="space-y-2">
                <h4 className="text-base font-bold text-indigo-400 border-b border-slate-800 pb-1">
                  6. {language === 'ta' ? 'கண்டறியப்பட்ட புள்ளியியல் குறிகாட்டிகள் (Statistical Indicators)' : language === 'hi' ? 'प्रेक्षित सांख्यिकीय संकेतक (Statistical Indicators)' : 'Observed Statistical Indicators'}
                </h4>
                <pre className="whitespace-pre-wrap font-sans bg-slate-950/60 p-4 rounded-xl border border-slate-800 text-slate-300">
                  {report.sections.statisticalIndicators}
                </pre>
              </div>

              {/* Evidence */}
              <div className="space-y-2">
                <h4 className="text-base font-bold text-indigo-400 border-b border-slate-800 pb-1">
                  7. {language === 'ta' ? 'கணக்கிடப்பட்ட ஆதாரப் பதிவுகள் (Evidence Records)' : language === 'hi' ? 'परिकलित साक्ष्य रिकॉर्ड (Evidence Records)' : 'Calculated Evidence Records'}
                </h4>
                <pre className="whitespace-pre-wrap font-sans bg-slate-950/60 p-4 rounded-xl border border-slate-800 text-slate-300">
                  {report.sections.evidence}
                </pre>
              </div>

              {/* Historical Patterns */}
              <div className="space-y-2">
                <h4 className="text-base font-bold text-indigo-400 border-b border-slate-800 pb-1">
                  8. {language === 'ta' ? 'வரலாற்று வடிவங்கள் (Historical Patterns)' : language === 'hi' ? 'ऐतिहासिक पैटर्न (Historical Patterns)' : 'Historical Patterns'}
                </h4>
                <p className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">{report.sections.historicalPatterns}</p>
              </div>

              {/* Network Observations */}
              <div className="space-y-2">
                <h4 className="text-base font-bold text-indigo-400 border-b border-slate-800 pb-1">
                  9. {language === 'ta' ? 'நெட்வொர்க் அவதானிப்புகள் (Network Observations)' : language === 'hi' ? 'नेटवर्क अवलोकन (Network Observations)' : 'Network Observations'}
                </h4>
                <pre className="whitespace-pre-wrap font-sans bg-slate-950/60 p-4 rounded-xl border border-slate-800 text-slate-300">
                  {report.sections.networkObservations}
                </pre>
              </div>

              {/* Data Quality and Limitations */}
              <div className="space-y-2">
                <h4 className="text-base font-bold text-indigo-400 border-b border-slate-800 pb-1">
                  10. {language === 'ta' ? 'தரவு தரம் & வரம்புகள் (Data Quality & Limitations)' : language === 'hi' ? 'डेटा गुणवत्ता और सीमाएँ (Data Quality & Limitations)' : 'Data Quality & Limitations'}
                </h4>
                <pre className="whitespace-pre-wrap font-sans bg-slate-950/60 p-4 rounded-xl border border-slate-800 text-slate-300">
                  {report.sections.dataQualityAndLimitations}
                </pre>
              </div>

              {/* Areas for Further Review */}
              <div className="space-y-2">
                <h4 className="text-base font-bold text-indigo-400 border-b border-slate-800 pb-1">
                  11. {language === 'ta' ? 'கூடுதல் நிர்வாக ஆய்வுக்கான பகுதிகள் (Areas for Further Review)' : language === 'hi' ? 'आगे की प्रशासनिक समीक्षा के क्षेत्र (Areas for Further Review)' : 'Areas for Further Administrative Review'}
                </h4>
                <pre className="whitespace-pre-wrap font-sans bg-slate-950/60 p-4 rounded-xl border border-slate-800 text-slate-300">
                  {report.sections.areasForFurtherReview}
                </pre>
              </div>

              {/* Methodology */}
              <div className="space-y-2">
                <h4 className="text-base font-bold text-indigo-400 border-b border-slate-800 pb-1">
                  12. {language === 'ta' ? 'முறைமை & பகுப்பாய்வு துல்லியம் (Methodology)' : language === 'hi' ? 'पद्धति एवं विश्लेषणात्मक कठोरता (Methodology)' : 'Methodology & Analytical Rigor'}
                </h4>
                <pre className="whitespace-pre-wrap font-sans bg-slate-950/60 p-4 rounded-xl border border-slate-800 text-slate-300">
                  {report.sections.methodology}
                </pre>
              </div>

              {/* Disclaimer */}
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-xs italic">
                <strong>13. {language === 'ta' ? 'கட்டாய பொறுப்புத் துறப்பு (Mandatory Disclaimer):' : language === 'hi' ? 'अनिवार्य अस्वीकरण (Mandatory Disclaimer):' : 'Mandatory Disclaimer:'}</strong> {report.disclaimer}
              </div>

              {/* Generation Metadata */}
              <div className="pt-4 border-t border-slate-800 text-xs text-slate-500 flex flex-wrap justify-between gap-2">
                <span>Provider: {report.provider} ({report.model})</span>
                <span>Prompt Version: {report.promptVersion}</span>
                <span>Generated At: {new Date(report.generatedAt).toLocaleString()}</span>
                <span>Evidence Snapshot: {report.evidenceSnapshot.join(', ')}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
