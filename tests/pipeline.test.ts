import { describe, expect, it } from "vitest";
import {
  allowedTargets,
  canTransition,
  PIPELINE_STATUSES,
  STATUS_GROUP,
  STATUS_LABELS,
  TRANSITIONS,
} from "@/domain/pipeline";

const owner = { type: "user", role: "owner" } as const;
const operator = { type: "user", role: "operator" } as const;
const viewer = { type: "user", role: "viewer" } as const;
const agent = { type: "agent" } as const;

describe("pipeline: estructura", () => {
  it("tiene exactamente los 25 estados del documento maestro, en orden", () => {
    expect(PIPELINE_STATUSES).toHaveLength(25);
    expect(PIPELINE_STATUSES[0]).toBe("DISCOVERED");
    expect(PIPELINE_STATUSES[24]).toBe("CLOSED");
  });

  it("todo estado tiene etiqueta, grupo y transiciones hacia estados válidos", () => {
    for (const s of PIPELINE_STATUSES) {
      expect(STATUS_LABELS[s]).toBeTruthy();
      expect(STATUS_GROUP[s]).toBeTruthy();
      for (const t of TRANSITIONS[s]) expect(PIPELINE_STATUSES).toContain(t);
    }
  });

  it("todo estado en uso es alcanzable desde DISCOVERED; los de demo quedaron en desuso", () => {
    const seen = new Set(["DISCOVERED"]);
    const queue = ["DISCOVERED"] as (keyof typeof TRANSITIONS)[];
    while (queue.length) {
      for (const t of TRANSITIONS[queue.shift()!]) {
        if (!seen.has(t)) {
          seen.add(t);
          queue.push(t);
        }
      }
    }
    expect(seen.size).toBe(23);
    expect(seen.has("DEMO_GENERATING")).toBe(false);
    expect(seen.has("DEMO_READY")).toBe(false);
  });

  it("CLOSED es terminal", () => {
    expect(TRANSITIONS.CLOSED).toEqual([]);
  });
});

describe("pipeline: quién puede mover", () => {
  it("rechaza transiciones que no existen", () => {
    const r = canTransition("DISCOVERED", "DEPLOYED", owner);
    expect(r.ok).toBe(false);
  });

  it("rechaza quedarse en el mismo estado", () => {
    expect(canTransition("QA", "QA", owner).ok).toBe(false);
  });

  it("un agente avanza la prospección interna", () => {
    expect(canTransition("DISCOVERED", "RESEARCHING", agent).ok).toBe(true);
    expect(canTransition("AUDITED", "OUTREACH_READY", agent).ok).toBe(true);
    // Estados de demo en desuso: no se puede entrar, solo salir.
    expect(canTransition("AUDITED", "DEMO_GENERATING", owner).ok).toBe(false);
    expect(canTransition("DEMO_READY", "OUTREACH_READY", owner).ok).toBe(true);
  });

  it("un agente nunca marca un mensaje como enviado ni registra respuestas", () => {
    expect(canTransition("OUTREACH_READY", "SENT_MANUALLY", agent).ok).toBe(false);
    expect(canTransition("WAITING_RESPONSE", "REPLIED_POSITIVE", agent).ok).toBe(false);
    expect(canTransition("WAITING_RESPONSE", "REPLIED_NEGATIVE", agent).ok).toBe(false);
  });

  it("un agente nunca aprueba un proyecto ni publica", () => {
    expect(canTransition("PROPOSAL_SENT", "APPROVED", agent).ok).toBe(false);
    expect(canTransition("NEGOTIATION", "APPROVED", agent).ok).toBe(false);
    expect(canTransition("READY_TO_DEPLOY", "DEPLOYED", agent).ok).toBe(false);
  });

  it("un agente retoma la construcción tras aprobación o QA, pero no desde mantenimiento", () => {
    expect(canTransition("APPROVED", "BUILDING", agent).ok).toBe(true);
    expect(canTransition("QA", "BUILDING", agent).ok).toBe(true);
    expect(canTransition("MAINTENANCE", "BUILDING", agent).ok).toBe(false);
    expect(canTransition("CLIENT_REVIEW", "BUILDING", agent).ok).toBe(false);
  });

  it("solo el propietario aprueba proyectos, publica y reabre descartados", () => {
    expect(canTransition("PROPOSAL_SENT", "APPROVED", operator).ok).toBe(false);
    expect(canTransition("PROPOSAL_SENT", "APPROVED", owner).ok).toBe(true);
    expect(canTransition("READY_TO_DEPLOY", "DEPLOYED", operator).ok).toBe(false);
    expect(canTransition("REJECTED", "DISCOVERED", operator).ok).toBe(false);
    expect(canTransition("REJECTED", "DISCOVERED", owner).ok).toBe(true);
  });

  it("publicar exige además una aprobación registrada", () => {
    expect(canTransition("READY_TO_DEPLOY", "DEPLOYED", owner)).toEqual({
      ok: true,
      requiresApproval: "deploy_production",
    });
  });

  it("solo lectura no mueve nada", () => {
    for (const from of PIPELINE_STATUSES) expect(allowedTargets(from, viewer)).toEqual([]);
  });

  it("el sistema no mueve prospectos por su cuenta", () => {
    expect(canTransition("DISCOVERED", "RESEARCHING", { type: "system" }).ok).toBe(false);
  });

  it("allowedTargets respeta rol", () => {
    expect(allowedTargets("PROPOSAL_SENT", operator)).not.toContain("APPROVED");
    expect(allowedTargets("PROPOSAL_SENT", owner)).toContain("APPROVED");
  });
});
