import { useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { Scale, Info } from 'lucide-react';

export interface LosingObservationItem {
  tenderId: number;
  tenderNumber: string;
  title: string;
  tenderDate: string;
  bidAmount: number;
  winningBidAmount: number;
  gapAmount: number;
  relativeGapPct: number;
  bidRank: number;
  winnerCompanyName?: string;
}

interface NeatLossGapChartProps {
  observations: LosingObservationItem[];
  medianRelativeGap?: number | null;
  companyName: string;
}

function fmtCurrency(val: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(val);
}

function fmtShortDate(dateStr: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? dateStr : `${d.getDate()}/${d.getMonth() + 1}`;
}

export function NeatLossGapChart({
  observations,
  medianRelativeGap,
  companyName,
}: NeatLossGapChartProps) {
  const chartData = useMemo(() => {
    return observations.map((obs, idx) => ({
      index: idx + 1,
      label: obs.tenderDate ? fmtShortDate(obs.tenderDate) : `#${idx + 1}`,
      tenderNumber: obs.tenderNumber,
      title: obs.title,
      tenderDate: obs.tenderDate,
      relativeGapPct: Number(obs.relativeGapPct.toFixed(2)),
      bidAmount: obs.bidAmount,
      winningBidAmount: obs.winningBidAmount,
      gapAmount: obs.gapAmount,
      bidRank: obs.bidRank,
      winner: obs.winnerCompanyName ?? 'Winner',
    }));
  }, [observations]);

  if (!observations || observations.length === 0) {
    return (
      <div className="rounded-xl border hairline bg-card/50 p-8 text-center text-xs text-muted-foreground">
        <Info className="h-5 w-5 mx-auto mb-2 text-muted-foreground opacity-60" />
        <p className="font-semibold text-foreground">No Historical Losing Observations Recorded</p>
        <p className="mt-1">This company has not submitted losing bids in the analyzed comparable dataset.</p>
      </div>
    );
  }

  const maxGap = Math.max(...observations.map((o) => o.relativeGapPct), 5);
  const yDomainMax = Math.ceil(maxGap * 1.25);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="eyebrow text-muted-foreground flex items-center gap-1.5">
            <Scale className="h-3.5 w-3.5 text-primary" /> Relative Losing-Bid Distance Over Time
          </div>
          <h3 className="text-base font-bold text-foreground">
            {companyName} Losing Bid Margins Above Winner (0% Baseline)
          </h3>
        </div>
        {medianRelativeGap !== null && medianRelativeGap !== undefined && (
          <div className="text-xs text-muted-foreground bg-primary/10 border border-primary/20 rounded-md px-2.5 py-1">
            Historical Median Gap: <span className="font-mono font-bold text-primary">+{medianRelativeGap.toFixed(2)}%</span>
          </div>
        )}
      </div>

      <div className="rounded-xl border hairline bg-card p-4">
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" vertical={false} />
              <XAxis
                dataKey="label"
                stroke="var(--muted-foreground)"
                fontSize={11}
                tickLine={false}
                dy={8}
              />
              <YAxis
                stroke="var(--muted-foreground)"
                fontSize={11}
                tickLine={false}
                unit="%"
                domain={[0, yDomainMax]}
                dx={-5}
              />
              {/* Winning baseline */}
              <ReferenceLine
                y={0}
                stroke="#10b981"
                strokeWidth={1.5}
                label={{
                  value: 'Winner (0%)',
                  position: 'insideTopLeft',
                  fill: '#10b981',
                  fontSize: 10,
                }}
              />
              {/* Median gap reference */}
              {medianRelativeGap !== null && medianRelativeGap !== undefined && (
                <ReferenceLine
                  y={medianRelativeGap}
                  stroke="#f59e0b"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{
                    value: `Median +${medianRelativeGap.toFixed(2)}%`,
                    position: 'insideTopRight',
                    fill: '#f59e0b',
                    fontSize: 10,
                  }}
                />
              )}
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="rounded-lg border border-border bg-popover/95 p-3 shadow-xl backdrop-blur text-xs space-y-1.5 max-w-xs">
                        <div className="font-semibold text-foreground border-b border-border/50 pb-1">
                          {data.tenderNumber}
                        </div>
                        <div className="text-muted-foreground line-clamp-1">{data.title}</div>
                        <div className="flex justify-between gap-4 pt-1">
                          <span className="text-muted-foreground">Relative Gap:</span>
                          <span className="font-mono font-bold text-amber-400">+{data.relativeGapPct}%</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">Company Bid:</span>
                          <span className="font-mono text-foreground">{fmtCurrency(data.bidAmount)}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">Winning Bid:</span>
                          <span className="font-mono text-emerald-400">{fmtCurrency(data.winningBidAmount)}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">Rank in Tender:</span>
                          <span className="font-mono font-bold text-foreground">Rank {data.bidRank}</span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Line
                type="monotone"
                dataKey="relativeGapPct"
                stroke="#6366f1"
                strokeWidth={2.5}
                dot={{ r: 4, fill: '#6366f1', stroke: '#1e1b4b', strokeWidth: 2 }}
                activeDot={{ r: 6, fill: '#f59e0b', stroke: '#fff', strokeWidth: 2 }}
                name="Relative Gap %"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t hairline pt-3 px-2">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" /> Winning baseline (0%)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-500 inline-block" /> Historical median gap
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-indigo-500 inline-block" /> Submitted losing bid
            </span>
          </div>
          <span>{observations.length} observed tenders</span>
        </div>
      </div>
    </div>
  );
}
