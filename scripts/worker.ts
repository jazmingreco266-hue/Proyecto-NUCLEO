/**
 * Worker de agentes. Uso:
 *   npm run worker            # corre sin parar (servidor propio o VPS)
 *   npm run worker -- --once  # procesa lo que haya en cola y termina
 */
import { closeDb, getDb } from "../src/db/client";
import { processNext, tick } from "../src/agents/orchestrator";

const once = process.argv.includes("--once");
const TICK_EVERY_MS = 5 * 60_000;
const IDLE_SLEEP_MS = 5_000;
const log = (m: string) => console.log(`${new Date().toISOString()} ${m}`);

let stopping = false;
for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    log(`Recibido ${sig}: termino el trabajo actual y salgo.`);
    stopping = true;
  });
}

async function main() {
  const db = getDb();
  const workerId = `worker-${process.pid}`;
  let lastTick = 0;
  log(`Worker ${workerId} iniciado${once ? " (una pasada)" : ""}.`);
  while (!stopping) {
    if (Date.now() - lastTick > TICK_EVERY_MS) {
      const t = await tick(db, { log });
      lastTick = Date.now();
      if (t.recovered || t.enqueued) log(`Orquestador: ${t.recovered} recuperados, ${t.enqueued} encolados.`);
    }
    const worked = await processNext(db, { workerId, log });
    if (!worked) {
      if (once) break;
      await new Promise((r) => setTimeout(r, IDLE_SLEEP_MS));
    }
  }
  await closeDb();
  log("Worker detenido.");
}

main().catch(async (err) => {
  console.error(err);
  await closeDb();
  process.exit(1);
});
