import { useState, useMemo } from 'react';
import { 
  ShieldAlert, Search, Filter, ArrowRight, Building2, Tag, Scale, Info, CheckCircle2 
} from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { useTranslation } from '../i18n';

export interface QueueItemData {
  tenderId: number;
  tenderNumber: string;
  title: string;
  organization: string;
  department: string;
  category: string;
  estimatedValue: number;
  tenderDate: string;
  overallScore: number | null;
  screeningLevel: string;
  evidenceCount: number;
  topIndicator: {
    indicator: string;
    label: string;
    score: number;
  } | null;
  investigationId: number | null;
  investigationStatus: string | null;
  hasActiveInvestigation: boolean;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  requiresReview: boolean;
}

interface InvestigationQueueTableProps {
  items: QueueItemData[];
  onOpenInvestigation: (tenderId: number) => Promise<void>;
}

export function InvestigationQueueTable({ items, onOpenInvestigation }: InvestigationQueueTableProps) {
  const [, setLocation] = useLocation();
  const { t, formatCurrency, language } = useTranslation();
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  const categories = useMemo(() => {
    const set = new Set(items.map((i) => i.category));
    return Array.from(set).sort();
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (levelFilter !== 'ALL') {
        if (!item.screeningLevel.toUpperCase().includes(levelFilter.toUpperCase())) {
          return false;
        }
      }
      if (categoryFilter !== 'ALL' && item.category !== categoryFilter) {
        return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const matches =
          item.tenderNumber.toLowerCase().includes(q) ||
          item.title.toLowerCase().includes(q) ||
          item.organization.toLowerCase().includes(q) ||
          item.department.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [items, levelFilter, categoryFilter, search]);

  const fmtCurrency = (val: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);

  return (
    <div className="space-y-4" data-testid="investigation-queue-table-component">
      {/* Search & Filters Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-secondary/30 p-3.5 rounded-lg border hairline">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={language === 'hi' ? 'निविदा संख्या, शीर्षक या संगठन द्वारा खोजें...' : language === 'ta' ? 'டெண்டர் எண், தலைப்பு அல்லது அமைப்பு மூலம் தேடுங்கள்...' : 'Search queue by tender ID, title, organization...'}
            className="w-full pl-9 pr-4 py-1.5 text-xs rounded-md bg-card text-foreground border hairline focus:outline-none focus:ring-1 focus:ring-primary"
            data-testid="input-queue-search"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Signal Level Filter */}
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="bg-card text-foreground text-xs rounded-md border hairline px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
            data-testid="select-queue-level"
          >
            <option value="ALL">{language === 'hi' ? 'सभी स्क्रीनिंग स्तर' : language === 'ta' ? 'அனைத்து திரையிடல் நிலைகள்' : 'All Screening Levels'}</option>
            <option value="ELEVATED">{language === 'hi' ? 'उच्च स्क्रीनिंग संकेत (ELEVATED)' : language === 'ta' ? 'உயர்ந்த திரையிடல் சமிக்ஞை (ELEVATED)' : 'Elevated Screening Signal'}</option>
            <option value="MODERATE">{language === 'hi' ? 'मध्यम स्क्रीनिंग संकेत (MODERATE)' : language === 'ta' ? 'மிதமான திரையிடல் சமிக்ஞை (MODERATE)' : 'Moderate Screening Signal'}</option>
            <option value="HIGH">{language === 'hi' ? 'अत्यधिक उच्च संकेत (HIGH)' : language === 'ta' ? 'மிக உயர்ந்த சமிக்ஞை (HIGH)' : 'High Screening Signal'}</option>
          </select>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-card text-foreground text-xs rounded-md border hairline px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
            data-testid="select-queue-category"
          >
            <option value="ALL">{language === 'hi' ? 'सभी श्रेणियाँ' : language === 'ta' ? 'அனைத்து வகைகள்' : 'All Categories'}</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Queue Table */}
      <div className="overflow-x-auto rounded-lg border hairline bg-card">
        <table className="w-full text-left text-xs" data-testid="table-investigation-queue">
          <thead className="bg-muted/40 text-muted-foreground text-[11px] uppercase tracking-wider border-b hairline">
            <tr>
              <th className="p-3">{t('tenders.tenderNumber')}</th>
              <th className="p-3">{t('tenders.tenderTitle')}</th>
              <th className="p-3 text-right">{t('tenders.estimatedValue')}</th>
              <th className="p-3 text-right">{t('analytics.score')}</th>
              <th className="p-3">{t('analytics.level')}</th>
              <th className="p-3">{language === 'hi' ? 'शीर्ष संकेत' : language === 'ta' ? 'முதன்மை சமிக்ஞை' : 'Top Signal'}</th>
              <th className="p-3 text-center">{t('common.status')}</th>
              <th className="p-3 text-right">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredItems.length > 0 ? (
              filteredItems.map((item) => (
                <tr key={item.tenderId} className="hover:bg-secondary/30 transition-colors" data-testid={`queue-row-${item.tenderId}`}>
                  <td className="p-3 font-mono font-bold text-foreground shrink-0">
                    <Link href={`/tenders/${item.tenderId}`} className="text-primary hover:underline">
                      {item.tenderNumber}
                    </Link>
                  </td>

                  <td className="p-3 max-w-xs">
                    <div className="font-semibold text-foreground truncate">{item.title}</div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {item.organization} • {item.category}
                    </div>
                  </td>

                  <td className="p-3 text-right font-mono text-foreground font-medium shrink-0">
                    {formatCurrency(item.estimatedValue)}
                  </td>

                  <td className="p-3 text-right font-mono font-bold shrink-0">
                    {item.overallScore !== null ? (
                      <span className={item.overallScore >= 50 ? 'text-amber-400 font-extrabold' : 'text-primary'}>
                        {item.overallScore}/100
                      </span>
                    ) : (
                      <span className="text-muted-foreground font-normal">{t('analytics.insufficientData')}</span>
                    )}
                  </td>

                  <td className="p-3 shrink-0">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      item.screeningLevel.includes('ELEVATED')
                        ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                        : item.screeningLevel.includes('HIGH')
                        ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                        : 'bg-primary/10 text-primary border border-primary/20'
                    }`}>
                      {item.screeningLevel}
                    </span>
                  </td>

                  <td className="p-3 shrink-0">
                    {item.topIndicator ? (
                      <div className="text-[11px]">
                        <div className="font-semibold text-foreground">{item.topIndicator.label}</div>
                        <div className="font-mono text-[10px] text-muted-foreground">{t('analytics.score')}: {item.topIndicator.score}/100</div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>

                  <td className="p-3 text-center shrink-0">
                    {item.hasActiveInvestigation ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        <CheckCircle2 className="h-3 w-3" /> {item.investigationStatus}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-secondary text-muted-foreground">
                        {language === 'hi' ? 'अनअसाइन किया गया' : language === 'ta' ? 'ஒதுக்கப்படவில்லை' : 'Unassigned'}
                      </span>
                    )}
                  </td>

                  <td className="p-3 text-right shrink-0">
                    {item.hasActiveInvestigation && item.investigationId ? (
                      <Link
                        href={`/investigations/${item.investigationId}`}
                        className="button-secondary text-xs py-1 px-2.5 inline-flex items-center gap-1"
                        data-testid={`button-view-inv-${item.tenderId}`}
                      >
                        {language === 'hi' ? 'कार्यक्षेत्र खोलें' : language === 'ta' ? 'பணித்தளத்தைத் திற' : 'Open Workspace'} <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    ) : (
                      <button
                        onClick={() => onOpenInvestigation(item.tenderId)}
                        className="button-primary text-xs py-1 px-2.5 inline-flex items-center gap-1"
                        data-testid={`button-create-inv-${item.tenderId}`}
                      >
                        {language === 'hi' ? 'जाँच शुरू करें' : language === 'ta' ? 'புலனாய்வைத் திற' : 'Open Investigation'} <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="p-8 text-center text-xs text-muted-foreground">
                  {t('common.emptyDesc')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Analytical Guardrail */}
      <div className="rounded-lg bg-secondary/30 p-3 border hairline text-xs text-muted-foreground flex items-start gap-2">
        <Info className="h-4 w-4 shrink-0 text-primary mt-0.5" />
        <span>
          <strong>{language === 'hi' ? 'जाँच कतार का उद्देश्य:' : language === 'ta' ? 'புலனாய்வு வரிசையின் நோக்கம்:' : 'Investigation Queue Purpose:'}</strong>{' '}
          {language === 'hi'
            ? 'इस कतार में निविदाओं को स्वचालित सांख्यिकीय संकेतों के आधार पर प्राथमिकता दी गई है। यह किसी भी प्रकार की मिलीभगत या कानूनी दायित्व को सिद्ध नहीं करता है।'
            : language === 'ta'
            ? 'இந்த வரிசையில் உள்ள டெண்டர்கள் தானியங்கி புள்ளிவிவர சமிக்ஞைகளின் அடிப்படையில் முன்னுரிமை அளிக்கப்பட்டுள்ளன. இது எவ்வித தவறையும் அல்லது சட்டப்பூர்வ பொறுப்பையும் குறிக்காது.'
            : 'Tenders in this queue have been prioritized based on automated quantitative screening signals. Inclusion in this queue does NOT imply wrongdoing or legal liability.'}
        </span>
      </div>
    </div>
  );
}
