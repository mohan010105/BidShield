import { PieChart, TrendingDown, CheckCircle2, XCircle } from 'lucide-react';

interface NeatLossWinLossDistributionProps {
  participationCount: number;
  winCount: number;
  lossCount: number;
  winRate: number; // 0 to 1
  lossRate: number; // 0 to 1
  comparisonGroup: string;
  meanBidRank?: number;
  rankStdDev?: number;
  meanRelativeGap?: number | null;
  medianRelativeGap?: number | null;
  relativeGapCv?: number | null;
  relativeGapStdDev?: number | null;
}

export function NeatLossWinLossDistribution({
  participationCount,
  winCount,
  lossCount,
  winRate,
  lossRate,
  comparisonGroup,
  meanBidRank,
  rankStdDev,
  meanRelativeGap,
  medianRelativeGap,
  relativeGapCv,
  relativeGapStdDev,
}: NeatLossWinLossDistributionProps) {
  const winPct = Math.round(winRate * 100);
  const lossPct = Math.round(lossRate * 100);

  return (
    <div className="rounded-xl border hairline bg-card p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="eyebrow text-muted-foreground flex items-center gap-1.5">
            <PieChart className="h-3.5 w-3.5 text-primary" /> Participation & Win/Loss Balance
          </div>
          <h4 className="text-sm font-bold text-foreground">
            Bidding Outcomes in {comparisonGroup}
          </h4>
        </div>
        <div className="text-xs text-muted-foreground">
          Total Participations: <span className="font-mono font-bold text-foreground">{participationCount}</span>
        </div>
      </div>

      {/* Segmented Proportion Bar */}
      <div className="space-y-1.5">
        <div className="h-3.5 w-full bg-secondary/40 rounded-full overflow-hidden flex">
          {winCount > 0 && (
            <div
              style={{ width: `${winPct}%` }}
              className="bg-emerald-500 h-full transition-all duration-500"
              title={`Won: ${winCount} (${winPct}%)`}
            />
          )}
          {lossCount > 0 && (
            <div
              style={{ width: `${lossPct}%` }}
              className="bg-rose-500/80 h-full transition-all duration-500"
              title={`Lost: ${lossCount} (${lossPct}%)`}
            />
          )}
        </div>
        <div className="flex justify-between text-xs text-muted-foreground px-0.5">
          <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
            <CheckCircle2 className="h-3.5 w-3.5" /> Won: {winCount} ({winPct}%)
          </span>
          <span className="flex items-center gap-1.5 text-rose-400 font-medium">
            <XCircle className="h-3.5 w-3.5" /> Lost: {lossCount} ({lossPct}%)
          </span>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t hairline">
        <div className="rounded-lg bg-secondary/20 p-2.5">
          <div className="text-[10px] text-muted-foreground uppercase font-mono">Mean Rank</div>
          <div className="text-base font-bold font-mono text-foreground mt-0.5">
            {meanBidRank ? `Rank ${meanBidRank.toFixed(1)}` : '—'}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            Std Dev: {rankStdDev !== undefined ? `±${rankStdDev.toFixed(2)}` : '—'}
          </div>
        </div>

        <div className="rounded-lg bg-secondary/20 p-2.5">
          <div className="text-[10px] text-muted-foreground uppercase font-mono">Median Gap</div>
          <div className="text-base font-bold font-mono text-amber-400 mt-0.5">
            {medianRelativeGap !== null && medianRelativeGap !== undefined
              ? `+${medianRelativeGap.toFixed(2)}%`
              : '—'}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            Mean: {meanRelativeGap !== null && meanRelativeGap !== undefined ? `+${meanRelativeGap.toFixed(2)}%` : '—'}
          </div>
        </div>

        <div className="rounded-lg bg-secondary/20 p-2.5">
          <div className="text-[10px] text-muted-foreground uppercase font-mono">Gap Dispersion (CV)</div>
          <div className="text-base font-bold font-mono text-foreground mt-0.5">
            {relativeGapCv !== null && relativeGapCv !== undefined ? relativeGapCv.toFixed(4) : '—'}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            Std Dev: {relativeGapStdDev !== null && relativeGapStdDev !== undefined ? `±${relativeGapStdDev.toFixed(2)}%` : '—'}
          </div>
        </div>

        <div className="rounded-lg bg-secondary/20 p-2.5">
          <div className="text-[10px] text-muted-foreground uppercase font-mono">Loss Profile</div>
          <div className="text-base font-bold font-mono text-foreground mt-0.5 flex items-center gap-1">
            {lossPct}% <TrendingDown className="h-3.5 w-3.5 text-rose-400" />
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            {lossCount} losing outcomes
          </div>
        </div>
      </div>
    </div>
  );
}
