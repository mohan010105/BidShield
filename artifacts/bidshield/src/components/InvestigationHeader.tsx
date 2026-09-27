import { useState } from 'react';
import { 
  ShieldCheck, Star, Download, FileSpreadsheet, Printer, ArrowLeft, 
  Building2, Calendar, MapPin, Tag, CheckCircle2, Clock, Eye, Scale, User
} from 'lucide-react';
import { Link } from 'wouter';
import { useTranslation } from '../i18n';

interface InvestigationHeaderProps {
  investigation: {
    id: number;
    tenderId: number;
    status: 'OPEN' | 'IN_REVIEW' | 'WATCHLIST' | 'CLOSED';
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    assignedTo: string;
    isWatchlisted: boolean;
    watchlistNotes?: string | null;
    tender: {
      tenderNumber: string;
      title: string;
      organization: string;
      department: string;
      category: string;
      location: string;
      state: string;
      tenderDate: string;
      estimatedValue: number;
      contractValue?: number | null;
      winnerName?: string | null;
    };
    combinedScreening: {
      overallScore: number | null;
      screeningLevel: string;
      availableIndicatorCount: number;
      totalIndicatorCount: number;
    };
  };
  onStatusChange: (newStatus: 'OPEN' | 'IN_REVIEW' | 'WATCHLIST' | 'CLOSED') => void;
  onToggleWatchlist: () => void;
  onExport: (format: 'html' | 'csv') => void;
}

export function InvestigationHeader({
  investigation,
  onStatusChange,
  onToggleWatchlist,
  onExport,
}: InvestigationHeaderProps) {
  const { tender, combinedScreening, status, priority, isWatchlisted } = investigation;
  const { t, formatCurrency, formatDate, language } = useTranslation();
  const [isExporting, setIsExporting] = useState(false);

  return (
    <div className="space-y-4 mb-6">
      {/* Top Back & Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b hairline pb-3">
        <Link
          href="/investigations"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          data-testid="link-back-investigations"
        >
          <ArrowLeft className="h-4 w-4" /> {language === 'hi' ? 'वापस: जाँच कार्यक्षेत्र' : language === 'ta' ? 'பின்செல்: புலனாய்வு பணித்தளம்' : 'Back to Investigation Workspaces'}
        </Link>

        <div className="flex items-center gap-2">
          {/* Watchlist Toggle */}
          <button
            onClick={onToggleWatchlist}
            className={`button-secondary text-xs flex items-center gap-1.5 transition-all ${
              isWatchlisted
                ? 'bg-amber-500/15 text-amber-500 border-amber-500/30 dark:bg-amber-500/20'
                : 'hover:bg-secondary'
            }`}
            title={isWatchlisted ? (language === 'hi' ? 'वॉचलिस्ट से हटाएं' : language === 'ta' ? 'கண்காணிப்பு பட்டியலில் இருந்து நீக்கு' : 'Remove from Watchlist') : t('investigation.addToWatchlist')}
            data-testid="button-watchlist-toggle"
          >
            <Star className={`h-3.5 w-3.5 ${isWatchlisted ? 'fill-amber-500 text-amber-500' : ''}`} />
            {isWatchlisted ? (language === 'hi' ? 'वॉचलिस्ट में है' : language === 'ta' ? 'கண்காணிப்பு பட்டியலில்' : 'Watchlisted') : t('investigation.addToWatchlist')}
          </button>

          {/* Export Dropdown / Actions */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onExport('html')}
              className="button-secondary text-xs flex items-center gap-1"
              title="Print or Export PDF Summary"
              data-testid="button-export-pdf"
            >
              <Printer className="h-3.5 w-3.5 text-primary" /> {t('investigation.exportHtml')}
            </button>
            <button
              onClick={() => onExport('csv')}
              className="button-secondary text-xs flex items-center gap-1"
              title="Export Tabular CSV Data"
              data-testid="button-export-csv"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-500" /> {t('investigation.exportCsv')}
            </button>
          </div>
        </div>
      </div>

      {/* Primary Header Card */}
      <div className="panel p-6 space-y-4 bg-card" data-testid="investigation-header-panel">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="data-mono font-bold text-primary px-2 py-0.5 rounded bg-primary/10 border border-primary/20">
                {tender.tenderNumber}
              </span>
              <span className="text-muted-foreground font-medium">{language === 'hi' ? 'केस' : language === 'ta' ? 'வழக்கு' : 'Case'} #{investigation.id}</span>
              <span className="text-muted-foreground">•</span>
              <span className="text-muted-foreground flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5" /> {tender.organization}
              </span>
              {tender.department && (
                <span className="text-muted-foreground">({tender.department})</span>
              )}
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-foreground">{tender.title}</h1>

            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-1">
              <span className="flex items-center gap-1">
                <Tag className="h-3.5 w-3.5 text-primary" /> {tender.category}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-primary" /> {tender.location}, {tender.state}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-primary" /> {language === 'hi' ? 'प्रकाशित:' : language === 'ta' ? 'வெளியிடப்பட்டது:' : 'Published:'} {formatDate(tender.tenderDate)}
              </span>
              <span className="flex items-center gap-1">
                <User className="h-3.5 w-3.5 text-primary" /> {language === 'hi' ? 'आवंटित:' : language === 'ta' ? 'ஒதுக்கப்பட்டது:' : 'Assigned:'} <strong className="text-foreground">{investigation.assignedTo}</strong>
              </span>
            </div>
          </div>

          {/* Right Column: Status & Score Pills */}
          <div className="flex flex-wrap lg:flex-col items-start lg:items-end gap-3 shrink-0 border-t lg:border-t-0 lg:border-l hairline pt-3 lg:pt-0 lg:pl-6">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-medium">{t('investigation.status')}:</span>
              <select
                value={status}
                onChange={(e) => onStatusChange(e.target.value as any)}
                className="bg-secondary text-foreground text-xs font-semibold rounded-md border hairline px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                data-testid="select-investigation-status"
              >
                <option value="OPEN">{language === 'hi' ? 'खुला (स्क्रीनिंग के तहत)' : language === 'ta' ? 'திறந்த நிலை (திரையிடல் கீழ்)' : 'OPEN (Under Screening)'}</option>
                <option value="IN_REVIEW">{language === 'hi' ? 'समीक्षाधीन (सक्रिय कार्य)' : language === 'ta' ? 'மதிப்பாய்வில் (செயலில் உள்ள வழக்கு)' : 'IN REVIEW (Active Casework)'}</option>
                <option value="WATCHLIST">{language === 'hi' ? 'वॉचलिस्ट (दीर्घकालिक समीक्षा)' : language === 'ta' ? 'கண்காணிப்பு பட்டியல் (நீண்டகால மறுஆய்வு)' : 'WATCHLIST (Longitudinal Review)'}</option>
                <option value="CLOSED">{language === 'hi' ? 'बंद (समीक्षा पूर्ण)' : language === 'ta' ? 'மூடப்பட்டது (முடிவுற்ற மறுஆய்வு)' : 'CLOSED (Review Finalized)'}</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-medium">{language === 'hi' ? 'प्राथमिकता:' : language === 'ta' ? 'முன்னுரிமை:' : 'Priority:'}</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase ${
                priority === 'HIGH'
                  ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                  : priority === 'MEDIUM'
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                  : 'bg-slate-500/15 text-slate-400 border border-slate-500/30'
              }`}>
                {priority} {language === 'hi' ? 'प्राथमिकता' : language === 'ta' ? 'முன்னுரிமை' : 'PRIORITY'}
              </span>
            </div>
          </div>
        </div>

        {/* Value & Summary Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t hairline text-xs">
          <div className="rounded-lg bg-secondary/40 p-3 border hairline">
            <div className="text-[11px] text-muted-foreground font-medium">{t('tenders.estimatedValue')}</div>
            <div className="data-mono text-base font-bold text-foreground mt-0.5">
              {formatCurrency(tender.estimatedValue)}
            </div>
          </div>

          <div className="rounded-lg bg-secondary/40 p-3 border hairline">
            <div className="text-[11px] text-muted-foreground font-medium">{t('tenders.winner')}</div>
            <div className="font-semibold text-foreground truncate mt-0.5">
              {tender.winnerName ?? (language === 'hi' ? 'आवंटन लंबित' : language === 'ta' ? 'ஒதுக்கீடு நிலுவையில்' : 'Award pending')}
            </div>
          </div>

          <div className="rounded-lg bg-secondary/40 p-3 border hairline">
            <div className="text-[11px] text-muted-foreground font-medium">{t('analytics.score')}</div>
            <div className="data-mono text-base font-bold text-primary mt-0.5">
              {combinedScreening.overallScore !== null ? `${combinedScreening.overallScore}/100` : t('analytics.insufficientData')}
            </div>
          </div>

          <div className="rounded-lg bg-secondary/40 p-3 border hairline">
            <div className="text-[11px] text-muted-foreground font-medium">{t('analytics.level')}</div>
            <div className="font-semibold text-amber-400 truncate mt-0.5">
              {combinedScreening.screeningLevel}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
