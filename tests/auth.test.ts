import { eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeDb } from "@/db/client";
import { sessions, users } from "@/db/schema";
import {
  hashToken,
  login,
  logout,
  MAX_FAILED_LOGINS,
  principalFromToken,
} from "@/server/auth/sessions";
import { setUserActive } from "@/server/services/users";
import { db, makeUser, PASSWORD, resetData } from "./helpers";

beforeEach(resetData);
afterAll(closeDb);

describe("login", () => {
  it("entra con la contraseña correcta y la sesión identifica a la persona", async () => {
    const u = await makeUser("operator");
    const r = await login(db(), u.email.toUpperCase(), PASSWORD);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const p = await principalFromToken(db(), r.token);
    expect(p).toMatchObject({ kind: "user", id: u.id, role: "operator" });
  });

  it("el token nunca se guarda en claro", async () => {
    const u = await makeUser();
    const r = await login(db(), u.email, PASSWORD);
    if (!r.ok) throw new Error("login falló");
    const rows = await db().select().from(sessions);
    expect(rows[0]!.tokenHash).toBe(hashToken(r.token));
    expect(JSON.stringify(rows)).not.toContain(r.token);
  });

  it("da el mismo error para email desconocido y contraseña incorrecta", async () => {
    const u = await makeUser();
    const a = await login(db(), "nadie@prueba.test", PASSWORD);
    const b = await login(db(), u.email, "otra-clave-999");
    expect(a).toEqual({ ok: false, reason: "invalid" });
    expect(b).toEqual({ ok: false, reason: "invalid" });
  });

  it(`bloquea la cuenta después de ${MAX_FAILED_LOGINS} intentos fallidos, incluso con la clave correcta`, async () => {
    const u = await makeUser();
    for (let i = 0; i < MAX_FAILED_LOGINS - 1; i++) {
      expect((await login(db(), u.email, "mal-mal-123")).ok).toBe(false);
    }
    expect(await login(db(), u.email, "mal-mal-123")).toEqual({ ok: false, reason: "locked" });
    expect(await login(db(), u.email, PASSWORD)).toEqual({ ok: false, reason: "locked" });
    const alerts = await db().execute(sql`SELECT count(*)::int AS n FROM audit_log WHERE action = 'auth.locked'`);
    expect(alerts.rows[0]).toEqual({ n: 1 });
  });

  it("no registra la contraseña en la auditoría", async () => {
    const u = await makeUser();
    await login(db(), u.email, "clave-equivocada-1");
    const rows = await db().execute(sql`SELECT metadata::text AS m FROM audit_log`);
    for (const r of rows.rows as { m: string }[]) expect(r.m).not.toContain("clave-equivocada-1");
  });
});

describe("sesiones", () => {
  it("logout revoca la sesión", async () => {
    const u = await makeUser();
    const r = await login(db(), u.email, PASSWORD);
    if (!r.ok) throw new Error();
    await logout(db(), r.token);
    expect(await principalFromToken(db(), r.token)).toBeNull();
  });

  it("vence por inactividad", async () => {
    const u = await makeUser();
    const r = await login(db(), u.email, PASSWORD);
    if (!r.ok) throw new Error();
    await db()
      .update(sessions)
      .set({ lastSeenAt: new Date(Date.now() - 13 * 3_600_000) })
      .where(eq(sessions.userId, u.id));
    expect(await principalFromToken(db(), r.token)).toBeNull();
  });

  it("desactivar a una persona corta todas sus sesiones", async () => {
    const owner = await makeUser("owner");
    const op = await makeUser("operator");
    const r = await login(db(), op.email, PASSWORD);
    if (!r.ok) throw new Error();
    await setUserActive(db(), owner, op.id, false);
    expect(await principalFromToken(db(), r.token)).toBeNull();
    expect((await login(db(), op.email, PASSWORD)).ok).toBe(false);
  });

  it("no se puede dejar el sistema sin propietario activo", async () => {
    const owner = await makeUser("owner");
    const other = await makeUser("owner");
    await setUserActive(db(), owner, other.id, false);
    await expect(setUserActive(db(), other, owner.id, false)).rejects.toThrow();
    const [row] = await db().select().from(users).where(eq(users.id, owner.id));
    expect(row!.active).toBe(true);
  });

  it("tokens basura no rompen nada", async () => {
    expect(await principalFromToken(db(), "")).toBeNull();
    expect(await principalFromToken(db(), "x".repeat(5000))).toBeNull();
    expect(await principalFromToken(db(), "'; DROP TABLE users; --")).toBeNull();
  });
});
