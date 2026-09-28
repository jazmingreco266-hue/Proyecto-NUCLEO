import { timingSafeEqual } from "node:crypto";
import { getDb } from "@/db/client";
import { processNext, tick } from "@/agents/orchestrator";

// Para Vercel Cron o cualquier programador externo. Protegido con CRON_SECRET.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BUDGET_MS = 45_000;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false;
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

export async function GET(req: Request) {
  if (!authorized(req)) return new Response("No autorizado", { status: 401 });
  const db = getDb();
  const started = Date.now();
  const t = await tick(db);
  let processed = 0;
  // Procesa trabajos mientras quede tiempo, dejando margen para el último.
  while (Date.now() - started < BUDGET_MS && (await processNext(db, { workerId: "cron" }))) processed++;
  return Response.json({ recuperados: t.recovered, encolados: t.enqueued, procesados: processed });
}
