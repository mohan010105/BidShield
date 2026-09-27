import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Network,
  Building2,
  FileCheck2,
  Users,
  Layers,
  RefreshCw,
  Search,
  Filter,
  ShieldAlert,
  Info,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  SlidersHorizontal,
  Table,
  Eye,
  CheckCircle2
} from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { ParticipationNetworkGraph, GraphCompanyNode, GraphTenderNode } from '@/components/ParticipationNetworkGraph';
import { NetworkDetailDrawer } from '@/components/NetworkDetailDrawer';
import { useTranslation } from '@/i18n';

export function NetworkAnalysisPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [location] = useLocation();

  // Parse query params (e.g., ?company=1 or ?tender=5)
  const searchParams = useMemo(() => {
    const search = window.location.search;
    return new URLSearchParams(search);
  }, [location]);

  const initialCompanyFilter = searchParams.get('company') ?? '';
  const initialTenderFilter = searchParams.get('tender') ?? '';

  // Filter state
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedOrg, setSelectedOrg] = useState<string>('All');
  const [selectedState, setSelectedState] = useState<string>('All');
  const [minShared, setMinShared] = useState<number>(2);
  const [searchTerm, setSearchTerm] = useState<string>(initialCompanyFilter ? `Company ${initialCompanyFilter}` : '');
  const [activeTab, setActiveTab] = useState<'graph' | 'pairs' | 'groups' | 'evidence'>('graph');

  // Selected node for drawer
  const [selectedNode, setSelectedNode] = useState<{
    id: number;
    type: 'company' | 'tender';
    data: GraphCompanyNode | GraphTenderNode;
  } | null>(null);

  // Fetch network data
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['analytics-network', selectedCategory, selectedOrg, selectedState, minShared],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCategory !== 'All') params.append('category', selectedCategory);
      if (selectedOrg !== 'All') params.append('organization', selectedOrg);
      if (selectedState !== 'All') params.append('state', selectedState);
      if (minShared > 1) params.append('minSharedTenders', String(minShared));

      const res = await fetch(`/api/analytics/network?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch participation network');
      return res.json();
    },
  });

  // Recalculate mutation
  const recalculateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/analytics/network/recalculate', { method: 'POST' });
      if (!res.ok) throw new Error('Recalculation failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analytics-network'] });
    },
  });

  // Process data for graph visualization with search filtering
  const graphData = useMemo(() => {
    if (!data?.bipartiteGraph) {
      return { companies: [], tenders: [], edges: [] };
    }

    let comps: GraphCompanyNode[] = data.bipartiteGraph.companyNodes ?? [];
    let tnds: GraphTenderNode[] = data.bipartiteGraph.tenderNodes ?? [];
    let edges = data.bipartiteGraph.edges ?? [];

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const matchedCompIds = new Set(
        comps
          .filter((c) => c.canonicalName.toLowerCase().includes(term) || c.canonicalId.toLowerCase().includes(term))
          .map((c) => c.id)
      );
      const matchedTndIds = new Set(
        tnds
          .filter((t) => t.tenderNumber.toLowerCase().includes(term) || t.title.toLowerCase().includes(term))
          .map((t) => t.id)
      );

      // Keep matched and their direct connections
      const connectedTndIds = new Set(matchedTndIds);
      const connectedCompIds = new Set(matchedCompIds);

      edges.forEach((edge: any) => {
        if (matchedCompIds.has(edge.source)) connectedTndIds.add(edge.target);
        if (matchedTndIds.has(edge.target)) connectedCompIds.add(edge.source);
      });

      comps = comps.filter((c) => connectedCompIds.has(c.id));
      tnds = tnds.filter((t) => connectedTndIds.has(t.id));
      edges = edges.filter((e: any) => connectedCompIds.has(e.source) && connectedTndIds.has(e.target));
    }

    return {
      companies: comps.slice(0, 24),
      tenders: tnds.slice(0, 24),
      edges: edges.filter((e: any) => comps.some((c) => c.id === e.source) && tnds.some((t) => t.id === e.target)),
    };
  }, [data, searchTerm]);

  // Extract filter options
  const filterOptions = useMemo(() => {
    if (!data?.bipartiteGraph) return { categories: [], orgs: [], states: [] };
    const categories = Array.from(new Set(data.bipartiteGraph.tenderNodes.map((t: any) => t.category))).sort();
    const orgs = Array.from(new Set(data.bipartiteGraph.tenderNodes.map((t: any) => t.organization))).sort();
    const states = Array.from(new Set(data.bipartiteGraph.companyNodes.map((c: any) => c.state).filter(Boolean))).sort();
    return { categories, orgs, states };
  }, [data]);

  return (
    <div className="space-y-6" data-testid="network-page">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-primary">
            <Network className="h-4 w-4" /> {t('network.eyebrow')}
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {t('network.title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('network.subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => recalculateMutation.mutate()}
            disabled={recalculateMutation.isPending}
            className="button-secondary flex items-center gap-2"
            title="Recalculate network metrics across normalized records"
            data-testid="button-recalculate-network"
          >
            <RefreshCw className={`h-4 w-4 ${recalculateMutation.isPending || isFetching ? 'animate-spin' : ''}`} />
            <span>{recalculateMutation.isPending ? t('network.recalculating') : t('network.recalculate')}</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-xl border hairline bg-card/60 p-4 space-y-1" data-testid="kpi-companies">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{t('network.companies')}</span>
            <Building2 className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-foreground">
            {data?.summaryStatistics?.totalCompanies ?? '—'}
          </div>
          <p className="text-[11px] text-muted-foreground">{t('network.companiesDetail')}</p>
        </div>

        <div className="rounded-xl border hairline bg-card/60 p-4 space-y-1" data-testid="kpi-tenders">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{t('network.tenders')}</span>
            <FileCheck2 className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-foreground">
            {data?.summaryStatistics?.totalTenders ?? '—'}
          </div>
          <p className="text-[11px] text-muted-foreground">{t('network.tendersDetail')}</p>
        </div>

        <div className="rounded-xl border hairline bg-card/60 p-4 space-y-1" data-testid="kpi-edges">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{t('network.edges')}</span>
            <Network className="h-4 w-4 text-primary" />
          </div>
          <div className="text-2xl font-bold font-mono text-foreground">
            {data?.summaryStatistics?.totalParticipationEdges ?? '—'}
          </div>
          <p className="text-[11px] text-muted-foreground">{t('network.edgesDetail')}</p>
        </div>

        <div className="rounded-xl border hairline bg-card/60 p-4 space-y-1" data-testid="kpi-recurring-pairs">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{t('network.coBiddingPairs')}</span>
            <Users className="h-4 w-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-400">
            {data?.summaryStatistics?.recurringPairsCount ?? '—'}
          </div>
          <p className="text-[11px] text-muted-foreground">≥ {minShared} {t('network.sharedTenders')}</p>
        </div>

        <div className="rounded-xl border hairline bg-card/60 p-4 space-y-1" data-testid="kpi-bidder-groups">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{t('network.recurringGroups')}</span>
            <Layers className="h-4 w-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-indigo-300">
            {data?.summaryStatistics?.recurringGroupsCount ?? '—'}
          </div>
          <p className="text-[11px] text-muted-foreground">{t('network.recurringGroupsDetail')}</p>
        </div>
      </div>

      {/* Filter and Navigation Toolbar */}
      <div className="panel p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b hairline pb-3">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('graph')}
              className={`filter-chip flex items-center gap-1.5 ${activeTab === 'graph' ? 'filter-chip-active' : ''}`}
              data-testid="tab-graph-view"
            >
              <Network className="h-3.5 w-3.5" /> {t('network.tabGraph')}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('pairs')}
              className={`filter-chip flex items-center gap-1.5 ${activeTab === 'pairs' ? 'filter-chip-active' : ''}`}
              data-testid="tab-recurring-pairs"
            >
              <Users className="h-3.5 w-3.5" /> {t('network.tabPairs')} ({data?.topRecurringPairs?.length ?? 0})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('groups')}
              className={`filter-chip flex items-center gap-1.5 ${activeTab === 'groups' ? 'filter-chip-active' : ''}`}
              data-testid="tab-bidder-groups"
            >
              <Layers className="h-3.5 w-3.5" /> {t('network.tabGroups')} ({data?.recurringBidderGroups?.length ?? 0})
            </button>
          </div>

          <div className="text-xs font-mono text-muted-foreground">
            {t('analytics.methodologyVersion')}: <span className="text-primary font-bold">participation_network_v1.0</span>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-5 items-center">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder={t('network.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-8 text-xs w-full"
              data-testid="input-search-network"
            />
          </div>

          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="input text-xs w-full"
              data-testid="select-category"
            >
              <option value="All">All Categories</option>
              {filterOptions.categories.map((c: any) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={selectedOrg}
              onChange={(e) => setSelectedOrg(e.target.value)}
              className="input text-xs w-full"
              data-testid="select-organization"
            >
              <option value="All">All Organizations</option>
              {filterOptions.orgs.map((o: any) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              className="input text-xs w-full"
              data-testid="select-state"
            >
              <option value="All">All Regions / States</option>
              {filterOptions.states.map((s: any) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground whitespace-nowrap">Min Shared:</span>
            <select
              value={minShared}
              onChange={(e) => setMinShared(Number(e.target.value))}
              className="input text-xs flex-1"
              data-testid="select-min-shared"
            >
              <option value={1}>≥ 1 Tender</option>
              <option value={2}>≥ 2 Tenders</option>
              <option value={3}>≥ 3 Tenders</option>
              <option value={4}>≥ 4 Tenders</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Tab Content */}
      {isLoading ? (
        <div className="panel p-12 text-center text-muted-foreground">
          <RefreshCw className="h-6 w-6 animate-spin mx-auto text-primary mb-2" />
          <p className="text-sm">Calculating canonical bipartite graph and recurrence metrics…</p>
        </div>
      ) : error ? (
        <div className="panel p-8 text-center text-destructive">
          <p className="text-sm font-semibold">Failed to load network analytics</p>
          <button onClick={() => refetch()} className="button-secondary mt-3">
            Retry
          </button>
        </div>
      ) : activeTab === 'graph' ? (
        <div className="space-y-4">
          <div className="panel p-0 overflow-hidden relative">
            <div className="flex items-center justify-between border-b hairline px-6 py-4 bg-card/40">
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  Interactive Company–Tender Bipartite Projection
                </h2>
                <p className="text-xs text-muted-foreground">
                  Displaying {graphData.companies.length} canonical companies and {graphData.tenders.length} tenders. Click any node to open forensic details.
                </p>
              </div>
              <div className="text-xs font-mono text-muted-foreground">
                Density: {data?.summaryStatistics?.networkDensity ?? 0}
              </div>
            </div>

            <ParticipationNetworkGraph
              companies={graphData.companies}
              tenders={graphData.tenders}
              edges={graphData.edges}
              selectedNodeId={selectedNode ? { id: selectedNode.id, type: selectedNode.type } : null}
              onSelectNode={setSelectedNode}
            />
          </div>
        </div>
      ) : activeTab === 'pairs' ? (
        <div className="panel p-0 overflow-hidden">
          <div className="border-b hairline px-6 py-4 bg-card/40">
            <h2 className="text-base font-semibold text-foreground">Observed Recurring Company Pairs</h2>
            <p className="text-xs text-muted-foreground">
              Bidders co-participating across multiple comparable tenders. High recurrence warrants caseworker review.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b hairline bg-secondary/30 text-muted-foreground font-mono text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3">Company A (Canonical)</th>
                  <th className="px-6 py-3">Company B (Canonical)</th>
                  <th className="px-4 py-3">Shared Tenders</th>
                  <th className="px-4 py-3">Co-Occurrence Freq</th>
                  <th className="px-4 py-3">Common Categories</th>
                  <th className="px-4 py-3">Indicator Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y hairline">
                {data?.topRecurringPairs?.length ? (
                  data.topRecurringPairs.map((pair: any, idx: number) => (
                    <tr key={idx} className="hover:bg-secondary/20 transition-colors">
                      <td className="px-6 py-3.5">
                        <div className="font-semibold text-foreground">{pair.companyAName}</div>
                        <div className="text-[10px] font-mono text-muted-foreground">{pair.companyACanonicalId}</div>
                      </td>
                      <td className="px-6 py-3.5">
                        <div className="font-semibold text-foreground">{pair.companyBName}</div>
                        <div className="text-[10px] font-mono text-muted-foreground">{pair.companyBCanonicalId}</div>
                      </td>
                      <td className="px-4 py-3.5 font-mono font-bold text-foreground">
                        {pair.sharedTenderCount} tenders
                      </td>
                      <td className="px-4 py-3.5 font-mono text-primary font-bold">
                        {Math.round(pair.participationFrequency * 100)}%
                      </td>
                      <td className="px-4 py-3.5 text-muted-foreground">
                        {pair.categories.slice(0, 2).join(', ') || 'Various'}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            pair.status === 'ELEVATED INDICATOR' || pair.status === 'HIGH INDICATOR'
                              ? 'bg-amber-950/80 text-amber-300 border border-amber-800'
                              : pair.status === 'MODERATE INDICATOR'
                              ? 'bg-blue-950/80 text-blue-300 border border-blue-800'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          {pair.status}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            const comp = data.bipartiteGraph.companyNodes.find((c: any) => c.id === pair.companyAId);
                            if (comp) {
                              setSelectedNode({ id: comp.id, type: 'company', data: comp });
                            }
                          }}
                          className="button-secondary text-[11px] py-1 px-2.5 inline-flex items-center gap-1"
                          data-testid={`button-view-pair-${idx}`}
                        >
                          <Eye className="h-3.5 w-3.5" /> Details
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">
                      No recurring company pairs found matching the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="panel p-0 overflow-hidden">
          <div className="border-b hairline px-6 py-4 bg-card/40">
            <h2 className="text-base font-semibold text-foreground">Recurring Bidder Groups (Triads & Cohorts)</h2>
            <p className="text-xs text-muted-foreground">
              Combinations of 3 or more companies that repeatedly participate in the same tenders.
            </p>
          </div>

          <div className="divide-y hairline">
            {data?.recurringBidderGroups?.length ? (
              data.recurringBidderGroups.map((group: any, idx: number) => (
                <div key={idx} className="p-6 space-y-3 hover:bg-secondary/20 transition-colors">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-indigo-950/80 border border-indigo-800 text-indigo-300 font-mono text-xs font-bold">
                        {group.groupId}
                      </span>
                      <span className="text-xs font-semibold text-foreground">
                        {group.companyNames.length}-Company Cohort
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-muted-foreground">
                        Shared Packages:{' '}
                        <strong className="text-foreground font-mono">{group.sharedTenderCount} tenders</strong>
                      </span>
                      <span className="font-mono text-primary font-bold">({group.frequencyPct}% frequency)</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs">
                    {group.companyNames.map((name: string, i: number) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 rounded-md bg-card border hairline text-foreground font-medium flex items-center gap-1.5"
                      >
                        <Building2 className="h-3 w-3 text-cyan-400" />
                        {name}
                        <span className="text-[10px] font-mono text-muted-foreground">({group.canonicalIds[i]})</span>
                      </span>
                    ))}
                  </div>

                  <div className="text-[11px] text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 pt-1">
                    <span>
                      Supporting Tenders:{' '}
                      <strong className="text-foreground font-mono">{group.sharedTenderNumbers.join(', ')}</strong>
                    </span>
                    {group.organizations.length > 0 && (
                      <span>
                        Organizations: <strong className="text-foreground">{group.organizations.join(', ')}</strong>
                      </span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-muted-foreground text-xs">
                No recurring 3+ bidder cohorts identified under current criteria.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Selected Node Drawer */}
      <NetworkDetailDrawer
        selectedNode={selectedNode}
        onClose={() => setSelectedNode(null)}
        topRecurringPairs={data?.topRecurringPairs}
        recurringGroups={data?.recurringBidderGroups}
        allTenders={data?.bipartiteGraph?.tenderNodes}
      />

      {/* Mandatory Disclaimers */}
      <div className="rounded-xl border hairline bg-card/40 p-4 text-xs leading-relaxed text-muted-foreground space-y-1.5">
        <div className="flex items-start gap-2 text-foreground font-medium">
          <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <span>Analytical Disclaimer</span>
        </div>
        <p className="pl-6">{t('disclaimers.main')}</p>
        <p className="pl-6 font-medium text-cyan-400/90">{t('disclaimers.network')}</p>
      </div>
    </div>
  );
}

export default NetworkAnalysisPage;
