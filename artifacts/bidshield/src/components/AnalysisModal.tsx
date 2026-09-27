import { useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Calendar,
  CheckCircle2,
  ExternalLink,
  FileCheck2,
  FileSpreadsheet,
  Gauge,
  GitBranch,
  HelpCircle,
  Info,
  Layers,
  Percent,
  RotateCcw,
  Scale,
  ShieldCheck,
  TrendingUp,
  Users,
  X,
  Zap,
} from 'lucide-react';
import type { AnalyticsEvidence, TenderAnalytics } from '@workspace/api-client-react';
import { useTranslation } from '../i18n';

const DISCLAIMER =
  'Price clustering is a statistical indicator for further review. It does not establish collusion, coordination, wrongdoing, or legal liability.';

interface AnalysisModalProps {
  analytics: TenderAnalytics | null | undefined;
  isOpen: boolean;
  onClose: () => void;
  onRecalculate?: () => void;
  initialTab?: 'rotation' | 'coverBid' | 'priceClustering' | 'scope' | 'evidence';
}

export function AnalysisModal({
  analytics,
  isOpen,
  onClose,
  onRecalculate,
  initialTab = 'priceClustering',
}: AnalysisModalProps) {
  const { t, translateStatus } = useTranslation();
  const [activeTab, setActiveTab] = useState<'rotation' | 'coverBid' | 'priceClustering' | 'scope' | 'evidence'>(initialTab);

  if (!isOpen || !analytics) return null;

  const rot = analytics.winnerRotation;
  const cov = analytics.coverBid;
  const pc = analytics.priceClustering;
  const scope = analytics.comparisonScope;

  const getStatusBadgeClass = (status?: string) => {
    if (status === 'HIGH INDICATOR' || status === 'ELEVATED INDICATOR') return 'bg-destructive/10 text-destructive border-destructive/20';
    if (status === 'MODERATE INDICATOR') return 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30';
    if (status === 'INSUFFICIENT_DATA') return 'bg-muted text-muted-foreground border-border';
    return 'bg-primary/10 text-primary border-primary/20';
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="panel max-h-[90vh] w-full max-w-4xl overflow-hidden flex flex-col shadow-2xl border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b hairline px-6 py-5 bg-card">
          <div>
            <div className="flex items-center gap-2">
              <span className="eyebrow text-primary">AUDITABLE SCREENING REPORT</span>
              <span className="rounded bg-secondary px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
                Methodology {pc?.methodologyVersion ?? rot.methodologyVersion}
              </span>
            </div>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              {t('tenders.viewAnalysisBreakdown')}
              <span className="text-sm font-normal text-muted-foreground">({analytics.tenderNumber})</span>
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {onRecalculate && (
              <button
                onClick={onRecalculate}
                className="button-secondary text-xs flex items-center gap-1.5"
                title={t('analytics.recalculate')}
              >
                <RotateCcw className="h-3.5 w-3.5" /> {t('analytics.recalculate')}
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              data-testid="button-close-analysis-modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b hairline bg-secondary/30 px-6 gap-2 overflow-x-auto">
          {[
            { id: 'priceClustering', label: t('analytics.priceClustering'), icon: Percent, badge: pc?.score !== null && pc?.score !== undefined ? `${pc.score}%` : 'N/A' },
            { id: 'coverBid', label: t('analytics.coverBid'), icon: Scale, badge: cov.score !== null ? `${cov.score}%` : 'N/A' },
            { id: 'rotation', label: t('analytics.winnerRotation'), icon: RotateCcw, badge: rot.score !== null ? `${rot.score}%` : 'N/A' },
            { id: 'scope', label: 'Comparison Scope', icon: Layers, badge: `${scope.comparableTenderCount} tenders` },
            { id: 'evidence', label: t('evidence.title'), icon: ShieldCheck, badge: `${analytics.evidence.length} records` },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 py-3 px-3.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? 'border-primary text-primary bg-background/60 rounded-t-md'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
                <span className="rounded bg-secondary/80 px-1.5 py-0.5 text-[10px] font-mono">{tab.badge}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB: PRICE CLUSTERING */}
          {activeTab === 'priceClustering' && pc && (
            <div className="space-y-6">
              {/* Summary Card */}
              <div className="rounded-xl border hairline bg-card p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="eyebrow text-muted-foreground">Screening Result</div>
                    <div className="mt-1 flex items-center gap-3">
                      <div className="text-3xl font-bold font-mono tracking-tight text-foreground">
                        {pc.score !== null ? `${pc.score} / 100` : 'Insufficient Data'}
                      </div>
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-bold font-mono ${getStatusBadgeClass(pc.status)}`}>
                        {pc.status}
                      </span>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground sm:text-right space-y-1">
                    <div>Sample size: <b className="font-mono text-foreground">{pc.sampleSize} bids analyzed</b></div>
                    <div>Comparison baseline: <b className="font-mono text-foreground">{scope.comparableTenderCount} peer tenders</b></div>
                    <div>Confidence rating: <b className="font-mono text-foreground">{(pc.confidence * 100).toFixed(0)}%</b></div>
                  </div>
                </div>

                <div className="mt-4 rounded-lg bg-secondary/30 p-3.5 text-xs leading-relaxed text-foreground border hairline">
                  <b>Screening Summary:</b> {pc.summary}
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="space-y-3">
                <div className="eyebrow text-muted-foreground">Quantitative Price Dispersion Indicators</div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {pc.metrics.map((m) => (
                    <div key={m.key} className="rounded-lg border hairline bg-card p-3.5 space-y-1">
                      <div className="text-[11px] text-muted-foreground truncate">{m.label}</div>
                      <div className="data-mono text-lg font-bold text-foreground">{m.formatted}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Mathematical Methodology Breakdown */}
              <div className="rounded-xl border hairline bg-card p-5 space-y-3">
                <div className="eyebrow text-muted-foreground">Analytical Engine Components</div>
                <h4 className="font-semibold text-sm text-foreground">How Price Clustering is Scored</h4>
                <div className="grid gap-3 sm:grid-cols-2 text-xs text-muted-foreground">
                  <div className="rounded bg-secondary/30 p-3 space-y-1">
                    <b className="text-foreground">1. Tender-Level Concentration (25% Weight)</b>
                    <p>Coefficient of variation (CV = σ / μ) and normalized spread ((max - min) / min). Values under 0.015 indicate tight price groupings.</p>
                  </div>
                  <div className="rounded bg-secondary/30 p-3 space-y-1">
                    <b className="text-foreground">2. Historical Baseline Comparison (25% Weight)</b>
                    <p>Ratio of current tender's CV against historical median CV across multi-attribute comparable tenders in the same category.</p>
                  </div>
                  <div className="rounded bg-secondary/30 p-3 space-y-1">
                    <b className="text-foreground">3. Percentile Rank Deviation (25% Weight)</b>
                    <p>Empirical percentile ranking within historical peer distribution. Ranking below the 20th percentile indicates narrow dispersion.</p>
                  </div>
                  <div className="rounded bg-secondary/30 p-3 space-y-1">
                    <b className="text-foreground">4. Relative Distance & Inter-Bid Step (25% Weight)</b>
                    <p>Uniformity of inter-bid gaps and losing bid distance clustering standard deviation above the winning bid anchor.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: COVER-BID */}
          {activeTab === 'coverBid' && (
            <div className="space-y-6">
              <div className="rounded-xl border hairline bg-card p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="eyebrow text-muted-foreground">Screening Result</div>
                    <div className="mt-1 flex items-center gap-3">
                      <div className="text-3xl font-bold font-mono tracking-tight text-foreground">
                        {cov.score !== null ? `${cov.score} / 100` : 'Insufficient Data'}
                      </div>
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-bold font-mono ${getStatusBadgeClass(cov.status)}`}>
                        {cov.status}
                      </span>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground sm:text-right space-y-1">
                    <div>Sample size: <b className="font-mono text-foreground">{cov.sampleSize} bids</b></div>
                    <div>Confidence rating: <b className="font-mono text-foreground">{(cov.confidence * 100).toFixed(0)}%</b></div>
                  </div>
                </div>

                <div className="mt-4 rounded-lg bg-secondary/30 p-3.5 text-xs leading-relaxed text-foreground border hairline">
                  <b>Screening Summary:</b> {cov.summary}
                </div>
              </div>

              <div className="space-y-3">
                <div className="eyebrow text-muted-foreground">Calculated Bid Positioning Metrics</div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {cov.metrics.map((m) => (
                    <div key={m.key} className="rounded-lg border hairline bg-card p-3.5 space-y-1">
                      <div className="text-[11px] text-muted-foreground truncate">{m.label}</div>
                      <div className="data-mono text-lg font-bold text-foreground">{m.formatted}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB: WINNER ROTATION */}
          {activeTab === 'rotation' && (
            <div className="space-y-6">
              <div className="rounded-xl border hairline bg-card p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="eyebrow text-muted-foreground">Screening Result</div>
                    <div className="mt-1 flex items-center gap-3">
                      <div className="text-3xl font-bold font-mono tracking-tight text-foreground">
                        {rot.score !== null ? `${rot.score} / 100` : 'Insufficient Data'}
                      </div>
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-bold font-mono ${getStatusBadgeClass(rot.status)}`}>
                        {rot.status}
                      </span>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground sm:text-right space-y-1">
                    <div>Sequence sample: <b className="font-mono text-foreground">{rot.sampleSize} comparable tenders</b></div>
                    <div>Confidence rating: <b className="font-mono text-foreground">{(rot.confidence * 100).toFixed(0)}%</b></div>
                  </div>
                </div>

                <div className="mt-4 rounded-lg bg-secondary/30 p-3.5 text-xs leading-relaxed text-foreground border hairline">
                  <b>Screening Summary:</b> {rot.summary}
                </div>
              </div>

              <div className="space-y-3">
                <div className="eyebrow text-muted-foreground">Rotation Sequence Metrics</div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {rot.metrics.map((m) => (
                    <div key={m.key} className="rounded-lg border hairline bg-card p-3.5 space-y-1">
                      <div className="text-[11px] text-muted-foreground truncate">{m.label}</div>
                      <div className="data-mono text-lg font-bold text-foreground">{m.formatted}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB: COMPARISON SCOPE */}
          {activeTab === 'scope' && (
            <div className="space-y-6">
              <div className="rounded-xl border hairline bg-card p-5">
                <div className="eyebrow text-muted-foreground">Comparison Population Definition</div>
                <h3 className="mt-1 text-lg font-bold text-foreground">
                  Multi-Attribute Comparable Tender Grouping
                </h3>
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                  To prevent inappropriate cross-market comparisons, tenders are strictly matched using category, procuring entity, geography, financial scale ratio (within ~5x range), and time window.
                </p>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="rounded-lg bg-secondary/40 p-3">
                    <div className="text-[11px] text-muted-foreground">Procurement Category</div>
                    <div className="mt-1 font-semibold text-sm text-foreground">{scope.category}</div>
                  </div>
                  <div className="rounded-lg bg-secondary/40 p-3">
                    <div className="text-[11px] text-muted-foreground">Procuring Organization</div>
                    <div className="mt-1 font-semibold text-sm text-foreground">{scope.organization}</div>
                  </div>
                  <div className="rounded-lg bg-secondary/40 p-3">
                    <div className="text-[11px] text-muted-foreground">Department</div>
                    <div className="mt-1 font-semibold text-sm text-foreground">{scope.department}</div>
                  </div>
                  <div className="rounded-lg bg-secondary/40 p-3">
                    <div className="text-[11px] text-muted-foreground">Geography & Location</div>
                    <div className="mt-1 font-semibold text-sm text-foreground">{scope.geography}</div>
                  </div>
                  <div className="rounded-lg bg-secondary/40 p-3">
                    <div className="text-[11px] text-muted-foreground">Comparable Value Range</div>
                    <div className="mt-1 font-semibold text-sm text-foreground font-mono">{scope.valueRange}</div>
                  </div>
                  <div className="rounded-lg bg-secondary/40 p-3">
                    <div className="text-[11px] text-muted-foreground">Comparable Tender Population</div>
                    <div className="mt-1 font-bold text-sm text-primary font-mono">{scope.comparableTenderCount} tenders</div>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border hairline bg-secondary/20 p-4">
                <h4 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5 text-primary" /> False-Positive Protection & Data Integrity
                </h4>
                <ul className="text-xs text-muted-foreground space-y-1.5 list-disc pl-4">
                  <li>Sample minimum: Requires at least 3 bids and 5 comparable tenders for price clustering screening.</li>
                  <li>Entity Resolution: Canonical company identities are utilized, linking historical aliases into resolved entities.</li>
                  <li>Contextual Notice: Small comparison sets yield an <code>INSUFFICIENT_DATA</code> signal rather than misleading high-risk scores.</li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB: TRACEABLE EVIDENCE */}
          {activeTab === 'evidence' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Traceable Evidence Register</h3>
                  <p className="text-xs text-muted-foreground">Every statement is directly derived from calculated metrics.</p>
                </div>
                <span className="rounded bg-secondary px-2.5 py-1 text-xs font-mono font-medium">
                  {analytics.evidence.length} record{analytics.evidence.length === 1 ? '' : 's'}
                </span>
              </div>

              {analytics.evidence.length > 0 ? (
                <div className="space-y-3">
                  {analytics.evidence.map((ev, index) => (
                    <div key={ev.id ?? index} className="rounded-lg border hairline bg-card p-4 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-bold font-mono text-primary">
                            {ev.indicatorType}
                          </span>
                          <span className="text-xs font-semibold text-muted-foreground">
                            {ev.severity}
                          </span>
                        </div>
                        <span className="rounded bg-secondary px-2 py-0.5 text-[10px] font-mono">
                          {(ev.confidence * 100).toFixed(0)}% confidence
                        </span>
                      </div>
                      <p className="text-sm leading-relaxed text-foreground font-medium">
                        {ev.description}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground border-t hairline pt-2 mt-2">
                        <div>Metric: <b className="text-foreground">{ev.metric}</b></div>
                        <div>Observed: <b className="text-foreground font-mono">{ev.observedValue ?? '—'}</b></div>
                        <div>Expected Baseline: <b className="text-foreground">{ev.expectedValue ?? '—'}</b></div>
                        {ev.supportingTenderIds && ev.supportingTenderIds.length > 0 && (
                          <div>Supporting Tenders: <b className="text-foreground font-mono">{ev.supportingTenderIds.length} records</b></div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border hairline bg-secondary/30 p-8 text-center text-sm text-muted-foreground">
                  No screening evidence recorded for this tender.
                </div>
              )}
            </div>
          )}

          {/* Legal Safety Disclaimer */}
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3.5 flex gap-3 text-xs leading-relaxed text-muted-foreground">
            <Info className="h-4 w-4 shrink-0 text-primary mt-0.5" />
            <span>{DISCLAIMER}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t hairline px-6 py-4 bg-card text-xs text-muted-foreground">
          <div>
            Calculated: <span className="font-mono">{new Date(analytics.calculatedAt).toLocaleString()}</span>
          </div>
          <button
            onClick={onClose}
            className="button-primary text-xs"
            data-testid="button-done-analysis-modal"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
