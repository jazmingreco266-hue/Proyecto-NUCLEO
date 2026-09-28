import path from "node:path";
import { closeDb, getPool } from "../src/db/client";
import { migrate } from "../src/db/migrator";

const dir = path.resolve(import.meta.dirname, "../migrations");
try {
  const applied = await migrate(getPool(), dir, (m) => console.log(`✔ ${m}`));
  console.log(applied.length ? `Listo: ${applied.length} migración(es) aplicada(s).` : "La base ya estaba al día.");
} catch (err) {
  console.error(`✖ ${(err as Error).message}`);
  process.exitCode = 1;
} finally {
  await closeDb();
}
