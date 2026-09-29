/**
 * Orquestador: toma trabajos de la cola, aplica las guardas (presupuesto, horario,
 * autonomía), ejecuta el agente correspondiente y registra el resultado.
 *
 * Ningún agente ejecuta acciones sensibles: solo investigan, auditan y guardan resultados.
 * Lo que requiere aprobación humana pasa por la tabla approvals.
 */
import { and, eq, isNull, notExists, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { agentRuns, prospects, siteAudits } from "@/db/schema";
import { budgetGuard, scheduleGuard } from "@/domain/agent-guards";
import type { Settings } from "@/domain/validation";
import type { Principal } from "@/server/principal";
import {
  blockRun,
  claimNext,
  claimRun,
  completeRun,
  enqueueRun,
  failRun,
  monthSpendUsd,
  postponeRun,
  recoverStale,
  type AgentRun,
  type SpentOnAttempt,
} from "@/server/services/agent-runs";
import { AUDIT_AGENT } from "@/server/services/audits";
import { RESEARCH_AGENT } from "@/server/services/research";
import { RESEARCH_ESTIMATED_COST_USD } from "@/domain/research";
import { aiConfigured } from "./ai";
import { businessResearchHandler } from "./business-research";
import { getSettings } from "@/server/services/settings";
import { PoliteFetcher } from "./http";
import { websiteAuditHandler } from "./website-audit";

export type HandlerResult =
  | { kind: "done"; output: Record<string, unknown>; costUsd?: number; model?: string; tool?: string; tokensIn?: number; tokensOut?: number }
  | { kind: "retry"; error: string; spent?: SpentOnAttempt }
  | { kind: "blocked"; reason: string; spent?: SpentOnAttempt };

export type HandlerContext = {
  db: Db;
  run: AgentRun;
  agent: Principal;
  settings: Settings;
  fetcher: () => PoliteFetcher;
  now: Date;
};

export type Handler = (ctx: HandlerContext) => Promise<HandlerResult>;

export type Deps = {
  /** Reemplaza agentes (tests: una IA simulada que no gasta). */
  handlers?: Partial<Record<string, Handler>>;
  fetcher?: () => PoliteFetcher;
  now?: () => Date;
  workerId?: string;
  log?: (msg: string) => void;
};

const HANDLERS: Record<string, Handler> = {
  [AUDIT_AGENT]: websiteAuditHandler,
  [RESEARCH_AGENT]: businessResearchHandler(),
};

const SYSTEM_READER: Principal = { kind: "agent", name: "orchestrator" };

export async function processRun(db: Db, run: AgentRun, deps: Deps = {}): Promise<AgentRun["status"]> {
  const now = deps.now?.() ?? new Date();
  const log = deps.log ?? (() => {});
  const handler = deps.handlers?.[run.agent] ?? HANDLERS[run.agent];
  if (!handler) {
    await blockRun(db, run, `No existe un agente llamado «${run.agent}».`);
    return "blocked";
  }
  const { data: settings } = await getSettings(db, SYSTEM_READER);

  const sched = scheduleGuard(settings, run.requestedByType === "user", now);
  if (!sched.ok) {
    await postponeRun(db, run, sched.until!, sched.reason);
    log(`[${run.agent}] ${run.id} pospuesto: ${sched.reason}`);
    return "queued";
  }
  const budget = budgetGuard(settings.apiBudgetUsdMonthly, await monthSpendUsd(db, settings.schedule.timezone), Number(run.estimatedCostUsd));
  if (!budget.ok) {
    await blockRun(db, run, budget.reason);
    log(`[${run.agent}] ${run.id} bloqueado: ${budget.reason}`);
    return "blocked";
  }

  let result: HandlerResult;
  try {
    result = await handler({
      db,
      run,
      agent: { kind: "agent", name: run.agent },
      settings,
      fetcher: deps.fetcher ?? (() => new PoliteFetcher()),
      now,
    });
  } catch (err) {
    // Error inesperado: se registra sin exponer detalles internos y se reintenta.
    console.error(`[${run.agent}] ${run.id}`, err);
    result = { kind: "retry", error: `Error interno del agente: ${(err as Error).message ?? "desconocido"}`.slice(0, 500) };
  }

  if (result.kind === "done") {
    await completeRun(db, run, result);
    log(`[${run.agent}] ${run.id} completado`);
    return "succeeded";
  }
  if (result.kind === "blocked") {
    await blockRun(db, run, result.reason, result.spent);
    log(`[${run.agent}] ${run.id} bloqueado: ${result.reason}`);
    return "blocked";
  }
  await failRun(db, run, result.error, now, result.spent);
  log(`[${run.agent}] ${run.id} falló (intento ${run.attempt}/${run.maxAttempts}): ${result.error}`);
  return run.attempt >= run.maxAttempts ? "failed" : "queued";
}

/** Procesa el próximo trabajo listo. Devuelve false si la cola estaba vacía. */
export async function processNext(db: Db, deps: Deps = {}): Promise<boolean> {
  const run = await claimNext(db, deps.workerId ?? `worker-${process.pid}`);
  if (!run) return false;
  await processRun(db, run, deps);
  return true;
}

/** Ejecuta al momento un trabajo recién pedido desde el panel. Si otro worker ya lo tomó, no hace nada. */
export async function processNow(db: Db, runId: string, deps: Deps = {}) {
  const run = await claimRun(db, runId, deps.workerId ?? `panel-${process.pid}`);
  if (!run) return null;
  return processRun(db, run, deps);
}

/**
 * Tarea periódica del orquestador. Si la autonomía lo permite y está en horario:
 * - encola la investigación con IA de prospectos descubiertos (solo si hay API key y
 *   queda presupuesto para al menos una investigación);
 * - encola la auditoría técnica de prospectos calificados que todavía no tienen una.
 * Cada agente tiene su propio tope diario (maxLeadsPerDay). También recupera trabajos colgados.
 */
export async function tick(db: Db, deps: Deps & { aiConfigured?: () => boolean } = {}) {
  const now = deps.now?.() ?? new Date();
  const recovered = await recoverStale(db);
  const { data: settings } = await getSettings(db, SYSTEM_READER);
  if (!scheduleGuard(settings, false, now).ok) return { recovered, enqueued: 0 };

  let enqueued = 0;
  const ai = deps.aiConfigured ?? aiConfigured;
  const spent = await monthSpendUsd(db, settings.schedule.timezone);
  if (ai() && budgetGuard(settings.apiBudgetUsdMonthly, spent, RESEARCH_ESTIMATED_COST_USD).ok) {
    enqueued += await autoEnqueue(db, settings, {
      agent: RESEARCH_AGENT,
      status: "DISCOVERED",
      task: "Investigación del negocio con IA (automática)",
      estimatedCostUsd: RESEARCH_ESTIMATED_COST_USD,
      maxAttempts: 2,
      // Una sola investigación automática por prospecto: repetirla la pide una persona.
      skipIf: sql`${agentRuns.status} <> 'cancelled'`,
    });
  }
  enqueued += await autoEnqueue(db, settings, {
    agent: AUDIT_AGENT,
    status: "QUALIFIED",
    task: "Auditoría técnica del sitio (automática)",
    estimatedCostUsd: 0,
    maxAttempts: 3,
    skipIf: sql`${agentRuns.status} IN ('queued','running','blocked')`,
    requireNoAudit: true,
  });
  return { recovered, enqueued };
}

async function autoEnqueue(
  db: Db,
  settings: Settings,
  o: {
    agent: string;
    status: "DISCOVERED" | "QUALIFIED";
    task: string;
    estimatedCostUsd: number;
    maxAttempts: number;
    skipIf: ReturnType<typeof sql>;
    requireNoAudit?: boolean;
  },
): Promise<number> {
  const tz = settings.schedule.timezone;
  const today = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM agent_runs
    WHERE agent = ${o.agent} AND requested_by_type = 'system'
      AND created_at >= (date_trunc('day', now() AT TIME ZONE ${tz}) AT TIME ZONE ${tz})`);
  const room = Math.max(0, settings.maxLeadsPerDay - (today.rows[0]?.n ?? 0));
  if (room === 0) return 0;

  const candidates = await db
    .select({ id: prospects.id })
    .from(prospects)
    .where(
      and(
        eq(prospects.status, o.status),
        eq(prospects.paused, false),
        eq(prospects.isSample, false),
        isNull(prospects.deletedAt),
        sql`${prospects.websiteUrl} IS NOT NULL`,
        o.requireNoAudit ? notExists(db.select({ one: sql`1` }).from(siteAudits).where(eq(siteAudits.prospectId, prospects.id))) : undefined,
        notExists(
          db
            .select({ one: sql`1` })
            .from(agentRuns)
            .where(and(eq(agentRuns.prospectId, prospects.id), eq(agentRuns.agent, o.agent), o.skipIf)),
        ),
      ),
    )
    .orderBy(prospects.discoveredAt)
    .limit(room);

  let n = 0;
  for (const c of candidates) {
    const { created } = await db.transaction((tx) =>
      enqueueRun(tx, "system", {
        agent: o.agent,
        task: o.task,
        prospectId: c.id,
        dedupeKey: `${o.agent}:${c.id}`,
        estimatedCostUsd: o.estimatedCostUsd,
        maxAttempts: o.maxAttempts,
      }),
    );
    if (created) n++;
  }
  return n;
}
