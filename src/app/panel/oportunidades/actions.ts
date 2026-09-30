"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { currentPrincipal } from "@/server/auth/current";
import { publicMessage } from "@/server/principal";
import { processNow } from "@/agents/orchestrator";
import { requestAudit } from "@/server/services/audits";
import { requestResearch } from "@/server/services/research";
import { prepareMessages } from "@/server/services/outreach";
import { buildSite, requestSiteCopy, saveBrief, uploadBrandAsset } from "@/server/services/site";
import { agentRuns } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  addFact,
  addNote,
  createProspect,
  removeFact,
  setPaused,
  transitionProspect,
} from "@/server/services/prospects";

export type ActionState = { error?: string; ok?: string; values?: Record<string, string> };

async function me() {
  const p = await currentPrincipal();
  if (!p) redirect("/login");
  return p;
}

function str(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === "string" ? v : "";
}

function formValues(form: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string" && !k.startsWith("$")) out[k] = v.slice(0, 4000);
  return out;
}

function logUnexpected(err: unknown) {
  if (!(err instanceof Error) || !["UserFacingError", "NotFoundError", "ConflictError", "ForbiddenError"].includes(err.name)) {
    console.error("[accion]", err);
  }
}

export async function createProspectAction(_: ActionState, form: FormData): Promise<ActionState> {
  const who = await me();
  let id: string;
  try {
    const p = await createProspect(getDb(), who, {
      name: str(form, "name"),
      legalName: str(form, "legalName"),
      country: str(form, "country"),
      region: str(form, "region"),
      city: str(form, "city"),
      language: str(form, "language"),
      industry: str(form, "industry"),
      websiteUrl: str(form, "websiteUrl"),
      currency: str(form, "currency"),
      estimatedValue: str(form, "estimatedValue") === "" ? null : str(form, "estimatedValue"),
    });
    id = p.id;
  } catch (err) {
    logUnexpected(err);
    return { error: publicMessage(err), values: formValues(form) };
  }
  revalidatePath("/panel", "layout");
  redirect(`/panel/oportunidades/${id}?tab=investigacion&nuevo=1`);
}

export async function transitionAction(_: ActionState, form: FormData): Promise<ActionState> {
  const who = await me();
  const prospectId = str(form, "prospectId");
  try {
    await transitionProspect(getDb(), who, {
      prospectId,
      to: str(form, "to"),
      reason: str(form, "reason"),
      nextStep: str(form, "nextStep"),
      expectedVersion: str(form, "version"),
    });
  } catch (err) {
    logUnexpected(err);
    return { error: publicMessage(err), values: formValues(form) };
  }
  revalidatePath("/panel", "layout");
  return { ok: "Estado actualizado." };
}

export async function pauseAction(_: ActionState, form: FormData): Promise<ActionState> {
  const who = await me();
  try {
    await setPaused(getDb(), who, {
      prospectId: str(form, "prospectId"),
      paused: str(form, "paused") === "true",
      reason: str(form, "reason"),
      expectedVersion: Number(str(form, "version")),
    });
  } catch (err) {
    logUnexpected(err);
    return { error: publicMessage(err) };
  }
  revalidatePath("/panel", "layout");
  return { ok: str(form, "paused") === "true" ? "Prospecto pausado." : "Prospecto reanudado." };
}

export async function addFactAction(_: ActionState, form: FormData): Promise<ActionState> {
  const who = await me();
  try {
    await addFact(getDb(), who, {
      prospectId: str(form, "prospectId"),
      category: str(form, "category"),
      field: str(form, "field"),
      value: str(form, "value"),
      kind: str(form, "kind"),
      verification: str(form, "verification"),
      confidence: str(form, "confidence"),
      sourceName: str(form, "sourceName"),
      sourceUrl: str(form, "sourceUrl"),
    });
  } catch (err) {
    logUnexpected(err);
    return { error: publicMessage(err), values: formValues(form) };
  }
  revalidatePath("/panel", "layout");
  return { ok: "Dato guardado con su fuente." };
}

export async function removeFactAction(_: ActionState, form: FormData): Promise<ActionState> {
  const who = await me();
  try {
    await removeFact(getDb(), who, str(form, "factId"), str(form, "reason"));
  } catch (err) {
    logUnexpected(err);
    return { error: publicMessage(err) };
  }
  revalidatePath("/panel", "layout");
  return { ok: "Dato retirado. Queda en el registro de actividad." };
}

export async function addNoteAction(_: ActionState, form: FormData): Promise<ActionState> {
  const who = await me();
  try {
    await addNote(getDb(), who, str(form, "prospectId"), str(form, "body"));
  } catch (err) {
    logUnexpected(err);
    return { error: publicMessage(err), values: formValues(form) };
  }
  revalidatePath("/panel", "layout");
  return { ok: "Nota guardada." };
}

export async function requestAuditAction(_: ActionState, form: FormData): Promise<ActionState> {
  const who = await me();
  const db = getDb();
  let message: string;
  try {
    const { run, created } = await requestAudit(db, who, str(form, "prospectId"));
    if (!created) {
      message = "Ya hay una auditoría en curso para este prospecto.";
    } else {
      // Se ejecuta al momento. Si falla, queda en la cola con sus reintentos.
      const status = await processNow(db, run.id);
      message =
        status === "succeeded"
          ? "Auditoría completada."
          : status === "blocked"
            ? "La auditoría quedó bloqueada. El motivo figura abajo."
            : status === "failed"
              ? "La auditoría falló. El detalle figura en Tareas."
              : "El sitio no respondió. La auditoría quedó en cola para reintentar.";
    }
  } catch (err) {
    logUnexpected(err);
    return { error: publicMessage(err) };
  }
  revalidatePath("/panel", "layout");
  return { ok: message };
}

export async function requestResearchAction(_: ActionState, form: FormData): Promise<ActionState> {
  const who = await me();
  const db = getDb();
  let message: string;
  try {
    const { run, created } = await requestResearch(db, who, str(form, "prospectId"));
    if (!created) {
      message = "Ya hay una investigación en curso para este prospecto.";
    } else {
      const status = await processNow(db, run.id);
      message =
        status === "succeeded"
          ? "Investigación completada. Revisá los datos nuevos: quedan como probables hasta que los confirmes."
          : status === "blocked"
            ? "La investigación quedó bloqueada. El motivo figura abajo."
            : status === "failed"
              ? "La investigación falló. El detalle figura en Tareas."
              : "No se pudo completar ahora. Quedó en cola para reintentar.";
    }
  } catch (err) {
    logUnexpected(err);
    return { error: publicMessage(err) };
  }
  revalidatePath("/panel", "layout");
  return { ok: message };
}

// ─────────────────────────── Mensajes ───────────────────────────

export async function prepareMessagesAction(_: ActionState, form: FormData): Promise<ActionState> {
  const who = await me();
  try {
    const m = await prepareMessages(getDb(), who, str(form, "prospectId"));
    revalidatePath("/panel", "layout");
    return { ok: `Mensajes v${m.version} preparados. Revisalos antes de enviar.` };
  } catch (err) {
    logUnexpected(err);
    return { error: publicMessage(err) };
  }
}

// ─────────────────────────── Sitio web del cliente ───────────────────────────

export async function uploadBrandAssetAction(_: ActionState, form: FormData): Promise<ActionState> {
  const who = await me();
  const file = form.get("archivo");
  if (!(file instanceof File) || file.size === 0) return { error: "Elegí un archivo." };
  try {
    await uploadBrandAsset(getDb(), who, {
      prospectId: str(form, "prospectId"),
      kind: str(form, "kind") === "foto" ? "foto" : "logo",
      bytes: new Uint8Array(await file.arrayBuffer()),
      alt: str(form, "alt"),
    });
  } catch (err) {
    logUnexpected(err);
    return { error: publicMessage(err) };
  }
  revalidatePath("/panel", "layout");
  return { ok: "Imagen guardada." };
}

export async function saveBriefAction(_: ActionState, form: FormData): Promise<ActionState> {
  const who = await me();
  let data: unknown;
  try {
    data = JSON.parse(str(form, "brief"));
  } catch {
    return { error: "No se pudo leer la ficha. Recargá la página." };
  }
  let b;
  try {
    b = await saveBrief(getDb(), who, data);
  } catch (err) {
    logUnexpected(err);
    return { error: publicMessage(err) };
  }
  revalidatePath("/panel", "layout");
  // El editor se vuelve a montar con la versión nueva: el aviso se muestra desde la página.
  redirect(`/panel/oportunidades/${b.prospectId}?tab=sitio&ficha=${b.version}#t-ficha`);
}

export async function buildSiteAction(_: ActionState, form: FormData): Promise<ActionState> {
  const who = await me();
  try {
    const b = await buildSite(getDb(), who, str(form, "prospectId"));
    revalidatePath("/panel", "layout");
    return b.ready
      ? { ok: `Sitio v${b.version} generado y aprobado por el control de calidad.` }
      : { error: `Sitio v${b.version} generado, pero no pasó el control de calidad. Corregí lo marcado en la ficha y generá otra versión.` };
  } catch (err) {
    logUnexpected(err);
    return { error: publicMessage(err) };
  }
}

export async function requestSiteCopyAction(_: ActionState, form: FormData): Promise<ActionState> {
  const who = await me();
  const db = getDb();
  let message: string;
  try {
    const { run, created } = await requestSiteCopy(db, who, str(form, "prospectId"));
    if (!created) {
      message = "Ya hay una redacción en curso para este cliente.";
    } else {
      const status = await processNow(db, run.id);
      if (status === "succeeded") message = "Textos pulidos: se guardaron como una ficha nueva. Revisalos antes de generar el sitio.";
      else if (status === "blocked" || status === "failed") {
        const [r] = await db.select({ error: agentRuns.error }).from(agentRuns).where(eq(agentRuns.id, run.id));
        return { error: r?.error ?? "La redacción no se pudo completar." };
      } else message = "No se pudo completar ahora. Quedó en cola para reintentar.";
    }
  } catch (err) {
    logUnexpected(err);
    return { error: publicMessage(err) };
  }
  revalidatePath("/panel", "layout");
  return { ok: message };
}
