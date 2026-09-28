"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { currentPrincipal } from "@/server/auth/current";
import { publicMessage } from "@/server/principal";
import { cancelRun, retryRun } from "@/server/services/agent-runs";
import type { ActionState } from "../oportunidades/actions";

async function me() {
  const p = await currentPrincipal();
  if (!p) redirect("/login");
  return p;
}

export async function retryRunAction(_: ActionState, form: FormData): Promise<ActionState> {
  const who = await me();
  try {
    await retryRun(getDb(), who, String(form.get("runId") ?? ""));
  } catch (err) {
    return { error: publicMessage(err) };
  }
  revalidatePath("/panel", "layout");
  return { ok: "Tarea encolada de nuevo." };
}

export async function cancelRunAction(_: ActionState, form: FormData): Promise<ActionState> {
  const who = await me();
  try {
    await cancelRun(getDb(), who, String(form.get("runId") ?? ""));
  } catch (err) {
    return { error: publicMessage(err) };
  }
  revalidatePath("/panel", "layout");
  return { ok: "Tarea cancelada." };
}
