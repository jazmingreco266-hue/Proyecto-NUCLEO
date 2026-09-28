import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getDb } from "@/db/client";
import type { Permission } from "@/domain/permissions";
import { can, type Principal } from "../principal";
import { principalFromToken, SESSION_ABSOLUTE_HOURS } from "./sessions";

const isProd = process.env.NODE_ENV === "production";
// El prefijo __Host- obliga a Secure, Path=/ y sin Domain: la cookie no se comparte con subdominios.
export const SESSION_COOKIE = isProd ? "__Host-cw_session" : "cw_session";

export async function setSessionCookie(token: string) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_ABSOLUTE_HOURS * 3600,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function sessionToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

/** Persona de la sesión actual (una sola consulta por request). */
export const currentPrincipal = cache(async (): Promise<(Principal & { kind: "user" }) | null> => {
  const p = await principalFromToken(getDb(), await sessionToken());
  return p && p.kind === "user" ? p : null;
});

/** Para páginas: sin sesión, al login; sin permiso, a la vista general. */
export async function requireUser(permission?: Permission) {
  const p = await currentPrincipal();
  if (!p) redirect("/login");
  if (permission && !can(p, permission)) redirect("/panel?sin-permiso=1");
  return p;
}

export async function clientIp(): Promise<string | null> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
}
