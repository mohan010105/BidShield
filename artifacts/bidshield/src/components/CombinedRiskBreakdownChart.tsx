import { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ReferenceLine,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
} from 'recharts';
import { BarChart3, PieChart, ShieldAlert, Info, Layers, Activity } from 'lucide-react';
import { useTranslation } from '../i18n';

export interface IndicatorContributionData {
  indicator: "WINNER_ROTATION" | "COVER_BID" | "PRICE_CLUSTERING" | "PARTICIPATION_NETWORK" | "NEAT_LOSS";
  label: string;
  rawScore: number | null;
  status: "AVAILABLE" | "INSUFFICIENT_DATA" | "NOT_APPLICABLE" | "ERROR";
  baseWeight: number;
  renormalizedWeight: number;
  contributionScore: number;
  evidenceCount: number;
}

interface CombinedRiskBreakdownChartProps {
  indicators: Record<string, IndicatorContributionData>;
  overallScore: number | null;
  screeningLevel: string;
  availableCount: number;
  totalCount?: number;
  className?: string;
}

export function CombinedRiskBreakdownChart({
  indicators,
  overallScore,
  screeningLevel,
  availableCount,
  totalCount = 5,
  className = "",
}: CombinedRiskBreakdownChartProps) {
  const { t, translateStatus } = useTranslation();
  const [viewMode, setViewMode] = useState<"contributions" | "scores" | "radar">("contributions");

  const getIndicatorLabel = (key: string, defaultLabel: string): string => {
    switch (key) {
      case 'WINNER_ROTATION':
        return t('analytics.winnerRotation');
      case 'COVER_BID':
        return t('analytics.coverBid');
      case 'PRICE_CLUSTERING':
        return t('analytics.priceClustering');
      case 'PARTICIPATION_NETWORK':
        return t('analytics.participationNetwork');
      case 'NEAT_LOSS':
        return t('analytics.tooNeatLoss');
      default:
        return defaultLabel;
    }
  };

  const chartData = useMemo(() => {
    return Object.values(indicators).map((ind) => {
      const isAvail = ind.status === "AVAILABLE" && ind.rawScore !== null;
      let barColor = "#94a3b8"; // slate
      if (isAvail) {
        if ((ind.rawScore ?? 0) >= 75) barColor = "#f43f5e"; // rose/high
        else if ((ind.rawScore ?? 0) >= 50) barColor = "#f59e0b"; // amber/elevated
        else if ((ind.rawScore ?? 0) >= 25) barColor = "#3b82f6"; // blue/moderate
        else barColor = "#10b981"; // emerald/low
      }

      const localizedName = getIndicatorLabel(ind.indicator, ind.label);
      const shortName = localizedName.replace(" Screening", "").replace(" Analysis", "");

      return {
        key: ind.indicator,
        name: localizedName,
        shortName,
        score: isAvail ? ind.rawScore : 0,
        rawScore: ind.rawScore,
        contribution: ind.contributionScore,
        baseWeightPct: Math.round(ind.baseWeight * 100),
        effectiveWeightPct: Math.round(ind.renormalizedWeight * 100),
        evidenceCount: ind.evidenceCount,
        status: ind.status,
        isAvailable: isAvail,
        barColor,
      };
    });
  }, [indicators, t]);

  const radarData = useMemo(() => {
    return chartData.map((d) => ({
      indicator: d.shortName,
      ScreeningScore: d.isAvailable ? d.score : 0,
      fullMark: 100,
    }));
  }, [chartData]);

  function getLevelBadge(level: string) {
    const localized = translateStatus(level);
    if (level.includes("HIGH")) {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-500 border border-rose-500/20">
          {localized}
        </span>
      );
    }
    if (level.includes("ELEVATED")) {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-500 border border-amber-500/20">
          {localized}
        </span>
      );
    }
    if (level.includes("MODERATE")) {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-500 border border-blue-500/20">
          {localized}
        </span>
      );
    }
    if (level.includes("LOW")) {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-500 border border-emerald-500/20">
          {localized}
        </span>
      );
    }
    return (
      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-border">
        {localized || level}
      </span>
    );
  }

  return (
    <div className={`card-panel space-y-4 ${className}`}>
      {/* Top summary row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b hairline">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              {t('charts.indicatorBreakdown')}
            </h4>
            {getLevelBadge(screeningLevel)}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t('charts.aggregationNote', { available: availableCount, total: totalCount })}
          </p>
        </div>

        {/* View toggles */}
        <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-lg self-start sm:self-auto text-xs">
          <button
            onClick={() => setViewMode("contributions")}
            className={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1.5 ${
              viewMode === "contributions"
                ? "bg-card text-foreground shadow-xs font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            {t('charts.contributions')}
          </button>
          <button
            onClick={() => setViewMode("scores")}
            className={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1.5 ${
              viewMode === "scores"
                ? "bg-card text-foreground shadow-xs font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            {t('charts.detectorScores')}
          </button>
          <button
            onClick={() => setViewMode("radar")}
            className={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1.5 ${
              viewMode === "radar"
                ? "bg-card text-foreground shadow-xs font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <PieChart className="w-3.5 h-3.5" />
            {t('charts.radarProfile')}
          </button>
        </div>
      </div>

      {/* Main Chart Area */}
      <div className="min-h-[260px] w-full pt-1">
        {viewMode === "contributions" && (
          <div className="space-y-3">
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.15} />
                  <XAxis
                    type="number"
                    domain={[0, 30]}
                    tick={{ fontSize: 11, fill: "var(--muted-foreground, #64748b)" }}
                    unit={` ${t('charts.pts')}`}
                  />
                  <YAxis
                    type="category"
                    dataKey="shortName"
                    tick={{ fontSize: 11, fill: "var(--foreground, #0f172a)" }}
                    width={130}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="bg-popover border border-border shadow-md rounded-lg p-3 text-xs space-y-1 z-50">
                          <p className="font-semibold text-foreground">{d.name}</p>
                          <div className="space-y-0.5 text-muted-foreground">
                            {d.isAvailable ? (
                              <>
                                <p>
                                  {t('charts.rawScore')}:{" "}
                                  <strong className="text-foreground">{d.rawScore} / 100</strong>
                                </p>
                                <p>
                                  {t('charts.renormalizedWeight')}:{" "}
                                  <strong className="text-foreground">{d.effectiveWeightPct}%</strong>{" "}
                                  (base: {d.baseWeightPct}%)
                                </p>
                                <p className="text-primary font-semibold">
                                  {t('charts.contributionScore')}: +{d.contribution.toFixed(1)} {t('charts.pts')}
                                </p>
                              </>
                            ) : (
                              <p className="text-amber-500 font-medium">
                                {t('charts.insufficientHistorical')}
                              </p>
                            )}
                            <p>{t('charts.evidenceRecordsCount')}: {d.evidenceCount}</p>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="contribution" radius={[0, 4, 4, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.isAvailable ? entry.barColor : "#cbd5e1"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Overall Score Calculation Bar */}
            <div className="p-3 rounded-lg bg-muted/30 border border-border/80 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">{t('charts.combinedFormula')}:</span>
                <span className="font-mono text-foreground font-semibold">
                  Σ(score × weight) ={" "}
                  {overallScore !== null ? `${overallScore.toFixed(1)} / 100` : t('status.insufficientData')}
                </span>
              </div>
            </div>
          </div>
        )}

        {viewMode === "scores" && (
          <div className="space-y-2">
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.15} />
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    tick={{ fontSize: 11, fill: "var(--muted-foreground, #64748b)" }}
                  />
                  <YAxis
                    type="category"
                    dataKey="shortName"
                    tick={{ fontSize: 11, fill: "var(--foreground, #0f172a)" }}
                    width={130}
                  />
                  <ReferenceLine x={25} stroke="#3b82f6" strokeDasharray="3 3" opacity={0.5} label={{ value: "Mod", position: "top", fontSize: 10, fill: "#3b82f6" }} />
                  <ReferenceLine x={50} stroke="#f59e0b" strokeDasharray="3 3" opacity={0.5} label={{ value: "Elev", position: "top", fontSize: 10, fill: "#f59e0b" }} />
                  <ReferenceLine x={75} stroke="#f43f5e" strokeDasharray="3 3" opacity={0.5} label={{ value: "High", position: "top", fontSize: 10, fill: "#f43f5e" }} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="bg-popover border border-border shadow-md rounded-lg p-3 text-xs space-y-1 z-50">
                          <p className="font-semibold text-foreground">{d.name}</p>
                          <div className="space-y-0.5 text-muted-foreground">
                            {d.isAvailable ? (
                              <>
                                <p>
                                  {t('charts.rawScore')}:{" "}
                                  <strong className="text-foreground">{d.rawScore} / 100</strong>
                                </p>
                                <p>
                                  {t('common.status')}: <strong className="text-foreground">{translateStatus(d.status)}</strong>
                                </p>
                              </>
                            ) : (
                              <p className="text-amber-500 font-medium">
                                {t('charts.insufficientHistorical')}
                              </p>
                            )}
                            <p>{t('charts.evidenceRecordsCount')}: {d.evidenceCount}</p>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.isAvailable ? entry.barColor : "#cbd5e1"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-6 text-[11px] text-muted-foreground pt-1">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> {t('status.low')} (0–24)</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> {t('status.moderate')} (25–49)</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> {t('status.elevated')} (50–74)</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> {t('status.high')} (75–100)</span>
            </div>
          </div>
        )}

        {viewMode === "radar" && (
          <div className="h-[240px] w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                <PolarGrid stroke="#94a3b8" strokeDasharray="3 3" opacity={0.3} />
                <PolarAngleAxis
                  dataKey="indicator"
                  tick={{ fontSize: 11, fill: "var(--foreground, #0f172a)" }}
                />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10, fill: "#64748b" }} />
                <Radar
                  name={t('analytics.score')}
                  dataKey="ScreeningScore"
                  stroke="#6366f1"
                  fill="#6366f1"
                  fillOpacity={0.4}
                />
                <Legend />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Grid of 5 Indicator Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 pt-2 border-t hairline">
        {chartData.map((d) => (
          <div
            key={d.key}
            className="p-2.5 rounded-lg border border-border/80 bg-muted/15 flex flex-col justify-between space-y-1"
          >
            <div>
              <p className="text-[11px] font-medium text-muted-foreground truncate" title={d.name}>
                {d.shortName}
              </p>
              <div className="flex items-baseline gap-1 mt-1">
                {d.isAvailable ? (
                  <>
                    <span className="text-base font-bold text-foreground font-mono">{d.rawScore}</span>
                    <span className="text-[10px] text-muted-foreground">/100</span>
                  </>
                ) : (
                  <span className="text-xs font-semibold text-muted-foreground">{t('status.insufficient')}</span>
                )}
              </div>
            </div>

            <div className="pt-1.5 border-t hairline text-[10px] text-muted-foreground flex justify-between items-center">
              <span>{d.effectiveWeightPct}%</span>
              <span className="font-semibold text-foreground">
                {d.isAvailable ? `+${d.contribution.toFixed(1)}` : "—"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
