"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { currentPrincipal } from "@/server/auth/current";
import { publicMessage } from "@/server/principal";
import {
  createExpense,
  createQuote,
  createSale,
  markExpensePaid,
  markSalePaid,
  quoteToSale,
  removePortfolioItem,
  savePortfolioItem,
  setQuoteStatus,
  voidMovement,
} from "@/server/services/finance";
import { parseAmount } from "@/domain/finance";
import type { ActionState } from "../oportunidades/actions";

async function me() {
  const p = await currentPrincipal();
  if (!p) redirect("/login");
  return p;
}
const str = (f: FormData, k: string) => {
  const v = f.get(k);
  return typeof v === "string" ? v : "";
};
const values = (f: FormData) => {
  const out: Record<string, string> = {};
  for (const [k, v] of f.entries()) if (typeof v === "string" && !k.startsWith("$")) out[k] = v.slice(0, 2000);
  return out;
};
const money = parseAmount;
const lines = (f: FormData, k: string) =>
  str(f, k)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

async function run(fn: () => Promise<unknown>, ok: string, form?: FormData): Promise<ActionState> {
  try {
    await fn();
  } catch (err) {
    if (!(err instanceof Error) || !["UserFacingError", "NotFoundError", "ConflictError", "ForbiddenError"].includes(err.name)) console.error("[finanzas]", err);
    return { error: publicMessage(err), values: form ? values(form) : undefined };
  }
  revalidatePath("/panel", "layout");
  return { ok };
}

export async function createSaleAction(_: ActionState, f: FormData): Promise<ActionState> {
  const who = await me();
  return run(
    () =>
      createSale(getDb(), who, {
        occurredOn: str(f, "occurredOn"),
        description: str(f, "description"),
        clientName: str(f, "clientName"),
        amount: money(str(f, "amount")),
        currency: str(f, "currency"),
        status: str(f, "status"),
        paidOn: str(f, "paidOn") || null,
        method: str(f, "method"),
        notes: str(f, "notes"),
      }),
    "Venta registrada.",
    f,
  );
}

export async function createExpenseAction(_: ActionState, f: FormData): Promise<ActionState> {
  const who = await me();
  return run(
    () =>
      createExpense(getDb(), who, {
        occurredOn: str(f, "occurredOn"),
        description: str(f, "description"),
        category: str(f, "category"),
        vendor: str(f, "vendor"),
        amount: money(str(f, "amount")),
        currency: str(f, "currency"),
        status: str(f, "status"),
        paidOn: str(f, "paidOn") || null,
        notes: str(f, "notes"),
      }),
    "Gasto registrado.",
    f,
  );
}

export async function markPaidAction(_: ActionState, f: FormData): Promise<ActionState> {
  const who = await me();
  const kind = str(f, "kind");
  return run(
    () => (kind === "sale" ? markSalePaid(getDb(), who, str(f, "id"), str(f, "paidOn")) : markExpensePaid(getDb(), who, str(f, "id"), str(f, "paidOn"))),
    kind === "sale" ? "Marcada como cobrada." : "Marcado como pagado.",
  );
}

export async function voidAction(_: ActionState, f: FormData): Promise<ActionState> {
  const who = await me();
  return run(() => voidMovement(getDb(), who, str(f, "kind") === "sale" ? "sale" : "expense", str(f, "id"), str(f, "reason")), "Anulado. Sigue visible en el historial, pero ya no suma.", f);
}

export async function createQuoteAction(_: ActionState, f: FormData): Promise<ActionState> {
  const who = await me();
  let id = "";
  let parsedLines: unknown;
  try {
    parsedLines = JSON.parse(str(f, "lines") || "[]");
  } catch {
    parsedLines = [];
  }
  const r = await run(async () => {
    const q = await createQuote(getDb(), who, {
      clientName: str(f, "clientName"),
      currency: str(f, "currency"),
      lines: parsedLines,
      discountPct: str(f, "discountPct") || "0",
      taxPct: str(f, "taxPct") || "0",
      validUntil: str(f, "validUntil") || null,
      notes: str(f, "notes"),
    });
    id = q.id;
  }, "");
  if (r.error) return { ...r, values: values(f) };
  redirect(`/panel/cotizador/${id}`);
}

export async function quoteStatusAction(_: ActionState, f: FormData): Promise<ActionState> {
  const who = await me();
  const to = str(f, "to") as "enviado" | "aceptado" | "rechazado";
  return run(() => setQuoteStatus(getDb(), who, str(f, "id"), to), `Presupuesto marcado como ${to}.`);
}

export async function quoteToSaleAction(_: ActionState, f: FormData): Promise<ActionState> {
  const who = await me();
  return run(() => quoteToSale(getDb(), who, str(f, "id")), "Registrado como venta pendiente de cobro (ver Finanzas).");
}

export async function savePortfolioAction(_: ActionState, f: FormData): Promise<ActionState> {
  const who = await me();
  const id = str(f, "id") || undefined;
  return run(
    () =>
      savePortfolioItem(
        getDb(),
        who,
        {
          title: str(f, "title"),
          clientName: str(f, "clientName"),
          url: str(f, "url"),
          year: str(f, "year") || null,
          summary: str(f, "summary"),
          highlights: lines(f, "highlights"),
          tags: str(f, "tags")
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          services: f.getAll("services").map(String),
          featured: f.get("featured") === "on",
          clientOk: f.get("clientOk") === "on",
        },
        id,
      ),
    id ? "Trabajo actualizado." : "Trabajo agregado al portafolio.",
    f,
  );
}

export async function removePortfolioAction(_: ActionState, f: FormData): Promise<ActionState> {
  const who = await me();
  return run(() => removePortfolioItem(getDb(), who, str(f, "id")), "Trabajo retirado del portafolio.");
}
