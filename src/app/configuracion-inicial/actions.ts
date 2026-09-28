"use server";

import { timingSafeEqual, createHash } from "node:crypto";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getDb } from "@/db/client";
import { clientIp, setSessionCookie } from "@/server/auth/current";
import { loginLimiter } from "@/server/auth/rate-limit";
import { login } from "@/server/auth/sessions";
import { publicMessage } from "@/server/principal";
import { createFirstOwner } from "@/server/services/users";
import type { ActionState } from "../panel/oportunidades/actions";

function sameSecret(a: string, b: string) {
  // Se comparan hashes de igual largo para no filtrar información por el tiempo de respuesta.
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export async function firstOwnerAction(_: ActionState, form: FormData): Promise<ActionState> {
  const s = (k: string) => (typeof form.get(k) === "string" ? (form.get(k) as string) : "");
  const values = { name: s("name"), email: s("email") };
  const expected = process.env.SETUP_TOKEN ?? "";
  if (expected.length < 16) {
    return { error: "Falta configurar SETUP_TOKEN (mínimo 16 caracteres) en las variables del servidor.", values };
  }
  const ip = await clientIp();
  if (!loginLimiter.hit(`setup:${ip ?? "sin-ip"}`)) {
    return { error: "Demasiados intentos. Esperá 15 minutos.", values };
  }
  if (!sameSecret(s("token"), expected)) return { error: "El código de configuración no es correcto.", values };
  if (s("password") !== s("password2")) return { error: "Las contraseñas no coinciden.", values };

  const db = getDb();
  try {
    await createFirstOwner(db, { name: s("name"), email: s("email"), password: s("password") });
  } catch (err) {
    return { error: publicMessage(err), values };
  }
  const r = await login(db, s("email"), s("password"), { ip, userAgent: (await headers()).get("user-agent") });
  if (r.ok) await setSessionCookie(r.token);
  redirect("/panel");
}
