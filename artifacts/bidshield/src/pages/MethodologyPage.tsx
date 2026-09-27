import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  FileCheck2,
  GitBranch,
  HelpCircle,
  Info,
  Layers,
  Percent,
  RotateCcw,
  Scale,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Zap,
  Network,
  Building2,
  Users,
} from 'lucide-react';

const DISCLAIMER =
  'Price clustering is a statistical indicator for further review. It does not establish collusion, coordination, wrongdoing, or legal liability.';

export default function MethodologyPage() {
  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div>
        <div className="eyebrow text-primary">AUDITABLE SCREENING FRAMEWORK</div>
        <h1 className="display-serif mt-2 text-4xl font-bold tracking-tight text-foreground md:text-5xl">
          Screening Methodology
        </h1>
        <p className="mt-3 text-base text-muted-foreground leading-relaxed max-w-3xl">
          BidShield implements auditable, deterministic statistical screening engines designed to highlight unusual bidding patterns across comparable procurement datasets without making legal accusations.
        </p>
      </div>

      {/* Mandatory Safety Notice */}
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-5 flex items-start gap-4 text-sm leading-relaxed text-foreground">
        <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div>
          <h3 className="font-bold text-foreground mb-1">Core Analytical Principle</h3>
          <p className="text-muted-foreground">
            {DISCLAIMER} Every indicator produced by BidShield is a descriptive quantitative measurement intended to assist public-sector analysts in prioritizing records for independent review.
          </p>
        </div>
      </div>

      {/* Engine 1: Price Clustering Screening (Phase 4) */}
      <section id="price-clustering" className="panel p-6 sm:p-8 space-y-5">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-3 text-primary">
            <Percent className="h-6 w-6" />
          </div>
          <div>
            <div className="eyebrow text-muted-foreground">Screening Engine 01 · Phase 4</div>
            <h2 className="text-2xl font-bold text-foreground">Price Clustering Screening</h2>
          </div>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed">
          The price clustering detection engine evaluates whether submitted bid prices exhibit unusually narrow concentration or dispersion compared with an appropriate, multi-attribute historical comparison population of similar procurements.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border hairline bg-secondary/20 p-4 space-y-2">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">1. Coefficient of Variation (25% Weight)</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Measures the standard deviation of submitted bid prices divided by the mean tender bid:
            </p>
            <div className="rounded bg-background p-2 font-mono text-[11px]">
              CV = σ(bids) / μ(bids)
            </div>
            <p className="text-[11px] text-muted-foreground">
              CV values below 0.015 (1.5%) indicate tight clustering relative to normal competitive variation.
            </p>
          </div>

          <div className="rounded-lg border hairline bg-secondary/20 p-4 space-y-2">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">2. Historical Baseline Comparison (25% Weight)</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Compares current tender's CV against the median CV of historical comparable tenders:
            </p>
            <div className="rounded bg-background p-2 font-mono text-[11px]">
              ratio = CV_current / median(CV_comparable)
            </div>
            <p className="text-[11px] text-muted-foreground">
              Ratios &lt; 0.45 indicate the tender is less than half as dispersed as historical peers.
            </p>
          </div>

          <div className="rounded-lg border hairline bg-secondary/20 p-4 space-y-2">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">3. Percentile Rank Deviation (25% Weight)</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Calculates the empirical percentile position of the target tender's CV within the peer population:
            </p>
            <div className="rounded bg-background p-2 font-mono text-[11px]">
              percentile = (count(CV_comp &lt; CV_target) / n) × 100%
            </div>
            <p className="text-[11px] text-muted-foreground">
              Tenders ranking below the 20th percentile exhibit unusually tight clustering relative to peer procurements.
            </p>
          </div>

          <div className="rounded-lg border hairline bg-secondary/20 p-4 space-y-2">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">4. Relative Distance & Inter-Bid Step (25% Weight)</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Evaluates normalized spread, inter-bid gap consistency, and repeated price positioning offsets:
            </p>
            <div className="rounded bg-background p-2 font-mono text-[11px]">
              spread_pct = ((max_bid - min_bid) / min_bid) × 100%
            </div>
            <p className="text-[11px] text-muted-foreground">
              Captures narrow distance grouping among losing bids above the winning benchmark.
            </p>
          </div>
        </div>

        <div className="rounded-lg bg-secondary/30 p-4 border hairline space-y-2 text-xs">
          <div className="font-semibold text-foreground flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-primary" /> Minimum Sample Size Enforcement
          </div>
          <p className="text-muted-foreground leading-relaxed">
            Requires at least <b>3 bids per tender</b> and at least <b>5 historical comparable tenders</b>. If these minimum requirements are not met, the engine returns an explicit <code>INSUFFICIENT_DATA</code> status rather than generating unreliable signals.
          </p>
        </div>
      </section>

      {/* Engine 2: Winner Rotation Screening */}
      <section className="panel p-6 sm:p-8 space-y-5">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-3 text-primary">
            <RotateCcw className="h-6 w-6" />
          </div>
          <div>
            <div className="eyebrow text-muted-foreground">Screening Engine 02</div>
            <h2 className="text-2xl font-bold text-foreground">Winner Rotation Screening</h2>
          </div>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed">
          The winner rotation engine screens for structured turn-taking in which a recurring cohort of bidders appears across comparable tenders and different members repeatedly take turns winning.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border hairline bg-secondary/20 p-4 space-y-2">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">1. Alternation Frequency (30% Weight)</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Measures the proportion of consecutive tenders in the comparable sequence where the winning bidder switches between different firms:
            </p>
            <div className="rounded bg-background p-2 font-mono text-[11px]">
              alternation_freq = winner_switches / (total_tenders - 1)
            </div>
          </div>

          <div className="rounded-lg border hairline bg-secondary/20 p-4 space-y-2">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">2. Winner Transition Pattern (25% Weight)</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Measures whether winner transitions occur within the identified recurring bidder cohort rather than with outside market entrants.
            </p>
            <div className="rounded bg-background p-2 font-mono text-[11px]">
              transition_pattern = cohort_transitions / total_transitions
            </div>
          </div>

          <div className="rounded-lg border hairline bg-secondary/20 p-4 space-y-2">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">3. Repeated Participant Set (25% Weight)</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Calculates the mean Jaccard similarity of participating bidder sets across consecutive tenders in the comparison group.
            </p>
            <div className="rounded bg-background p-2 font-mono text-[11px]">
              J(A, B) = |A ∩ B| / |A ∪ B|
            </div>
          </div>

          <div className="rounded-lg border hairline bg-secondary/20 p-4 space-y-2">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">4. Concentration & Sequence Regularity (20% Weight)</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Evaluates win distribution entropy among winning cohort members and checks for cyclical permutation lag matches (e.g. A → B → C → A → B → C).
            </p>
            <div className="rounded bg-background p-2 font-mono text-[11px]">
              entropy = -∑ p_i log2(p_i) / log2(k)
            </div>
          </div>
        </div>
      </section>

      {/* Engine 3: Cover-Bid Screening */}
      <section className="panel p-6 sm:p-8 space-y-5">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-3 text-primary">
            <Scale className="h-6 w-6" />
          </div>
          <div>
            <div className="eyebrow text-muted-foreground">Screening Engine 03</div>
            <h2 className="text-2xl font-bold text-foreground">Cover-Bid / Suspicious Bid-Position Screening</h2>
          </div>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed">
          The cover-bid screen evaluates the structural positioning of losing bids relative to the winning bid, identifying bidders that repeatedly submit bids at consistent relative margins across multiple comparable tenders.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border hairline bg-secondary/20 p-4 space-y-2">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Relative Bid Distance Metric</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              For every losing bid, the percentage distance above the winning bid is calculated:
            </p>
            <div className="rounded bg-background p-2 font-mono text-[11px]">
              relative_distance = ((bid - winning_bid) / winning_bid) × 100%
            </div>
          </div>

          <div className="rounded-lg border hairline bg-secondary/20 p-4 space-y-2">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Historical Proximity Matching (35% Weight)</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Compares a bidder's current distance against its historical median distance across comparable tenders, identifying repeated positioning within ±1.5% tolerance.
            </p>
            <div className="rounded bg-background p-2 font-mono text-[11px]">
              |current_delta - hist_median| ≤ 1.5%
            </div>
          </div>

          <div className="rounded-lg border hairline bg-secondary/20 p-4 space-y-2">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Position Clustering (25% Weight)</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Measures the standard deviation of losing bids in the current tender. Tight clustering (e.g. std dev &lt; 1.0%) reflects narrow grouping above the winner.
            </p>
            <div className="rounded bg-background p-2 font-mono text-[11px]">
              clustering_std_dev = σ(relative_distances)
            </div>
          </div>

          <div className="rounded-lg border hairline bg-secondary/20 p-4 space-y-2">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Spread & Delta Consistency (40% Weight)</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Considers historical variance (std dev of historical losing bids) and presence of a substantial margin separation from the winner.
            </p>
            <div className="rounded bg-background p-2 font-mono text-[11px]">
              consistency = max(0, 1 - hist_std_dev / 4.0)
            </div>
          </div>
        </div>
      </section>

      {/* Phase 5: Participation Network Methodology */}
      <section className="panel p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between border-b hairline pb-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-cyan-950/80 border border-cyan-800/80 p-3 text-cyan-400">
              <Network className="h-6 w-6" />
            </div>
            <div>
              <div className="eyebrow text-cyan-400">PHASE 5 SCREENING SPECIFICATION</div>
              <h2 className="text-2xl font-bold text-foreground">Participation Network Methodology</h2>
            </div>
          </div>
          <span className="font-mono text-xs px-2.5 py-1 rounded bg-secondary text-foreground font-bold">
            methodology_version = participation_network_v1.0
          </span>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed">
          The Participation Network screening engine identifies and visualizes recurring participation relationships between canonical company entities and procurement tenders. A network relationship represents an <em>observed participation pattern</em> in historical records; it does not establish collusion, coordination, fraud, or wrongdoing.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border hairline bg-secondary/20 p-4 space-y-2">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-cyan-400" /> 1. Canonical Entity Representation
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Companies are represented strictly using canonical entity IDs (e.g., <code>CMP-001</code>) resolved through the Phase 2 entity-resolution pipeline. Spelling variations, legal suffix differences, and alternate names never create duplicate nodes. Records with <code>REVIEW_REQUIRED</code> status are not silently merged.
            </p>
          </div>

          <div className="rounded-lg border hairline bg-secondary/20 p-4 space-y-2">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Network className="h-3.5 w-3.5 text-primary" /> 2. Bipartite Company ↔ Tender Graph
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              The model constructs a bipartite graph where Company nodes connect to Tender nodes via participation edges. Every edge captures bid rank, amount, and award status. Company degree equals the number of unique connected tenders.
            </p>
          </div>

          <div className="rounded-lg border hairline bg-secondary/20 p-4 space-y-2">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-amber-400" /> 3. Co-Participation & Projected Pairs
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Shared tender participation creates derived co-participation relationships. Co-occurrence frequency is calculated deterministically as <code>shared_tenders / min(tenders_A, tenders_B)</code> alongside Jaccard similarity.
            </p>
          </div>

          <div className="rounded-lg border hairline bg-secondary/20 p-4 space-y-2">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-indigo-400" /> 4. Comparable Tender Recurrence
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Recurrence is evaluated strictly across comparable populations sharing category, procuring authority, department, and geography. Tenders from unrelated domains are never aggregated.
            </p>
          </div>

          <div className="rounded-lg border hairline bg-secondary/20 p-4 space-y-2">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <RotateCcw className="h-3.5 w-3.5 text-primary" /> 5. Recurring Bidder Cohorts
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Deterministic combinatorial algorithms identify recurring combinations of 3+ companies repeatedly appearing together. Persistent bidder groups are classified as observational signals without cartel labeling.
            </p>
          </div>

          <div className="rounded-lg border hairline bg-secondary/20 p-4 space-y-2">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> 6. Traceable Evidence Register
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Every network pattern indicator attaches traceable evidence records under indicator type <code>PARTICIPATION_NETWORK</code>, including exact supporting tender IDs, participation frequencies, and participating entities.
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4" />
            <span>7. Sample Size Safeguard (INSUFFICIENT_DATA)</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            When a tender has fewer than 2 bids, or when a company has participated in only 1 tender, or comparable baseline data is absent, the engine returns an explicit <code>INSUFFICIENT_DATA</code> status and score <code>null</code>. The system never manufactures artificial network scores.
          </p>
        </div>
      </section>

      {/* Comparable Tenders Mechanism */}
      <section className="panel p-6 sm:p-8 space-y-5">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-3 text-primary">
            <Layers className="h-6 w-6" />
          </div>
          <div>
            <div className="eyebrow text-muted-foreground">Population Construction</div>
            <h2 className="text-2xl font-bold text-foreground">Comparable Tenders Multi-Attribute Matching</h2>
          </div>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed">
          Tenders are never compared blindly across unrelated markets. The system groups comparable procurement using multi-attribute similarity scoring:
        </p>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-secondary/30 p-4">
            <div className="font-bold text-sm text-foreground">Domain Alignment</div>
            <p className="mt-1 text-xs text-muted-foreground">Category matching (35% weight) and Procuring Entity (25% weight).</p>
          </div>
          <div className="rounded-lg bg-secondary/30 p-4">
            <div className="font-bold text-sm text-foreground">Financial Scale Matching</div>
            <p className="mt-1 text-xs text-muted-foreground">Logarithmic estimated value ratio (within ~5x scale factor, 10% weight).</p>
          </div>
          <div className="rounded-lg bg-secondary/30 p-4">
            <div className="font-bold text-sm text-foreground">Geographic & Temporal</div>
            <p className="mt-1 text-xs text-muted-foreground">State/Location alignment (10% weight) and 36-month rolling window (5% weight).</p>
          </div>
        </div>
      </section>

      {/* Screening Status Tiers */}
      <section className="panel p-6 sm:p-8 space-y-5">
        <h2 className="text-2xl font-bold text-foreground">Screening Intensity Tiers</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Scores (0–100) are mapped to neutral descriptive intensity tiers:
        </p>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-1.5">
            <div className="font-mono text-xs font-bold text-primary">0 – 29</div>
            <div className="font-bold text-sm text-foreground">LOW INDICATOR</div>
            <p className="text-[11px] text-muted-foreground">Consistent with baseline competitive dispersion.</p>
          </div>

          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-1.5">
            <div className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400">30 – 59</div>
            <div className="font-bold text-sm text-foreground">MODERATE INDICATOR</div>
            <p className="text-[11px] text-muted-foreground">Notable pattern worthy of routine observational monitoring.</p>
          </div>

          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-1.5">
            <div className="font-mono text-xs font-bold text-destructive">60 – 79</div>
            <div className="font-bold text-sm text-foreground">ELEVATED INDICATOR</div>
            <p className="text-[11px] text-muted-foreground">Elevated statistical indicator recommended for structured caseworker review.</p>
          </div>

          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 space-y-1.5">
            <div className="font-mono text-xs font-bold text-destructive">80 – 100</div>
            <div className="font-bold text-sm text-foreground">HIGH INDICATOR</div>
            <p className="text-[11px] text-muted-foreground">Strongly structured pattern warranting detailed forensic audit.</p>
          </div>
        </div>
      </section>

      {/* Engine 5: Too-Neat Losing Bid Analysis (Phase 6) */}
      <section id="neat-loss" className="panel p-6 sm:p-8 space-y-5">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-3 text-primary">
            <Scale className="h-6 w-6" />
          </div>
          <div>
            <div className="eyebrow text-muted-foreground">Screening Engine 05 · Phase 6 · neat_losing_bid_v1.0</div>
            <h2 className="text-2xl font-bold text-foreground">Too-Neat Losing Bid Analysis</h2>
          </div>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed">
          The too-neat losing bid screening engine identifies unusually consistent or repetitive losing-bid behavior across comparable tenders. It examines whether an entity repeatedly participates but rarely wins, loses by unusually consistent percentage margins above the winning bid, or maintains fixed finishing ranks (such as repeated runner-up positions).
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border hairline bg-secondary/20 p-4 space-y-2">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">1. Relative Losing-Bid Gap (35% Weight)</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              For each losing bid, the relative gap percentage distance from the winning bid is calculated:
            </p>
            <div className="rounded bg-background p-2 font-mono text-[11px]">
              relative_gap = ((bid_amount - winning_bid) / winning_bid) × 100
            </div>
            <p className="text-[11px] text-muted-foreground">
              Historical dispersion is evaluated using the Coefficient of Variation (CV = σ / μ). Low CV (e.g. &lt; 0.15) indicates unusually consistent margins.
            </p>
          </div>

          <div className="rounded-lg border hairline bg-secondary/20 p-4 space-y-2">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">2. Rank Consistency & Repetition (25% Weight)</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Tracks the distribution and repetition of finishing bid ranks across comparable procurements:
            </p>
            <div className="rounded bg-background p-2 font-mono text-[11px]">
              mode_rank_ratio = count(most_frequent_rank) / total_losses
            </div>
            <p className="text-[11px] text-muted-foreground">
              A company repeatedly finishing at Rank 2 (runner-up) in ≥ 50% of comparable tenders contributes to elevated consistency signals.
            </p>
          </div>

          <div className="rounded-lg border hairline bg-secondary/20 p-4 space-y-2">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">3. Loss Rate & Participation (15% Weight)</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Measures the proportion of participated comparable tenders that resulted in non-award:
            </p>
            <div className="rounded bg-background p-2 font-mono text-[11px]">
              loss_rate = losses / participation_count
            </div>
            <p className="text-[11px] text-muted-foreground">
              High participation with persistent losing outcomes is not suspicious on its own; it becomes an indicator only when combined with narrow relative gap stability.
            </p>
          </div>

          <div className="rounded-lg border hairline bg-secondary/20 p-4 space-y-2">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">4. Near-Winner Proximity (15% Weight)</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Identifies companies that repeatedly submit bids within a narrow relative band immediately above the winner:
            </p>
            <div className="rounded bg-background p-2 font-mono text-[11px]">
              median_relative_gap ≤ 2.5% & std_dev ≤ 1.2%
            </div>
            <p className="text-[11px] text-muted-foreground">
              Tracks consistent runner-up pricing that closely shadows winning bids across sequential packages.
            </p>
          </div>
        </div>

        {/* Comparable Cohort & Safeguard Box */}
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3 text-xs leading-relaxed">
          <h4 className="font-bold text-foreground flex items-center gap-1.5 text-sm">
            <Layers className="h-4 w-4 text-primary" /> Comparable Population & Sample Adequacy
          </h4>
          <p className="text-muted-foreground">
            Screening is strictly restricted to comparable tenders sharing the same procurement category, procuring organization, department, and financial scale. A minimum of <strong>5 comparable losing observations</strong> is strictly enforced. If fewer than 5 observations are available, the detector assigns an explicit <code>INSUFFICIENT_DATA</code> status and will not calculate a score.
          </p>
          <div className="rounded bg-background/80 p-3 border hairline text-muted-foreground italic">
            &ldquo;Consistent losing-bid patterns may arise for legitimate reasons, including market structure, pricing strategy, cost structure, qualification requirements, or competitive positioning. The detector identifies statistical patterns for review; it does not establish collusion.&rdquo;
          </div>
        </div>
      </section>

      {/* Engine 4: Combined Risk & Evidence Engine (Phase 7 - combined_risk_v1.0) */}
      <section className="panel p-6 sm:p-8 space-y-6 border-l-4 border-l-primary">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="eyebrow text-primary">PHASE 7 ENGINE</div>
            <h2 className="text-2xl font-bold text-foreground mt-1">Combined Risk & Evidence Engine</h2>
          </div>
          <div className="rounded-full bg-primary/10 px-3 py-1 font-mono text-xs font-semibold text-primary border border-primary/20">
            combined_risk_v1.0
          </div>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed">
          The Combined Risk & Evidence Engine aggregates the independent outputs of all 5 statistical detectors into a transparent, explainable <strong>Overall Screening Score (0–100)</strong> for tenders and companies without ever obscuring the underlying component evidence.
        </p>

        {/* 5 Detectors & Baseline Weight Matrix */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 text-xs">
          <div className="rounded-lg border hairline bg-secondary/30 p-3.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-foreground">1. Winner Rotation</span>
              <span className="font-mono text-primary font-semibold">20% Base</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Evaluates turn-taking cycles and incumbent market share distribution.
            </p>
          </div>

          <div className="rounded-lg border hairline bg-secondary/30 p-3.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-foreground">2. Cover-Bid</span>
              <span className="font-mono text-primary font-semibold">20% Base</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Measures relative losing bid distance and non-competitive bid margins.
            </p>
          </div>

          <div className="rounded-lg border hairline bg-secondary/30 p-3.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-foreground">3. Price Clustering</span>
              <span className="font-mono text-primary font-semibold">20% Base</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Analyzes coefficient of variation (CV) and normalized bid spreads.
            </p>
          </div>

          <div className="rounded-lg border hairline bg-secondary/30 p-3.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-foreground">4. Participation Network</span>
              <span className="font-mono text-primary font-semibold">20% Base</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Detects recurring co-bidding pairs and persistent bidder cliques.
            </p>
          </div>

          <div className="rounded-lg border hairline bg-secondary/30 p-3.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-foreground">5. Too-Neat Losing Bid</span>
              <span className="font-mono text-primary font-semibold">20% Base</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Identifies artificial losing margin stability and repeated bid ranks.
            </p>
          </div>
        </div>

        {/* Dynamic Weight Renormalization & Safeguards */}
        <div className="grid gap-4 sm:grid-cols-2 text-xs leading-relaxed">
          <div className="rounded-lg border hairline bg-secondary/20 p-4 space-y-2">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Dynamic Weight Renormalization</h3>
            <p className="text-muted-foreground">
              Missing or inadequate data in any detector does <strong>not</strong> drag down the score to zero. Weights are dynamically renormalized across only available indicators:
            </p>
            <div className="rounded bg-background p-2.5 font-mono text-[11px]">
              w_effective = w_base / sum(w_available)<br />
              overall_score = sum(score_i × w_effective)
            </div>
            <p className="text-[11px] text-muted-foreground">
              Example: If network analysis has insufficient history (4 available indicators), each available detector is scaled to 25% effective weight.
            </p>
          </div>

          <div className="rounded-lg border hairline bg-secondary/20 p-4 space-y-2">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Minimum Data Requirement Safeguard</h3>
            <p className="text-muted-foreground">
              To prevent misleading screening signals, the combined engine strictly enforces a minimum of <strong>2 independent indicators with sufficient historical data</strong>.
            </p>
            <div className="rounded bg-background p-2.5 font-mono text-[11px]">
              available_count &lt; 2 → overall_status = &quot;INSUFFICIENT_DATA&quot;<br />
              overall_score = null
            </div>
            <p className="text-[11px] text-muted-foreground">
              BidShield never manufactures an overall score when there is insufficient independent evidence.
            </p>
          </div>
        </div>

        {/* Screening Classifications Table */}
        <div className="rounded-lg border hairline bg-secondary/10 p-4 space-y-3 text-xs">
          <h3 className="font-bold text-foreground text-sm">Explainable Screening Classifications</h3>
          <div className="grid gap-2 sm:grid-cols-4">
            <div className="p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 space-y-1">
              <span className="font-bold text-emerald-600 dark:text-emerald-400">0 – 24</span>
              <p className="font-semibold text-foreground">LOW SCREENING SIGNAL</p>
              <p className="text-[11px] text-muted-foreground">Open competition; observed indicators within normal parameters.</p>
            </div>
            <div className="p-3 rounded-lg border border-blue-500/20 bg-blue-500/5 space-y-1">
              <span className="font-bold text-blue-600 dark:text-blue-400">25 – 49</span>
              <p className="font-semibold text-foreground">MODERATE SCREENING SIGNAL</p>
              <p className="text-[11px] text-muted-foreground">Mild statistical anomaly in 1 or more component detectors.</p>
            </div>
            <div className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/5 space-y-1">
              <span className="font-bold text-amber-600 dark:text-amber-400">50 – 74</span>
              <p className="font-semibold text-foreground">ELEVATED SCREENING SIGNAL</p>
              <p className="text-[11px] text-muted-foreground">Multiple independent detectors show correlated unusual patterns.</p>
            </div>
            <div className="p-3 rounded-lg border border-rose-500/20 bg-rose-500/5 space-y-1">
              <span className="font-bold text-rose-600 dark:text-rose-400">75 – 100</span>
              <p className="font-semibold text-foreground">HIGH SCREENING SIGNAL</p>
              <p className="text-[11px] text-muted-foreground">High convergence across detectors; recommended for audit review.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Engine 6: Investigator Casework Workflow & Platform Funnel (Phase 8) */}
      <section className="panel p-6 sm:p-8 space-y-6 border-l-4 border-l-cyan-500" data-testid="section-methodology-casework">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="eyebrow text-cyan-500">PHASE 8 WORKSPACE SPECIFICATION</div>
            <h2 className="text-2xl font-bold text-foreground mt-1">Investigator Casework Workflow & Platform Funnel</h2>
          </div>
          <div className="rounded-full bg-cyan-500/10 px-3 py-1 font-mono text-xs font-semibold text-cyan-400 border border-cyan-500/20">
            casework_v1.0
          </div>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed">
          BidShield transitions statistical screening outputs into auditable investigator casework workflows through a structured, multi-stage platform funnel that separates automated quantitative screening from qualitative caseworker assessment.
        </p>

        <div className="grid gap-4 sm:grid-cols-4 text-xs">
          <div className="rounded-lg border hairline bg-secondary/30 p-4 space-y-2">
            <div className="font-mono text-[10px] text-cyan-400 font-bold uppercase">Stage 01</div>
            <h3 className="font-bold text-foreground text-sm">Screening & Queueing</h3>
            <p className="text-muted-foreground leading-relaxed">
              Tenders exceeding screening thresholds (Score ≥ 50) are automatically routed into the Review Queue with priority flags.
            </p>
          </div>

          <div className="rounded-lg border hairline bg-secondary/30 p-4 space-y-2">
            <div className="font-mono text-[10px] text-cyan-400 font-bold uppercase">Stage 02</div>
            <h3 className="font-bold text-foreground text-sm">Workspace Initialization</h3>
            <p className="text-muted-foreground leading-relaxed">
              Investigators open a dedicated workspace (<code>OPEN</code> or <code>IN_REVIEW</code>) capturing 8 independent evidence perspectives.
            </p>
          </div>

          <div className="rounded-lg border hairline bg-secondary/30 p-4 space-y-2">
            <div className="font-mono text-[10px] text-cyan-400 font-bold uppercase">Stage 03</div>
            <h3 className="font-bold text-foreground text-sm">Multi-Tab Evidence Evaluation</h3>
            <p className="text-muted-foreground leading-relaxed">
              Analysts inspect bid spreads, participation graphs, neat losing margins, data lineage provenance, and attach structured notes.
            </p>
          </div>

          <div className="rounded-lg border hairline bg-secondary/30 p-4 space-y-2">
            <div className="font-mono text-[10px] text-cyan-400 font-bold uppercase">Stage 04</div>
            <h3 className="font-bold text-foreground text-sm">Dossier Export & Audit Log</h3>
            <p className="text-muted-foreground leading-relaxed">
              Export formal, non-accusatory printable HTML dossiers and CSV schedules backed by an immutable audit activity log.
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-2 text-xs text-muted-foreground leading-relaxed">
          <div className="font-bold text-foreground flex items-center gap-1.5 text-sm">
            <ShieldCheck className="h-4 w-4 text-primary" /> Casework Guardrails & Non-Accusatory Principles
          </div>
          <p>
            Investigator notes, status tags (<code>OPEN</code>, <code>IN_REVIEW</code>, <code>WATCHLIST</code>, <code>CLOSED</code>), and export dossiers strictly adhere to objective, non-accusatory terminology. System flags remain quantitative screening indicators intended to prioritize records for manual review; they do not establish wrongdoing or legal liability.
          </p>
        </div>
      </section>

      {/* Phase 9: AI-Assisted Investigation & Grounded LLM Evidence Framework */}
      <section className="panel p-6 sm:p-8 space-y-6 border-l-4 border-l-indigo-500" data-testid="section-methodology-ai">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="eyebrow text-indigo-500">PHASE 9 AI INVESTIGATION FRAMEWORK</div>
            <h2 className="text-2xl font-bold text-foreground mt-1">AI-Assisted Investigation & Grounded LLM Evidence Framework</h2>
          </div>
          <div className="rounded-full bg-indigo-500/10 px-3 py-1 font-mono text-xs font-semibold text-indigo-400 border border-indigo-500/20">
            ai_assistant_v1.0
          </div>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed">
          BidShield integrates an AI-assisted investigation layer that summarizes calculated evidence, generates structured draft reports, and answers investigator questions. The AI operates exclusively over data supplied by BidShield's statistical screening engines and never generates independent conclusions.
        </p>

        <div className="grid gap-4 sm:grid-cols-2 text-xs">
          <div className="rounded-lg border hairline bg-secondary/30 p-4 space-y-2">
            <h3 className="font-bold text-foreground text-sm">1. Evidence-Grounded Context</h3>
            <p className="text-muted-foreground leading-relaxed">
              Before every AI request, BidShield constructs a structured evidence context containing only verified data: tender details, bid schedules, company records, calculated indicator scores, evidence records, methodology references, and investigator notes.
            </p>
          </div>

          <div className="rounded-lg border hairline bg-secondary/30 p-4 space-y-2">
            <h3 className="font-bold text-foreground text-sm">2. AI Does NOT Calculate Risk</h3>
            <p className="text-muted-foreground leading-relaxed">
              The AI assistant summarizes and explains pre-calculated BidShield evidence. It does not compute new risk scores, modify existing scores, or generate probability estimates of collusion or fraud.
            </p>
          </div>

          <div className="rounded-lg border hairline bg-secondary/30 p-4 space-y-2">
            <h3 className="font-bold text-foreground text-sm">3. Non-Accusatory Output Validation</h3>
            <p className="text-muted-foreground leading-relaxed">
              Every AI-generated response is validated against a prohibited-term filter. Outputs containing accusatory terms (e.g., "guilty", "cartel", "fraud confirmed") are automatically rejected and replaced with a safe, deterministic fallback summary.
            </p>
          </div>

          <div className="rounded-lg border hairline bg-secondary/30 p-4 space-y-2">
            <h3 className="font-bold text-foreground text-sm">4. Prompt Injection Protection</h3>
            <p className="text-muted-foreground leading-relaxed">
              All procurement data fields (company names, tender descriptions, investigator notes) are treated as passive data and isolated from system instructions. Embedded instruction override attempts are sanitized before processing.
            </p>
          </div>

          <div className="rounded-lg border hairline bg-secondary/30 p-4 space-y-2">
            <h3 className="font-bold text-foreground text-sm">5. Human Review Workflow</h3>
            <p className="text-muted-foreground leading-relaxed">
              AI-generated drafts carry a mandatory <code>DRAFT</code> status. Investigators control the lifecycle through <code>REVIEWED</code>, <code>APPROVED</code>, or <code>REJECTED</code> decisions. AI output never becomes a final investigation decision without explicit human approval.
            </p>
          </div>

          <div className="rounded-lg border hairline bg-secondary/30 p-4 space-y-2">
            <h3 className="font-bold text-foreground text-sm">6. Source Attribution & Evidence Snapshots</h3>
            <p className="text-muted-foreground leading-relaxed">
              Every AI-generated factual statement references BidShield evidence IDs or indicator names. Reports store an evidence snapshot recording which evidence records were used at generation time, enabling auditability even if underlying analytics are later recalculated.
            </p>
          </div>

          <div className="rounded-lg border hairline bg-secondary/30 p-4 space-y-2">
            <h3 className="font-bold text-foreground text-sm">7. Deterministic Fallback Engine</h3>
            <p className="text-muted-foreground leading-relaxed">
              If the AI provider is unavailable, times out, or produces invalid output, BidShield automatically generates a deterministic, rule-based summary using stored database values. Core analytics continue functioning independently of AI availability.
            </p>
          </div>

          <div className="rounded-lg border hairline bg-secondary/30 p-4 space-y-2">
            <h3 className="font-bold text-foreground text-sm">8. Provider Abstraction & Security</h3>
            <p className="text-muted-foreground leading-relaxed">
              The AI provider is abstracted behind an interface allowing seamless switching between providers. API keys are server-side only and never exposed to the browser. All AI endpoints enforce rate limiting and input validation.
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-2 text-xs text-muted-foreground leading-relaxed">
          <div className="font-bold text-foreground flex items-center gap-1.5 text-sm">
            <ShieldCheck className="h-4 w-4 text-primary" /> AI Transparency & Auditability
          </div>
          <p>
            Every generated report displays: AI-generated draft label, provider name, model identifier, generation timestamp, prompt version, evidence snapshot, and human review status. This prevents AI output from being mistaken for a raw analytical result or legally authoritative document.
          </p>
        </div>
      </section>

      {/* Safeguards & False-Positive Protections */}
      <section className="panel p-6 sm:p-8 space-y-5">
        <h2 className="text-2xl font-bold text-foreground">False-Positive Safeguards & Limitations</h2>
        <div className="grid gap-4 sm:grid-cols-2 text-xs text-muted-foreground leading-relaxed">
          <div className="rounded-lg border hairline bg-secondary/30 p-4 space-y-2">
            <h3 className="font-bold text-foreground text-sm flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-primary" /> Minimum Sample Size Enforcement
            </h3>
            <p>
              If a tender has fewer than 3 bids or fewer than 5 comparable tenders, the engine outputs an explicit <code>INSUFFICIENT_DATA</code> status rather than generating unreliable signals.
            </p>
          </div>

          <div className="rounded-lg border hairline bg-secondary/30 p-4 space-y-2">
            <h3 className="font-bold text-foreground text-sm flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-primary" /> Commercial Context Awareness
            </h3>
            <p>
              Unusually similar prices can have legitimate explanations, including standardized products, regulated pricing, market conditions, or common cost structures.
            </p>
          </div>
        </div>
      </section>

      {/* Footer Disclaimer */}
      <div className="disclaimer p-4 text-xs leading-relaxed text-muted-foreground flex gap-3">
        <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <span>{DISCLAIMER}</span>
      </div>
    </div>
  );
}
