import { useState } from 'react';
import { ArrowRight, Building2, Calendar, CheckCircle2, ChevronRight, Coins, Eye, RotateCcw, Users } from 'lucide-react';
import { Link } from 'wouter';
import { useTranslation } from '../i18n';

export interface TimelineTenderItem {
  id: number;
  tenderNumber: string;
  title: string;
  tenderDate: string;
  winner: string | null;
  contractValue: number | null;
  bids: Array<{
    companyId: number;
    companyName: string;
    bidAmount: number;
    isWinner: boolean;
  }>;
}

interface WinnerRotationTimelineProps {
  currentTenderId: number;
  comparableTenders: TimelineTenderItem[];
  highlightCompany?: string;
}

// Generate consistent distinct colors for company badges
const colorPalette = [
  'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',
  'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30',
  'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
  'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30',
];

export function WinnerRotationTimeline({
  currentTenderId,
  comparableTenders,
  highlightCompany,
}: WinnerRotationTimelineProps) {
  const { t, formatCurrency, formatDate } = useTranslation();
  const [selectedCompany, setSelectedCompany] = useState<string | null>(highlightCompany ?? null);

  // Map company names to distinct color classes
  const companyColorMap = new Map<string, string>();
  let colorIdx = 0;
  comparableTenders.forEach((t) => {
    if (t.winner && !companyColorMap.has(t.winner)) {
      companyColorMap.set(t.winner, colorPalette[colorIdx % colorPalette.length]);
      colorIdx++;
    }
  });

  // Track winner switches
  const sorted = [...comparableTenders].sort((a, b) => a.tenderDate.localeCompare(b.tenderDate));

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="eyebrow text-muted-foreground flex items-center gap-1.5">
            <RotateCcw className="h-3.5 w-3.5 text-primary" /> {t('charts.chronologicalSequence')}
          </div>
          <h3 className="text-base font-bold text-foreground">
            {t('charts.comparableTimeline')} ({sorted.length})
          </h3>
        </div>

        {/* Filter / Legend by company */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setSelectedCompany(null)}
            className={`px-2.5 py-1 text-xs rounded-full border transition-all ${
              selectedCompany === null
                ? 'bg-foreground text-background font-semibold border-foreground'
                : 'bg-secondary/50 text-muted-foreground border-border hover:text-foreground'
            }`}
          >
            {t('charts.allFirms')}
          </button>
          {Array.from(companyColorMap.entries()).slice(0, 5).map(([name, colorClass]) => (
            <button
              key={name}
              onClick={() => setSelectedCompany(selectedCompany === name ? null : name)}
              className={`px-2.5 py-1 text-xs rounded-full border transition-all truncate max-w-[140px] ${
                selectedCompany === name
                  ? `${colorClass} font-bold ring-2 ring-primary/40`
                  : `${colorClass} opacity-75 hover:opacity-100`
              }`}
            >
              {name.split(' ')[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline Sequence */}
      <div className="relative overflow-x-auto pb-4 pt-2">
        <div className="flex items-stretch gap-3 min-w-max">
          {sorted.map((item, index) => {
            const isCurrent = item.id === currentTenderId;
            const prevWinner = index > 0 ? sorted[index - 1].winner : null;
            const isTransition = prevWinner !== null && item.winner !== null && prevWinner !== item.winner;
            const isMatch = !selectedCompany || item.winner === selectedCompany || item.bids.some((b) => b.companyName === selectedCompany);
            const winnerColor = item.winner ? (companyColorMap.get(item.winner) ?? colorPalette[0]) : 'bg-muted text-muted-foreground';

            return (
              <div key={`${item.id}-${item.tenderNumber}-${index}`} className="flex items-center gap-2">
                {index > 0 && (
                  <div className="flex flex-col items-center justify-center px-1">
                    {isTransition ? (
                      <div className="flex items-center gap-0.5 text-[10px] font-mono font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded" title="Winner switch">
                        <span>{t('charts.switchLabel')}</span>
                        <ArrowRight className="h-3 w-3" />
                      </div>
                    ) : (
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40" />
                    )}
                  </div>
                )}

                <div
                  className={`w-64 rounded-xl border p-4 transition-all ${
                    isCurrent
                      ? 'border-primary ring-2 ring-primary/25 bg-primary/[0.03] shadow-md'
                      : 'border-border bg-card'
                  } ${!isMatch ? 'opacity-40' : 'opacity-100'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold font-mono text-foreground">
                          {item.tenderNumber}
                        </span>
                        {isCurrent && (
                          <span className="rounded bg-primary text-primary-foreground px-1.5 py-0.2 text-[9px] font-bold">
                            {t('charts.current')}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> {formatDate(item.tenderDate)}
                      </div>
                    </div>
                    <span className="text-[11px] font-mono text-muted-foreground font-semibold">
                      #{index + 1}
                    </span>
                  </div>

                  {/* Winner display */}
                  <div className="mt-3 rounded-lg border p-2.5 bg-background/50">
                    <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                      {t('charts.awardedWinner')}
                    </div>
                    <div className="mt-1 flex items-center gap-1.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold border truncate ${winnerColor}`}>
                        <CheckCircle2 className="h-3 w-3 shrink-0" />
                        <span className="truncate">{item.winner ?? t('charts.notRecorded')}</span>
                      </span>
                    </div>
                  </div>

                  {/* Bidders & Contract Value */}
                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground border-t hairline pt-2">
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" /> {t('charts.biddersCount', { count: item.bids.length })}
                    </span>
                    <span className="font-mono font-medium text-foreground">
                      {formatCurrency(item.contractValue)}
                    </span>
                  </div>

                  {!isCurrent && (
                    <div className="mt-2 text-right">
                      <Link
                        href={`/tenders/${item.id}`}
                        className="text-[11px] text-primary hover:underline font-semibold inline-flex items-center gap-1"
                      >
                        {t('charts.inspectTender')} <ChevronRight className="h-3 w-3" />
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
