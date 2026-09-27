# BidShield — Evidence-Driven Procurement Screening & Investigation Platform

> **Problem Statement:** PS-09-S1 — Detecting Bid Rigging in Public Procurement  
> **Team:** SYNOVATE  
> **Institution:** Panimalar Engineering College  
> **Positioning:** Evidence-Driven Procurement Screening & Investigation Platform  

[![Build & Test Status](https://img.shields.io/badge/tests-127%20passed-brightgreen.svg)]()
[![Methodology Version](https://img.shields.io/badge/methodology-v1.0-blue.svg)]()
[![Dataset](https://img.shields.io/badge/data-Demo%20%2F%20Synthetic-amber.svg)]()
[![License](https://img.shields.io/badge/license-MIT-green.svg)]()

---

## Problem Statement

Public procurement accounts for an estimated 15–30% of government expenditure globally. However, identifying anti-competitive patterns—such as bid rotation, cover bidding, artificial price clustering, and repeated bidder syndicates—is notoriously challenging:

- **Enormous Data Volume**: Tens of thousands of tenders and bids are published annually across disparate regional and municipal portals.
- **Inconsistent Entity Records**: Participating companies submit bids under varying legal suffixes, abbreviations, typographical variations, and consortium aliases.
- **Cognitive Overload**: Investigative auditors cannot manually evaluate cross-tender relationships, bid distributions, and historical turn-taking patterns across years of procurement data.
- **Explainability Gap**: Black-box algorithmic fraud scores cannot be used in legal or disciplinary proceedings without auditable statistical evidence and provenance.

---

## Solution

**BidShield** converts procurement datasets into an evidence-driven screening workflow:

> *"BidShield analyzes procurement data, detects statistically unusual bidding patterns, and presents the supporting evidence so investigators can identify tenders that deserve further review."*

BidShield is **not** a black-box fraud predictor; it does not claim to prove guilt or establish legal liability. Instead, it computes deterministic statistical indicators across comparable procurement tenders, generates traceable evidence records with exact metrics, and empowers human investigators through an interactive casework workspace and grounded AI assistance.

```
Black-Box Approach:
[Raw Bids] ──> [Opaque Neural Net] ──> [Unsubstantiated Fraud Score]  (Inadmissible)

BidShield Evidence-First Approach:
[Raw Bids] ──> [Data Cleaning & Entity Resolution]
             ──> [5 Deterministic Statistical Screeners]
             ──> [Auditable Evidence Records (ID, Metric, Observed vs Expected)]
             ──> [Traceable Investigation Casework & Grounded AI Summaries]
```

---

## Key Features

1. **Robust Data Intake & Entity Resolution (Phase 2)**:
   - Automated CSV intake with structural validation, delimiter detection, and sanitization against spreadsheet formula injection (`=`, `+`, `-`, `@`).
   - Phonetic token matching (Double Metaphone), legal suffix normalization (`Pvt Ltd`, `LLC`, `Corp`), and Levenshtein distance metrics to resolve company aliases into canonical entity profiles.

2. **Five Deterministic Screening Engines (Phases 3–6)**:
   - **Winner Rotation Screener**: Shannon entropy, Herfindahl-Hirschman Index (HHI), and cyclical winner alternation tracking across comparable tenders.
   - **Cover-Bid Screener**: Identifies losing bids that cluster consistently above the winning bid or estimated contract value with near-zero price variation.
   - **Price Clustering Screener**: Evaluates coefficient of variation (CV) and normalized bid dispersion relative to historical market benchmarks.
   - **Participation Network Screener**: Bipartite graph modeling of company-tender co-bidding frequencies, recurring bidder pairs, and syndicate density using Jaccard co-occurrence.
   - **Too-Neat Losing Bid Screener**: Detects unnatural rank invariance, constant percentage offsets, and lack of genuine pricing competition.

3. **Combined Screening & Evidence Engine (Phase 7)**:
   - Transparent weighted composite scoring (`0–100`) with discrete severity levels (`Low`, `Moderate`, `Elevated`).
   - Every score is backed by atomic, traceable evidence records specifying observed values, expected benchmark ranges, confidence scores, and methodology versions.

4. **Investigation Workspace & Casework Management (Phase 8)**:
   - Interactive review queue with status management (`Pending`, `In Review`, `Escalated`, `Closed`).
   - Full bid comparison tabulations, timeline graphs, network relationship diagrams, investigator notes, watchlist flagging, and audit-ready PDF/HTML casework exports.

5. **Evidence-Grounded AI Investigation Assistant (Phase 9)**:
   - Generates 13-section structured investigation report drafts strictly grounded in calculated evidence.
   - Interactive conversational assistant answering investigator questions with citations to specific evidence IDs.
   - Human-in-the-loop review workflow (`DRAFT` → `REVIEWED` → `APPROVED` / `REJECTED`) with automatic staleness tracking.

6. **Production Security & SLA Compliance (Phase 10)**:
   - Comprehensive HTTP security headers (nosniff, frame DENY, XSS protection, HSTS).
   - Tiered rate limiting (General, AI, Uploads, Recalculations).
   - Environment safety validator preventing key exposure.
   - 127 automated regression and edge-case unit tests.

---

## Architecture

```
                       ┌────────────────────────────────────────┐
                       │  Procurement Sources (CSV / Datasets) │
                       └───────────────────┬────────────────────┘
                                           │
                                           ▼
                       ┌────────────────────────────────────────┐
                       │     Data Intake & Validation Layer     │
                       │ (Sanitization, Delimiters, Formats)    │
                       └───────────────────┬────────────────────┘
                                           │
                                           ▼
                       ┌────────────────────────────────────────┐
                       │   Entity Resolution & Normalization    │
                       │ (Legal Suffixes, Phonetic, Levenshtein)│
                       └───────────────────┬────────────────────┘
                                           │
                                           ▼
                       ┌────────────────────────────────────────┐
                       │  PostgreSQL / Supabase Schema (Drizzle)│
                       │  (Tenders, Companies, Bids, Evidence)  │
                       └───────────────────┬────────────────────┘
                                           │
         ┌─────────────────────────────────┴─────────────────────────────────┐
         │                                                                   │
         ▼                                                                   ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ Winner Rotation  │ │    Cover-Bid     │ │ Price Clustering │ │  Participation   │ │     Too-Neat     │
│    Screener      │ │     Screener     │ │     Screener     │ │ Network Screener │ │   Losing Bids    │
└────────┬─────────┘ └────────┬─────────┘ └────────┬─────────┘ └────────┬─────────┘ └────────┬─────────┘
         │                    │                    │                    │                    │
         └────────────────────┼────────────────────┼────────────────────┼────────────────────┘
                              │
                              ▼
                       ┌────────────────────────────────────────┐
                       │   Combined Screening & Evidence Engine │
                       │ (Weighted Score, Traceable Evidence IDs│
                       └───────────────────┬────────────────────┘
                                           │
                                           ▼
                       ┌────────────────────────────────────────┐
                       │    Investigation Workspace API         │
                       │ (Review Queue, Notes, Lineage, Export) │
                       └───────────────────┬────────────────────┘
                                           │
                                           ▼
                       ┌────────────────────────────────────────┐
                       │  Evidence-Grounded AI Assistant Layer  │
                       │ (Summary, 13-Section Report, Q&A Chat) │
                       └───────────────────┬────────────────────┘
                                           │
                                           ▼
                       ┌────────────────────────────────────────┐
                       │ Human Auditor Review & Decision Desk   │
                       └────────────────────────────────────────┘
```

---

## Technology Stack

| Layer | Technologies | Purpose |
|:---|:---|:---|
| **Frontend** | React 18, Vite 7, TypeScript, Tailwind CSS, Recharts, Lucide React, Wouter | Single-page responsive interface, interactive charts, and evidence inspection desk |
| **Backend** | Node.js (v20+), Express 5, TypeScript, Pino Logger | RESTful API server, rate limiting, request validation, static asset serving |
| **Database** | PostgreSQL, Supabase, Drizzle ORM | 14 relational tables with foreign-key constraints, cascading deletes, and indexes |
| **Analytics** | TypeScript / In-Memory Statistical Engines, Graph algorithms (Jaccard, HHI, Shannon entropy) | Fast, deterministic screening without external runtime dependencies |
| **AI Subsystem** | Grounded Prompt Pipeline (Mock Provider default; OpenAI / Gemini configurable via API key) | Synthesizes calculated evidence into structured drafts; strictly non-hallucinatory |
| **Testing** | Node.js built-in test runner (`node --test`) | 127 automated unit, edge-case, and security tests |

---

## Analytics Engine

The core analytical pipeline calculates five distinct statistical indicators:

### 1. Winner Rotation Screener
- **Turn-Taking Metric**: Quantifies sequential winner alternation among recurring bidder sets across comparable tenders in the same category and geography.
- **Herfindahl-Hirschman Index (HHI)**: $HHI = \sum_{i=1}^{N} s_i^2$, measuring market concentration.
- **Normalized Entropy**: Compares observed distribution against uniform rotation $H = -\sum p_i \log_2(p_i) / \log_2(N)$.

### 2. Cover-Bid Screener
- Evaluates whether non-winning bidders submit prices that deliberately sit at constant percentage premiums (e.g. +5% to +10%) above the winning bid or estimated contract value.
- Tracks company-level loss margins to detect participants that bid frequently but never come within competitive distance of the winning price.

### 3. Price Clustering Screener
- Analyzes bid price dispersion among top submissions:
  $$\text{Relative Spread} = \frac{\text{Bid}_{\max} - \text{Bid}_{\min}}{\text{Estimated Value}}$$
  $$\text{Coefficient of Variation (CV)} = \frac{\sigma}{\mu}$$
- Compares observed CV against historical percentile benchmarks for the respective procurement category.

### 4. Participation Network Screener
- Builds an unweighted/weighted bipartite graph $G = (V_{\text{companies}}, V_{\text{tenders}}, E)$.
- Evaluates co-bidding incidence using Jaccard Similarity:
  $$J(A, B) = \frac{|T_A \cap T_B|}{|T_A \cup T_B|}$$
- Highlights recurring cliques and isolated bidding clusters.

### 5. Too-Neat Losing Bid Screener
- Identifies unnatural mathematical precision in losing bid sequences:
  - Exact round-number percentages above the winner.
  - Zero rank variance across multiple consecutive tenders.
  - Symmetrically spaced losing bids indicating artificial coordination.

---

## Entity Resolution

Raw procurement documents frequently identify the same corporate entity under multiple distinct text representations. BidShield applies a 4-stage resolution pipeline:

1. **Text Normalization**: Strips legal suffixes (`Pvt Ltd`, `Limited`, `Inc`, `LLC`, `GmbH`), punctuation, and multiple whitespaces.
2. **Phonetic Token Matching**: Converts tokens to phonetic representations using Double Metaphone to bridge regional transliterations.
3. **Fuzzy Levenshtein Ratio**: Computes string edit distance over canonicalized tokens.
4. **Resolution Status**:
   - $\ge 90\%$: `AUTO_MATCHED` to existing canonical entity.
   - $75\% - 89\%$: Flagged for `REVIEW_REQUIRED` by investigator.
   - $< 75\%$: Registered as new candidate entity.

---

## Evidence Engine

BidShield ensures that every flag is backed by **atomic, auditable evidence records**:

```json
{
  "id": "EV-101",
  "indicatorType": "PRICE_CLUSTERING",
  "description": "Normalized bid spread across top 3 submissions was 2.1%, well below category median (8.5%).",
  "metric": "relative_bid_spread",
  "observedValue": 0.021,
  "expectedValue": 0.085,
  "severity": "ELEVATED",
  "confidence": 0.88,
  "methodologyVersion": "price_clustering_v1.0"
}
```

Auditors can review the specific mathematical formula, sample size, and comparison scope for each observation.

---

## Investigation Workflow

BidShield supports the full casework lifecycle:

1. **Review Queue**: Tenders sorted by composite screening level (`Elevated`, `Moderate`, `Low`).
2. **Tender Investigation Workspace**:
   - Overview metrics, estimated vs contract values, bidder counts.
   - Full bid schedule and price deviation charts.
   - Historical rotation timeline and company win-loss distributions.
   - Co-participation network graph and peer relationships.
3. **Casework Tools**:
   - Investigator notes with timestamps and author tracking.
   - One-click watchlist toggle for high-priority tenders.
   - Data provenance & lineage auditing.
4. **Audit Export**: Generates self-contained HTML/PDF case dossiers for review boards.

---

## AI-Assisted Investigation

BidShield integrates an assistive AI layer strictly designed to **summarize evidence, not replace human judgment**:

- **Context-Bound Generation**: Prompts only receive verified statistical metrics, evidence IDs, and tender metadata. The AI has no independent score authority.
- **13-Section Structured Investigation Report Draft**:
  1. Executive Summary
  2. Tender Information
  3. Procurement Context
  4. Participating Companies
  5. Bid Analysis
  6. Statistical Indicators
  7. Supporting Evidence
  8. Historical Patterns
  9. Network Observations
  10. Data Quality & Limitations
  11. Areas for Human Review
  12. Methodology Reference
  13. Mandatory Legal Disclaimer
- **Interactive Evidence Q&A**: Answers questions (e.g. *"Why was this tender flagged?"*) by referencing cited evidence IDs (`EV-101`, `EV-102`).
- **Human-in-the-Loop Review**: Reports are marked as `DRAFT` until an investigator explicitly reviews, edits, and updates their status to `APPROVED` or `REJECTED`.

---

## Database

BidShield utilizes a relational PostgreSQL schema managed via **Drizzle ORM** (14 tables):

- `tenders`: Procurement notices, issuing authorities, values, dates, and screening levels.
- `bids`: Individual submissions, raw prices, normalized prices, rankings, and statuses.
- `companies`: Canonical corporate entities, normalized names, addresses, and statistics.
- `company_aliases`: Alternative representations mapped to canonical IDs.
- `tender_analytics`: Cached screening scores across all 5 engines.
- `analytics_evidence`: Traceable evidence records linked to tenders and indicators.
- `investigations`: Casework tracking, review statuses, and priority flags.
- `investigation_notes`: Auditor notes with audit trails.
- `investigation_reports`: AI-generated and human-edited report drafts.
- `co_bidding_pairs`: Historical network edges and shared tender counts.

> **Zero Database Requirement for Evaluation**: When `DATABASE_URL` is omitted, BidShield automatically initializes its built-in synthetic procurement dataset in-memory.

---

## Installation

### Prerequisites
- **Node.js**: `v20.x` or `v22.x`
- **npm**: `v10.x+` (or `pnpm v9+`)

### Clone and Install
```bash
git clone https://github.com/profe/BidShield-Procurement-Analytics.git
cd BidShield-Procurement-Analytics
npm install
```

---

## Environment Variables

Copy the example environment configuration:

```bash
cp .env.example .env
```

| Variable | Default | Purpose |
|:---|:---|:---|
| `NODE_ENV` | `development` | Runtime environment (`development` or `production`) |
| `PORT` | `5000` | Port for Express API server |
| `VITE_PORT` | `5173` | Port for Vite frontend dev server |
| `VITE_API_URL` | `http://localhost:5000` | API backend URL for frontend proxies |
| `DATABASE_URL` | *(optional)* | PostgreSQL connection string |
| `ANALYTICS_API_KEY` | *(auto-generated)* | API key securing recalculation routes |
| `ENTITY_RESOLUTION_SERVICE_KEY` | *(auto-generated)* | API key securing entity resolution routes |
| `AI_PROVIDER` | `mock` | AI provider (`mock`, `openai`, `gemini`, or `custom`) |
| `AI_MODEL` | `mock-grounded-v1` | LLM model identifier |
| `AI_API_KEY` | *(optional)* | Provider API key when using external LLM |

---

## Running Locally

### Development Mode (Concurrent API + Web with Hot Reload)
```bash
npm run dev
```
- **Web Dashboard**: [http://localhost:5173](http://localhost:5173)
- **API Server**: [http://localhost:5000](http://localhost:5000)
- **API Health**: [http://localhost:5000/api/health](http://localhost:5000/api/health)

### Running Services Separately
```bash
# Backend Express API Server only
npm run dev:api

# Frontend React / Vite Web Client only
npm run dev:web
```

---

## Demo

The application comes pre-loaded with a comprehensive **Synthetic / Demo Procurement Dataset**:
- **100 Tenders**: Spanning Infrastructure, Healthcare, IT, and Transport sectors.
- **50 Companies**: With realistic bidding histories, normalized aliases, and co-bidding patterns.
- **400 Bids**: With realistic prices, winning selections, and itemized rank tabulations.
- **26 Review Casework Items**: Pre-seeded in the review queue with varying screening indicators.

> **Visual Indicator**: The UI displays a prominent banner:  
> `Demo Mode — Synthetic Procurement Data`  
> to clearly distinguish evaluation records from live administrative procurement registries.

---

## API Overview

All API endpoints are mounted on `/api`:

### System & Health
- `GET /api/health` — Subsystem health, database mode, uptime, and AI status.
- `GET /api/ai/health` — AI provider status and grounded-only constraint check.
- `GET /api/system/integrations` — Service keys configuration and engine versions.

### Procurement Data & Tenders
- `GET /api/dashboard/summary` — Aggregate metrics, sector distributions, and review counts.
- `GET /api/tenders` — Search, filter, and paginate procurement notices.
- `GET /api/tenders/:id` — Full tender dossier, bids, screening scores, and evidence.
- `GET /api/companies` — Entity directory with win rates and co-participation counts.
- `GET /api/companies/:id` — Comprehensive company profile and historical peers.

### Analytics & Screening Engines
- `POST /api/analytics/tenders/:id/analyze` — Run on-demand screening across all 5 engines.
- `GET /api/analytics/rotation` — Winner rotation scores and turn-taking indices.
- `GET /api/analytics/cover-bid` — Cover bidding margin observations.
- `GET /api/analytics/price-clustering` — Bid price dispersion and clustering metrics.
- `GET /api/analytics/network` — Co-bidding bipartite network edges and recurring pairs.
- `POST /api/analytics/recalculate` — Re-execute screening batch (rate-limited).

### Investigation Casework
- `GET /api/investigations` — Review queue with status and screening filters.
- `GET /api/investigations/:id` — Case workspace details, bids, notes, and activity log.
- `POST /api/investigations/:id/notes` — Add investigator note with author name.
- `POST /api/investigations/:id/watchlist` — Flag tender for elevated monitoring.
- `GET /api/investigations/:id/export` — Export case file as PDF/HTML.

### AI Investigation Assistant
- `POST /api/ai/investigations/:id/summary` — Generate evidence-grounded summary.
- `POST /api/ai/investigations/:id/report` — Generate 13-section report draft.
- `POST /api/ai/investigations/:id/chat` — Ask questions with cited evidence IDs.
- `PATCH /api/ai/investigations/:id/reports/:reportId` — Update review status (`APPROVED`, etc.).

---

## Testing

BidShield includes a rigorous automated test suite built on the native Node.js test runner:

```bash
npm test
```

### Test Coverage Highlights:
- **127 Tests across 21 Test Suites — 100% Pass Rate**.
- Statistical module precision (mean, variance, CV, HHI, entropy, Jaccard).
- Edge cases: Division by zero, empty bid arrays, single-bid tenders, score clamping (`0–100`).
- Input validation: SQL injection patterns, pagination boundary limits, status enum guards.
- Security patterns: CSV formula sanitization (`=`, `+`, `-`, `@`), security headers check, VITE secret leak prevention.
- Report status transition state machines (`DRAFT` → `REVIEWED` → `APPROVED`).

---

## Deployment

### Production Build
```bash
npm run build
```
This builds:
1. Shared TypeScript libraries (`tsc --build`)
2. Backend API server bundle (`node ./build.mjs` → `dist/index.mjs`)
3. Frontend Vite production bundle (`vite build` → `dist/public/`)

### Unified Single-Port Production Serving
In production mode, the Express server automatically serves the compiled SPA frontend from `dist/public` with full client-side routing fallback:
```bash
npm start
```
The application will serve both the API and Web UI on port `5000` (or `PORT` environment variable).

---

## Data Sources

BidShield supports data intake conforming to the **Open Contracting Data Standard (OCDS)** and standard public e-procurement CSV exports:
- Tender ID / Tender Number
- Procuring Entity / Organization / Department
- Category (Works, Goods, Services, Consulting)
- Estimated Contract Value / Sanctioned Budget
- Publication Date and Tender Closing Date
- Bidder / Company Original Name
- Submitted Financial Bid Amount and Submission Timestamp

---

## Limitations

1. **Synthetic Evaluation Dataset**: The pre-loaded data is synthetic and designed to illustrate statistical methodologies. It does not represent actual government procurement records.
2. **Contextual Market Factors**: Legitimate commercial dynamics—such as regional geographic monopolies, specialized technical certifications, or joint supply chain costs—can occasionally produce tight price clusters or repeated participation.
3. **Investigation Support Only**: Statistical screening identifies anomalies that warrant manual scrutiny; it does not replace human inquiry, subpoena powers, or document forensics.

---

## Responsible Use

> **Mandatory Statutory Disclaimer:**  
> *"BidShield is a statistical screening and investigation-support platform. Its indicators identify procurement patterns that may warrant further review. They do not establish collusion, wrongdoing, fraud, or legal liability."*

- **Non-Accusatory Terminology**: BidShield strictly outputs "elevated screening indicators", never "fraud probability", "guilty parties", or "collusion confirmed".
- **Human Accountability**: All automated flags and AI drafts require explicit human verification and auditor sign-off before being escalated.
- **Explainable by Design**: No black-box models. Every score can be traced to the underlying bids, metrics, and comparison scopes.

---

## Team

**Team SYNOVATE — Panimalar Engineering College**  
*Problem Statement:* PS-09-S1: Detecting Bid Rigging in Public Procurement  
*Hackathon / Competition Submission Version: 1.0.0*
