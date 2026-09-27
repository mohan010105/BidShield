import { useState } from 'react';
import { HelpCircle, Info, Scale, TrendingUp, Zap } from 'lucide-react';

interface Observation {
  tenderNumber: string;
  tenderDate: string;
  category: string;
  bidAmount: number;
  winningBid: number;
  relativeDistancePct: number;
  isWinner: boolean;
  isRepeatedPosition?: boolean;
}

interface CompanyPricePositioningChartProps {
  companyName?: string;
  medianDistancePct?: number | null;
  medianDistance?: number | null;
  averageDistancePct?: number | null;
  avgDistance?: number | null;
  stdDevPct?: number | null;
  stdDev?: number | null;
  repeatedCount?: number;
  repeatedMarginCount?: number;
  observations?: Observation[];
}

function fmtCurrency(value?: number | null) {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
}

export function CompanyPricePositioningChart({
  companyName,
  medianDistancePct,
  medianDistance,
  averageDistancePct,
  avgDistance,
  stdDevPct,
  stdDev,
  repeatedCount = 0,
  repeatedMarginCount = 0,
  observations = [],
}: CompanyPricePositioningChartProps) {
  const [hoveredObs, setHoveredObs] = useState<Observation | null>(null);

  const effectiveMedian = medianDistancePct ?? medianDistance ?? null;
  const effectiveAvg = averageDistancePct ?? avgDistance ?? null;
  const effectiveStdDev = stdDevPct ?? stdDev ?? null;
  const effectiveRepeated = repeatedCount || repeatedMarginCount || 0;

  const losingObs = (observations || []).filter((o) => !o.isWinner);
  const maxDelta = losingObs.length > 0 ? Math.max(...losingObs.map((o) => o.relativeDistancePct), 12) : 12;
  const chartMax = Math.ceil((maxDelta + 3) / 5) * 5;

  if (!observations || observations.length === 0) {
    return (
      <div className="rounded-xl border hairline bg-secondary/15 p-6 text-center text-xs text-muted-foreground">
        <Info className="h-5 w-5 mx-auto mb-2 text-muted-foreground opacity-60" />
        <p className="font-semibold text-foreground">No historical bid distance records</p>
        <p className="mt-1">Additional competitive bidding records are needed to calculate historical positioning.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="eyebrow text-muted-foreground flex items-center gap-1.5">
            <Scale className="h-3.5 w-3.5 text-primary" /> Price Positioning History
          </div>
          <h3 className="text-base font-bold text-foreground">
            Losing Bid Distances from Winning Benchmark (0%)
          </h3>
        </div>
        {effectiveMedian !== null && effectiveMedian !== undefined && (
          <div className="text-xs text-muted-foreground">
            Historical Median: <b className="font-mono text-primary">+{effectiveMedian.toFixed(1)}%</b>
          </div>
        )}
      </div>

      {effectiveRepeated >= 2 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 flex items-center justify-between text-xs text-amber-800 dark:text-amber-200">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>
              <b>Repeated Positioning Pattern:</b> Company submitted bids at approximately <b>+{effectiveMedian !== null && effectiveMedian !== undefined ? effectiveMedian.toFixed(1) : '—'}%</b> (±1.2%) in <b>{effectiveRepeated}</b> comparable tenders.
            </span>
          </div>
          <span className="font-mono text-[11px] uppercase tracking-wider font-bold">Observation</span>
        </div>
      )}

      {/* Visual Chart Bars */}
      <div className="rounded-xl border hairline bg-card p-5 space-y-4">
        {/* Scale Axis */}
        <div className="relative h-6 border-b hairline text-[10px] font-mono text-muted-foreground flex justify-between px-2">
          <span>0% (Winner)</span>
          <span>+{(chartMax * 0.25).toFixed(1)}%</span>
          <span>+{(chartMax * 0.5).toFixed(1)}%</span>
          <span>+{(chartMax * 0.75).toFixed(1)}%</span>
          <span>+{chartMax.toFixed(1)}%</span>
        </div>

        <div className="space-y-3 pt-2">
          {observations.slice(-8).map((obs, idx) => {
            const isWinner = obs.isWinner;
            const deltaPct = obs.relativeDistancePct;
            const barWidth = isWinner ? 3 : Math.min(100, Math.max(5, (deltaPct / chartMax) * 100));
            const isRepeated = obs.isRepeatedPosition;

            return (
              <div
                key={`${obs.tenderNumber}-${idx}`}
                onMouseEnter={() => setHoveredObs(obs)}
                onMouseLeave={() => setHoveredObs(null)}
                className={`rounded-lg border p-3.5 transition-all ${
                  isWinner
                    ? 'bg-primary/5 border-primary/30'
                    : isRepeated
                    ? 'bg-amber-500/5 border-amber-500/30 ring-1 ring-amber-500/20'
                    : 'bg-secondary/20 border-border hover:bg-secondary/40'
                }`}
              >
                <div className="flex items-center justify-between gap-3 text-xs mb-2">
                  <div className="flex items-center gap-2 truncate">
                    <span className="font-mono font-bold text-foreground">{obs.tenderNumber}</span>
                    <span className="text-muted-foreground">· {obs.category}</span>
                    {isWinner && (
                      <span className="rounded bg-primary text-primary-foreground px-1.5 py-0.2 text-[9px] font-bold">
                        WON (0.0%)
                      </span>
                    )}
                    {isRepeated && !isWinner && (
                      <span className="rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 px-1.5 py-0.2 text-[9px] font-bold font-mono">
                        REPEATED DELTA
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 shrink-0 font-mono">
                    <span className="font-bold text-foreground">{fmtCurrency(obs.bidAmount)}</span>
                    <span className={`w-16 text-right font-bold ${isWinner ? 'text-primary' : 'text-muted-foreground'}`}>
                      {isWinner ? '0.0%' : deltaPct !== null && deltaPct !== undefined ? `+${deltaPct.toFixed(1)}%` : '—'}
                    </span>
                  </div>
                </div>

                {/* Progress bar container */}
                <div className="relative h-3 w-full rounded-full bg-secondary overflow-hidden">
                  <div className="absolute inset-0 grid grid-cols-4 pointer-events-none opacity-20 divide-x divide-foreground" />
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isWinner
                        ? 'bg-primary w-2'
                        : isRepeated
                        ? 'bg-amber-500'
                        : 'bg-chart-2'
                    }`}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Positioning Summary KPIs */}
        <div className="mt-4 pt-3 border-t hairline grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-muted-foreground">Median Distance: </span>
            <b className="font-mono text-foreground font-bold">
              {effectiveMedian !== null && effectiveMedian !== undefined ? `+${effectiveMedian.toFixed(1)}%` : '—'}
            </b>
          </div>
          <div>
            <span className="text-muted-foreground">Average Distance: </span>
            <b className="font-mono text-foreground font-bold">
              {effectiveAvg !== null && effectiveAvg !== undefined ? `+${effectiveAvg.toFixed(1)}%` : '—'}
            </b>
          </div>
          <div>
            <span className="text-muted-foreground">Dispersion Std Dev: </span>
            <b className="font-mono text-foreground font-bold">
              {effectiveStdDev !== null && effectiveStdDev !== undefined ? `±${effectiveStdDev.toFixed(2)}%` : '—'}
            </b>
          </div>
          <div>
            <span className="text-muted-foreground">Repeated Tenders: </span>
            <b className="font-mono text-foreground font-bold">{effectiveRepeated} tenders</b>
          </div>
        </div>
      </div>
    </div>
  );
}
