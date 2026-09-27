import { useState, useEffect, useRef } from 'react';
import { useLocation, Link } from 'wouter';
import {
  Sparkles,
  Send,
  Plus,
  Trash2,
  Copy,
  Check,
  Bot,
  User,
  ShieldAlert,
  HelpCircle,
  ExternalLink,
  ChevronRight,
  RefreshCw,
  Building2,
  FileCheck2,
  MessageSquare,
  History,
  ShieldCheck,
  Scale,
  RotateCcw,
  Percent,
  BookmarkPlus,
  ArrowUpRight,
} from 'lucide-react';
import { useTranslation } from '../i18n';

interface StoredSession {
  id: string;
  title: string;
  contextType?: string;
  contextId?: string;
  language: string;
  createdAt: string;
  updatedAt: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  evidence?: any[];
  timestamp: string;
}

export function AssistantPage() {
  const { t, language } = useTranslation();
  const [sessions, setSessions] = useState<StoredSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load session list on mount
  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const res = await fetch('/api/assistant/sessions', {
        headers: { 'x-user-id': 'investigator_1', 'x-user-name': 'Senior Investigator' },
      });
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
        if (data.sessions?.length > 0 && !currentSessionId) {
          loadSession(data.sessions[0].id);
        }
      }
    } catch {
      // Fallback
    }
  };

  const loadSession = async (sessionId: string) => {
    setCurrentSessionId(sessionId);
    setIsLoading(true);
    try {
      const res = await fetch(`/api/assistant/sessions/${sessionId}`, {
        headers: { 'x-user-id': 'investigator_1', 'x-user-name': 'Senior Investigator' },
      });
      if (res.ok) {
        const data = await res.json();
        const loaded: Message[] = (data.messages || []).map((m: any) => ({
          id: String(m.id),
          role: m.role,
          content: m.content,
          evidence: m.metadata?.evidence || [],
          timestamp: new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }));
        setMessages(loaded);
      }
    } catch {
      // Fallback
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewSession = async () => {
    try {
      const res = await fetch('/api/assistant/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': 'investigator_1',
          'x-user-name': 'Senior Investigator',
        },
        body: JSON.stringify({
          title: t('assistant.newChat'),
          language: language === 'hi' ? 'hi-IN' : language === 'ta' ? 'ta-IN' : 'en-IN',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSessions((prev) => [data.session, ...prev]);
        setCurrentSessionId(data.session.id);
        setMessages([]);
      }
    } catch {
      // Fallback
      const tempId = `temp-${Date.now()}`;
      setCurrentSessionId(tempId);
      setMessages([]);
    }
  };

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`/api/assistant/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: { 'x-user-id': 'investigator_1', 'x-user-name': 'Senior Investigator' },
      });
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (currentSessionId === sessionId) {
        setCurrentSessionId('');
        setMessages([]);
      }
    } catch {
      // Fallback
    }
  };


  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

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
          sessionId: currentSessionId || undefined,
          language: language === 'hi' ? 'hi-IN' : language === 'ta' ? 'ta-IN' : 'en-IN',
        }),
      });

      if (!res.ok) throw new Error('API returned an error');

      const data = await res.json();
      if (data.sessionId && data.sessionId !== currentSessionId) {
        setCurrentSessionId(data.sessionId);
        fetchSessions();
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
      const res = await fetch('/api/assistant/save-finding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': 'investigator_1',
          'x-user-name': 'Senior Investigator',
        },
        body: JSON.stringify({
          investigationId: 1,
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

  // Recommended inquiries
  const quickPrompts = [
    t('assistant.promptWhyFlagged'),
    t('assistant.promptExplainRisk'),
    t('assistant.promptMethodologyRotation'),
    t('assistant.promptMethodologyClustering'),
    t('assistant.promptCompanyHistory'),
    t('assistant.promptInvestigationSummary'),
  ];

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col md:flex-row overflow-hidden bg-background">
      {/* Session History Sidebar */}
      <aside
        className={`w-full md:w-72 shrink-0 border-r hairline bg-card/60 flex flex-col transition-all duration-200 ${
          isSidebarOpen ? 'block' : 'hidden md:block'
        }`}
      >
        <div className="p-4 border-b hairline flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-sm text-foreground">
            <History className="h-4 w-4 text-primary" />
            <span>{t('assistant.conversations')}</span>
          </div>
          <button
            onClick={handleNewSession}
            className="button-primary text-xs flex items-center gap-1.5 py-1.5 px-2.5"
            data-testid="button-new-session"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{t('assistant.newChat')}</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sessions.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground">
              {t('assistant.noConversations')}
            </div>
          ) : (
            sessions.map((s) => (
              <div
                key={s.id}
                onClick={() => loadSession(s.id)}
                className={`group flex items-center justify-between rounded-lg p-2.5 text-xs transition-colors cursor-pointer ${
                  currentSessionId === s.id
                    ? 'bg-primary/15 text-primary font-semibold border hairline'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                }`}
              >
                <div className="flex items-center gap-2 truncate pr-2">
                  <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-70" />
                  <span className="truncate">{s.title || 'Investigation Chat'}</span>
                </div>
                <button
                  onClick={(e) => handleDeleteSession(s.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:text-destructive transition-all"
                  title={t('assistant.deleteSession')}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Main Investigation Chat Window */}
      <main className="flex-1 flex flex-col overflow-hidden bg-background">
        {/* Workspace Top Bar */}
        <header className="border-b hairline px-6 py-4 flex items-center justify-between bg-card/40 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary border hairline">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-base font-bold text-foreground flex items-center gap-2">
                {t('assistant.pageTitle')}
                <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] text-emerald-400 font-mono font-medium">
                  OpenAI Grounded
                </span>
              </h1>
              <p className="text-xs text-muted-foreground hidden sm:block">
                {t('assistant.pageSubtitle')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setMessages([])}
              className="button-secondary text-xs flex items-center gap-1.5"
              title={t('assistant.clearChat')}
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t('assistant.clearChat')}</span>
            </button>
          </div>
        </header>

        {/* Message Feed */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 max-w-4xl w-full mx-auto">
          {messages.length === 0 ? (
            <div className="min-h-[300px] flex flex-col items-center justify-center text-center p-8 space-y-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20">
                <Bot className="h-8 w-8" />
              </div>
              <div className="max-w-md space-y-1.5">
                <h2 className="text-lg font-bold text-foreground">{t('assistant.pageTitle')}</h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t('assistant.groundedDisclaimer')}
                </p>
              </div>

              {/* Suggestions Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg w-full pt-4">
                {quickPrompts.map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSend(prompt)}
                    className="p-3 text-left rounded-xl border hairline bg-card/60 hover:bg-secondary/60 text-xs text-muted-foreground hover:text-foreground transition-all flex items-center justify-between group"
                  >
                    <span>{prompt}</span>
                    <ChevronRight className="h-3.5 w-3.5 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/20 text-primary border hairline mt-1">
                    <Bot className="h-4 w-4" />
                  </div>
                )}

                <div
                  className={`relative max-w-[85%] rounded-2xl p-4 text-xs leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground font-medium rounded-tr-none shadow-md'
                      : 'bg-card border hairline text-foreground rounded-tl-none shadow-sm space-y-3'
                  }`}
                >
                  <p className="whitespace-pre-wrap leading-relaxed text-[13px]">{msg.content}</p>

                  {/* Evidence Citations */}
                  {msg.evidence && msg.evidence.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t hairline space-y-2">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <ShieldAlert className="h-3.5 w-3.5 text-primary" />
                        <span>{t('assistant.evidenceReferences')}</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {msg.evidence.slice(0, 6).map((ev: any, idx: number) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 rounded bg-secondary px-2.5 py-1 text-[11px] font-mono border hairline text-primary font-bold shadow-xs"
                          >
                            {ev.evidenceId || ev.id || `EV-${idx + 1}`}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action Links */}
                  {msg.role === 'assistant' && extractActionLinks(msg.content).length > 0 && (
                    <div className="pt-2.5 border-t hairline flex flex-wrap gap-2">
                      {extractActionLinks(msg.content).map((link, lIdx) => (
                        <Link
                          key={lIdx}
                          href={link.url}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border hairline px-2.5 py-1 text-xs font-medium transition-colors"
                        >
                          <span>{link.label}</span>
                          <ArrowUpRight className="h-3 w-3 opacity-70" />
                        </Link>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 text-[10px] text-muted-foreground border-t hairline/30">
                    <span>{msg.timestamp}</span>
                    {msg.role === 'assistant' && (
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleSaveFinding(msg.id, msg.content, msg.evidence)}
                          disabled={savingFindingId === msg.id || Boolean(savedFindings[msg.id])}
                          className="hover:text-primary transition-colors flex items-center gap-1.5 text-xs text-muted-foreground"
                          title="Save this analysis as an official AI-assisted note in the investigation"
                        >
                          {savedFindings[msg.id] ? (
                            <>
                              <Check className="h-3.5 w-3.5 text-emerald-400" />
                              <span className="text-emerald-400 font-medium">Saved to Case #1</span>
                            </>
                          ) : savingFindingId === msg.id ? (
                            <>
                              <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" />
                              <span>Saving...</span>
                            </>
                          ) : (
                            <>
                              <BookmarkPlus className="h-3.5 w-3.5" />
                              <span>Save to Investigation</span>
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => handleCopy(msg.id, msg.content)}
                          className="hover:text-foreground transition-colors flex items-center gap-1 ml-2"
                          title={t('assistant.copyResponse')}
                        >
                          {copiedId === msg.id ? (
                            <>
                              <Check className="h-3.5 w-3.5 text-emerald-400" />
                              <span className="text-emerald-400">{t('assistant.copied')}</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3.5 w-3.5" />
                              <span>{t('assistant.copyResponse')}</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {msg.role === 'user' && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground border hairline mt-1">
                    <User className="h-4 w-4" />
                  </div>
                )}
              </div>
            ))
          )}

          {isLoading && (
            <div className="flex gap-3.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/20 text-primary border hairline">
                <Bot className="h-4 w-4" />
              </div>
              <div className="rounded-2xl rounded-tl-none bg-card border hairline p-4 text-xs text-muted-foreground flex items-center gap-2.5 shadow-sm">
                <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                <span>{t('assistant.thinking')}</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input & Statutory Footer */}
        <div className="border-t hairline p-4 bg-card/60 backdrop-blur-sm max-w-4xl w-full mx-auto">
          {/* Quick Suggestions Chips above input */}
          <div className="flex gap-1.5 overflow-x-auto pb-2 mb-2 no-scrollbar">
            {quickPrompts.slice(0, 4).map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(prompt)}
                disabled={isLoading}
                className="shrink-0 rounded-full border hairline bg-secondary/70 hover:bg-secondary px-3 py-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t('assistant.inputPlaceholder')}
              disabled={isLoading}
              className="input flex-1 text-sm py-2.5"
              data-testid="input-assistant-page"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="button-primary px-4 py-2.5 shrink-0 disabled:opacity-50 flex items-center gap-1.5"
              data-testid="button-send-assistant-page"
            >
              <Send className="h-4 w-4" />
              <span>{t('assistant.sendMessage')}</span>
            </button>
          </form>

          <p className="mt-2 text-[10px] text-muted-foreground text-center">
            {t('disclaimers.main')}
          </p>
        </div>
      </main>
    </div>
  );
}

export default AssistantPage;
