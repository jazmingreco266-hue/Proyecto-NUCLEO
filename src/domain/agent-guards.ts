/**
 * Reglas que el orquestador aplica antes de ejecutar cada trabajo.
 * Funciones puras: reciben la configuración y el momento, y devuelven una decisión.
 */
import type { Settings } from "./validation";

export type Guard = { ok: true } | { ok: false; kind: "postpone" | "block"; reason: string; until?: Date };

/** Hora local y día de la semana (0 = domingo) en la zona horaria configurada. */
export function localClock(now: Date, timezone: string): { hour: number; weekday: number } {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "numeric", hourCycle: "h23", weekday: "short" }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const wd = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
  return { hour, weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wd) };
}

export function withinSchedule(schedule: Settings["schedule"], now: Date): boolean {
  const { hour, weekday } = localClock(now, schedule.timezone);
  return schedule.weekdays.includes(weekday) && hour >= schedule.startHour && hour < schedule.endHour;
}

/**
 * Trabajos automáticos (los pide el sistema, no una persona): respetan la autonomía y el horario.
 * Los que pide una persona desde el panel se ejecutan al momento.
 */
export function scheduleGuard(settings: Settings, requestedByUser: boolean, now: Date): Guard {
  if (requestedByUser) return { ok: true };
  if (settings.autonomy === "manual") {
    return { ok: false, kind: "postpone", reason: "Autonomía manual: los trabajos automáticos esperan.", until: new Date(now.getTime() + 60 * 60_000) };
  }
  if (!withinSchedule(settings.schedule, now)) {
    return { ok: false, kind: "postpone", reason: "Fuera del horario de ejecución configurado.", until: new Date(now.getTime() + 30 * 60_000) };
  }
  return { ok: true };
}

/** Un trabajo con costo estimado no corre si supera el presupuesto mensual. */
export function budgetGuard(budgetUsd: number, spentUsd: number, estimatedUsd: number): Guard {
  if (estimatedUsd <= 0) return { ok: true };
  if (spentUsd + estimatedUsd > budgetUsd) {
    return {
      ok: false,
      kind: "block",
      reason: `Presupuesto mensual alcanzado: gastado US$ ${spentUsd.toFixed(2)} de US$ ${budgetUsd.toFixed(2)}; este trabajo estima US$ ${estimatedUsd.toFixed(2)}.`,
    };
  }
  return { ok: true };
}

/** Espera antes del reintento n (1, 2, …): 1 min, 4 min, 16 min… con tope de 6 h. */
export function backoffMs(attempt: number): number {
  return Math.min(60_000 * 4 ** (attempt - 1), 6 * 3600_000);
}

/** Un dominio está bloqueado si coincide con una fuente bloqueada o es subdominio de ella. */
export function isBlockedDomain(domain: string, blockedSources: string[]): boolean {
  const d = domain.toLowerCase();
  return blockedSources.some((raw) => {
    const b = raw.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
    return b !== "" && (d === b || d.endsWith(`.${b}`));
  });
}
