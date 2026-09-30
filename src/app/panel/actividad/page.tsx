import type { Metadata } from "next";
import { getDb } from "@/db/client";
import { requireUser } from "@/server/auth/current";
import { listAudit } from "@/server/services/dashboard";
import { When } from "../../ui/format";

export const metadata: Metadata = { title: "Actividad" };

const ACTION_TEXT: Record<string, string> = {
  "auth.login": "Inició sesión",
  "auth.logout": "Cerró sesión",
  "auth.login_failed": "Intento de ingreso fallido",
  "auth.locked": "Cuenta bloqueada por intentos",
  "auth.login_blocked": "Intento de ingreso con cuenta bloqueada",
  "prospect.create": "Cargó un prospecto",
  "prospect.transition": "Cambió el estado de un prospecto",
  "prospect.pause": "Pausó un prospecto",
  "prospect.resume": "Reanudó un prospecto",
  "fact.create": "Agregó un dato con fuente",
  "fact.remove": "Retiró un dato",
  "note.create": "Agregó una nota",
  "approval.request": "Pidió una aprobación",
  "approval.approve": "Aprobó una solicitud",
  "approval.reject": "Rechazó una solicitud",
  "settings.update": "Cambió la configuración",
  "user.create": "Creó un usuario",
  "user.activate": "Reactivó un usuario",
  "user.deactivate": "Desactivó un usuario",
  "data.export": "Descargó una copia de seguridad",
  "run.enqueue": "Encoló una tarea de agente",
  "run.succeeded": "Completó una tarea",
  "run.retry_scheduled": "Programó un reintento",
  "run.failed": "Una tarea falló",
  "run.blocked": "Una tarea quedó bloqueada",
  "run.retry": "Reintentó una tarea",
  "run.cancel": "Canceló una tarea",
  "audit.create": "Guardó una auditoría web",
  "research.facts": "Guardó datos de una investigación con IA",
  "outreach.prepare": "Preparó mensajes de contacto",
  "sale.create": "Registró una venta",
  "sale.paid": "Marcó una venta como cobrada",
  "sale.void": "Anuló una venta",
  "expense.create": "Registró un gasto",
  "expense.paid": "Marcó un gasto como pagado",
  "expense.void": "Anuló un gasto",
  "quote.create": "Creó un presupuesto",
  "quote.status": "Cambió el estado de un presupuesto",
  "quote.to_sale": "Registró un presupuesto como venta",
  "finance.export": "Descargó las finanzas en Excel",
  "portfolio.create": "Agregó un trabajo al portafolio",
  "portfolio.update": "Editó un trabajo del portafolio",
  "portfolio.remove": "Retiró un trabajo del portafolio",
};

export default async function ActivityPage() {
  const me = await requireUser("audit.read");
  const rows = await listAudit(getDb(), me, 300);
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Actividad</h1>
          <p>
            Registro de todo lo que pasó en el panel: quién, qué y cuándo. No se puede editar ni borrar. Las
            contraseñas y claves nunca se guardan acá.
          </p>
        </div>
      </div>
      {rows.length === 0 ? (
        <div className="empty">
          <h3>Sin actividad registrada</h3>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="cards">
            <thead>
              <tr>
                <th scope="col">Cuándo</th>
                <th scope="col">Quién</th>
                <th scope="col">Qué</th>
                <th scope="col">Detalle</th>
                <th scope="col">IP</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ a, userName }) => (
                <tr key={a.id}>
                  <td className="cell-title">
                    <When date={a.createdAt} />
                  </td>
                  <td data-label="Quién">
                    {a.actorType === "user"
                      ? (userName ?? "Persona")
                      : a.actorType === "agent"
                        ? `Agente ${a.actorId}`
                        : "Sistema"}
                  </td>
                  <td data-label="Qué">{ACTION_TEXT[a.action] ?? a.action}</td>
                  <td data-label="Detalle">
                    {Object.keys(a.metadata as object).length ? (
                      <details className="disclose">
                        <summary className="faint">Ver</summary>
                        <pre className="payload">{JSON.stringify(a.metadata, null, 2)}</pre>
                      </details>
                    ) : (
                      <span className="faint">—</span>
                    )}
                  </td>
                  <td data-label="IP" className="faint">
                    {a.ip ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
