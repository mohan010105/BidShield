# BidShield

Evidence-first procurement analytics for reviewing statistical bidding indicators without asserting wrongdoing.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/bidshield run dev` — run the BidShield web app
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/bidshield` — React/Vite dashboard and route-level screens
- `artifacts/api-server` — Express routes and procurement data services
- `lib/api-spec/openapi.yaml` — source of truth for API contracts
- `lib/db/src/schema/bidshield.ts` — PostgreSQL schema for procurement and import lineage
- `artifacts/api-server/src/lib/bidshieldData.ts` — synthetic demo data plus CSV normalization/validation helpers

## Architecture decisions

- Screening levels are descriptive review signals only; the UI repeats the legal-safety disclaimer on relevant surfaces.
- Synthetic data is generated deterministically so dashboard counts and relationship views remain stable for demos.
- CSV upload keeps original values next to normalized fields and separates validation, cleaning, and entity resolution steps.
- The OpenAPI document is the contract for both Express responses and generated React Query hooks.

## Product

BidShield helps procurement investigators browse tenders and companies, inspect participation patterns, manage investigations, upload procurement CSVs, validate and normalize source data, and review suggested company matches.

## User preferences

No project-specific preferences recorded.

## Gotchas

- Run API codegen after changing `lib/api-spec/openapi.yaml`.
- Workflow-provided `PORT` and `BASE_PATH` are required by the Vite config for a direct production build.
- The current demo dataset is synthetic and must not be presented as real-world evidence.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
