// Espejo tipado de migrations/*.sql. La fuente de verdad del esquema son las migraciones.
import {
  bigserial,
  boolean,
  char,
  customType,
  date,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { APPROVAL_ACTIONS } from "@/domain/approvals";
import { PIPELINE_STATUSES } from "@/domain/pipeline";
import { ROLES } from "@/domain/permissions";
import { FACT_CATEGORIES, FACT_KINDS, FACT_VERIFICATIONS } from "@/domain/validation";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const userRole = pgEnum("user_role", ROLES);
export const pipelineStatus = pgEnum("pipeline_status", PIPELINE_STATUSES);
export const actorType = pgEnum("actor_type", ["user", "agent", "system"]);
export const factKind = pgEnum("fact_kind", FACT_KINDS);
export const factVerification = pgEnum("fact_verification", FACT_VERIFICATIONS);
export const factCategory = pgEnum("fact_category", FACT_CATEGORIES);
export const approvalAction = pgEnum("approval_action", APPROVAL_ACTIONS);
export const approvalStatus = pgEnum("approval_status", [
  "pending",
  "approved",
  "rejected",
  "expired",
  "executed",
]);
export const runStatus = pgEnum("run_status", [
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled",
  "blocked",
]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: userRole("role").notNull(),
  active: boolean("active").notNull().default(true),
  failedLogins: integer("failed_logins").notNull().default(0),
  lockedUntil: ts("locked_until"),
  lastLoginAt: ts("last_login_at"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: ts("created_at").notNull().defaultNow(),
  lastSeenAt: ts("last_seen_at").notNull().defaultNow(),
  expiresAt: ts("expires_at").notNull(),
  revokedAt: ts("revoked_at"),
  ip: text("ip"),
  userAgent: text("user_agent"),
});

export const prospects = pgTable("prospects", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  legalName: text("legal_name"),
  country: char("country", { length: 2 }).notNull(),
  region: text("region"),
  city: text("city"),
  language: text("language"),
  industry: text("industry"),
  websiteUrl: text("website_url"),
  websiteDomain: text("website_domain"),
  status: pipelineStatus("status").notNull().default("DISCOVERED"),
  paused: boolean("paused").notNull().default(false),
  opportunityScore: smallint("opportunity_score"),
  siteScore: smallint("site_score"),
  scoreExplanation: jsonb("score_explanation"),
  mainIssues: text("main_issues").array().notNull().default([]),
  recommendedSolution: text("recommended_solution"),
  currency: char("currency", { length: 3 }),
  estimatedValue: numeric("estimated_value", { precision: 14, scale: 2 }),
  confirmedValue: numeric("confirmed_value", { precision: 14, scale: 2 }),
  isSample: boolean("is_sample").notNull().default(false),
  ownerUserId: uuid("owner_user_id").references(() => users.id),
  createdByType: actorType("created_by_type").notNull(),
  createdById: text("created_by_id"),
  discoveredAt: ts("discovered_at").notNull().defaultNow(),
  lastVerifiedAt: ts("last_verified_at"),
  version: integer("version").notNull().default(1),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
  deletedAt: ts("deleted_at"),
});

export const prospectFacts = pgTable("prospect_facts", {
  id: uuid("id").primaryKey().defaultRandom(),
  prospectId: uuid("prospect_id")
    .notNull()
    .references(() => prospects.id, { onDelete: "cascade" }),
  category: factCategory("category").notNull(),
  field: text("field").notNull(),
  value: text("value").notNull(),
  kind: factKind("kind").notNull(),
  verification: factVerification("verification").notNull(),
  confidence: smallint("confidence").notNull(),
  sourceName: text("source_name"),
  sourceUrl: text("source_url"),
  verifiedAt: ts("verified_at"),
  collectedByType: actorType("collected_by_type").notNull(),
  collectedById: text("collected_by_id"),
  createdAt: ts("created_at").notNull().defaultNow(),
  deletedAt: ts("deleted_at"),
});

export const pipelineEvents = pgTable("pipeline_events", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  prospectId: uuid("prospect_id")
    .notNull()
    .references(() => prospects.id, { onDelete: "cascade" }),
  fromStatus: pipelineStatus("from_status"),
  toStatus: pipelineStatus("to_status").notNull(),
  actorType: actorType("actor_type").notNull(),
  actorId: text("actor_id"),
  actorLabel: text("actor_label").notNull(),
  reason: text("reason").notNull(),
  action: text("action").notNull(),
  result: text("result"),
  nextStep: text("next_step"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const approvals = pgTable("approvals", {
  id: uuid("id").primaryKey().defaultRandom(),
  prospectId: uuid("prospect_id").references(() => prospects.id, { onDelete: "set null" }),
  action: approvalAction("action").notNull(),
  summary: text("summary").notNull(),
  payload: jsonb("payload").notNull().default({}),
  status: approvalStatus("status").notNull().default("pending"),
  requiredApprovals: smallint("required_approvals").notNull().default(1),
  requestedByType: actorType("requested_by_type").notNull(),
  requestedById: text("requested_by_id"),
  requestedAt: ts("requested_at").notNull().defaultNow(),
  expiresAt: ts("expires_at"),
  decidedAt: ts("decided_at"),
  executedAt: ts("executed_at"),
});

export const approvalDecisions = pgTable(
  "approval_decisions",
  {
    approvalId: uuid("approval_id")
      .notNull()
      .references(() => approvals.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    decision: text("decision", { enum: ["approve", "reject"] }).notNull(),
    note: text("note"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.approvalId, t.userId] })],
);

export const notes = pgTable("notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  prospectId: uuid("prospect_id")
    .notNull()
    .references(() => prospects.id, { onDelete: "cascade" }),
  authorId: uuid("author_id")
    .notNull()
    .references(() => users.id),
  body: text("body").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
  deletedAt: ts("deleted_at"),
});

export const settings = pgTable("settings", {
  id: smallint("id").primaryKey().default(1),
  data: jsonb("data").notNull(),
  version: integer("version").notNull().default(1),
  updatedBy: uuid("updated_by").references(() => users.id),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const settingsHistory = pgTable("settings_history", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  version: integer("version").notNull(),
  data: jsonb("data").notNull(),
  changedBy: uuid("changed_by").references(() => users.id),
  changedAt: ts("changed_at").notNull().defaultNow(),
});

export const auditLog = pgTable("audit_log", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  actorType: actorType("actor_type").notNull(),
  actorId: text("actor_id"),
  action: text("action").notNull(),
  entityType: text("entity_type"),
  entityId: text("entity_id"),
  metadata: jsonb("metadata").notNull().default({}),
  ip: text("ip"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const agentRuns = pgTable("agent_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  agent: text("agent").notNull(),
  task: text("task").notNull(),
  prospectId: uuid("prospect_id").references(() => prospects.id, { onDelete: "set null" }),
  status: runStatus("status").notNull().default("queued"),
  attempt: smallint("attempt").notNull().default(1),
  maxAttempts: smallint("max_attempts").notNull().default(3),
  runAfter: ts("run_after").notNull().defaultNow(),
  model: text("model"),
  tool: text("tool"),
  input: jsonb("input").notNull().default({}),
  output: jsonb("output"),
  costUsd: numeric("cost_usd", { precision: 10, scale: 4 }).notNull().default("0"),
  tokensIn: integer("tokens_in"),
  tokensOut: integer("tokens_out"),
  error: text("error"),
  createdAt: ts("created_at").notNull().defaultNow(),
  startedAt: ts("started_at"),
  finishedAt: ts("finished_at"),
  requestedByType: actorType("requested_by_type").notNull().default("system"),
  requestedById: text("requested_by_id"),
  dedupeKey: text("dedupe_key"),
  lockedBy: text("locked_by"),
  lockedAt: ts("locked_at"),
  estimatedCostUsd: numeric("estimated_cost_usd", { precision: 10, scale: 4 }).notNull().default("0"),
});

export const siteAudits = pgTable("site_audits", {
  id: uuid("id").primaryKey().defaultRandom(),
  prospectId: uuid("prospect_id")
    .notNull()
    .references(() => prospects.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  runId: uuid("run_id").references(() => agentRuns.id, { onDelete: "set null" }),
  requestedUrl: text("requested_url").notNull(),
  finalUrl: text("final_url").notNull(),
  httpStatus: smallint("http_status").notNull(),
  responseMs: integer("response_ms").notNull(),
  htmlBytes: integer("html_bytes").notNull(),
  fetchedAt: ts("fetched_at").notNull(),
  siteScore: smallint("site_score"),
  categories: jsonb("categories").notNull(),
  checks: jsonb("checks").notNull(),
  issues: text("issues").array().notNull().default([]),
  strengths: text("strengths").array().notNull().default([]),
  recommendation: jsonb("recommendation").notNull(),
  tool: text("tool").notNull(),
  createdByType: actorType("created_by_type").notNull(),
  createdById: text("created_by_id"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const outreachMessages = pgTable("outreach_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  prospectId: uuid("prospect_id")
    .notNull()
    .references(() => prospects.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  content: jsonb("content").notNull(),
  createdByType: actorType("created_by_type").notNull(),
  createdById: text("created_by_id"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const sales = pgTable("sales", {
  id: uuid("id").primaryKey().defaultRandom(),
  occurredOn: date("occurred_on", { mode: "string" }).notNull(),
  description: text("description").notNull(),
  clientName: text("client_name").notNull(),
  prospectId: uuid("prospect_id").references(() => prospects.id, { onDelete: "set null" }),
  quoteId: uuid("quote_id"),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  currency: char("currency", { length: 3 }).notNull(),
  status: text("status", { enum: ["pendiente", "cobrado"] }).notNull(),
  paidOn: date("paid_on", { mode: "string" }),
  method: text("method"),
  notes: text("notes"),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: ts("created_at").notNull().defaultNow(),
  voidedAt: ts("voided_at"),
  voidedBy: uuid("voided_by").references(() => users.id),
  voidReason: text("void_reason"),
});

export const expenses = pgTable("expenses", {
  id: uuid("id").primaryKey().defaultRandom(),
  occurredOn: date("occurred_on", { mode: "string" }).notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  vendor: text("vendor"),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  currency: char("currency", { length: 3 }).notNull(),
  status: text("status", { enum: ["pendiente", "pagado"] }).notNull(),
  paidOn: date("paid_on", { mode: "string" }),
  notes: text("notes"),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: ts("created_at").notNull().defaultNow(),
  voidedAt: ts("voided_at"),
  voidedBy: uuid("voided_by").references(() => users.id),
  voidReason: text("void_reason"),
});

export const quotes = pgTable("quotes", {
  id: uuid("id").primaryKey().defaultRandom(),
  number: bigserial("number", { mode: "number" }).notNull(),
  prospectId: uuid("prospect_id").references(() => prospects.id, { onDelete: "set null" }),
  clientName: text("client_name").notNull(),
  currency: char("currency", { length: 3 }).notNull(),
  lines: jsonb("lines").notNull(),
  discountPct: numeric("discount_pct", { precision: 5, scale: 2 }).notNull().default("0"),
  taxPct: numeric("tax_pct", { precision: 5, scale: 2 }).notNull().default("0"),
  subtotal: numeric("subtotal", { precision: 14, scale: 2 }).notNull(),
  total: numeric("total", { precision: 14, scale: 2 }).notNull(),
  monthlyTotal: numeric("monthly_total", { precision: 14, scale: 2 }).notNull().default("0"),
  validUntil: date("valid_until", { mode: "string" }),
  notes: text("notes"),
  status: text("status", { enum: ["borrador", "enviado", "aceptado", "rechazado"] }).notNull().default("borrador"),
  saleId: uuid("sale_id").references(() => sales.id),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const portfolioItems = pgTable("portfolio_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  clientName: text("client_name").notNull(),
  prospectId: uuid("prospect_id").references(() => prospects.id, { onDelete: "set null" }),
  url: text("url"),
  year: smallint("year"),
  summary: text("summary").notNull().default(""),
  highlights: text("highlights").array().notNull().default([]),
  tags: text("tags").array().notNull().default([]),
  services: text("services").array().notNull().default([]),
  featured: boolean("featured").notNull().default(false),
  clientOk: boolean("client_ok").notNull().default(false),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
  deletedAt: ts("deleted_at"),
});

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" });

export const brandAssets = pgTable("brand_assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  prospectId: uuid("prospect_id")
    .notNull()
    .references(() => prospects.id, { onDelete: "cascade" }),
  kind: text("kind", { enum: ["logo", "foto"] }).notNull(),
  mime: text("mime", { enum: ["image/png", "image/jpeg", "image/webp"] }).notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  bytes: bytea("bytes").notNull(),
  sha256: char("sha256", { length: 64 }).notNull(),
  alt: text("alt").notNull().default(""),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const siteBriefs = pgTable("site_briefs", {
  id: uuid("id").primaryKey().defaultRandom(),
  prospectId: uuid("prospect_id")
    .notNull()
    .references(() => prospects.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  brand: jsonb("brand").notNull(),
  content: jsonb("content").notNull(),
  authorizationNote: text("authorization_note").notNull(),
  createdByType: actorType("created_by_type").notNull(),
  createdById: text("created_by_id"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const siteBuilds = pgTable("site_builds", {
  id: uuid("id").primaryKey().defaultRandom(),
  prospectId: uuid("prospect_id")
    .notNull()
    .references(() => prospects.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  briefId: uuid("brief_id")
    .notNull()
    .references(() => siteBriefs.id),
  template: text("template").notNull(),
  html: text("html").notNull(),
  css: text("css").notNull(),
  quality: jsonb("quality").notNull(),
  ready: boolean("ready").notNull(),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: ts("created_at").notNull().defaultNow(),
});
