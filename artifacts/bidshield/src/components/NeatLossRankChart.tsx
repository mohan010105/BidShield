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
import { Award, Info } from 'lucide-react';
import { LosingObservationItem } from './NeatLossGapChart';

interface NeatLossRankChartProps {
  observations: LosingObservationItem[];
  mostFrequentRank?: number;
  repeatedRankCount?: number;
  companyName: string;
}

function fmtShortDate(dateStr: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? dateStr : `${d.getDate()}/${d.getMonth() + 1}`;
}

export function NeatLossRankChart({
  observations,
  mostFrequentRank = 2,
  repeatedRankCount = 0,
  companyName,
}: NeatLossRankChartProps) {
  const chartData = useMemo(() => {
    return observations.map((obs, idx) => ({
      index: idx + 1,
      label: obs.tenderDate ? fmtShortDate(obs.tenderDate) : `#${idx + 1}`,
      tenderNumber: obs.tenderNumber,
      title: obs.title,
      tenderDate: obs.tenderDate,
      bidRank: obs.bidRank,
      isModeRank: obs.bidRank === mostFrequentRank,
    }));
  }, [observations, mostFrequentRank]);

  if (!observations || observations.length === 0) {
    return (
      <div className="rounded-xl border hairline bg-card/50 p-8 text-center text-xs text-muted-foreground">
        <Info className="h-5 w-5 mx-auto mb-2 text-muted-foreground opacity-60" />
        <p className="font-semibold text-foreground">No Bid Rank Data Available</p>
      </div>
    );
  }

  const maxRank = Math.max(...observations.map((o) => o.bidRank), 4);
  const repPct = observations.length > 0 ? Math.round((repeatedRankCount / observations.length) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="eyebrow text-muted-foreground flex items-center gap-1.5">
            <Award className="h-3.5 w-3.5 text-primary" /> Bid Rank Trajectory
          </div>
          <h3 className="text-base font-bold text-foreground">
            {companyName} Finishing Rank Across Historical Tenders
          </h3>
        </div>
        {repeatedRankCount > 0 && (
          <div className="text-xs text-muted-foreground bg-primary/10 border border-primary/20 rounded-md px-2.5 py-1">
            Repeated Position: <span className="font-mono font-bold text-primary">Rank {mostFrequentRank}</span> ({repeatedRankCount}/{observations.length} tenders · {repPct}%)
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
                reversed={true} // Rank 1 is on top
                domain={[1, maxRank + 1]}
                ticks={Array.from({ length: maxRank }, (_, i) => i + 1)}
                tickFormatter={(val) => `R${val}`}
                dx={-5}
              />
              {/* Reference line for mode rank */}
              <ReferenceLine
                y={mostFrequentRank}
                stroke="#a855f7"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{
                  value: `Mode Rank ${mostFrequentRank}`,
                  position: 'insideBottomRight',
                  fill: '#a855f7',
                  fontSize: 10,
                }}
              />
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
                          <span className="text-muted-foreground">Observed Rank:</span>
                          <span className={`font-mono font-bold ${data.isModeRank ? 'text-purple-400' : 'text-foreground'}`}>
                            Rank {data.bidRank} {data.isModeRank ? '(Modal)' : ''}
                          </span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">Date:</span>
                          <span className="text-muted-foreground">{data.tenderDate || '—'}</span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Line
                type="stepAfter"
                dataKey="bidRank"
                stroke="#a855f7"
                strokeWidth={2.5}
                dot={{ r: 4, fill: '#a855f7', stroke: '#3b0764', strokeWidth: 2 }}
                activeDot={{ r: 6, fill: '#f59e0b', stroke: '#fff', strokeWidth: 2 }}
                name="Bid Rank"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t hairline pt-3 px-2">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-purple-500 inline-block" /> Observed bid rank (Rank 1 at top)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-500 inline-block" /> Active inspection point
            </span>
          </div>
          <span>Mode: Rank {mostFrequentRank} ({repPct}% consistency)</span>
        </div>
      </div>
    </div>
  );
}
