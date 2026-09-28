import { describe, expect, it } from "vitest";
import { requiredApprovals, resolveApproval } from "@/domain/approvals";
import { roleCan } from "@/domain/permissions";
import { redact } from "@/domain/redact";
import { ISO_COUNTRIES } from "@/domain/countries";
import {
  countryName,
  DEFAULT_SETTINGS,
  factInputSchema,
  normalizeWebsite,
  settingsSchema,
} from "@/domain/validation";
import { RateLimiter } from "@/server/auth/rate-limit";

const PID = "00000000-0000-4000-8000-000000000001";

describe("normalizeWebsite", () => {
  it("agrega https y quita www para deduplicar", () => {
    expect(normalizeWebsite("www.Ejemplo.com.ar/")).toEqual({
      url: "https://www.ejemplo.com.ar/",
      domain: "ejemplo.com.ar",
    });
  });
  it.each([
    "javascript:alert(1)",
    "ftp://ejemplo.com",
    "http://localhost:3000",
    "http://192.168.0.10",
    "http://10.0.0.1",
    "https://usuario:clave@ejemplo.com",
    "intranet",
  ])("rechaza %s", (u) => {
    expect(() => normalizeWebsite(u)).toThrow();
  });
});

describe("hechos con fuente (sección 4.1)", () => {
  const base = {
    prospectId: PID,
    category: "contact",
    field: "Email",
    value: "info@empresa.com",
    confidence: 80,
  };
  it("un hecho observado sin URL de fuente se rechaza", () => {
    const r = factInputSchema.safeParse({ ...base, kind: "observed", verification: "probable" });
    expect(r.success).toBe(false);
  });
  it("verificado sin URL de fuente se rechaza", () => {
    const r = factInputSchema.safeParse({ ...base, kind: "inference", verification: "verified" });
    expect(r.success).toBe(false);
  });
  it("una inferencia nunca puede figurar como verificada, aunque tenga fuente", () => {
    const r = factInputSchema.safeParse({
      ...base,
      kind: "inference",
      verification: "verified",
      sourceUrl: "https://empresa.com",
    });
    expect(r.success).toBe(false);
  });
  it("rechaza fuentes con esquemas peligrosos", () => {
    const r = factInputSchema.safeParse({
      ...base,
      kind: "observed",
      verification: "probable",
      sourceUrl: "javascript:alert(1)",
    });
    expect(r.success).toBe(false);
  });
  it("acepta un hecho observado y verificado con fuente", () => {
    const r = factInputSchema.safeParse({
      ...base,
      kind: "observed",
      verification: "verified",
      sourceUrl: "https://empresa.com/contacto",
    });
    expect(r.success).toBe(true);
  });
  it("acepta una hipótesis sin fuente, como no verificada", () => {
    const r = factInputSchema.safeParse({ ...base, kind: "hypothesis", verification: "unconfirmed" });
    expect(r.success).toBe(true);
  });
});

describe("configuración", () => {
  it("los valores por defecto son válidos y conservadores", () => {
    expect(settingsSchema.safeParse(DEFAULT_SETTINGS).success).toBe(true);
    expect(DEFAULT_SETTINGS.autonomy).toBe("manual");
    expect(DEFAULT_SETTINGS.apiBudgetUsdMonthly).toBe(0);
  });
  it("rechaza horario invertido y zona horaria inventada", () => {
    const bad1 = { ...DEFAULT_SETTINGS, schedule: { ...DEFAULT_SETTINGS.schedule, startHour: 20, endHour: 8 } };
    const bad2 = { ...DEFAULT_SETTINGS, schedule: { ...DEFAULT_SETTINGS.schedule, timezone: "Marte/Olympus" } };
    expect(settingsSchema.safeParse(bad1).success).toBe(false);
    expect(settingsSchema.safeParse(bad2).success).toBe(false);
  });
  it("rechaza códigos de país inexistentes o reservados", () => {
    for (const c of ["XX", "ZZ", "EU", "UN", "QO"]) {
      expect(settingsSchema.safeParse({ ...DEFAULT_SETTINGS, countries: [c] }).success).toBe(false);
    }
    expect(settingsSchema.safeParse({ ...DEFAULT_SETTINGS, countries: ["AR", "cl", "US"] }).success).toBe(true);
  });
  it("la lista de países tiene los 249 códigos ISO 3166-1 y todos tienen nombre en español", () => {
    expect(ISO_COUNTRIES.size).toBe(249);
    for (const c of ISO_COUNTRIES) expect(countryName(c)).not.toBe(c);
  });
});

describe("aprobaciones", () => {
  const now = new Date("2026-09-28T12:00:00Z");
  it("borrar datos de producción exige dos aprobaciones", () => {
    expect(requiredApprovals("delete_production_data")).toBe(2);
    expect(requiredApprovals("send_email")).toBe(1);
  });
  it("la misma persona aprobando dos veces no cuenta doble", () => {
    const d = [
      { userId: "a", decision: "approve" as const },
      { userId: "a", decision: "approve" as const },
    ];
    expect(resolveApproval(2, d, now, null)).toBe("pending");
  });
  it("dos personas distintas completan la doble aprobación", () => {
    const d = [
      { userId: "a", decision: "approve" as const },
      { userId: "b", decision: "approve" as const },
    ];
    expect(resolveApproval(2, d, now, null)).toBe("approved");
  });
  it("un rechazo alcanza", () => {
    expect(resolveApproval(2, [{ userId: "a", decision: "reject" }], now, null)).toBe("rejected");
  });
  it("vence si pasó la fecha límite", () => {
    expect(resolveApproval(1, [], now, new Date("2026-09-27T00:00:00Z"))).toBe("expired");
  });
});

describe("permisos", () => {
  it("solo el propietario decide aprobaciones y gestiona usuarios", () => {
    expect(roleCan("owner", "approvals.decide")).toBe(true);
    expect(roleCan("operator", "approvals.decide")).toBe(false);
    expect(roleCan("operator", "users.manage")).toBe(false);
    expect(roleCan("viewer", "prospects.write")).toBe(false);
  });
});

describe("redact", () => {
  it("oculta secretos en cualquier nivel", () => {
    expect(
      redact({ email: "a@b.c", password: "x", nested: { apiKey: "k", ok: 1 }, list: [{ token: "t" }] }),
    ).toEqual({ email: "a@b.c", password: "[oculto]", nested: { apiKey: "[oculto]", ok: 1 }, list: [{ token: "[oculto]" }] });
  });
});

describe("RateLimiter", () => {
  it("corta después del máximo y se reinicia al pasar la ventana", () => {
    const rl = new RateLimiter(2, 1000);
    expect(rl.hit("ip", 0)).toBe(true);
    expect(rl.hit("ip", 1)).toBe(true);
    expect(rl.hit("ip", 2)).toBe(false);
    expect(rl.hit("ip", 1001)).toBe(true);
  });
});
