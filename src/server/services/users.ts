import { asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db/client";
import { users } from "@/db/schema";
import { ROLES } from "@/domain/permissions";
import { emailSchema, passwordSchema } from "@/domain/validation";
import { audit } from "../audit";
import { hashPassword, revokeAllSessions } from "../auth/sessions";
import { assertCan, ConflictError, NotFoundError, UserFacingError, type Principal } from "../principal";

const newUserSchema = z.object({
  email: emailSchema,
  name: z.string().trim().min(2, "Escribí el nombre").max(120),
  role: z.enum(ROLES),
  password: passwordSchema,
});

/**
 * Alta de usuario. `who = "bootstrap"` solo lo usa el script de consola para crear
 * el primer propietario; desde el panel siempre hay una persona con users.manage.
 */
export async function createUser(db: Db, who: Principal | "bootstrap", input: unknown) {
  if (who !== "bootstrap") assertCan(who, "users.manage");
  const r = newUserSchema.safeParse(input);
  if (!r.success) throw new UserFacingError(r.error.issues.map((i) => i.message).join(" · "));
  const data = r.data;
  const passwordHash = await hashPassword(data.password);

  return db.transaction(async (tx) => {
    const [dup] = await tx
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.email}) = ${data.email}`)
      .limit(1);
    if (dup) throw new ConflictError("Ya existe un usuario con ese email.");
    const [u] = await tx
      .insert(users)
      .values({ email: data.email, name: data.name, role: data.role, passwordHash })
      .returning({ id: users.id, email: users.email, name: users.name, role: users.role });
    await audit(tx, who === "bootstrap" ? "system" : who, {
      action: "user.create",
      entityType: "user",
      entityId: u!.id,
      metadata: { email: u!.email, rol: u!.role, via: who === "bootstrap" ? "consola" : "panel" },
    });
    return u!;
  });
}

export async function listUsers(db: Db, who: Principal) {
  assertCan(who, "users.manage");
  return db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      active: users.active,
      lastLoginAt: users.lastLoginAt,
      lockedUntil: users.lockedUntil,
    })
    .from(users)
    .orderBy(asc(users.createdAt));
}

export async function setUserActive(db: Db, who: Principal, userId: string, active: boolean) {
  assertCan(who, "users.manage");
  if (who.kind !== "user") throw new UserFacingError("Solo una persona puede gestionar usuarios.");
  if (who.id === userId && !active) throw new UserFacingError("No podés desactivar tu propia cuenta.");
  return db.transaction(async (tx) => {
    const [target] = await tx.select().from(users).where(eq(users.id, userId)).for("update").limit(1);
    if (!target) throw new NotFoundError("El usuario");
    if (!active && target.role === "owner") {
      const [{ n }] = (await tx.execute<{ n: number }>(
        sql`SELECT count(*)::int AS n FROM users WHERE role = 'owner' AND active AND id <> ${userId}`,
      )).rows as [{ n: number }];
      if (n === 0) throw new UserFacingError("Tiene que quedar al menos un propietario activo.");
    }
    await tx.update(users).set({ active, updatedAt: new Date() }).where(eq(users.id, userId));
    if (!active) await revokeAllSessions(tx, userId);
    await audit(tx, who, {
      action: active ? "user.activate" : "user.deactivate",
      entityType: "user",
      entityId: userId,
    });
  });
}
