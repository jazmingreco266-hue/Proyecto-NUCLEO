import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeDb } from "@/db/client";
import { buildOutreach, improvementsFrom } from "@/domain/outreach";
import type { Check } from "@/domain/site-audit";
import { ForbiddenError } from "@/domain/permissions";
import { latestMessages, prepareMessages } from "@/server/services/outreach";
import { addFact, createProspect, getProspect, transitionProspect } from "@/server/services/prospects";
import { getSettings, updateSettings } from "@/server/services/settings";
import { db, makeUser, resetData } from "./helpers";

beforeEach(resetData);
afterAll(closeDb);

const checks: Check[] = [
  { id: "viewport", category: "movil", label: "", status: "fail", detail: "", weight: 3 },
  { id: "cta", category: "conversion", label: "", status: "warn", detail: "", weight: 2 },
  { id: "https", category: "seguridad", label: "", status: "fail", detail: "", weight: 3 },
  { id: "hsts", category: "seguridad", label: "", status: "warn", detail: "", weight: 1 },
];
const sender = { agencyName: "Núcleo", senderName: "Jaz", replyEmail: "hola@nucleo.test", whatsapp: "", website: "" };

describe("mensajes: armado", () => {
  it("tres mejoras como beneficios, primero lo más importante", () => {
    expect(improvementsFrom(checks)).toEqual([
      "que el sitio se adapte bien al celular",
      "sumar conexión segura (HTTPS), para que el navegador no muestre el aviso de «No seguro»",
      "botones claros para consultar o pedir presupuesto",
    ]);
  });

  it("no inventa un elogio ni menciona demos: si falta un dato, avisa", () => {
    const m = buildOutreach({ businessName: "Sol", country: "AR", facts: [], auditChecks: checks, sender, allowedChannels: ["email"] });
    expect(m.positive).toBeNull();
    expect(m.warnings.join()).toMatch(/dato observado positivo/);
    expect(m.channel.suggested).toBe("ninguno");
    for (const t of [m.emailText, m.emailHtml, m.whatsapp, m.form, m.social]) {
      expect(t).not.toMatch(/demo|boceto|https?:\/\//i);
      expect(t).not.toMatch(/urgente|última oportunidad|garantizado/i);
    }
    expect(m.emailText).toContain("propuesta concreta, sin compromiso");
  });

  it("usa el dato real, escapa el HTML y sugiere el canal disponible", () => {
    const m = buildOutreach({
      businessName: `Sol <b>`,
      country: "AR",
      facts: [
        { category: "business", field: "Antigüedad", value: "Desde 1985", kind: "observed" },
        { category: "contact", field: "WhatsApp", value: "https://wa.me/549341", kind: "observed" },
      ],
      auditChecks: checks,
      sender,
      allowedChannels: ["email", "whatsapp"],
    });
    expect(m.positive).toBe("Desde 1985");
    expect(m.channel.suggested).toBe("whatsapp");
    expect(m.emailHtml).toContain("Sol &lt;b&gt;");
    expect(m.emailHtml).not.toMatch(/<script/i);
    expect(m.subjects).toHaveLength(3);
    expect(m.form).toMatch(/^Hola, soy Jaz/);
    expect(m.bestTime.basis).toMatch(/No es un dato medido/);
  });
});

describe("mensajes: servicio", () => {
  async function audited(owner: Awaited<ReturnType<typeof makeUser>>) {
    const p = await createProspect(db(), owner, { name: "Panadería Sol", country: "AR", websiteUrl: "https://sol.test/" });
    let cur = p;
    for (const to of ["RESEARCHING", "QUALIFIED", "AUDITED"] as const) {
      cur = await transitionProspect(db(), owner, { prospectId: p.id, to, reason: "Paso de prueba", expectedVersion: cur.version });
    }
    return cur;
  }

  it("prepara versiones, pasa de Auditado a Mensaje listo y no se pueden editar", async () => {
    const owner = await makeUser();
    const s = await getSettings(db(), owner);
    await updateSettings(db(), owner, { ...s.data, sender: { ...s.data.sender, senderName: "Jaz", replyEmail: "hola@nucleo.test" } }, s.version);
    const p = await audited(owner);
    await addFact(db(), owner, { prospectId: p.id, category: "contact", field: "Email", value: "info@sol.test", kind: "observed", verification: "verified", confidence: 90, sourceUrl: "https://sol.test/" });

    const m1 = await prepareMessages(db(), owner, p.id);
    expect(m1.version).toBe(1);
    expect((await getProspect(db(), owner, p.id)).p.status).toBe("OUTREACH_READY");
    const m2 = await prepareMessages(db(), owner, p.id);
    expect(m2.version).toBe(2);
    const last = (await latestMessages(db(), owner, p.id))!;
    expect(last.id).toBe(m2.id);
    expect(last.content.channel.suggested).toBe("email");
    expect(last.content.emailText).toContain("Soy Jaz, de Núcleo.");

    const cause = (e: unknown) => String((e as { cause?: Error }).cause?.message ?? e);
    await expect(db().execute(sql`UPDATE outreach_messages SET version = 9`).catch((e) => { throw new Error(cause(e)); })).rejects.toThrow(/solo agregado/);
  });

  it("permisos", async () => {
    const owner = await makeUser();
    const viewer = await makeUser("viewer");
    const p = await audited(owner);
    await expect(prepareMessages(db(), viewer, p.id)).rejects.toBeInstanceOf(ForbiddenError);
  });
});
