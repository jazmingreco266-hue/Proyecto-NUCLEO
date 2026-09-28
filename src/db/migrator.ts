import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { Pool } from "pg";

export type MigrationFile = { name: string; sql: string; checksum: string };

export function checksum(sql: string): string {
  return createHash("sha256").update(sql, "utf8").digest("hex");
}

export async function loadMigrations(dir: string): Promise<MigrationFile[]> {
  const names = (await readdir(dir)).filter((f) => /^\d{4}_[a-z0-9_]+\.sql$/.test(f)).sort();
  return Promise.all(
    names.map(async (name) => {
      const sql = await readFile(path.join(dir, name), "utf8");
      return { name, sql, checksum: checksum(sql) };
    }),
  );
}

/**
 * Aplica las migraciones pendientes, cada una en su propia transacción.
 * Se niega a continuar si una migración ya aplicada cambió de contenido:
 * eso significaría que la base y el código ya no describen lo mismo.
 */
export async function migrate(pool: Pool, dir: string, log: (m: string) => void = () => {}) {
  const client = await pool.connect();
  try {
    // Evita que dos procesos migren a la vez.
    await client.query("SELECT pg_advisory_lock(727001)");
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY,
      checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const { rows } = await client.query<{ name: string; checksum: string }>(
      "SELECT name, checksum FROM schema_migrations",
    );
    const applied = new Map(rows.map((r) => [r.name, r.checksum]));
    const files = await loadMigrations(dir);

    for (const [name] of applied) {
      if (!files.some((f) => f.name === name)) {
        throw new Error(`La migración ${name} está aplicada en la base pero no existe en el código.`);
      }
    }

    const done: string[] = [];
    for (const file of files) {
      const prev = applied.get(file.name);
      if (prev) {
        if (prev !== file.checksum) {
          throw new Error(
            `La migración ${file.name} fue modificada después de aplicarse. ` +
              "No se edita una migración aplicada: creá una nueva.",
          );
        }
        continue;
      }
      await client.query("BEGIN");
      try {
        await client.query(file.sql);
        await client.query("INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)", [
          file.name,
          file.checksum,
        ]);
        await client.query("COMMIT");
        log(`aplicada ${file.name}`);
        done.push(file.name);
      } catch (err) {
        await client.query("ROLLBACK");
        throw new Error(`Falló ${file.name}: ${(err as Error).message}`);
      }
    }
    return done;
  } finally {
    await client.query("SELECT pg_advisory_unlock(727001)").catch(() => {});
    client.release();
  }
}
