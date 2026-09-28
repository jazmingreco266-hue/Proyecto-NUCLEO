import path from "node:path";
import { Pool } from "pg";
import { migrate } from "../src/db/migrator";

/** Antes de toda la corrida: base de test limpia y migrada desde cero. */
export default async function setup() {
  const url = process.env.DATABASE_URL;
  if (!url || !/test/i.test(url)) {
    throw new Error("Los tests necesitan una DATABASE_URL de prueba (su nombre tiene que contener 'test').");
  }
  const pool = new Pool({ connectionString: url });
  try {
    await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
    await migrate(pool, path.resolve(import.meta.dirname, "../migrations"));
  } finally {
    await pool.end();
  }
}
