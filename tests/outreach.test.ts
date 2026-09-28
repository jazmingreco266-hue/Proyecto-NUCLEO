import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { closeDb } from "@/db/client";
import { escapeHtml, generateOutreach, suggestChannel, type Sender } from "@/domain/outreach";
import { DEFAULT_SETTINGS } from "@/domain/validation";
import { generateMessages, listMessages, saveEditedMessages } from "@/server/services/outreach";
import { addFact, createProspect, transitionProspect } from "@/server/services/prospects";
import { updateSettings } from "@/server/services/settings";
import { agent, db, makeUser, resetData } from "./helpers";

const sender: Sender = { name: "Jazz", role: "Directora", email: "jazz@nucleo.test", phone: "+54 11 0000-0000", website: "https://nucleo-tau.vercel.app" };
const company = { name: "Estudio Ríos", city: "Córdoba", industry: "Estudio jurídico", country: "AR" };
const input = {
  positive: "tienen más de 20 años de trayectoria y reseñas muy buenas por la atención",
  opportunity: "El formulario de consultas no confirma el envío y el sitio no se adapta al celular",
  benefit: "resolverlo haría que más clientes consulten desde el teléfono sin tener que llamar",
  demoUrl: "",
  contactName: "",
};

describe("generador de mensajes (dominio)", () => {
  it("exige la firma antes de generar", () => {
    const r = generateOutreach(company, { ...sender, name: "", email: "" }, input, []);
    expect(r.ok).toBe(false);
  });

  it("usa exactamente lo investigado y no agrega datos de la empresa que no le dieron", () => {
    const r = generateOutreach(company, sender, input, []);
    if (!r.ok) throw new Error();
    const d = r.draft;
    expect(d.subjects).toHaveLength(3);
    expect(d.emailText).toContain("Estudio Ríos en Córdoba");
    expect(d.emailText).toContain("Tienen más de 20 años de trayectoria");
    expect(d.emailText).toContain("el formulario de consultas no confirma el envío");
    expect(d.emailText).toContain("Resolverlo haría que más clientes");
    // Sin demo cargada, no promete un enlace que no existe.
    expect(d.emailText).not.toMatch(/https?:\/\/(?!nucleo-tau)/);
    expect(d.emailText).toContain("no les vuelvo a escribir");
    expect(d.whatsappText.length).toBeLessThan(600);
  });

  it("incluye la demo solo si se la pasan, aclarando que no es oficial", () => {
    const r = generateOutreach(company, sender, { ...input, demoUrl: "https://demo.example/estudio" }, []);
    if (!r.ok) throw new Error();
    expect(r.draft.emailText).toContain("https://demo.example/estudio");
    expect(r.draft.emailText).toContain("no oficial y sin compromiso");
    expect(r.draft.emailHtml).toContain("Ver la propuesta");
  });

  it("escapa todo en el HTML y no incluye scripts", () => {
    const r = generateOutreach({ ...company, name: '<script>alert("x")</script>' }, sender, input, []);
    if (!r.ok) throw new Error();
    expect(r.draft.emailHtml).not.toContain("<script>");
    expect(r.draft.emailHtml).toContain("&lt;script&gt;");
    expect(escapeHtml(`"'<>&`)).toBe("&quot;&#39;&lt;&gt;&amp;");
  });

  it("sugiere el canal según los contactos cargados, priorizando los verificados", () => {
    expect(suggestChannel([]).channel).toBe("none");
    expect(
      suggestChannel([
        { field: "WhatsApp comercial", value: "+54 9 11 0000", verification: "probable" },
        { field: "Email", value: "info@estudio.example", verification: "verified" },
      ]).channel,
    ).toBe("email");
    expect(suggestChannel([{ field: "WhatsApp", value: "+54 9 11 0000", verification: "verified" }]).channel).toBe(
      "whatsapp",
    );
  });

  it("aclara que el horario es una sugerencia, no un dato medido", () => {
    const r = generateOutreach(company, sender, input, []);
    if (!r.ok) throw new Error();
    expect(r.draft.bestTime).toMatch(/Sugerencia general, no un dato medido/);
    expect(r.draft.bestTime).toContain("America/Argentina/Buenos_Aires");
  });
});

describe("mensajes guardados (integración)", () => {
  beforeEach(resetData);
  afterAll(closeDb);

  async function setup() {
    const owner = await makeUser();
    await updateSettings(db(), owner, { ...DEFAULT_SETTINGS, sender }, 0);
    const p = await createProspect(db(), owner, { name: "Estudio Ríos", country: "AR", city: "Córdoba" });
    await addFact(db(), owner, {
      prospectId: p.id,
      category: "contact",
      field: "Email comercial",
      value: "info@estudio-rios.example",
      kind: "observed",
      verification: "verified",
      confidence: 90,
      sourceName: "Página de contacto",
      sourceUrl: "https://estudio-rios.example/contacto",
    });
    return { owner, p };
  }

  it("cada guardado crea una versión nueva y la anterior queda intacta", async () => {
    const { owner, p } = await setup();
    const v1 = await generateMessages(db(), owner, p.id, input);
    expect(v1.version).toBe(1);
    expect(v1.suggestedChannel).toBe("email");
    const v2 = await saveEditedMessages(db(), owner, p.id, {
      subject1: "Asunto editado",
      subject2: v1.subjects[1],
      subject3: v1.subjects[2],
      emailText: "Hola, equipo.\n\nPárrafo editado a mano.\n\nSaludos, Jazz",
      whatsappText: v1.whatsappText,
      formText: v1.formText,
      socialText: v1.socialText,
      basedOnVersion: 1,
    });
    expect(v2.version).toBe(2);
    expect(v2.emailHtml).toContain("Párrafo editado a mano.");
    const all = await listMessages(db(), owner, p.id);
    expect(all.map((m) => m.version)).toEqual([2, 1]);
    expect(all[1]!.emailText).toBe(v1.emailText);
  });

  it("la base no deja editar ni borrar el contenido de una versión", async () => {
    const { owner, p } = await setup();
    await generateMessages(db(), owner, p.id, input);
    const err = await db()
      .execute(sql`UPDATE outreach_messages SET email_text = 'cambiado'`)
      .then(() => "")
      .catch((e: Error & { cause?: Error }) => e.cause?.message ?? e.message);
    expect(err).toMatch(/no se edita/);
    const err2 = await db()
      .execute(sql`DELETE FROM outreach_messages`)
      .then(() => "")
      .catch((e: Error & { cause?: Error }) => e.cause?.message ?? e.message);
    expect(err2).toMatch(/no se borran/);
  });

  it("al marcar como enviado, la última versión queda registrada como enviada", async () => {
    const { owner, p } = await setup();
    await generateMessages(db(), owner, p.id, input);
    let cur = p;
    for (const to of ["RESEARCHING", "QUALIFIED", "AUDITED", "DEMO_GENERATING", "DEMO_READY", "OUTREACH_READY", "SENT_MANUALLY"] as const) {
      cur = await transitionProspect(db(), owner, { prospectId: p.id, to, reason: `Paso a ${to}`, expectedVersion: cur.version });
    }
    const [m] = await listMessages(db(), owner, p.id);
    expect(m!.status).toBe("sent");
    expect(m!.sentAt).not.toBeNull();
  });

  it("solo lectura no prepara mensajes; un agente sí puede", async () => {
    const { p } = await setup();
    const viewer = await makeUser("viewer");
    await expect(generateMessages(db(), viewer, p.id, input)).rejects.toThrow();
    const byAgent = await generateMessages(db(), agent, p.id, input);
    expect(byAgent.createdByType).toBe("agent");
  });
});
