import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import type { Role } from "@/domain/permissions";
import type { Principal } from "@/server/principal";
import { createUser } from "@/server/services/users";

export const db = () => getDb();

/** Vacía los datos entre tests. TRUNCATE no dispara los triggers de solo-agregado. */
export async function resetData() {
  await db().execute(sql`TRUNCATE users, sessions, prospects, prospect_facts, pipeline_events,
    approvals, approval_decisions, notes, settings, settings_history, audit_log, agent_runs, site_audits, outreach_messages, sales, expenses, quotes, portfolio_items
    RESTART IDENTITY CASCADE`);
}

export const PASSWORD = "clave-segura-123";

let n = 0;
export async function makeUser(role: Role = "owner"): Promise<Principal & { kind: "user" }> {
  n += 1;
  const u = await createUser(db(), "bootstrap", {
    email: `persona${n}@prueba.test`,
    name: `Persona ${n}`,
    role,
    password: PASSWORD,
  });
  return { kind: "user", id: u.id, role: u.role, name: u.name, email: u.email };
}

export const agent: Principal = { kind: "agent", name: "test" };
