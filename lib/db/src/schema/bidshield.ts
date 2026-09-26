import { createInsertSchema } from "drizzle-zod";
import {
  boolean,
  date,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const companiesTable = pgTable(
  "companies",
  {
    id: serial("id").primaryKey(),
    canonicalName: text("canonical_name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    address: text("address"),
    normalizedAddress: text("normalized_address"),
    city: text("city"),
    state: text("state"),
    gstin: text("gstin"),
    registrationNumber: text("registration_number"),
    ...timestamps,
  },
  (table) => ({
    normalizedNameIdx: uniqueIndex("companies_normalized_name_idx").on(table.normalizedName),
  }),
);

export const companyAliasesTable = pgTable("company_aliases", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companiesTable.id),
  aliasName: text("alias_name").notNull(),
  normalizedAlias: text("normalized_alias").notNull(),
  aliasType: text("alias_type").notNull().default("source"),
  confidence: numeric("confidence").notNull().default("1"),
  status: text("status").notNull().default("CONFIRMED"),
  source: text("source").notNull().default("synthetic-demo"),
  ...timestamps,
});

export const importBatchesTable = pgTable("import_batches", {
  id: serial("id").primaryKey(),
  filename: text("filename").notNull(),
  source: text("source").notNull().default("upload"),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
  totalRows: integer("total_rows").notNull().default(0),
  validRows: integer("valid_rows").notNull().default(0),
  warningRows: integer("warning_rows").notNull().default(0),
  errorRows: integer("error_rows").notNull().default(0),
  status: text("status").notNull().default("Uploaded"),
  qualityScore: numeric("quality_score").notNull().default("0"),
});

export const tendersTable = pgTable("tenders", {
  id: serial("id").primaryKey(),
  tenderNumber: text("tender_number").notNull().unique(),
  title: text("title").notNull(),
  department: text("department").notNull(),
  organization: text("organization").notNull(),
  category: text("category").notNull(),
  location: text("location").notNull(),
  state: text("state").notNull(),
  tenderDate: date("tender_date", { mode: "string" }).notNull(),
  closingDate: date("closing_date", { mode: "string" }).notNull(),
  estimatedValue: numeric("estimated_value").notNull(),
  contractValue: numeric("contract_value"),
  winnerId: integer("winner_id").references(() => companiesTable.id),
  status: text("status").notNull().default("Open"),
  source: text("source").notNull().default("synthetic-demo"),
  ...timestamps,
});

export const bidsTable = pgTable("bids", {
  id: serial("id").primaryKey(),
  tenderId: integer("tender_id").notNull().references(() => tendersTable.id),
  companyId: integer("company_id").notNull().references(() => companiesTable.id),
  bidAmount: numeric("bid_amount").notNull(),
  bidRank: integer("bid_rank").notNull(),
  isWinner: boolean("is_winner").notNull().default(false),
  submissionDate: date("submission_date", { mode: "string" }),
  technicalScore: numeric("technical_score"),
  financialScore: numeric("financial_score"),
  sourceRowId: text("source_row_id"),
  originalCompanyName: text("original_company_name"),
  normalizedCompanyName: text("normalized_company_name"),
  importBatchId: integer("import_batch_id").references(() => importBatchesTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tenderParticipantsTable = pgTable("tender_participants", {
  id: serial("id").primaryKey(),
  tenderId: integer("tender_id").notNull().references(() => tendersTable.id),
  companyId: integer("company_id").notNull().references(() => companiesTable.id),
  participated: boolean("participated").notNull().default(true),
  ...timestamps,
});

export const riskScoresTable = pgTable("risk_scores", {
  id: serial("id").primaryKey(),
  tenderId: integer("tender_id").notNull().references(() => tendersTable.id),
  companyId: integer("company_id").references(() => companiesTable.id),
  groupId: text("group_id"),
  rotationScore: numeric("rotation_score"),
  coverBidScore: numeric("cover_bid_score"),
  priceClusterScore: numeric("price_cluster_score"),
  networkScore: numeric("network_score"),
  neatLossScore: numeric("neat_loss_score"),
  overallScore: numeric("overall_score"),
  riskLevel: text("risk_level").notNull().default("Not yet analyzed"),
  ...timestamps,
});

export const evidenceTable = pgTable("evidence", {
  id: serial("id").primaryKey(),
  riskScoreId: integer("risk_score_id").notNull().references(() => riskScoresTable.id),
  indicatorType: text("indicator_type").notNull(),
  description: text("description").notNull(),
  metric: text("metric").notNull(),
  observedValue: text("observed_value"),
  expectedValue: text("expected_value"),
  confidence: numeric("confidence").notNull().default("0"),
  severity: text("severity").notNull().default("Informational"),
  ...timestamps,
});

export const investigationReportsTable = pgTable("investigation_reports", {
  id: serial("id").primaryKey(),
  tenderId: integer("tender_id").notNull().references(() => tendersTable.id),
  generatedSummary: text("generated_summary"),
  screeningLevel: text("screening_level").notNull().default("Not yet analyzed"),
  ...timestamps,
});

export const entityMatchesTable = pgTable("entity_matches", {
  id: serial("id").primaryKey(),
  sourceName: text("source_name").notNull(),
  suggestedCompany: text("suggested_company"),
  confidence: numeric("confidence").notNull().default("0"),
  status: text("status").notNull().default("UNRESOLVED"),
  nameSimilarity: numeric("name_similarity").notNull().default("0"),
  addressSimilarity: numeric("address_similarity"),
  source: text("source").notNull().default("upload"),
  ...timestamps,
});

export const insertCompanySchema = createInsertSchema(companiesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTenderSchema = createInsertSchema(tendersTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertBidSchema = createInsertSchema(bidsTable).omit({ id: true, createdAt: true });
export const insertImportBatchSchema = createInsertSchema(importBatchesTable).omit({ id: true, uploadedAt: true });
export const insertEntityMatchSchema = createInsertSchema(entityMatchesTable).omit({ id: true, createdAt: true, updatedAt: true });

export type Company = typeof companiesTable.$inferSelect;
export type Tender = typeof tendersTable.$inferSelect;
export type Bid = typeof bidsTable.$inferSelect;
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type InsertTender = z.infer<typeof insertTenderSchema>;
export type InsertBid = z.infer<typeof insertBidSchema>;