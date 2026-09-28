import { desc, eq, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { auditLog, users } from "@/db/schema";
import { assertCan, type Principal } from "../principal";
import { currentTimezone } from "./settings";

export type Money = { currency: string | null; amount: number };

export type Overview = {
  foundToday: number;
  qualified: number;
  demosGenerated: number;
  messagesPrepared: number;
  sentManually: number;
  responses: { positive: number; negative: number };
  approvedProjects: number;
  inConstruction: number;
  delivered: number;
  potentialRevenue: Money[];
  confirmedRevenue: Money[];
  blockedTasks: number;
  securityAlerts: number;
  pendingApprovals: number;
  totalProspects: number;
  sampleProspects: number;
  byStatus: { status: string; n: number }[];
  timezone: string;
};

/**
 * Métricas reales, calculadas sobre la base. Los datos de ejemplo quedan excluidos.
 * "Alcanzó X" se mide con el historial del pipeline, no con el estado actual,
 * para que un prospecto que avanzó siga contando en las etapas por las que pasó.
 */
export async function getOverview(db: Db, who: Principal): Promise<Overview> {
  assertCan(who, "prospects.read");
  const tz = await currentTimezone(db);

  const reached = (status: string) => sql<number>`(
    SELECT count(DISTINCT e.prospect_id)::int FROM pipeline_events e
    JOIN prospects p ON p.id = e.prospect_id
    WHERE e.to_status = ${status}::pipeline_status AND NOT p.is_sample AND p.deleted_at IS NULL)`;
  const eventsTo = (status: string) => sql<number>`(
    SELECT count(*)::int FROM pipeline_events e
    JOIN prospects p ON p.id = e.prospect_id
    WHERE e.to_status = ${status}::pipeline_status AND NOT p.is_sample AND p.deleted_at IS NULL)`;

  const r = await db.execute<Record<string, number>>(sql`
    SELECT
      (SELECT count(*)::int FROM prospects
        WHERE NOT is_sample AND deleted_at IS NULL
          AND discovered_at >= (date_trunc('day', now() AT TIME ZONE ${tz}) AT TIME ZONE ${tz})) AS found_today,
      ${reached("QUALIFIED")} AS qualified,
      ${eventsTo("DEMO_READY")} AS demos,
      ${eventsTo("OUTREACH_READY")} AS prepared,
      ${eventsTo("SENT_MANUALLY")} AS sent,
      ${eventsTo("REPLIED_POSITIVE")} AS positive,
      ${eventsTo("REPLIED_NEGATIVE")} AS negative,
      ${reached("APPROVED")} AS approved,
      ${reached("DEPLOYED")} AS delivered,
      (SELECT count(*)::int FROM prospects WHERE NOT is_sample AND deleted_at IS NULL
        AND status IN ('APPROVED','BUILDING','STAGING','CLIENT_REVIEW','QA','READY_TO_DEPLOY')) AS building,
      (SELECT count(*)::int FROM agent_runs WHERE status IN ('failed','blocked')) AS blocked,
      (SELECT count(*)::int FROM audit_log WHERE action IN ('auth.locked','auth.login_blocked')
        AND created_at > now() - interval '7 days') AS alerts,
      (SELECT count(*)::int FROM approvals WHERE status = 'pending') AS pending_approvals,
      (SELECT count(*)::int FROM prospects WHERE NOT is_sample AND deleted_at IS NULL) AS total,
      (SELECT count(*)::int FROM prospects WHERE is_sample AND deleted_at IS NULL) AS samples
  `);
  const m = r.rows[0]!;

  const money = async (column: "estimated_value" | "confirmed_value", openOnly: boolean) => {
    const res = await db.execute<{ currency: string | null; amount: string }>(sql`
      SELECT currency, sum(${sql.raw(column)})::text AS amount FROM prospects
      WHERE NOT is_sample AND deleted_at IS NULL AND ${sql.raw(column)} IS NOT NULL
      ${openOnly ? sql`AND status NOT IN ('REJECTED','CLOSED','REPLIED_NEGATIVE')` : sql``}
      GROUP BY currency ORDER BY currency`);
    return res.rows.map((x) => ({ currency: x.currency, amount: Number(x.amount) }));
  };

  const byStatus = await db.execute<{ status: string; n: number }>(sql`
    SELECT status::text, count(*)::int AS n FROM prospects
    WHERE NOT is_sample AND deleted_at IS NULL GROUP BY status`);

  return {
    foundToday: m.found_today!,
    qualified: m.qualified!,
    demosGenerated: m.demos!,
    messagesPrepared: m.prepared!,
    sentManually: m.sent!,
    responses: { positive: m.positive!, negative: m.negative! },
    approvedProjects: m.approved!,
    inConstruction: m.building!,
    delivered: m.delivered!,
    potentialRevenue: await money("estimated_value", true),
    confirmedRevenue: await money("confirmed_value", false),
    blockedTasks: m.blocked!,
    securityAlerts: m.alerts!,
    pendingApprovals: m.pending_approvals!,
    totalProspects: m.total!,
    sampleProspects: m.samples!,
    byStatus: byStatus.rows,
    timezone: tz,
  };
}

export async function listAudit(db: Db, who: Principal, limit = 200) {
  assertCan(who, "audit.read");
  return db
    .select({ a: auditLog, userName: users.name })
    .from(auditLog)
    .leftJoin(users, eq(sql`${users.id}::text`, auditLog.actorId))
    .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
    .limit(Math.min(Math.max(limit, 1), 500));
}
