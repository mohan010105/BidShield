import { useState, useMemo } from 'react';
import {
  ShieldAlert,
  Info,
  Filter,
  Search,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Scale,
  Network,
  TrendingDown,
  Layers,
  ArrowUpRight,
  ExternalLink,
} from 'lucide-react';
import { Link } from 'wouter';
import { useTranslation } from '../i18n';

export interface EvidenceItem {
  id: number;
  indicatorType: string;
  description: string;
  metric: string;
  observedValue?: string | null;
  expectedValue?: string | null;
  severity: string;
  confidence: number;
  supportingTenderIds?: number[];
  companyId?: number;
  tenderId?: number;
  methodologyVersion?: string;
}

interface EvidencePanelProps {
  evidence: EvidenceItem[];
  title?: string;
  subtitle?: string;
  tenderNumber?: string;
  companyName?: string;
  className?: string;
}

export function EvidencePanel({
  evidence,
  title,
  subtitle,
  tenderNumber,
  companyName,
  className = "",
}: EvidencePanelProps) {
  const { t, language } = useTranslation();
  const displayTitle = title || t('evidence.title');
  const displaySubtitle = subtitle || t('evidence.subtitle');
  const [selectedIndicator, setSelectedIndicator] = useState<string>("ALL");
  const [selectedSeverity, setSelectedSeverity] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState<string>("");

  const indicatorCategories = useMemo(() => {
    return [
      { key: "ALL", label: t('common.all'), count: evidence.length },
      {
        key: "ROTATION",
        label: t('analytics.winnerRotation'),
        icon: RotateCcw,
        count: evidence.filter((e) => (e.indicatorType || "").toUpperCase().includes("ROTATION")).length,
      },
      {
        key: "COVER",
        label: t('analytics.coverBid'),
        icon: Scale,
        count: evidence.filter(
          (e) => (e.indicatorType || "").toUpperCase().includes("COVER") || (e.indicatorType || "").toUpperCase().includes("PROXIMITY")
        ).length,
      },
      {
        key: "PRICE",
        label: t('analytics.priceClustering'),
        icon: Scale,
        count: evidence.filter(
          (e) => (e.indicatorType || "").toUpperCase().includes("PRICE") || (e.indicatorType || "").toUpperCase().includes("CLUSTER")
        ).length,
      },
      {
        key: "NETWORK",
        label: t('analytics.participationNetwork'),
        icon: Network,
        count: evidence.filter(
          (e) =>
            (e.indicatorType || "").toUpperCase().includes("NETWORK") ||
            (e.indicatorType || "").toUpperCase().includes("PAIR") ||
            (e.indicatorType || "").toUpperCase().includes("GROUP")
        ).length,
      },
      {
        key: "NEAT",
        label: t('analytics.tooNeatLoss'),
        icon: TrendingDown,
        count: evidence.filter(
          (e) =>
            (e.indicatorType || "").toUpperCase().includes("NEAT") ||
            (e.indicatorType || "").toUpperCase().includes("LOSS") ||
            (e.indicatorType || "").toUpperCase().includes("RUNNER")
        ).length,
      },
    ];
  }, [evidence, t]);

  const severityCounts = useMemo(() => {
    return {
      all: evidence.length,
      high: evidence.filter((e) => (e.severity || "").toUpperCase() === "HIGH").length,
      medium: evidence.filter((e) => {
        const s = (e.severity || "").toUpperCase();
        return s === "MEDIUM" || s === "MODERATE";
      }).length,
      low: evidence.filter((e) => (e.severity || "").toUpperCase() === "LOW").length,
    };
  }, [evidence]);

  const filteredEvidence = useMemo(() => {
    return evidence.filter((item) => {
      // Indicator filter
      if (selectedIndicator !== "ALL") {
        const it = (item.indicatorType || "").toUpperCase();
        if (selectedIndicator === "ROTATION" && !it.includes("ROTATION")) return false;
        if (selectedIndicator === "COVER" && !it.includes("COVER") && !it.includes("PROXIMITY")) return false;
        if (selectedIndicator === "PRICE" && !it.includes("PRICE") && !it.includes("CLUSTER")) return false;
        if (
          selectedIndicator === "NETWORK" &&
          !it.includes("NETWORK") &&
          !it.includes("PAIR") &&
          !it.includes("GROUP")
        )
          return false;
        if (
          selectedIndicator === "NEAT" &&
          !it.includes("NEAT") &&
          !it.includes("LOSS") &&
          !it.includes("RUNNER")
        )
          return false;
      }

      // Severity filter
      if (selectedSeverity !== "ALL") {
        const s = (item.severity || "").toUpperCase();
        if (selectedSeverity === "HIGH" && s !== "HIGH") return false;
        if (selectedSeverity === "MEDIUM" && s !== "MEDIUM" && s !== "MODERATE") return false;
        if (selectedSeverity === "LOW" && s !== "LOW") return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesDesc = (item.description || "").toLowerCase().includes(q);
        const matchesMetric = (item.metric || "").toLowerCase().includes(q);
        const matchesType = (item.indicatorType || "").toLowerCase().includes(q);
        if (!matchesDesc && !matchesMetric && !matchesType) return false;
      }

      return true;
    });
  }, [evidence, selectedIndicator, selectedSeverity, searchTerm]);

  function getSeverityBadge(severity: string) {
    const s = (severity || "").toUpperCase();
    if (s === "HIGH") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-500 border border-rose-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
          {language === 'hi' ? 'उच्च गंभीरता' : language === 'ta' ? 'அதிக தீவிரம்' : 'High Severity'}
        </span>
      );
    }
    if (s === "MEDIUM" || s === "MODERATE") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          {language === 'hi' ? 'मध्यम गंभीरता' : language === 'ta' ? 'நடுத்தர தீவிரம்' : 'Medium Severity'}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-500 border border-blue-500/20">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
        {language === 'hi' ? 'कम गंभीरता' : language === 'ta' ? 'குறைந்த தீவிரம்' : 'Low Severity'}
      </span>
    );
  }

  function getIndicatorLabel(type: string) {
    const it = (type || "").toUpperCase();
    if (it.includes("ROTATION")) return t('analytics.winnerRotation');
    if (it.includes("COVER") || it.includes("PROXIMITY")) return t('analytics.coverBid');
    if (it.includes("PRICE") || it.includes("CLUSTER")) return t('analytics.priceClustering');
    if (it.includes("NETWORK") || it.includes("PAIR") || it.includes("GROUP")) return t('analytics.participationNetwork');
    if (it.includes("NEAT") || it.includes("LOSS") || it.includes("RUNNER")) return t('analytics.tooNeatLoss');
    return type.replace(/_/g, " ");
  }

  return (
    <div className={`card-panel space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b hairline">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold tracking-tight text-foreground flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              {displayTitle}
            </h3>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
              {evidence.length} {language === 'hi' ? 'रिकॉर्ड' : language === 'ta' ? 'பதிவுகள்' : (evidence.length === 1 ? 'Record' : 'Records')}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{displaySubtitle}</p>
        </div>

        {/* Severity quick filters */}
        <div className="flex items-center gap-1.5 bg-muted/40 p-1 rounded-lg self-start md:self-auto text-xs">
          <button
            onClick={() => setSelectedSeverity("ALL")}
            className={`px-2.5 py-1 rounded-md transition-colors ${
              selectedSeverity === "ALL"
                ? "bg-card text-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t('common.all')} ({severityCounts.all})
          </button>
          <button
            onClick={() => setSelectedSeverity("HIGH")}
            className={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1 ${
              selectedSeverity === "HIGH"
                ? "bg-rose-500/15 text-rose-500 shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            {t('analytics.elevated')} ({severityCounts.high})
          </button>
          <button
            onClick={() => setSelectedSeverity("MEDIUM")}
            className={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1 ${
              selectedSeverity === "MEDIUM"
                ? "bg-amber-500/15 text-amber-500 shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            {t('analytics.moderate')} ({severityCounts.medium})
          </button>
          <button
            onClick={() => setSelectedSeverity("LOW")}
            className={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1 ${
              selectedSeverity === "LOW"
                ? "bg-blue-500/15 text-blue-500 shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            {t('analytics.low')} ({severityCounts.low})
          </button>
        </div>
      </div>

      {/* Mandatory Regulatory / Analytical Disclaimer */}
      <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
        <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold">{language === 'hi' ? 'स्क्रीनिंग साक्ष्य सीमा:' : language === 'ta' ? 'திரையிடல் ஆதார எல்லை:' : 'Screening Evidence Boundary:'}</span>{' '}
          {t('disclaimers.main')}
        </div>
      </div>

      {/* Indicator category tabs & search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Detector tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          {indicatorCategories.map((cat) => (
            <button
              key={cat.key}
              onClick={() => setSelectedIndicator(cat.key)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 border ${
                selectedIndicator === cat.key
                  ? "bg-primary text-primary-foreground border-primary shadow-xs"
                  : "bg-muted/30 text-muted-foreground border-border/50 hover:bg-muted/60 hover:text-foreground"
              }`}
            >
              {cat.icon && <cat.icon className="w-3 h-3" />}
              <span>{cat.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  selectedIndicator === cat.key ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                {cat.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={language === 'hi' ? 'साक्ष्य विवरण खोजें...' : language === 'ta' ? 'ஆதார விளக்கங்களைத் தேடுங்கள்...' : 'Search evidence descriptions...'}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md bg-muted/30 border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Evidence items list */}
      <div className="space-y-2.5 pt-1">
        {filteredEvidence.length === 0 ? (
          <div className="p-8 text-center rounded-lg border border-dashed border-border/80 bg-muted/10">
            <Info className="w-8 h-8 text-muted-foreground/60 mx-auto mb-2" />
            <p className="text-sm font-medium text-foreground">{t('evidence.noEvidence')}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {t('common.emptyDesc')}
            </p>
            {(selectedIndicator !== "ALL" || selectedSeverity !== "ALL" || searchTerm) && (
              <button
                onClick={() => {
                  setSelectedIndicator("ALL");
                  setSelectedSeverity("ALL");
                  setSearchTerm("");
                }}
                className="mt-3 px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                {t('settings.reset')}
              </button>
            )}
          </div>
        ) : (
          filteredEvidence.map((ev, idx) => (
            <div
              key={ev.id || idx}
              className="p-3.5 rounded-lg border border-border/80 bg-card/60 hover:bg-card hover:border-primary/30 transition-all space-y-2"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-primary/10 text-primary border border-primary/20">
                    {getIndicatorLabel(ev.indicatorType)}
                  </span>
                  <span className="text-xs font-semibold text-foreground">{ev.metric}</span>
                </div>
                <div className="flex items-center gap-2">
                  {getSeverityBadge(ev.severity)}
                  <span className="text-xs text-muted-foreground font-mono">
                    {Math.round((ev.confidence || 0) * 100)}% {language === 'hi' ? 'विश्वसनीयता' : language === 'ta' ? 'நம்பகத்தன்மை' : 'Confidence'}
                  </span>
                </div>
              </div>

              {/* Description */}
              <p className="text-xs text-muted-foreground leading-relaxed">{ev.description}</p>

              {/* Observed vs Expected Values & Supporting Meta */}
              <div className="pt-2 border-t hairline flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-4">
                  {ev.observedValue !== null && ev.observedValue !== undefined && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-muted-foreground">{t('evidence.observedValue')}:</span>
                      <span className="font-semibold text-foreground font-mono">{ev.observedValue}</span>
                    </div>
                  )}
                  {ev.expectedValue !== null && ev.expectedValue !== undefined && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-muted-foreground">{t('evidence.expectedValue')}:</span>
                      <span className="font-semibold text-foreground font-mono">{ev.expectedValue}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 text-muted-foreground text-[11px]">
                  {ev.methodologyVersion && (
                    <span className="px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground font-mono">
                      {ev.methodologyVersion}
                    </span>
                  )}
                  {ev.supportingTenderIds && ev.supportingTenderIds.length > 0 && (
                    <span>
                      {language === 'hi' ? 'संबंधित निविदाएँ:' : language === 'ta' ? 'ஆதரிக்கும் டெண்டர்கள்:' : 'Supporting Tenders:'}{" "}
                      <strong className="text-foreground">{ev.supportingTenderIds.length}</strong>
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
