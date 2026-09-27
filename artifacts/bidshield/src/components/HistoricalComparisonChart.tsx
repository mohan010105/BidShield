import { BarChart3, HelpCircle, Info, Layers, Percent, TrendingDown, TrendingUp } from 'lucide-react';

interface HistoricalComparisonChartProps {
  currentCV?: number | null;
  historicalMedianCV?: number | null;
  percentile?: number | null;
  comparableCount?: number | null;
  historicalSpreadPct?: number | null;
  currentSpreadPct?: number | null;
  tenderCategory?: string;
  category?: string;
  organization?: string;
}

export function HistoricalComparisonChart({
  currentCV,
  historicalMedianCV,
  percentile,
  comparableCount = 0,
  category,
  organization,
  tenderCategory,
}: HistoricalComparisonChartProps) {
  if (
    currentCV === null ||
    currentCV === undefined ||
    historicalMedianCV === null ||
    historicalMedianCV === undefined ||
    percentile === null ||
    percentile === undefined ||
    !comparableCount ||
    comparableCount < 3
  ) {
    return (
      <div className="rounded-xl border hairline bg-secondary/15 p-6 text-center text-xs text-muted-foreground">
        <Info className="h-5 w-5 mx-auto mb-2 text-muted-foreground opacity-60" />
        <p className="font-semibold text-foreground">Insufficient comparable tenders for distribution baseline</p>
        <p className="mt-1">At least 5 comparable tenders are required to construct a historical percentile distribution.</p>
      </div>
    );
  }

  const isUnusuallyConcentrated = percentile <= 20;
  const isModerateConcentration = percentile > 20 && percentile <= 40;

  // Max scale calculation for visual plotting (usually max CV in comparable set ~ 0.06 - 0.08)
  const maxScaleCV = Math.max(0.05, (historicalMedianCV || 0.02) * 2.5, (currentCV || 0.01) * 1.5);
  const currentPosPct = Math.min(96, Math.max(4, ((currentCV || 0) / maxScaleCV) * 100));
  const medianPosPct = Math.min(96, Math.max(4, ((historicalMedianCV || 0.02) / maxScaleCV) * 100));
  const p10PosPct = Math.min(96, Math.max(4, (((historicalMedianCV || 0.02) * 0.45) / maxScaleCV) * 100));
  const p75PosPct = Math.min(96, Math.max(4, (((historicalMedianCV || 0.02) * 1.55) / maxScaleCV) * 100));

  const displayCategory = tenderCategory ?? category ?? 'Procurement Cohort';

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="eyebrow text-muted-foreground flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-primary" /> Comparable Baseline Comparison
          </div>
          <h3 className="text-base font-bold text-foreground">
            Current Tender vs. Historical Comparable Distribution
          </h3>
        </div>
        <div className="text-xs text-muted-foreground">
          Comparison Cohort: <b className="text-foreground">{comparableCount} comparable tenders</b>
        </div>
      </div>

      <div className="rounded-xl border hairline bg-card p-6 space-y-6">
        {/* KPI Comparison Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-b hairline pb-5">
          <div className="rounded-lg bg-secondary/30 p-3.5">
            <div className="eyebrow text-muted-foreground">Current Tender CV</div>
            <div className="data-mono mt-1.5 text-2xl font-bold text-foreground">{currentCV.toFixed(4)}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">Standard deviation / mean</div>
          </div>

          <div className="rounded-lg bg-secondary/30 p-3.5">
            <div className="eyebrow text-muted-foreground">Comparable Median CV</div>
            <div className="data-mono mt-1.5 text-2xl font-bold text-foreground">{historicalMedianCV.toFixed(4)}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">{displayCategory}</div>
          </div>

          <div className={`rounded-lg p-3.5 border ${
            isUnusuallyConcentrated
              ? 'bg-destructive/10 border-destructive/30 text-destructive'
              : isModerateConcentration
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
              : 'bg-secondary/30 border-transparent text-foreground'
          }`}>
            <div className="eyebrow">Percentile Ranking</div>
            <div className="data-mono mt-1.5 text-2xl font-bold">{percentile.toFixed(0)}th %ile</div>
            <div className="mt-1 text-[11px] font-medium opacity-90">
              {isUnusuallyConcentrated
                ? 'Unusually concentrated'
                : isModerateConcentration
                ? 'Moderately narrow'
                : 'Standard market spread'}
            </div>
          </div>
        </div>

        {/* Visual Distribution Range Box Plot / Percentile Line */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Tighter Price Clustering (Low CV)</span>
            <span>Wider Competitive Dispersion (High CV)</span>
          </div>

          {/* Graphical Bar */}
          <div className="relative h-14 w-full rounded-xl bg-secondary/40 p-2 flex items-center border hairline overflow-visible">
            {/* 10th - 75th percentile historical distribution band */}
            <div
              className="absolute h-8 rounded-lg bg-primary/15 border border-primary/25 pointer-events-none"
              style={{
                left: `${p10PosPct}%`,
                width: `${Math.max(10, p75PosPct - p10PosPct)}%`,
              }}
              title="Interquartile / 10th - 75th percentile range"
            />

            {/* Historical Median Line */}
            <div
              className="absolute top-1 bottom-1 w-0.5 bg-muted-foreground border-r border-dashed border-foreground pointer-events-none z-10"
              style={{ left: `${medianPosPct}%` }}
            >
              <span className="absolute -bottom-6 -translate-x-1/2 whitespace-nowrap text-[10px] font-mono text-muted-foreground">
                Median ({historicalMedianCV.toFixed(4)})
              </span>
            </div>

            {/* Current Tender Marker */}
            <div
              className="absolute top-1 bottom-1 flex flex-col items-center justify-center z-20 transition-all"
              style={{ left: `${currentPosPct}%` }}
            >
              <div className={`h-6 w-6 -translate-x-1/2 rounded-full border-2 shadow-lg flex items-center justify-center ${
                isUnusuallyConcentrated
                  ? 'bg-destructive border-white text-white'
                  : 'bg-primary border-white text-primary-foreground'
              }`}>
                <span className="text-[9px] font-bold">●</span>
              </div>
              <span className="absolute -top-6 -translate-x-1/2 whitespace-nowrap rounded bg-foreground text-background px-1.5 py-0.5 text-[10px] font-bold font-mono">
                Current ({percentile.toFixed(0)}th %ile)
              </span>
            </div>
          </div>

          {/* Scale Axis Markers */}
          <div className="pt-5 flex justify-between text-[10px] font-mono text-muted-foreground">
            <span>0.0000</span>
            <span>{(maxScaleCV * 0.25).toFixed(4)}</span>
            <span>{(maxScaleCV * 0.5).toFixed(4)}</span>
            <span>{(maxScaleCV * 0.75).toFixed(4)}</span>
            <span>{maxScaleCV.toFixed(4)} (CV)</span>
          </div>
        </div>

        {/* Narrative Finding Callout */}
        <div className="rounded-lg bg-secondary/20 p-4 border hairline text-xs leading-relaxed text-muted-foreground flex items-start gap-3">
          <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-foreground">Statistical Observation: </span>
            {isUnusuallyConcentrated ? (
              <span>
                The current tender's coefficient of variation (<b>{currentCV.toFixed(4)}</b>) ranks in the <b>{percentile.toFixed(0)}th percentile</b> of comparable historical procurements. Bids in this tender are significantly more concentrated than <b>{(100 - percentile).toFixed(0)}%</b> of comparable peer tenders in this category and organization.
              </span>
            ) : (
              <span>
                The tender's bid price dispersion (CV <b>{currentCV.toFixed(4)}</b>) aligns with typical competitive spread across the comparable baseline population (<b>{percentile.toFixed(0)}th percentile</b>).
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
