import { useState, useRef, useMemo, useEffect } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Building2, FileCheck2, Award, Sparkles, Filter } from 'lucide-react';

export interface GraphCompanyNode {
  id: number;
  canonicalId: string;
  label: string;
  canonicalName: string;
  nodeType: "company";
  participationCount: number;
  wins: number;
  losses: number;
  degree: number;
  screeningLevel?: string;
  normalizedName?: string;
  state?: string;
  x?: number;
  y?: number;
}

export interface GraphTenderNode {
  id: number;
  canonicalId: string;
  tenderNumber: string;
  label: string;
  title: string;
  nodeType: "tender";
  category: string;
  organization: string;
  estimatedValue: number;
  tenderDate: string;
  winner: string | null;
  bidderCount: number;
  x?: number;
  y?: number;
}

export interface GraphEdge {
  id: string;
  source: number; // company id
  target: number; // tender id
  companyName: string;
  tenderNumber: string;
  isWinner: boolean;
  bidRank: number;
  bidAmount: number;
}

interface ParticipationNetworkGraphProps {
  companies: GraphCompanyNode[];
  tenders: GraphTenderNode[];
  edges: GraphEdge[];
  selectedNodeId?: { id: number; type: "company" | "tender" } | null;
  onSelectNode: (node: { id: number; type: "company" | "tender"; data: GraphCompanyNode | GraphTenderNode } | null) => void;
  className?: string;
}

export function ParticipationNetworkGraph({
  companies,
  tenders,
  edges,
  selectedNodeId,
  onSelectNode,
  className = '',
}: ParticipationNetworkGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredNode, setHoveredNode] = useState<{ id: number; type: "company" | "tender" } | null>(null);

  // Compute bipartite layout positions
  const layout = useMemo(() => {
    const width = 1100;
    const height = 650;
    const topMargin = 70;
    const bottomMargin = 90;
    const leftMargin = 80;
    const rightMargin = 80;

    const usableWidth = width - leftMargin - rightMargin;

    // Arrange companies along the top arc / row
    const compCount = Math.max(1, companies.length);
    const compCols = Math.min(compCount, 8);
    const compRows = Math.ceil(compCount / compCols);

    const companyPositions = new Map<number, { x: number; y: number }>();
    companies.forEach((comp, idx) => {
      const col = idx % compCols;
      const row = Math.floor(idx / compCols);
      const x = leftMargin + (compCols > 1 ? (col / (compCols - 1)) * usableWidth : usableWidth / 2);
      const y = topMargin + row * 95;
      companyPositions.set(comp.id, { x, y });
    });

    // Arrange tenders along the bottom rows
    const tenderCount = Math.max(1, tenders.length);
    const tenderCols = Math.min(tenderCount, 8);
    const tenderStartY = topMargin + compRows * 95 + 120;

    const tenderPositions = new Map<number, { x: number; y: number }>();
    tenders.forEach((tender, idx) => {
      const col = idx % tenderCols;
      const row = Math.floor(idx / tenderCols);
      const x = leftMargin + (tenderCols > 1 ? (col / (tenderCols - 1)) * usableWidth : usableWidth / 2);
      const y = tenderStartY + row * 95;
      tenderPositions.set(tender.id, { x, y });
    });

    const viewBoxHeight = Math.max(height, tenderStartY + Math.ceil(tenderCount / tenderCols) * 95 + bottomMargin);

    return {
      width,
      height: viewBoxHeight,
      companyPositions,
      tenderPositions,
    };
  }, [companies, tenders]);

  // Determine active/connected elements for highlighting
  const activeConnections = useMemo(() => {
    const active = hoveredNode || selectedNodeId;
    if (!active) return null;

    const connectedCompanies = new Set<number>();
    const connectedTenders = new Set<number>();
    const connectedEdgeIds = new Set<string>();

    if (active.type === 'company') {
      connectedCompanies.add(active.id);
      edges.forEach((edge) => {
        if (edge.source === active.id) {
          connectedTenders.add(edge.target);
          connectedEdgeIds.add(edge.id);
        }
      });
    } else {
      connectedTenders.add(active.id);
      edges.forEach((edge) => {
        if (edge.target === active.id) {
          connectedCompanies.add(edge.source);
          connectedEdgeIds.add(edge.id);
        }
      });
    }

    return {
      connectedCompanies,
      connectedTenders,
      connectedEdgeIds,
    };
  }, [hoveredNode, selectedNodeId, edges]);

  // Drag pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom((prev) => Math.min(2.5, Math.max(0.5, prev + delta)));
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    onSelectNode(null);
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full overflow-hidden rounded-xl border hairline bg-[#070d18] select-none ${className}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      data-testid="participation-network-graph-container"
    >
      {/* Controls toolbar */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5 rounded-lg border hairline bg-[#0b1324]/90 p-1.5 backdrop-blur shadow-md">
        <button
          type="button"
          onClick={() => setZoom((z) => Math.min(2.5, z + 0.2))}
          className="p-1.5 rounded hover:bg-white/10 text-muted-foreground hover:text-white transition-colors"
          title="Zoom In"
          data-testid="button-zoom-in"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setZoom((z) => Math.max(0.5, z - 0.2))}
          className="p-1.5 rounded hover:bg-white/10 text-muted-foreground hover:text-white transition-colors"
          title="Zoom Out"
          data-testid="button-zoom-out"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={resetView}
          className="p-1.5 rounded hover:bg-white/10 text-muted-foreground hover:text-white transition-colors"
          title="Reset View"
          data-testid="button-reset-view"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
        <div className="h-4 w-px bg-white/20 mx-1" />
        <span className="text-[11px] font-mono text-muted-foreground px-1">{Math.round(zoom * 100)}%</span>
      </div>

      {/* Legend & Bipartite Level Indicators */}
      <div className="absolute bottom-4 left-4 z-20 flex flex-wrap items-center gap-4 rounded-lg border hairline bg-[#0b1324]/90 px-3.5 py-2 text-xs backdrop-blur shadow-md">
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-cyan-500 border border-cyan-300" />
          <span className="text-cyan-200 font-medium">Canonical Company</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-md bg-emerald-600 border border-emerald-400" />
          <span className="text-emerald-200 font-medium">Tender Package</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-amber-400" />
          <span className="text-amber-200 text-[11px]">Winning Bid Edge</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-slate-500" />
          <span className="text-slate-300 text-[11px]">Participating Bid</span>
        </div>
      </div>

      {/* Level Labels on Canvas */}
      <div className="absolute top-4 left-4 z-10 pointer-events-none">
        <div className="text-[11px] font-mono uppercase tracking-wider text-cyan-400/80 bg-cyan-950/40 border border-cyan-800/40 px-2 py-0.5 rounded w-max">
          Company Layer (Canonical Bidders)
        </div>
      </div>

      {/* SVG Canvas */}
      <svg
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        className="w-full h-full min-h-[580px] max-h-[720px] transition-transform duration-75"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '50% 50%',
        }}
      >
        <defs>
          <radialGradient id="net-bg-glow" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#0284c7" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#070d18" stopOpacity="0" />
          </radialGradient>
          <filter id="node-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Ambient background glow */}
        <rect x="0" y="0" width={layout.width} height={layout.height} fill="url(#net-bg-glow)" />

        {/* Mid-canvas bipartite division guide */}
        <line
          x1={40}
          y1={layout.height / 2}
          x2={layout.width - 40}
          y2={layout.height / 2}
          stroke="rgba(255, 255, 255, 0.05)"
          strokeDasharray="4 6"
        />
        <text
          x={layout.width / 2}
          y={layout.height / 2 - 8}
          textAnchor="middle"
          fill="rgba(148, 163, 184, 0.35)"
          fontSize="10"
          fontFamily="monospace"
        >
          COMPANY ↔ TENDER PARTICIPATION EDGES
        </text>

        {/* Participation Edges */}
        <g className="edges-layer">
          {edges.map((edge) => {
            const sourcePos = layout.companyPositions.get(edge.source);
            const targetPos = layout.tenderPositions.get(edge.target);
            if (!sourcePos || !targetPos) return null;

            const isHighlighted = activeConnections
              ? activeConnections.connectedEdgeIds.has(edge.id)
              : false;
            const isDimmed = activeConnections ? !isHighlighted : false;

            const strokeColor = edge.isWinner
              ? isHighlighted
                ? '#f59e0b'
                : 'rgba(245, 158, 11, 0.65)'
              : isHighlighted
              ? '#38bdf8'
              : 'rgba(100, 116, 139, 0.28)';

            const strokeWidth = isHighlighted ? (edge.isWinner ? 2.5 : 2) : edge.isWinner ? 1.5 : 1;

            return (
              <line
                key={edge.id}
                x1={sourcePos.x}
                y1={sourcePos.y + 16}
                x2={targetPos.x}
                y2={targetPos.y - 16}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                strokeOpacity={isDimmed ? 0.08 : 1}
                strokeDasharray={edge.isWinner ? undefined : '2 3'}
                className="transition-all duration-150"
              />
            );
          })}
        </g>

        {/* Tender Nodes Layer (Bottom) */}
        <g className="tenders-layer">
          {tenders.map((tender) => {
            const pos = layout.tenderPositions.get(tender.id);
            if (!pos) return null;

            const isSelected = selectedNodeId?.type === 'tender' && selectedNodeId.id === tender.id;
            const isHovered = hoveredNode?.type === 'tender' && hoveredNode.id === tender.id;
            const isConnected = activeConnections ? activeConnections.connectedTenders.has(tender.id) : false;
            const isDimmed = activeConnections ? !isConnected : false;

            return (
              <g
                key={`t-${tender.id}`}
                transform={`translate(${pos.x}, ${pos.y})`}
                className="cursor-pointer transition-transform duration-150"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectNode({ id: tender.id, type: 'tender', data: tender });
                }}
                onMouseEnter={() => setHoveredNode({ id: tender.id, type: 'tender' })}
                onMouseLeave={() => setHoveredNode(null)}
                data-testid={`graph-tender-node-${tender.id}`}
              >
                {/* Node Box */}
                <rect
                  x="-36"
                  y="-18"
                  width="72"
                  height="36"
                  rx="6"
                  fill={isSelected ? '#065f46' : isHovered ? '#047857' : '#0f172a'}
                  stroke={isSelected ? '#34d399' : isConnected ? '#10b981' : '#334155'}
                  strokeWidth={isSelected || isConnected ? 2 : 1}
                  filter={isSelected || isConnected ? 'url(#node-glow)' : undefined}
                  opacity={isDimmed ? 0.25 : 1}
                />

                {/* Tender Label */}
                <text
                  x="0"
                  y="-2"
                  textAnchor="middle"
                  fontSize="9"
                  fontWeight="bold"
                  fill={isSelected || isConnected ? '#a7f3d0' : '#e2e8f0'}
                  fontFamily="monospace"
                  opacity={isDimmed ? 0.25 : 1}
                >
                  {tender.canonicalId}
                </text>

                <text
                  x="0"
                  y="10"
                  textAnchor="middle"
                  fontSize="8"
                  fill={isSelected || isConnected ? '#6ee7b7' : '#94a3b8'}
                  opacity={isDimmed ? 0.25 : 1}
                >
                  {tender.category.slice(0, 10)}
                </text>

                {/* Subtitle tooltip underneath */}
                <text
                  x="0"
                  y="30"
                  textAnchor="middle"
                  fontSize="8.5"
                  fill="#94a3b8"
                  opacity={isDimmed ? 0.2 : 0.85}
                >
                  {tender.tenderNumber}
                </text>
              </g>
            );
          })}
        </g>

        {/* Company Nodes Layer (Top) */}
        <g className="companies-layer">
          {companies.map((company) => {
            const pos = layout.companyPositions.get(company.id);
            if (!pos) return null;

            const isSelected = selectedNodeId?.type === 'company' && selectedNodeId.id === company.id;
            const isHovered = hoveredNode?.type === 'company' && hoveredNode.id === company.id;
            const isConnected = activeConnections ? activeConnections.connectedCompanies.has(company.id) : false;
            const isDimmed = activeConnections ? !isConnected : false;

            const radius = Math.max(16, Math.min(24, 14 + (company.degree / 3)));

            return (
              <g
                key={`c-${company.id}`}
                transform={`translate(${pos.x}, ${pos.y})`}
                className="cursor-pointer transition-transform duration-150"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectNode({ id: company.id, type: 'company', data: company });
                }}
                onMouseEnter={() => setHoveredNode({ id: company.id, type: 'company' })}
                onMouseLeave={() => setHoveredNode(null)}
                data-testid={`graph-company-node-${company.id}`}
              >
                {/* Node Outer Circle */}
                <circle
                  r={radius}
                  fill={isSelected ? '#0369a1' : isHovered ? '#0284c7' : '#0f172a'}
                  stroke={isSelected ? '#38bdf8' : isConnected ? '#0ea5e9' : '#38bdf8'}
                  strokeWidth={isSelected || isConnected ? 2.5 : 1.5}
                  filter={isSelected || isConnected ? 'url(#node-glow)' : undefined}
                  opacity={isDimmed ? 0.25 : 1}
                />

                {/* Wins indicator badge if won */}
                {company.wins > 0 && (
                  <circle
                    cx={radius - 4}
                    cy={-radius + 4}
                    r="5"
                    fill="#f59e0b"
                    stroke="#0b1324"
                    strokeWidth="1.5"
                    opacity={isDimmed ? 0.25 : 1}
                  />
                )}

                {/* Canonical ID Text */}
                <text
                  x="0"
                  y="3"
                  textAnchor="middle"
                  fontSize="9.5"
                  fontWeight="bold"
                  fill={isSelected || isConnected ? '#e0f2fe' : '#bae6fd'}
                  fontFamily="monospace"
                  opacity={isDimmed ? 0.25 : 1}
                >
                  {company.canonicalId}
                </text>

                {/* Canonical Name below node */}
                <text
                  x="0"
                  y={radius + 14}
                  textAnchor="middle"
                  fontSize="9.5"
                  fontWeight="500"
                  fill={isSelected || isConnected ? '#ffffff' : '#cbd5e1'}
                  opacity={isDimmed ? 0.2 : 1}
                >
                  {company.canonicalName.length > 18
                    ? `${company.canonicalName.slice(0, 16)}…`
                    : company.canonicalName}
                </text>

                {/* Participation stats subtitle */}
                <text
                  x="0"
                  y={radius + 26}
                  textAnchor="middle"
                  fontSize="8"
                  fill="#64748b"
                  opacity={isDimmed ? 0.2 : 0.9}
                >
                  {company.degree} tenders · {company.wins}W
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
