"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { AUTONOMY_LEVELS, CHANNELS } from "@/domain/validation";
import { parseAmount } from "@/domain/finance";
import { currentPrincipal } from "@/server/auth/current";
import { publicMessage } from "@/server/principal";
import { decideApproval } from "@/server/services/approvals";
import { updateSettings } from "@/server/services/settings";
import { createUser, setUserActive } from "@/server/services/users";
import type { ActionState } from "./oportunidades/actions";

async function me() {
  const p = await currentPrincipal();
  if (!p) redirect("/login");
  return p;
}
const s = (f: FormData, k: string) => (typeof f.get(k) === "string" ? (f.get(k) as string) : "");
const list = (f: FormData, k: string) =>
  s(f, k)
    .split(/[\n,]/)
    .map((x) => x.trim())
    .filter(Boolean);

export async function decideApprovalAction(_: ActionState, form: FormData): Promise<ActionState> {
  const who = await me();
  const decision = s(form, "decision") === "approve" ? "approve" : "reject";
  try {
    const r = await decideApproval(getDb(), who, {
      approvalId: s(form, "approvalId"),
      decision,
      note: s(form, "note"),
    });
    revalidatePath("/panel", "layout");
    return {
      ok:
        r.status === "pending"
          ? "Decisión registrada. Falta la aprobación de otra persona."
          : r.status === "approved"
            ? "Aprobado."
            : "Rechazado.",
    };
  } catch (err) {
    return { error: publicMessage(err) };
  }
}

export async function saveSettingsAction(_: ActionState, form: FormData): Promise<ActionState> {
  const who = await me();
  const autonomy = s(form, "autonomy");
  const data = {
    countries: list(form, "countries").map((c) => c.toUpperCase()),
    cities: list(form, "cities"),
    industries: list(form, "industries"),
    languages: list(form, "languages"),
    maxLeadsPerDay: s(form, "maxLeadsPerDay"),
    minOpportunityScore: s(form, "minOpportunityScore"),
    apiBudgetUsdMonthly: s(form, "apiBudgetUsdMonthly"),
    schedule: {
      timezone: s(form, "timezone"),
      startHour: s(form, "startHour"),
      endHour: s(form, "endHour"),
      weekdays: form.getAll("weekdays").map(String),
    },
    allowedSources: list(form, "allowedSources"),
    blockedSources: list(form, "blockedSources"),
    autonomy: (AUTONOMY_LEVELS as readonly string[]).includes(autonomy) ? autonomy : "manual",
    channels: form.getAll("channels").map(String).filter((c) => (CHANNELS as readonly string[]).includes(c)),
    discard: {
      requirePublicContact: form.get("requirePublicContact") === "on",
      skipIfSiteScoreAbove: s(form, "skipIfSiteScoreAbove"),
      excludedIndustries: list(form, "excludedIndustries"),
    },
    pricing: {
      currency: s(form, "pricingCurrency"),
      taxPct: s(form, "pricingTaxPct"),
      items: list(form, "pricingItems").map((l) => {
        const [name, price, kind] = l.split("|").map((x) => x.trim());
        return { name: name ?? "", price: parseAmount(price ?? ""), recurring: /^mensual/i.test(kind ?? "") };
      }),
    },
    sender: {
      agencyName: s(form, "agencyName"),
      senderName: s(form, "senderName"),
      replyEmail: s(form, "replyEmail"),
      whatsapp: s(form, "senderWhatsapp"),
      website: s(form, "senderWebsite"),
    },
  };
  try {
    await updateSettings(getDb(), who, data, Number(s(form, "version")));
  } catch (err) {
    return { error: publicMessage(err) };
  }
  revalidatePath("/panel", "layout");
  // El formulario se vuelve a montar con la versión nueva, así que el aviso lo muestra la página.
  redirect("/panel/configuracion?guardado=1");
}

export async function createUserAction(_: ActionState, form: FormData): Promise<ActionState> {
  const who = await me();
  try {
    const u = await createUser(getDb(), who, {
      email: s(form, "email"),
      name: s(form, "name"),
      role: s(form, "role"),
      password: s(form, "password"),
    });
    revalidatePath("/panel/usuarios");
    return { ok: `Usuario creado: ${u.email}. Pasale la contraseña por un canal privado.` };
  } catch (err) {
    return { error: publicMessage(err), values: { email: s(form, "email"), name: s(form, "name"), role: s(form, "role") } };
  }
}

export async function toggleUserAction(_: ActionState, form: FormData): Promise<ActionState> {
  const who = await me();
  try {
    await setUserActive(getDb(), who, s(form, "userId"), s(form, "active") === "true");
    revalidatePath("/panel/usuarios");
    return { ok: "Listo." };
  } catch (err) {
    return { error: publicMessage(err) };
  }
}
