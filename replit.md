# BidShield

Evidence-first procurement analytics for reviewing statistical bidding indicators without asserting wrongdoing.

## Run & Operate

- `npm run dev` or `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/bidshield run dev` — run the BidShield web app
- `npm run typecheck` — full typecheck across all packages
- `npm run build` — typecheck + build all packages
- `npm test` — run test suite (21 tests passing)
- `npm --prefix lib/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- Required env: `DATABASE_URL` — Postgres connection string

## Phase 4: Price Clustering Screening Engine

Phase 4 implements a statistically explainable **Price Clustering Detection Engine** (`price_clustering_v1.0`) that identifies unusually concentrated bid prices among comparable procurement tenders:

1. **Price Normalization & Tender Dispersion Metrics**: Calculates `bid_amount / winning_bid`, percentage deviation from winner, `bid_amount / estimated_value`, standard deviation, coefficient of variation ($CV = \sigma / \mu$), and normalized bid spread (`(max - min) / min`).
2. **Comparable-Tender Baseline & Percentile Analysis**: Determines empirical baseline distribution across multi-attribute comparable procurements (median CV, median spread, percentile ranking). Tenders falling below the 20th percentile exhibit tight price concentration.
3. **Repeated Price Positioning**: Identifies whether companies submit repeated historical bid margins (e.g. consistently 8.0% above winning bid).
4. **Deterministic Auditable Scoring (0–100)**:
   - Tender-Level Concentration (25%)
   - Historical Baseline Comparison (25%)
   - Percentile Deviation (25%)
   - Relative Distance & Inter-Bid Gap Uniformity (15%)
   - Repeated Bidder Positioning (10%)
5. **Sample Size Protection**: Requires $\ge 3$ bids per tender and $\ge 5$ comparable tenders. Emits `INSUFFICIENT_DATA` when unsatisfied.
6. **Traceable Evidence Register**: Every screening result generates traceable numerical evidence in `evidence` and `screener_results` tagged with `methodology_version: price_clustering_v1.0`.
7. **Mandatory Disclaimer**: Displayed on all relevant interfaces:
   > *"Price clustering is a statistical indicator for further review. It does not establish collusion, coordination, wrongdoing, or legal liability."*

## Key Endpoints (Phase 1–4)

- `POST /api/analytics/tenders/:id/price-clustering` — Run on-demand price clustering screening
- `GET /api/analytics/tenders/:id/price-clustering` — Retrieve tender price clustering metrics and baseline
- `GET /api/analytics/price-clustering` — List all tenders with price clustering indicators
- `GET /api/analytics/companies/:id/price-patterns` — Company historical relative price positioning and margin patterns
- `POST /api/analytics/tenders/:id/analyze` — Run complete multi-detector screening (Winner Rotation + Cover Bid + Price Clustering)
- `GET /api/analytics/tenders/:id` — Retrieve full tender analytics breakdown
- `GET /api/analytics/tenders/:id/evidence` — Retrieve traceable evidence register
- `GET /api/analytics/rotation` — Overview of winner rotation screening indicators
- `GET /api/analytics/cover-bid` — Overview of cover-bid and positioning indicators
- `GET /api/analytics/companies/:id/patterns` — Historical bidding behavior and transitions
- `POST /api/analytics/recalculate` — Batch recalculation of all screening scores

## Stack

- Node.js 24, TypeScript 5.9, npm / pnpm workspaces
- API: Express 5, Node Test Runner with `tsx` (21 tests passing)
- DB: PostgreSQL + Drizzle ORM (`screenerResultsTable`, `riskScoresTable`, `evidenceTable`)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle) + Vite (Frontend bundle)
- Frontend: React 18, Tailwind CSS, Recharts, Lucide Icons, Wouter

## Where things live

- `artifacts/bidshield` — React/Vite dashboard:
  - `src/components/PriceDistributionChart.tsx` — Bid price distribution & cluster band visualization
  - `src/components/HistoricalComparisonChart.tsx` — Current CV vs. comparable tender distribution
  - `src/components/CompanyPricePositioningChart.tsx` — Company margin offset history and repeated margin tracking
  - `src/components/AnalysisModal.tsx` — Auditable multi-engine mathematical breakdown
  - `src/pages/MethodologyPage.tsx` — Complete mathematical methodology and sample size documentation
- `artifacts/api-server/src/analytics/` — Modular detection engine:
  - `screens/price_clustering/` — `detector.ts`, `metrics.ts`, `evidence.ts`
  - `screens/winner_rotation/` — `detector.ts`, `metrics.ts`, `evidence.ts`
  - `screens/cover_bid/` — `detector.ts`, `metrics.ts`, `evidence.ts`
  - `history/company_price_patterns.ts` — Company historical positioning and repeated margin analysis
  - `common/` — `statistics.ts` (CV, percentile rank, spread, inter-bid distances), `comparable.ts`, `types.ts`
  - `scoring/` — `config.ts`, `indicators.ts`
  - `service.ts` — `AnalyticsService` orchestration & caching
- `lib/api-spec/openapi.yaml` — Source of truth for API contracts
- `lib/db/src/schema/bidshield.ts` — PostgreSQL schema with `screener_results` and `evidence`

## Architecture decisions

- Screening levels (`LOW_INDICATOR`, `MODERATE_INDICATOR`, `ELEVATED_INDICATOR`, `HIGH_INDICATOR`) are strictly descriptive review signals.
- All scores (0–100) are deterministic, mathematically grounded, and explainable via raw metrics in `metricsPayload`.
- No black-box ML or LLM accusations are used.
- Tenders are never compared blindly: `findComparableTenders` uses weighted multi-attribute similarity (Category 0.35, Org 0.25, Dept 0.15, Geography 0.10, Value scale log-ratio 0.10, Time window 0.05).
- Future Phase detectors (Participation network analysis, "Too-neat" losing bid analysis, Combined risk engine) remain cleanly separated for upcoming phases.
