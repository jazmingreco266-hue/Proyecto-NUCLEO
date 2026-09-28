import Link from "next/link";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { ROLE_LABELS } from "@/domain/permissions";
import { requireUser } from "@/server/auth/current";
import { can } from "@/server/principal";
import { logoutAction } from "../login/actions";
import { Wordmark } from "../ui/brand";
import { Nav } from "./nav";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const me = await requireUser();
  const counts = await getDb().execute<{ pending: number; problems: number }>(
    sql`SELECT (SELECT count(*)::int FROM approvals WHERE status = 'pending') AS pending,
               (SELECT count(*)::int FROM agent_runs WHERE status IN ('failed', 'blocked')) AS problems`,
  );

  const items = [
    { href: "/panel", label: "Vista general" },
    { href: "/panel/oportunidades", label: "Oportunidades" },
    { href: "/panel/aprobaciones", label: "Aprobaciones", count: counts.rows[0]?.pending ?? 0 },
    { href: "/panel/tareas", label: "Tareas", count: counts.rows[0]?.problems ?? 0 },
    { href: "/panel/configuracion", label: "Configuración" },
    ...(can(me, "users.manage") ? [{ href: "/panel/usuarios", label: "Usuarios" }] : []),
    ...(can(me, "audit.read") ? [{ href: "/panel/actividad", label: "Actividad" }] : []),
  ];

  return (
    <div className="shell">
      <aside className="sidebar">
        <Link href="/panel" className="brand">
          <Wordmark />
        </Link>
        <Nav items={items} />
        <div className="sidebar-foot">
          <div className="who">
            <strong>{me.name}</strong>
            <span className="faint">{ROLE_LABELS[me.role]}</span>
          </div>
          <form action={logoutAction}>
            <button className="btn btn-ghost btn-small">Salir</button>
          </form>
        </div>
      </aside>
      <main className="main" id="contenido">
        {children}
      </main>
    </div>
  );
}
