/**
 * Cola de trabajos de los agentes sobre la tabla agent_runs.
 *
 * - Toma de trabajos con FOR UPDATE SKIP LOCKED: dos workers nunca toman el mismo.
 * - Deduplicación: el mismo trabajo (dedupe_key) no puede estar dos veces en cola o en ejecución.
 * - Reintentos con espera creciente hasta max_attempts; después queda como fallido.
 * - "Bloqueado" = no se debe reintentar solo (robots.txt, sitio que niega acceso, presupuesto).
 * - Cada ejecución es un registro: reintentar desde el panel crea una ejecución nueva.
 */
import { and, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db/client";
import { agentRuns, prospects } from "@/db/schema";
import { backoffMs } from "@/domain/agent-guards";
import { audit, type Executor } from "../audit";
import { actorOf, assertCan, ConflictError, NotFoundError, type Principal } from "../principal";

export type AgentRun = typeof agentRuns.$inferSelect;
export type RunStatus = AgentRun["status"];

export const RUN_STATUS_LABELS: Record<RunStatus, string> = {
  queued: "En cola",
  running: "Ejecutando",
  succeeded: "Completado",
  failed: "Fallido",
  cancelled: "Cancelado",
  blocked: "Bloqueado",
};

export const AGENT_LABELS: Record<string, string> = {
  "website-audit": "Auditoría web",
  "business-research": "Investigación con IA",
};

export type EnqueueInput = {
  agent: string;
  task: string;
  prospectId?: string | null;
  input?: Record<string, unknown>;
  dedupeKey?: string | null;
  estimatedCostUsd?: number;
  maxAttempts?: number;
  runAfter?: Date;
};

/** Encola un trabajo. Si ya hay uno igual en cola o ejecutándose, devuelve ese. */
export async function enqueueRun(tx: Executor, who: Principal | "system", job: EnqueueInput): Promise<{ run: AgentRun; created: boolean }> {
  const by = who === "system" ? { type: "system" as const, id: null } : actorOf(who);
  const [row] = await tx
    .insert(agentRuns)
    .values({
      agent: job.agent,
      task: job.task,
      prospectId: job.prospectId ?? null,
      input: job.input ?? {},
      dedupeKey: job.dedupeKey ?? null,
      estimatedCostUsd: String(job.estimatedCostUsd ?? 0),
      maxAttempts: job.maxAttempts ?? 3,
      runAfter: job.runAfter ?? new Date(),
      requestedByType: by.type,
      requestedById: by.id,
    })
    .onConflictDoNothing({
      target: agentRuns.dedupeKey,
      where: sql`dedupe_key IS NOT NULL AND status IN ('queued', 'running')`,
    })
    .returning();
  if (row) {
    await audit(tx, who, { action: "run.enqueue", entityType: "agent_run", entityId: row.id, metadata: { agente: job.agent, tarea: job.task, prospecto: job.prospectId } });
    return { run: row, created: true };
  }
  const [existing] = await tx
    .select()
    .from(agentRuns)
    .where(and(eq(agentRuns.dedupeKey, job.dedupeKey!), inArray(agentRuns.status, ["queued", "running"])))
    .limit(1);
  if (!existing) throw new ConflictError("El trabajo cambió de estado mientras se encolaba. Probá de nuevo.");
  return { run: existing, created: false };
}

async function claim(db: Db, workerId: string, filter: SQL): Promise<AgentRun | null> {
  const r = await db.execute<{ id: string }>(sql`
    UPDATE agent_runs SET status = 'running', started_at = now(), locked_at = now(), locked_by = ${workerId}
    WHERE id = (
      SELECT id FROM agent_runs WHERE status = 'queued' AND ${filter}
      ORDER BY run_after, created_at FOR UPDATE SKIP LOCKED LIMIT 1
    )
    RETURNING id`);
  const id = r.rows[0]?.id;
  if (!id) return null;
  const [run] = await db.select().from(agentRuns).where(eq(agentRuns.id, id));
  return run ?? null;
}

/** Toma el próximo trabajo listo para correr. */
export function claimNext(db: Db, workerId: string): Promise<AgentRun | null> {
  return claim(db, workerId, sql`run_after <= now()`);
}

/** Toma un trabajo específico (para ejecutarlo al momento desde el panel). */
export function claimRun(db: Db, id: string, workerId: string): Promise<AgentRun | null> {
  return claim(db, workerId, sql`id = ${id}`);
}

export async function completeRun(
  db: Db,
  run: AgentRun,
  r: { output: Record<string, unknown>; costUsd?: number; model?: string | null; tool?: string | null; tokensIn?: number; tokensOut?: number },
) {
  await db.transaction(async (tx) => {
    await tx
      .update(agentRuns)
      .set({
        status: "succeeded",
        output: r.output,
        costUsd: sql`${agentRuns.costUsd} + ${String(r.costUsd ?? 0)}::numeric`,
        model: r.model ?? null,
        tool: r.tool ?? null,
        tokensIn: r.tokensIn ?? null,
        tokensOut: r.tokensOut ?? null,
        error: null,
        finishedAt: new Date(),
        lockedAt: null,
        lockedBy: null,
      })
      .where(eq(agentRuns.id, run.id));
    await audit(tx, { kind: "agent", name: run.agent }, { action: "run.succeeded", entityType: "agent_run", entityId: run.id, metadata: { costo: r.costUsd ?? 0 } });
  });
}

/** Gasto de un intento que no terminó bien (por ejemplo, una respuesta de IA rechazada): se suma igual. */
export type SpentOnAttempt = { costUsd?: number; model?: string | null; tool?: string | null };

const addCost = (extra?: SpentOnAttempt) =>
  extra?.costUsd ? { costUsd: sql`${agentRuns.costUsd} + ${String(extra.costUsd)}::numeric` } : {};
const addModel = (extra?: SpentOnAttempt) => ({
  ...(extra?.model ? { model: extra.model } : {}),
  ...(extra?.tool ? { tool: extra.tool } : {}),
});

/** Error reintentable: vuelve a la cola con espera creciente o queda fallido si agotó los intentos. */
export async function failRun(db: Db, run: AgentRun, error: string, now = new Date(), extra?: SpentOnAttempt) {
  const exhausted = run.attempt >= run.maxAttempts;
  await db.transaction(async (tx) => {
    await tx
      .update(agentRuns)
      .set(
        exhausted
          ? { status: "failed", error: error.slice(0, 2000), finishedAt: now, lockedAt: null, lockedBy: null, ...addCost(extra), ...addModel(extra) }
          : {
              ...addCost(extra),
              ...addModel(extra),
              status: "queued",
              error: error.slice(0, 2000),
              attempt: run.attempt + 1,
              runAfter: new Date(now.getTime() + backoffMs(run.attempt)),
              lockedAt: null,
              lockedBy: null,
            },
      )
      .where(eq(agentRuns.id, run.id));
    await audit(tx, { kind: "agent", name: run.agent }, {
      action: exhausted ? "run.failed" : "run.retry_scheduled",
      entityType: "agent_run",
      entityId: run.id,
      metadata: { intento: run.attempt, error: error.slice(0, 300) },
    });
  });
}

/** No se reintenta solo: requiere que una persona revise (o que cambie la configuración). */
export async function blockRun(db: Db, run: AgentRun, reason: string, extra?: SpentOnAttempt) {
  await db.transaction(async (tx) => {
    await tx
      .update(agentRuns)
      .set({ status: "blocked", error: reason.slice(0, 2000), finishedAt: new Date(), lockedAt: null, lockedBy: null, ...addCost(extra), ...addModel(extra) })
      .where(eq(agentRuns.id, run.id));
    await audit(tx, { kind: "agent", name: run.agent }, { action: "run.blocked", entityType: "agent_run", entityId: run.id, metadata: { motivo: reason.slice(0, 300) } });
  });
}

/** Devuelve el trabajo a la cola para más tarde, sin gastar un intento (horario, autonomía). */
export async function postponeRun(db: Db, run: AgentRun, until: Date, reason: string) {
  await db
    .update(agentRuns)
    .set({ status: "queued", runAfter: until, error: `En espera: ${reason}`, startedAt: null, lockedAt: null, lockedBy: null })
    .where(eq(agentRuns.id, run.id));
}

/** Trabajos "ejecutando" hace demasiado (el worker se cayó): vuelven a la cola como un intento fallido. */
export async function recoverStale(db: Db, olderThanMinutes = 15): Promise<number> {
  const stale = await db
    .select()
    .from(agentRuns)
    .where(and(eq(agentRuns.status, "running"), sql`locked_at < now() - make_interval(mins => ${olderThanMinutes})`));
  for (const run of stale) await failRun(db, run, "El trabajo quedó sin terminar (el proceso se interrumpió).");
  return stale.length;
}

/** Gasto del mes en curso, en la zona horaria configurada. */
export async function monthSpendUsd(db: Db, timezone: string): Promise<number> {
  const r = await db.execute<{ spent: string | null }>(sql`
    SELECT sum(cost_usd)::text AS spent FROM agent_runs
    WHERE created_at >= (date_trunc('month', now() AT TIME ZONE ${timezone}) AT TIME ZONE ${timezone})`);
  return Number(r.rows[0]?.spent ?? 0);
}

// ─────────────────────────── Panel ───────────────────────────

export const runFiltersSchema = z.object({
  status: z.enum(["queued", "running", "succeeded", "failed", "cancelled", "blocked", "problemas"]).optional(),
});

export async function listRuns(db: Db, who: Principal, raw: unknown, limit = 100) {
  assertCan(who, "prospects.read");
  const f = runFiltersSchema.catch({}).parse(raw ?? {});
  const where =
    f.status === "problemas"
      ? inArray(agentRuns.status, ["failed", "blocked"])
      : f.status
        ? eq(agentRuns.status, f.status)
        : undefined;
  const rows = await db
    .select({ r: agentRuns, prospectName: prospects.name })
    .from(agentRuns)
    .leftJoin(prospects, eq(prospects.id, agentRuns.prospectId))
    .where(where)
    .orderBy(desc(agentRuns.createdAt))
    .limit(Math.min(Math.max(limit, 1), 500));
  return { filters: f, rows };
}

export async function runCounts(db: Db, who: Principal) {
  assertCan(who, "prospects.read");
  const r = await db.execute<{ status: RunStatus; n: number }>(sql`SELECT status, count(*)::int AS n FROM agent_runs GROUP BY status`);
  const out = Object.fromEntries(r.rows.map((x) => [x.status, x.n])) as Partial<Record<RunStatus, number>>;
  return { ...out, problems: (out.failed ?? 0) + (out.blocked ?? 0) };
}

export async function latestRunFor(db: Db, who: Principal, prospectId: string, agent: string) {
  assertCan(who, "prospects.read");
  const [run] = await db
    .select()
    .from(agentRuns)
    .where(and(eq(agentRuns.prospectId, prospectId), eq(agentRuns.agent, agent)))
    .orderBy(desc(agentRuns.createdAt))
    .limit(1);
  return run ?? null;
}

/** Reintentar crea una ejecución nueva con los mismos datos: la fallida queda como registro. */
export async function retryRun(db: Db, who: Principal, id: string) {
  assertCan(who, "prospects.write");
  if (!z.string().uuid().safeParse(id).success) throw new NotFoundError("La tarea");
  return db.transaction(async (tx) => {
    const [old] = await tx.select().from(agentRuns).where(eq(agentRuns.id, id)).limit(1);
    if (!old) throw new NotFoundError("La tarea");
    if (!["failed", "blocked", "cancelled"].includes(old.status)) {
      throw new ConflictError("Solo se puede reintentar una tarea fallida, bloqueada o cancelada.");
    }
    const { run } = await enqueueRun(tx, who, {
      agent: old.agent,
      task: old.task,
      prospectId: old.prospectId,
      input: { ...(old.input as Record<string, unknown>), reintentoDe: old.id },
      dedupeKey: old.dedupeKey,
      estimatedCostUsd: Number(old.estimatedCostUsd),
      maxAttempts: old.maxAttempts,
    });
    await audit(tx, who, { action: "run.retry", entityType: "agent_run", entityId: old.id, metadata: { nueva: run.id } });
    return run;
  });
}

export async function cancelRun(db: Db, who: Principal, id: string) {
  assertCan(who, "prospects.write");
  if (!z.string().uuid().safeParse(id).success) throw new NotFoundError("La tarea");
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(agentRuns)
      .set({ status: "cancelled", finishedAt: new Date(), error: "Cancelada por una persona del equipo." })
      .where(and(eq(agentRuns.id, id), eq(agentRuns.status, "queued")))
      .returning();
    if (!row) throw new ConflictError("Solo se puede cancelar una tarea que todavía está en cola.");
    await audit(tx, who, { action: "run.cancel", entityType: "agent_run", entityId: id });
    return row;
  });
}
