import { useState } from 'react';
import { Building2, CheckCircle2, HelpCircle, Info, Scale, TrendingUp } from 'lucide-react';
import { Link } from 'wouter';
import { useTranslation } from '../i18n';

export interface BidPositionData {
  companyId: number;
  companyName: string;
  bidAmount: number;
  rank: number;
  isWinner: boolean;
  differenceFromWinner: number;
}

interface BidPositionChartProps {
  bids: BidPositionData[];
  winningAmount: number;
  flaggedCompanies?: string[];
}

export function BidPositionChart({
  bids,
  winningAmount,
  flaggedCompanies = [],
}: BidPositionChartProps) {
  const { t, formatCurrency } = useTranslation();
  const [hoveredBid, setHoveredBid] = useState<BidPositionData | null>(null);

  const sorted = [...bids].sort((a, b) => a.rank - b.rank);
  const maxDelta = Math.max(...sorted.map((b) => b.differenceFromWinner), 12);
  const chartMax = Math.ceil((maxDelta + 4) / 5) * 5; // round up to nearest 5%

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="eyebrow text-muted-foreground flex items-center gap-1.5">
            <Scale className="h-3.5 w-3.5 text-primary" /> {t('charts.relativeDistance')}
          </div>
          <h3 className="text-base font-bold text-foreground">
            {t('charts.submittedVsWinning')}
          </h3>
        </div>
        <div className="text-xs text-muted-foreground">
          {t('charts.winningBid')}: <b className="font-mono text-foreground">{formatCurrency(winningAmount)}</b>
        </div>
      </div>

      {/* Visual Chart Bars */}
      <div className="rounded-xl border hairline bg-card p-5 space-y-4">
        {/* Relative Delta Axes Markers */}
        <div className="relative h-6 border-b hairline text-[10px] font-mono text-muted-foreground flex justify-between px-2">
          <span>0% ({t('charts.winner')})</span>
          <span>+{(chartMax * 0.25).toFixed(1)}%</span>
          <span>+{(chartMax * 0.5).toFixed(1)}%</span>
          <span>+{(chartMax * 0.75).toFixed(1)}%</span>
          <span>+{chartMax.toFixed(1)}%</span>
        </div>

        <div className="space-y-3 pt-2">
          {sorted.map((bid) => {
            const isWinner = bid.isWinner;
            const deltaPct = bid.differenceFromWinner;
            const barWidth = isWinner ? 3 : Math.min(100, Math.max(4, (deltaPct / chartMax) * 100));
            const isFlagged = flaggedCompanies.includes(bid.companyName);

            return (
              <div
                key={bid.companyId}
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
                    <span className="font-mono font-bold text-muted-foreground w-6">#{bid.rank}</span>
                    <Link
                      href={`/companies/${bid.companyId}`}
                      className="font-semibold text-foreground hover:text-primary hover:underline truncate"
                    >
                      {bid.companyName}
                    </Link>
                    {isWinner && (
                      <span className="rounded bg-primary text-primary-foreground px-1.5 py-0.2 text-[9px] font-bold">
                        {t('charts.winner')} (0.0%)
                      </span>
                    )}
                    {isFlagged && !isWinner && (
                      <span className="rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 px-1.5 py-0.2 text-[9px] font-bold font-mono">
                        {t('charts.positioningReview')}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 shrink-0 font-mono">
                    <span className="font-bold text-foreground">{formatCurrency(bid.bidAmount)}</span>
                    <span className={`w-16 text-right font-bold ${isWinner ? 'text-primary' : 'text-muted-foreground'}`}>
                      {isWinner ? '0.0%' : `+${deltaPct.toFixed(1)}%`}
                    </span>
                  </div>
                </div>

                {/* Progress bar container */}
                <div className="relative h-3 w-full rounded-full bg-secondary overflow-hidden">
                  {/* Grid lines */}
                  <div className="absolute inset-0 grid grid-cols-4 pointer-events-none opacity-20 divide-x divide-foreground" />
                  
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isWinner
                        ? 'bg-primary w-2'
                        : isFlagged
                        ? 'bg-amber-500'
                        : 'bg-foreground/40'
                    }`}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-muted-foreground border-t hairline pt-3">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-primary" /> {t('charts.winningBaseline')}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> {t('charts.historicalMarginBand')}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-foreground/40" /> {t('charts.standardDispersed')}
            </span>
          </div>
          <span className="text-[10px]">
            {t('charts.relativeFormula')}
          </span>
        </div>
      </div>
    </div>
  );
}
