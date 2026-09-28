import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema>;

let pool: Pool | undefined;
let db: Db | undefined;

function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Falta la variable de entorno DATABASE_URL.");
  return url;
}

export function getPool(): Pool {
  pool ??= new Pool({ connectionString: databaseUrl(), max: 10 });
  return pool;
}

export function getDb(): Db {
  db ??= drizzle(getPool(), { schema });
  return db;
}

export async function closeDb() {
  await pool?.end();
  pool = undefined;
  db = undefined;
}
