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
  index,
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
  overallStatus: text("overall_status").notNull().default("INSUFFICIENT_DATA"),
  riskLevel: text("risk_level").notNull().default("Not yet analyzed"),
  availableIndicatorCount: integer("available_indicator_count").notNull().default(0),
  totalIndicatorCount: integer("total_indicator_count").notNull().default(5),
  evidenceCount: integer("evidence_count").notNull().default(0),
  methodologyVersion: text("methodology_version").notNull().default("combined_risk_v1.0"),
  calculatedAt: timestamp("calculated_at", { withTimezone: true }).notNull().defaultNow(),
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
  investigationId: integer("investigation_id").references(() => investigationsTable.id),
  reportType: text("report_type").notNull().default("SUMMARY"), // SUMMARY | FULL_REPORT
  status: text("status").notNull().default("DRAFT"), // DRAFT | REVIEWED | APPROVED | REJECTED
  generatedContent: text("generated_content"), // JSON structured content or markdown
  humanEditedContent: text("human_edited_content"), // Human modified content
  generatedSummary: text("generated_summary"), // High-level summary string
  screeningLevel: text("screening_level").notNull().default("Not yet analyzed"),
  provider: text("provider").notNull().default("mock"),
  model: text("model").notNull().default("mock-grounded-v1"),
  promptVersion: text("prompt_version").notNull().default("investigation_summary_v1.0"),
  evidenceSnapshot: text("evidence_snapshot"), // JSON array of EV-ids
  isStale: boolean("is_stale").notNull().default(false),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
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

export const screenerResultsTable = pgTable("screener_results", {
  id: serial("id").primaryKey(),
  tenderId: integer("tender_id").notNull().references(() => tendersTable.id),
  companyId: integer("company_id").references(() => companiesTable.id),
  indicatorType: text("indicator_type").notNull(),
  score: numeric("score"),
  status: text("status").notNull(),
  methodologyVersion: text("methodology_version").notNull().default("v1.0"),
  sampleSize: integer("sample_size"),
  threshold: numeric("threshold"),
  confidence: numeric("confidence"),
  summary: text("summary"),
  metricsPayload: text("metrics_payload"),
  calculatedAt: timestamp("calculated_at", { withTimezone: true }).notNull().defaultNow(),
  ...timestamps,
});

export const insertCompanySchema = createInsertSchema(companiesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTenderSchema = createInsertSchema(tendersTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertBidSchema = createInsertSchema(bidsTable).omit({ id: true, createdAt: true });
export const insertImportBatchSchema = createInsertSchema(importBatchesTable).omit({ id: true, uploadedAt: true });
export const insertEntityMatchSchema = createInsertSchema(entityMatchesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertScreenerResultSchema = createInsertSchema(screenerResultsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertInvestigationReportSchema = createInsertSchema(investigationReportsTable).omit({ id: true, createdAt: true, updatedAt: true, generatedAt: true });

export type Company = typeof companiesTable.$inferSelect;
export type Tender = typeof tendersTable.$inferSelect;
export type Bid = typeof bidsTable.$inferSelect;
export type ScreenerResult = typeof screenerResultsTable.$inferSelect;
export type InvestigationReport = typeof investigationReportsTable.$inferSelect;
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type InsertTender = z.infer<typeof insertTenderSchema>;
export type InsertBid = z.infer<typeof insertBidSchema>;
export type InsertScreenerResult = z.infer<typeof insertScreenerResultSchema>;
export type InsertInvestigationReport = z.infer<typeof insertInvestigationReportSchema>;

export const networkRelationshipsTable = pgTable(
  "network_relationships",
  {
    id: serial("id").primaryKey(),
    companyAId: integer("company_a_id").notNull().references(() => companiesTable.id),
    companyBId: integer("company_b_id").notNull().references(() => companiesTable.id),
    sharedTenderCount: integer("shared_tender_count").notNull().default(0),
    comparableTenderCount: integer("comparable_tender_count").notNull().default(0),
    participationFrequency: numeric("participation_frequency").notNull().default("0"),
    networkScore: numeric("network_score"),
    status: text("status").notNull().default("LOW_INDICATOR"),
    methodologyVersion: text("methodology_version").notNull().default("participation_network_v1.0"),
    calculatedAt: timestamp("calculated_at", { withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
  },
  (table) => ({
    companyPairIdx: uniqueIndex("network_relationships_pair_idx").on(table.companyAId, table.companyBId),
    companyAIdx: index("network_relationships_company_a_idx").on(table.companyAId),
    companyBIdx: index("network_relationships_company_b_idx").on(table.companyBId),
  }),
);

export const insertNetworkRelationshipSchema = createInsertSchema(networkRelationshipsTable).omit({ id: true, createdAt: true, updatedAt: true });

export type NetworkRelationship = typeof networkRelationshipsTable.$inferSelect;
export type InsertNetworkRelationship = z.infer<typeof insertNetworkRelationshipSchema>;

export const neatLossMetricsTable = pgTable(
  "neat_loss_metrics",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id").notNull().references(() => companiesTable.id),
    comparisonGroup: text("comparison_group").notNull().default("General Procurement"),
    participationCount: integer("participation_count").notNull().default(0),
    winCount: integer("win_count").notNull().default(0),
    lossCount: integer("loss_count").notNull().default(0),
    winRate: numeric("win_rate").notNull().default("0"),
    lossRate: numeric("loss_rate").notNull().default("0"),
    meanBidRank: numeric("mean_bid_rank"),
    medianBidRank: numeric("median_bid_rank"),
    rankStdDev: numeric("rank_stddev"),
    minBidRank: integer("min_bid_rank"),
    maxBidRank: integer("max_bid_rank"),
    meanRelativeGap: numeric("mean_relative_gap"),
    medianRelativeGap: numeric("median_relative_gap"),
    relativeGapStdDev: numeric("relative_gap_stddev"),
    relativeGapCv: numeric("relative_gap_cv"),
    repeatedRankCount: integer("repeated_rank_count").notNull().default(0),
    repeatedGroupCount: integer("repeated_group_count").notNull().default(0),
    sampleSize: integer("sample_size").notNull().default(0),
    score: numeric("score"),
    status: text("status").notNull().default("INSUFFICIENT_DATA"),
    methodologyVersion: text("methodology_version").notNull().default("neat_losing_bid_v1.0"),
    calculatedAt: timestamp("calculated_at", { withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
  },
  (table) => ({
    companyIdx: index("neat_loss_metrics_company_idx").on(table.companyId),
    statusIdx: index("neat_loss_metrics_status_idx").on(table.status),
  }),
);

export const insertNeatLossMetricSchema = createInsertSchema(neatLossMetricsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type NeatLossMetric = typeof neatLossMetricsTable.$inferSelect;
export type InsertNeatLossMetric = z.infer<typeof insertNeatLossMetricSchema>;

export const investigationsTable = pgTable(
  "investigations",
  {
    id: serial("id").primaryKey(),
    tenderId: integer("tender_id").notNull().references(() => tendersTable.id),
    status: text("status").notNull().default("OPEN"),
    priority: text("priority").notNull().default("MEDIUM"),
    assignedTo: text("assigned_to").notNull().default("Senior Investigator"),
    title: text("title").notNull(),
    notes: text("notes"),
    isWatchlisted: boolean("is_watchlisted").notNull().default(false),
    watchlistNotes: text("watchlist_notes"),
    createdBy: text("created_by").notNull().default("system"),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => ({
    tenderIdx: index("investigations_tender_idx").on(table.tenderId),
    statusIdx: index("investigations_status_idx").on(table.status),
    watchlistIdx: index("investigations_watchlist_idx").on(table.isWatchlisted),
  }),
);

export const investigationNotesTable = pgTable(
  "investigation_notes",
  {
    id: serial("id").primaryKey(),
    investigationId: integer("investigation_id").notNull().references(() => investigationsTable.id),
    userId: text("user_id").notNull().default("investigator_1"),
    userName: text("user_name").notNull().default("Senior Investigator"),
    note: text("note").notNull(),
    ...timestamps,
  },
  (table) => ({
    investigationIdx: index("investigation_notes_inv_idx").on(table.investigationId),
  }),
);

export const investigationActivityTable = pgTable(
  "investigation_activity",
  {
    id: serial("id").primaryKey(),
    investigationId: integer("investigation_id").notNull().references(() => investigationsTable.id),
    userId: text("user_id").notNull().default("investigator_1"),
    userName: text("user_name").notNull().default("Senior Investigator"),
    action: text("action").notNull(),
    previousValue: text("previous_value"),
    newValue: text("new_value"),
    metadata: text("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    investigationIdx: index("investigation_activity_inv_idx").on(table.investigationId),
  }),
);

export const insertInvestigationSchema = createInsertSchema(investigationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertInvestigationNoteSchema = createInsertSchema(investigationNotesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertInvestigationActivitySchema = createInsertSchema(investigationActivityTable).omit({ id: true, createdAt: true });

export type Investigation = typeof investigationsTable.$inferSelect;
export type InsertInvestigation = z.infer<typeof insertInvestigationSchema>;
export type InvestigationNote = typeof investigationNotesTable.$inferSelect;
export type InsertInvestigationNote = z.infer<typeof insertInvestigationNoteSchema>;
export type InvestigationActivity = typeof investigationActivityTable.$inferSelect;
export type InsertInvestigationActivity = z.infer<typeof insertInvestigationActivitySchema>;

export const chatSessionsTable = pgTable(
  "chat_sessions",
  {
    id: serial("id").primaryKey(),
    sessionId: text("session_id").notNull().unique(),
    userId: text("user_id").notNull().default("investigator_1"),
    title: text("title").notNull().default("New Conversation"),
    contextType: text("context_type").default("general"),
    contextId: text("context_id"),
    language: text("language").notNull().default("en-IN"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    sessionIdx: uniqueIndex("chat_sessions_session_id_idx").on(table.sessionId),
    userIdx: index("chat_sessions_user_id_idx").on(table.userId),
  }),
);

export const chatMessagesTable = pgTable(
  "chat_messages",
  {
    id: serial("id").primaryKey(),
    sessionId: text("session_id").notNull(),
    role: text("role").notNull(),
    content: text("content").notNull(),
    metadata: text("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    sessionIdx: index("chat_messages_session_id_idx").on(table.sessionId),
  }),
);

export const insertChatSessionSchema = createInsertSchema(chatSessionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertChatMessageSchema = createInsertSchema(chatMessagesTable).omit({ id: true, createdAt: true });

export type ChatSession = typeof chatSessionsTable.$inferSelect;
export type InsertChatSession = z.infer<typeof insertChatSessionSchema>;
export type ChatMessage = typeof chatMessagesTable.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;