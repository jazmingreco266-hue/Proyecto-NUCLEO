import { desc, eq, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { settings, settingsHistory, users } from "@/db/schema";
import { DEFAULT_SETTINGS, settingsSchema, type Settings } from "@/domain/validation";
import { audit } from "../audit";
import { assertCan, ConflictError, UserFacingError, type Principal } from "../principal";

export async function getSettings(db: Db, who: Principal): Promise<{ data: Settings; version: number; updatedAt: Date | null }> {
  assertCan(who, "settings.read");
  const [row] = await db.select().from(settings).where(eq(settings.id, 1)).limit(1);
  if (!row) return { data: DEFAULT_SETTINGS, version: 0, updatedAt: null };
  // Si una versión vieja guardada ya no cumple el esquema, se completa con los valores por defecto.
  const stored = row.data as Partial<Settings>;
  const merged = { ...DEFAULT_SETTINGS, ...stored };
  for (const k of ["schedule", "discard", "targeting", "sender"] as const) {
    (merged as Record<string, unknown>)[k] = { ...DEFAULT_SETTINGS[k], ...(stored[k] ?? {}) };
  }
  const parsed = settingsSchema.safeParse(merged);
  return { data: parsed.success ? parsed.data : DEFAULT_SETTINGS, version: row.version, updatedAt: row.updatedAt };
}

export async function updateSettings(db: Db, who: Principal, input: unknown, expectedVersion: number) {
  assertCan(who, "settings.write");
  if (who.kind !== "user") throw new UserFacingError("Solo una persona puede cambiar la configuración.");
  const r = settingsSchema.safeParse(input);
  if (!r.success) throw new UserFacingError(r.error.issues.map((i) => i.message).join(" · "));
  const data = r.data;

  return db.transaction(async (tx) => {
    const [cur] = await tx.select().from(settings).where(eq(settings.id, 1)).for("update").limit(1);
    const currentVersion = cur?.version ?? 0;
    if (currentVersion !== expectedVersion) {
      throw new ConflictError("La configuración cambió mientras la editabas. Recargá la página.");
    }
    const version = currentVersion + 1;
    const now = new Date();
    if (cur) {
      await tx.update(settings).set({ data, version, updatedBy: who.id, updatedAt: now }).where(eq(settings.id, 1));
    } else {
      await tx.insert(settings).values({ id: 1, data, version, updatedBy: who.id, updatedAt: now });
    }
    await tx.insert(settingsHistory).values({ version, data, changedBy: who.id });
    await audit(tx, who, { action: "settings.update", entityType: "settings", entityId: "1", metadata: { version } });
    return { version };
  });
}

export async function settingsHistoryList(db: Db, who: Principal) {
  assertCan(who, "settings.read");
  return db
    .select({ id: settingsHistory.id, version: settingsHistory.version, changedAt: settingsHistory.changedAt, by: users.name })
    .from(settingsHistory)
    .leftJoin(users, eq(users.id, settingsHistory.changedBy))
    .orderBy(desc(settingsHistory.version))
    .limit(20);
}

/** Zona horaria vigente, para cálculos como "empresas encontradas hoy". */
export async function currentTimezone(db: Db): Promise<string> {
  const r = await db.execute<{ tz: string | null }>(sql`SELECT data->'schedule'->>'timezone' AS tz FROM settings WHERE id = 1`);
  return r.rows[0]?.tz ?? DEFAULT_SETTINGS.schedule.timezone;
}
