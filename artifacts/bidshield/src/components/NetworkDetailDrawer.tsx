import { useState } from 'react';
import { Link } from 'wouter';
import {
  Building2,
  FileCheck2,
  Users,
  Award,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  X,
  Layers,
  Sparkles,
  Calendar,
  Tag,
  Activity,
  FileText
} from 'lucide-react';
import { GraphCompanyNode, GraphTenderNode } from './ParticipationNetworkGraph';
import { useTranslation } from '../i18n';

interface NetworkDetailDrawerProps {
  selectedNode: {
    id: number;
    type: 'company' | 'tender';
    data: GraphCompanyNode | GraphTenderNode;
  } | null;
  onClose: () => void;
  topRecurringPairs?: any[];
  recurringGroups?: any[];
  allTenders?: any[];
}

export function NetworkDetailDrawer({
  selectedNode,
  onClose,
  topRecurringPairs = [],
  recurringGroups = [],
  allTenders = [],
}: NetworkDetailDrawerProps) {
  const { t, formatCurrency } = useTranslation();
  if (!selectedNode) return null;

  const isCompany = selectedNode.type === 'company';
  const company = isCompany ? (selectedNode.data as GraphCompanyNode) : null;
  const tender = !isCompany ? (selectedNode.data as GraphTenderNode) : null;

  // If company is selected, find relevant recurring pairs and groups
  const relevantPairs = isCompany && company
    ? topRecurringPairs.filter((p) => p.companyAId === company.id || p.companyBId === company.id)
    : [];

  const relevantGroups = isCompany && company
    ? recurringGroups.filter((g) => g.companyIds.includes(company.id))
    : [];

  return (
    <div
      className="fixed inset-y-0 right-0 z-40 w-full max-w-md border-l hairline bg-[#0b1324] shadow-2xl p-6 overflow-y-auto animate-in slide-in-from-right duration-200"
      data-testid="network-detail-drawer"
    >
      <div className="flex items-center justify-between border-b hairline pb-4">
        <div className="flex items-center gap-2">
          {isCompany ? (
            <div className="h-8 w-8 rounded-lg bg-cyan-950/80 border border-cyan-800/80 flex items-center justify-center text-cyan-400">
              <Building2 className="h-4 w-4" />
            </div>
          ) : (
            <div className="h-8 w-8 rounded-lg bg-emerald-950/80 border border-emerald-800/80 flex items-center justify-center text-emerald-400">
              <FileCheck2 className="h-4 w-4" />
            </div>
          )}
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              {isCompany ? t('network.drawerTitleCompany') : t('network.drawerTitleTender')}
            </span>
            <div className="text-xs font-mono font-bold text-primary">
              {isCompany ? company?.canonicalId : tender?.canonicalId}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-white/10 hover:text-white transition-colors"
          data-testid="button-close-drawer"
          title={t('network.closeDrawer')}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Content for Company */}
      {isCompany && company && (
        <div className="mt-5 space-y-6">
          <div>
            <h2 className="text-lg font-bold text-foreground leading-snug">{company.canonicalName}</h2>
            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              <span>{company.normalizedName}</span>
              {company.state && <span>• {company.state}</span>}
            </div>
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-lg border hairline bg-card/60 p-3">
              <div className="text-[11px] text-muted-foreground">Participations (Degree)</div>
              <div className="mt-1 text-xl font-bold font-mono text-foreground">{company.degree}</div>
              <div className="text-[10px] text-muted-foreground">Connected tenders</div>
            </div>
            <div className="rounded-lg border hairline bg-card/60 p-3">
              <div className="text-[11px] text-muted-foreground">Awarded Contracts</div>
              <div className="mt-1 text-xl font-bold font-mono text-amber-400">{company.wins}</div>
              <div className="text-[10px] text-muted-foreground">{company.losses} non-awarded</div>
            </div>
          </div>

          {/* Observed Co-Bidding Cohort */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Observed Recurring Pairs ({relevantPairs.length})
              </h3>
            </div>

            {relevantPairs.length > 0 ? (
              <div className="space-y-2">
                {relevantPairs.slice(0, 5).map((pair, idx) => {
                  const isA = pair.companyAId === company.id;
                  const otherName = isA ? pair.companyBName : pair.companyAName;
                  const otherId = isA ? pair.companyBId : pair.companyAId;
                  const otherCanonical = isA ? pair.companyBCanonicalId : pair.companyACanonicalId;

                  return (
                    <div
                      key={idx}
                      className="rounded-lg border hairline bg-card/40 p-3 space-y-1.5 hover:bg-card/70 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-semibold text-foreground truncate max-w-[220px]">
                          {otherName}
                        </div>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-950/70 border border-cyan-800/60 text-cyan-300 font-bold">
                          {otherCanonical}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>{pair.sharedTenderCount} shared tenders</span>
                        <span>{Math.round(pair.participationFrequency * 100)}% co-occurrence</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground p-3 rounded-lg border hairline bg-card/30">
                No recurring co-participation threshold reached with other bidders.
              </p>
            )}
          </section>

          {/* Recurring Bidder Groups */}
          {relevantGroups.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Recurring Bidder Groups ({relevantGroups.length})
              </h3>
              <div className="space-y-2">
                {relevantGroups.map((g, idx) => (
                  <div key={idx} className="rounded-lg border hairline bg-card/40 p-3 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-foreground font-semibold">
                      <span>3-Company Cohort</span>
                      <span className="font-mono text-cyan-300 font-bold">{g.sharedTenderCount} shared</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{g.companyNames.join(', ')}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Navigation Action */}
          <div className="pt-2">
            <Link
              href={`/companies/${company.id}`}
              className="button-primary w-full flex items-center justify-center gap-2"
              data-testid="link-drawer-company-profile"
            >
              Open Company Profile <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}

      {/* Content for Tender */}
      {!isCompany && tender && (
        <div className="mt-5 space-y-6">
          <div>
            <div className="text-xs font-mono text-primary font-bold">{tender.tenderNumber}</div>
            <h2 className="mt-1 text-lg font-bold text-foreground leading-snug">{tender.title}</h2>
            <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
              <span className="px-2 py-0.5 rounded bg-secondary/50 border hairline">{tender.category}</span>
              <span className="px-2 py-0.5 rounded bg-secondary/50 border hairline">{tender.organization}</span>
            </div>
          </div>

          <div className="rounded-lg border hairline bg-card/60 p-4 space-y-2.5">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">{t('tenders.tenderDate')}</span>
              <span className="font-mono text-foreground">{tender.tenderDate}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">{t('charts.awardedWinner')}</span>
              <span className="font-semibold text-amber-400">{tender.winner ?? t('charts.notRecorded')}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">{t('tenders.bidderCount')}</span>
              <span className="font-mono text-foreground font-bold">{tender.bidderCount}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">{t('tenders.estimatedValue')}</span>
              <span className="font-mono text-foreground">
                {formatCurrency(tender.estimatedValue)}
              </span>
            </div>
          </div>

          <div className="rounded-lg border hairline bg-secondary/30 p-3.5 text-xs text-muted-foreground space-y-1.5">
            <div className="font-semibold text-foreground flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5 text-primary" /> {t('analytics.participationNetwork')}
            </div>
            <p>
              {tender.bidderCount} {t('tenders.bidsSubmitted')}
            </p>
          </div>

          <div className="pt-2">
            <Link
              href={`/tenders/${tender.id}`}
              className="button-primary w-full flex items-center justify-center gap-2"
              data-testid="link-drawer-tender-detail"
            >
              {t('common.viewDetails')} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
