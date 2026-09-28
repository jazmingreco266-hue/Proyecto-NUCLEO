import path from "node:path";
import { sql } from "drizzle-orm";
import { mkdtemp, writeFile, cp } from "node:fs/promises";
import os from "node:os";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeDb, getPool } from "@/db/client";
import { migrate } from "@/db/migrator";
import { agent, db, makeUser, resetData } from "./helpers";
import { createProspect } from "@/server/services/prospects";

beforeEach(resetData);

/** Drizzle envuelve el error de Postgres; el mensaje real está en `cause`. */
async function pgError(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (e) {
    const err = e as Error & { cause?: Error & { constraint?: string } };
    return [err.cause?.message, err.cause?.constraint, err.message].filter(Boolean).join(" | ");
  }
  throw new Error("Se esperaba que la base rechazara la operación, pero la aceptó.");
}
afterAll(closeDb);

describe("migrador", () => {
  it("es idempotente: una segunda corrida no aplica nada", async () => {
    const applied = await migrate(getPool(), path.resolve(import.meta.dirname, "../migrations"));
    expect(applied).toEqual([]);
  });

  it("se niega a correr si una migración aplicada fue editada", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "mig-"));
    await cp(path.resolve(import.meta.dirname, "../migrations"), dir, { recursive: true });
    await writeFile(path.join(dir, "0001_nucleo.sql"), "-- editada\nSELECT 1;");
    await expect(migrate(getPool(), dir)).rejects.toThrow(/fue modificada/);
  });
});

describe("registros inmutables", () => {
  it("no se puede editar ni borrar el historial del pipeline ni la auditoría", async () => {
    const owner = await makeUser();
    await createProspect(db(), owner, { name: "Empresa Uno", country: "AR" });
    const append = /solo agregado/;
    expect(await pgError(db().execute(sql`UPDATE pipeline_events SET reason = 'x'`))).toMatch(append);
    expect(await pgError(db().execute(sql`DELETE FROM pipeline_events`))).toMatch(append);
    expect(await pgError(db().execute(sql`UPDATE audit_log SET action = 'x'`))).toMatch(append);
    expect(await pgError(db().execute(sql`DELETE FROM audit_log`))).toMatch(append);
  });

  it("un prospecto con historial no se puede borrar físicamente (solo borrado lógico)", async () => {
    const owner = await makeUser();
    const p = await createProspect(db(), owner, { name: "Empresa Dos", country: "AR" });
    expect(await pgError(db().execute(sql`DELETE FROM prospects WHERE id = ${p.id}`))).toMatch(/solo agregado/);
  });
});

describe("restricciones de la base sobre hechos (defensa en profundidad)", () => {
  it("la base rechaza un dato verificado sin fuente, aunque se saltee la validación", async () => {
    const p = await createProspect(db(), agent, { name: "Empresa Tres", country: "AR" });
    const msg = await pgError(
      db().execute(sql`INSERT INTO prospect_facts
        (prospect_id, category, field, value, kind, verification, confidence, collected_by_type)
        VALUES (${p.id}, 'contact', 'Email', 'x@y.z', 'observed', 'verified', 90, 'agent')`),
    );
    expect(msg).toMatch(/verified_needs_source|observed_needs_source/);
  });

  it("la base rechaza una hipótesis marcada como verificada", async () => {
    const p = await createProspect(db(), agent, { name: "Empresa Cuatro", country: "AR" });
    const msg = await pgError(
      db().execute(sql`INSERT INTO prospect_facts
        (prospect_id, category, field, value, kind, verification, confidence, source_url, verified_at, collected_by_type)
        VALUES (${p.id}, 'business', 'Facturación', 'alta', 'hypothesis', 'verified', 90,
                'https://a.com', now(), 'agent')`),
    );
    expect(msg).toMatch(/inference_not_verified/);
  });
});
