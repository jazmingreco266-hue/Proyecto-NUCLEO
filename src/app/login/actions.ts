"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { emailSchema } from "@/domain/validation";
import {
  clearSessionCookie,
  clientIp,
  sessionToken,
  setSessionCookie,
} from "@/server/auth/current";
import { loginLimiter } from "@/server/auth/rate-limit";
import { login, logout } from "@/server/auth/sessions";
import { headers } from "next/headers";

export type LoginState = { error?: string; email?: string };

export async function loginAction(_prev: LoginState, form: FormData): Promise<LoginState> {
  const rawEmail = String(form.get("email") ?? "").slice(0, 254);
  const password = String(form.get("password") ?? "").slice(0, 200);
  const email = emailSchema.safeParse(rawEmail);
  if (!email.success || !password) return { error: "Completá email y contraseña.", email: rawEmail };

  const ip = await clientIp();
  if (!loginLimiter.hit(ip ?? "sin-ip")) {
    return { error: "Demasiados intentos desde esta conexión. Esperá 15 minutos.", email: rawEmail };
  }
  const userAgent = (await headers()).get("user-agent");
  const r = await login(getDb(), email.data, password, { ip, userAgent });
  if (!r.ok) {
    return {
      error:
        r.reason === "locked"
          ? "La cuenta está bloqueada por intentos fallidos. Probá de nuevo en 15 minutos."
          : "Email o contraseña incorrectos.",
      email: rawEmail,
    };
  }
  await setSessionCookie(r.token);
  redirect("/panel");
}

export async function logoutAction() {
  await logout(getDb(), await sessionToken());
  await clearSessionCookie();
  redirect("/login");
}
