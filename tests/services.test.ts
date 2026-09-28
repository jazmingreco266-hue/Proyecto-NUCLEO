import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeDb } from "@/db/client";
import { ForbiddenError } from "@/domain/permissions";
import { decideApproval, listApprovals, requestApproval } from "@/server/services/approvals";
import { getOverview } from "@/server/services/dashboard";
import {
  addFact,
  addNote,
  createProspect,
  getProspect,
  listEvents,
  listProspects,
  setPaused,
  transitionProspect,
} from "@/server/services/prospects";
import { getSettings, updateSettings } from "@/server/services/settings";
import { DEFAULT_SETTINGS } from "@/domain/validation";
import type { PipelineStatus } from "@/domain/pipeline";
import type { Principal } from "@/server/principal";
import { agent, db, makeUser, resetData } from "./helpers";

beforeEach(resetData);
afterAll(closeDb);

async function walk(who: Principal, id: string, steps: PipelineStatus[]) {
  let { p } = await getProspect(db(), who, id);
  for (const to of steps) {
    p = await transitionProspect(db(), who, { prospectId: id, to, reason: `Paso a ${to}`, expectedVersion: p.version });
  }
  return p;
}

describe("prospectos: alta y deduplicación", () => {
  it("crea el prospecto con su primer evento y registro de auditoría", async () => {
    const owner = await makeUser();
    const p = await createProspect(db(), owner, {
      name: "Librería Centro",
      country: "ar",
      websiteUrl: "www.libreria-centro.com.ar",
    });
    expect(p.status).toBe("DISCOVERED");
    expect(p.country).toBe("AR");
    expect(p.websiteDomain).toBe("libreria-centro.com.ar");
    const events = await listEvents(db(), owner, p.id);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ toStatus: "DISCOVERED", actorType: "user" });
  });

  it("no permite dos prospectos con el mismo dominio", async () => {
    const owner = await makeUser();
    await createProspect(db(), owner, { name: "Tienda Uno", country: "AR", websiteUrl: "https://tienda.com" });
    await expect(
      createProspect(db(), agent, { name: "Tienda Uno bis", country: "AR", websiteUrl: "http://www.tienda.com/inicio" }),
    ).rejects.toThrow(/Ya existe un prospecto con el dominio tienda\.com/);
  });

  it("solo lectura no puede crear", async () => {
    const viewer = await makeUser("viewer");
    await expect(createProspect(db(), viewer, { name: "Lectura SA", country: "AR" })).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("valida país y URL", async () => {
    const owner = await makeUser();
    await expect(createProspect(db(), owner, { name: "País Raro", country: "ZZ" })).rejects.toThrow(/país/);
    await expect(
      createProspect(db(), owner, { name: "Host Local", country: "AR", websiteUrl: "http://localhost" }),
    ).rejects.toThrow(/dominio público/);
  });
});

describe("prospectos: pipeline", () => {
  it("guarda cada cambio con motivo, actor y resultado", async () => {
    const p = await createProspect(db(), agent, { name: "Hotel Sierra", country: "AR" });
    const moved = await walk(agent, p.id, ["RESEARCHING", "QUALIFIED"]);
    expect(moved.status).toBe("QUALIFIED");
    expect(moved.version).toBe(3);
    const events = await listEvents(db(), agent, p.id);
    expect(events.map((e) => e.toStatus)).toEqual(["QUALIFIED", "RESEARCHING", "DISCOVERED"]);
    expect(events[0]).toMatchObject({
      fromStatus: "RESEARCHING",
      actorType: "agent",
      actorLabel: "Agente test",
      reason: "Paso a QUALIFIED",
    });
  });

  it("detecta ediciones simultáneas (control de versión)", async () => {
    const p = await createProspect(db(), agent, { name: "Taller Oeste", country: "AR" });
    await transitionProspect(db(), agent, { prospectId: p.id, to: "RESEARCHING", reason: "Primer cambio", expectedVersion: 1 });
    await expect(
      transitionProspect(db(), agent, { prospectId: p.id, to: "REJECTED", reason: "Segundo cambio", expectedVersion: 1 }),
    ).rejects.toThrow(/Alguien más modificó/);
  });

  it("exige motivo", async () => {
    const p = await createProspect(db(), agent, { name: "Sin motivo", country: "AR" });
    await expect(
      transitionProspect(db(), agent, { prospectId: p.id, to: "RESEARCHING", reason: " ", expectedVersion: 1 }),
    ).rejects.toThrow(/motivo/);
  });

  it("un agente no puede marcar como enviado", async () => {
    const owner = await makeUser();
    const p = await createProspect(db(), agent, { name: "Óptica Mar", country: "AR" });
    const ready = await walk(agent, p.id, [
      "RESEARCHING",
      "QUALIFIED",
      "AUDITED",
      "DEMO_GENERATING",
      "DEMO_READY",
      "OUTREACH_READY",
    ]);
    await expect(
      transitionProspect(db(), agent, { prospectId: p.id, to: "SENT_MANUALLY", reason: "Intento del agente", expectedVersion: ready.version }),
    ).rejects.toThrow(/Solo una persona/);
    const sent = await transitionProspect(db(), owner, {
      prospectId: p.id,
      to: "SENT_MANUALLY",
      reason: "Enviado por email",
      expectedVersion: ready.version,
    });
    expect(sent.status).toBe("SENT_MANUALLY");
  });

  it("un agente no puede mover un prospecto pausado; una persona sí", async () => {
    const owner = await makeUser();
    const p = await createProspect(db(), agent, { name: "Pausada SA", country: "AR" });
    const paused = await setPaused(db(), owner, { prospectId: p.id, paused: true, reason: "Esperar", expectedVersion: 1 });
    await expect(
      transitionProspect(db(), agent, { prospectId: p.id, to: "RESEARCHING", reason: "Intento del agente", expectedVersion: paused.version }),
    ).rejects.toThrow(/pausado/);
    const moved = await transitionProspect(db(), owner, {
      prospectId: p.id,
      to: "RESEARCHING",
      reason: "Decisión manual",
      expectedVersion: paused.version,
    });
    expect(moved.status).toBe("RESEARCHING");
  });

  it("publicar en producción exige una aprobación aprobada, y la consume", async () => {
    const owner = await makeUser();
    const p = await createProspect(db(), owner, { name: "Deploy SRL", country: "AR" });
    const ready = await walk(owner, p.id, [
      "RESEARCHING", "QUALIFIED", "AUDITED", "DEMO_GENERATING", "DEMO_READY", "OUTREACH_READY",
      "SENT_MANUALLY", "WAITING_RESPONSE", "REPLIED_POSITIVE", "PROPOSAL_SENT", "APPROVED",
      "BUILDING", "STAGING", "QA", "READY_TO_DEPLOY",
    ]);
    await expect(
      transitionProspect(db(), owner, { prospectId: p.id, to: "DEPLOYED", reason: "Sin aprobación", expectedVersion: ready.version }),
    ).rejects.toThrow(/aprobación de publicación/);

    const ap = await requestApproval(db(), agent, {
      action: "deploy_production",
      prospectId: p.id,
      summary: "Publicar versión 1 del sitio",
    });
    await decideApproval(db(), owner, { approvalId: ap.id, decision: "approve" });
    const deployed = await transitionProspect(db(), owner, {
      prospectId: p.id,
      to: "DEPLOYED",
      reason: "Aprobado",
      expectedVersion: ready.version,
    });
    expect(deployed.status).toBe("DEPLOYED");
    const [used] = (await listApprovals(db(), owner, "resolved")).filter((r) => r.a.id === ap.id);
    expect(used!.a.status).toBe("executed");
  });
});

describe("hechos y notas", () => {
  it("un dato verificado actualiza la fecha de última verificación", async () => {
    const p = await createProspect(db(), agent, { name: "Datos SA", country: "AR" });
    expect(p.lastVerifiedAt).toBeNull();
    await addFact(db(), agent, {
      prospectId: p.id,
      category: "contact",
      field: "Teléfono comercial",
      value: "+54 11 0000-0000",
      kind: "observed",
      verification: "verified",
      confidence: 95,
      sourceName: "Sitio oficial",
      sourceUrl: "https://datos.example/contacto",
    });
    const { p: after } = await getProspect(db(), agent, p.id);
    expect(after.lastVerifiedAt).not.toBeNull();
  });

  it("los agentes no escriben notas; las personas sí", async () => {
    const op = await makeUser("operator");
    const p = await createProspect(db(), agent, { name: "Notas SA", country: "AR" });
    await expect(addNote(db(), agent, p.id, "hola")).rejects.toThrow();
    const n = await addNote(db(), op, p.id, "Llamar el lunes");
    expect(n.body).toBe("Llamar el lunes");
  });
});

describe("listado", () => {
  it("filtra, busca sin inyección y cuenta el total", async () => {
    const owner = await makeUser();
    await createProspect(db(), owner, { name: "Café 100% Puro", country: "AR", industry: "Gastronomía" });
    await createProspect(db(), owner, { name: "Bodega Andes", country: "CL", industry: "Vinos" });
    const all = await listProspects(db(), owner, {});
    expect(all.total).toBe(2);
    expect((await listProspects(db(), owner, { country: "CL" })).rows.map((r) => r.p.name)).toEqual(["Bodega Andes"]);
    // "%" debe buscarse literal, no como comodín.
    expect((await listProspects(db(), owner, { q: "100%" })).total).toBe(1);
    expect((await listProspects(db(), owner, { q: "%" })).total).toBe(1);
    expect((await listProspects(db(), owner, { q: "'; DROP TABLE prospects; --" })).total).toBe(0);
    // Filtros inválidos no rompen: se ignoran.
    expect((await listProspects(db(), owner, { status: "INVENTADO" })).total).toBe(2);
  });
});

describe("aprobaciones", () => {
  it("un operador no decide", async () => {
    const op = await makeUser("operator");
    const ap = await requestApproval(db(), op, { action: "send_email", summary: "Enviar propuesta" });
    await expect(decideApproval(db(), op, { approvalId: ap.id, decision: "approve" })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("borrar datos de producción necesita dos propietarios distintos", async () => {
    const o1 = await makeUser("owner");
    const o2 = await makeUser("owner");
    const ap = await requestApproval(db(), agent, { action: "delete_production_data", summary: "Borrar tabla vieja" });
    expect(ap.requiredApprovals).toBe(2);
    expect(await decideApproval(db(), o1, { approvalId: ap.id, decision: "approve" })).toEqual({ status: "pending" });
    await expect(decideApproval(db(), o1, { approvalId: ap.id, decision: "approve" })).rejects.toThrow(/Ya registraste/);
    expect(await decideApproval(db(), o2, { approvalId: ap.id, decision: "approve" })).toEqual({ status: "approved" });
  });

  it("rechazar exige nota", async () => {
    const owner = await makeUser();
    const ap = await requestApproval(db(), agent, { action: "buy_domain", summary: "Comprar dominio" });
    await expect(decideApproval(db(), owner, { approvalId: ap.id, decision: "reject" })).rejects.toThrow(/nota/);
    expect(await decideApproval(db(), owner, { approvalId: ap.id, decision: "reject", note: "Muy caro" })).toEqual({
      status: "rejected",
    });
  });

  it("una solicitud resuelta no se puede volver a decidir", async () => {
    const o1 = await makeUser("owner");
    const o2 = await makeUser("owner");
    const ap = await requestApproval(db(), agent, { action: "change_dns", summary: "Apuntar DNS" });
    await decideApproval(db(), o1, { approvalId: ap.id, decision: "approve" });
    await expect(decideApproval(db(), o2, { approvalId: ap.id, decision: "reject", note: "Ya no hace falta" })).rejects.toThrow(
      /ya fue resuelta/,
    );
  });
});

describe("configuración", () => {
  it("parte de valores conservadores, guarda versiones y detecta conflictos", async () => {
    const owner = await makeUser();
    const s0 = await getSettings(db(), owner);
    expect(s0.version).toBe(0);
    expect(s0.data.autonomy).toBe("manual");

    await updateSettings(db(), owner, { ...DEFAULT_SETTINGS, maxLeadsPerDay: 50 }, 0);
    const s1 = await getSettings(db(), owner);
    expect(s1.version).toBe(1);
    expect(s1.data.maxLeadsPerDay).toBe(50);

    await expect(updateSettings(db(), owner, DEFAULT_SETTINGS, 0)).rejects.toThrow(/cambió/);
    const h = await db().execute(sql`SELECT count(*)::int AS n FROM settings_history`);
    expect(h.rows[0]).toEqual({ n: 1 });
  });

  it("un operador no cambia la configuración", async () => {
    const op = await makeUser("operator");
    await expect(updateSettings(db(), op, DEFAULT_SETTINGS, 0)).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("vista general", () => {
  it("cuenta datos reales y excluye los de ejemplo", async () => {
    const owner = await makeUser();
    const real = await createProspect(db(), owner, {
      name: "Real SA",
      country: "AR",
      currency: "ARS",
      estimatedValue: 1000,
    });
    await createProspect(db(), owner, { name: "Ejemplo SA", country: "AR", currency: "ARS", estimatedValue: 99999 }, { isSample: true });
    await walk(agent, real.id, ["RESEARCHING", "QUALIFIED"]);

    const o = await getOverview(db(), owner);
    expect(o.totalProspects).toBe(1);
    expect(o.sampleProspects).toBe(1);
    expect(o.foundToday).toBe(1);
    expect(o.qualified).toBe(1);
    expect(o.demosGenerated).toBe(0);
    expect(o.potentialRevenue).toEqual([{ currency: "ARS", amount: 1000 }]);
    expect(o.confirmedRevenue).toEqual([]);
  });
});
