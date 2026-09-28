import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { and, eq, gt, isNull, lt, or, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { sessions, users } from "@/db/schema";
import type { Role } from "@/domain/permissions";
import { audit } from "../audit";
import type { Principal } from "../principal";

export const BCRYPT_COST = 12;
export const MAX_FAILED_LOGINS = 5;
export const LOCK_MINUTES = 15;
export const SESSION_ABSOLUTE_HOURS = 24 * 7;
export const SESSION_IDLE_HOURS = 12;

// Hash de una contraseña que no existe: se compara igual cuando el email no existe,
// para que la respuesta tarde lo mismo y no revele qué emails están registrados.
const DUMMY_HASH = bcrypt.hashSync("contraseña-inexistente-para-tiempo-constante", BCRYPT_COST);

export const hashPassword = (plain: string) => bcrypt.hash(plain, BCRYPT_COST);

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type LoginResult =
  | { ok: true; token: string; user: { id: string; role: Role; name: string } }
  | { ok: false; reason: "invalid" | "locked" };

const GENERIC_FAIL = { ok: false, reason: "invalid" } as const;

export async function login(
  db: Db,
  email: string,
  password: string,
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<LoginResult> {
  const normalized = email.trim().toLowerCase();
  const [user] = await db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = ${normalized}`)
    .limit(1);

  if (!user || !user.active) {
    await bcrypt.compare(password, DUMMY_HASH);
    await audit(db, "system", {
      action: "auth.login_failed",
      metadata: { email: normalized, motivo: user ? "usuario inactivo" : "email desconocido" },
      ip: meta.ip,
    });
    return GENERIC_FAIL;
  }

  const now = new Date();
  if (user.lockedUntil && user.lockedUntil > now) {
    await bcrypt.compare(password, DUMMY_HASH);
    await audit(db, "system", {
      action: "auth.login_blocked",
      entityType: "user",
      entityId: user.id,
      ip: meta.ip,
    });
    return { ok: false, reason: "locked" };
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    const failed = user.failedLogins + 1;
    const lock = failed >= MAX_FAILED_LOGINS;
    await db
      .update(users)
      .set({
        failedLogins: lock ? 0 : failed,
        lockedUntil: lock ? new Date(now.getTime() + LOCK_MINUTES * 60_000) : user.lockedUntil,
        updatedAt: now,
      })
      .where(eq(users.id, user.id));
    await audit(db, "system", {
      action: lock ? "auth.locked" : "auth.login_failed",
      entityType: "user",
      entityId: user.id,
      metadata: { intentos: failed },
      ip: meta.ip,
    });
    return lock ? { ok: false, reason: "locked" } : GENERIC_FAIL;
  }

  const token = randomBytes(32).toString("base64url");
  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ failedLogins: 0, lockedUntil: null, lastLoginAt: now, updatedAt: now })
      .where(eq(users.id, user.id));
    await tx.insert(sessions).values({
      tokenHash: hashToken(token),
      userId: user.id,
      expiresAt: new Date(now.getTime() + SESSION_ABSOLUTE_HOURS * 3_600_000),
      ip: meta.ip ?? null,
      userAgent: meta.userAgent?.slice(0, 300) ?? null,
    });
    await audit(tx, "system", {
      action: "auth.login",
      entityType: "user",
      entityId: user.id,
      ip: meta.ip,
    });
  });
  return { ok: true, token, user: { id: user.id, role: user.role, name: user.name } };
}

/** Devuelve la persona dueña de la sesión, o null si la sesión no es válida. */
export async function principalFromToken(db: Db, token: string | undefined): Promise<Principal | null> {
  if (!token || token.length > 200) return null;
  const now = new Date();
  const idleLimit = new Date(now.getTime() - SESSION_IDLE_HOURS * 3_600_000);
  const [row] = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(
      and(
        eq(sessions.tokenHash, hashToken(token)),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, now),
        gt(sessions.lastSeenAt, idleLimit),
        eq(users.active, true),
      ),
    )
    .limit(1);
  if (!row) return null;

  // Actualiza la actividad como mucho cada 5 minutos, para no escribir en cada request.
  if (now.getTime() - row.session.lastSeenAt.getTime() > 5 * 60_000) {
    await db.update(sessions).set({ lastSeenAt: now }).where(eq(sessions.tokenHash, row.session.tokenHash));
  }
  return { kind: "user", id: row.user.id, role: row.user.role, name: row.user.name, email: row.user.email };
}

export async function logout(db: Db, token: string | undefined) {
  if (!token) return;
  const [s] = await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.tokenHash, hashToken(token)), isNull(sessions.revokedAt)))
    .returning({ userId: sessions.userId });
  if (s) await audit(db, "system", { action: "auth.logout", entityType: "user", entityId: s.userId });
}

/** Revoca todas las sesiones de una persona (por ejemplo, al desactivarla). */
export async function revokeAllSessions(db: Pick<Db, "update">, userId: string) {
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
}

export async function purgeExpiredSessions(db: Db) {
  const cutoff = new Date(Date.now() - 30 * 24 * 3_600_000);
  await db.delete(sessions).where(or(lt(sessions.expiresAt, cutoff), lt(sessions.revokedAt, cutoff)));
}
