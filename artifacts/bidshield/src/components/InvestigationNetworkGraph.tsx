import { useState, useMemo } from 'react';
import { Network, Building2, Users, Calendar, Scale, Info, ChevronRight, Layers, ArrowRight } from 'lucide-react';
import { Link } from 'wouter';

export interface CoParticipationSummaryData {
  companyAId: number;
  companyAName: string;
  companyBId: number;
  companyBName: string;
  sharedTenderCount: number;
  participationFrequency: number;
  status: string;
  firstObservedDate?: string;
  latestObservedDate?: string;
}

export interface InvestigationNetworkSubgraphData {
  nodes: Array<{
    id: string;
    type: "tender" | "company";
    label: string;
    isCurrentTender?: boolean;
    isWinner?: boolean;
    screeningLevel?: string;
  }>;
  edges: Array<{
    source: string;
    target: string;
    label?: string;
    isAward?: boolean;
  }>;
  pairs: CoParticipationSummaryData[];
  recurringGroups: Array<{
    groupSize: number;
    companyNames: string[];
    sharedTenderCount: number;
    tenders: Array<{ tenderId: number; tenderNumber: string; title: string }>;
  }>;
}

interface InvestigationNetworkGraphProps {
  network: InvestigationNetworkSubgraphData;
  tenderTitle: string;
}

export function InvestigationNetworkGraph({ network, tenderTitle }: InvestigationNetworkGraphProps) {
  const [selectedPair, setSelectedPair] = useState<CoParticipationSummaryData | null>(
    network.pairs.length > 0 ? network.pairs[0] : null
  );

  return (
    <div className="space-y-6" data-testid="investigation-network-graph-container">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b hairline pb-3">
        <div>
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Network className="h-4 w-4 text-primary" /> Participation Network & Bidder Cohort Explorer
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Analyzes observed co-bidding relationships, recurring bidder cohorts, and pairwise interaction frequencies among bidders in this procurement package.
          </p>
        </div>
        <div className="text-xs font-mono text-muted-foreground bg-secondary/50 px-3 py-1 rounded border hairline">
          {network.nodes.filter((n) => n.type === 'company').length} Participating Bidders
        </div>
      </div>

      {/* Grid: Graph Visualizer / Structure & Selected Pair Relationship Panel */}
      <div className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
        {/* Left Column: Bipartite Graph Structure */}
        <div className="space-y-4">
          <div className="panel p-5 bg-card space-y-4" data-testid="panel-network-graph">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-primary" /> Bipartite Participation Structure
              </div>
              <span className="text-[11px] text-muted-foreground">Observed Bidding Connections</span>
            </div>

            {/* Visual SVG Network Representation */}
            <div className="relative rounded-lg bg-secondary/30 p-6 border hairline min-h-[260px] flex items-center justify-center">
              <div className="w-full space-y-6">
                {/* Central Tender Node */}
                <div className="flex justify-center">
                  <div className="rounded-lg bg-primary/15 border border-primary/40 p-3 text-center max-w-sm shadow-sm">
                    <div className="text-[10px] uppercase font-bold text-primary tracking-wider">Target Procurement</div>
                    <div className="text-xs font-bold text-foreground mt-0.5">{tenderTitle}</div>
                  </div>
                </div>

                {/* Connection Lines */}
                <div className="flex justify-around items-center px-4">
                  {network.nodes.filter((n) => n.type === 'company').map((c) => (
                    <div key={c.id} className="h-6 w-0.5 bg-border" />
                  ))}
                </div>

                {/* Company Bidder Nodes */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {network.nodes.filter((n) => n.type === 'company').map((comp) => {
                    const compIdNum = Number(comp.id.replace('company-', ''));
                    return (
                      <div
                        key={comp.id}
                        className={`rounded-md p-2.5 text-xs border transition-all ${
                          comp.isWinner
                            ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                            : 'bg-card border-hairline text-foreground'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-bold truncate text-[11px]">{comp.label}</span>
                          {comp.isWinner && (
                            <span className="shrink-0 rounded bg-emerald-500 text-white font-extrabold text-[9px] px-1 py-0.2">
                              Winner
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-1">
                          <Link href={`/companies/${compIdNum}`} className="hover:text-primary underline">
                            View Profile
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Recurring Bidder Cohorts */}
            <div className="space-y-3 pt-2">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Recurring Bidder Cohorts ({network.recurringGroups.length})
              </div>
              {network.recurringGroups.length > 0 ? (
                <div className="space-y-2">
                  {network.recurringGroups.map((group, idx) => (
                    <div key={idx} className="rounded-lg border hairline bg-secondary/20 p-3 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground">
                          Cohort of {group.groupSize} Bidders
                        </span>
                        <span className="rounded bg-primary/10 text-primary font-mono font-bold px-2 py-0.5 text-[10px]">
                          {group.sharedTenderCount} shared procurements
                        </span>
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {group.companyNames.join(' • ')}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border hairline bg-secondary/10 p-3 text-xs text-muted-foreground text-center">
                  No 3+ recurring bidder cohorts observed among these bidders in comparable procurements.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Step 8 Company Relationship Panel */}
        <div className="space-y-4">
          <div className="panel p-5 bg-card space-y-4" data-testid="panel-company-relationship">
            <div className="flex items-center justify-between border-b hairline pb-3">
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-primary" /> Observed Pairwise Relationships
              </div>
              <span className="text-[11px] font-mono text-muted-foreground">{network.pairs.length} Pairs</span>
            </div>

            {/* Pair Selector List */}
            {network.pairs.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {network.pairs.map((p, idx) => {
                  const isSelected =
                    selectedPair?.companyAId === p.companyAId && selectedPair?.companyBId === p.companyBId;
                  return (
                    <button
                      key={idx}
                      onClick={() => setSelectedPair(p)}
                      className={`w-full text-left p-2.5 rounded-md border text-xs transition-colors flex items-center justify-between ${
                        isSelected
                          ? 'bg-primary/10 border-primary text-foreground font-semibold'
                          : 'bg-secondary/30 border-hairline hover:bg-secondary/60 text-muted-foreground'
                      }`}
                      data-testid={`pair-selector-${idx}`}
                    >
                      <div className="truncate pr-2">
                        <div className="truncate font-semibold text-foreground">
                          {p.companyAName} ↔ {p.companyBName}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {p.sharedTenderCount} shared procurements ({Math.round(p.participationFrequency * 100)}% co-occurrence)
                        </div>
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-lg border hairline bg-secondary/10 p-4 text-center text-xs text-muted-foreground">
                No pairwise co-participation relationships observed among bidders in this package.
              </div>
            )}

            {/* Selected Pair Relationship Details Panel */}
            {selectedPair && (
              <div className="rounded-lg border hairline bg-secondary/20 p-4 space-y-3 text-xs" data-testid="selected-pair-detail">
                <div className="font-bold text-foreground text-sm border-b hairline pb-2 flex items-center justify-between">
                  <span>{selectedPair.companyAName} ↔ {selectedPair.companyBName}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    selectedPair.status === 'ELEVATED_INDICATOR' || selectedPair.status === 'HIGH_INDICATOR'
                      ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                      : 'bg-primary/10 text-primary border border-primary/20'
                  }`}>
                    {selectedPair.status.replaceAll('_', ' ')}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[11px] text-muted-foreground block">Shared Procurements</span>
                    <strong className="text-foreground data-mono">{selectedPair.sharedTenderCount} tenders</strong>
                  </div>
                  <div>
                    <span className="text-[11px] text-muted-foreground block">Co-occurrence Rate</span>
                    <strong className="text-primary data-mono">{Math.round(selectedPair.participationFrequency * 100)}%</strong>
                  </div>
                  <div>
                    <span className="text-[11px] text-muted-foreground block">First Interaction</span>
                    <strong className="text-foreground">{selectedPair.firstObservedDate || 'Recorded in corpus'}</strong>
                  </div>
                  <div>
                    <span className="text-[11px] text-muted-foreground block">Latest Interaction</span>
                    <strong className="text-foreground">{selectedPair.latestObservedDate || 'Recent'}</strong>
                  </div>
                </div>

                <div className="pt-2 border-t hairline flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground font-medium">Full Relationship Profile</span>
                  <Link
                    href={`/network?company=${selectedPair.companyAId}`}
                    className="text-xs text-primary font-semibold hover:underline flex items-center gap-0.5"
                  >
                    Inspect Pair in Network Explorer <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Non-accusatory guardrail disclaimer */}
      <div className="rounded-lg bg-secondary/30 p-3.5 border hairline text-xs text-muted-foreground flex items-start gap-2.5">
        <Info className="h-4 w-4 shrink-0 text-primary mt-0.5" />
        <div>
          <strong className="text-foreground">Observed Relationship Note: </strong>
          Participation network connections represent observed co-bidding occurrences across procurement records. Network relationships warrant observational review and do NOT prove collusion, coordination, or cartel activity.
        </div>
      </div>
    </div>
  );
}
