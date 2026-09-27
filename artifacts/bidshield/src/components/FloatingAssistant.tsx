import { useState, useEffect, useRef } from 'react';
import { useLocation, Link } from 'wouter';
import {
  Sparkles,
  X,
  Send,
  Trash2,
  Copy,
  Check,
  Bot,
  User,
  ShieldAlert,
  HelpCircle,
  ExternalLink,
  ChevronDown,
  Maximize2,
  RefreshCw,
  Building2,
  FileCheck2,
  BookmarkPlus,
  ArrowUpRight,
} from 'lucide-react';
import { useTranslation } from '../i18n';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  evidence?: any[];
  timestamp: string;
}

export function FloatingAssistant() {
  const [location] = useLocation();
  const { t, language } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Determine context from current URL
  const context = (() => {
    const tenderMatch = location.match(/\/tenders\/(\d+)/);
    if (tenderMatch) return { type: 'tender', id: tenderMatch[1] };
    const companyMatch = location.match(/\/companies\/(\d+)/);
    if (companyMatch) return { type: 'company', id: companyMatch[1] };
    const invMatch = location.match(/\/investigations\/(\d+)/);
    if (invMatch) return { type: 'investigation', id: invMatch[1] };
    return { type: 'general' };
  })();

  // Do not show floating widget on the dedicated /assistant page
  if (location === '/assistant') return null;

  // Auto-scroll messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Initial welcome message if conversation is empty
  useEffect(() => {
    if (messages.length === 0) {
      const welcomeContent =
        language === 'hi'
          ? 'नमस्ते! मैं बिडशील्ड एआई अन्वेषण सहायक हूँ। आप इस पृष्ठ पर प्रदर्शित निविदा, कंपनी, जोखिम स्कोर या कार्यप्रणाली के बारे में मुझसे प्रश्न पूछ सकते हैं।'
          : language === 'ta'
          ? 'வணக்கம்! நான் பிட்ஷீல்ட் AI புலனாய்வு உதவியாளர். நீங்கள் பார்க்கும் டெண்டர், நிறுவனம், அபாய மதிப்பெண் அல்லது ஆய்வு முறை குறித்து என்னிடம் கேட்கலாம்.'
          : 'Hello! I am the BidShield AI Investigation Assistant. Ask me anything about the active tender, company, screening scores, or methodology.';

      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content: welcomeContent,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }
  }, [language]);

  const handleSend = async (customPrompt?: string) => {
    const textToSend = customPrompt || input.trim();
    if (!textToSend || isLoading) return;

    const userMsg: Message = {
      id: String(Date.now()),
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!customPrompt) setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': 'investigator_1',
          'x-user-name': 'Senior Investigator',
        },
        body: JSON.stringify({
          message: textToSend,
          sessionId: sessionId || undefined,
          context,
          language: language === 'hi' ? 'hi-IN' : language === 'ta' ? 'ta-IN' : 'en-IN',
        }),
      });


      if (!res.ok) throw new Error('Assistant API returned an error');

      const data = await res.json();
      if (data.sessionId && !sessionId) {
        setSessionId(data.sessionId);
      }

      const assistantMsg: Message = {
        id: String(Date.now() + 1),
        role: 'assistant',
        content: data.message || 'No response generated.',
        evidence: data.evidence || [],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      const errorMsg: Message = {
        id: String(Date.now() + 1),
        role: 'assistant',
        content:
          language === 'hi'
            ? 'एआई सहायता अस्थायी रूप से अनुपलब्ध है। आप सत्यापित बिडशील्ड डेटा की समीक्षा जारी रख सकते हैं।'
            : language === 'ta'
            ? 'AI உதவி தற்காலிகமாக கிடைக்கவில்லை. சரிபார்க்கப்பட்ட பிட்ஷீல்ட் தரவை தொடர்ந்து மதிப்பாய்வு செய்யலாம்.'
            : 'AI assistance is temporarily unavailable. You can continue reviewing the verified BidShield data.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const [savedFindings, setSavedFindings] = useState<Record<string, boolean>>({});
  const [savingFindingId, setSavingFindingId] = useState<string | null>(null);

  const handleSaveFinding = async (msgId: string, content: string, evidence?: any[]) => {
    setSavingFindingId(msgId);
    try {
      const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
      const invId = context.type === 'investigation' ? Number(context.id) || 1 : 1;
      const res = await fetch('/api/assistant/save-finding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': 'investigator_1',
          'x-user-name': 'Senior Investigator',
        },
        body: JSON.stringify({
          investigationId: invId,
          sourceQuestion: lastUserMsg?.content || 'Investigative chat finding',
          assistantResponse: content,
          evidenceIds: evidence?.map((e: any) => e.evidenceId || e.id) || [],
          userId: 'investigator_1',
          userName: 'Senior Investigator',
        }),
      });

      if (res.ok) {
        setSavedFindings((prev) => ({ ...prev, [msgId]: true }));
      }
    } catch {
      // fallback
    } finally {
      setSavingFindingId(null);
    }
  };

  const extractActionLinks = (text: string) => {
    const links: Array<{ label: string; url: string; type: string }> = [];
    // Match Tenders like TND-1042 or BS-2025-0001
    const tMatches = Array.from(text.matchAll(/\b(TND-\d+|BS-\d{4}-\d+)\b/gi));
    tMatches.slice(0, 2).forEach((m) => {
      const numMatch = m[0].match(/\d+/);
      const tid = numMatch ? ((parseInt(numMatch[0], 10) - 1) % 6) + 1 : 1;
      links.push({
        label: `Open Tender ${m[0].toUpperCase()}`,
        url: `/tenders/${tid}`,
        type: 'tender',
      });
    });
    // Match Companies
    const knownCompanies = [
      { name: 'ABC Infrastructure', id: 1 },
      { name: 'Apex Buildcon', id: 2 },
      { name: 'Aster Infrastructure', id: 1 },
      { name: 'Bharat Technologies', id: 2 },
      { name: 'Civic Infra', id: 3 },
    ];
    for (const comp of knownCompanies) {
      if (text.includes(comp.name) && links.length < 3) {
        links.push({
          label: `Open Company`,
          url: `/companies/${comp.id}`,
          type: 'company',
        });
        break;
      }
    }
    // Match Investigation
    if (text.includes('Investigation') || text.includes('Case #') || text.includes('புலனாய்வு') || text.includes('अन्वेषण')) {
      links.push({
        label: `Open Investigation`,
        url: `/investigations/1`,
        type: 'investigation',
      });
    }
    return links;
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClear = () => {
    setMessages([]);
    setSessionId('');
  };

  // Quick suggestions based on context
  const suggestions = (() => {
    if (context.type === 'tender') {
      return [
        t('assistant.promptWhyFlagged'),
        t('assistant.promptExplainRisk'),
        t('assistant.promptCompareBids'),
        t('assistant.promptShowEvidence'),
      ];
    }
    if (context.type === 'company') {
      return [
        t('assistant.promptCompanyHistory'),
        t('assistant.promptCompanyParticipation'),
        t('assistant.promptUnusualPatterns'),
      ];
    }
    if (context.type === 'investigation') {
      return [
        t('assistant.promptInvestigationSummary'),
        t('assistant.promptNextSteps'),
        t('assistant.promptShowEvidence'),
      ];
    }
    return [
      t('assistant.promptMethodologyRotation'),
      t('assistant.promptMethodologyClustering'),
      t('assistant.promptMethodologyOverall'),
    ];
  })();

  return (
    <>
      {/* Floating Trigger Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-full bg-primary px-4 py-3 text-xs font-bold text-primary-foreground shadow-2xl transition-all duration-300 hover:scale-105 hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/50"
          data-testid="button-open-floating-assistant"
          title={t('assistant.floatingButtonTitle')}
        >
          <Sparkles className="h-4 w-4 animate-pulse text-amber-300" />
          <span>{t('assistant.floatingButtonTitle')}</span>
          {context.type !== 'general' && (
            <span className="rounded-full bg-black/30 px-2 py-0.5 text-[10px] uppercase font-mono tracking-wider">
              {context.type}
            </span>
          )}
        </button>
      )}

      {/* Floating Slideover Panel */}
      {isOpen && (
        <div
          className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l hairline bg-[#0b1324] shadow-2xl sm:max-w-md animate-in slide-in-from-right duration-200"
          data-testid="panel-floating-assistant"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b hairline px-4 py-3.5 bg-card/80 backdrop-blur-sm">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary border hairline">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-1.5">
                  {t('assistant.pageTitle')}
                </h3>
                <div className="text-[10px] text-muted-foreground flex items-center gap-1 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  <span>OpenAI Grounded v1.0</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Link
                href="/assistant"
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                title="Open Dedicated Full Page"
                onClick={() => setIsOpen(false)}
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </Link>
              <button
                onClick={handleClear}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                title={t('assistant.clearChat')}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                data-testid="button-close-floating-assistant"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Context Banner */}
          {context.type !== 'general' && (
            <div className="flex items-center justify-between border-b hairline bg-primary/5 px-4 py-2 text-[11px] text-primary">
              <div className="flex items-center gap-1.5 font-medium truncate">
                {context.type === 'tender' && <FileCheck2 className="h-3.5 w-3.5 shrink-0" />}
                {context.type === 'company' && <Building2 className="h-3.5 w-3.5 shrink-0" />}
                {context.type === 'investigation' && <ShieldAlert className="h-3.5 w-3.5 shrink-0" />}
                <span>
                  {context.type === 'tender' ? t('assistant.contextTender') : context.type === 'company' ? t('assistant.contextCompany') : t('assistant.contextInvestigation')}: #{context.id}
                </span>
              </div>
              <span className="text-[9px] uppercase font-mono text-muted-foreground">Active Context</span>
            </div>
          )}

          {/* Message List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/20 text-primary border hairline mt-0.5">
                    <Bot className="h-4 w-4" />
                  </div>
                )}

                <div
                  className={`relative max-w-[85%] rounded-xl p-3 text-xs leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground font-medium rounded-tr-none shadow-sm'
                      : 'bg-card/70 border hairline text-foreground rounded-tl-none space-y-2'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>

                  {/* Evidence Citations */}
                  {msg.evidence && msg.evidence.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t hairline space-y-1.5">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                        <ShieldAlert className="h-3 w-3 text-primary" /> {t('assistant.evidenceReferences')}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {msg.evidence.slice(0, 4).map((ev: any, idx: number) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 rounded bg-secondary/80 px-2 py-0.5 text-[10px] font-mono border hairline text-primary font-bold"
                          >
                            {ev.evidenceId || ev.id || `EV-${idx + 1}`}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action Links */}
                  {msg.role === 'assistant' && extractActionLinks(msg.content).length > 0 && (
                    <div className="pt-2 border-t hairline flex flex-wrap gap-1.5">
                      {extractActionLinks(msg.content).map((link, lIdx) => (
                        <Link
                          key={lIdx}
                          href={link.url}
                          className="inline-flex items-center gap-1 rounded-md bg-primary/10 hover:bg-primary/20 text-primary border hairline px-2 py-0.5 text-[10px] font-medium transition-colors"
                        >
                          <span>{link.label}</span>
                          <ArrowUpRight className="h-2.5 w-2.5 opacity-70" />
                        </Link>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1 text-[9px] text-muted-foreground">
                    <span>{msg.timestamp}</span>
                    {msg.role === 'assistant' && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSaveFinding(msg.id, msg.content, msg.evidence)}
                          disabled={savingFindingId === msg.id || Boolean(savedFindings[msg.id])}
                          className="hover:text-primary transition-colors flex items-center gap-1 text-[10px]"
                          title="Save this analysis as an official AI-assisted note in the investigation"
                        >
                          {savedFindings[msg.id] ? (
                            <>
                              <Check className="h-3 w-3 text-emerald-400" />
                              <span className="text-emerald-400 font-medium">Saved to Case</span>
                            </>
                          ) : savingFindingId === msg.id ? (
                            <>
                              <RefreshCw className="h-3 w-3 animate-spin text-primary" />
                              <span>Saving...</span>
                            </>
                          ) : (
                            <>
                              <BookmarkPlus className="h-3 w-3" />
                              <span>Save to Investigation</span>
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => handleCopy(msg.id, msg.content)}
                          className="hover:text-foreground transition-colors ml-1"
                          title={t('assistant.copyResponse')}
                        >
                          {copiedId === msg.id ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {msg.role === 'user' && (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground border hairline mt-0.5">
                    <User className="h-4 w-4" />
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-2.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/20 text-primary border hairline">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="rounded-xl rounded-tl-none bg-card/70 border hairline p-3 text-xs text-muted-foreground flex items-center gap-2">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" />
                  <span>{t('assistant.thinking')}</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggestions Chips */}
          <div className="border-t hairline bg-card/40 p-2.5">
            <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {suggestions.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(prompt)}
                  disabled={isLoading}
                  className="shrink-0 rounded-full border hairline bg-secondary/60 hover:bg-secondary px-2.5 py-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          {/* Input Area */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="border-t hairline p-3 bg-card/80 backdrop-blur-sm"
          >
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t('assistant.inputPlaceholder')}
                disabled={isLoading}
                className="input flex-1 text-xs py-2"
                data-testid="input-floating-assistant"
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="button-primary p-2 shrink-0 disabled:opacity-50"
                data-testid="button-send-floating-assistant"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1.5 text-[9px] text-muted-foreground text-center line-clamp-1">
              {t('disclaimers.main')}
            </p>
          </form>
        </div>
      )}
    </>
  );
}
