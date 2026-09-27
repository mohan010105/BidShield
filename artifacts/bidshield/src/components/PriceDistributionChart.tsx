import { useState } from 'react';
import { Building2, CheckCircle2, HelpCircle, Info, Scale, TrendingUp, Zap } from 'lucide-react';
import { Link } from 'wouter';

export interface BidPositionItem {
  companyId: number;
  companyName: string;
  bidAmount: number;
  rank: number;
  isWinner: boolean;
  differenceFromWinner: number;
}

interface PriceDistributionChartProps {
  bids: BidPositionItem[];
  winningAmount: number;
  estimatedValue?: number;
  cv?: number;
  spreadPct?: number;
  flaggedCompanies?: string[];
  title?: string;
}

function fmtCurrency(value?: number | null) {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
}

export function PriceDistributionChart({
  bids,
  winningAmount,
  estimatedValue,
  cv,
  spreadPct,
  flaggedCompanies = [],
}: PriceDistributionChartProps) {
  const [hoveredBid, setHoveredBid] = useState<BidPositionItem | null>(null);

  const sorted = [...bids].sort((a, b) => a.bidAmount - b.bidAmount);
  const maxDelta = Math.max(...sorted.map((b) => b.differenceFromWinner), 10);
  const chartMax = Math.ceil((maxDelta + 2) / 5) * 5; // e.g. 5%, 10%, 15%

  const isTightlyClustered = cv !== undefined && cv < 0.015;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="eyebrow text-muted-foreground flex items-center gap-1.5">
            <Scale className="h-3.5 w-3.5 text-primary" /> Tender Price Dispersion
          </div>
          <h3 className="text-base font-bold text-foreground">
            Submitted Bid Price Distribution vs. Winning Baseline
          </h3>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-muted-foreground">
            Winning: <b className="font-mono text-foreground">{fmtCurrency(winningAmount)}</b>
          </span>
          {estimatedValue && estimatedValue > 0 && (
            <span className="text-muted-foreground border-l hairline pl-3">
              Estimate: <b className="font-mono text-foreground">{fmtCurrency(estimatedValue)}</b>
            </span>
          )}
        </div>
      </div>

      {isTightlyClustered && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 flex items-center justify-between text-xs text-amber-800 dark:text-amber-200">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>
              <b>Concentrated Bid Cluster:</b> All submitted bids fall within a <b>{spreadPct?.toFixed(1) ?? 'narrow'}%</b> spread (CV: <b>{cv?.toFixed(4)}</b>).
            </span>
          </div>
          <span className="font-mono text-[11px] uppercase tracking-wider font-bold">Review indicator</span>
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
          {sorted.map((bid, idx) => {
            const isWinner = bid.isWinner || bid.bidAmount === winningAmount;
            const deltaPct = winningAmount > 0 ? ((bid.bidAmount - winningAmount) / winningAmount) * 100 : 0;
            const barWidth = isWinner ? 3 : Math.min(100, Math.max(5, (deltaPct / chartMax) * 100));
            const isFlagged = flaggedCompanies.includes(bid.companyName);
            const pctOfEst = estimatedValue && estimatedValue > 0 ? (bid.bidAmount / estimatedValue) * 100 : null;

            return (
              <div
                key={`${bid.companyId}-${idx}`}
                onMouseEnter={() => setHoveredBid(bid)}
                onMouseLeave={() => setHoveredBid(null)}
                className={`rounded-lg border p-3.5 transition-all ${
                  isWinner
                    ? 'bg-primary/5 border-primary/30'
                    : isFlagged
                    ? 'bg-amber-500/5 border-amber-500/30 ring-1 ring-amber-500/20'
                    : 'bg-secondary/20 border-border hover:bg-secondary/40'
                }`}
              >
                <div className="flex items-center justify-between gap-3 text-xs mb-2">
                  <div className="flex items-center gap-2 truncate">
                    <span className="font-mono font-bold text-muted-foreground w-6">#{bid.rank || idx + 1}</span>
                    <Link
                      href={`/companies/${bid.companyId}`}
                      className="font-semibold text-foreground hover:text-primary hover:underline truncate"
                    >
                      {bid.companyName}
                    </Link>
                    {isWinner && (
                      <span className="rounded bg-primary text-primary-foreground px-1.5 py-0.2 text-[9px] font-bold">
                        WINNING BID (0.0%)
                      </span>
                    )}
                    {pctOfEst && (
                      <span className="text-[10px] text-muted-foreground font-mono hidden sm:inline">
                        ({pctOfEst.toFixed(1)}% of estimate)
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 shrink-0 font-mono">
                    <span className="font-bold text-foreground">{fmtCurrency(bid.bidAmount)}</span>
                    <span className={`w-16 text-right font-bold ${isWinner ? 'text-primary' : 'text-muted-foreground'}`}>
                      {isWinner ? '0.0%' : `+${deltaPct.toFixed(1)}%`}
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
                        : isFlagged
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

        {/* Chart Footer with dispersion summary */}
        <div className="mt-4 pt-3 border-t hairline flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            {cv !== undefined && (
              <span>
                Coefficient of Variation: <b className="font-mono text-foreground">{cv.toFixed(4)}</b>
              </span>
            )}
            {spreadPct !== undefined && (
              <span>
                Total Spread: <b className="font-mono text-foreground">{spreadPct.toFixed(1)}%</b>
              </span>
            )}
          </div>
          <span className="text-[11px] text-muted-foreground italic">
            Observed relative to lowest compliant bid
          </span>
        </div>
      </div>
    </div>
  );
}
